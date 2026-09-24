import test from 'node:test';
import assert from 'node:assert/strict';
import { auditAudio, audioReviewPage } from './audio-review.mjs';
import { findings } from './report.mjs';
import { clickAudioAction, waitForClipCapture, CLIP_CAPTURE_WINDOW } from './audio-sweep.mjs';
import { runInNewContext } from 'node:vm';
test('Audio action clock starts at actual click dispatch, not delayed automation intent',async()=>{
  let now=0;const events=[],element=new EventTarget();
  const page={
    evaluate:async(fn,input)=>runInNewContext(`(${fn.toString()})(input)`,{
      input,document:{querySelector:()=>element},window:{__audioLab:{mark:action=>events.push({action,ms:now})}}}),
    locator:selector=>({click:async()=>{
      assert.equal(selector,'#coachResumeBtn');assert.equal(events.length,0);
      now+=400;element.dispatchEvent(new Event('click'));
      // Application work would start after this independently captured boundary.
      assert.deepEqual(events,[{action:'coach-resume',ms:400}]);
    }})
  };
  await clickAudioAction(page,'coach-resume');
  now+=100;element.dispatchEvent(new Event('click'));
  assert.equal(events.length,1,'A registered action marker fires only once');
});
test('Unknown and inherited audio actions fail before instrumenting a page',async()=>{
  const page={evaluate:()=>{throw Error('Should not instrument');}};
  for(const action of ['unknown','toString','constructor','__proto__'])await assert.rejects(()=>clickAudioAction(page,action),/Unknown audio action/);
});
function captureClock(statusAt) {
  let ms = 0;
  const sleeps = [];
  return { sleeps, page: { evaluate: async () => statusAt(ms) },
    clock: { now: () => ms, sleep: async amount => { sleeps.push(amount); ms += amount; } } };
}
test('number capture retains its four-second baseline when playback already settled', async () => {
  const c = captureClock(ms => ({busy:false, quietMs:ms - 2000}));
  const result = await waitForClipCapture(c.page, c.clock);
  assert.equal(result.reason, 'settled'); assert.equal(result.elapsedMs, 4000);
  assert.deepEqual(c.sleeps, [4000]);
});
test('number capture waits through on-time late playback and a bounded quiet tail', async () => {
  const c = captureClock(ms => ({busy:ms < 4400, quietMs:ms < 4400 ? 0 : ms - 4400}));
  const result = await waitForClipCapture(c.page, c.clock);
  assert.equal(result.reason, 'settled'); assert.equal(result.elapsedMs, 4650);
  assert.equal(result.maximumMs, 7000); assert.equal(result.quietMs, 250);
});
test('inter-segment quiet shorter than the tail cannot end capture early', async () => {
  const c = captureClock(ms => ({busy:ms < 4100 || (ms >= 4250 && ms < 4900),
    quietMs:ms < 4100 ? 0 : ms < 4250 ? ms - 4100 : ms < 4900 ? 0 : ms - 4900}));
  const result = await waitForClipCapture(c.page, c.clock);
  assert.equal(result.reason, 'settled'); assert.equal(result.elapsedMs, 5150);
});
test('stuck playback and endlessly fresh activity cannot extend the hard bound', async () => {
  for (const busy of [true,false]) {
    const c = captureClock(() => ({busy,quietMs:0}));
    const result = await waitForClipCapture(c.page, c.clock);
    assert.equal(result.reason, 'deadline'); assert.equal(result.elapsedMs, 7000);
    assert.equal(c.sleeps.reduce((a,b)=>a+b,0), 7000);
  }
  assert.ok(Object.isFrozen(CLIP_CAPTURE_WINDOW));
});
test('unknown capture status fails instead of certifying completion', async () => {
  for (const status of [null,{}, {busy:false,quietMs:NaN}, {busy:false,quietMs:-1}, {busy:0,quietMs:1000}]) {
    const c = captureClock(() => status);
    await assert.rejects(waitForClipCapture(c.page,c.clock), /Invalid audio capture completion status/);
  }
});
test('a never-resolving browser status read cannot bypass the capture deadline', async () => {
  let ms=0, reads=0, cleared=0;
  const result = await waitForClipCapture({evaluate:()=>{reads++; return new Promise(()=>{});}}, {
    now:()=>ms, sleep:async amount=>{ms+=amount;},
    setTimer:(callback,remaining)=>{
      assert.equal(remaining,3000,'Only the remaining capture budget is available');
      queueMicrotask(()=>{ms+=remaining;callback();}); return 'status-read-timer';
    },
    clearTimer:id=>{assert.equal(id,'status-read-timer');cleared++;}
  });
  assert.equal(reads,1); assert.equal(cleared,1);
  assert.equal(result.reason,'deadline'); assert.equal(result.deadlineStage,'status-read');
  assert.equal(result.elapsedMs,7000); assert.equal(result.status,null);
});
test('status timers are cleaned up on both successful reads and read failures', async () => {
  for (const fail of [false,true]) {
    let ms=0, cleared=0;
    const waiting = waitForClipCapture({evaluate:async()=>{
      if(fail)throw new Error('Page closed during status read');
      return {busy:false,quietMs:1000};
    }}, {
      now:()=>ms,sleep:async amount=>{ms+=amount;},
      setTimer:(_callback,remaining)=>{assert.equal(remaining,3000);return 'pending-timer';},
      clearTimer:id=>{assert.equal(id,'pending-timer');cleared++;}
    });
    if(fail)await assert.rejects(waiting,/Page closed/);
    else assert.equal((await waiting).reason,'settled');
    assert.equal(cleared,1);
  }
});
const state = { phase: 0, movement: 'plank', observation: { pose: 'good', since: 0 } };
const item = { id: 1, key: 'goodhold', text: 'Good.', requestedMs: 0, ttl: 2500, requestedState: state };
const evidence = () => ({ events: [
  { type: 'capture-start', ms: 0, state },
  { type: 'speech-start', ms: 0, item, state },
  { type: 'clip-start', ms: 20, playId: 2, path: 'voice/test.mp3', item, state },
  { type: 'clip-end', ms: 1020, playId: 2, state },
  { type: 'capture-end', ms: 1100, state }
], levels: [{ ms: 100, playId: 2, rms: .1 }], decoded: { seconds: 1.1, rms: .1 }, limitations: [] });
const failures = e => auditAudio(e).checks.filter(c => !c.pass).map(c => c.label);
test('healthy recorded speech passes independent rules', () => assert.deepEqual(failures(evidence()), []));
test('missing recorder cannot pass', () => { const e = evidence(); e.events.shift(); assert.match(failures(e).join(), /Capture/); });
test('truncated recording cannot pass on one audible sample', () => { const e = evidence(); e.decoded.seconds = .4; assert.match(failures(e).join(), /capture interval/); });
test('silent waveform is not a playback pass', () => { const e = evidence(); e.decoded.rms = 0; assert.match(failures(e).join(), /non-silent/); });
test('NaN decoded signal cannot pass', () => { const e = evidence(); e.decoded.rms = NaN; assert.match(failures(e).join(), /non-silent/); });
test('one silent clip cannot hide behind another audible clip', () => { const e = evidence(); e.levels = []; assert.match(failures(e).join(), /measured signal/); });
test('actual overlap is detected from simultaneous signal', () => {
  const e = evidence(); e.levels = [100, 160].flatMap(ms => [2, 3].map(playId => ({ ms, playId, rms: .1 })));
  assert.match(failures(e).join(), /overlapping/);
});
test('sequential clips do not count as overlap', () => {
  const e = evidence(); e.levels = [{ ms: 100, playId: 2, rms: .1 }, { ms: 200, playId: 3, rms: .1 }];
  assert.deepEqual(failures(e), []);
});
test('late speech is detected even if native playback succeeds', () => {
  const e = evidence(); e.events[1].ms = 3000; assert.match(failures(e).join(), /expiry/);
});
test('old-phase teaching is detected', () => {
  const e = evidence(); e.events[1].state = { ...state, phase: 1, movement: 'glute-bridge' };
  assert.match(failures(e).join(), /current exercise/);
});
test('later parts of an already-started sentence cannot escape stale-phase checks', () => {
  const e = evidence(); e.events[2].state = { ...state, phase: 1, movement: 'glute-bridge' };
  assert.match(failures(e).join(), /abandoned exercise/);
});
test('unresolved spoken variable fails', () => {
  const e = evidence(); e.events[1].item = { ...item, text: 'Hold for {t}.' }; assert.match(failures(e).join(), /placeholders/);
});
test('restarted identical speech fails', () => {
  const e = evidence(); e.events.push({ ...e.events[1], ms: 500 }); assert.match(failures(e).join(), /three seconds/);
});
test('repetition across variants remains a review candidate', () => {
  const e = evidence(); for (const ms of [11000, 22000]) e.events.push({ ...e.events[1], ms, item: { ...item, requestedMs: ms, text: `Variant ${ms}` } });
  assert.deepEqual(failures(e), []); assert.equal(auditAudio(e).concerns[0].rule, 'repetition');
});
test('praise during no observations is flagged, not certified semantically', () => {
  const e = evidence(); e.events[1] = { ...e.events[1], ms: 2000, state: { ...state, observation: { pose: 'lost', since: 0 } } };
  assert.equal(auditAudio(e).concerns[0].rule, 'context');
});
test('native TTS is explicitly a waveform coverage gap', () => {
  const e = evidence(); e.events.push({ type: 'tts-request', item, ms: 0, state });
  assert.match(auditAudio(e).gaps[0], /NOT captured/);
});
test('playback errors survive the app swallowing them', () => {
  const e = evidence(); e.events.push({ type: 'clip-error', error: 'decode failed' }); assert.match(failures(e).join(), /playback/);
});
test('a playback watchdog timeout cannot pass on earlier audible speech', () => {
  const e = evidence(); e.events.push({type:'coach-decision',event:'cancelled',reason:'playback timeout',item});
  assert.match(failures(e).join(), /watchdog/);
});
test('a failed recording cannot pass behind earlier audio; unavailable local TTS remains a gap',()=>{
  const e=evidence();e.events.push({type:'coach-decision',event:'failed',reason:'clip loading stalled',item:{...item,clips:['voice/test.mp3']}});
  assert.match(failures(e).join(),/recorded utterance fails/);
  e.events.at(-1).item={...item,clips:null};e.events.at(-1).reason='local voice unavailable';
  assert.deepEqual(failures(e),[]);
});
test('both declared numbers must complete with their own measured signal', () => {
  const e = evidence();
  e.events[2].item = {...item,key:'number',text:'1'}; e.events[3].reason = 'ended';
  const failed = () => auditAudio(e,{numbers:[1,2]}).checks.filter(c=>!c.pass).map(c=>c.label);
  assert.deepEqual(failed(),['Number 2 actually plays to completion with measured signal']);
  // A speech request and a queued/start decision still do not prove sound.
  const second = {...item,key:'number',text:'2'};
  e.events.push({type:'speech-start',ms:300,item:second,state});
  assert.deepEqual(failed(),['Number 2 actually plays to completion with measured signal']);
  e.events.push({type:'clip-start',ms:300,playId:3,item:second,state});
  e.events.push({type:'clip-end',ms:700,playId:3,reason:'ended',state});
  assert.deepEqual(failed(),['Number 2 actually plays to completion with measured signal','Clip 3 contains measured signal']);
  e.levels.push({ms:400,playId:3,rms:.1});
  assert.deepEqual(failed(),[]);
  e.events.find(x=>x.playId===3 && x.type==='clip-end').reason='paused';
  assert.deepEqual(failed(),['Number 2 actually plays to completion with measured signal']);
});
test('a fixed four-second capture truncates an on-time second number, independently of its start TTL', () => {
  const first = {...item, id:1, key:'number', text:'1', ttl:3000};
  const second = {...first, id:2, text:'2'};
  const e = {events:[
    {type:'capture-start',ms:0,state},
    {type:'speech-start',ms:500,item:first,state},
    {type:'clip-start',ms:500,playId:3,item:first,state},
    {type:'clip-end',ms:1400,playId:3,reason:'ended',state},
    {type:'speech-start',ms:1400,item:second,state},
    {type:'clip-start',ms:2700,playId:4,item:second,state},
    // finish() records capture-end then resets the coach, pausing live media.
    {type:'capture-end',ms:4000,state},
    {type:'clip-end',ms:4000,playId:4,reason:'paused',state}
  ],levels:[{ms:600,playId:3,rms:.1},{ms:2800,playId:4,rms:.1}],
  decoded:{seconds:4,rms:.1},limitations:[]};
  const audit = () => auditAudio(e,{numbers:[1,2]});
  assert.deepEqual(audit().checks.filter(c=>!c.pass).map(c=>c.label),
    ['Number 2 actually plays to completion with measured signal']);
  assert.ok(audit().checks.find(c=>c.label.startsWith('Speech never starts'))?.pass);
  // The expected legal end is after the obsolete recording cutoff. Completing
  // it requires more capture time, not a longer production first-start deadline.
  e.events.splice(-2,2,{type:'clip-end',ms:4400,playId:4,reason:'ended',state},
    {type:'capture-end',ms:4700,state});
  e.decoded.seconds=4.7;
  assert.deepEqual(audit().checks.filter(c=>!c.pass),[]);
  assert.equal(second.ttl,3000);
});
test('sound after stop fails', () => {
  const e = evidence(); e.events.push({ type: 'action', action: 'stop', ms: 100, state });
  e.levels.push({ ms: 800, playId: 2, rms: .1 }); assert.match(failures(e).join(), /Stop silences/);
});
test('review renderer escapes speech and marks intended text, not transcription', () => {
  const e = evidence(); e.events[1].item = { ...item, text: '<img src=x onerror=bad()>' };
  const page = audioReviewPage({ id: 'case', description: 'test' }, e, auditAudio(e));
  assert.ok(!page.includes('<img src=x')); assert.match(page, /not an audio transcription/);
});
test('source comparison errors cannot pass behind healthy recorded output',()=>{
  const e=evidence();e.sourceReview={clips:[],errors:[{path:'voice/warm/num/2.mp3',message:'Stale captured clip hash'}]};
  assert.match(failures(e).join(),/source comparison/i);
});
test('source comparison only embeds safe local hash-addressed copies and labels unreviewed pronunciation',()=>{
  const e=evidence(),sha='a'.repeat(64);
  e.sourceReview={sourceMeaning:'Saved after capture, not a transcription.',errors:[],clips:[
    {path:'voice/warm/num/2.mp3',sha256:sha,localPath:`source-clips/${sha}.mp3`,transport:{reason:'Exact served bytes match.'}},
    {path:'<img src=x onerror=bad()>',localPath:'https://example.test/private.mp3',error:'unverified'},
    {path:'unsafe',localPath:'../../private.mp3'}
  ]};
  const html=audioReviewPage({id:'source-control',description:'Source comparison'},e,auditAudio(e));
  assert.ok(html.includes(`src="source-clips/${sha}.mp3"`));
  assert.ok(!html.includes('src="https://example.test'));assert.ok(!html.includes('src="../../private'));
  assert.ok(!html.includes('<img src=x'));assert.match(html,/All pronunciations remain unreviewed/);
  assert.match(html,/audio-transport.json/);
});
test('review concerns and TTS gaps remain visible in main findings', () => {
  const f = findings([{ id: 'audio', checks: [], concerns: [{ detail: 'Repetition', ms: 1 }], audioGaps: ['No waveform'] }]);
  assert.equal(f.length, 2); assert.match(f[0].kind, /human judgement/); assert.equal(f[1].kind, 'coverage gap');
});
