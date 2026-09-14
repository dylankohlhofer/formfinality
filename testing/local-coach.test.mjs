// Pure planner/storage boundary contracts. No browser LLM or device validation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {engineSource} from './lib.mjs';
const html = await readFile(process.env.FORM_COACH_TEST_BUILD || new URL('../form-coach-v4.11.html',import.meta.url),'utf8');
// Main owns the shared test bridge; this focused suite adds exports in memory only.
const E = await import('data:text/javascript;base64,'+Buffer.from(engineSource(html)+
  '\nexport {PLANS,M,TIERS,SessionCore,LOCAL_COACH_TAGS,LOCAL_COACH_MEMORY_KEYS,LOCAL_COACH_DISCLOSURE,parseLocalPlanRequest,searchLocalPlans,selectLocalPlanCandidates,LocalCoachMemory,buildLocalHistoryEntry};').toString('base64'));
const uuid = n => `00000000-0000-4000-8000-${n.toString(16).padStart(12,'0')}`;
const stamp = 1789387200000;
const key = E.LOCAL_COACH_MEMORY_KEYS[0];
class Storage {
  constructor(){ this.data = new Map(); this.writes = []; this.removals = []; this.readError = null; this.writeError = null; this.removeError = null; }
  getItem(k){ if(this.readError) throw this.readError; return this.data.get(k) ?? null; }
  setItem(k,v){ if(this.writeError) throw this.writeError; this.writes.push([k,v]); this.data.set(k,v); }
  removeItem(k){ if(this.removeError) throw this.removeError; this.removals.push(k); this.data.delete(k); }
}
function session(planId='first-steps',tier='building'){
  const core = new E.SessionCore(E.PLANS.find(p=>p.id===planId),tier,{speaking:()=>false,portrait:()=>false,hasDemo:()=>true});
  core.start(); return core;
}
function allSkipped(planId='first-steps',tier='building'){
  const core=session(planId,tier); let p;
  for(let i=0;i<100&&!core.done;i++)p=core.skip('PRIVATE REASON').find(e=>e.t==='finish')?.payload || p;
  assert.ok(p);return p;
}
function memory(){const storage=new Storage(),m=new E.LocalCoachMemory(storage);return {storage,m};}
function save(m,n=1,plan='first-steps',tier='building'){return m.saveSession(uuid(n),plan,allSkipped(plan,tier),stamp+n);}

test('Authored tags cover exactly existing movement IDs and name conservative support requirements',()=>{
  assert.deepEqual(Object.keys(E.LOCAL_COACH_TAGS).sort(),Object.keys(E.M).sort());
  assert.deepEqual(E.LOCAL_COACH_TAGS['sit-to-stand'],{floor:false,standing:false,quiet:true,equipment:['chair']});
  assert.deepEqual(E.LOCAL_COACH_TAGS['wall-sit'],{floor:false,standing:false,quiet:true,equipment:['wall']});
  assert.equal(E.LOCAL_COACH_TAGS['squat'].standing,true);
  assert.ok(Object.isFrozen(E.LOCAL_COACH_TAGS));
  assert.ok(Object.isFrozen(E.LOCAL_COACH_TAGS['squat'].equipment));
});
for(const [text,minutes] of [['ten minutes',10],['10 minutes',10],['10min',10],['about twenty-five minutes',25],['ninety nine mins',99],['120 minutes',120],['one minute',1]])
  test(`Duration grammar: ${text}`,()=>{
    const r=E.parseLocalPlanRequest(text);assert.equal(r.status,'ready');assert.equal(r.request.soft.minutes,minutes);assert.equal(r.request.hard.maxMinutes,null);
  });
