// Local participation policy, not recognition, cloud integration or fitness proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {engineSource} from './lib.mjs';
const html = await readFile(process.env.FORM_COACH_TEST_BUILD || new URL('../form-coach-v4.11.html',import.meta.url),'utf8');
const E = await import('data:text/javascript;base64,'+Buffer.from(engineSource(html)+
  '\nexport {ProfileGoals,PROFILE_KEY,PROFILE_MAX_BYTES,profileCalendar,profileStateValid,profileCompletion,profileEmailDraft,PLANS,SessionCore};').toString('base64'));
const at = Date.parse('2026-09-23T12:00:00.000Z'), day = 86400000;
const uuid = n => `00000000-0000-4000-8000-${n.toString(16).padStart(12,'0')}`;
class Storage {
  data = new Map(); writes = 0; readFails = false; writeFails = false; eraseFails = false;
  getItem(k){ if(this.readFails) throw Error('Read denied'); return this.data.get(k) ?? null; }
  setItem(k,v){ if(this.writeFails) throw Error('Quota full'); this.data.set(k,v); this.writes++; }
  removeItem(k){ if(this.eraseFails) throw Error('Erase denied'); this.data.delete(k); }
}
function store(enabled=true){
  const storage = new Storage(), p = new E.ProfileGoals(storage);
  if(enabled) assert.equal(p.setEnabled(true,at,{timeZone:'Europe/London',target:3}).status,'ready');
  return {p,storage};
}
function payload(kind='observed',planId='first-steps'){
  const core = new E.SessionCore(E.PLANS.find(p=>p.id===planId),'building',{speaking:()=>false,portrait:()=>false,hasDemo:()=>true});
  core.start(); let result;
  for(let i=0;i<100&&!core.done;i++) result = core.skip('not stored').find(e=>e.t==='finish')?.payload || result;
  assert.ok(result);
  if(kind !== 'skipped') result.out = result.out.map(row=>({...row,skipped:false,score:null,achieved:row.kind==='reps'?6:20,
    ...(kind === 'unassessed' ? {followAlong:true} : {})}));
  if(kind === 'ended'){ result.stopped=true; result.out.at(-1).stopped=true; }
  if(kind === 'mixed-skip'){ result.out[0].skipped=true; }
  return result;
}
function save(p,n=1,when=at+1000,kind='observed'){ return p.saveSession(uuid(n),'first-steps',payload(kind),when); }

