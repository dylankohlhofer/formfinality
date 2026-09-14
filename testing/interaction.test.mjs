import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadEngine} from './lib.mjs';
import {exerciseInputs} from './exercise-inputs.mjs';
const html=await readFile(process.env.FORM_COACH_TEST_BUILD || new URL('../form-coach-v4.11.html',import.meta.url),'utf8');
const E=await loadEngine(html);
const command=JSON.parse(await readFile(new URL('./coach-command-vectors.json',import.meta.url)));
for(const [i,c] of command.cases.entries())test(`command ${i}: ${JSON.stringify(c.input)}`,()=>{
  assert.equal(E.parseCoachCommand(c.input,{spoken:c.spoken??false,final:c.final??true}),c.expected);
});
const choice=JSON.parse(await readFile(new URL('./coach-choice-vectors.json',import.meta.url)));
for(const c of choice.cases)test(`choice: ${c.id}`,()=>{
  assert.deepEqual(E.selectCoachChoices({...choice.request,...c.requestPatch},c.selection),c.expected);
});
test('Bound command and model context sizes and reject empty, duplicate and extra option fields',()=>{
  assert.equal(E.parseCoachCommand('coach '+' '.repeat(120)+'pause',{spoken:true}),null);
  for(const patch of [{query:'a'.repeat(501)},{options:[{...choice.request.options[0],text:''}]},
    {options:[choice.request.options[0],choice.request.options[0]]},{options:[{...choice.request.options[0],score:100}]},
    {requestId:null},{defaultIds:['tracking','tracking']},{options:Array(25).fill(choice.request.options[0])}])
    assert.equal(E.validateCoachChoiceRequest({...choice.request,...patch}),false);
});
test('Selection cannot mutate source choices or the caller’s arrays',()=>{
  const q=structuredClone(choice.request), original=structuredClone(q);
  E.selectCoachChoices(q).choiceIds.push('fake');
  const result=E.selectCoachChoices(q,{choiceIds:['demo']}); result.choiceIds.push('fake');
  assert.deepEqual(q,original);
});
const inputs=exerciseInputs(JSON.parse(await readFile(new URL('../conformance-vectors.json',import.meta.url))).poses);
function session(id='squat',steps=[{ex:id,t:100},{ex:id,t:100}]){
  const c=new E.SessionCore({name:'Explanation',steps},'building',{speaking:()=>false,portrait:()=>false,hasDemo:()=>true});
  const cache=new E.CoachEvidence(); cache.update(c,c.start()); return {c,cache};
}
function feed(s,seconds,frame){
  for(let i=0;i<seconds*30;i++){
    const fx=s.c.tick(typeof frame==='function'?frame(i/30):frame,1/30,s.c._now+1/30);
    s.cache.update(s.c,fx);
  }
  return s.cache.explain(s.c);
}
test('Calibration explanations never offer nonexistent Follow along or speak about reps',()=>{
  const c=new E.CalibrationCore({speaking:()=>false,portrait:()=>false,hasDemo:()=>true}),cache=new E.CoachEvidence();
  for(const reason of [null,'tracking','framing']){
    cache.current={at:0,reason,keys:[]};
    const cards=cache.explain(c);assert.match(cards[0].text,/optional plank check/);
    assert.doesNotMatch(cards[0].text,/Follow along|that rep|complete cycle/);
  }
});
test('Unknown hold explanations describe held time rather than an unobserved rep',()=>{
  const s=session('plank'),cards=s.cache.explain(s.c);
  assert.match(cards[0].text,/hold counting/);assert.doesNotMatch(cards[0].text,/that rep|complete cycle/);
});
test('Actual tracking loss is explained without retaining joints or a score',()=>{
  const s=session();feed(s,4,inputs.frame('squat'));
  const cards=feed(s,1,null);assert.equal(cards[0].id,'tracking');
  assert.match(cards[0].text,/not a bad-form score/);
  assert.deepEqual(Object.keys(s.cache.current).sort(),['at','keys','reason']);
  const before=s.c.ev.rep.display();s.cache.explain(s.c);assert.equal(s.c.ev.rep.display(),before);
});
test('A recovered reading does not keep the old tracking explanation',()=>{
  const s=session();feed(s,4,inputs.frame('squat'));feed(s,1,null);
  const cards=feed(s,1,inputs.frame('squat'));assert.notEqual(cards[0].id,'tracking');
});
test('A new same-movement set, a tier change and follow-along cannot inherit rejected work',()=>{
  const s=session();feed(s,4,inputs.frame('squat'));
  const observedFrames=s.c.scoreN;
  s.cache.event={at:s.c._now,reason:'tempo'};assert.equal(s.cache.explain(s.c)[0].id,'tempo');
  s.cache.update(s.c,s.c.skip('user'));assert.equal(s.cache.event,null);
  s.cache.event={at:s.c._now,reason:'range'};s.cache.update(s.c,s.c.retier('strong'));assert.equal(s.cache.event,null);
  s.cache.update(s.c,s.c.followAlong());assert.equal(s.cache.explain(s.c)[0].id,'unassessed');
  assert.equal(s.c.scoreN,observedFrames,'Previously observed frames stay counted once');
});
test('Last reading of a completed set is never attributed to the next set',()=>{
  const s=session('plank',[{ex:'plank',t:5},{ex:'squat',t:100}]);
  for(let i=0;i<300&&s.c.mvId==='plank';i++)feed(s,1/30,inputs.frame('plank'));
  assert.equal(s.c.mvId,'squat');assert.equal(s.cache.current,null);
});
test('Historical rejection expires and successful rep clears it',()=>{
  const s=session();feed(s,4,inputs.frame('squat'));
  s.cache.event={at:s.c._now,reason:'range'};s.c._now+=16;assert.equal(s.cache.explain(s.c)[0].id,'unknown');
  s.cache.event={at:s.c._now,reason:'tempo'};feed(s,4,t=>inputs.frame('squat',inputs.cycle(t)));
  assert.ok(s.c.ev.rep.display()>0);assert.equal(s.cache.event,null);
});
test('Actual short-cycle event survives voice cooldown, without an inferred cause',()=>{
  const s=session();feed(s,4,inputs.frame('squat'));
  // The evaluator→session path supplies the independent event. A short range
  // is represented by 60% of the fixture cycle, not a hand-written score.
  feed(s,12,t=>inputs.frame('squat',inputs.cycle(t)*.45));
  assert.ok(s.c.ev.rep.short>0);assert.equal(s.cache.explain(s.c)[0].id,'range');
  assert.equal(s.c.ev.rep.display(),0);
});
test('Optional missing form cannot be blamed for an observed bridge rep',()=>{
  const s=session('glute-bridge');feed(s,4,inputs.frame('glute-bridge'));
  const cards=feed(s,8,t=>inputs.frame('glute-bridge',inputs.cycle(t)));
  assert.ok(s.c.ev.rep.display()>0);assert.equal(s.c.scoreN,0);
  assert.equal(cards[0].id,'unknown');assert.equal(cards.length,1);
});
test('Guided and rest explanations never invent a rejected rep or form verdict',()=>{
  const s=session('cat-cow');feed(s,4,inputs.frame('cat-cow'));assert.equal(s.cache.explain(s.c)[0].id,'guided');
  const r=session('plank',[{ex:'plank',t:100},{rest:20}]);r.cache.update(r.c,r.c.skip('user'));
  assert.equal(r.cache.explain(r.c)[0].id,'rest');
});
test('Partial unknown movement returns uncertainty, never a diagnosis or ability verdict',()=>{
  const s=session();feed(s,4,inputs.frame('squat'));
  const text=s.cache.explain(s.c).map(c=>c.text).join(' ');
  assert.match(text,/do not have a recent rejected-attempt reason/);
  assert.doesNotMatch(text,/fatigue|overweight|weak|stronger|perfect form/i);
});
