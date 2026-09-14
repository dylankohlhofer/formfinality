// Fake recognition and time only: no microphone, speech model, transcript log or
// claim about real-world command/echo recognition quality.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {engineSource} from './lib.mjs';

const html = await readFile(process.env.FORM_COACH_TEST_BUILD || new URL('../form-coach-v4.11.html', import.meta.url), 'utf8');
const source = engineSource(html);
const {LocalCommandListener, parseCoachCommand} = await import('data:text/javascript;base64,' +
  Buffer.from(source + '\nexport {LocalCommandListener, parseCoachCommand};').toString('base64'));
const flush = async () => { for(let i = 0; i < 8; i++) await Promise.resolve(); };
function deferred(){
  let resolve, reject;
  const promise = new Promise((yes,no) => { resolve = yes; reject = no; });
  return {promise,resolve,reject};
}
class FakeClock {
  now = 0;
  next = 0;
  jobs = new Map();
  timers = {
    setTimeout: (fn,ms) => { const id = ++this.next; this.jobs.set(id,{at:this.now + ms,fn}); return id; },
    clearTimeout: id => this.jobs.delete(id)
  };
  async advance(ms){
    const end = this.now + ms;
    let n = 0;
    while(true){
      const entry = [...this.jobs].sort((a,b) => a[1].at - b[1].at)[0];
      if(!entry || entry[1].at > end) break;
      assert.ok(++n < 5000, 'Timer loop must be bounded');
      this.now = entry[1].at;
      this.jobs.delete(entry[0]);
      entry[1].fn();
      await flush();
    }
    this.now = end;
    await flush();
  }
}
function fixture(t, options = {}){
  const clock = new FakeClock(), actions = [], statuses = [], instances = [], checks = [];
  const state = {token:'host1:screen1:set0:squat:building:false:false',allowed:true,speaking:false};
  class Recognition {
    static async available(request){
      checks.push(request);
      return options.availability ? options.availability(checks.length) : 'available';
    }
    static install(){ assert.fail('The adapter must never install a language pack'); }
    constructor(){
      this.starts = 0;
      this.aborts = 0;
      if(options.localProperty) options.localProperty(this);
      else this.processLocally = false;
      instances.push(this);
    }
    start(){
      this.starts++;
      assert.equal(this.processLocally, true, 'Every mic request must force verified local processing');
      if(options.startError) throw new Error('private browser failure');
      if(options.autoStart !== false) this.onstart?.();
    }
    abort(){
      this.aborts++;
      if(options.abortError) throw new Error('private abort failure');
      this.onend?.(); // Deliberately synchronous to exercise cleanup ordering.
    }
  }
  const env = {
    getRecognition: () => Recognition, now: () => clock.now, timers: clock.timers,
    context: () => state.token, allowed: () => state.allowed, speaking: () => state.speaking,
    onAction: action => { actions.push(action); options.action?.(action,state); },
    onStatus: status => { statuses.push(status); options.status?.(status,state); }
  };
  if(options.defaultRecognition) delete env.getRecognition;
  const listener = new LocalCommandListener(env);
  t.after(() => { listener.stop(); assert.equal(clock.jobs.size,0,'No timer remains after stop'); });
  return {listener,clock,actions,statuses,instances,checks,state,Recognition,env,
    last: () => statuses.at(-1), recognition: () => instances.at(-1)};
}
function result(text, isFinal = true){
  const value = [{transcript:text}]; value.isFinal = isFinal; return value;
}
function emit(recognition, text, isFinal = true, index = 0){
  const results = []; results[index] = result(text,isFinal);
  recognition.onresult?.({resultIndex:index,results});
}
const saveHandlers = recognition => Object.fromEntries(['onstart','onresult','onend','onerror'].map(k => [k,recognition[k]]));
const staleResults = handlers => handlers.onresult?.({resultIndex:0,results:[result('coach skip')]});

