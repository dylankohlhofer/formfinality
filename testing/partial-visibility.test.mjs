import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEngine, fixtures, validate, runTimeline, engineAdapter, snapshot } from './lib.mjs';
import { exerciseInputs } from './exercise-inputs.mjs';
import { partialVisibilityInputs, partialMovements, partialModes } from './partial-visibility-inputs.mjs';
import { selectPack } from './packs.mjs';
import { findings, report } from './report.mjs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const root = new URL('../', import.meta.url);
const engine = await loadEngine(await readFile(process.env.FORM_COACH_TEST_BUILD || new URL('form-coach-v4.11.html', root), 'utf8'));
const poses = JSON.parse(await readFile(new URL('conformance-vectors.json', root))).poses;
const exercise = exerciseInputs(poses), partial = partialVisibilityInputs(exercise, poses);
const frameFor = await fixtures(new URL('./', import.meta.url));
const pack = JSON.parse(await readFile(new URL('./packs/partial-visibility.json', import.meta.url)));
const scenarios = await Promise.all(pack.scenarios.map(async id => validate(JSON.parse(await readFile(new URL(`./scenarios/${id}.json`, import.meta.url))))));
const replay = (s, e = engine) => runTimeline(s, engineAdapter(e, s, frameFor));
const tiers = {squat:['building','strong'], crunch:['learning','building'], 'leg-raise':['building','strong'], plank:['learning','building','strong']};