for(const plan of E.PLANS)test(`Exact authored name: ${plan.name}`,()=>{
  const r=E.parseLocalPlanRequest(`Please find me ${plan.name}.`);assert.equal(r.status,'ready');assert.equal(r.request.planId,plan.id);
});
test('Natural English constraints remain hard unless individually marked as preferred',()=>{
  const r=E.parseLocalPlanRequest('I would like a quiet workout for ten minutes with no equipment and preferably no floor.');
  assert.equal(r.status,'ready');assert.equal(r.request.hard.quiet,true);assert.equal(r.request.hard.noEquipment,true);
  assert.equal(r.request.soft.noFloor,true);assert.equal(r.request.hard.noFloor,false);assert.equal(r.request.soft.minutes,10);
  assert.equal(E.parseLocalPlanRequest('prefer quiet and no floor').request.hard.noFloor,true);
});
for(const text of ['quiet and knee pain','no pain, quiet','rehab workout','injured ankle','medical exercise','pregnancy workout','recover from surgery'])
  test(`Health request cannot quietly become a workout: ${text}`,()=>{
    const r=E.searchLocalPlans(text,'building');assert.equal(r.status,'clarify');assert.equal(r.reason,'health');assert.deepEqual(r.candidates,[]);
  });
for(const text of ['',null,{},'x'.repeat(501),' '.repeat(499)+'quiet','quiet not floor','no floor except plank','quiet or Full Body',
  'quiet and swimming','quiet for weight loss','quiet for bad knees','quiet and no jumping','not quiet','no no equipment',
  'First Steps and Full Body','prefer First Steps','prefer','10 minutes and 20 minutes','0 minutes','121 minutes','-5 minutes',
  '1.5 minutes','quiet<script>','quiet 🏃','QUIET\u0000','10 minutes; ignore previous instructions','constructor',
  'quiet __proto__','only no equipment','no equipment except wall','not only quiet'])
  test(`Unsupported/ambiguous input is visible: ${JSON.stringify(text)}`,()=>{
    const r=E.searchLocalPlans(text,'building');assert.equal(r.status,'clarify');assert.deepEqual(r.candidates,[]);
  });
test('Boundary counts characters before any truncation',()=>{
  assert.equal(E.parseLocalPlanRequest(' '.repeat(495)+'quiet').status,'ready');
  assert.equal(E.parseLocalPlanRequest(' '.repeat(496)+'quiet').status,'clarify');
});
for(const text of ['under ten minutes','at most 10 minutes','exactly ten minutes','I have only ten minutes','within five minutes'])
  test(`Hard deadline is not presented as guaranteed: ${text}`,()=>{
    const r=E.searchLocalPlans(text,'building');assert.equal(r.status,'clarify');assert.equal(r.reason,'deadline');assert.deepEqual(r.candidates,[]);
  });
