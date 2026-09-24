import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, truncate, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { assembleWebRelease, packageHTML, validateVoiceManifest, writeWebRelease, readPublicInput,
  runReleaseTasks, RELEASE_IO_CONCURRENCY, RELEASE_IO_TIMEOUT_MS,
  loadVerifiedArtifact, ARTIFACT_LOAD_TIMEOUT_MS,
  VISION_BASE, MODEL_URL, sha256, MAX_FILE_BYTES } from '../release/web.mjs';

const original = await readFile(process.env.FORM_COACH_TEST_BUILD || new URL('../form-coach-v4.11.html', import.meta.url), 'utf8');
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'formcoach-release-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (name, bytes) => { await mkdir(dirname(join(root, name)), { recursive: true }); await writeFile(join(root, name), bytes); };
  await put('build.html', original);
  await put('node_modules/@mediapipe/tasks-vision/package.json', JSON.stringify({version:'0.10.14',license:'Apache-2.0'}));
  for (const file of ['vision_bundle.mjs', 'wasm/vision_wasm_internal.js', 'wasm/vision_wasm_internal.wasm',
    'wasm/vision_wasm_nosimd_internal.js', 'wasm/vision_wasm_nosimd_internal.wasm'])
    await put(`node_modules/@mediapipe/tasks-vision/${file}`, 'synthetic runtime fixture, not real inference');
  const model = Buffer.from('synthetic model fixture, not exercise validation');
  await put('testing/assets/pose_landmarker_lite.task', model);
  await put('testing/model.json', JSON.stringify({ url:MODEL_URL, sha256:sha256(model) }));
  await put('voice/manifest.json', JSON.stringify(['voice/warm/num/2.mp3']));
  await put('voice/warm/num/2.mp3', 'synthetic clip fixture, not audio');
  for (const file of ['_headers', '404.html', 'REVIEW-NOTICE.txt'])
    await put(`release/${file}`, await readFile(new URL(`../release/${file}`, import.meta.url)));
  return { root, put, build: () => assembleWebRelease({ root, build:'build.html' }) };
}

