// Software robustness, not a simulation or validation of larger bodies/clothing.
// Independent synthetic geometry; no REF poses, inferred BMI, or human uploads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadEngine } from './lib.mjs';
import { exerciseInputs } from './exercise-inputs.mjs';

const html = await readFile(process.env.FORM_COACH_TEST_BUILD || new URL('../form-coach-v4.11.html', import.meta.url), 'utf8');
const E = await loadEngine(html);
const poses = JSON.parse(await readFile(new URL('../conformance-vectors.json', import.meta.url), 'utf8')).poses;
const input = exerciseInputs(poses);
const env = {speaking:()=>false, portrait:()=>false, hasDemo:()=>true};
function run(id, tier = 'building', fps = 30) {
  const ev = new E.Evaluator(E.M[id], tier); ev.arm(0);
  let tick = 0;
  return {ev, feed(seconds, source) {
    const rows = [];
    for(let i = 0; i < Math.round(seconds * fps); i++)
      rows.push(ev.evaluate(typeof source === 'function' ? source(i / fps) : source, 1 / fps, ++tick / fps));
    return rows;
  }};
}
const near = (a,b) => assert.ok(Math.abs(a-b) < 1e-7, `${a} should equal ${b}`);

for(const [id, mv] of Object.entries(E.M)) for(const tier of mv.tiers)
  for(const [scale, mirror] of [[.7, false], [1, true], [1.05, false]]) {
    test(`${id}/${tier}: scale ${scale}, mirror ${mirror} preserves observed movement`, () => {
      const r = run(id, tier);
      const frame = phase => {
        const f = input.frame(id, phase);
        for(const side of ['left','right']) for(const p of Object.values(f[side])) {
          p.x = .5 + (p.x - .5) * scale * (mirror ? -1 : 1);
          p.y = .5 + (p.y - .5) * scale;
        }
        return f;
      };
      r.feed(4, frame(0));
      assert.equal(r.ev.rep?.display() || 0, 0, 'Stationary is never a rep');
      r.feed(12, t => frame(input.cycle(t)));
      if(mv.kind === 'reps') assert.equal(r.ev.rep.display(), 3);
      else near(r.ev.hold, 16);
    });
  }

// Change segment ratios along a straight, horizontal body line. This tests
// proportion tolerance, not a claim that a skeleton represents adipose tissue.
for(const hip of [.38,.48,.58]) for(const knee of [.65,.72]) test(`plank proportions hip ${hip}, knee ${knee}`, () => {
  const f = input.frame('plank');
  for(const s of ['left','right']) {
    const p = f[s];
    p.hip.x = hip; p.knee.x = knee;
    p.hip.y = p.knee.y = p.shoulder.y = p.ankle.y;
  }
  const r = run('plank');
  const rows = r.feed(3, f);
  near(r.ev.hold, 3);
  assert.ok(rows.every(x => x.inPose && x.score === 100));
});

for(const fps of [15,30,60]) for(const [id,joint] of [['squat','knee'],['crunch','knee'],['push-up','wrist'],['leg-raise','ankle'],['plank','ankle']])
  for(const mode of ['missing','low','clipped']) test(`${id}/${fps}fps: ${mode} selected ${joint}, visible other side`, () => {
    const r = run(id, 'building', fps);
    const rows = r.feed(12, t => {
      const f = input.frame(id, input.cycle(t));
      if(mode === 'missing') delete f.left[joint];
      if(mode === 'low') f.left[joint].c = .2;
      if(mode === 'clipped') f.left[joint].x = 1.05;
      return f;
    });
    assert.ok(rows.every(x => x.evidence.camera.selected === 'right'));
    assert.ok(rows.every(x => x.evidence.movement.eligible));
    assert.ok(rows.every(x => !x.tint || x.tint.side === 'right'));
    if(id === 'plank') near(r.ev.hold, 12);
    else assert.equal(r.ev.rep.display(), 3);
  });

test('confidence preference flicker cannot reset a visible squat cycle', () => {
  const r = run('squat');
  const rows = r.feed(12, t => ({...input.frame('squat',input.cycle(t)), cam:Math.round(t*30)%2 ? 'right' : 'left'}));
  assert.equal(r.ev.rep.display(), 3);
  assert.ok(rows.every(x => x.evidence.movement.source === 'left'));
});

test('never choose the higher scoring side to hide an observed fault', () => {
  const f = input.frame('plank');
  // Left hip is visibly off its line; right remains good. Both are readable.
  f.left.hip.y += .2;
  const r = run('plank');
  const rows = r.feed(2, f);
  assert.equal(rows.at(-1).evidence.camera.selected, 'left');
  assert.equal(rows.at(-1).inPose, false);
  near(r.ev.hold, 0);
});

test('two incomplete camera sides cannot be stitched into a movement', () => {
  const f = input.frame('push-up');
  delete f.left.wrist; delete f.right.hip;
  const r = run('push-up');
  const rows = r.feed(4,f);
  assert.equal(r.ev.rep.display(),0);
  assert.ok(rows.every(x => !x.inPosition && x.score === null));
});

test('fallback stays selected on recovery; arm clears set-local preference', () => {
  const r = run('push-up');
  const f = input.frame('push-up'); delete f.left.wrist;
  r.feed(1, f);
  assert.equal(r.ev.cameraSide,'right');
  assert.equal(r.feed(1,input.frame('push-up')).at(-1).evidence.camera.selected,'right');
  r.ev.arm(3);
  assert.equal(r.ev.cameraSide,null);
  assert.equal(r.feed(1,input.frame('push-up')).at(-1).evidence.camera.selected,'left');
});

