#!/usr/bin/env node
// Development only. Reads the active public voice allowlist; never the app's
// private recordings. Measurements nominate listening candidates, not approvals.
import { mkdir, lstat, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPublicInput, validateVoiceManifest, sha256 } from '../release/web.mjs';
import { escape } from './report.mjs';

export const POLICY = Object.freeze({ windowSeconds: .01, silenceRms: .001,
  silentRms: .0001, quietRms: .003, clipAmplitude: .999, clipFraction: .001,
  longSilenceSeconds: .75, shortSeconds: .12, edgePeak: .03,
  maxSeconds: 120, maxChannels: 2, maxClipBytes: 2 * 1024 * 1024,
  maxLibraryBytes: 100 * 1024 * 1024, ioTimeoutMs: 30_000,
  decodeTimeoutMs: 15_000, runTimeoutMs: 600_000, concurrency: 2 });

// Shared verbatim with Chromium. No downsampling, channel mixing, expected words
// or decoder metadata standing in for samples. Silence means below this policy's
// window-RMS threshold, not a linguistic determination of speech boundaries.
export function measurePCM(channels, sampleRate, p = POLICY) {
  const frames = channels?.[0]?.length;
  if (!Array.isArray(channels) || !channels.length || channels.length > p.maxChannels ||
      !Number.isInteger(frames) || frames < 1 || channels.some(c => c.length !== frames) ||
      !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000 || frames / sampleRate > p.maxSeconds)
    throw new Error('Invalid or over-budget decoded PCM');
  const step = Math.max(1, Math.round(sampleRate * p.windowSeconds));
  const powers = channels.map(() => 0);
  let sum = 0, peak = 0, clipped = 0, silentFrames = 0, first = null, last = null;
  let silentRun = 0, longestInternal = 0, startPeak = 0, endPeak = 0;
  for (let offset = 0; offset < frames; offset += step) {
    const end = Math.min(frames, offset + step), count = end - offset;
    let windowRms = 0;
    for (let ch = 0; ch < channels.length; ch++) {
      let power = 0;
      for (let i = offset; i < end; i++) {
        const v = channels[ch][i];
        if (!Number.isFinite(v)) throw new Error('Non-finite decoded sample');
        const a = Math.abs(v); power += v * v; peak = Math.max(peak, a);
        if (a >= p.clipAmplitude) clipped++;
        if (i < sampleRate * .005) startPeak = Math.max(startPeak, a);
        if (i >= frames - sampleRate * .005) endPeak = Math.max(endPeak, a);
      }
      powers[ch] += power; sum += power;
      windowRms = Math.max(windowRms, Math.sqrt(power / count));
    }
    if (windowRms < p.silenceRms) { silentFrames += count; silentRun += count; }
    else {
      if (first !== null) longestInternal = Math.max(longestInternal, silentRun);
      first ??= offset; last = end; silentRun = 0;
    }
  }
  const seconds = frames / sampleRate, rms = Math.sqrt(sum / (frames * channels.length));
  return { seconds, sampleRate, frames, channels: channels.length, rms, peak,
    rmsDbFS: rms ? 20 * Math.log10(rms) : null,
    channelRms: powers.map(power => Math.sqrt(power / frames)),
    clippedSamples: clipped, clippedFraction: clipped / (frames * channels.length),
    silenceFraction: silentFrames / frames,
    leadingSilenceSeconds: (first ?? frames) / sampleRate,
    trailingSilenceSeconds: (last === null ? frames : frames - last) / sampleRate,
    longestInternalSilenceSeconds: longestInternal / sampleRate, startPeak, endPeak };
}

