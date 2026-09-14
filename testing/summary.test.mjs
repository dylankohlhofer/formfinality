// Evidence and selection policy, not a claim of model or real-body accuracy.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadEngine} from './lib.mjs';
import {exerciseInputs} from './exercise-inputs.mjs';
const html=await readFile(process.env.FORM_COACH_TEST_BUILD || new URL('../form-coach-v4.11.html',import.meta.url),'utf8');
const E=await loadEngine(html);
const vectors=JSON.parse(await readFile(new URL('./summary-selection-vectors.json',import.meta.url),'utf8'));
const input=exerciseInputs(JSON.parse(await readFile(new URL('../conformance-vectors.json',import.meta.url))).poses);
const env={speaking:()=>false,portrait:()=>false,hasDemo:()=>true};
const phase=(extra={})=>({id:'plank',name:'Plank',kind:'hold',target:30,achieved:30,score:80,log:[],repMs:[],...extra});
function core(steps=[{ex:'plank',t:60}]){
  const c=new E.SessionCore({name:'Summary contract',steps},'building',env);c.start();return c;
}
function feed(c,seconds,frame=input.frame('plank')){
  const fx=[];
  for(let i=0;i<Math.round(seconds*30);i++)fx.push(...c.tick(typeof frame==='function'?frame(i/30):frame,1/30,c._now+1/30));
  return fx;
}
function finishBySkipping(c){
  let p;
  for(let i=0;i<100&&!c.done;i++)p=c.skip('private free-text reason').find(x=>x.t==='finish')?.payload||p;
  assert.ok(p);return p;
}
const noClaims=text=>assert.doesNotMatch(text,/once you tired|that's endurance|setup problem|fitness one|started rushing|were controlled|nothing to fix|real progress|make it harder|form breaking down|perfect shape/i);
test('Shared selection specification cannot silently disappear or duplicate its cases',()=>{
  assert.equal(vectors.schema,1);assert.ok(vectors.cases.length>=22);
  assert.equal(new Set(vectors.cases.map(x=>x.name)).size,vectors.cases.length);
});
for(const row of vectors.cases)test(`Shared selection: ${row.name}`,()=>{
  const before=JSON.stringify(vectors.summary);
  assert.deepEqual(E.selectSummaryCards(vectors.summary,row.selection),row.expected);
  assert.equal(JSON.stringify(vectors.summary),before);
});
for(const at of [0,2,15,22,29,90])test(`Correction logged at ${at}s is not a cause or onset diagnosis`,()=>{
  const i=E.phaseInsight(phase({log:[{key:'sag',at}]}));
  assert.equal(i.kind,'observation');
  assert.equal(i.text,'Recorded coaching flagged hips dropping. This does not tell us why.');
  assert.ok(i.drill);noClaims(i.text);
});
test('Unknown, prototype and invalid-time cue keys cannot create invented form advice',()=>{
  assert.equal(E.phaseInsight(phase({log:[{key:'__proto__',at:2},{key:'injury',at:4},{key:'sag',at:NaN},{key:'sag',at:-1}]})),null);
});
test('Shorter accepted cycles describe actual timing, not rushing or fatigue',()=>{
  const i=E.phaseInsight(phase({kind:'reps',achieved:4,repMs:[6000,6000,4000,4000]}));
  assert.equal(i.kind,'tempo');
  assert.equal(i.text,'The later recorded rep cycles averaged 4.0 seconds, compared with 6.0 seconds earlier. Timing alone does not establish form or fatigue.');
  noClaims(i.text);
});
test('Incomplete, zero, negative and nonfinite durations cannot create a tempo verdict',()=>{
  for(const repMs of [[6000,1000],[6000,6000,0,1],[6000,6000,-1,1],[6000,6000,NaN,1]])
    assert.equal(E.phaseInsight(phase({kind:'reps',repMs})),null);
});
for(const status of [{skipped:true},{followAlong:true},{stopped:true},{kind:'guided'}])test(`${JSON.stringify(status)} cannot acquire assessment highlights`,()=>{
  const out=[phase({...status,log:[{key:'sag',at:22}],repMs:[6000,6000,4000,4000]})];
  assert.deepEqual(E.sessionInsights(out),[]);
  const s=E.buildWorkoutSummary(out,null,!!status.stopped);
  assert.deepEqual(s.cards,[]);assert.deepEqual(s.defaultCardIds,[]);noClaims(s.headline);
});
test('Silent feedback is not proof of perfect form or improvement, even with a non-null score',()=>{
  for(const avg of [0,50,100,null]){
    const c=core();c.out=[phase({score:avg})];c.scoreN=avg===null?0:1;c.scoreSum=avg||0;
    const fx=[];c.finish(fx);const p=fx[0].payload;
    assert.equal(p.nothingWrong,false);assert.equal(p.avg,avg);assert.deepEqual(p.insights,[]);
    noClaims(p.headline);assert.match(p.summary.coverage,/No comparison with previous workouts/);
  }
});
test('All skipped without observation: no score, no highlights, no judgement',()=>{
  const p=finishBySkipping(core());assert.equal(p.avg,null);assert.equal(p.reps,0);assert.equal(p.bestHold,0);
  assert.match(p.headline,/skipped everything/);assert.deepEqual(p.summary.cards,[]);
  assert.equal(p.nothingWrong,false);assert.deepEqual(p.insights,[]);
});
test('Skip after watched work retains observations once without claiming nothing was watched',()=>{
  const c=core();feed(c,7);const n=c.scoreN,sum=c.scoreSum,held=c.ev.hold;
  assert.ok(n>0&&held>0);const p=finishBySkipping(c);
  assert.equal(c.scoreN,n);assert.equal(c.scoreSum,sum);assert.equal(p.avg,Math.round(sum/n));
  assert.equal(p.bestHold,held);assert.equal(p.out[0].score,null);assert.deepEqual(p.summary.cards,[]);
  assert.doesNotMatch(p.headline,/nothing I watched|no score, no judgement/i);
  assert.match(p.headline,/work observed before skipping is retained/);
});
test('Follow-along and End preserve no unobserved credit and expose no private reason',()=>{
  const c=core();c.followAlong();feed(c,12,null);
  const p=c.stop().find(x=>x.t==='finish').payload;
  assert.equal(p.avg,null);assert.equal(p.reps,0);assert.equal(p.bestHold,0);
  assert.deepEqual(p.summary.cards,[]);assert.equal(p.stopped,true);
  assert.match(p.summary.coverage,/follow-along time are not assessed holds/);
});
test('Completed unscored bridge gets measured rep credit without a form verdict',()=>{
  const c=core([{ex:'glute-bridge',t:5}]);
  feed(c,4,input.frame('glute-bridge'));
  const fx=feed(c,40,t=>input.frame('glute-bridge',input.cycle(t)));
  const p=fx.find(x=>x.t==='finish')?.payload;assert.ok(p);
  assert.equal(p.avg,null);assert.equal(p.out[0].score,null);assert.ok(p.reps>=5);
  assert.match(p.headline,/No form score was measured/);
  assert.ok(p.summary.cards.some(x=>x.text===`The camera counted ${p.reps} reps.`));
  noClaims(JSON.stringify(p.summary));
});
test('Completed plank generates engine-authored cards and selection has no mutation authority',()=>{
  const c=core([{ex:'plank',t:5}]);const fx=feed(c,12);
  const p=fx.find(x=>x.t==='finish')?.payload;assert.ok(p);
  const before=JSON.stringify(p),card=p.summary.cards.find(c=>c.kind==='recorded');assert.ok(card);
  assert.match(card.text,/camera recorded .* held time/);
  const result=E.selectSummaryCards(p.summary,{cardIds:[card.id],score:100});
  assert.equal(result.reason,'invalid-selection');assert.equal(JSON.stringify(p),before);
});
test('Real completed Crunch observations describe neck alignment, never pulling or hand contact',()=>{
  const c=core([{ex:'crunch',t:5}]);feed(c,4,input.frame('crunch'));
  const fx=feed(c,40,t=>{
    const f=input.frame('crunch',input.cycle(t));
    // Change only visible ear alignment, not hands, torso/leg driver or scoring.
    for(const side of ['left','right'])f[side].ear={x:f[side].shoulder.x+.04,y:f[side].shoulder.y-.02,c:.95};
    return f;
  });
  const p=fx.find(x=>x.t==='finish')?.payload;assert.ok(p);
  assert.ok(p.out[0].log.some(x=>x.key==='neckpull'),'Actual evaluator generated the correction');
  const card=p.summary.cards.find(x=>x.kind==='observation');assert.ok(card);
  assert.match(card.text,/neck alignment/);assert.doesNotMatch(JSON.stringify(p.summary),/pulling|hand contact/i);
});
for(const id of ['push-up','knee-push-up'])test(`${id}: an actual sag correction points to this movement, not the Plank demo`,()=>{
  const c=core([{ex:id,t:5}]);feed(c,4,input.frame(id));
  const fx=feed(c,45,t=>{
    const f=input.frame(id,input.cycle(t));
    for(const side of ['left','right'])f[side].hip.y+=.1;
    return f;
  });
  const p=fx.find(x=>x.t==='finish')?.payload;assert.ok(p);
  assert.ok(p.out[0].log.some(x=>x.key==='sag'),'Actual evaluator generated the correction');
  const card=p.summary.cards.find(x=>x.kind==='observation');assert.ok(card);
  assert.match(card.tip,/this movement's demonstration/);assert.doesNotMatch(card.tip,/plank/i);
});
test('Privacy contract excludes trace, landmarks, arbitrary skip reasons and unrelated fields',()=>{
  const s=E.buildWorkoutSummary([phase({trace:[{secret:'landmarks'}],reason:'PERSONAL_REASON',userName:'PERSONAL_NAME',
    log:[{key:'sag',at:2,secret:'JOINTS'}]})],80);
  assert.deepEqual(Object.keys(s).sort(),['cards','coverage','defaultCardIds','headline','schema']);
  assert.doesNotMatch(JSON.stringify(s),/PERSONAL_|JOINTS|landmarks|trace|reason|userName/);
});
test('Catalog size is bounded without modifying complete set results',()=>{
  const out=Array.from({length:100},(_,i)=>phase({name:`Plank (set ${i+1}/100)`,log:[{key:'sag',at:2}]}));
  const before=JSON.stringify(out),s=E.buildWorkoutSummary(out,80);
  assert.equal(s.cards.length,24);assert.equal(new Set(s.cards.map(x=>x.id)).size,24);
  assert.ok(s.defaultCardIds.length<=2);assert.equal(JSON.stringify(out),before);
});
test('Empty session and empty catalog retain empty deterministic fallback',()=>{
  const s=E.buildWorkoutSummary([],null);assert.match(s.headline,/No exercise sets were recorded/);
  assert.deepEqual(E.selectSummaryCards(s),{source:'template',reason:'not-requested',cardIds:[]});
  assert.equal(E.selectSummaryCards(s,{cardIds:['set-1-work']}).reason,'invalid-selection');
});
test('Returned card ID arrays do not alias engine defaults or model responses',()=>{
  const summary=structuredClone(vectors.summary),selection={cardIds:['set-1-focus']};
  E.selectSummaryCards(summary).cardIds.push('bad');
  E.selectSummaryCards(summary,selection).cardIds.push('bad');
  assert.deepEqual(summary,vectors.summary);assert.deepEqual(selection,{cardIds:['set-1-focus']});
});
test('Regression oracle rejects deliberate model-authority and diagnostic-causality mutations',async()=>{
  // The general choice selector has the same fallback line. Anchor this mutation
  // to the summary function so a new additive selector cannot steal the target.
  const anchor='function selectSummaryCards(summary, selection=null){';
  const start=html.indexOf(anchor);assert.ok(start>=0);assert.equal(html.indexOf(anchor,start+1),-1);
  const tail=html.slice(start),needle='if(selection === null) return fallback("not-requested");';
  assert.ok(tail.includes(needle),'Summary mutation target must exist');
  const loose=await loadEngine(html.slice(0,start)+tail.replace(needle,
    needle+' if(selection.text) return {source:"on-device",reason:"selected",cardIds:selection.cardIds};'));
  const v=vectors.cases.find(x=>x.name==='extra generated medical claim');
  assert.notDeepEqual(loose.selectSummaryCards(vectors.summary,v.selection),v.expected);
  const causal=await loadEngine(html.replace('This does not tell us why.',"This happened once you tired."));
  assert.throws(()=>noClaims(causal.phaseInsight(phase({log:[{key:'sag',at:22}]})).text));
});