test('packaging changes resource locations, not the judgement or shell module', () => {
  const packaged = packageHTML(original);
  const module = s => s.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  const restored = module(packaged).replace('./vendor/vision_bundle.mjs', `${VISION_BASE}/vision_bundle.mjs`)
    .replace('./vendor/wasm', `${VISION_BASE}/wasm`).replace('./models/pose_landmarker_lite.task', MODEL_URL);
  assert.equal(restored, module(original));
  assert.doesNotMatch(packaged, /fonts\.google|cdn\.jsdelivr|storage\.googleapis/);
  assert.match(packaged, /noindex,nofollow/);
});
test('changed and ambiguous source boundaries fail instead of best-effort substitution', () => {
  assert.throws(() => packageHTML(original.replace(MODEL_URL, 'different-model')), /boundary/);
  assert.throws(() => packageHTML(original + MODEL_URL), /boundary/);
  assert.throws(() => packageHTML(original.replace('https://fonts.gstatic.com', 'removed')), /Font boundary/);
});
test('voice manifest only permits known persona/tier/token/number MP3 paths', () => {
  for (const path of ['../secret.mp3','voice/warm/num/../../secret.mp3','/voice/warm/num/2.mp3',
    'https://example.com/2.mp3', 'voice/private/num/2.mp3', 'voice/warm/num/2.mp3?token=secret', 'voice/warm/num/2.json'])
    assert.throws(() => validateVoiceManifest([path]));
  assert.throws(() => validateVoiceManifest(['voice/warm/num/2.mp3', 'voice/warm/num/2.mp3']));
  assert.throws(() => validateVoiceManifest([]));
});
test('allowlist excludes secrets, diagnostics, history and unlisted clips', async t => {
  const f = await fixture(t);
  for (const name of ['.env', '.git/config', 'testing/private/user.mov', 'test-results/diagnostic.json',
    'docs/internal.md', 'voice/warm/num/unlisted.mp3']) await f.put(name, 'DO NOT PUBLISH');
  const { files, receipt } = await f.build();
  assert.equal(files.size, 13);
  for (const bytes of files.values()) assert.ok(!bytes.includes('DO NOT PUBLISH'));
  assert.equal(receipt.publicLaunchApproved, false);
  assert.equal(receipt.offlineInstallable, false);
  assert.equal(receipt.voiceClips, 1);
});
test('all output hashes/sizes and input provenance are reproducible', async t => {
  const f = await fixture(t), a = await f.build(), b = await f.build();
  assert.deepEqual(a.receipt, b.receipt);
  assert.equal(a.receipt.sourceHash, sha256(original));
  for (const asset of a.receipt.assets) {
    assert.equal(asset.sha256, sha256(a.files.get(asset.path)));
    assert.equal(asset.bytes, a.files.get(asset.path).length);
  }
});
test('wrong model hash, missing clip and wrong runtime version fail closed', async t => {
  const f = await fixture(t);
  await f.put('testing/assets/pose_landmarker_lite.task', 'changed');
  await assert.rejects(f.build(), /checksum/);
  const g = await fixture(t);
  await rm(join(g.root, 'voice/warm/num/2.mp3'));
  await assert.rejects(g.build(), /ENOENT/);
  const h = await fixture(t);
  await h.put('node_modules/@mediapipe/tasks-vision/package.json', JSON.stringify({version:'latest'}));
  await assert.rejects(h.build(), /Unexpected MediaPipe/);
});
test('symlink file and parent directory cannot publish content through allowed names', async t => {
  const f = await fixture(t);
  await f.put('secret', 'private');
  await rm(join(f.root, 'voice/warm/num/2.mp3'));
  await symlink(join(f.root, 'secret'), join(f.root, 'voice/warm/num/2.mp3'));
  await assert.rejects(f.build(), /Symlink/);
  await symlink(join(f.root, 'voice'), join(f.root, 'alias'));
  await assert.rejects(readPublicInput(f.root, 'alias/manifest.json'), /Symlink/);
  await assert.rejects(readPublicInput(f.root, '../secret'), /Unsafe/);
});
test('oversized assets exceed the static-host budget before reading', async t => {
  const f = await fixture(t);
  await truncate(join(f.root, 'voice/warm/num/2.mp3'), MAX_FILE_BYTES + 1);
  await assert.rejects(f.build(), /file budget/);
});
test('fresh output required; existing directory/files remain untouched', async t => {
  const f = await fixture(t), bundle = await f.build();
  const dest = join(f.root, 'output');
  await writeWebRelease(bundle, dest);
  assert.ok((await readdir(dest)).includes('release.json'));
  await f.put('output/keep.txt', 'user-owned');
  await assert.rejects(writeWebRelease(bundle, dest), /EEXIST/);
  assert.equal(await readFile(join(dest, 'keep.txt'), 'utf8'), 'user-owned');
});

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = () => new Promise(resolve => setImmediate(resolve));

test('rolling I/O refills a free slot while an earlier file stalls, stays bounded and retains order', async () => {
  const names = Array.from({ length: RELEASE_IO_CONCURRENCY + 3 }, (_, i) => `clip-${i}`);
  const gates = names.map(deferred), started = [];
  let active = 0, peak = 0;
  const pending = runReleaseTasks(names, async name => {
    const index = names.indexOf(name);
    started.push(name); peak = Math.max(peak, ++active);
    await gates[index].promise;
    active--;
    return name;
  });
  assert.equal(started.length, RELEASE_IO_CONCURRENCY);
  // Leave the first file unresolved. The free slot must move through later
  // files without waiting for that file (the old batch-of-four barrier).
  gates[1].resolve(); await flush();
  assert.equal(started.length, RELEASE_IO_CONCURRENCY + 1);
  gates[RELEASE_IO_CONCURRENCY].resolve(); await flush();
  assert.equal(started.length, RELEASE_IO_CONCURRENCY + 2);
  gates.forEach(gate => gate.resolve());
  assert.deepEqual(await pending, names);
  assert.equal(peak, RELEASE_IO_CONCURRENCY);
  assert.equal(active, 0);
});