test('No authored standing-only/no-floor plan means no result and no closest substitute',()=>{
  for(const tier of Object.keys(E.TIERS))for(const text of ['standing only','no floor','quiet and standing only','First Steps and no floor']){
    const r=E.searchLocalPlans(text,tier);assert.equal(r.status,'no-match');assert.deepEqual(r.candidates,[]);
  }
});
test('Chair/wall requirements exclude Functional Foundations from no-equipment results',()=>{
  const r=E.searchLocalPlans('no equipment','building');
  assert.deepEqual(r.candidates.map(c=>c.planId),['first-steps','core-strength','full-body','mobility']);
  assert.equal(E.searchLocalPlans('Functional Foundations and no equipment','building').status,'no-match');
  assert.deepEqual(E.searchLocalPlans('Functional Foundations','building').candidates[0].tags.equipment,['chair','wall']);
});
test('Resolved movement support is stricter than authored plan tier labels',()=>{
  const r=E.searchLocalPlans('quiet','strong');
  assert.deepEqual(r.candidates.map(c=>c.planId),['full-body']);
  assert.deepEqual(r.excludedPlanIds,['core-strength','functional','mobility']);
  for(const tier of Object.keys(E.TIERS))for(const c of E.searchLocalPlans('quiet',tier).candidates){
    assert.ok(E.PLANS.find(p=>p.id===c.planId).tiers.includes(tier));
    assert.equal(c.candidateId,c.planId);
    for(const row of c.movements){assert.ok(E.M[row.movementId].tiers.includes(tier));assert.deepEqual(row.tags,E.LOCAL_COACH_TAGS[row.movementId]);}
  }
  assert.equal(E.searchLocalPlans('First Steps','strong').status,'no-match');
  for(const tier of ['__proto__','constructor',null,'expert'])assert.equal(E.searchLocalPlans('quiet',tier).status,'clarify');
});
test('Expanded sets/rests and estimates match independent authored arithmetic',()=>{
  const c=E.searchLocalPlans('Full Body','strong').candidates[0];
  assert.equal(c.movements.length,12);assert.equal(c.steps.filter(x=>x.kind==='rest').length,11);
  assert.equal(c.estimate.restSeconds,130); // 8 intra rests at 11 + 3 at 14.
  assert.equal(c.movements.filter(x=>x.kind==='reps').reduce((n,x)=>n+x.target,0),153);
  assert.deepEqual(c.estimate.workSeconds,[618,1077]); // 3*53 held, plus 153 reps at 3–6s.
  assert.deepEqual(c.estimate.setupSeconds,[240,720]);
  assert.equal(c.estimate.minSeconds,988);assert.equal(c.estimate.maxSeconds,1927);
  assert.equal(c.estimate.guaranteed,false);assert.equal(c.estimate.includesSetup,true);
  assert.match(c.estimate.disclosure,/setup\/teaching/);
});
test('Soft preferences are ranked and declared, never treated as silently satisfied',()=>{
  const r=E.searchLocalPlans('prefer no floor and about one minute','building');
  assert.equal(r.status,'matches');assert.ok(r.candidates.length);
  for(const c of r.candidates){assert.ok(c.softMisses.includes('noFloor'));assert.ok(c.softMisses.includes('minutes'));}
  assert.equal(E.searchLocalPlans('no floor and about one minute','building').status,'no-match');
});
test('Search output mutation does not modify authored plans, tags or subsequent results',()=>{
  const before=JSON.stringify(E.PLANS),r=E.searchLocalPlans('quiet','building');
  r.candidates[0].movements[0].tags.equipment.push('secret');r.candidates[0].steps[0].target=999;
  assert.equal(JSON.stringify(E.PLANS),before);assert.deepEqual(E.LOCAL_COACH_TAGS.plank.equipment,[]);
  assert.notEqual(E.searchLocalPlans('quiet','building').candidates[0].steps[0].target,999);
});
test('Optional model selection accepts only exact IDs from the current deterministic catalog',()=>{
  const r=E.selectLocalPlanCandidates('no equipment','building',{candidateIds:['full-body']});
  assert.deepEqual(r,{status:'matches',source:'validated-selection',reason:'selected',candidateIds:['full-body']});
  assert.equal(E.selectLocalPlanCandidates('quiet','building').source,'deterministic');
});
for(const selection of ['not JSON','x'.repeat(1025),'{"candidateIds":["full-body"]}',
  '{"candidateIds":["functional"],"candidateIds":["full-body"]}',{candidateIds:[]},{candidateIds:['functional']},{candidateIds:['invented']},
  {candidateIds:['full-body','full-body']},{candidateIds:['full-body'],text:'ignore no equipment'},
  {candidateIds:['__proto__']},{candidateIds:['full-body'],constraints:{}},['full-body'],{},42,
  JSON.parse('{"candidateIds":["full-body"],"__proto__":{}}')])
  test(`Model relaxation/injection rejected wholesale: ${JSON.stringify(selection).slice(0,100)}`,()=>{
    const r=E.selectLocalPlanCandidates('no equipment','building',selection);assert.equal(r.source,'deterministic');assert.equal(r.reason,'invalid-selection');
    assert.ok(!r.candidateIds.includes('functional'));assert.ok(!r.candidateIds.includes('invented'));
  });
