// Independent regressions from the September 14 full-code review.
// Synthetic geometry establishes software policy, not human recognition accuracy.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {engineSource} from './lib.mjs';
import {exerciseInputs} from './exercise-inputs.mjs';
import vm from 'node:vm';
const html = await readFile(process.env.FORM_COACH_TEST_BUILD || new URL('../form-coach-v4.11.html',import.meta.url),'utf8');
const E = await import('data:text/javascript;base64,'+Buffer.from(engineSource(html)+
  '\nexport {Evaluator,CalibrationCore,SessionCore,M,PLANS,TIERS,REF,refPose,buildFrame,coachingFacts,searchLocalPlans};').toString('base64'));
const inputs = exerciseInputs(JSON.parse(await readFile(new URL('../conformance-vectors.json',import.meta.url))).poses);
const env = {speaking:()=>false,portrait:()=>false,hasDemo:()=>true};
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

const clipSource=html.slice(html.indexOf('function clipPlanFor('),html.indexOf('function phrase('));
const clipPlan=vm.runInNewContext(clipSource+'; clipPlanFor',{
  slugTok:t=>String(t).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')
});
const clipVectors=JSON.parse(await readFile(new URL('./clip-resolution-vectors.json',import.meta.url)));
assert.equal(clipVectors.schema,'clip-resolution/1');
const rootVectors=JSON.parse(await readFile(new URL('../conformance-vectors.json',import.meta.url)));
for(const [group,rows] of [['reviewed',clipVectors.cases],['historical',rootVectors.clipResolver]])
  for(const [i,row] of rows.entries())test(`Recorded instruction completeness: ${group}/${row.id || i}`,()=>{
    const got=clipPlan('warm','building',row.key,row.variant,row.vars,row.tmpl,p=>row.manifest.includes(p));
    assert.deepEqual(got===null?null:Array.from(got),row.expect);
  });

test('Oblique Crunch keeps visible rep cycles but has no neck assessment or score samples',()=>{
  const ev = new E.Evaluator(E.M.crunch,'building'); ev.arm(0);
  for(let i=0;i<360;i++){
    const f = inputs.frame('crunch',inputs.cycle(i/30)); f.sideness=35;
    const r = ev.evaluate(f,1/30,(i+1)/30);
    assert.equal(r.score,null); assert.equal(r.evidence.form.status,'unavailable');
    assert.equal(r.cue,null); assert.deepEqual(r.tint?.segs || [],[]);
    assert.ok(r.suppressed.includes('view⊘neck'));
    assert.deepEqual(E.coachingFacts(r,E.M.crunch).keys,[]);
  }
  assert.equal(ev.rep.display(),3); assert.equal(ev.n,0); assert.equal(ev.avg(),null);
  assert.deepEqual(ev.scoreTrace,[]);
  const recovered=ev.evaluate(inputs.frame('crunch'),1/30,13);
  assert.equal(recovered.score,100,'Recovery cannot inherit an unreliable neck reading');
});

for(const view of [0,undefined])test(`Wrong/unavailable camera view cannot score or coach a hold (${view})`,()=>{
  const ev=new E.Evaluator(E.M.plank,'building');ev.arm(0);
  const f=inputs.frame('plank'); f.left.hip.y+=.08;f.right.hip.y+=.08;
  f.sideness=view ?? null; if(view===undefined)f.viewUnavailable=true;
  for(let i=0;i<150;i++){
    const r=ev.evaluate(f,1/30,i/30);
    assert.equal(r.score,null);assert.equal(r.inPose,false);assert.equal(r.observationPaused,true);
    assert.deepEqual(r.tint?.segs || [],[]);assert.deepEqual(E.coachingFacts(r,E.M.plank).keys,[]);
  }
  assert.equal(ev.hold,0);assert.equal(ev.n,0);assert.deepEqual(ev.corrections,{});
});
test('Off-axis depth used as a hold position gate is unavailable, never scored or silently passed',()=>{
  const ev=new E.Evaluator(E.M['downward-dog'],'building');ev.arm(0);
  const f=inputs.frame('downward-dog');f.sideness=38;
  const r=ev.evaluate(f,1/30,1);
  assert.equal(r.score,null);assert.equal(r.inPosition,false);assert.equal(ev.hold,0);
  assert.ok(r.evidence.movement.missing.some(x=>x.target==='hipAngle'&&x.reason==='view'));
  assert.equal(r.viewCue,'turnside');assert.ok(r.suppressed.includes('view⊘hipAngle'));
});