test('first I/O error aborts peers, stops queued work and does not restart after late completions', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const gates = Array.from({ length: 12 }, deferred), started = [], signals = [], progress = [];
  const failure = new Error('fixture read failure');
  const pending = runReleaseTasks(gates.map((_, i) => String(i)), async (name, { signal }) => {
    started.push(name); signals.push(signal);
    return gates[Number(name)].promise;
  }, { progress: line => progress.push(line) });
  const rejection = assert.rejects(pending, error => error === failure);
  gates[0].reject(failure);
  await rejection;
  assert.equal(started.length, RELEASE_IO_CONCURRENCY);
  assert.ok(signals.every(signal => signal.aborted));
  const messages = progress.length;
  gates[1].reject(new Error('late failure'));
  gates.slice(2).forEach(gate => gate.resolve());
  await flush();
  t.mock.timers.tick(RELEASE_IO_TIMEOUT_MS * 2);
  assert.equal(started.length, RELEASE_IO_CONCURRENCY);
  assert.equal(progress.length, messages);
});

test('I/O deadline identifies a stuck path/stage, emits live progress and rejects unabortable work', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const progress = [], signals = [], late = deferred();
  const pending = runReleaseTasks(['voice/warm/num/2.mp3', 'queued.mp3'], async (name, { signal, stage }) => {
    signals.push(signal); stage('read bytes');
    return late.promise;
  }, { concurrency: 1, progress: line => progress.push(line), label: 'Clip reads' });
  const rejection = assert.rejects(pending, error => {
    assert.match(error.message, /timed out after 30s: voice\/warm\/num\/2.mp3 \(read bytes\)/);
    assert.match(error.message, /Clip reads: 0\/2/);
    assert.match(error.message, /No automatic retry/);
    return true;
  });
  t.mock.timers.tick(5000);
  assert.equal(progress.length, 2);
  assert.match(progress[1], /oldest: voice\/warm\/num\/2.mp3 \(read bytes/);
  t.mock.timers.tick(RELEASE_IO_TIMEOUT_MS - 5000);
  await rejection;
  assert.equal(signals.length, 1);
  assert.equal(signals[0].aborted, true);
  const messages = progress.length;
  late.resolve(); await flush();
  t.mock.timers.tick(RELEASE_IO_TIMEOUT_MS);
  assert.equal(progress.length, messages);
  assert.equal(signals.length, 1);
});

test('external cancellation stops admission and pre-aborted reads never touch the filesystem', async () => {
  const controller = new AbortController(), gate = deferred(), started = [];
  const pending = runReleaseTasks(['first', 'queued'], async (name, { signal }) => {
    started.push({ name, signal }); return gate.promise;
  }, { signal: controller.signal, concurrency: 1 });
  const reason = new Error('build cancelled');
  const rejection = assert.rejects(pending, error => error === reason);
  controller.abort(reason);
  await rejection;
  gate.resolve(); await flush();
  assert.deepEqual(started.map(entry => entry.name), ['first']);
  assert.equal(started[0].signal.aborted, true);
  await assert.rejects(readPublicInput('/does-not-exist', 'file', { signal: controller.signal }), error => error === reason);
  await assert.rejects(runReleaseTasks(['another'], () => assert.fail('cancelled work started'),
    { signal: controller.signal }), error => error === reason);
});

test('invalid concurrency/deadlines cannot bypass the fixed I/O bounds', async () => {
  for (const concurrency of [0, -1, 1.5, RELEASE_IO_CONCURRENCY + 1, Infinity])
    await assert.rejects(runReleaseTasks([], () => {}, { concurrency }), /concurrency/);
  for (const timeoutMs of [0, -1, NaN, Infinity, RELEASE_IO_TIMEOUT_MS + 1])
    await assert.rejects(runReleaseTasks([], () => {}, { timeoutMs }), /deadline/);
});

test('many allowlisted clips retain sorted output and identical receipts across concurrent reads', async t => {
  const f = await fixture(t), clips = [];
  for (let i = 0; i < 23; i++) {
    const name = `voice/warm/num/${i}.mp3`;
    clips.unshift(name); await f.put(name, `synthetic clip ${i}`);
  }
  await f.put('voice/manifest.json', JSON.stringify(clips));
  const a = await f.build(), b = await f.build();
  assert.deepEqual(a.receipt, b.receipt);
  assert.deepEqual([...a.files.keys()].filter(name => name.endsWith('.mp3')), [...clips].sort());
  assert.equal(a.receipt.voiceClips, clips.length);
  for (const name of clips) assert.equal(a.receipt.inputs[name], sha256(a.files.get(name)));
});

