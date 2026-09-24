// Fast, deterministic controls only. This suite never launches a browser, reads
// the voice library, records audio or contacts a service. The optional CLI runs
// these signal policies against actual Chromium decoding separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readPublicInput, sha256 } from '../release/web.mjs';
import { POLICY, measurePCM, inspectMP3, signalCandidates, intendedScripts, listeningOrder,
  isPilot, deadline, screenLibrary, toneWav, decoderControls, auditPage } from './voice-audit.mjs';

const path = 'voice/warm/num/2.mp3';
const pcm = (value, n = 8000) => new Float32Array(n).fill(value);
const measure = values => measurePCM([values], 8000);
// Independent, fixed MPEG-1 Layer III 128kbps/44.1kHz header: frame = 417 bytes.
// Zero payloads are ONLY parser fixtures, not evidence of decodable MP3 audio.
function frames(n = 3) {
  return Buffer.concat(Array.from({ length: n }, () => {
    const frame = Buffer.alloc(417); frame.set([0xff, 0xfb, 0x90, 0x00]); return frame;
  }));
}
const healthy = () => {
  const samples = pcm(0); samples.fill(.25, 800, 7200); return measure(samples);
};
const fixture = () => ({ names: [path], scripts: intendedScripts([{ path, text: '2' }], [path]).mapping,
  read: async () => frames(), decode: async () => healthy(),
  save: async (_, i, hash) => `clips/${i}-${hash}.mp3` });