test('Construction/off does not write, copy history, create a cloud identity or keep a finish',()=>{
  const {p,storage} = store(false); storage.data.set('formcoach.local-coach.v1','untouched');
  assert.equal(save(p).status,'off'); assert.equal(storage.writes,0); assert.equal(p.summary(at),null);
  assert.equal(p.read().data.includeUnassessed,false); assert.equal(p.read().data.timeZone,null);
});
for(const [time,zone,expectedDay,week] of [
  ['2026-09-27T22:59:59.999Z','Europe/London','2026-09-27','2026-09-21'],
  ['2026-09-27T23:00:00.000Z','Europe/London','2026-09-28','2026-09-28'],
  ['2026-03-29T00:30:00.000Z','Europe/London','2026-03-29','2026-03-23'],
  ['2026-03-29T01:30:00.000Z','Europe/London','2026-03-29','2026-03-23'],
  ['2026-10-25T00:30:00.000Z','Europe/London','2026-10-25','2026-10-19'],
  ['2026-10-25T01:30:00.000Z','Europe/London','2026-10-25','2026-10-19'],
  ['2026-01-01T00:30:00.000Z','America/Los_Angeles','2025-12-31','2025-12-29'],
  ['2026-01-04T10:00:00.000Z','Pacific/Kiritimati','2026-01-05','2026-01-05'],
  ['2028-02-29T12:00:00.000Z','UTC','2028-02-29','2028-02-28'],
  ['1970-01-01T00:00:00.000Z','UTC','1970-01-01','1969-12-29']
]) test(`Civil date/week: ${time} in ${zone}`,()=>{
  assert.deepEqual(E.profileCalendar(Date.parse(time),zone),{day:expectedDay,week});
});
test('Day cap retains extra completed routines, deduplicates UUIDs and never saves assessment data',()=>{
  const {p,storage} = store(); assert.equal(save(p).status,'ready');
  const count=storage.writes; assert.equal(save(p).status,'duplicate'); assert.equal(storage.writes,count);
  assert.equal(save(p,2,at+2000).status,'ready'); assert.equal(save(p,3,at+day).status,'ready');
  const s = p.summary(at+day); assert.equal(s.days,2); assert.equal(s.totalDays,2); assert.equal(s.completions,3);
  assert.equal(s.met,false); assert.equal(p.read().data.events[0].basis,'observed');
  assert.deepEqual(Object.keys(p.read().data.events[0]),['sessionId','planId','finishedAt','basis']);
  assert.doesNotMatch(storage.getItem(E.PROFILE_KEY),/score|tierId|joints|not stored|headline/);
});
test('Three different routine-days meet a three-day goal, independent of score',()=>{
  const {p} = store();
  for(let n=0;n<3;n++){ const data=payload(); data.avg=n===0?0:null; data.out.forEach(r=>r.score=n===0?0:null);
    assert.equal(p.saveSession(uuid(n),'first-steps',data,at+n*day).status,'ready'); }
  assert.equal(p.summary(at+2*day).met,true);
});
for(const kind of ['skipped','mixed-skip','ended']) test(`${kind} cannot earn weekly credit or claim completion in an email`,()=>{
  const {p,storage} = store(), writes=storage.writes;
  assert.equal(save(p,1,at+1000,kind).status,'ineligible'); assert.equal(p.summary(at).days,0);
  assert.equal(storage.writes,writes); assert.equal(E.profileEmailDraft(uuid(1),'first-steps',payload(kind),at),null);
});
test('Unassessed completion is separately chosen, permanently labelled and never converted into observation',()=>{
  const {p} = store(); assert.equal(save(p,1,at+1000,'unassessed').status,'ineligible');
  assert.equal(p.update('Sam',3,true,at+2000).status,'ready');
  assert.equal(save(p,2,at+3000,'unassessed').status,'ready');
  assert.equal(p.summary(at+3000).days,1); assert.equal(p.summary(at+3000).unassessed,1);
  assert.equal(p.read().data.events[0].basis,'unassessed');
  p.update('Sam',3,false,at+4000); assert.equal(p.read().data.events[0].basis,'unassessed');
  assert.equal(p.summary(at+4000).days,1);
});
test('Goal edits do not rewrite the current week; pending edits replace each other',()=>{
  const {p} = store(); p.update('Sam',5,false,at+1);
  assert.equal(p.summary(at+1).target,3); assert.deepEqual(p.summary(at+1).next,{week:'2026-09-28',target:5});
  p.update('Sam',2,false,at+2); assert.equal(p.read().data.goals.length,2);
  assert.equal(p.summary(Date.parse('2026-09-27T23:00:00Z')).target,2);
  p.update('Sam',3,false,at+3); assert.equal(p.read().data.goals.length,1);
});
test('Summary consumers cannot mutate a saved future target through a returned reference',()=>{
  const {p}=store(); p.update('Sam',5,false,at+1);
  p.summary(at+1).next.target=7;
  assert.equal(p.summary(at+1).next.target,5);
});
test('Guided routine participation requires the same unassessed choice as manual completion',()=>{
  const {p}=store(), data=payload('observed','mobility');
  assert.ok(data.out.some(row=>row.kind==='guided'));
  assert.equal(p.saveSession(uuid(1),'mobility',data,at+1).status,'ineligible');
  p.update('',3,true,at+2);
  assert.equal(p.saveSession(uuid(2),'mobility',data,at+3).status,'ready');
  assert.equal(p.read().data.events[0].basis,'unassessed');
});
test('Timezone remains fixed after disabling/re-enabling; no backfill or partial unknown-week diagnosis',()=>{
  const {p} = store(); save(p); p.setEnabled(false,at+2000);
  assert.equal(save(p,2,at+3000).status,'off'); assert.equal(p.summary(at).completions,1);
  p.setEnabled(true,at+day,{timeZone:'America/New_York',target:7});
  assert.equal(p.read().data.timeZone,'Europe/London'); assert.equal(p.summary(at+day).target,3);
  assert.equal(save(p,3,at+4000).status,'invalid'); assert.equal(p.summary(at+day).days,1);
});
for(const target of [0,8,1.5,NaN,'3',null]) test(`Invalid target ${String(target)} cannot enable or change a profile`,()=>{
  const {p,storage} = store(false);
  assert.equal(p.setEnabled(true,at,{timeZone:'UTC',target}).status,'invalid'); assert.equal(storage.writes,0);
});
for(const zone of ['',null,{},'Not/AZone']) test(`Invalid timezone ${String(zone)} fails explicitly`,()=>{
  const {p,storage} = store(false);
  assert.equal(p.setEnabled(true,at,{timeZone:zone,target:3}).status,'invalid'); assert.equal(storage.writes,0);
});
test('Settings validate name/type/clock and returned data cannot mutate the store',()=>{
  const {p} = store();
  for(const name of ['x'.repeat(33),'bad\nname',{},null]) assert.equal(p.update(name,3,false,at).status,'invalid');
  assert.equal(p.update('Sam',3,'yes',at).status,'invalid'); assert.equal(p.update('Sam',3,false,at-1).status,'invalid');
  assert.equal(save(p,1,NaN).status,'invalid');
  const data=p.read().data; data.enabled=false; data.goals[0].target=7;
  assert.equal(p.read().data.enabled,true); assert.equal(p.summary(at).target,3);
});
test('Roundtrip uses only the profile key; export/erase preserve unrelated history and diagnostics',()=>{
  const {p,storage} = store(); storage.data.set('unrelated','keep'); save(p);
  const q=new E.ProfileGoals(storage); assert.deepEqual(q.read(),p.read());
  const out=q.export(); out.data.name='changed'; assert.equal(q.read().data.name,'');
  assert.equal(q.erase().status,'ready'); assert.equal(storage.getItem(E.PROFILE_KEY),null);
  assert.equal(storage.getItem('unrelated'),'keep'); assert.equal(q.read().data.enabled,false);
});
for(const mutate of [s=>{s.score=100;},s=>{s.events[0].score=100;},s=>{s.events.push(s.events[0]);},
  s=>{s.goals[0].week='2026-02-31';},s=>{s.timeZone='Mars';},s=>{s.events[0].finishedAt=at-1;},
  s=>{s.goals[0].target=0;},s=>{s.enabledAt=null;},s=>{s.goals.push(s.goals[0]);}])
  test(`Malformed stored data is not overwritten: ${mutate}`,()=>{
    const {p,storage} = store(); save(p); const data=p.read().data; mutate(data);
    const raw=JSON.stringify(data); storage.data.set(E.PROFILE_KEY,raw);
    const q=new E.ProfileGoals(storage); assert.equal(q.read().status,'error');
    assert.equal(q.setEnabled(true,at,{timeZone:'UTC',target:3}).status,'error');
    assert.equal(storage.getItem(E.PROFILE_KEY),raw);
  });