test('concurrent clip completions still enforce the aggregate 100 MiB budget', async t => {
  const f = await fixture(t), clips = [];
  for (let i = 0; i < 4; i++) {
    const name = `voice/warm/num/${i}.mp3`;
    clips.push(name); await f.put(name, 'synthetic sparse budget fixture');
    await truncate(join(f.root, name), MAX_FILE_BYTES);
  }
  await f.put('voice/manifest.json', JSON.stringify(clips));
  await assert.rejects(f.build(), /100 MiB review budget/);
});

test('failed parallel output leaves no completion receipt and cannot overwrite an existing asset', async t => {
  const f = await fixture(t), bundle = await f.build();
  // Two lexical names resolve to the same output. The exclusive write must
  // reject one rather than overwrite it; the receipt must never be emitted.
  bundle.files.set('voice/warm/num/./2.mp3', Buffer.from('must not replace'));
  const dest = join(f.root, 'partial-output');
  await assert.rejects(writeWebRelease(bundle, dest), /EEXIST/);
  await assert.rejects(readFile(join(dest, 'release.json')), /ENOENT/);
});

test('successful parallel output matches every receipt hash and writes its receipt last', async t => {
  const f = await fixture(t), bundle = await f.build(), dest = join(f.root, 'parallel-output');
  const progress = [];
  await writeWebRelease(bundle, dest, { progress: line => progress.push(line) });
  for (const asset of bundle.receipt.assets)
    assert.equal(sha256(await readFile(join(dest, asset.path))), asset.sha256);
  assert.deepEqual(JSON.parse(await readFile(join(dest, 'release.json'), 'utf8')), bundle.receipt);
  const assetsDone = progress.findIndex(line => /Asset writes: 12\/12/.test(line));
  const receiptStart = progress.findIndex(line => /Receipt write: 0\/1/.test(line));
  assert.ok(assetsDone >= 0 && receiptStart > assetsDone);
});

async function publishedFixture(t) {
  const f = await fixture(t), bundle = await f.build(), dest = join(f.root, 'artifact');
  await writeWebRelease(bundle, dest);
  return { ...f, bundle, dest };
}

test('shared artifact loader verifies the receipt and exposes only hashed allowlisted bytes', async t => {
  const f = await publishedFixture(t);
  await f.put('artifact/private.json', 'DO NOT SERVE');
  const loaded = await loadVerifiedArtifact(f.dest);
  assert.deepEqual(loaded.receipt, f.bundle.receipt);
  assert.deepEqual(loaded.receiptBytes, f.bundle.files.get('release.json'));
  assert.equal(loaded.files.size, f.bundle.files.size);
  assert.equal(loaded.files.has('/private.json'), false);
  for (const [name, bytes] of f.bundle.files) assert.deepEqual(loaded.files.get('/' + name), bytes);
});

test('shared artifact loader rejects changed bytes, missing assets and symlinked artifacts', async t => {
  const f = await publishedFixture(t), clip = 'voice/warm/num/2.mp3';
  const changed = Buffer.from(f.bundle.files.get(clip)); changed[0] ^= 1;
  await writeFile(join(f.dest, clip), changed);
  await assert.rejects(loadVerifiedArtifact(f.dest), /Changed asset/);
  await rm(join(f.dest, clip));
  await assert.rejects(loadVerifiedArtifact(f.dest), /ENOENT/);
  await symlink(join(f.root, clip), join(f.dest, clip));
  await assert.rejects(loadVerifiedArtifact(f.dest), /Symlink/);
  await rm(join(f.dest, 'release.json'));
  await f.put('receipt-copy.json', f.bundle.files.get('release.json'));
  await symlink(join(f.root, 'receipt-copy.json'), join(f.dest, 'release.json'));
  await assert.rejects(loadVerifiedArtifact(f.dest), /Symlink/);
});

