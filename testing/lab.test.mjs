import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { validate, validateRecording, assertion, engineSource, snapshot, runTimeline, benignConsoleError } from './lib.mjs';
import { findings, escape, hasScreenshot, suiteLog } from './report.mjs';
import { serve } from './browser.mjs';
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