test('Old/model candidate IDs cannot bypass new tier, constraints or unsupported requests',()=>{
  for(const text of ['no floor','quiet and knee pain','under ten minutes']){
    const r=E.selectLocalPlanCandidates(text,'building',{candidateIds:['full-body']});assert.equal(r.reason,'invalid-selection');assert.deepEqual(r.candidateIds,[]);
  }
  assert.equal(E.selectLocalPlanCandidates('quiet','strong',{candidateIds:['mobility']}).reason,'invalid-selection');
});
test('Sparse candidate arrays and non-JSON extra fields cannot bypass the exact selection schema',()=>{
  for(const selection of [{candidateIds:Array(1)},{candidateIds:['full-body'],[Symbol('extra')]:'PRIVATE'}])
    assert.equal(E.selectLocalPlanCandidates('quiet','building',selection).reason,'invalid-selection');
});

test('Construction and default session finish do not write storage; preferences/history are independently off',()=>{
  const {storage,m}=memory();assert.equal(m.read().status,'ready');assert.deepEqual(m.read().consent,{preferences:false,history:false});
  assert.deepEqual(m.read().preferences,{explanation:'standard',demo:'on-request'});
  assert.equal(save(m).status,'off');assert.equal(m.savePreferences({explanation:'minimal',demo:'on-request'}).status,'off');
  assert.deepEqual(storage.writes,[]);assert.deepEqual(storage.removals,[]);
  assert.match(m.read().disclosure,/not encrypted/);assert.match(m.read().disclosure,/private browsing/);
});
test('Setting an already-disabled preference/consent does not create a store',()=>{
  const {m,storage}=memory();m.setConsent('history',false);m.setConsent('preferences',false);
  assert.deepEqual(storage.writes,[]);assert.equal(storage.getItem(key),null);
});
test('Preference opt-in stores only exact enums and does not authorize history',()=>{
  const {m,storage}=memory();assert.equal(m.setConsent('preferences',true).status,'ready');
  assert.equal(m.savePreferences({explanation:'minimal',demo:'on-request'}).status,'ready');
  const writes=storage.writes.length;assert.equal(save(m).status,'off');assert.equal(storage.writes.length,writes);
  const reload=new E.LocalCoachMemory(storage);assert.equal(storage.writes.length,writes);
  assert.deepEqual(reload.read().preferences,{explanation:'minimal',demo:'on-request'});assert.equal(reload.read().consent.history,false);
});
for(const prefs of [{explanation:'none',demo:'always'},{explanation:'minimal',demo:'never'},
  {explanation:'standard',demo:'always',name:'PRIVATE'},{explanation:'standard'},null,[],
  JSON.parse('{"explanation":"standard","demo":"always","__proto__":{}}')])
  test(`Preference schema rejects unapproved data: ${JSON.stringify(prefs)}`,()=>{
    const {m,storage}=memory();m.setConsent('preferences',true);const before=storage.getItem(key),n=storage.writes.length;
    assert.equal(m.savePreferences(prefs).status,'invalid');assert.equal(storage.getItem(key),before);assert.equal(storage.writes.length,n);
  });
