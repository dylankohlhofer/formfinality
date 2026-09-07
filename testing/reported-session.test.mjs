// Open product expectations from the 7 September user review. These currently
// expose current application failures, not expected-failure whitelists. Included
// in the default loop so green cannot conceal these findings. No personal recordings.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { loadEngine } from './lib.mjs';
import { exerciseInputs } from './exercise-inputs.mjs';
import { serve } from './browser.mjs';
const root = new URL('../', import.meta.url).pathname;
const html = await readFile(process.env.FORM_COACH_TEST_BUILD || root + 'form-coach-v4.11.html', 'utf8');
const E = await loadEngine(html);
const input = exerciseInputs(JSON.parse(await readFile(root + 'conformance-vectors.json', 'utf8')).poses);

test('FC-LAB-007: easier-movement suggestion withdraws when setup recovers and the set arms', () => {
  const core = new E.SessionCore({name:'Recovery', steps:[{ex:'plank', t:30}]}, 'learning',
    {speaking:()=>false, portrait:()=>false, hasDemo:()=>true});
  core.start();
  // Isolate quality difficulty from changing position. This is a metric-level
  // reproduction, not the user's recovered camera measurements.
  const read = core.ev.read.bind(core.ev); let blocked = true, now = 0, shown = false, hidden = false;
  core.ev.read = (t, frame) => blocked && t.id === 'bodyLine' ? 100 : read(t, frame);
  const frame = input.frame('plank');
  // The later offer is intentional: 5s setup grace + 6s measured difficulty.
  // Keep the original offer -> recover -> auto-dismiss expectation intact.
  for(let i=0;i<450;i++){
    if(i===360) blocked=false;
    now+=1/30;
    for(const e of core.tick(frame,1/30,now)){
      if(e.t==='regressShow') shown=true;
      if(shown && e.t==='regressHide') hidden=true;
    }
  }
  assert.equal(shown,true,'The easier alternative was offered');
  assert.equal(core.state,'active','The user subsequently established the exercise');
  assert.equal(hidden,true,'Recovery must remove the obsolete choice without a click');
});

function count(id, change = f => f, inspect = () => {}){
  const ev = new E.Evaluator(E.M[id],'building');ev.arm(0);
  for(let i=0;i<360;i++) inspect(ev.evaluate(change(input.resolve(`exercise:${id}:cycle`,i/30)),1/30,(i+1)/30));
  return ev.rep.display();
}
test('FC-LAB-009: observed crunch cycles survive loss of the neck-only landmark', () => {
  assert.equal(count('crunch'),3,'Three complete input cycles count in the positive control');
  let last;
  const reps=count('crunch',f=>{for(const s of ['left','right'])f[s].ear.x=1.01;return f;},r=>{last=r;});
  assert.equal(reps,3,'Visible torso/hip cycles count; unavailable neck form is not a rep veto');
  assert.equal(last.score,null,'No remaining observed quality target means unscored, not zero or 100');
  assert.equal(last.cue,null,'Do not issue a neck correction from a hidden ear');
});
test('Partial-view positive control: toe clipping alone does not invalidate leg raises', () => {
  const baseline=count('leg-raise');assert.ok(baseline>0);
  assert.equal(count('leg-raise',f=>{for(const s of ['left','right'])f[s].toe.x=1.01;return f;}),baseline);
});
test('Partial-view negative control: an entirely off-screen movement cannot earn reps', () => {
  assert.equal(count('crunch',f=>{for(const s of ['left','right'])for(const p of Object.values(f[s]))p.x+=2;return f;}),0);
});
test('FC-LAB-008: diagnostic recording can start before the workout on a narrow screen', async () => {
  const server=await serve(root,html);let browser;
  try{
    browser=await chromium.launch();const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.route('**/*',r=>new URL(r.request().url()).origin===server.url?r.continue():r.abort());
    await page.goto(server.url);await page.waitForFunction(()=>!!window.__testLab);
    // Normal clicks, never force or direct DOM events: covered controls are a failure.
    await page.locator('#diagPanel > summary').click({timeout:3000});
    await page.locator('#diagConsent').check({timeout:3000});
    await page.locator('#diagStart').click({timeout:3000});
    await page.waitForFunction(()=>window.__testLab.diagnosticAccess().diagnostics.active);
    await page.locator('#calBtn').click({trial:true,timeout:3000});
  }finally{await browser?.close();await server.close();}
});