// Bounded structural screening complements tolerant MP3 decoders. A partial last
// MPEG Layer III frame can otherwise decode successfully with its ending lost.
export function inspectMP3(bytes) {
  const issues = [], rates = [44100, 48000, 32000];
  let at = 0, frames = 0, seconds = 0, declaredFrames = null;
  if (bytes.subarray(0, 3).toString() === 'ID3') {
    if (bytes.length < 10 || [...bytes.subarray(6, 10)].some(n => n & 128))
      return { frames, seconds, declaredFrames, issues: ['invalid-id3'] };
    at = 10 + [...bytes.subarray(6, 10)].reduce((n, b) => n * 128 + b, 0) +
      (bytes[3] === 4 && (bytes[5] & 16) ? 10 : 0);
    if (at > bytes.length) return { frames, seconds, declaredFrames, issues: ['truncated-id3'] };
  }
  while (at < bytes.length) {
    if (bytes.length - at === 128 && bytes.subarray(at, at + 3).toString() === 'TAG') break;
    // Encoders may finish with zero padding. Do not accept padding as audio.
    if (bytes[at] === 0 && bytes.subarray(at).every(n => n === 0)) break;
    if (bytes.length - at < 4) { issues.push('truncated-frame-header'); break; }
    const b1 = bytes[at + 1], b2 = bytes[at + 2], version = (b1 >> 3) & 3;
    const bitrateIndex = b2 >> 4, rateIndex = (b2 >> 2) & 3;
    if (bytes[at] !== 255 || (b1 & 224) !== 224 || version === 1 || ((b1 >> 1) & 3) !== 1 ||
        !bitrateIndex || bitrateIndex === 15 || rateIndex === 3) {
      issues.push('unrecognised-mp3-bytes'); break;
    }
    const rate = rates[rateIndex] / (version === 3 ? 1 : version === 2 ? 2 : 4);
    const bitrate = (version === 3 ? [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320] :
      [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160])[bitrateIndex];
    const length = Math.floor((version === 3 ? 144000 : 72000) * bitrate / rate) + ((b2 >> 1) & 1);
    if (at + length > bytes.length) { issues.push('truncated-mp3-frame'); break; }
    if (!frames) {
      const mono = (bytes[at + 3] >> 6) === 3;
      const tag = at + 4 + ((b1 & 1) ? 0 : 2) + (version === 3 ? (mono ? 17 : 32) : (mono ? 9 : 17));
      if (tag + 12 <= at + length && ['Xing', 'Info'].includes(bytes.subarray(tag, tag + 4).toString()) &&
          (bytes.readUInt32BE(tag + 4) & 1)) declaredFrames = bytes.readUInt32BE(tag + 8);
    }
    frames++; seconds += (version === 3 ? 1152 : 576) / rate; at += length;
  }
  if (!frames) issues.push('no-complete-mp3-frames');
  // Some encoders exclude their Xing/Info header frame from this count.
  if (declaredFrames !== null && Math.abs(declaredFrames - frames) > 1) issues.push('mp3-frame-count-mismatch');
  return { frames, seconds, declaredFrames, issues };
}

export function signalCandidates(m, p = POLICY) {
  if (!m || !Number.isFinite(m.seconds) || !Number.isFinite(m.rms)) throw new Error('Missing decoded measurements');
  const flags = [];
  if (m.rms < p.silentRms) flags.push('silent-signal');
  else if (m.rms < p.quietRms) flags.push('quiet-signal');
  if (m.seconds < p.shortSeconds) flags.push('very-short-clip');
  if (m.clippedFraction >= p.clipFraction) flags.push('near-full-scale-samples');
  if (m.leadingSilenceSeconds > p.longSilenceSeconds) flags.push('long-leading-silence');
  if (m.trailingSilenceSeconds > p.longSilenceSeconds) flags.push('long-trailing-silence');
  if (m.longestInternalSilenceSeconds > p.longSilenceSeconds) flags.push('long-internal-silence');
  if (m.silenceFraction > .75) flags.push('mostly-silence');
  if (m.startPeak > p.edgePeak || m.endPeak > p.edgePeak) flags.push('abrupt-boundary-candidate');
  return flags;
}