test('a real source switch breaks a partial squat, preserves completed reps, and recovers', () => {
  const r = run('squat');
  r.feed(4,t=>input.frame('squat',input.cycle(t)));
  r.feed(2,input.frame('squat',1));
  assert.equal(r.ev.rep.display(),1);
  const switched = input.frame('squat',1); delete switched.left.knee;
  r.feed(1/30,switched);
  r.feed(2,input.frame('squat',1)); r.feed(2,input.frame('squat'));
  assert.equal(r.ev.rep.display(),1,'Old partial cannot finish on the new side');
  r.feed(4,t=>input.frame('squat',input.cycle(t)));
  assert.equal(r.ev.rep.display(),2,'One fresh cycle counts once');
});

test('camera score does not shorten a 40-second set or invent an early halfway milestone', () => {
  const c = new E.SessionCore({name:'Camera-score policy',steps:[{ex:'plank',t:40}]},'building',env);
  c.start(); let now = 0;
  const f = input.frame('plank');
  const feed = seconds => {
    const fx = [];
    for(let i=0;i<Math.round(seconds*30);i++) fx.push(...c.tick(f,1/30,now+=1/30));
    return fx;
  };
  feed(10);
  assert.equal(c.state,'active'); assert.ok(c.ev.hold>6 && c.ev.hold<10);
  // Isolated policy input, NOT an inference-accuracy test or fabricated body pose.
  const evaluate = c.ev.evaluate.bind(c.ev);
  c.ev.evaluate = (...args) => ({...evaluate(...args), score:54});
  const fx = feed(8);
  assert.equal(c.target,40); assert.equal(c.state,'active');
  assert.ok(!fx.some(e=>e.t==='say' && ['degrade','half'].includes(e.key)));
  c.ev.evaluate = evaluate;
  feed(30);
  assert.equal(c.done,true);
  assert.equal(c.out[0].target,40);
  assert.equal(c.out[0].early,false);
});

for(const [id,mv] of Object.entries(E.M)) for(const tier of mv.tiers) test(`${id}/${tier}: explicit follow-along never invents measurements`, () => {
  const c = new E.SessionCore({name:'Unassessed contract',steps:[{ex:id,t:10}]},tier,env);
  assert.deepEqual(c.followAlong(),[],'No running step is a no-op');
  assert.deepEqual(c.finishAlong(),[]);
  c.start();
  c.tick(null,.1,.1);
  assert.equal(c.state,'setup','Loss does not silently select fallback');
  const entered = c.followAlong();
  assert.equal(entered[0].t,'reset','Old speech is cancelled before teaching');
  assert.ok(entered.some(e=>e.t==='log' && e.row.event==='follow_along_start'));
  const fx = [];
  for(let i=0;i<600;i++) fx.push(...c.tick(i%2 ? null : input.frame(id,input.cycle(i/30)),1/30,(i+1)/30));
  assert.equal(c.state,'follow-along','Target does not auto-complete unobserved exercise');
  assert.equal(c.ev.rep?.display() || 0,0); near(c.ev.hold,0);
  assert.equal(c.scoreN,0); near(c.followElapsed,20);
  assert.ok(!fx.some(e=>['telem','say','num','repPeak','scoreFill'].includes(e.t)));
  assert.deepEqual(c.followAlong(),[],'Double tap must not restart elapsed time');
  assert.ok(c.retier(tier).filter(e=>e.t==='scoreCol').every(e=>!e.on));
  assert.deepEqual(c.swapToRegression(),[]);
  const finished = c.finishAlong().find(e=>e.t==='finish').payload;
  assert.equal(finished.avg,null); assert.equal(finished.bestHold,0); assert.equal(finished.reps,0);
  assert.equal(finished.nothingWrong,false); assert.deepEqual(finished.insights,[]);
  assert.equal(finished.out[0].followAlong,true); assert.equal(finished.out[0].score,null);
  assert.equal(finished.out[0].achieved,0,'User completion is not a camera count');
  assert.match(finished.headline,/not camera-assessed/);
  assert.deepEqual(c.followAlong(),[]); assert.deepEqual(c.finishAlong(),[]);
});

test('follow-along preserves prior watched frames once, records null verdict, and resets across rest', () => {
  const c = new E.SessionCore({name:'Mixed contract',steps:[{ex:'plank',t:40},{rest:10},{ex:'push-up',t:10}]},'building',env);
  c.start();
  for(let i=0;i<120;i++) c.tick(input.frame('plank'),1/30,(i+1)/30);
  const {scoreSum,scoreN} = c, held = c.ev.hold;
  assert.ok(scoreN>0 && held>0);
  c.followAlong();
  for(let i=0;i<300;i++) c.tick(null,1/30,5+i/30);
  assert.equal(c.scoreSum,scoreSum); assert.equal(c.scoreN,scoreN); near(c.ev.hold,held);
  c.finishAlong();
  assert.equal(c.out[0].score,null); near(c.out[0].achieved,held);
  assert.equal(c.following,false);
  assert.deepEqual(c.followAlong(),[],'A rest is not an unassessed movement');
  assert.deepEqual(c.finishAlong(),[]);
  c.skip('ready');
  assert.equal(c.state,'setup'); assert.equal(c.followElapsed,0);
  assert.equal(c.scoreN,scoreN,'No double accumulation at phase end');
});

test('skipping a follow-along set stays a skip, not completed exercise', () => {
  const c = new E.SessionCore({name:'Skipped fallback',steps:[{ex:'plank',t:40}]},'building',env);
  c.start(); c.followAlong(); c.tick(null,.1,.1);
  const p = c.skip('user').find(e=>e.t==='finish').payload;
  assert.equal(p.out[0].skipped,true); assert.equal(p.out[0].score,null);
  assert.equal(p.avg,null); assert.equal(p.nothingWrong,false);
  assert.match(p.headline,/skipped everything/);
});