test('Adapter is a standalone contiguous declaration immediately before the interaction marker', () => {
  assert.match(source, /class LocalCommandListener \{[\s\S]*\n\}\n\n\/\* LOCAL COACH INTERACTION/);
  const adapter = source.slice(source.indexOf('class LocalCommandListener'), source.indexOf('/* LOCAL COACH INTERACTION'));
  assert.match(adapter, /parseCoachCommand\(result\[0\]\?\.transcript, \{spoken:true,final:result.isFinal\}\)/);
  assert.doesNotMatch(adapter, /webkit|\.install\s*\(|getUserMedia|fetch\s*\(|console\.|localStorage|sessionStorage|indexedDB/);
});
test('Construction and sync do not opt in, query availability, request a mic or create timers', t => {
  const h = fixture(t); h.listener.sync();
  assert.equal(h.listener.enabled,false); assert.equal(h.instances.length,0);
  assert.equal(h.checks.length,0); assert.equal(h.clock.jobs.size,0);
});
test('Explicit start checks only installed local English and configures recognition before starting', async t => {
  const h = fixture(t); assert.equal(await h.listener.start(),true);
  assert.deepEqual(h.checks,[{langs:['en-US'],processLocally:true}]);
  const r = h.recognition();
  assert.equal(r.starts,1); assert.equal(r.lang,'en-US'); assert.equal(r.continuous,true);
  assert.equal(r.interimResults,true); assert.equal(r.maxAlternatives,1);
  assert.deepEqual(Object.keys(h.last()).sort(),['enabled','listening','message','reason','state']);
  assert.equal(h.last().state,'listening'); assert.equal(h.last().enabled,true); assert.equal(h.last().listening,true);
  assert.equal(h.clock.jobs.size,1);
});
test('Repeated start shares a pending permission request and does not start another mic', async t => {
  const h = fixture(t,{autoStart:false});
  const p = h.listener.start(), p2 = h.listener.start(); await flush();
  assert.equal(p,p2); assert.equal(h.recognition().starts,1); assert.equal(h.last().state,'starting');
  h.recognition().onstart(); assert.equal(await p,true);
  assert.equal(await h.listener.start(),true); assert.equal(h.instances.length,1);
});
for(const value of ['unavailable','downloadable','downloading',true,null,'AVAILABLE'])
  test(`Availability ${String(value)} cannot request a microphone or download`, async t => {
    const h = fixture(t,{availability: () => value});
    assert.equal(await h.listener.start(),false); assert.equal(h.instances.length,0);
    assert.equal(h.last().state,'unavailable'); assert.equal(h.last().enabled,false); assert.equal(h.clock.jobs.size,0);
    await h.clock.advance(20000); assert.equal(h.checks.length,1);
  });
for(const capability of ['missing-constructor','missing-available','throwing-getter','throwing-available','rejected-available'])
  test(`Unsupported capability: ${capability}`, async t => {
    const h = fixture(t);
    if(capability === 'missing-constructor') h.listener.env.getRecognition = () => undefined;
    if(capability === 'missing-available') h.Recognition.available = undefined;
    if(capability === 'throwing-getter') h.listener.env.getRecognition = () => { throw new Error('secret'); };
    if(capability === 'throwing-available') h.Recognition.available = () => { throw new Error('secret'); };
    if(capability === 'rejected-available') h.Recognition.available = () => Promise.reject(new Error('secret'));
    assert.equal(await h.listener.start(),false); assert.equal(h.instances.length,0);
    assert.equal(h.last().state,'unavailable'); assert.doesNotMatch(JSON.stringify(h.statuses),/secret/);
  });
test('The default factory ignores a prefixed browser API', async t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{configurable:true,value:{webkitSpeechRecognition:class { constructor(){ assert.fail('Prefixed fallback'); } }}});
  t.after(() => { if(previous) Object.defineProperty(globalThis,'window',previous); else delete globalThis.window; });
  const h = fixture(t,{defaultRecognition:true}); assert.equal(await h.listener.start(),false);
  assert.equal(h.last().reason,'unsupported');
});
const badProperties = {
  missing: () => {},
  'read-only-false': r => Object.defineProperty(r,'processLocally',{value:false}),
  'read-only-true': r => Object.defineProperty(r,'processLocally',{value:true}),
  'getter-only': r => Object.defineProperty(r,'processLocally',{get:() => false}),
  'ignored-write': r => Object.defineProperty(r,'processLocally',{get:() => false,set:() => {}}),
  'throwing-write': r => Object.defineProperty(r,'processLocally',{get:() => false,set:() => { throw new Error('secret'); }}),
  'throwing-read': r => Object.defineProperty(r,'processLocally',{get:() => { throw new Error('secret'); },set:() => {}}),
  'truthy-non-boolean': r => Object.defineProperty(r,'processLocally',{get:() => 'true',set:() => {}})
};
for(const [name,localProperty] of Object.entries(badProperties))
  test(`Local-only enforcement rejects ${name} without a mic request`, async t => {
    const h = fixture(t,{localProperty}); assert.equal(await h.listener.start(),false);
    assert.equal(h.recognition().starts,0); assert.equal(h.last().reason,'local-only-unverified');
    assert.equal(h.last().enabled,false); assert.doesNotMatch(JSON.stringify(h.statuses),/secret/);
    if(name === 'missing') assert.equal('processLocally' in h.recognition(),false,'Never create a misleading expando');
  });
