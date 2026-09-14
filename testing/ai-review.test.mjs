import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { auditAudio } from './audio-review.mjs';
import { engineAdapter, fixtures, loadEngine, runTimeline, validate, compactEffects } from './lib.mjs';
import { REVIEW_LIMITS, canonicalReviewJSON, parseReviewJSON, syntheticReviewSource,
  exportReview, importReview, validateReviewSelection, buildReviewBundle,
  reviewChoiceRequest, validateReviewChoice } from './ai-review.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const synthetic = { inputKind: 'synthetic', recording: false, landmarks: false, scenarioSource: 'repository' };
const state = { phase: 0, movement: 'plank', observation: { pose: 'good', since: 0 } };
const item = { key: 'goodhold', text: 'Good.', requestedMs: 0, ttl: 2500, requestedState: state };
const audioEvidence = () => structuredClone({ events: [
  { type: 'capture-start', ms: 0, state },
  { type: 'speech-start', ms: 0, item, state },
  { type: 'clip-start', ms: 20, playId: 2, item, state },
  { type: 'clip-end', ms: 1020, playId: 2, state },
  { type: 'capture-end', ms: 30000, state }
], levels: [{ ms: 100, playId: 2, rms: .1 }], decoded: { seconds: 30, rms: .1 }, limitations: ['Synthetic audio metadata; no new recording or listening test.'] });

