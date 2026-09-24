// Synthetic temp fixtures only: no shipped clips, browsers, network or speakers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256 } from '../release/web.mjs';
import { copyAudioSources as copyReview, sourceReviewDeadline, SOURCE_REVIEW_LIMITS } from './audio-source-review.mjs';

// Most filesystem controls assert individual rows. The envelope is separately
// checked so errors cannot be hidden by callers retaining only successful rows.
const copyAudioSources = async options => (await copyReview(options)).clips;

const warm = 'voice/warm/num/2.mp3', steady = 'voice/steady/num/2.mp3', energy = 'voice/energy/num/2.mp3';
async function fixture(t, entries = [[warm, Buffer.from('synthetic source A')]]) {
  const root = await mkdtemp(join(tmpdir(), 'formfinder-source-review-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [path, bytes] of entries) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes); }
  const manifest = Buffer.from(JSON.stringify(entries.map(([path]) => path)));
  await writeFile(join(root, 'voice/manifest.json'), manifest);
  const target = join(root, 'test-results/capture'); await mkdir(target, { recursive: true });
  return { root, target, caseId: 'fixture-capture', clipHashes: Object.fromEntries(entries.map(([path, bytes]) => [path, sha256(bytes)])), manifestHash: sha256(manifest) };
}
const served = (f, path = warm, overrides = {}) => ({ path: '/' + path, sha256: f.clipHashes[path],
  size: 18, bytes: 18, statusCode: 200, finishedAt: 1790250000000, caseId: f.caseId, ...overrides });
const errorRow = (rows, pattern) => {
  assert.equal(rows.length, 1); assert.equal(rows[0].localPath, null); assert.match(rows[0].error, pattern); return rows[0];
};
test('copies all three requested sources with exact hashes and working file-origin links', async t => {
  const f = await fixture(t, [[warm, Buffer.from('A')], [steady, Buffer.from('B')], [energy, Buffer.from('C')]]);
  const rows = await copyAudioSources({ ...f, paths: [warm, steady, energy],
    transportResponses: [warm, steady, energy].map(path => served(f, path, { size: 1, bytes: 1 })) });
  assert.deepEqual(rows.map(r => r.path), [warm, steady, energy]);
  for (const row of rows) {
    assert.equal(row.error, undefined); assert.equal(row.sha256, f.clipHashes[row.path]); assert.equal(row.bytes, 1);
    assert.equal(row.localPath, `source-clips/${row.sha256}.mp3`);
    assert.equal(row.sourceIdentity, 'saved-after-capture-matches-clipHashes');
    assert.equal(row.transport.status, 'verified-full-response');
    assert.match(row.transport.reason, /does not prove audible/);
    const file = new URL(row.localPath, pathToFileURL(join(f.target, 'audio-review.html')));
    assert.equal(sha256(await readFile(file)), row.sha256);
    assert.deepEqual(await readFile(join(f.root, row.path)), await readFile(file));
    assert.equal(Object.hasOwn(row, 'approved'), false);
  }
});
test('deduplicates requests and identical bytes while retaining each distinct source identity', async t => {
  const bytes = Buffer.from('identical public bytes'), f = await fixture(t, [[warm, bytes], [steady, bytes]]);
  const rows = await copyAudioSources({ ...f, paths: [warm, warm, steady] });
  assert.equal(rows.length, 2); assert.equal(rows[0].localPath, rows[1].localPath);
  assert.equal((await readdir(join(f.target, 'source-clips'))).length, 1);
});
test('existing identical copies are reusable and do not overwrite changed evidence', async t => {
  const f = await fixture(t), [row] = await copyAudioSources(f);
  assert.deepEqual(await copyAudioSources(f), [row]);
  const destination = join(f.target, row.localPath);
  await writeFile(destination, 'tampered evidence');
  errorRow(await copyAudioSources(f), /refusing to overwrite/);
  assert.equal(await readFile(destination, 'utf8'), 'tampered evidence');
});
test('rejects a changed source against its capture hash without copying it', async t => {
  const f = await fixture(t); await writeFile(join(f.root, warm), 'new source');
  const row = errorRow(await copyAudioSources(f), /Stale captured clip hash/);
  assert.equal(row.sha256, sha256('new source')); assert.equal(row.bytes, 10);
  assert.deepEqual(await readdir(join(f.target, 'source-clips')), []);
});
test('missing/unavailable/inherited captured hashes are explicit errors', async t => {
  const f = await fixture(t);
  for (const clipHashes of [{}, { [warm]: 'unavailable: ENOENT' }, { [warm]: 'not-a-hash' }])
    errorRow(await copyAudioSources({ ...f, paths: [warm], clipHashes }), /captured clip hash/);
  assert.match((await copyReview({ ...f, clipHashes: Object.create({ [warm]: f.clipHashes[warm] }) })).errors[0].message, /arguments/);
});
test('complete 200 and whole-file 206 response hashes must all match', async t => {
  const f = await fixture(t);
  const [good] = await copyAudioSources({ ...f, transportResponses: [served(f), served(f, warm, { statusCode: 206, range: { start: 0, end: 17 } })] });
  assert.equal(good.error, undefined); assert.equal(good.transport.fullResponses, 2);
  assert.equal(good.transport.status, 'verified-full-response');
  for (const hash of [sha256('other body'), undefined, [], 'unavailable']) {
    const row = errorRow(await copyAudioSources({ ...f, transportResponses: [served(f), served(f, warm, { sha256: hash })] }), /identity disagrees/);
    assert.equal(row.transport.status, 'mismatch');
  }
  errorRow(await copyAudioSources({ ...f, transportResponses: [served(f, warm, { size: 20, bytes: 20 })] }), /identity disagrees/);
});
test('partial, unfinished and intercepted responses remain unverified, never false hash mismatches', async t => {
  const f = await fixture(t);
  const cases = [[], [served(f, warm, { finishedAt: undefined })],
    [served(f, warm, { bytes: 9 })], [served(f, warm, { statusCode: 206 })],
    [served(f, warm, { statusCode: 404 })], [served(f, warm, { caseId: 'other-capture' })],
    [served(f, warm, { statusCode: 206, range: { start: 0, end: 8 }, bytes: 9, sha256: sha256('partial A') }),
      served(f, warm, { statusCode: 206, range: { start: 9, end: 17 }, bytes: 9, sha256: sha256('partial B') })]];
  for (const transportResponses of cases) {
    const result = await copyReview({ ...f, transportResponses });
    assert.deepEqual(result.errors, []); assert.ok(result.clips[0].localPath);
    assert.equal(result.clips[0].transport.status, 'unverified');
    assert.equal(result.clips[0].sourceIdentity, 'saved-after-capture-matches-clipHashes');
  }
});
test('transport rows cannot borrow another capture or exceed the evidence budget', async t => {
  const f = await fixture(t);
  assert.match((await copyReview({ ...f, caseId: undefined, transportResponses: [served(f)] })).errors[0].message, /caseId required/);
  assert.match((await copyReview({ ...f, transportResponses: [served(f), served(f)], limits: { maxTransportRows: 1 } })).errors[0].message, /row budget/);
});
test('stale manifest, malformed manifest and symlinked manifest yield no source links', async t => {
  const f = await fixture(t);
  errorRow(await copyAudioSources({ ...f, manifestHash: sha256('old manifest') }), /manifest hash/);
  await writeFile(join(f.root, 'voice/manifest.json'), 'not json');
  errorRow(await copyAudioSources({ ...f, manifestHash: undefined }), /JSON|Unexpected/);
  await rm(join(f.root, 'voice/manifest.json'));
  await writeFile(join(f.root, 'manifest-fixture.json'), JSON.stringify([warm]));
  await symlink(join(f.root, 'manifest-fixture.json'), join(f.root, 'voice/manifest.json'));
  errorRow(await copyAudioSources(f), /Symlink/);
});
test('private, unlisted, remote and traversing sources fail visibly; valid siblings still copy', async t => {
  const f = await fixture(t), bad = ['testing/private/user.mp3', 'voice/warm/num/99.mp3',
    '../voice/warm/num/2.mp3', '/private/input.mp3', 'voice/warm/num/../../secret.mp3',
    'https://example.test/audio.mp3', 'voice\\warm\\num\\2.mp3'];
  const rows = await copyAudioSources({ ...f, paths: [...bad, warm], clipHashes: { ...f.clipHashes, ...Object.fromEntries(bad.map(p => [p, sha256('private')])) } });
  assert.ok(rows.slice(0, -1).every(r => r.error && r.localPath === null && r.sha256 === null));
  assert.equal(rows.at(-1).error, undefined); assert.equal((await readdir(join(f.target, 'source-clips'))).length, 1);
});
test('input file and ancestor symlinks cannot smuggle unlisted/private content', async t => {
  const f = await fixture(t); await writeFile(join(f.root, 'private.mp3'), 'personal');
  await rm(join(f.root, warm)); await symlink(join(f.root, 'private.mp3'), join(f.root, warm));
  errorRow(await copyAudioSources({ ...f, clipHashes: { [warm]: sha256('personal') } }), /Symlink/);
  await rm(join(f.root, 'voice/warm/num'), { recursive: true });
  await symlink(f.root, join(f.root, 'voice/warm/num'));
  errorRow(await copyAudioSources(f), /Symlink/);
});
test('output traversal/outside-root targets are rejected before writing', async t => {
  const f = await fixture(t);
  for (const target of [f.root, 'voice', '../escape', '/tmp/outside-audio-evidence', 'test-results/a/../b', 'test-results\\a'])
    assert.match((await copyReview({ ...f, target })).errors[0].message, /target/);
});
test('symlinked output ancestor, source folder and existing evidence file fail without following links', async t => {
  const f = await fixture(t), external = join(f.root, 'outside'); await mkdir(external);
  await symlink(external, join(f.root, 'test-results/alias'));
  errorRow(await copyAudioSources({ ...f, target: 'test-results/alias' }), /symlinked/);
  await symlink(external, join(f.target, 'source-clips'));
  errorRow(await copyAudioSources(f), /symlinked/);
  await rm(join(f.target, 'source-clips')); await mkdir(join(f.target, 'source-clips'));
  await writeFile(join(external, 'victim.mp3'), 'unchanged');
  await symlink(join(external, 'victim.mp3'), join(f.target, 'source-clips', `${f.clipHashes[warm]}.mp3`));
  errorRow(await copyAudioSources(f), /Symlink/);
  assert.equal(await readFile(join(external, 'victim.mp3'), 'utf8'), 'unchanged');
});
test('count/byte limits fail closed and may only be reduced by callers', async t => {
  const f = await fixture(t, [[warm, Buffer.from('123456')], [steady, Buffer.from('abcdef')]]);
  assert.match((await copyReview({ ...f, limits: { maxClips: 1 } })).errors[0].message, /count budget/);
  assert.match((await copyReview({ ...f, limits: { maxRequests: 1 } })).errors[0].message, /request list/);
  assert.match((await copyReview({ ...f, limits: { maxClips: SOURCE_REVIEW_LIMITS.maxClips + 1 } })).errors[0].message, /Invalid/);
  assert.match((await copyReview({ ...f, limits: { madeUp: 1 } })).errors[0].message, /Unknown/);
  const overFile = await copyAudioSources({ ...f, limits: { maxClipBytes: 5 } });
  assert.equal(overFile.length, 2); assert.ok(overFile.every(r => r.error && !r.localPath));
  const overTotal = await copyAudioSources({ ...f, limits: { maxTotalBytes: 10 } });
  assert.ok(overTotal[0].localPath); assert.match(overTotal[1].error, /byte budget/);
});
test('missing source has an error row and unavailable hash, not a fabricated match', async t => {
  const f = await fixture(t); await rm(join(f.root, warm));
  const row = errorRow(await copyAudioSources(f), /ENOENT/);
  assert.equal(row.sha256, null); assert.equal(row.bytes, null);
});
test('parent cancellation retains all requested rows without new writes', async t => {
  const f = await fixture(t), c = new AbortController(); c.abort(new Error('Capture cancelled'));
  errorRow(await copyAudioSources({ ...f, signal: c.signal }), /Capture cancelled/);
  assert.deepEqual(await readdir(f.target), []);
});
test('hung I/O has a real deadline and aborts its operation signal', async () => {
  let signal, expired;
  await assert.rejects(sourceReviewDeadline(s => { signal = s; return new Promise(() => {}); },
    { timeoutMs: 10, label: 'Source fixture', onTimeout: e => { expired = e; } }), /Source fixture timed out/);
  assert.equal(signal.aborted, true); assert.ok(expired);
});
test('empty request list is a no-op, not an implicit whole-library copy', async t => {
  const f = await fixture(t);
  assert.deepEqual(await copyAudioSources({ ...f, paths: [] }), []);
  assert.deepEqual(await readdir(f.target), []);
});
test('error envelope preserves capture integration and makes each file failure visible', async t => {
  const f = await fixture(t); await rm(join(f.root, warm));
  const failed = await copyReview(f);
  assert.equal(failed.status, 'incomplete'); assert.equal(failed.clips.length, 1);
  assert.deepEqual(failed.errors, [{ path: warm, message: failed.clips[0].error }]);
  assert.match(failed.sourceMeaning, /saved after capture/);
  for (const invalid of [undefined, null, {}, { paths: ['private/input.mp3'] }]) {
    const result = await copyReview(invalid);
    assert.equal(result.status, 'incomplete'); assert.ok(result.errors.length);
  }
});