test('pack is exactly the four approved movements, with nine supported tier pairs', () => {
  assert.deepEqual(scenarios.map(s => s.movement), partialMovements);
  assert.equal(Object.values(tiers).flat().length, 9);
  for (const id of partialMovements) assert.deepEqual(engine.M[id].tiers, tiers[id]);
  assert.equal(selectPack(pack, scenarios, pack.id).length, 4);
});
for (const s of scenarios) for (const tier of tiers[s.movement]) {
  test(`${s.movement}/${tier}: shared partial-view timeline`, async () => {
    const scenario = {...s, tier, planSpec:{...s.planSpec, tiers:[tier]}};
    const r = await replay(scenario);
    assert.equal(r.checks.length, s.steps.filter(x => x.do === 'check').length);
    assert.deepEqual(r.checks.filter(c => !c.pass), []);
    if (s.movement === 'plank') {
      const at = label => r.checkpoints.find(x => s.steps[x.step].label === label).state;
      const before = at('Unused hands preserve hold time');
      for (const label of ['Missing ankles add no time (unresolved recognition limit)', 'Standing is not credited as Plank'])
        assert.equal(at(label).held, before.held, 'No tolerance may conceal credited unobserved time');
      assert.equal(at('Wholly off-screen time adds nothing').held, at('Visible recovery resumes counting').held);
    } else {
      assert.ok(r.checks.some(c => c.path === 'reps' && c.expected === 6));
      assert.ok(r.checks.some(c => c.label.includes('hidden peak') && c.expected === 4));
    }
  });
}
for (const id of partialMovements) {
  test(`${id}: crops alter only the intended observations`, () => {
    for (const t of [0,.5,1.5,2,3.5]) {
      const full = exercise.frame(id, exercise.cycle(t));
      const head = partial(`partial:${id}:head-cycle`, t);
      const feet = partial(`partial:${id}:feet-cycle`, t);
      for (const side of ['left','right']) for (const [joint, point] of Object.entries(full[side])) {
        assert.deepEqual(head[side][joint], joint === 'ear' ? {...point,y:-.05} : point);
        assert.deepEqual(feet[side][joint], ['ankle','heel','toe'].includes(joint) ? {...point,y:1.05} : point);
      }
      assert.deepEqual(exercise.frame(id, exercise.cycle(t)), full, 'No fixture mutation');
    }
  });
  test(`${id}: hands, far-side loss and complete cropping keep source geometry explicit`, () => {
    const full = exercise.frame(id, 1);
    const hands = partial(`partial:${id}:hands-cycle`, 2), far = partial(`partial:${id}:far-side-cycle`, 2);
    for (const name of ['left','right']) for (const joint of ['shoulder','hip','knee','ankle']) assert.deepEqual(hands[name][joint], full[name][joint]);
    assert.equal(hands.left.wrist, undefined);
    assert.deepEqual(far.left, full.left); assert.deepEqual(far.right, {}); assert.equal(far.cam, 'left');
    const outside = partial(`partial:${id}:offscreen-cycle`, 2);
    for (const name of ['left','right']) for (const [joint,p] of Object.entries(full[name])) {
      assert.equal(outside[name][joint].x, p.x - 2); assert.equal(outside[name][joint].y, p.y);
    }
  });
  test(`${id}: all named inputs resolve through the existing fixture adapter`, () => {
    for (const mode of partialModes) assert.deepEqual(frameFor(`partial:${id}:${mode}`,1), partial(`partial:${id}:${mode}`,1));
  });
}
test('misleading rep fixtures change motion without changing the counting joints', () => {
  const stable = {squat:['hip','knee','ankle','shoulder'], 'leg-raise':['shoulder','hip','ankle']};
  for (const [id,joints] of Object.entries(stable)) for (const side of ['left','right']) {
    const a=partial(`partial:${id}:misleading`,0)[side], b=partial(`partial:${id}:misleading`,2)[side];
    for (const j of joints) assert.deepEqual(a[j],b[j]);
    assert.notDeepEqual(a[id==='squat'?'wrist':'knee'],b[id==='squat'?'wrist':'knee']);
  }
  const a=partial('partial:crunch:misleading',0).left,b=partial('partial:crunch:misleading',1).left;
  assert.notEqual(a.shoulder.y,b.shoulder.y);
  for (const j of Object.keys(a)) {
    assert.equal(a[j].x,b[j].x);
    assert.ok(Math.abs((b[j].y-a[j].y)-.015)<1e-12);
  }
});
test('unknown partial inputs fail, not silently become standing rest', () => {
  for (const key of ['partial:squat:typo','partial:unknown:cycle','partial:plank:cycle:extra','exercise:squat:cycle'])
    assert.throws(()=>partial(key),/Unknown partial/);
  for (const t of [-1,NaN,Infinity]) assert.throws(()=>partial('partial:squat:cycle',t),/time/);
});
test('missing, duplicate, empty or unsafe pack selections fail loudly', () => {
  for (const p of [{...pack,scenarios:[]},{...pack,scenarios:['absent']},{...pack,scenarios:[pack.scenarios[0],pack.scenarios[0]]},
    {...pack,id:'other'},{...pack,limitations:[]},{...pack,scenarios:['../private']}])
    assert.throws(()=>selectPack(p,scenarios,pack.id));
  assert.throws(()=>selectPack(pack,[...scenarios,scenarios[0]],pack.id),/exactly once/);
  assert.throws(()=>selectPack(pack,scenarios,'../private'));
});
test('snapshot exposes actual latest telemetry, without retaining an older good form value', () => {
  const good={score:100},missing={score:null,evidence:{movement:{status:'unavailable'}}};
  assert.equal(snapshot({state:'active'},[{t:'telem',r:good},{t:'telem',r:missing}]).observation,missing);
  assert.equal(snapshot(null,[]).observation,null);
});
test('a counter crediting ankle-hidden motion is detected by the shared scenarios', async () => {
  class HiddenCredit extends engine.SessionCore {
    tick(f,dt,now) {const E=super.tick(f,dt,now);if(f?.left?.ankle?.y>1 && this.ev?.rep)this.ev.rep.reps++;return E;}
  }
  for (const s of scenarios.filter(s=>s.movement!=='plank')) {
    const r=await replay(s,{...engine,SessionCore:HiddenCredit});
    assert.ok(r.checks.some(c=>!c.pass&&c.label.includes('ankle-dependent')));
  }
});
test('a hold crediting ankle-hidden time is detected, not whitelisted', async () => {
  class HiddenHold extends engine.SessionCore {
    tick(f,dt,now) {const E=super.tick(f,dt,now);if(f?.left?.ankle?.y>1 && this.ev)this.ev.hold+=dt;return E;}
  }
  const r=await replay(scenarios.find(s=>s.movement==='plank'),{...engine,SessionCore:HiddenHold});
  assert.ok(r.checks.some(c=>!c.pass&&c.label.includes('Missing ankles')));
});
test('invented reassuring form during observation loss is detected', async () => {
  class InventedForm extends engine.SessionCore {
    tick(f,dt,now) {return super.tick(f,dt,now).map(e=>e.t==='telem'&&e.r.evidence?.movement.status==='unavailable'?{...e,r:{...e.r,score:100}}:e);}
  }
  for(const s of scenarios){const r=await replay(s,{...engine,SessionCore:InventedForm});assert.ok(r.checks.some(c=>!c.pass&&c.path==='observation.score'));}
});
test('unresolved recognition stays visible in JSON, HTML and review even when software checks pass', async () => {
  const dir=await mkdtemp(resolve(tmpdir(),'formcoach-partial-report-'));
  const result={id:'partial-plank/engine',mode:'engine',status:'passed',checks:[{label:'safety baseline',pass:true}],coverageGaps:['Unresolved <ankles>']};
  const run={status:'passed checks; recognition coverage incomplete',started:'synthetic',build:'test',buildHash:'test',limitations:[],results:[result]};
  await report(dir,run);
  assert.deepEqual(findings([result]).map(x=>x.kind),['coverage gap']);
  assert.match(await readFile(resolve(dir,'index.html'),'utf8'),/Unresolved &lt;ankles&gt;/);
  assert.match(await readFile(resolve(dir,'REVIEW.md'),'utf8'),/coverage gap/);
  assert.equal(JSON.parse(await readFile(resolve(dir,'report.json'))).findings[0].detail,'Unresolved <ankles>');
  for(const s of scenarios.filter(s=>['plank','leg-raise'].includes(s.movement)))assert.ok(s.coverageGaps[0].includes('remains open'));
  assert.throws(()=>validate({...scenarios[0],coverageGaps:'not a list'}),/coverage gaps/);
});