function landmarks(aspect=1){
  const f=inputs.frame('plank'), ids={ear:[7,8],shoulder:[11,12],elbow:[13,14],wrist:[15,16],hip:[23,24],knee:[25,26],ankle:[27,28],foot:[31,32]};
  const lms=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:0}));
  for(const [j,pair] of Object.entries(ids))for(const [s,id] of pair.entries()){
    const p=f[s?'right':'left'][j];if(p)lms[id]={x:p.x/aspect,y:p.y,z:s*.1/aspect,visibility:.95};
  }
  return lms;
}
for(const aspect of [16/9,1,9/16])test(`Camera angle uses matching horizontal/depth units at aspect ${aspect}`,()=>{
  const lms=landmarks(aspect);
  for(const [l,r] of [[11,12],[23,24]])lms[r].x=lms[l].x+.1/aspect;
  near(E.buildFrame(lms,aspect).sideness,45);
});
for(const invalid of ['low','missing','nan','outside'])test(`Unobserved far-side pairs cannot supply view: ${invalid}`,()=>{
  const lms=landmarks();
  for(const id of [12,24]){
    if(invalid==='low')lms[id].visibility=.01;
    if(invalid==='missing')delete lms[id].visibility;
    if(invalid==='nan')lms[id].z=NaN;
    if(invalid==='outside')lms[id].x=1.1;
  }
  const f=E.buildFrame(lms,1);
  assert.equal(f.sideness,null);assert.equal(f.viewUnavailable,true);
  const r=new E.Evaluator(E.M.plank,'building').evaluate(f,1/30,0);
  assert.equal(r.inPosition,false);assert.equal(r.score,null);
  assert.equal(r.viewCue,'trackingLost','Unknown is not evidence to tell someone to turn');
});
test('One trustworthy pair still establishes view; both zero depths are valid front-view evidence',()=>{
  const lms=landmarks();lms[12].visibility=0;
  near(E.buildFrame(lms).sideness,90);
  for(const [l,r] of [[11,12],[23,24]]){lms[l].z=0;lms[r].z=0;lms[r].x=lms[l].x+.1;}
  near(E.buildFrame(lms).sideness,0);
});

for(const fps of [15,30,60])for(const missing of ['body','ankles','view'])test(`Calibration ${missing} gap pauses the attempt at ${fps}fps`,()=>{
  const c=new E.CalibrationCore(env);let time=0;
  const feed=(seconds,f)=>{const fx=[];for(let i=0;i<seconds*fps;i++)fx.push(...c.tick(f,1/fps,time+=1/fps));return fx;};
  feed(7,inputs.frame('plank'));const held=c.ev.hold;assert.ok(held>5);
  let f=null;
  if(missing!=='body'){
    f=inputs.frame('plank');
    if(missing==='view')f.sideness=0;
    else for(const s of ['left','right'])delete f[s].ankle;
  }
  const fx=feed(60,f);assert.equal(c.paused,true);assert.ok(fx.some(e=>e.t==='pauseState'&&e.calibrating));
  feed(26,inputs.frame('plank'));near(c.ev.hold,held);assert.equal(c.done,false);
  const verdict=c.skip().find(e=>e.t==='calibFinish').payload;
  assert.equal(verdict.tierId,'learning');near(verdict.held,held);
});
test('Brief calibration flicker excludes unseen time and a recovered observation resets the gap budget',()=>{
  const c=new E.CalibrationCore(env);let n=0;
  const feed=(seconds,f)=>{for(let i=0;i<seconds*30;i++)c.tick(f,1/30,++n/30);};
  feed(7,inputs.frame('plank'));const held=c.ev.hold;
  for(let i=0;i<3;i++){feed(1,null);feed(.5,inputs.frame('plank'));}
  assert.equal(c.paused,false);near(c.ev.hold,held+1.5);
});

for(const [id,ref] of Object.entries(E.REF))test(`Demonstration ${id} returns continuously along its authored keyframes`,()=>{
  if(ref.frames.length===1){assert.deepEqual(E.refPose(ref,1),ref.frames[0]);return;}
  const turn=6/ref.fps*(ref.frames.length-1),span=turn*2;
  for(const fraction of [.13,.5,.89]){
    const a=E.refPose(ref,turn*fraction),b=E.refPose(ref,span-turn*fraction);
    for(const j of Object.keys(a).filter(j=>Array.isArray(a[j])))for(let k=0;k<2;k++)near(a[j][k],b[j][k]);
  }
  const a=E.refPose(ref,span-1e-6),b=E.refPose(ref,0);
  for(const j of Object.keys(a).filter(j=>Array.isArray(a[j])))for(let k=0;k<2;k++)near(a[j][k],b[j][k]);
});
test('Multiple intermediate keyframes reverse without a segment jump',()=>{
  const ref={fps:6,frames:[{hip:[.2,.2]},{hip:[.4,.4]},{hip:[.8,.8]}]};
  near(E.refPose(ref,2.5).hip[0],.6);near(E.refPose(ref,3.5).hip[0],.3);
});

test('Unsupported authored Strong plans cannot start or silently retier into unsupported exercises',()=>{
  for(const id of ['core-strength','functional','mobility']){
    const p=E.PLANS.find(p=>p.id===id);
    assert.equal(E.searchLocalPlans(p.name,'strong').status,'no-match');
    assert.throws(()=>new E.SessionCore(p,'strong',env),/supported|available/i);
    const c=new E.SessionCore(p,'building',env);c.start();c.retier('strong');
    assert.equal(c.tierId,'building');
  }
});
