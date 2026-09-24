import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { validate, validateRecording, assertion, engineSource, snapshot, runTimeline, benignConsoleError, runExitCode, hash } from './lib.mjs';
import { findings, escape, hasScreenshot, suiteLog } from './report.mjs';
import { serve } from './browser.mjs';
import {resolve,dirname,join} from 'node:path';

test('Every original harness consumes the archived build, even if the working file changes during a run',async()=>{
  const source=await readFile(new URL('./run.mjs',import.meta.url),'utf8');
  const block=source.slice(source.indexOf("if (options.mode === 'all') {"),source.indexOf('const frameFor ='));
  assert.ok(block.includes('verify-skip.mjs'),'Exercise the actual production harness loop');
  const calls=[],root='/repo',dir='/repo/test-results/saved';
  await vm.runInNewContext(`(async()=>{${block}})()`,{
    root,dir,resolve,options:{mode:'all',build:'/working/changed.html'},run:{results:[]},
    process:{execPath:process.execPath,env:{}},writeFile:async()=>{},
    spawnSync:(exe,args,opts)=>{calls.push({exe,args,opts});return {status:0,stdout:'',stderr:''};}
  });
  const legacy=calls.filter(c=>c.args[0].startsWith('verify'));
  assert.equal(legacy.length,4);
  for(const call of legacy)assert.equal(call.args[1],resolve(dir,'build.html'),call.args[0]);
  for(const call of calls.filter(c=>c.args[0]==='--test'))
    assert.equal(call.opts.env.FORM_COACH_TEST_BUILD,resolve(dir,'build.html'));
});

test('Mutation harness works with an archived build outside the harness directory',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  await mkdir(resolve(root,'test-results'),{recursive:true});
  const dir=await mkdtemp(resolve(root,'test-results/archived-mutation-'));
  const build=resolve(dir,'saved build.html');
  await writeFile(build,await readFile(resolve(root,'form-coach-v4.11.html')));
  const r=spawnSync(process.execPath,[resolve(root,'verify-mutations.mjs'),build],{cwd:dir,encoding:'utf8',timeout:30000});
  await writeFile(resolve(dir,'verify-mutations.log'),(r.stdout||'')+(r.stderr||''));
  assert.equal(r.status,0,r.error?.message || r.stdout+r.stderr);
  assert.match(r.stdout,/all 8 mutations caught, control stayed green/);
});
for(const outcome of ['empty-success','launch-error','green-line-nonzero'])
  test(`Mutation control must prove verifier success: ${outcome}`,async()=>{
    const html=await readFile(new URL('../form-coach-v4.11.html',import.meta.url),'utf8');
    const original=await readFile(new URL('../verify-mutations.mjs',import.meta.url),'utf8');
    const source=original.slice(original.indexOf('const BUILD =')).replaceAll('import.meta.url',JSON.stringify(new URL('../verify-mutations.mjs',import.meta.url).href));
    const logs=[];let exit;
    vm.runInNewContext(source,{
      dirname,resolve,join,fileURLToPath,readFileSync:()=>html,writeFileSync:()=>{},unlinkSync:()=>{},existsSync:()=>true,
      process:{argv:['node','verify-mutations.mjs','/saved/build.html'],execPath:process.execPath,exit:code=>{exit=code;}},
      console:{log:s=>logs.push(String(s)),error:s=>logs.push(String(s))},
      execFileSync:()=>{
        if(outcome==='empty-success')return '';
        throw Object.assign(new Error('Verifier failure'),{status:outcome==='launch-error'?null:1,
          stdout:outcome==='green-line-nonzero'?'  refGates 224 vectors … ok\n':'',stderr:'Verifier did not finish successfully'});
      }
    });
    assert.equal(exit,1);
    assert.ok(logs.some(line=>line.includes('✗ control — unmodified build')),logs.join('\n'));
  });