test('History opt-in does not authorize preference saving',()=>{
  const {m,storage}=memory();m.setConsent('history',true);assert.equal(save(m).status,'ready');
  assert.equal(m.savePreferences({explanation:'minimal',demo:'always'}).status,'off');
  assert.equal(m.read().history.length,1);assert.equal(JSON.parse(storage.getItem(key)).consent.preferences,false);
});
test('Preference schema also rejects non-enumerable and symbol extra fields',()=>{
  const {m,storage}=memory();m.setConsent('preferences',true);const n=storage.writes.length;
  const prefs={explanation:'minimal',demo:'always'};Object.defineProperty(prefs,'private',{value:'PRIVATE',enumerable:false});
  assert.equal(m.savePreferences(prefs).status,'invalid');
  assert.equal(m.savePreferences({explanation:'minimal',demo:'always',[Symbol('private')]:'PRIVATE'}).status,'invalid');
  assert.equal(storage.writes.length,n);
});
test('One finished session is saved exactly once, also after reload and UUID case changes',()=>{
  const {m,storage}=memory();m.setConsent('history',true);save(m,10);const n=storage.writes.length;
  assert.equal(save(m,10).status,'duplicate');
  const reload=new E.LocalCoachMemory(storage);
  assert.equal(reload.saveSession(uuid(10).toUpperCase(),'first-steps',allSkipped(),stamp).status,'duplicate');
  assert.equal(storage.writes.length,n);assert.equal(reload.read().history.length,1);
});
test('Disabled history stops new session writes and keeps existing history until explicit erase',()=>{
  const {m,storage}=memory();m.setConsent('history',true);save(m);m.setConsent('history',false);const n=storage.writes.length;
  assert.equal(save(m,2).status,'off');assert.equal(m.read().history.length,1);assert.equal(storage.writes.length,n);
  const reload=new E.LocalCoachMemory(storage);assert.equal(save(reload,2).status,'off');assert.equal(storage.writes.length,n);
});
test('Disabled preferences return defaults and retain independent history consent',()=>{
  const {m,storage}=memory();m.setConsent('preferences',true);m.setConsent('history',true);
  m.savePreferences({explanation:'minimal',demo:'on-request'});m.setConsent('preferences',false);const n=storage.writes.length;
  assert.deepEqual(m.read().preferences,{explanation:'standard',demo:'on-request'});assert.equal(m.read().consent.history,true);
  assert.equal(m.savePreferences({explanation:'minimal',demo:'always'}).status,'off');assert.equal(storage.writes.length,n);
});
test('Real skipped output retains null scores and prior observed counts once, without private payload fields',()=>{
  const p=allSkipped();p.out[0].achieved=12.75;p.out[1].achieved=6;p.out[1].elapsed=500;
  p.out[0].trace=[{joints:'PRIVATE'}];p.out[0].log=[{text:'PRIVATE'}];p.avg=100;p.reps=99999;p.bestHold=99999;
  const before=JSON.stringify(p),r=E.buildLocalHistoryEntry(uuid(1),'first-steps',p,stamp);
  assert.equal(r.status,'ready');assert.equal(r.entry.status,'skipped');assert.equal(r.entry.reps,6);assert.equal(r.entry.heldSeconds,12);
  assert.equal(r.entry.skippedSets,5);assert.equal(r.entry.completedSets,0);
  assert.doesNotMatch(JSON.stringify(r.entry),/PRIVATE|trace|score|name|reason|text|diagnostic|joints|avg|progress/);
  assert.equal(JSON.stringify(p),before);
});
test('Real End while paused, before work, yields ended not completed',()=>{
  const core=session();core.pause();const p=core.stop().find(e=>e.t==='finish').payload;
  const r=E.buildLocalHistoryEntry(uuid(1),'first-steps',p,stamp);assert.equal(r.status,'ready');
  assert.equal(r.entry.status,'ended');assert.equal(r.entry.endedSets,1);assert.equal(r.entry.reps,0);assert.equal(r.entry.heldSeconds,0);
});
test('Real follow-along finish keeps prior camera work; elapsed time cannot inflate held seconds',()=>{
  const core=session();core.ev.hold=7.9;core.followAlong();core.followElapsed=200;core.finishAlong();
  let p;for(let i=0;i<100&&!core.done;i++)p=core.skip('PRIVATE').find(e=>e.t==='finish')?.payload || p;
  const r=E.buildLocalHistoryEntry(uuid(1),'first-steps',p,stamp);
  assert.equal(r.status,'ready');assert.equal(r.entry.heldSeconds,7);assert.equal(r.entry.followAlongSets,1);assert.equal(r.entry.skippedSets,4);
  assert.equal(r.entry.status,'completed-with-skips');
});
test('Guided time is separate from observed held time and never becomes reps',()=>{
  const p=allSkipped('mobility');p.out[0].achieved=30.6;p.out[1].achieved=4.6;p.out[2].achieved=3.6;p.out[3].achieved=8.6;
  const r=E.buildLocalHistoryEntry(uuid(1),'mobility',p,stamp);assert.equal(r.status,'ready');
  assert.equal(r.entry.guidedSeconds,39);assert.equal(r.entry.heldSeconds,8);assert.equal(r.entry.reps,0);assert.equal(r.entry.guidedSets,2);
});
test('Completed, skipped and follow-along statuses remain distinct',()=>{
  const p=allSkipped();for(const row of p.out){delete row.skipped;row.score=null;}
  assert.equal(E.buildLocalHistoryEntry(uuid(1),'first-steps',p,stamp).entry.status,'completed');
  p.out[0].followAlong=true;
  assert.equal(E.buildLocalHistoryEntry(uuid(1),'first-steps',p,stamp).entry.status,'completed-with-follow-along');
  p.out[0].skipped=true;
  assert.equal(E.buildLocalHistoryEntry(uuid(1),'first-steps',p,stamp).entry.status,'completed-with-skips');
});
for(const mutate of [p=>p.out[1].achieved=-1,p=>p.out[1].achieved=NaN,p=>p.out[1].achieved=Infinity,
  p=>p.out[1].achieved=1.5,p=>p.out[0].achieved='12',p=>p.out[0].achieved=100001,
  p=>p.out[0].id='__proto__',p=>p.out[0].id='squat',p=>p.out[0].kind='reps',p=>p.out[0].score=0,
  p=>p.out[0].skipped='true',p=>p.out[0].stopped=true,p=>p.out.push(p.out[0]),p=>p.out.pop(),
  p=>p.out=null,p=>delete p.stopped,p=>p.tierId='constructor'])
  test(`Malformed finish cannot persist: ${mutate}`,()=>{
    const {m,storage}=memory();m.setConsent('history',true);const p=allSkipped(),n=storage.writes.length;mutate(p);
    assert.equal(m.saveSession(uuid(1),'first-steps',p,stamp).status,'invalid');assert.equal(storage.writes.length,n);assert.equal(m.read().history.length,0);
  });
