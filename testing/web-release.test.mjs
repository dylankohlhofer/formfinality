import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, truncate, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { assembleWebRelease, packageHTML, validateVoiceManifest, writeWebRelease, readPublicInput,
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