for(const flags of [['--mode','engine'],['--mode','browser'],['--mode','audio'],['--mode','all','--library-only']])
  test(`Required-video rejects non-video selection: ${flags.join(' ')}`,()=>{
    const r=spawnSync(process.execPath,['testing/run.mjs','--build','form-coach-v4.11.html',...flags,'--require-video'],{encoding:'utf8',timeout:10000});
    assert.equal(r.status,2);assert.match(r.stderr,/requires scenario video coverage/);
  });
test('Required-video needs completed video results, not merely absence of blocked rows',()=>{
  const engine={mode:'engine',status:'passed'},video={mode:'video',status:'passed'};
  for(const options of [{requireVideo:true},{mode:'video'}]){
    assert.equal(runExitCode([],options),2);assert.equal(runExitCode([engine],options),2);
    assert.equal(runExitCode([engine,{...video,status:'blocked'}],options),2);
    assert.equal(runExitCode([engine,video],options),0);
    assert.equal(runExitCode([video,{...video,status:'blocked'}],options),2);
    assert.equal(runExitCode([{...video,status:'failed'}],options),1);
  }
  assert.equal(runExitCode([engine,{...video,status:'blocked'}]),0);
  assert.equal(runExitCode([video],{requireVideo:true,reviewFailed:true}),1);
});
import { fileURLToPath } from 'node:url';
import { loadEngine } from './lib.mjs';
import { exerciseInputs } from './exercise-inputs.mjs';
import { exerciseScenarios, exerciseSweep } from './exercise-sweep.mjs';
const base = JSON.parse(await readFile(new URL('./scenarios/first-steps.json', import.meta.url)));
test('served app and both browser instrumentation layers parse before launching a browser', async () => {
  const html = await readFile(new URL('../form-coach-v4.11.html', import.meta.url), 'utf8');
  const app = html.split('<script type="module">')[1].split('</script>')[0];
  const bridge = await readFile(new URL('./bridge.js', import.meta.url), 'utf8');
  const audio = await readFile(new URL('./audio-bridge.js', import.meta.url), 'utf8');
  for (const source of [app, app + '\n' + bridge, app + '\n' + bridge + '\n' + audio]) {
    const r = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: source, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  }
});
test('committed scenario validates', () => assert.equal(validate(base).id, 'first-steps'));
test('unknown actions fail loudly', () => assert.throws(() => validate({ ...base, steps: [{ do: 'start', core: 'session' }, { do: 'typo' }] })));
test('missing oracle rejected', () => assert.throws(() => validate({ ...base, oracle: '' })));
test('zero is not an unattempted phase', () => assert.equal(assertion({ path: 'score', equals: null }, { score: 0 }).pass, false));
test('missing field is not null', () => assert.equal(assertion({ path: 'score', equals: null }, {}).pass, false));
test('actual null accepted, nonfinite numbers cannot masquerade as null', () => {
  assert.equal(assertion({ path: 'score', equals: null }, { score: null }).pass, true);
  assert.equal(assertion({ path: 'score', equals: null }, { score: NaN }).pass, false);
  assert.equal(assertion({ path: 'score', equals: null }, { score: Infinity }).pass, false);
});
test('nonfinite range rejected', () => assert.equal(assertion({ path: 'held', between: [4, 6] }, { held: NaN }).pass, false));
test('bad timing rejected', () => assert.throws(() => validate({ ...base, steps: [base.steps[0], { do: 'frames', seconds: -1, pose: null }] })));
test('no assertion cannot pass silently', () => assert.throws(() => validate({ ...base, steps: [base.steps[0], { do: 'check', label: 'x', path: 'x' }] })));
test('engine boundary must exist', () => assert.throws(() => engineSource('<script type="module">wrong</script>')));
test('duplicate modules fail', () => assert.throws(() => engineSource('<script type="module"></script><script type="module"></script>')));
test('effect snapshot retains last verdict', () => assert.equal(snapshot(null, [{ t: 'calibFinish', payload: { tierId: 'learning' } }]).calibration.tierId, 'learning'));
test('effect snapshot exposes the actual counter, not a fabricated zero', () => {
  assert.equal(snapshot({ ev: { rep: { display: () => 4 } } }, []).reps, 4);
  assert.equal(snapshot(null, []).reps, 0);
});
test('coverage gaps are not bugs or passes', () => assert.equal(findings([{ status: 'blocked', id: 'video', reason: 'no clip' }])[0].kind, 'coverage gap'));
test('assertion failure is candidate, not confirmed product bug', () => assert.match(findings([{ checks: [{ pass: false, label: 'x' }] }])[0].kind, /candidate/));
test('report escapes hostile HTML', () => assert.equal(escape('<script>"&'), '&lt;script&gt;&quot;&amp;'));
test('suite reports link their real logs without accepting paths or executable URLs', () => {
  assert.equal(suiteLog({mode:'regression',id:'reported-session'}),'reported-session.log');
  assert.equal(suiteLog({mode:'legacy',id:'verify.mjs'}),'verify.mjs.log');
  for(const id of ['../private','javascript:alert(1)','https://example.test','<script>'])
    assert.equal(suiteLog({mode:'regression',id}),null);
  assert.equal(suiteLog({mode:'engine',id:'crunch'}),null);
});
test('report links UI screenshots, not uncaptured library core checkpoints', () => {
  assert.equal(hasScreenshot({ mode: 'browser' }, { step: 7 }), true);
  assert.equal(hasScreenshot({ mode: 'browser' }, { step: 6, path: 'done' }), false);
  assert.equal(hasScreenshot({ mode: 'engine' }, { step: 7 }), false);
});
test('finish loop is bounded', async () => {
  let count = 0;
  await assert.rejects(runTimeline({ steps: [{ do: 'finishBySkipping' }] }, { snapshot: async () => ({ done: false }), skip: async () => count++ }), /30 skips/);
  assert.equal(count, 30);
});
test('failing assertion remains failed', async () => {
  const r = await runTimeline({ steps: [{ do: 'check', label: 'mutated null', path: 'score', equals: null }] }, { snapshot: async () => ({ score: 0 }) });
  assert.equal(r.checks[0].pass, false);
});
test('only exact native INFO line is classified as informational', () => {
  assert.equal(benignConsoleError('INFO: Created TensorFlow Lite XNNPACK delegate for CPU.'), true);
  assert.equal(benignConsoleError('hasDemo is not defined'), false);
  assert.equal(benignConsoleError('INFO: something unexpected'), false);
});
test('missing recorded frames fail loudly', () => assert.throws(() => validateRecording({ schema: 1, frames: [] }, base)));
test('nonmonotonic recorded frames rejected', () => assert.throws(() => validateRecording({ schema: 1, frames: [
  { t: 0, aspect: 1, landmarks: null }
] }, { steps: [{ do: 'frames', seconds: 1 / 30 }] })));
test('valid no-detection recording is replayable', () => assert.equal(validateRecording({ schema: 1, frames: [
  { t: 1 / 30, aspect: 16 / 9, landmarks: null }
] }, { steps: [{ do: 'frames', seconds: 1 / 30 }] }).length, 1));
test('video replay retains explicit unassessed ticks without weakening assessed inference checks', async () => {
  const bridge = await readFile(new URL('./bridge.js', import.meta.url), 'utf8');
  const sandbox = vm.createContext({voiceChk:{}, openCamera(){}, applyFx(){}, window:{},
    sess:{core:{following:false}}, calib:null, recMode:false,
    video:{duration:10,currentTime:0}, canvas:{width:640,height:360}, lastT:0,lastVideoTime:-1});
  vm.runInContext(bridge, sandbox);
  const tick = () => sandbox.window.__testLab.videoFrame(0, 1 / 30);
  const infer = 'testLandmarks.push({t:testNow,aspect:canvas.width/canvas.height,landmarks:null});';
  vm.runInContext(`function loopBody(){ ${infer} }`, sandbox);
  await tick();
  sandbox.sess.core.following = true;
  await assert.rejects(tick(), /Inference ran during unassessed/);
  vm.runInContext('loopBody = () => {};', sandbox);
  await tick();
  const saved = sandbox.window.__testLab.landmarks();
  assert.equal(saved.at(-1).inference, 'disabled-unassessed');
  assert.equal(saved.at(-1).landmarks, null);
  assert.equal(saved.at(-1).t, 3 / 30);
  // Even zero detections require a real detector call outside follow-along.
  sandbox.sess.core.following = false;
  await assert.rejects(tick(), /Expected one real inference/);
  vm.runInContext(`loopBody = () => { ${infer} ${infer} };`, sandbox);
  await assert.rejects(tick(), /Expected one real inference/);
  vm.runInContext(`loopBody = () => { ${infer} };`, sandbox);
  await tick();
  assert.equal(saved.at(-1).inference, undefined);
  sandbox.sess.core.paused = true;
  await assert.rejects(tick(), /Inference ran during paused/);
  vm.runInContext('loopBody = () => {};', sandbox); await tick();
  assert.equal(saved.at(-1).inference, 'disabled-paused');
  sandbox.sess.core.paused = false;
  await assert.rejects(tick(), /Expected one real inference/);
});
test('empty assertion coverage rejected', () => assert.throws(() => validate({ ...base, steps: [base.steps[0]] }), /independent/));
test('null interval rejected', () => assert.throws(() => validate({ ...base, steps: [base.steps[0], { do: 'check', label: 'bad', path: 'held', between: null }] }), /interval/));
test('local server exposes only declared assets, not repository files', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const html = await readFile(new URL('../form-coach-v4.11.html', import.meta.url), 'utf8');
  const server = await serve(root, html);
  try {
    for (const path of ['/AGENTS.md', '/.git/config', '/testing/private/secret.mp4'])
      assert.equal((await fetch(server.url + path)).status, 404);
  } finally { await server.close(); }
});
test('test instrumentation never rewrites the shipped file', async () => {
  const build = new URL('../form-coach-v4.11.html', import.meta.url);
  const html = await readFile(build, 'utf8');
  const server = await serve(fileURLToPath(new URL('../', import.meta.url)), html);
  try {
    const served = await (await fetch(server.url)).text();
    assert.match(served, /window\.__testLab/);
    assert.equal(served.includes('https://fonts.googleapis.com'), false);
    assert.equal(await readFile(build, 'utf8'), html);
    assert.equal(html.includes('window.__testLab'), false);
  } finally { await server.close(); }
});
test('audio transport evidence measures served bytes and isolates requests without exposing private files',async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  const html=await readFile(resolve(root,'form-coach-v4.11.html'),'utf8');
  const source=await readFile(resolve(root,'voice/warm/num/2.mp3'));
  const server=await serve(root,html,undefined,{audio:true});
  try{
    const headers={'X-FormFinder-Test-Case':'transport-control'};
    const full=await fetch(server.url+'/voice/warm/num/2.mp3',{headers});
    assert.deepEqual(Buffer.from(await full.arrayBuffer()),source);
    const range=await fetch(server.url+'/voice/warm/num/2.mp3',{headers:{...headers,Range:'bytes=0-63'}});
    assert.equal(range.status,206);assert.deepEqual(Buffer.from(await range.arrayBuffer()),source.subarray(0,64));
    assert.equal((await fetch(server.url+'/AGENTS.md',{headers})).status,404);
    assert.equal((await fetch(server.url+'/voice/not-a-real-clip.mp3',{headers})).status,404);
    assert.equal(server.assetEventsDropped,0);assert.equal(server.assetEvents.length,3);
    const [whole,part,missing]=server.assetEvents;
    assert.equal(whole.caseId,'transport-control');assert.equal(whole.bytes,source.length);
    assert.equal(whole.sha256,hash(source));assert.equal(whole.statusCode,200);
    assert.equal(part.bytes,64);assert.equal(part.sha256,hash(source.subarray(0,64)));
    assert.deepEqual(part.range,{start:0,end:63});assert.equal(missing.sha256,undefined);
    assert.equal(missing.statusCode,404);assert.ok(missing.stages.some(s=>s.name==='asset-error'));
    for(const row of [whole,part]){
      const stages=row.stages.map(s=>s.name);
      assert.ok(stages.indexOf('realpath-end')>stages.indexOf('realpath-start'));
      assert.ok(stages.indexOf('first-byte')>stages.indexOf('file-open'));
      assert.ok(stages.indexOf('response-finish')>stages.indexOf('file-end'));
      assert.ok(row.finishedAt>=row.receivedAt);
      assert.ok(row.stages.every((s,i)=>i===0||s.ms>=row.stages[i-1].ms));
    }
  }finally{await server.close();}
});
const engine = await loadEngine(await readFile(new URL('../form-coach-v4.11.html', import.meta.url), 'utf8'));
const exercise = exerciseInputs(JSON.parse(await readFile(new URL('../conformance-vectors.json', import.meta.url))).poses);
test('historical active-state scenarios retain positive and negative counter assertions', async () => {
  for (const id of ['pushup-active-position-loss', 'pushup-active-framing-loss']) {
    const s = validate(JSON.parse(await readFile(new URL(`./scenarios/${id}.json`, import.meta.url))));
    const checks = s.steps.filter(x => x.do === 'check' && x.path === 'reps');
    assert.equal(checks.length, 2);
    assert.deepEqual(checks.map(x => x.equals), [1, 1]);
    assert.equal(s.steps.filter(x => x.do === 'frames').reduce((n,x) => n+x.seconds, 0), 19);
  }
});
test('clipped cycles translate the real fixture without changing its motion', () => {
  for (const t of [0, 1, 2, 3]) {
    const a = exercise.resolve('exercise:push-up:cycle', t), b = exercise.resolve('exercise:push-up:clipped-cycle', t);
    for (const side of ['left', 'right']) for (const j of Object.keys(a[side])) {
      assert.equal(b[side][j].x, a[side][j].x - 2);
      assert.equal(b[side][j].y, a[side][j].y);
      assert.equal(b[side][j].c, a[side][j].c);
      assert.ok(b[side][j].x < 0);
    }
  }
});
test('upright cycles keep the torso vertical while only the arm action changes', () => {
  const rest = exercise.resolve('exercise:push-up:upright-cycle', 0), peak = exercise.resolve('exercise:push-up:upright-cycle', 2);
  for (const side of ['left', 'right']) {
    assert.equal(rest[side].hip.x, rest[side].shoulder.x);
    assert.ok(rest[side].hip.y > rest[side].shoulder.y);
    for (const j of ['hip', 'shoulder', 'knee', 'ankle']) assert.deepEqual(rest[side][j], peak[side][j]);
    assert.notDeepEqual(rest[side].elbow, peak[side].elbow);
  }
  assert.throws(() => exercise.resolve('exercise:plank:upright-cycle'), /push-up only/);
});
test('every movement and supported tier has a committed scenario definition', () => {
  const scenarios = exerciseScenarios(engine);
  assert.equal(scenarios.length, 44);
  assert.equal(new Set(scenarios.map(s => s.movement)).size, 21);
  for (const s of scenarios) validate(s);
});
test('an unrecognised movement cannot silently borrow a fixture', () => assert.throws(() => exercise.frame('unknown-movement')));
test('library sweep catches a deliberately invented zero on skip', () => {
  class ZeroSkip extends engine.SessionCore {
    skip(reason) { const effects = super.skip(reason); for (const row of this.out) if (row.skipped) row.score = 0; return effects; }
  }
  const result = exerciseSweep({ ...engine, SessionCore: ZeroSkip }, exercise);
  assert.equal(result.filter(r => r.checks.some(c => c.label === 'Skipped phase score is null' && !c.pass)).length, 44);
});
test('library sweep catches a deliberately broken rep counter', () => {
  class LostCount extends engine.Rep { display() { return 0; } }
  const result = exerciseSweep({ ...engine, Rep: LostCount }, exercise);
  assert.equal(result.filter(r => r.checks.some(c => c.label === 'One complete driver cycle counts once' && !c.pass)).length,
    Object.values(engine.M).filter(m => m.kind === 'reps').reduce((n, m) => n + m.tiers.length, 0));
});