test('Arbitrary session identity, authored-plan replacement and malformed dates cannot enter history',()=>{
  const p=allSkipped();
  for(const id of ['Dylan','session-1','__proto__','joints:123',null])assert.equal(E.buildLocalHistoryEntry(id,'first-steps',p,stamp).status,'invalid');
  for(const plan of ['made-up','__proto__','full-body'])assert.equal(E.buildLocalHistoryEntry(uuid(1),plan,p,stamp).status,'invalid');
  for(const date of [NaN,Infinity,-1,1.5,'today',null,'2026-02-30T12:00:00.000Z','2026-09-14T12:00:00','2026-09-14'])
    assert.equal(E.buildLocalHistoryEntry(uuid(1),'first-steps',p,date).status,'invalid');
});
test('Shell ISO timestamps normalize to validated UTC milliseconds without changing payloads',()=>{
  const {m}=memory();m.setConsent('history',true);
  assert.equal(m.saveSession(uuid(1),'first-steps',allSkipped(),new Date(stamp).toISOString()).status,'ready');
  assert.equal(m.read().history[0].finishedAt,stamp);
});
for(const malformed of ['{','null','[]','{}','x'.repeat(128*1024+1),
  JSON.stringify({schema:'local-coach/2',consent:{preferences:false,history:false},preferences:{explanation:'standard',demo:'always'},history:[]}),
  JSON.stringify({schema:'local-coach/1',consent:{preferences:'false',history:false},preferences:{explanation:'standard',demo:'always'},history:[]})])
  test(`Malformed saved data locks writes without overwrite: ${malformed.slice(0,80)}`,()=>{
    const storage=new Storage();storage.data.set(key,malformed);const m=new E.LocalCoachMemory(storage);
    assert.equal(m.read().status,'error');assert.equal(m.read().reason,'malformed');assert.equal(m.setConsent('history',true).status,'error');
    assert.equal(storage.getItem(key),malformed);assert.deepEqual(storage.writes,[]);
    assert.equal(m.erase().reason,'erased');assert.equal(m.read().status,'ready');assert.equal(storage.getItem(key),null);
  });
