import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validate, validateRecording, assertion, engineSource, snapshot, runTimeline, benignConsoleError } from './lib.mjs';
import { findings, escape } from './report.mjs';
import { serve } from './browser.mjs';
import { fileURLToPath } from 'node:url';
const base = JSON.parse(await readFile(new URL('./scenarios/first-steps.json', import.meta.url)));
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
test('coverage gaps are not bugs or passes', () => assert.equal(findings([{ status: 'blocked', id: 'video', reason: 'no clip' }])[0].kind, 'coverage gap'));
test('assertion failure is candidate, not confirmed product bug', () => assert.match(findings([{ checks: [{ pass: false, label: 'x' }] }])[0].kind, /candidate/));
test('report escapes hostile HTML', () => assert.equal(escape('<script>"&'), '&lt;script&gt;&quot;&amp;'));
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