test('A supported inherited local-only property is accepted', async t => {
  const h = fixture(t,{localProperty:r => Object.defineProperty(Object.getPrototypeOf(r),'processLocally',{writable:true,value:false})});
  assert.equal(await h.listener.start(),true); assert.equal(h.recognition().processLocally,true);
});
test('All spoken parser vectors use the landed parser and final/interim semantics', async t => {
  const vectors = JSON.parse(await readFile(new URL('./coach-command-vectors.json',import.meta.url),'utf8'));
  const h = fixture(t); await h.listener.start();
  let i = 0;
  for(const row of vectors.cases.filter(row => row.spoken)){
    const n = h.actions.length;
    emit(h.recognition(),row.input,row.final ?? true,i++);
    assert.deepEqual(h.actions.slice(n),row.expected ? [row.expected] : [],JSON.stringify(row));
  }
});
test('Interim pause, revisions and repeated final callbacks apply at most once per result index', async t => {
  const h = fixture(t); await h.listener.start(); const r = h.recognition();
  emit(r,'coach pause',false); emit(r,'coach pause',false); emit(r,'coach pause'); emit(r,'coach skip');
  assert.deepEqual(h.actions,['pause']);
  emit(r,'coach skip',false,1); assert.deepEqual(h.actions,['pause']);
  emit(r,'coach skip',true,1); emit(r,'coach skip',true,1); assert.deepEqual(h.actions,['pause','skip']);
});
test('Unknown and negated finals are ignored with a fixed notice and no raw text retained', async t => {
  const h = fixture(t); await h.listener.start();
  for(const [i,text] of ['skip','coach do not stop','coach pause and skip','coach personal private secret','coach, skip'].entries()) emit(h.recognition(),text,true,i);
  assert.deepEqual(h.actions,[]); assert.equal(h.last().reason,'unrecognized');
  assert.doesNotMatch(JSON.stringify(h.listener),/personal private secret/);
  assert.doesNotMatch(JSON.stringify(h.statuses),/personal private secret|do not stop|pause and skip/);
  emit(h.recognition(),'coach skip',true,3); assert.deepEqual(h.actions,[],'A final index stays consumed even if revised');
});
test('Incomplete interim text may become a final command; nonfinal notices are quiet', async t => {
  const h = fixture(t); await h.listener.start(); const n = h.statuses.length;
  emit(h.recognition(),'coach sk',false); assert.equal(h.statuses.length,n);
  emit(h.recognition(),'coach skip'); assert.deepEqual(h.actions,['skip']);
});
test('ResultIndex respects earlier results and only the first alternative is parsed', async t => {
  const h = fixture(t); await h.listener.start();
  const alternatives = result('unknown'); alternatives.push({transcript:'coach skip'});
  h.recognition().onresult({resultIndex:1,results:[result('coach end workout'),alternatives,result('coach repeat')]});
  assert.deepEqual(h.actions,['repeat']);
});
test('Malformed result metadata and pre-start results cannot dispatch', async t => {
  const h = fixture(t,{autoStart:false}), p = h.listener.start(); await flush();
  emit(h.recognition(),'coach skip'); assert.deepEqual(h.actions,[]);
  h.recognition().onstart(); await p;
  for(const resultIndex of [-1,undefined,0.5]) h.recognition().onresult({resultIndex,results:[result('coach skip')]});
  h.recognition().onresult({resultIndex:0,results:[[{transcript:'coach skip'}]]});
  assert.deepEqual(h.actions,[]);
});
test('One action changing phase discards later commands in the same event batch', async t => {
  const h = fixture(t,{action:(_action,state) => { state.token = 'next-set'; }}); await h.listener.start();
  h.recognition().onresult({resultIndex:0,results:[result('coach skip'),result('coach confirm skip')]});
  assert.deepEqual(h.actions,['skip']); assert.ok(h.recognition().aborts > 0);
});
test('One action starting coach speech discards the remaining event batch', async t => {
  const h = fixture(t,{action:(_action,state) => { state.speaking = true; }}); await h.listener.start();
  h.recognition().onresult({resultIndex:0,results:[result('coach repeat'),result('coach skip')]});
  assert.deepEqual(h.actions,['repeat']); assert.equal(h.last().state,'speaking');
});
test('Stop releases input, invalidates every late handler and leaves no off timer', async t => {
  const h = fixture(t); await h.listener.start(); const r = h.recognition(), old = saveHandlers(r);
  h.listener.stop('hidden'); assert.equal(h.last().reason,'hidden'); assert.equal(h.last().enabled,false);
  assert.equal(r.aborts,1); assert.equal(r.onresult,null); assert.equal(h.clock.jobs.size,0);
  staleResults(old); old.onend(); old.onerror({error:'network'}); old.onstart();
  assert.equal(r.aborts,2); assert.deepEqual(h.actions,[]); assert.equal(h.last().reason,'hidden');
  await h.clock.advance(20000); h.listener.sync(); assert.equal(h.instances.length,1);
});
for(const disallow of ['background','recorder','not-running','null-context','invalid-context'])
  test(`${disallow} disables and returning does not auto-start`, async t => {
    const h = fixture(t); await h.listener.start(); const old = saveHandlers(h.recognition());
    if(disallow === 'null-context') h.state.token = null;
    else if(disallow === 'invalid-context') h.state.token = 42;
    else h.state.allowed = false;
    h.listener.sync(); assert.equal(h.listener.enabled,false);
    h.state.allowed = true; h.state.token = 'returned'; h.listener.sync(); await h.clock.advance(20000);
    staleResults(old); assert.deepEqual(h.actions,[]); assert.equal(h.instances.length,1);
    assert.equal(await h.listener.start(),true); assert.equal(h.instances.length,2);
  });