test('measures all PCM samples with independent duration, power, clipping and silence expectations', () => {
  const m = healthy();
  assert.equal(m.seconds, 1); assert.equal(m.frames, 8000); assert.equal(m.peak, .25);
  assert.ok(Math.abs(m.rms - Math.sqrt(.8 * .25 ** 2)) < 1e-8);
  assert.equal(m.leadingSilenceSeconds, .1); assert.equal(m.trailingSilenceSeconds, .1);
  assert.equal(m.silenceFraction, .2); assert.equal(m.clippedSamples, 0);
  assert.deepEqual(signalCandidates(m), []);
});
test('independently muted, quiet, clipped and shortened PCM trigger different policies', () => {
  assert.ok(signalCandidates(measure(pcm(0))).includes('silent-signal'));
  assert.ok(signalCandidates(measure(pcm(.002))).includes('quiet-signal'));
  const clipped = measure(pcm(1)); assert.equal(clipped.clippedSamples, 8000);
  assert.ok(signalCandidates(clipped).includes('near-full-scale-samples'));
  assert.ok(signalCandidates(measure(pcm(.1, 400))).includes('very-short-clip'));
});
test('silence windows are measured at both ends and within a clip', () => {
  const samples = pcm(0, 32000); samples.fill(.25, 8000, 12000); samples.fill(.25, 20000, 24000);
  const m = measure(samples);
  assert.equal(m.leadingSilenceSeconds, 1); assert.equal(m.trailingSilenceSeconds, 1);
  assert.equal(m.longestInternalSilenceSeconds, 1); assert.equal(m.silenceFraction, .75);
  for (const flag of ['long-leading-silence', 'long-trailing-silence', 'long-internal-silence'])
    assert.ok(signalCandidates(m).includes(flag));
});
test('opposite-polarity stereo cannot cancel into false silence', () => {
  const m = measurePCM([pcm(.25), pcm(-.25)], 8000);
  assert.equal(m.rms, .25); assert.equal(m.silenceFraction, 0);
  assert.deepEqual(m.channelRms, [.25, .25]);
});
test('abrupt cut through active samples remains a candidate, never a truncation diagnosis', () => {
  const samples = pcm(0); samples.fill(.2, 4000);
  const m = measure(samples);
  assert.equal(m.startPeak, 0); assert.ok(m.endPeak > .19);
  assert.ok(signalCandidates(m).includes('abrupt-boundary-candidate'));
});
test('rejects non-finite, absent, mismatched and over-budget PCM', () => {
  for (const channels of [[], [pcm(0, 0)], [pcm(.1), pcm(.1, 4)], [Float32Array.of(NaN)], [Float32Array.of(Infinity)]])
    assert.throws(() => measurePCM(channels, 8000), /Invalid|Non-finite/);
  assert.throws(() => measurePCM([pcm(.1)], NaN), /Invalid/);
  assert.throws(() => measurePCM([pcm(.1, 8001)], 8000, { ...POLICY, maxSeconds: 1 }), /budget/);
  assert.throws(() => signalCandidates({ seconds: 1, rms: NaN }), /Missing/);
});
test('independent MP3 framing control and final-frame truncation mutation', () => {
  const original = frames(3), full = inspectMP3(original);
  assert.equal(full.frames, 3); assert.deepEqual(full.issues, []);
  assert.ok(Math.abs(full.seconds - 3 * 1152 / 44100) < 1e-12);
  const truncated = inspectMP3(original.subarray(0, original.length - 20));
  assert.equal(truncated.frames, 2); assert.deepEqual(truncated.issues, ['truncated-mp3-frame']);
  assert.deepEqual(inspectMP3(Buffer.from('corrupt')).issues, ['unrecognised-mp3-bytes', 'no-complete-mp3-frames']);
});
test('ID3 metadata is bounded and cannot hide a missing audio payload', () => {
  const tag = Buffer.from([73,68,51,4,0,0,0,0,0,2,10,10]);
  assert.equal(inspectMP3(Buffer.concat([tag, frames()])).frames, 3);
  assert.deepEqual(inspectMP3(tag.subarray(0, 11)).issues, ['truncated-id3']);
  assert.deepEqual(inspectMP3(tag).issues, ['no-complete-mp3-frames']);
  const invalid = Buffer.from(tag); invalid[6] = 255;
  assert.deepEqual(inspectMP3(invalid).issues, ['invalid-id3']);
});
test('Xing advertised frame count catches loss of whole frames when metadata survives', () => {
  const bytes = frames(5); bytes.write('Xing', 36); bytes.writeUInt32BE(1, 40); bytes.writeUInt32BE(5, 44);
  assert.deepEqual(inspectMP3(bytes).issues, []);
  assert.deepEqual(inspectMP3(bytes.subarray(0, 417 * 2)).issues, ['mp3-frame-count-mismatch']);
});
test('intended script maps include hashes, expose missing/extra mappings and reject ambiguity', () => {
  const unknown = 'voice/warm/num/3.mp3';
  const mapped = intendedScripts([{ path, text: '2' }, { path: unknown, text: '3' }], [path, 'voice/steady/num/2.mp3']);
  assert.equal(mapped.mapping.get(path).sha256, sha256('2'));
  assert.match(mapped.mapping.get(path).kind, /not transcription/);
  assert.equal(mapped.issues.length, 2);
  assert.throws(() => intendedScripts([{ path, text: '2' }, { path, text: '3' }], [path]), /Ambiguous/);
  assert.throws(() => intendedScripts([{ path, text: '' }], [path]), /Malformed/);
});
test('Warm 2, all other 2s, then exactly 60 pilot clips precede the remaining queue', () => {
  const rows = ['steady', 'energy', 'warm'].flatMap(v => Array.from({ length: 120 }, (_, i) => ({
    path: `voice/${v}/num/${i + 1}.mp3`, candidates: i === 100 ? ['silent-signal'] : [] })));
  const ordered = listeningOrder(rows);
  assert.equal(ordered[0].path, path);
  assert.ok(ordered.slice(0, 3).every(r => r.path.endsWith('/2.mp3')));
  assert.equal(ordered.filter(r => isPilot(r.path)).length, 60);
  assert.ok(ordered.slice(0, 60).every(r => isPilot(r.path)));
  assert.ok(ordered.slice(60, 63).every(r => r.candidates.length === 1));
});
test('full fixture scan hashes exact source bytes and intended text but never grants approval', async () => {
  const saved = [];
  const rows = await screenLibrary({ ...fixture(), save: async (bytes, i, hash) => {
    saved.push(bytes); return `clips/${i}-${hash}.mp3`;
  } });
  assert.equal(rows.length, 1); assert.equal(rows[0].sha256, sha256(saved[0]));
  assert.equal(rows[0].status, 'screened-unreviewed'); assert.equal(rows[0].pronunciation, 'unreviewed');
  assert.equal(rows[0].intended.text, '2'); assert.equal(rows[0].bytes, 1251);
});
test('source corruption, silence and truncated-container mutations survive decoding decisions', async () => {
  const corrupt = await screenLibrary({ ...fixture(), read: async () => Buffer.from('corrupt'),
    decode: async () => { throw new Error('Decode failed'); } });
  assert.equal(corrupt[0].status, 'screening-error'); assert.match(corrupt[0].error, /Decode/);
  assert.ok(corrupt[0].source, 'Corrupt original remains available for inspection');
  assert.ok(corrupt[0].sha256);
  const silent = await screenLibrary({ ...fixture(), decode: async () => measure(pcm(0)) });
  assert.ok(silent[0].candidates.includes('silent-signal')); assert.equal(silent[0].status, 'machine-candidate');
  const truncated = await screenLibrary({ ...fixture(), read: async () => frames().subarray(0, 1200) });
  assert.ok(truncated[0].candidates.includes('truncated-mp3-frame'));
  assert.equal(truncated[0].status, 'machine-candidate', 'A tolerant decoder does not erase structure evidence');
});
test('wrong-number intended metadata is detected; wrong spoken words are explicitly unverified', async () => {
  const wrongMapping = await screenLibrary({ ...fixture(), scripts: intendedScripts([{ path, text: '3' }], [path]).mapping });
  assert.ok(wrongMapping[0].candidates.includes('number-script-mismatch'));
  // Identical signal with another intended label says nothing about actual words.
  // There is no recognizer or human approval mechanism to falsely certify it.
  for (const text of ['2', '3']) {
    const [row] = await screenLibrary({ ...fixture(), scripts: intendedScripts([{ path, text }], [path]).mapping });
    assert.equal(row.pronunciation, 'unreviewed'); assert.notEqual(row.status, 'approved');
  }
});
test('read/write failures and cancelled work each retain an explicit per-file error', async () => {
  for (const field of ['read', 'save']) {
    const [row] = await screenLibrary({ ...fixture(), [field]: async () => { throw new Error(`${field} unavailable`); } });
    assert.equal(row.status, 'screening-error'); assert.match(row.error, /unavailable/);
  }
  const controller = new AbortController(); controller.abort(new Error('Run deadline'));
  const rows = await screenLibrary({ ...fixture(), names: [path, 'voice/steady/num/2.mp3'], signal: controller.signal,
    read: () => { throw new Error('Must not read after cancellation'); } });
  assert.equal(rows.length, 2); assert.ok(rows.every(r => r.error === 'Run deadline'));
});
test('bounded concurrency reads pilot first and retains every manifest row', async () => {
  const names = [path, 'voice/warm/num/100.mp3', 'voice/energy/num/2.mp3', 'voice/steady/num/3.mp3'];
  const seen = []; let active = 0, peak = 0;
  const rows = await screenLibrary({ ...fixture(), names, read: async name => {
    active++; peak = Math.max(peak, active); seen.push(name);
    await new Promise(r => setImmediate(r)); active--; return frames();
  } });
  assert.equal(seen[0], path); assert.equal(seen.at(-1), 'voice/warm/num/100.mp3');
  assert.ok(peak <= POLICY.concurrency); assert.equal(rows.length, names.length);
  assert.ok(rows.some(r => r.candidates.includes('missing-intended-wording')));
});
test('deadline rejects a hung operation, aborts its signal, and preserves parent cancellation', async () => {
  let signal, timeout;
  await assert.rejects(deadline(s => { signal = s; return new Promise(() => {}); }, 10,
    { label: 'Fixture read', onTimeout: e => { timeout = e; } }), /Fixture read timed out/);
  assert.equal(signal.aborted, true); assert.ok(timeout);
  const c = new AbortController();
  const operation = deadline(() => new Promise(() => {}), 1000, { signal: c.signal });
  c.abort(new Error('Parent stop')); await assert.rejects(operation, /Parent stop/);
});
test('rejects path traversal, non-voice paths and duplicates before any input read', async () => {
  for (const names of [['../private.mp3'], ['voice/warm/num/../../secret.mp3'], ['file:///private.mp3'], [path, path]])
    await assert.rejects(screenLibrary({ ...fixture(), names, read: () => { throw Error('Read attempted'); } }), /manifest|path/);
});
test('the reused public reader rejects file and directory symlinks in allowlisted paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'formfinder-voice-audit-'));
  try {
    await mkdir(join(root, 'voice/warm/num'), { recursive: true });
    await writeFile(join(root, 'fixture.mp3'), frames());
    await symlink(join(root, 'fixture.mp3'), join(root, path));
    await assert.rejects(readPublicInput(root, path), /Symlink/);
    await symlink(join(root, 'voice/warm'), join(root, 'voice/steady'));
    await assert.rejects(readPublicInput(root, 'voice/steady/num/2.mp3'), /Symlink/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

// A tiny independent WAV PCM16 fixture decoder exercises control expectations
// without Chromium. Production audit calls real decodeAudioData for these same
// bytes; this fixture parser is not evidence that Chromium decoding has passed.
function decodeFixtureWav(bytes) {
  if (bytes.subarray(0, 4).toString() !== 'RIFF') throw Error('Invalid fixture encoding');
  const samples = Float32Array.from({ length: Math.floor((bytes.length - 44) / 2) }, (_, i) => bytes.readInt16LE(44 + i * 2) / 32768);
  return measurePCM([samples], bytes.readUInt32LE(24));
}
test('decoder controls accept a healthy decoder contract and catch independent bad implementations', async () => {
  assert.ok((await decoderControls(decodeFixtureWav)).every(c => c.pass));
  const permissive = await decoderControls(() => decodeFixtureWav(toneWav()));
  assert.deepEqual(permissive.filter(c => !c.pass).map(c => c.name),
    ['independent digital silence', 'corrupt encoded bytes', 'truncated WAV payload']);
  assert.ok((await decoderControls(() => { throw Error('Unavailable'); })).some(c => !c.pass));
});
test('rendered queue cannot turn injected approvals or changed wording into listening sign-off', () => {
  const row = { path, sha256: sha256('original'), source: `clips/0-${sha256('original')}.mp3`,
    status: 'screened-unreviewed', pronunciation: 'approved', approved: true, candidates: [],
    intended: { text: '<script>alert(1)</script>', sha256: sha256('changed wording') } };
  const html = auditPage({ status: 'screened', scope: 'fixture', clips: [row], counts: { approved: 0 }, gaps: [] });
  assert.match(html, /Pronunciation: unreviewed/); assert.match(html, /No approval controls/);
  assert.match(html, /not transcription/); assert.match(html, /Machine analysis ≠ pronunciation validation/);
  assert.ok(!html.includes('<script>')); assert.match(html, /preload="none"/);
  assert.match(html, /&lt;script&gt;/);
  assert.ok(!auditPage({ clips: [{ ...row, source: 'https://example.test/clip.mp3' }] }).includes('src="https:'));
});
test('listening links resolve from a file-origin report to the exact saved source bytes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'formfinder-voice-listen-'));
  try {
    await mkdir(join(dir, 'clips'));
    const rows = await screenLibrary({ ...fixture(), save: async (bytes, i, hash) => {
      const name = `clips/${i}-${hash}.mp3`; await writeFile(join(dir, name), bytes); return name;
    } });
    const html = auditPage({ clips: rows });
    const source = html.match(/<audio[^>]*src="([^"]+)"/)[1];
    const file = new URL(source, pathToFileURL(join(dir, 'index.html')));
    assert.equal(file.protocol, 'file:');
    assert.equal(sha256(await readFile(file)), rows[0].sha256);
    assert.match(html, /media-src 'self' file:/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
