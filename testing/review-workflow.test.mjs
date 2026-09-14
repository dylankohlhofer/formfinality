import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,unlink,readdir,symlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {syntheticReviewSource,canonicalReviewJSON,REVIEW_LIMITS} from './ai-review.mjs';
import {runLocalReview,nativeReview,writeReviewJSON,NATIVE_REVIEW_LIMITS,REVIEW_LOCK_FILE} from './run-ai-review.mjs';
async function fixture(t,candidates=true){
  const results=fileURLToPath(new URL('../test-results/',import.meta.url));await mkdir(results,{recursive:true});
  const dir=await mkdtemp(join(results,'review-workflow-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const report={origin:'synthetic',started:'2026-09-14T00:00:00.000Z',build:'fixture.html',buildHash:'a'.repeat(64),status:'passed checks; video coverage incomplete',
    limitations:['Synthetic workflow unit test; no exercise inference.'],
    results:candidates?[{id:'video-gap',mode:'video',status:'blocked',reason:'No human exercise recording was supplied.'}]:[]};
  const bytes=JSON.stringify(report);await writeFile(join(dir,'report.json'),bytes);
  await writeFile(join(dir,'review-source.json'),JSON.stringify(syntheticReviewSource(Buffer.from(bytes),{
    inputKind:'synthetic',recording:false,landmarks:false,scenarioSource:'repository'})));
  return dir;
}
const json=async path=>JSON.parse(await readFile(path,'utf8'));
test('Atomic publication rechecks ownership after writing bytes and leaves old output intact on rejection',async t=>{
  const dir=await fixture(t),path=join(dir,'review-status.json');
  await writeFile(path,'{"status":"existing"}');let checked=false;
  await assert.rejects(()=>writeReviewJSON(path,{status:'new'},async()=>{
    const staged=(await readdir(dir)).filter(n=>n.startsWith('.review-write-'));
    assert.equal(staged.length,1);assert.equal((await json(join(dir,staged[0]))).status,'new');
    checked=true;throw Error('REVIEW_LOCK_LOST');
  }),/REVIEW_LOCK_LOST/);
  assert.equal(checked,true);assert.equal((await json(path)).status,'existing');
  assert.equal((await readdir(dir)).some(n=>n.startsWith('.review-write-')),false);
});
for(const name of ['review-import.json','review-status.json'])test(`Root ${name} symlinks cannot overwrite their targets`,async t=>{
  const dir=await fixture(t),foreign=join(dir,'foreign.json');await writeFile(foreign,'{"keep":true}');
  await symlink(foreign,join(dir,name));let calls=0;
  await assert.rejects(()=>runLocalReview({runDir:dir,nativeRunner:async()=>{calls++;}}),/regular file/);
  assert.equal(calls,0);assert.deepEqual(await json(foreign),{keep:true});
  assert.equal((await readdir(dir)).includes(REVIEW_LOCK_FILE),false);
  assert.equal((await readdir(dir)).some(n=>n.startsWith('.review-write-')),false);
});
const selectedRunner=async path=>{
  const bytes=await readFile(path,'utf8'),p=JSON.parse(bytes);
  assert.equal(bytes,canonicalReviewJSON(p),'the actual package file must use compact canonical JSON');
  return {code:0,stderr:'Synthetic provider stub, not actual model inference.',stdout:JSON.stringify({schema:'ai-review-selection/1',
    reportHash:p.reportHash,evidenceHash:p.evidenceHash,selectedCandidateIds:[p.candidates[0].id]})};
};
const noLock=dir=>assert.rejects(readFile(join(dir,REVIEW_LOCK_FILE)),{code:'ENOENT'});
test('An empty synthetic run has no candidate, no model call and no accuracy verdict',async t=>{
  const dir=await fixture(t,false);let calls=0;
  const r=await runLocalReview({runDir:dir,nativeRunner:async()=>{calls++;throw Error('Unexpected model');}});
  assert.equal(r.status,'no-candidates');assert.equal(r.modelRan,false);assert.equal(r.accuracyVerdict,'not-assessed');assert.equal(calls,0);
  await noLock(dir);
});
test('Validated local review preserves candidate gaps and does not edit the source report',async t=>{
  const dir=await fixture(t),before=await readFile(join(dir,'report.json'),'utf8');
  const r=await runLocalReview({runDir:dir,nativeRunner:selectedRunner});
  assert.equal(r.status,'human-review-required');assert.equal(r.accuracyVerdict,'not-assessed');
  assert.equal(await readFile(join(dir,'report.json'),'utf8'),before);
  const imported=JSON.parse(await readFile(join(dir,'review-import.json'),'utf8'));
  assert.equal(imported.selectedCandidateIds.length,1);assert.equal(imported.humanReviewRequired,true);
  await noLock(dir);
});
test('Unavailable native model clears current priorities, never produces a fake successful selection',async t=>{
  const dir=await fixture(t);
  await runLocalReview({runDir:dir,nativeRunner:selectedRunner});
  const r=await runLocalReview({runDir:dir,nativeRunner:async()=>({code:2,stdout:'',stderr:'model-not-ready'})});
  assert.equal(r.status,'native-not-selected');
  const latest=JSON.parse(await readFile(join(dir,'review-import.json'),'utf8'));
  assert.deepEqual(latest.selectedCandidateIds,[]);assert.equal(latest.accuracyVerdict,'not-assessed');
  await noLock(dir);
});
test('Sources changing while AI runs invalidate its result',async t=>{
  const dir=await fixture(t);
  await runLocalReview({runDir:dir,nativeRunner:selectedRunner});
  const r=await runLocalReview({runDir:dir,nativeRunner:async path=>{
    const p=JSON.parse(await readFile(path,'utf8'));await writeFile(join(dir,'report.json'),'{}');
    return {code:0,stderr:'stub',stdout:JSON.stringify({schema:'ai-review-selection/1',reportHash:p.reportHash,evidenceHash:p.evidenceHash,selectedCandidateIds:[p.candidates[0].id]})};
  }});
  assert.equal(r.status,'selection-rejected');
  assert.deepEqual((await json(join(dir,'review-import.json'))).selectedCandidateIds,[]);
  await noLock(dir);
});
for(const [name,mutate] of [
  ['malformed receipt',dir=>writeFile(join(dir,'review-source.json'),'{}')],
  ['stale report',dir=>writeFile(join(dir,'report.json'),'{}')],
  ['missing report',dir=>unlink(join(dir,'report.json'))],
  ['external provenance',async dir=>{
    const report=await json(join(dir,'report.json'));report.origin='external';
    const bytes=JSON.stringify(report);await writeFile(join(dir,'report.json'),bytes);
    await writeFile(join(dir,'review-source.json'),JSON.stringify(syntheticReviewSource(bytes,{
      inputKind:'synthetic',recording:false,landmarks:false,scenarioSource:'repository'})));
  }]
])test(`Export failure (${name}) clears old root priorities before any native call`,async t=>{
  const dir=await fixture(t),previous=await runLocalReview({runDir:dir,nativeRunner:selectedRunner});
  const archived=await readFile(join(previous.directory,'review-import.json'),'utf8');
  await mutate(dir);let calls=0;
  const r=await runLocalReview({runDir:dir,nativeRunner:async()=>{calls++;throw Error('Unexpected model');}});
  assert.equal(r.status,'export-failed');assert.equal(r.modelRan,false);assert.equal(calls,0);
  const latest=await json(join(dir,'review-import.json')),status=await json(join(dir,'review-status.json'));
  assert.equal(latest.status,'export-failed');assert.deepEqual(latest.selectedCandidateIds,[]);
  assert.equal(status.status,'export-failed');assert.equal(status.modelRan,false);assert.ok(status.message);
  assert.equal((await json(join(r.directory,'review-status.json'))).status,'export-failed');
  assert.equal(await readFile(join(previous.directory,'review-import.json'),'utf8'),archived,'prior attempt evidence is retained');
  await noLock(dir);
});

test('Same-run overlap fails visibly without touching the owner lock, status or priorities',async t=>{
  const dir=await fixture(t);let enter,release;
  const entered=new Promise(resolve=>{enter=resolve;}),gate=new Promise(resolve=>{release=resolve;});
  const active=runLocalReview({runDir:dir,nativeRunner:async path=>{enter();await gate;return selectedRunner(path);}});
  await entered;
  try{
    const names=await readdir(dir),lock=await readFile(join(dir,REVIEW_LOCK_FILE),'utf8');
    const status=await readFile(join(dir,'review-status.json'),'utf8'),priorities=await readFile(join(dir,'review-import.json'),'utf8');
    assert.equal(JSON.parse(status).status,'reviewing');assert.deepEqual(JSON.parse(priorities).selectedCandidateIds,[]);
    await assert.rejects(runLocalReview({runDir:dir,nativeRunner:async()=>assert.fail('second native call')}),{code:'REVIEW_LOCKED'});
    assert.equal(await readFile(join(dir,REVIEW_LOCK_FILE),'utf8'),lock);
    assert.equal(await readFile(join(dir,'review-status.json'),'utf8'),status);
    assert.equal(await readFile(join(dir,'review-import.json'),'utf8'),priorities);
    assert.deepEqual(await readdir(dir),names,'rejected attempt creates no artifacts');
  }finally{release();await active;}
  await noLock(dir);
  assert.equal((await json(join(dir,'review-status.json'))).status,'human-review-required');
  assert.equal((await json(join(dir,'review-import.json'))).selectedCandidateIds.length,1);
  assert.equal((await runLocalReview({runDir:dir,nativeRunner:selectedRunner})).status,'human-review-required','the next attempt may run after release');
});
test('An existing foreign or stale lock is never deleted or treated as consent to steal it',async t=>{
  const dir=await fixture(t),foreign='another owner; deliberately not parsed for stale-lock guesses';
  await writeFile(join(dir,REVIEW_LOCK_FILE),foreign);
  await assert.rejects(runLocalReview({runDir:dir}),{code:'REVIEW_LOCKED'});
  assert.equal(await readFile(join(dir,REVIEW_LOCK_FILE),'utf8'),foreign);
  await assert.rejects(readFile(join(dir,'review-status.json')),{code:'ENOENT'});
});
for(const replaceFile of [true,false])test(`Losing lock ownership (${replaceFile?'replaced inode':'rewritten owner'}) cannot remove the lock or publish over its owner`,async t=>{
  const dir=await fixture(t),foreign='replacement lock',latest={owner:'replacement',selectedCandidateIds:['preserve']};
  await assert.rejects(runLocalReview({runDir:dir,nativeRunner:async path=>{
    const selected=await selectedRunner(path);
    if(replaceFile)await unlink(join(dir,REVIEW_LOCK_FILE));
    await writeFile(join(dir,REVIEW_LOCK_FILE),foreign);
    await writeFile(join(dir,'review-import.json'),JSON.stringify(latest));
    await writeFile(join(dir,'review-status.json'),JSON.stringify({status:'other-owner'}));
    return selected;
  }}),{code:'REVIEW_LOCK_LOST'});
  assert.equal(await readFile(join(dir,REVIEW_LOCK_FILE),'utf8'),foreign);
  assert.deepEqual(await json(join(dir,'review-import.json')),latest);
  assert.equal((await json(join(dir,'review-status.json'))).status,'other-owner');
});
test('Native exceptions release the lock and leave no previous priority selection',async t=>{
  const dir=await fixture(t);await runLocalReview({runDir:dir,nativeRunner:selectedRunner});
  const r=await runLocalReview({runDir:dir,nativeRunner:async()=>{throw Error('provider launch failed');}});
  assert.equal(r.status,'native-unavailable');assert.match(r.message,/launch failed/);
  assert.deepEqual((await json(join(dir,'review-import.json'))).selectedCandidateIds,[]);await noLock(dir);
});
for(const kind of ['timedOut','oversized'])test(`Native ${kind} publishes empty priorities and bounded-termination evidence`,async t=>{
  const dir=await fixture(t);await runLocalReview({runDir:dir,nativeRunner:selectedRunner});
  const r=await runLocalReview({runDir:dir,nativeRunner:async()=>({code:null,stdout:'',stderr:'controlled test',
    [kind]:true,killAttempted:true,settledWithoutClose:true,terminationErrors:[{signal:'SIGKILL',code:'EPERM'}]})});
  assert.equal(r.status,kind==='timedOut'?'timed-out':'invalid-native-output');
  const status=await json(join(dir,'review-status.json'));
  assert.equal(status.killAttempted,true);assert.equal(status.settledWithoutClose,true);
  assert.equal(status.terminationErrors[0].code,'EPERM');
  assert.deepEqual((await json(join(dir,'review-import.json'))).selectedCandidateIds,[]);await noLock(dir);
});
test('An empty valid response cannot become successful human-review-required status',async t=>{
  const dir=await fixture(t);
  const r=await runLocalReview({runDir:dir,nativeRunner:async path=>{
    const execution=await selectedRunner(path),selection=JSON.parse(execution.stdout);
    selection.selectedCandidateIds=[];return {...execution,stdout:JSON.stringify(selection)};
  }});
  assert.equal(r.status,'no-selection-not-an-accuracy-pass');
  assert.equal((await json(join(dir,'review-status.json'))).status,r.status);
  assert.deepEqual((await json(join(dir,'review-import.json'))).selectedCandidateIds,[]);await noLock(dir);
});
test('Canonical transport stays importable when pretty printing would exceed the byte cap',async t=>{
  const dir=await fixture(t),report=await json(join(dir,'report.json'));
  report.limitations=Array(240000).fill('x');
  const bytes=JSON.stringify(report);await writeFile(join(dir,'report.json'),bytes);
  await writeFile(join(dir,'review-source.json'),JSON.stringify(syntheticReviewSource(bytes,{
    inputKind:'synthetic',recording:false,landmarks:false,scenarioSource:'repository'})));
  const r=await runLocalReview({runDir:dir,nativeRunner:async path=>{
    const compact=await readFile(path,'utf8'),p=JSON.parse(compact);
    assert.ok(Buffer.byteLength(compact)<=REVIEW_LIMITS.packageBytes);
    assert.ok(Buffer.byteLength(JSON.stringify(p,null,2))>REVIEW_LIMITS.packageBytes);
    return selectedRunner(path);
  }});
  assert.equal(r.status,'human-review-required');await noLock(dir);
});

// No actual subprocesses are launched. Node's mocked timers advance the real
// wrapper callbacks while in-memory streams simulate resistant child pipes.
function processDouble(t,{withoutPID=false,signalError,productionSignal=false}={}){
  t.mock.timers.enable({apis:['setTimeout']});
  const child=new EventEmitter(),signals=[],spawns=[];
  if(!withoutPID)child.pid=900001;
  child.stdout=new PassThrough();child.stderr=new PassThrough();
  child.unref=()=>{child.unreferenced=true;};
  child.kill=signal=>{signals.push({pid:child.pid,signal});};
  const options={spawnProcess:(...args)=>{spawns.push(args);return child;}};
  if(productionSignal)t.mock.method(process,'kill',(pid,signal)=>{signals.push({pid,signal});});
  else options.signalProcess=(_child,signal)=>{
    signals.push({pid:child.pid,signal});if(signalError)throw Object.assign(Error('signal refused'),{code:'EPERM'});
  };
  const promise=nativeReview('/synthetic/review-evidence.json',options);
  return {child,signals,spawns,promise,tick:ms=>t.mock.timers.tick(ms)};
}
test('Native deadline targets its process group, escalates, and settles without close',async t=>{
  const f=processDouble(t,{productionSignal:true});let settled=false;
  f.promise.then(()=>{settled=true;});
  assert.equal(f.spawns[0][2].detached,process.platform!=='win32');
  f.tick(NATIVE_REVIEW_LIMITS.timeoutMs);await Promise.resolve();assert.equal(settled,false);
  assert.equal(f.signals[0].signal,'SIGTERM');
  assert.equal(f.signals[0].pid,process.platform==='win32'?f.child.pid:-f.child.pid);
  f.tick(NATIVE_REVIEW_LIMITS.killGraceMs);await Promise.resolve();assert.equal(settled,false);
  assert.equal(f.signals[1].signal,'SIGKILL');
  f.tick(NATIVE_REVIEW_LIMITS.settleGraceMs);
  const r=await f.promise;
  assert.equal(r.timedOut,true);assert.equal(r.killAttempted,true);assert.equal(r.settledWithoutClose,true);
  assert.equal(f.child.stdout.destroyed,true);assert.equal(f.child.stderr.destroyed,true);assert.equal(f.child.unreferenced,true);
  f.child.emit('close',0);f.child.emit('error',Error('late error'));f.tick(NATIVE_REVIEW_LIMITS.timeoutMs);
  assert.equal(f.signals.length,2,'late child events cannot restart or resettle the attempt');
});
for(const stream of ['stdout','stderr'])test(`Oversized ${stream} enforces termination and independent settlement`,async t=>{
  const f=processDouble(t);f.child[stream].write(Buffer.alloc(NATIVE_REVIEW_LIMITS[stream+'Bytes']+1));
  assert.deepEqual(f.signals.map(s=>s.signal),['SIGTERM']);
  f.tick(NATIVE_REVIEW_LIMITS.killGraceMs);f.tick(NATIVE_REVIEW_LIMITS.settleGraceMs);
  const r=await f.promise;
  assert.equal(r.oversized,true);assert.equal(r.timedOut,false);assert.equal(r.settledWithoutClose,true);
  assert.ok(Buffer.byteLength(r[stream])<=NATIVE_REVIEW_LIMITS[stream+'Bytes']);
  assert.deepEqual(f.signals.map(s=>s.signal),['SIGTERM','SIGKILL']);
  f.tick(NATIVE_REVIEW_LIMITS.timeoutMs);assert.equal(f.signals.length,2);
});
test('Signal delivery failure is recorded but cannot defeat the settlement deadline',async t=>{
  const f=processDouble(t,{signalError:true});
  f.tick(NATIVE_REVIEW_LIMITS.timeoutMs);f.tick(NATIVE_REVIEW_LIMITS.killGraceMs);f.tick(NATIVE_REVIEW_LIMITS.settleGraceMs);
  const r=await f.promise;assert.equal(r.timedOut,true);assert.equal(r.terminationErrors.length,2);
  assert.ok(r.terminationErrors.every(e=>e.code==='EPERM'));assert.equal(r.settledWithoutClose,true);
});
test('Normal exit preserves split UTF-8 output and cancels all termination timers',async t=>{
  const f=processDouble(t),bytes=Buffer.from('{"choice":"🧪"}');
  f.child.stdout.write(bytes.subarray(0,13));f.child.stdout.write(bytes.subarray(13));
  f.child.emit('close',0);const r=await f.promise;
  assert.equal(r.stdout,bytes.toString('utf8'));assert.equal(r.code,0);assert.equal(r.timedOut,false);
  f.tick(NATIVE_REVIEW_LIMITS.timeoutMs+2000);assert.equal(f.signals.length,0);
});
test('Close after SIGTERM still cleans descendants and cancels further callbacks',async t=>{
  const f=processDouble(t);f.tick(NATIVE_REVIEW_LIMITS.timeoutMs);f.child.emit('close',null);
  const r=await f.promise;assert.equal(r.settledWithoutClose,false);
  assert.deepEqual(f.signals.map(s=>s.signal),['SIGTERM','SIGKILL']);
  f.tick(5000);assert.equal(f.signals.length,2);
});
test('Spawn errors reject promptly with no orphaned deadline or process signal',async t=>{
  const f=processDouble(t,{withoutPID:true}),rejected=assert.rejects(f.promise,/spawn failed/);
  f.child.emit('error',Error('spawn failed'));await rejected;
  f.tick(NATIVE_REVIEW_LIMITS.timeoutMs+2000);assert.equal(f.signals.length,0);
});
test('An error from a running child still terminates it before rejection',async t=>{
  const f=processDouble(t),rejected=assert.rejects(f.promise,/running child failed/);
  f.child.emit('error',Error('running child failed'));
  f.tick(NATIVE_REVIEW_LIMITS.killGraceMs);f.tick(NATIVE_REVIEW_LIMITS.settleGraceMs);
  await rejected;assert.deepEqual(f.signals.map(s=>s.signal),['SIGTERM','SIGKILL']);
});