export function intendedScripts(plan, names) {
  if (!Array.isArray(plan) || plan.length > 5000) throw new Error('Invalid render plan');
  const allowed = new Set(names), mapping = new Map(), issues = [];
  for (const row of plan) {
    if (!row || typeof row.path !== 'string' || typeof row.text !== 'string' ||
        !row.text.trim() || row.text.length > 4000) throw new Error('Malformed intended wording');
    if (!allowed.has(row.path)) { issues.push(`Render-plan path absent from active manifest: ${row.path.slice(0, 200)}`); continue; }
    if (mapping.has(row.path)) throw new Error(`Ambiguous intended wording: ${row.path}`);
    mapping.set(row.path, { text: row.text, sha256: sha256(row.text), source: 'voice-render-kit/render-plan.json',
      kind: 'intended wording; not transcription' });
  }
  for (const name of names) if (!mapping.has(name)) issues.push(`Missing intended wording: ${name}`);
  return { mapping, issues };
}

export const isPilot = name => /^voice\/(warm|steady|energy)\/num\/([1-9]|1[0-9]|20)\.mp3$/.test(name);
export function listeningOrder(rows) {
  const rank = row => row.path === 'voice/warm/num/2.mp3' ? 0 : /\/num\/2\.mp3$/.test(row.path) ? 1 :
    isPilot(row.path) ? 2 : row.error || row.candidates.length ? 3 : 4;
  return [...rows].sort((a, b) => rank(a) - rank(b) || a.path.localeCompare(b.path, 'en', { numeric: true }));
}

export async function deadline(task, ms, { signal, label = 'Operation', onTimeout = () => {} } = {}) {
  signal?.throwIfAborted();
  const controller = new AbortController();
  let timer, cancel;
  const interrupted = new Promise((_, reject) => {
    cancel = () => { controller.abort(signal.reason); reject(signal.reason); };
    signal?.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => {
      const error = new Error(`${label} timed out after ${ms}ms`);
      controller.abort(error); onTimeout(error); reject(error);
    }, ms);
  });
  try { return await Promise.race([Promise.resolve().then(() => { controller.signal.throwIfAborted(); return task(controller.signal); }), interrupted]); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}

// Every selected clip keeps a row, including errors and work not admitted after
// a deadline. A stalled filesystem read stops admission rather than accumulating
// an unbounded collection of uncancellable lstat operations.
export async function screenLibrary({ names, scripts, read, decode, save, signal, abort = () => {}, progress = () => {} }) {
  const allowed = listeningOrder(validateVoiceManifest(names).map(path => ({ path, candidates: [] }))).map(row => row.path);
  const rows = new Array(allowed.length);
  let next = 0, totalBytes = 0;
  await Promise.all(Array.from({ length: POLICY.concurrency }, async () => {
    while (next < allowed.length) {
      const index = next++, path = allowed[index];
      const row = { path, sha256: null, bytes: null, intended: scripts.get(path) || null,
        measurements: null, encoded: null, source: null, candidates: [], status: 'screening-error',
        pronunciation: 'unreviewed' };
      rows[index] = row;
      try {
        signal?.throwIfAborted();
        const bytes = await deadline(s => read(path, s), POLICY.ioTimeoutMs,
          { signal, label: path + ' read', onTimeout: abort });
        row.bytes = bytes.length; row.sha256 = sha256(bytes); totalBytes += bytes.length;
        if (bytes.length > POLICY.maxClipBytes || totalBytes > POLICY.maxLibraryBytes) {
          const error = new Error('Voice audit byte budget exceeded'); abort(error); throw error;
        }
        row.encoded = inspectMP3(bytes);
        if (!row.intended) row.candidates.push('missing-intended-wording');
        const number = path.match(/\/num\/(\d+)\.mp3$/)?.[1];
        if (number && row.intended && row.intended.text.trim() !== number) row.candidates.push('number-script-mismatch');
        row.candidates.push(...row.encoded.issues);
        // Save the exact screened bytes even when decoding fails. A source link
        // cannot drift to a subsequently edited library clip.
        row.source = await deadline(s => save(bytes, index, row.sha256, s), POLICY.ioTimeoutMs,
          { signal, label: path + ' evidence write', onTimeout: abort });
        row.measurements = await deadline(() => decode(bytes), POLICY.decodeTimeoutMs,
          { signal, label: path + ' decode', onTimeout: abort });
        row.candidates.push(...signalCandidates(row.measurements));
        row.status = row.candidates.length ? 'machine-candidate' : 'screened-unreviewed';
      } catch (error) { row.error = String(error.message || error).slice(0, 1200); }
      progress(row, index + 1, allowed.length);
    }
  }));
  return rows;
}