test('Already-disallowed opt-in resolves false without checking capability or requesting input', async t => {
  const h = fixture(t); h.state.allowed = false;
  assert.equal(await h.listener.start(),false); assert.equal(h.checks.length,0); assert.equal(h.instances.length,0);
});
test('Callbacks check current allowed state even before the shell calls sync', async t => {
  const h = fixture(t); await h.listener.start(); h.state.allowed = false;
  emit(h.recognition(),'coach skip'); assert.deepEqual(h.actions,[]); assert.equal(h.listener.enabled,false);
});
for(const boundary of ['host2:screen1:set0','host1:screen2:set0','host1:screen1:set1'])
  test(`Late speech cannot cross context ${boundary}`, async t => {
    const h = fixture(t); await h.listener.start(); const r = h.recognition(), old = saveHandlers(r);
    h.state.token = boundary;
    staleResults(old); assert.deepEqual(h.actions,[]); assert.equal(r.aborts,1);
    old.onend(); old.onerror({error:'network'}); old.onstart();
    await h.clock.advance(800); assert.equal(h.instances.length,2);
    emit(h.recognition(),'coach skip'); assert.deepEqual(h.actions,['skip']);
  });
test('An ABA context return cannot revive an invalidated recognition session', async t => {
  const h = fixture(t); await h.listener.start(); const old = saveHandlers(h.recognition()), token = h.state.token;
  h.state.token = 'other'; h.listener.sync(); h.state.token = token; h.listener.sync();
  await h.clock.advance(800); staleResults(old); old.onend(); old.onerror({error:'not-allowed'});
  assert.deepEqual(h.actions,[]); assert.equal(h.listener.enabled,true);
});
test('Delayed availability from a stopped opt-in cannot open a mic or disable a newer opt-in', async t => {
  const wait = deferred(), h = fixture(t,{availability:n => n === 1 ? wait.promise : 'available'});
  const first = h.listener.start(); h.listener.stop(); assert.equal(await first,false);
  assert.equal(await h.listener.start(),true); wait.resolve('available'); await flush();
  assert.equal(h.instances.length,1); assert.equal(h.last().state,'listening');
});
test('Delayed availability rejection from an old phase cannot disable current input', async t => {
  const wait = deferred(), h = fixture(t,{availability:n => n === 1 ? wait.promise : 'available'});
  const first = h.listener.start(); h.state.token = 'new-phase'; h.listener.sync();
  await h.clock.advance(800); assert.equal(await first,true); wait.reject(new Error('old phase')); await flush();
  assert.equal(h.instances.length,1); assert.equal(h.last().state,'listening');
});
test('Delayed successful availability is rejected on phase change before any old mic start', async t => {
  const wait = deferred(), h = fixture(t,{availability:n => n === 1 ? wait.promise : 'available'});
  const first = h.listener.start(); h.state.token = 'next-step'; wait.resolve('available'); await flush();
  assert.equal(h.instances.length,0); await h.clock.advance(800); assert.equal(await first,true);
  assert.equal(h.checks.length,2); assert.equal(h.instances.length,1);
});
test('Late permission start after stop is aborted again and cannot change status', async t => {
  const h = fixture(t,{autoStart:false}), p = h.listener.start(); await flush(); const r = h.recognition();
  h.listener.stop('hidden'); assert.equal(await p,false); assert.equal(r.aborts,1);
  r.onstart(); assert.equal(r.aborts,2); assert.equal(h.last().reason,'hidden'); assert.equal(h.clock.jobs.size,0);
});
test('Permission resolving in a new phase aborts the old session before it can act', async t => {
  const h = fixture(t,{autoStart:false}), p = h.listener.start(); await flush(); const old = h.recognition();
  h.state.token = 'next'; old.onstart(); assert.ok(old.aborts >= 1); emit(old,'coach skip');
  await h.clock.advance(800); h.recognition().onstart(); assert.equal(await p,true); assert.deepEqual(h.actions,[]);
});
test('The first opt-in waits out coach speech and 750ms continuous quiet before any mic request', async t => {
  const h = fixture(t); h.state.speaking = true; const p = h.listener.start();
  assert.equal(h.last().state,'speaking'); assert.match(h.last().message,/unavailable while the coach is speaking/);
  await h.clock.advance(12000); assert.equal(h.checks.length,0); assert.equal(h.instances.length,0);
  h.state.speaking = false; h.listener.sync(); await h.clock.advance(749); assert.equal(h.instances.length,0);
  await h.clock.advance(51); assert.equal(await p,true); assert.equal(h.instances.length,1);
});
test('Coach speech aborts recognition, rejects its echo and restarts only after 750ms quiet', async t => {
  const h = fixture(t); await h.listener.start(); const r = h.recognition(), old = saveHandlers(r);
  h.state.speaking = true; h.listener.sync(); assert.equal(r.aborts,1);
  staleResults(old); assert.deepEqual(h.actions,[]); assert.equal(h.last().listening,false);
  await h.clock.advance(1000); assert.equal(h.instances.length,1);
  h.state.speaking = false; h.listener.sync(); await h.clock.advance(749); assert.equal(h.instances.length,1);
  await h.clock.advance(51); assert.equal(h.instances.length,2); staleResults(old); assert.deepEqual(h.actions,[]);
  emit(h.recognition(),'coach pause'); assert.deepEqual(h.actions,['pause']);
});
test('A new coach utterance resets the entire quiet interval', async t => {
  const h = fixture(t); await h.listener.start(); h.state.speaking = true; h.listener.sync();
  h.state.speaking = false; h.listener.sync(); await h.clock.advance(700);
  h.state.speaking = true; h.listener.sync(); await h.clock.advance(100);
  h.state.speaking = false; h.listener.sync(); await h.clock.advance(749); assert.equal(h.instances.length,1);
  await h.clock.advance(51); assert.equal(h.instances.length,2);
});
test('A result racing coach-start suppresses itself even without shell sync', async t => {
  const h = fixture(t); await h.listener.start(); h.state.speaking = true;
  emit(h.recognition(),'coach pause'); assert.deepEqual(h.actions,[]); assert.equal(h.last().state,'speaking');
});
test('Coach speech beginning during availability invalidates that pending request', async t => {
  const wait = deferred(), h = fixture(t,{availability:n => n === 1 ? wait.promise : 'available'});
  const p = h.listener.start(); h.state.speaking = true; wait.resolve('available'); await flush();
  assert.equal(h.instances.length,0); assert.equal(h.last().state,'speaking');
  h.state.speaking = false; h.listener.sync(); await h.clock.advance(800); assert.equal(await p,true); assert.equal(h.checks.length,2);
});
test('Availability has a ten-second deadline, and a late success cannot start input', async t => {
  const wait = deferred(), h = fixture(t,{availability:() => wait.promise}), p = h.listener.start();
  await h.clock.advance(9999); assert.equal(h.listener.enabled,true);
  await h.clock.advance(1); assert.equal(await p,false); assert.equal(h.last().reason,'start-timeout');
  wait.resolve('available'); await flush(); assert.equal(h.instances.length,0); assert.equal(h.clock.jobs.size,0);
});
test('A pending permission start has a ten-second deadline and late approval aborts', async t => {
  const h = fixture(t,{autoStart:false}), p = h.listener.start(); await flush(); const r = h.recognition();
  await h.clock.advance(9999); assert.equal(h.listener.enabled,true);
  await h.clock.advance(1); assert.equal(await p,false); assert.equal(h.last().reason,'start-timeout');
  r.onstart(); assert.equal(r.aborts,2); assert.equal(h.clock.jobs.size,0);
});
test('Deadline checks also reject start events before a throttled polling timer runs', async t => {
  const h = fixture(t,{autoStart:false}), p = h.listener.start(); await flush();
  h.clock.now = 10001; h.recognition().onstart();
  assert.equal(await p,false); assert.equal(h.last().reason,'start-timeout');
});
for(const error of ['not-allowed','service-not-allowed','audio-capture','language-not-supported','network','aborted','unknown-private-error'])
  test(`Recognition error ${error} disables clearly with no fallback or retry`, async t => {
    const h = fixture(t); await h.listener.start(); const r = h.recognition(), old = saveHandlers(r);
    r.onerror({error,message:'private raw speech'});
    assert.equal(h.listener.enabled,false); assert.equal(h.last().listening,false);
    assert.doesNotMatch(JSON.stringify(h.statuses),/private raw speech|unknown-private-error/);
    old.onend(); await h.clock.advance(20000); assert.equal(h.instances.length,1); assert.equal(h.clock.jobs.size,0);
  });
