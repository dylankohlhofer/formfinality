// Interface controls must not change the measurement contract. Synthetic input
// tests interruption policy across every supported pair, not human recognition.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {shellSweep} from './shell-sweep.mjs';
import {loadEngine} from './lib.mjs';
import {exerciseInputs} from './exercise-inputs.mjs';
const html = await readFile(process.env.FORM_COACH_TEST_BUILD || new URL('../form-coach-v4.11.html',import.meta.url),'utf8');
const E = await loadEngine(html);
const input = exerciseInputs(JSON.parse(await readFile(new URL('../conformance-vectors.json',import.meta.url))).poses);
const env = {speaking:()=>false,portrait:()=>false,hasDemo:()=>true};
function session(id='plank',tier='building',steps=[{ex:id,t:120},{rest:20},{ex:'plank',t:120}]){
  const c = new E.SessionCore({name:'Interface contract',steps},tier,env);
  c.start(); return c;
}
function feed(c,seconds,frame){
  const fx=[];
  for(let i=0;i<Math.round(seconds*30);i++)fx.push(...c.tick(typeof frame==='function'?frame(i/30):frame,1/30,c._now+1/30));
  return fx;
}
function observed(c){return {hold:c.ev?.hold,reps:c.ev?.rep?.display(),scoreN:c.scoreN,scoreSum:c.scoreSum,i:c.i,rest:c.restLeft,elapsed:c.followElapsed};}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
for(const [id,mv] of Object.entries(E.M))for(const tier of mv.tiers)test(`${id}/${tier}: pause cannot award work; End preserves only observations`,()=>{
  const c=session(id,tier); feed(c,5,input.frame(id)); feed(c,8,t=>input.frame(id,input.cycle(t)));
  const before=observed(c);
  assert.equal(c.pause()[0].t,'reset','Cancel speech first');
  assert.deepEqual(c.pause(),[],'Repeated Pause is idempotent');
  assert.deepEqual(c.skip('key'),[]); assert.deepEqual(c.followAlong(),[]); assert.deepEqual(c.swapToRegression(),[]);
  assert.deepEqual(feed(c,20,t=>input.frame(id,input.cycle(t))),[]);
  assert.deepEqual(observed(c),before);
  c.resume(); assert.deepEqual(c.resume(),[]);
  feed(c,4,t=>input.frame(id,input.cycle(t)));
  const after=observed(c); assert.ok(c.ev.hold>before.hold || (c.ev.rep?.display()||0)>before.reps);
  c.pause(); const p=c.stop().find(e=>e.t==='finish').payload;
  assert.equal(p.stopped,true); assert.equal(p.nothingWrong,false);
  assert.equal(p.out.length,1,'Future work is not pretended skipped or done');
  assert.equal(p.out[0].score,null); assert.equal(p.out[0].stopped,true);
  assert.equal(p.reps,after.reps||0); near(p.bestHold,mv.kind==='reps'?0:after.hold);
  assert.equal(p.avg,after.scoreN?Math.round(after.scoreSum/after.scoreN):null,'Watched frames count once');
  assert.deepEqual(c.stop(),[]); assert.deepEqual(c.resume(),[]); assert.deepEqual(c.pause(),[]);
});
test('Rest pause freezes the countdown; ending rest does not duplicate the preceding phase',()=>{
  const c=session(); feed(c,5,input.frame('plank')); c.skip('user');
  const before=observed(c); c.pause(); feed(c,50,null); assert.deepEqual(observed(c),before);
  c.resume(); feed(c,1,null); near(c.restLeft,before.rest-1);
  const p=c.stop().find(e=>e.t==='finish').payload;
  assert.equal(p.out.length,1); assert.equal(p.out[0].skipped,true);
});
test('Follow-along time freezes and cannot be finished behind the pause dialog',()=>{
  const c=session(); c.followAlong(); feed(c,5,null); c.pause();
  assert.deepEqual(c.finishAlong(),[]); feed(c,50,input.frame('plank')); near(c.followElapsed,5);
  c.resume(); feed(c,2,null); near(c.followElapsed,7);
  const p=c.stop().find(e=>e.t==='finish').payload;
  assert.equal(p.avg,null); assert.equal(p.bestHold,0); assert.equal(p.reps,0); assert.equal(p.out[0].followAlong,true);
});
test('An unfinished squat cannot bridge Pause, but a fresh cycle still counts',()=>{
  const c=session('squat'); feed(c,4,input.frame('squat'));
  feed(c,4,t=>input.frame('squat',input.cycle(t))); assert.equal(c.ev.rep.display(),1);
  feed(c,2,input.frame('squat',1)); c.pause(); feed(c,2,input.frame('squat')); c.resume();
  feed(c,2,input.frame('squat')); assert.equal(c.ev.rep.display(),1);
  feed(c,4,t=>input.frame('squat',input.cycle(t))); assert.equal(c.ev.rep.display(),2);
});
test('Ending a later set retains earlier completed measurements exactly once',()=>{
  const c=session('plank','building',[{ex:'plank',t:5},{rest:8},{ex:'plank',t:120}]);
  feed(c,12,input.frame('plank')); assert.equal(c.out.length,1); assert.equal(c.steps[c.i].rest,8);
  const first=structuredClone(c.out[0]); c.skip('ready'); feed(c,5,input.frame('plank'));
  const sum=c.scoreSum,n=c.scoreN;
  const p=c.stop().find(e=>e.t==='finish').payload;
  assert.deepEqual(p.out[0],first); assert.equal(p.out.length,2); assert.equal(p.out[1].score,null);
  assert.equal(p.avg,Math.round(sum/n)); assert.equal(c.scoreN,n);
});
test('Unstarted and already finished session controls are no-ops',()=>{
  const c=new E.SessionCore({name:'Empty',steps:[]},'building',env);
  for(const method of ['pause','resume','stop','swapToRegression'])assert.deepEqual(c[method](),[]);
  c.start(); assert.equal(c.done,true);
  for(const method of ['pause','resume','stop','swapToRegression'])assert.deepEqual(c[method](),[]);
});
test('Interrupted plank check freezes and keeps its Learning result; no continuous-hold Resume API',()=>{
  const c=new E.CalibrationCore(env); feed(c,7,input.frame('plank'));
  const held=c.ev.hold; assert.ok(held>=4 && held<=7);
  assert.equal(c.pause()[0].t,'reset'); assert.deepEqual(c.pause(),[]);
  assert.deepEqual(feed(c,50,input.frame('plank')),[]); near(c.ev.hold,held);
  assert.equal(typeof c.resume,'undefined');
  const p=c.skip().find(e=>e.t==='calibFinish').payload;
  assert.equal(p.tierId,'learning'); near(p.held,held); assert.deepEqual(c.pause(),[]);
});