// In-memory, independently specified controls; no shipped MP3 is changed.
export function toneWav({ seconds = 1, silent = false } = {}) {
  const rate = 16000, frames = Math.round(rate * seconds), bytes = Buffer.alloc(44 + frames * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i++) {
    const t = i / rate;
    const envelope = Math.max(0, Math.min(1, (t - .1) / .02, (seconds - .1 - t) / .02));
    bytes.writeInt16LE(silent ? 0 : Math.round(Math.sin(2 * Math.PI * 440 * t) * .25 * envelope * 32767), 44 + i * 2);
  }
  return bytes;
}

export async function decoderControls(decode) {
  const cases = [
    { name: 'healthy generated tone', bytes: toneWav(), expect: 'audible', accept: m => Math.abs(m.seconds - 1) < .02 && m.rms > .1 },
    { name: 'independent digital silence', bytes: toneWav({ silent: true }), expect: 'silent-signal', accept: m => signalCandidates(m).includes('silent-signal') },
    { name: 'corrupt encoded bytes', bytes: Buffer.from('not encoded audio'), expect: 'decode rejection', rejects: true },
    { name: 'truncated WAV payload', bytes: toneWav().subarray(0, 44 + 8000), expect: 'decode rejection or duration loss against independently known 1s',
      accept: m => m.seconds < .75, rejects: true }
  ];
  const results = [];
  for (const c of cases) {
    const result = { name: c.name, sha256: sha256(c.bytes), expected: c.expect, pass: false };
    try { result.measured = await decode(c.bytes); result.pass = !!c.accept?.(result.measured); }
    catch (error) { result.error = String(error.message || error); result.pass = c.rejects === true; }
    results.push(result);
  }
  return results;
}

export function auditPage(report) {
  const cards = listeningOrder(report.clips).map((row, i) => {
    // Only links created by this tool, never arbitrary report/plan URLs.
    const source = /^clips\/[0-9]+-[a-f0-9]{64}\.mp3$/.test(row.source || '') ? row.source : null;
    return `<section><h2>${i + 1}. ${escape(row.path)}</h2>
      <p>${escape(row.status)} · Pronunciation: unreviewed</p>
      ${source ? `<audio controls preload="none" src="${source}" aria-label="Source ${escape(row.path)}"></audio>
      <a href="${source}">Exact source clip</a>` : '<p>Source unavailable; see failure.</p>'}
      <details><summary>Intended wording (not transcription) and measurements</summary>
      <p>${escape(row.intended?.text ?? 'No intended wording mapping')}</p>
      <p>Clip SHA-256: ${escape(row.sha256 ?? 'unavailable')}<br>Wording SHA-256: ${escape(row.intended?.sha256 ?? 'unavailable')}</p>
      <pre>${escape(JSON.stringify(row.measurements, null, 2))}</pre></details>
      <p>${escape(row.candidates.join(', ') || 'No signal/structure heuristic triggered; words are still unverified.')}</p>
      ${row.error ? `<p>Screening error: ${escape(row.error)}</p>` : ''}</section>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; media-src 'self' file:; base-uri 'none'; form-action 'none'">
    <title>FormFinder local voice audit</title><style>body{font:16px/1.5 system-ui;max-width:920px;margin:32px auto;padding:0 18px;color:#222;background:#fafafa}section{border-top:1px solid #bbb;padding:16px 0}h2{font-size:1.1rem;overflow-wrap:anywhere}pre,p{overflow-wrap:anywhere;white-space:pre-wrap}audio{display:block;width:min(100%,480px);margin:12px 0}a{color:#594288}summary{cursor:pointer}</style></head><body>
    <h1>Local voice-library screening</h1><p>${escape(report.status)} · ${escape(report.scope)}</p>
    <p>Machine analysis ≠ pronunciation validation. Every clip is unreviewed. No approval controls or transcription are provided.</p>
    <p>Warm “2”, the other “2” clips, then numbers 1–20 lead this listening queue. Listen before opening the intended wording to reduce expectation bias. Other flagged clips follow, then the remaining library.</p>
    <p><a href="report.json">Machine evidence and source hashes</a></p>
    <pre>${escape(JSON.stringify(report.counts, null, 2))}</pre>
    <details><summary>Decoder controls, failures and coverage gaps</summary><pre>${escape(JSON.stringify({controls: report.controls, errors: report.errors, gaps: report.gaps}, null, 2))}</pre></details>
    ${cards}</body></html>`;
}

async function browserDecoder(signal) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ timeout: 15000 });
  try {
    const page = await deadline(async () => {
      const context = await browser.newContext({ serviceWorkers: 'block', permissions: [] });
      await context.route('**/*', route => route.abort());
      const page = await context.newPage();
      await page.evaluate(`globalThis.measureVoicePCM = ${measurePCM.toString()}`);
      return page;
    }, POLICY.decodeTimeoutMs, { signal, label: 'Decoder setup' });
    return { version: browser.version(), close: () => browser.close(), decode: bytes => page.evaluate(async ({ base64, policy }) => {
      const bytes = Uint8Array.from(atob(base64), ch => ch.charCodeAt(0));
      // Offline decoding requests no microphone or speaker. At 48kHz the
      // library's MP3 sample rates are preserved or upsampled, never reduced.
      const ctx = new OfflineAudioContext(2, 1, 48000);
      const decoded = await ctx.decodeAudioData(bytes.buffer);
      return globalThis.measureVoicePCM(Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i)), decoded.sampleRate, policy);
    }, { base64: bytes.toString('base64'), policy: POLICY }) };
  } catch (error) {
    try { await deadline(() => browser.close(), 5000, { label: 'Failed decoder cleanup' }); }
    catch (cleanup) { throw new Error(`${error.message}; ${cleanup.message}`); }
    throw error;
  }
}