test('Synchronous start failure resolves false and reports failure', async t => {
  const h = fixture(t,{startError:true}); assert.equal(await h.listener.start(),false);
  assert.equal(h.last().reason,'start-failed'); assert.equal(h.recognition().aborts,1); assert.equal(h.clock.jobs.size,0);
});
test('Abort failure is visible and disables retries', async t => {
  const h = fixture(t,{abortError:true}); await h.listener.start(); h.state.speaking = true; h.listener.sync();
  assert.equal(h.listener.enabled,false); assert.equal(h.last().reason,'abort-failed');
  assert.match(h.last().message,/Close this page/); assert.equal(h.clock.jobs.size,0);
});
test('A failed release remains visible after repeated stops and cannot open another microphone', async t => {
  const h = fixture(t,{abortError:true}); await h.listener.start(); h.listener.stop('user disabled');
  h.listener.stop('pagehide'); h.listener.stop();
  assert.equal(h.last().reason,'abort-failed'); assert.equal(h.last().state,'error');
  assert.equal(await h.listener.start(),false); assert.equal(h.instances.length,1);
  assert.equal(h.last().reason,'abort-failed'); assert.equal(h.clock.jobs.size,0);
});
for(const kind of ['no-speech','end'])
  test(`${kind} has a bounded backoff budget and never double-retries on late end`, async t => {
    const h = fixture(t); await h.listener.start();
    for(const [n,delay] of [500,1000,2000].entries()){
      const r = h.recognition(), old = saveHandlers(r);
      if(kind === 'end') r.onend(); else r.onerror({error:'no-speech'});
      old.onend(); old.onerror({error:'no-speech'});
      assert.equal(h.last().state,'retrying');
      await h.clock.advance(delay - 1); assert.equal(h.instances.length,n + 1);
      await h.clock.advance(1); assert.equal(h.instances.length,n + 2);
    }
    if(kind === 'end') h.recognition().onend(); else h.recognition().onerror({error:'no-speech'});
    assert.equal(h.last().reason,'restart-limit'); assert.equal(h.listener.enabled,false);
    await h.clock.advance(20000); assert.equal(h.instances.length,4); assert.equal(h.clock.jobs.size,0);
    assert.equal(await h.listener.start(),true); assert.equal(h.instances.length,5);
  });