// Permanent structural audits alongside the behavioral contracts. These inspect
// literal declarations; browser scenarios cover dynamically rendered controls.
const css=html.match(/<style>([\s\S]*?)<\/style>/)[1];
test('All literal DOM lookups resolve to declared static or template markup',()=>{
  const ids=new Set([...html.matchAll(/\bid="([\w-]+)"/g)].map(m=>m[1]));
  const refs=[...html.matchAll(/(?:\$|getElementById)\("([\w-]+)"\)/g)].map(m=>m[1]);
  assert.deepEqual([...new Set(refs.filter(id=>!ids.has(id)))],[]);
});
test('CSS variables and runtime-toggled literal classes have definitions',()=>{
  const defs=new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(m=>m[1]));
  for(const [,v] of html.matchAll(/var\((--[\w-]+)/g))assert.ok(defs.has(v),v);
  for(const [,c] of html.matchAll(/classList\.(?:add|remove|toggle)\("([\w-]+)"/g))assert.ok(css.includes('.'+c),c);
});
test('Hidden wins over author display and all selection families are styled',()=>{
  assert.match(css,/\[hidden\]\s*\{\s*display:\s*none\s*!important/);
  for(const family of ['#tierSeg button','.chip','.tiercard'])assert.ok(css.includes(family+'[aria-pressed="true"]'),family);
});
test('Every emitted effect has a shell handler and every handler has a source',()=>{
  const emitted=[...new Set([...html.matchAll(/\bt:\s*"([\w]+)"/g)].map(m=>m[1]))].sort();
  const shell=html.slice(html.indexOf('function applyFx'),html.indexOf('class Session {'));
  const handled=[...new Set([...shell.matchAll(/case "(\w+)"/g)].map(m=>m[1]))].sort();
  assert.deepEqual(handled,emitted);
});
test('No duplicate top-level named functions',()=>{
  const names=[...html.matchAll(/^(?:async )?function (\w+)\(/gm)].map(m=>m[1]);
  assert.equal(new Set(names).size,names.length);
});
test('Paint-aligned geometry assertion still rejects a real portrait overlap',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  await mkdir(resolve(root,'test-results'),{recursive:true});
  const dir=await mkdtemp(resolve(root,'test-results/interface-layout-mutation-'));
  const browser=await chromium.launch();
  try{
    // Hold the dial across the controls after layout, reproducing the genuine
    // old overlap. Waiting for a painted frame must not make this pass.
    const mutated=html.replace('</style>','#hud{bottom:150px!important}</style>');
    const [r]=await shellSweep({root,html:mutated,engine:E,browser,dir,only:'follow-along-portrait'});
    assert.equal(r.error,undefined); assert.equal(r.status,'failed');
    assert.equal(r.checks.find(x=>x.label==='Phone tracking warning, counter and fallback choice do not overlap').pass,false);
    assert.equal(r.checks.find(x=>x.label==='Timer, notice and controls do not overlap').pass,false);
    assert.equal(r.checks.find(x=>x.label==='No uncaught browser errors').pass,true);
  }finally{await browser.close();}
});