export async function runAudit({ pilot = false, out } = {}) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const outputName = out ?? `test-results/voice-audit-${Date.now()}-${process.pid}`;
  if (!/^test-results\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(outputName)) throw new Error('Output must be a new direct child of test-results/');
  const base = resolve(root, 'test-results');
  const dir = resolve(root, outputName);
  await deadline(async () => {
    await mkdir(base, { recursive: true });
    if ((await lstat(base)).isSymbolicLink()) throw new Error('Symlinked output directory is not allowed');
    await mkdir(dir); // Existing evidence is never overwritten.
    await mkdir(resolve(dir, 'clips'));
  }, POLICY.ioTimeoutMs, { label: 'Evidence directory setup' });
  const controller = new AbortController();
  const abort = error => controller.abort(error);
  const timer = setTimeout(() => abort(new Error('Voice audit exceeded ten minutes; remaining clips were not screened')), POLICY.runTimeoutMs);
  const report = { schema: 'voice-library-audit/1', started: new Date().toISOString(),
    scope: pilot ? 'pilot: numbers 1–20 in all three voices' : 'entire active manifest',
    status: 'incomplete', policy: POLICY, inputs: {}, errors: [], controls: [], clips: [],
    transcription: { status: 'not-implemented', provider: null },
    gaps: ['Machine analysis is not pronunciation validation; all clips remain unreviewed.',
      'No on-device recognizer is integrated or invoked. Intended wording is not transcription.',
      'Source decoding only: no actual Coach queue capture, physical speakers, mobile audio or new app-playback comparison.',
      'Wrong words and intelligible-but-mispronounced speech cannot be detected by signal/structure screening.',
      'Whole-frame truncation without reliable frame-count metadata and phoneme loss may escape these heuristics.'] };
  let names = [], decoder;
  const read = (name, signal) => readPublicInput(root, name, { signal });
  const readBounded = name => deadline(s => read(name, s), POLICY.ioTimeoutMs,
    { signal: controller.signal, label: name, onTimeout: abort });
  try {
    const manifestBytes = await readBounded('voice/manifest.json');
    report.inputs['voice/manifest.json'] = sha256(manifestBytes);
    const manifest = validateVoiceManifest(JSON.parse(manifestBytes));
    report.manifestEntries = manifest.length;
    names = pilot ? manifest.filter(isPilot) : manifest;
    report.selectedEntries = names.length;
    if (pilot) report.gaps.push(`${manifest.length - names.length} manifest entries outside this explicitly selected pilot were not screened.`);
    for (const dependency of ['testing/voice-audit.mjs', 'release/web.mjs', 'testing/report.mjs'])
      report.inputs[dependency] = sha256(await readBounded(dependency));
    let scripts = new Map();
    try {
      const planBytes = await readBounded('voice-render-kit/render-plan.json');
      report.inputs['voice-render-kit/render-plan.json'] = sha256(planBytes);
      const mapped = intendedScripts(JSON.parse(planBytes), manifest);
      scripts = mapped.mapping; report.errors.push(...mapped.issues);
    } catch (error) { report.errors.push(`Intended wording unavailable: ${error.message}`); }
    try {
      decoder = await browserDecoder(controller.signal); report.decoder = { engine: 'Chromium Web Audio', version: decoder.version, sampleRate: 48000 };
      report.controls = await decoderControls(bytes => deadline(() => decoder.decode(bytes), POLICY.decodeTimeoutMs,
        { signal: controller.signal, label: 'Decoder control', onTimeout: abort }));
      if (report.controls.some(c => !c.pass)) throw new Error('Independent decoder controls failed');
    } catch (error) { report.errors.push(`Decoder unavailable/untrusted: ${error.message}`); abort(error); }
    let completed = 0;
    report.clips = await screenLibrary({ names, scripts, read, decode: bytes => decoder.decode(bytes),
      signal: controller.signal, abort,
      save: async (bytes, index, hash, signal) => {
        const name = `clips/${index}-${hash}.mp3`;
        await writeFile(resolve(dir, name), bytes, { flag: 'wx', signal }); return name;
      }, progress: () => { if (++completed % 100 === 0) console.log(`Voice screening: ${completed}/${names.length}`); } });
  } catch (error) { report.errors.push(String(error.message || error)); }
  finally {
    clearTimeout(timer);
    if (decoder) {
      try { await deadline(() => decoder.close(), 5000, { label: 'Browser cleanup' }); }
      catch (error) { report.errors.push(error.message); }
    }
  }
  // Setup failure must not make selected-but-unchecked inputs disappear.
  if (!report.clips.length && names.length) report.clips = names.map(path => ({ path, sha256: null,
    status: 'screening-error', candidates: [], pronunciation: 'unreviewed', error: 'Audit setup failed; not screened' }));
  report.counts = { selected: names.length, decoded: report.clips.filter(c => c.measurements).length,
    candidates: report.clips.filter(c => c.status === 'machine-candidate').length,
    errors: report.clips.filter(c => c.error).length, pronunciationUnreviewed: names.length, approved: 0 };
  report.status = report.errors.length || report.counts.errors || !names.length ? 'incomplete' : 'screened; pronunciation unreviewed';
  report.finished = new Date().toISOString();
  await deadline(async signal => {
    await writeFile(resolve(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', signal });
    await writeFile(resolve(dir, 'index.html'), auditPage(report), { flag: 'wx', signal });
  }, POLICY.ioTimeoutMs, { label: 'Final report write' });
  console.log(`${report.status}: ${relative(root, dir)}/index.html`);
  return { report, dir };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  try {
    const options = {};
    let selection = null;
    for (let i = 0; i < args.length; i++) {
      if (['--pilot', '--all'].includes(args[i]) && selection === null) { selection = args[i]; options.pilot = args[i] === '--pilot'; }
      else if (args[i] === '--out' && !options.out && args[i + 1]) options.out = args[++i];
      else throw new Error('Usage: node testing/voice-audit.mjs [--all | --pilot] [--out test-results/<new-directory>]');
    }
    const { report } = await runAudit(options);
    process.exitCode = report.status === 'incomplete' ? 1 : 0;
  } catch (error) { console.error(`Voice audit failed: ${error.message}`); process.exitCode = 1; }
}