async function fixture(t, audio = audioEvidence()) {
  const dir = await mkdtemp(resolve(tmpdir(), 'formcoach-ai-review-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const paths = { reportPath: resolve(dir, 'report.json'), sourcePath: resolve(dir, 'review-source.json'),
    packagePath: resolve(dir, 'review-evidence.json'), responsePath: resolve(dir, 'review-selection.json') };
  const audit = auditAudio(audio);
  const result = { id: 'audio/synthetic', mode: 'audio', status: audit.checks.every(c => c.pass) ? 'passed' : 'failed',
    evidence: 'audio-synthetic', audio: true, checks: structuredClone(audit.checks), concerns: structuredClone(audit.concerns), audioGaps: audit.gaps };
  const run = { origin: 'synthetic', status: 'passed checks', buildHash: hash('synthetic build'), results: [result], limitations: ['No real-person coverage.'] };
  const json = (path, data) => writeFile(resolve(dir, path), JSON.stringify(data));
  const receipt = async () => json('review-source.json', syntheticReviewSource(await readFile(paths.reportPath), synthetic));
  const save = async () => {
    for (const r of run.results) if (r.evidence) {
      await mkdir(resolve(dir, r.evidence), { recursive: true });
      await json(`${r.evidence}/result.json`, r);
    }
    await json('report.json', run); await receipt();
  };
  await save();
  await json('audio-synthetic/audio.json', audio);
  await json('audio-synthetic/scenario.json', { schema: 'audio-case/1', id: 'synthetic', kind: 'clips', oracle: 'Independent declared sample expectation.' });
  return { ...paths, dir, run, result, audio, json, save, receipt,
    export: () => exportReview(paths), import: () => importReview(paths) };
}
const response = (p, ids = []) => ({ schema: 'ai-review-selection/1', reportHash: p.reportHash, evidenceHash: p.evidenceHash, selectedCandidateIds: ids });
const encode = JSON.stringify;
const details = p => p.candidates.map(c => c.detail).join('\n');
async function manifestInput(f) {
  const reportBytes = await readFile(f.reportPath, 'utf8');
  const artifacts = [];
  for (const name of ['scenario', 'result', 'audio']) {
    const file = `audio-synthetic/${name}.json`, bytes = await readFile(resolve(f.dir, file), 'utf8');
    artifacts.push({ file, bytes, sha256: hash(bytes) });
  }
  return { reportBytes, manifest: { schema: 'ai-review-manifest/1', reportHash: hash(reportBytes), artifacts },
    syntheticAttestation: syntheticReviewSource(reportBytes, synthetic) };
}

test('deterministic packaging, byte provenance, bounded timeline and empty review are honest', async t => {
  const f = await fixture(t), first = await f.export(), second = await f.export();
  assert.equal(canonicalReviewJSON(first), canonicalReviewJSON(second));
  assert.equal(first.reportHash, hash(await readFile(f.reportPath)));
  assert.equal(first.sourceHash, hash(await readFile(f.sourcePath)));
  assert.equal(first.candidates.length, 0);
  assert.ok(first.sources.some(s => s.file === 'audio-synthetic/audio.json'));
  assert.equal(first.cases[0].audioLimitations[0], f.audio.limitations[0]);
  const reviewed = validateReviewSelection(encode(response(first)), first);
  assert.equal(reviewed.status, 'no-selection-not-an-accuracy-pass');
  assert.equal(reviewed.accuracyVerdict, 'not-assessed');
  assert.equal(reviewed.humanReviewRequired, true);
  assert.match(reviewed.limitations.join(), /not transcription/);
});

const mutations = [
  ['stale phase speech', a => { a.events[1].state = { ...state, phase: 1, movement: 'glute-bridge' }; }, /current exercise phase/],
  ['stale sentence segment', a => { a.events[2].state = { ...state, phase: 1 }; }, /abandoned exercise phase/],
  ['expired speech', a => { a.events[1].item.requestedMs = -4000; }, /expiry deadline/],
  ['rapid restart', a => { a.events.push({ ...a.events[1], ms: 500 }); }, /three seconds/],
  ['repetitive variants', a => { for (const ms of [10000, 20000]) a.events.push({ ...a.events[1], ms, item: { ...item, requestedMs: ms, text: `Variant ${ms}` } }); }, /three times within 60 seconds/],
  ['praise conflicts with lost input', a => { a.events[1] = { ...a.events[1], ms: 2000, state: { ...state, observation: { pose: 'lost', since: 0 } } }; }, /Praise begins during sustained lost/],
  ['correction conflicts with recovery', a => { a.events[1] = { ...a.events[1], ms: 3000, item: { ...item, key: 'sag', requestedMs: 3000 } }; }, /correction begins after recovery/],
  ['speech crosses skip', a => { a.events[3].ms = 4000; a.events.push({ type: 'action', action: 'skip', ms: 1000, state }); }, /continues more than one second after Skip/],
  ['overlapping signal', a => { a.levels = [100, 160].flatMap(ms => [2, 3].map(playId => ({ ms, playId, rms: .1 }))); }, /overlapping recorded voices/],
  ['silent capture', a => { a.decoded.rms = 0; }, /non-silent samples/]
];
for (const [name, mutate, expected] of mutations) test(`evidence mutation: ${name} reaches a selectable shared-analyzer candidate`, async t => {
  const f = await fixture(t); mutate(f.audio);
  // Leave the saved passing result intact: the review re-audits its actual evidence.
  await f.json('audio-synthetic/audio.json', f.audio);
  const p = await f.export();
  assert.match(details(p), expected);
  assert.match(details(p), /Saved audio checks\/candidates disagree/);
  const candidate = p.candidates.find(c => expected.test(c.detail));
  assert.ok(candidate.context.includedRows <= REVIEW_LIMITS.contextRows);
  assert.ok(candidate.refs.some(ref => ref.endsWith('audio.json#')));
  const reviewed = validateReviewSelection(encode(response(p, [candidate.id])), p);
  assert.equal(reviewed.status, 'human-review-required');
  assert.equal(reviewed.selectedCandidates[0].id, candidate.id);
  assert.equal(reviewed.accuracyVerdict, 'not-assessed');
});

test('existing saved candidates are deduplicated against the shared re-audit', async t => {
  const a = audioEvidence(); mutations[4][1](a);
  const f = await fixture(t, a), p = await f.export();
  assert.equal(p.candidates.length, 1);
  assert.match(p.candidates[0].detail, /three times within 60 seconds/);
  assert.equal(p.candidates[0].refs.length, 2);
});
test('healthy number repetition is not invented as a concern', async t => {
  const a = audioEvidence(); mutations[4][1](a);
  for (const e of a.events) if (e.item) e.item.key = 'number';
  const f = await fixture(t, a); assert.equal((await f.export()).candidates.length, 0);
});
test('unselected candidates and recognition/TTS gaps remain visible after an empty selection', async t => {
  const f = await fixture(t);
  f.result.coverageGaps = ['Missing ankles remain unrecognized.'];
  f.audio.events.push({ type: 'tts-request', ms: 2000, item, state });
  await f.save(); await f.json('audio-synthetic/audio.json', f.audio);
  const p = await f.export(), reviewed = validateReviewSelection(encode(response(p)), p);
  assert.match(details(p), /Missing ankles/);
  assert.match(details(p), /NOT captured/);
  assert.equal(reviewed.unselectedCandidateIds.length, p.candidates.length);
  assert.equal(reviewed.status, 'no-selection-not-an-accuracy-pass');
});

test('existing scenario runner feeds packaging; a checkpoint mutation exposes a saved false pass', async t => {
  const f = await fixture(t);
  const scenario = validate(JSON.parse(await readFile(new URL('./scenarios/skip-and-dropout.json', import.meta.url))));
  const html = await readFile(process.env.FORM_COACH_TEST_BUILD || new URL('../form-coach-v4.11.html', import.meta.url), 'utf8');
  const engine = await loadEngine(html), frameFor = await fixtures(new URL('./', import.meta.url));
  const adapter = engineAdapter(engine, scenario, frameFor);
  const result = { ...await runTimeline(scenario, adapter), effects: adapter.effects,
    id: 'skip-and-dropout/engine', evidence: 'skip-and-dropout-engine', mode: 'engine', status: 'passed', scenarioHash: hash(JSON.stringify(scenario)) };
  assert.ok(result.checks.every(c => c.pass));
  f.run.results = [result]; f.run.buildHash = hash(html); await f.save();
  await f.json('skip-and-dropout-engine/scenario.json', scenario);
  const healthy = await f.export(); assert.equal(healthy.candidates.length, 0);
  assert.ok(healthy.cases[0].timeline.totalRows > 0);
  // runBrowser compacts movement-case effects with this same shared helper.
  // The saved summary is an object, not the original array; retain its sampling
  // provenance and point to its actual events property.
  result.effects = compactEffects(adapter.effects); await f.save();
  const compact = await f.export(), timeline = compact.cases[0].timeline;
  assert.equal(timeline.originalEffectRows, adapter.effects.length);
  assert.equal(timeline.savedEffectRows, result.effects.events.length);
  assert.equal(timeline.sampling, result.effects.sampling);
  assert.match(timeline.source, /#\/effects\/events$/);
  assert.deepEqual(timeline.rows, healthy.cases[0].timeline.rows);
  const point = result.checkpoints.find(p => scenario.steps[p.step].path === 'scoreN');
  point.state.scoreN = 7; await f.save();
  const bad = await f.export();
  assert.match(details(bad), /Saved assertion disagrees/);
  assert.match(details(bad), /No body produces no measured frames/);
  assert.equal(bad.candidates.find(c => c.detail === 'No body produces no measured frames').actual, 7);
  assert.notEqual(healthy.reportHash, bad.reportHash);
});

for (const [name, effects] of [
  ['null', null], ['scalar', 'summary'], ['missing summary fields', {events:[]}],
  ['unknown summary fields', {sampling:'sampled',total:0,events:[],unknown:true}],
  ['non-array events', {sampling:'sampled',total:1,events:{t:'say'}}],
  ['negative total', {sampling:'sampled',total:-1,events:[]}],
  ['fractional total', {sampling:'sampled',total:.5,events:[]}],
  ['total below saved count', {sampling:'sampled',total:0,events:[{t:'say'}]}],
  ['missing sampling policy', {sampling:'',total:0,events:[]}],
  ['malformed array row', [null]], ['malformed summary row', {sampling:'sampled',total:1,events:[{}]}]
]) test(`saved effects reject ${name} instead of silently ignoring unknown shapes`, async t => {
  const f = await fixture(t); f.result.effects = effects; await f.save();
  await assert.rejects(f.export(), /AI review: invalid saved effect|AI review: invalid saved effects summary/);
});

for (const [name, mutate] of [
  ['unknown ID', r => { r.selectedCandidateIds = ['review-' + 'a'.repeat(64)]; }],
  ['case ID instead of candidate ID', r => { r.selectedCandidateIds = ['audio/synthetic']; }],
  ['non-string ID', r => { r.selectedCandidateIds = [null]; }],
  ['extra prose', r => { r.reason = 'Change the golden result.'; }],
  ['extra pass verdict', r => { r.accuracyPass = true; }],
  ['missing IDs', r => { delete r.selectedCandidateIds; }],
  ['wrong schema', r => { r.schema = 'ai-review-selection/2'; }],
  ['stale report', r => { r.reportHash = 'b'.repeat(64); }],
  ['stale evidence', r => { r.evidenceHash = 'b'.repeat(64); }],
  ['non-array IDs', r => { r.selectedCandidateIds = {}; }],
  ['excess selections', r => { r.selectedCandidateIds = Array(9).fill('review-' + 'a'.repeat(64)); }]
]) test(`adversarial selection rejects ${name}`, async t => {
  const f = await fixture(t), p = await f.export(), r = response(p); mutate(r);
  assert.throws(() => validateReviewSelection(encode(r), p), /AI review:/);
});
test('duplicate approved IDs reject the whole selection and selection order is ranking', async t => {
  const f = await fixture(t);
  f.result.coverageGaps = ['Gap one.', 'Gap two.']; await f.save();
  const p = await f.export(), ids = p.candidates.map(c => c.id);
  assert.throws(() => validateReviewSelection(encode(response(p, [ids[0], ids[0]])), p), /duplicate/);
  const selected = ids.toReversed();
  assert.deepEqual(validateReviewSelection(encode(response(p, selected)), p).selectedCandidateIds, selected);
});
for (const raw of ['{"a":1,"a":2}', '{"a":1,"\\u0061":2}', '{"a":{"b":1,"b":2}}', '{"a":NaN}', '[] trailing', '```json\n{}\n```', '['.repeat(42) + '0' + ']'.repeat(42)])
  test(`strict result JSON rejects ${raw.slice(0, 40)}`, () => assert.throws(() => parseReviewJSON(raw)));
test('strict JSON accepts escaped strings and ordinary JSON primitives', () => {
  const v = { text: 'x"\\\n', array: [false, null, -1.23e4, {}] };
  assert.deepEqual(parseReviewJSON(encode(v)), v);
  assert.throws(() => parseReviewJSON(' '.repeat(REVIEW_LIMITS.responseBytes) + '{}'), /byte limit/);
});

test('source receipts require every explicit synthetic input assertion', () => {
  for (const key of Object.keys(synthetic)) {
    const missing = { ...synthetic }; delete missing[key];
    assert.throws(() => syntheticReviewSource('report', missing));
  }
  for (const change of [{ recording: true }, { landmarks: true }, { inputKind: 'private' }, { scenarioSource: 'external-file' }])
    assert.throws(() => syntheticReviewSource('report', { ...synthetic, ...change }), /synthetic/);
});
for (const [name, mutate, expected] of [
  ['running report', f => { f.run.status = 'running'; }, /finalized/],
  ['historical report without origin', f => { delete f.run.origin; }, /origin/],
  ['human report', f => { f.run.origin = 'recording'; }, /origin/],
  ['duplicate cases', f => { f.run.results.push(f.result); }, /duplicate case/],
  ['recording provenance', f => { f.result.recordingHash = 'a'.repeat(64); }, /excluded/],
  ['actual video result', f => { f.result.mode = 'video'; }, /excluded/],
  ['directory traversal', f => { f.result.evidence = '../escape'; }, /invalid evidence/],
  ['absolute path', f => { f.result.evidence = '/tmp/escape'; }, /invalid evidence/],
  ['unknown mode', f => { f.result.mode = 'diagnostics'; }, /unsupported/]
]) test(`source gate rejects ${name}`, async t => {
  const f = await fixture(t); mutate(f);
  // Do not let the fixture writer traverse a malicious evidence path either.
  await f.json('report.json', f.run); await f.receipt();
  await assert.rejects(f.export(), expected);
});
test('blocked missing video remains a gap without loading media', async t => {
  const f = await fixture(t);
  f.run.results.push({ id: 'test/video', mode: 'video', status: 'blocked', reason: 'No consented recording supplied.' });
  await f.save(); assert.match(details(await f.export()), /No consented recording/);
});
test('existing landmark replay is refused without parsing its contents', async t => {
  const f = await fixture(t);
  await writeFile(resolve(f.dir, 'audio-synthetic/landmarks.json'), 'not JSON / private sentinel');
  await assert.rejects(f.export(), /landmark replay is excluded/);
});
test('case artifact symlinks and directory symlinks are refused', async t => {
  const f = await fixture(t);
  await rm(resolve(f.dir, 'audio-synthetic/audio.json'));
  await symlink(f.sourcePath, resolve(f.dir, 'audio-synthetic/audio.json'));
  await assert.rejects(f.export(), /symlink/);
  await symlink(resolve(f.dir, 'audio-synthetic'), resolve(f.dir, 'linked-case'));
  f.result.evidence = 'linked-case'; await f.json('report.json', f.run); await f.receipt();
  await assert.rejects(f.export(), /escapes/);
});
test('saved case result and scenario hashes cannot drift from the report', async t => {
  const f = await fixture(t);
  await f.json('audio-synthetic/result.json', { ...f.result, status: 'failed' });
  await assert.rejects(f.export(), /stale case result/);
  f.result.scenarioHash = 'c'.repeat(64); await f.save();
  await assert.rejects(f.export(), /stale scenario/);
});
test('oversized audio timeline fails closed before running the analyzer', async t => {
  const f = await fixture(t);
  f.audio.events = Array(REVIEW_LIMITS.audioEvents + 1).fill({ ms: 0, type: 'observation', state });
  await f.json('audio-synthetic/audio.json', f.audio); await assert.rejects(f.export(), /oversized audio events/);
});
test('candidate overflow is rejected, never truncated to a clean review', async t => {
  const f = await fixture(t); f.result.coverageGaps = Array.from({ length: 257 }, (_, i) => `Gap ${i}`);
  await f.save(); await assert.rejects(f.export(), /candidate limit exceeded/);
});

test('JSON CLI export/import roundtrip is read-only and reports no accuracy pass', async t => {
  const f = await fixture(t), before = await readFile(f.reportPath);
  const cli = args => spawnSync(process.execPath, [new URL('./ai-review-cli.mjs', import.meta.url).pathname, ...args], { encoding: 'utf8', timeout: 10000 });
  const paths = ['--report', f.reportPath, '--source', f.sourcePath];
  const exported = cli(['export', ...paths]); assert.equal(exported.status, 0, exported.stderr);
  const p = JSON.parse(exported.stdout); await writeFile(f.packagePath, exported.stdout);
  await f.json('review-selection.json', response(p));
  const imported = cli(['import', ...paths, '--package', f.packagePath, '--response', f.responsePath]);
  assert.equal(imported.status, 0, imported.stderr);
  assert.equal(JSON.parse(imported.stdout).status, 'no-selection-not-an-accuracy-pass');
  assert.deepEqual(await readFile(f.reportPath), before);
  const wrong = cli(['export', ...paths, '--upload', 'https://example.invalid']);
  assert.equal(wrong.status, 1); assert.equal(wrong.stdout, '');
});
test('import rebuilds provenance; changed report, audio, or package invalidates earlier selections', async t => {
  const f = await fixture(t), p = await f.export();
  await f.json('review-evidence.json', p); await f.json('review-selection.json', response(p));
  assert.equal((await f.import()).accuracyVerdict, 'not-assessed');
  f.audio.decoded.rms = 0; await f.json('audio-synthetic/audio.json', f.audio);
  await assert.rejects(f.import(), /stale or altered evidence package/);
  await f.json('audio-synthetic/audio.json', audioEvidence());
  await f.json('review-evidence.json', { ...p, candidates: [{ id: 'invented' }] });
  await assert.rejects(f.import(), /stale or altered evidence package/);
  await f.json('review-evidence.json', p);
  f.run.status = 'failed'; await f.json('report.json', f.run);
  await assert.rejects(f.import(), /stale source receipt/);
  await f.receipt(); await assert.rejects(f.import(), /stale or altered evidence package/);
});

test('in-memory manifest packages exact supplied bytes without consulting case files', async t => {
  const f = await fixture(t), input = await manifestInput(f);
  const first = await buildReviewBundle(input);
  await rm(resolve(f.dir, 'audio-synthetic'), { recursive: true });
  const second = await buildReviewBundle(input);
  assert.deepEqual(second, first);
  assert.equal(second.reportHash, hash(input.reportBytes));
  assert.equal(reviewChoiceRequest(second), null);
});
for (const [name, mutate] of [
  ['stale report bytes', x => { x.reportBytes += ' '; }],
  ['stale artifact bytes', x => { x.manifest.artifacts[0].bytes += ' '; }],
  ['duplicate artifact', x => { x.manifest.artifacts.push(x.manifest.artifacts[0]); }],
  ['external path', x => { x.manifest.artifacts[0].file = '../private/result.json'; }],
  ['private diagnostic path', x => { x.manifest.artifacts[0].file = 'private/result.json'; }],
  ['missing artifact', x => { x.manifest.artifacts.pop(); }],
  ['missing attestation', x => { delete x.syntheticAttestation; }],
  ['extra manifest fields', x => { x.manifest.directory = '/tmp/private'; }],
  ['unused artifact', x => { const bytes = '{}'; x.manifest.artifacts.push({ file: 'extra/events.json', bytes, sha256: hash(bytes) }); }]
]) test(`in-memory manifest rejects ${name}`, async t => {
  const f = await fixture(t), input = await manifestInput(f); mutate(input);
  await assert.rejects(buildReviewBundle(input), /AI review:/);
});
test('native mapping uses exact coach-choice/1 bounds, pages all IDs and binds request identity', async t => {
  const f = await fixture(t); f.result.coverageGaps = Array.from({ length: 30 }, (_, i) => `Gap ${i}. ${'🧪'.repeat(1000)}`); await f.save();
  const p = await buildReviewBundle(await manifestInput(f)), requests = [0, 1].map(page => reviewChoiceRequest(p, { page }));
  assert.equal(reviewChoiceRequest(p, { page: 2 }), null);
  assert.deepEqual(requests.flatMap(r => r.options.map(o => o.id)), p.candidates.map(c => c.id));
  for (const [page, r] of requests.entries()) {
    assert.deepEqual(Object.keys(r).sort(), ['schema', 'requestId', 'purpose', 'query', 'options', 'defaultIds', 'limit'].sort());
    assert.equal(r.schema, 'coach-choice/1'); assert.equal(r.purpose, 'review');
    assert.match(r.requestId, /^[A-Za-z0-9-]{1,80}$/);
    assert.ok(r.query.length <= 500); assert.ok(r.options.length <= 24);
    assert.ok(r.defaultIds.length >= 1 && r.defaultIds.length <= 2); assert.equal(r.limit, 2);
    assert.ok(Buffer.byteLength(canonicalReviewJSON(r)) <= 24 * 1024);
    for (const o of r.options) {
      assert.deepEqual(Object.keys(o).sort(), ['id', 'text', 'title']);
      assert.ok(o.title.trim() && o.title.length <= 100 && o.text.trim() && o.text.length <= 600);
    }
    assert.deepEqual(validateReviewChoice(encode({ choiceIds: r.defaultIds }), p, r.requestId, { page }).selectedCandidateIds, r.defaultIds);
  }
  const [r] = requests;
  for (const choice of [{ choiceIds: [] }, { choiceIds: [r.defaultIds[0], r.defaultIds[0]] },
    { choiceIds: [requests[1].options[0].id] }, { choiceIds: r.defaultIds, prose: 'invented' }])
    assert.throws(() => validateReviewChoice(encode(choice), p, r.requestId), /AI review:/);
  assert.throws(() => validateReviewChoice(encode({ choiceIds: r.defaultIds }), { ...p, evidenceHash: 'd'.repeat(64) }, r.requestId), /stale choice/);
});
test('manifest-only CLI produces a native request and validates choiceIds', async t => {
  const f = await fixture(t); f.result.coverageGaps = ['Synthetic recognition gap']; await f.save();
  const inputPath = resolve(f.dir, 'review-input.json'); await f.json('review-input.json', await manifestInput(f));
  const cli = args => spawnSync(process.execPath, [new URL('./ai-review-cli.mjs', import.meta.url).pathname, ...args], { encoding: 'utf8', timeout: 10000 });
  const request = cli(['choice-request', '--input', inputPath]); assert.equal(request.status, 0, request.stderr);
  const r = JSON.parse(request.stdout); await f.json('choice.json', { choiceIds: r.defaultIds });
  const accepted = cli(['choice-import', '--input', inputPath, '--response', resolve(f.dir, 'choice.json'), '--request-id', r.requestId]);
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(JSON.parse(accepted.stdout).status, 'human-review-required');
});