test('Unreadable/oversized data is preserved and locks writes',()=>{
  for(const raw of ['broken',' '.repeat(E.PROFILE_MAX_BYTES+1)]){
    const storage=new Storage(); storage.data.set(E.PROFILE_KEY,raw);
    const p=new E.ProfileGoals(storage); assert.equal(p.read().status,'error'); assert.equal(storage.writes,0);
  }
  const storage=new Storage(); storage.readFails=true; assert.equal(new E.ProfileGoals(storage).read().status,'error');
});
test('Sequential stale-tab writes cannot overwrite a newer profile or consent change',()=>{
  const {p,storage}=store(), q=new E.ProfileGoals(storage); p.setEnabled(false,at+1);
  const raw=storage.getItem(E.PROFILE_KEY);
  assert.equal(save(q,1,at+2).status,'error'); assert.equal(storage.getItem(E.PROFILE_KEY),raw);
});
test('Failed consent revocation/erase immediately stops this window; persistence failure is visible',()=>{
  const {p,storage}=store(); storage.writeFails=true;
  assert.equal(p.setEnabled(false,at+1).status,'error'); assert.equal(p.read().data.enabled,false);
  assert.equal(save(p,1,at+2).status,'off'); assert.match(p.read().message,/old setting may return/);
  storage.eraseFails=true; assert.equal(p.erase().status,'error'); assert.match(p.read().message,/may remain/);
  assert.ok(storage.getItem(E.PROFILE_KEY)); storage.eraseFails=false; assert.equal(p.erase().status,'ready');
});
test('A backwards clock cannot prevent in-memory opt-out',()=>{
  const {p}=store(); assert.equal(p.setEnabled(false,at-1).status,'error'); assert.equal(p.read().data.enabled,false);
});
test('At the record limit no old completion silently rolls off',()=>{
  const {p,storage}=store(); const data=p.read().data;
  data.events=Array.from({length:4000},(_,i)=>({sessionId:uuid(i),planId:'first-steps',finishedAt:at,basis:'observed'}));
  storage.data.set(E.PROFILE_KEY,JSON.stringify(data)); const q=new E.ProfileGoals(storage), raw=storage.getItem(E.PROFILE_KEY);
  assert.equal(q.read().status,'ready'); assert.equal(save(q,4001).status,'full'); assert.equal(storage.getItem(E.PROFILE_KEY),raw);
});
test('Email is an explicit recipient-free draft: no name, score, diagnostics, shared-credit or delivery claim',()=>{
  const data=payload(); data.logs=[{secret:'private'}]; data.avg=100;
  const url=new URL(E.profileEmailDraft(uuid(1),'first-steps',data,at));
  assert.equal(url.protocol,'mailto:'); assert.equal(url.pathname,'');
  assert.deepEqual([...url.searchParams.keys()],['subject','body']);
  assert.match(url.searchParams.get('body'),/not a fitness assessment or a synced Duo streak/);
  assert.doesNotMatch(url.href,/private|100|score|sessionId|@/);
  assert.doesNotMatch(url.searchParams.get('body'),/today|yesterday/i); // Debrief can remain open overnight.
  assert.match(decodeURIComponent(E.profileEmailDraft(uuid(1),'first-steps',payload('unassessed'),at)),/unassessed/);
});