test('malformed, duplicate, unallowlisted and over-budget receipt entries cannot expand served files', async t => {
  const f = await publishedFixture(t);
  const cases = [
    [receipt => { receipt.schema = 'unknown'; }, /Invalid release receipt/],
    [receipt => { receipt.assets[0].path = '../secret'; }, /Unapproved voice asset/],
    [receipt => { receipt.assets[0].path = 'private.json'; }, /Unapproved voice asset/],
    [receipt => { receipt.assets[0].path = 'voice/warm/num/./2.mp3'; }, /Unapproved voice asset/],
    [receipt => { receipt.assets.push(receipt.assets[0]); }, /duplicate receipt asset/],
    [receipt => { receipt.assets[0].bytes = MAX_FILE_BYTES + 1; }, /Invalid or duplicate receipt asset/],
    [receipt => { for (const asset of receipt.assets) asset.bytes = MAX_FILE_BYTES; }, /100 MiB/],
    [receipt => { receipt.totalBytes++; }, /inconsistent release receipt/],
    [receipt => { receipt.voiceClips++; }, /inconsistent release receipt/],
    [receipt => { receipt.buildHash = '0'.repeat(64); }, /build\/model hash/],
    [receipt => { receipt.modelHash = '0'.repeat(64); }, /build\/model hash/],
    [receipt => { receipt.assets[0].sha256 = 'invalid'; }, /Invalid or duplicate receipt asset/],
  ];
  for (const [mutate, expected] of cases) {
    const receipt = structuredClone(f.bundle.receipt); mutate(receipt);
    await writeFile(join(f.dest, 'release.json'), JSON.stringify(receipt));
    await assert.rejects(loadVerifiedArtifact(f.dest), expected);
  }
});

test('a rehashed manifest cannot introduce a clip absent from the asset receipt', async t => {
  const f = await publishedFixture(t), name = 'voice/manifest.json';
  const bytes = Buffer.from(JSON.stringify(['voice/warm/num/not-in-receipt.mp3']));
  const receipt = structuredClone(f.bundle.receipt), asset = receipt.assets.find(asset => asset.path === name);
  receipt.totalBytes += bytes.length - asset.bytes;
  asset.bytes = bytes.length; asset.sha256 = sha256(bytes);
  await writeFile(join(f.dest, name), bytes);
  await writeFile(join(f.dest, 'release.json'), JSON.stringify(receipt));
  await assert.rejects(loadVerifiedArtifact(f.dest), /manifest does not match/);
});

test('artifact verification retains a fixed 90-second deadline across read stages', async t => {
  const f = await publishedFixture(t);
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  let callbacks = 0;
  await assert.rejects(loadVerifiedArtifact(f.dest, { progress: () => {
    callbacks++;
    // Each individual file finishes inside its 30s deadline. Time accumulated
    // across the receipt and manifest must still exhaust the whole-load limit.
    t.mock.timers.tick(25_000);
  } }), /Artifact verification exceeded 90 seconds/);
  assert.equal(callbacks, 4);
  t.mock.timers.tick(ARTIFACT_LOAD_TIMEOUT_MS);
  assert.equal(callbacks, 4);
});

test('controlled uneven-latency probe reports batch and rolling timings without a speed threshold', async t => {
  const names = Array.from({ length: 12 }, (_, i) => i);
  const read = async i => {
    await new Promise(resolve => setTimeout(resolve, i % 4 === 0 ? 40 : 2));
    return i;
  };
  const started = performance.now(), batched = [];
  for (let i = 0; i < names.length; i += 4) batched.push(...await Promise.all(names.slice(i, i + 4).map(read)));
  const batchMs = performance.now() - started;
  const rollingStart = performance.now();
  const rolling = await runReleaseTasks(names, read, { concurrency: 4 });
  const rollingMs = performance.now() - rollingStart;
  const eightStart = performance.now();
  const eight = await runReleaseTasks(names, read);
  const eightMs = performance.now() - eightStart;
  assert.deepEqual(batched, names); assert.deepEqual(rolling, names); assert.deepEqual(eight, names);
  t.diagnostic(`Synthetic delayed callbacks, not physical storage: batch-4 ${batchMs.toFixed(1)}ms; ` +
    `rolling-4 ${rollingMs.toFixed(1)}ms; rolling-${RELEASE_IO_CONCURRENCY} ${eightMs.toFixed(1)}ms.`);
});