for(const mutation of [data=>data.history.push({...data.history[0]}),data=>data.history[0].name='PRIVATE',
  data=>data.history[0].reps=-1,data=>data.history[0].heldSeconds=null,data=>data.history[0].status='improved',
  data=>data.history[0].recordedSets=0,data=>data.history[0].endedSets=2,data=>data.preferences.extra='PRIVATE',
  data=>data.consent.extra=true,data=>data.history=Array(101).fill(data.history[0])])
  test(`Malformed record/envelope rejected after reload: ${mutation}`,()=>{
    const {m,storage}=memory();m.setConsent('history',true);save(m);const data=JSON.parse(storage.getItem(key));mutation(data);
    const raw=JSON.stringify(data);storage.data.set(key,raw);const n=storage.writes.length;
    const reload=new E.LocalCoachMemory(storage);assert.equal(reload.read().status,'error');assert.equal(reload.read().reason,'malformed');
    reload.setConsent('history',true);assert.equal(storage.getItem(key),raw);assert.equal(storage.writes.length,n);
  });
test('Storage unavailable on read fails visibly and never initializes over unknown data',()=>{
  const storage=new Storage();storage.readError=new Error('blocked');const m=new E.LocalCoachMemory(storage);
  assert.equal(m.read().reason,'unavailable');assert.equal(m.setConsent('preferences',true).status,'error');assert.equal(storage.writes.length,0);
  assert.equal(new E.LocalCoachMemory(null).read().status,'error');
});
test('Storage byte limit measures UTF-8 bytes, not JavaScript string length',()=>{
  const storage=new Storage(),raw='é'.repeat(70*1024);assert.ok(raw.length<128*1024);
  storage.data.set(key,raw);const m=new E.LocalCoachMemory(storage);assert.equal(m.read().reason,'malformed');
  assert.match(m.read().message,/oversized/);assert.equal(storage.getItem(key),raw);assert.equal(storage.writes.length,0);
});
test('Quota failure does not commit phantom history and locks subsequent writes',()=>{
  const {m,storage}=memory();m.setConsent('history',true);const before=storage.getItem(key);
  storage.writeError=Object.assign(new Error('full'),{name:'QuotaExceededError'});
  assert.equal(save(m).reason,'quota');assert.equal(storage.getItem(key),before);assert.equal(m.read().history.length,0);
  storage.writeError=null;assert.equal(save(m).status,'error');assert.equal(storage.getItem(key),before);
});
test('A failed consent revocation still opts out in the live object',()=>{
  const {m,storage}=memory();m.setConsent('history',true);storage.writeError=new Error('denied');
  const r=m.setConsent('history',false);assert.equal(r.status,'error');assert.equal(r.consent.history,false);
  assert.match(r.message,/previous setting may remain after reload/);
  const n=storage.writes.length;storage.writeError=null;save(m);assert.equal(storage.writes.length,n);
});
test('History capacity is bounded without eviction losing deduplication IDs',()=>{
  const {m,storage}=memory();m.setConsent('history',true);
  for(let n=1;n<=100;n++)assert.equal(save(m,n).status,'ready');
  const before=storage.getItem(key),n=storage.writes.length;
  assert.equal(save(m,101).status,'full');assert.equal(save(m,1).status,'duplicate');
  assert.equal(storage.getItem(key),before);assert.equal(storage.writes.length,n);assert.equal(m.read().history.length,100);
  assert.ok(Buffer.byteLength(storage.getItem(key),'utf8')<=128*1024);
});
test('Erase removes only feature keys, revokes both consents and prevents later finish writes',()=>{
  const {m,storage}=memory();storage.data.set('formcoach-tier','building');storage.data.set('reference-preference','KEEP');
  m.setConsent('preferences',true);m.setConsent('history',true);save(m);
  const r=m.erase();assert.equal(r.reason,'erased');assert.deepEqual(r.consent,{preferences:false,history:false});assert.deepEqual(r.history,[]);
  assert.deepEqual(storage.removals,E.LOCAL_COACH_MEMORY_KEYS);assert.equal(storage.getItem(key),null);
  assert.equal(storage.getItem('formcoach-tier'),'building');assert.equal(storage.getItem('reference-preference'),'KEEP');
  const n=storage.writes.length;assert.equal(save(m,2).status,'off');assert.equal(storage.writes.length,n);
  assert.deepEqual(new E.LocalCoachMemory(storage).read().consent,{preferences:false,history:false});
});
test('Failed erase reports surviving data, opts out and can be retried explicitly',()=>{
  const {m,storage}=memory();m.setConsent('history',true);save(m);storage.removeError=new Error('denied');
  const r=m.erase();assert.equal(r.reason,'erase-failed');assert.deepEqual(r.consent,{preferences:false,history:false});
  assert.match(r.message,/may remain after reload/);assert.ok(storage.getItem(key));
  storage.removeError=null;assert.equal(m.erase().reason,'erased');assert.equal(storage.getItem(key),null);
});
test('Sequential stale tab writes do not undo revocation or replace saved history',()=>{
  const {m,storage}=memory();m.setConsent('history',true);const second=new E.LocalCoachMemory(storage);
  m.setConsent('history',false);const before=storage.getItem(key);
  assert.equal(save(second).reason,'changed');assert.equal(storage.getItem(key),before);
});
test('Comparable summaries require exact plan and tier and preserve status distinctions',()=>{
  const {m}=memory();m.setConsent('history',true);save(m,1);save(m,2,'first-steps','learning');save(m,3,'mobility');
  const p=session().stop().find(e=>e.t==='finish').payload;m.saveSession(uuid(4),'first-steps',p,stamp);
  const r=m.comparable('first-steps','building');assert.equal(r.count,2);assert.deepEqual(r.byStatus,{skipped:1,ended:1});
  assert.equal(r.entries.length,2);assert.match(r.message,/do not establish fitness, ability or progress/);
  assert.equal(m.comparable('first-steps','strong').status,'invalid');
  r.entries[0].reps=999;r.byStatus.skipped=999;assert.equal(m.read().history[0].reps,0);
});
test('Read snapshots cannot mutate stored consents, preferences or history',()=>{
  const {m}=memory();m.setConsent('history',true);save(m);const r=m.read();r.history[0].reps=999;r.consent.history=false;
  r.preferences.explanation='none';assert.equal(m.read().history[0].reps,0);assert.equal(m.read().consent.history,true);
  assert.equal(m.read().preferences.explanation,'standard');
});
test('Explicit export returns detached allowlisted data without writes and preserves opted-out history',()=>{
  const {m,storage}=memory();m.setConsent('history',true);save(m);m.setConsent('history',false);const n=storage.writes.length;
  const exported=m.export();assert.equal(exported.status,'ready');assert.equal(exported.data.schema,'local-coach/1');
  assert.equal(exported.data.history.length,1);assert.equal(exported.data.consent.history,false);
  assert.doesNotMatch(JSON.stringify(exported.data),/PRIVATE|score|name|joints|diagnostic|text|progress/);
  assert.match(exported.message,/not encrypted/);assert.equal(storage.writes.length,n);
  exported.data.history[0].reps=999;assert.equal(m.read().history[0].reps,0);
});
test('Malformed stored content cannot be laundered into a valid export',()=>{
  const storage=new Storage();storage.data.set(key,'{bad');const m=new E.LocalCoachMemory(storage);
  assert.equal(m.export().status,'error');assert.equal(m.export().data,undefined);assert.equal(storage.getItem(key),'{bad');
});