test('Automatic restarts recheck local support and never fall back if a pack disappears', async t => {
  const h = fixture(t,{availability:n => n === 1 ? 'available' : 'downloadable'}); await h.listener.start();
  h.recognition().onend(); await h.clock.advance(500);
  assert.equal(h.instances.length,1); assert.equal(h.listener.enabled,false); assert.equal(h.last().reason,'language-unavailable');
});
test('Result index zero in a fresh recognition session is independent of the previous session', async t => {
  const h = fixture(t); await h.listener.start(); emit(h.recognition(),'coach repeat');
  h.recognition().onend(); await h.clock.advance(500); emit(h.recognition(),'coach repeat');
  assert.deepEqual(h.actions,['repeat','repeat']);
});
test('A long continuous session retains constant duplicate-tracking memory and rejects old indices', async t => {
  const h = fixture(t); await h.listener.start(); const r = h.recognition();
  emit(r,'coach pause',false,0);
  const before = JSON.stringify(h.listener).length;
  for(let i = 1; i <= 10000; i++) emit(r,'unknown private words',true,i);
  assert.ok(JSON.stringify(h.listener).length - before < 100,'State cannot grow with utterance count');
  for(const i of [0,1,500,9999,10000]) emit(r,'coach skip',true,i);
  assert.deepEqual(h.actions,['pause']);
  emit(r,'coach repeat',true,10001); assert.deepEqual(h.actions,['pause','repeat']);
  assert.doesNotMatch(JSON.stringify(h.listener),/unknown private words/);
});
test('The shared parser still supplies action IDs rather than raw recognized text', () => {
  assert.equal(parseCoachCommand('coach stop',{spoken:true,final:false}),'pause');
  assert.equal(parseCoachCommand('coach skip',{spoken:true,final:false}),null);
  assert.equal(parseCoachCommand('do not stop',{spoken:true,final:true}),null);
});
