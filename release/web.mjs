// Local review artifacts only. Never upload the repository or recursively copy it.
import { lstat, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
export const RELEASE_IO_CONCURRENCY = 8;
export const RELEASE_IO_TIMEOUT_MS = 30_000;
export const ARTIFACT_LOAD_TIMEOUT_MS = 90_000;
export const VISION_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
export const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
export const sha256 = data => createHash('sha256').update(data).digest('hex');

export function replaceOnce(text, from, to) {
  if (text.split(from).length !== 2) throw new Error(`Release boundary changed: ${from}`);
  return text.replace(from, to);
}

export function packageHTML(source) {
  let html = replaceOnce(source, `${VISION_BASE}/vision_bundle.mjs`, './vendor/vision_bundle.mjs');
  html = replaceOnce(html, `${VISION_BASE}/wasm`, './vendor/wasm');
  html = replaceOnce(html, MODEL_URL, './models/pose_landmarker_lite.task');
  const fonts = html.match(/<link[^>]+https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>/g) || [];
  if (fonts.length !== 3) throw new Error('Font boundary changed; review instead of silently repackaging');
  for (const link of fonts) html = replaceOnce(html, link, '');
  return replaceOnce(html, '</head>', '<meta name="robots" content="noindex,nofollow">\n</head>');
}

export function validateVoiceManifest(manifest) {
  if (!Array.isArray(manifest) || !manifest.length || manifest.length > 5000 || new Set(manifest).size !== manifest.length)
    throw new Error('Invalid voice manifest');
  for (const name of manifest)
    if (typeof name !== 'string' || !/^voice\/(steady|warm|energy)\/(learning|building|strong|num|tok)\/[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\.mp3$/.test(name))
      throw new Error('Unapproved voice asset path');
  return [...manifest].sort();
}

// Reject symlinked directories as well as files. A manifest is not permission to
// publish arbitrary local content. Inputs must stay inside the selected repo.
export async function readPublicInput(root, name, { signal, stage = () => {} } = {}) {
  if (!name || name.startsWith('/') || name.split(/[\\/]/).some(s => !s || s === '.' || s === '..'))
    throw new Error('Unsafe input path');
  let file = resolve(root);
  let info;
  for (const segment of name.split('/')) {
    signal?.throwIfAborted();
    file = resolve(file, segment);
    stage(`inspect ${relative(resolve(root), file)}`);
    info = await lstat(file);
    if (info.isSymbolicLink()) throw new Error(`Symlink not publishable: ${name}`);
  }
  if (!info.isFile() || info.size > MAX_FILE_BYTES) throw new Error(`Asset exceeds file budget or is not a file: ${name}`);
  signal?.throwIfAborted();
  stage('read bytes');
  const bytes = await readFile(file, { signal });
  signal?.throwIfAborted();
  if (bytes.length > MAX_FILE_BYTES) throw new Error(`Asset exceeds file budget: ${name}`);
  return bytes;
}

// Refill each free slot immediately: one slow file must not hold up a whole
// batch. Results retain input order. A failure stops admission, aborts pending
// reads/writes and rejects promptly even if a filesystem operation cannot abort.
export async function runReleaseTasks(names, task, { concurrency = RELEASE_IO_CONCURRENCY,
  timeoutMs = RELEASE_IO_TIMEOUT_MS, progress = () => {}, label = 'Files', signal } = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > RELEASE_IO_CONCURRENCY)
    throw new Error('Invalid release I/O concurrency');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > RELEASE_IO_TIMEOUT_MS)
    throw new Error('Invalid release I/O deadline');
  signal?.throwIfAborted();
  const controller = new AbortController(), active = new Map(), results = new Array(names.length);
  const started = performance.now();
  let next = 0, completed = 0, slowestMs = 0, slowestName = '', interval;
  const snapshot = () => {
    const elapsed = performance.now() - started;
    const pending = [...active.values()].sort((a, b) => a.started - b.started).slice(0, 3)
      .map(entry => `${entry.name} (${entry.stage}, ${((performance.now() - entry.started) / 1000).toFixed(1)}s)`);
    return `${label}: ${completed}/${names.length}; ${(elapsed / 1000).toFixed(1)}s elapsed; ` +
      `${(completed / Math.max(elapsed / 1000, 0.001)).toFixed(1)} files/s; ${active.size} active` +
      (pending.length ? `; oldest: ${pending.join(', ')}` : '') +
      (slowestName ? `; slowest completed: ${slowestName} ${(slowestMs / 1000).toFixed(1)}s` : '');
  };
  const aborted = new Promise((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true });
  });
  const cancel = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', cancel, { once: true });
  const report = () => {
    try { progress(snapshot()); }
    catch (error) { controller.abort(error); }
  };
  const worker = async () => {
    while (!controller.signal.aborted && next < names.length) {
      const index = next++, name = names[index];
      const entry = { name, started: performance.now(), stage: 'starting', timer: null };
      active.set(index, entry);
      entry.timer = setTimeout(() => controller.abort(new Error(
        `Release I/O timed out after ${timeoutMs / 1000}s: ${name} (${entry.stage}). ${snapshot()}. ` +
        'Check this local path and file availability. No automatic retry.')), timeoutMs);
      try {
        results[index] = await task(name, { signal: controller.signal, stage: value => { entry.stage = value; } });
        controller.signal.throwIfAborted();
        completed++;
        const elapsed = performance.now() - entry.started;
        if (elapsed > slowestMs) { slowestMs = elapsed; slowestName = name; }
      } catch (error) {
        controller.abort(error);
        throw error;
      } finally {
        clearTimeout(entry.timer);
        active.delete(index);
      }
    }
  };
  try {
    const workers = Promise.all(Array.from({ length: Math.min(concurrency, names.length) }, worker));
    const settled = Promise.race([workers, aborted]);
    report();
    interval = setInterval(report, 5000);
    await settled;
    controller.signal.throwIfAborted();
    clearInterval(interval);
    report();
    controller.signal.throwIfAborted();
    return results;
  } finally {
    clearInterval(interval);
    for (const entry of active.values()) clearTimeout(entry.timer);
    signal?.removeEventListener('abort', cancel);
  }
}

export async function assembleWebRelease({ root, build, progress = () => {}, signal }) {
  if (!build) throw new Error('Name the source build explicitly');
  const buildName = relative(resolve(root), resolve(root, build)).split(sep).join('/');
  const inputs = {};
  const read = async (name, context) => {
    const bytes = await readPublicInput(root, name, context);
    inputs[name] = sha256(bytes);
    return bytes;
  };
  const readOne = async name => (await runReleaseTasks([name], read,
    { concurrency: 1, progress, signal, label: 'Input reads' }))[0];
  const source = await readOne(buildName);
  const html = packageHTML(source.toString('utf8'));
  const version = source.toString('utf8').match(/const VERSION\s*=\s*["']([^"']+)["']/)?.[1];
  if (!version) throw new Error('Missing build VERSION');
  const pkg = JSON.parse(await readOne('node_modules/@mediapipe/tasks-vision/package.json'));
  if (pkg.version !== '0.10.14' || pkg.license !== 'Apache-2.0') throw new Error('Unexpected MediaPipe package');
  const modelSpec = JSON.parse(await readOne('testing/model.json'));
  const model = await readOne('testing/assets/pose_landmarker_lite.task');
  if (modelSpec.url !== MODEL_URL || sha256(model) !== modelSpec.sha256) throw new Error('Model checksum mismatch');
  const manifestBytes = await readOne('voice/manifest.json');
  const clips = validateVoiceManifest(JSON.parse(manifestBytes));
  const files = new Map();
  let totalBytes = 0;
  const reserve = bytes => {
    if (totalBytes + bytes.length > MAX_TOTAL_BYTES) throw new Error('Release exceeds 100 MiB review budget');
    totalBytes += bytes.length;
  };
  const add = (name, bytes) => { reserve(bytes); files.set(name, bytes); };
  add('index.html', Buffer.from(html)); add('models/pose_landmarker_lite.task', model);
  add('voice/manifest.json', manifestBytes);
  for (const name of ['vision_bundle.mjs', 'wasm/vision_wasm_internal.js', 'wasm/vision_wasm_internal.wasm',
    'wasm/vision_wasm_nosimd_internal.js', 'wasm/vision_wasm_nosimd_internal.wasm'])
    add(`vendor/${name}`, await readOne(`node_modules/@mediapipe/tasks-vision/${name}`));
  progress(`Runtime/model verified; reading ${clips.length} allowlisted clips.`);
  const clipBytes = await runReleaseTasks(clips, async (name, context) => {
    const bytes = await read(name, context);
    // Enforce the aggregate limit as each read completes, not after retaining
    // the entire manifest. Slow earlier files do not postpone budget checks.
    reserve(bytes);
    return bytes;
  }, { progress, signal, label: 'Clip reads' });
  clips.forEach((name, index) => files.set(name, clipBytes[index]));
  for (const name of ['_headers', '404.html', 'REVIEW-NOTICE.txt']) add(name, await readOne(`release/${name}`));
  const assets = [...files].map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }));
  const receipt = { schema: 'web-review-release/1', version, sourceHash: sha256(source),
    buildHash: sha256(files.get('index.html')), modelHash: sha256(model), voiceClips: clips.length,
    totalBytes, inputs: Object.fromEntries(Object.entries(inputs).sort(([a],[b]) => a.localeCompare(b))),
    assets, publicLaunchApproved: false, offlineInstallable: false,
    limitations: ['Local review artifact; no public deployment or licensing sign-off.',
      'No service worker/offline installation, store payment or connected Duo.',
      'Synthetic checks do not replace physical-device, voice intelligibility or beginner tests.'] };
  files.set('release.json', Buffer.from(JSON.stringify(receipt, null, 2) + '\n'));
  return { files, receipt };
}

export async function writeWebRelease(bundle, destination, { progress = () => {}, signal } = {}) {
  // No overwrite/delete flag. Each explicit fresh destination is a reviewable release.
  signal?.throwIfAborted();
  await mkdir(destination, { recursive: false });
  const write = async (name, { signal, stage }) => {
    const file = resolve(destination, name);
    if (!file.startsWith(resolve(destination) + sep)) throw new Error('Unsafe output path');
    stage('create output directory');
    await mkdir(dirname(file), { recursive: true });
    signal.throwIfAborted();
    stage('write bytes');
    await writeFile(file, bundle.files.get(name), { flag: 'wx', signal });
  };
  await runReleaseTasks([...bundle.files.keys()].filter(name => name !== 'release.json'), write,
    { progress, signal, label: 'Asset writes' });
  // A receipt is written only after every asset succeeded. An interrupted
  // destination is left for inspection, never passed off as a complete release.
  if (bundle.files.has('release.json')) await runReleaseTasks(['release.json'], write,
    { concurrency: 1, progress, signal, label: 'Receipt write' });
}

const PUBLIC_ARTIFACT_FILES = ['index.html', 'models/pose_landmarker_lite.task', 'voice/manifest.json',
  'vendor/vision_bundle.mjs', 'vendor/wasm/vision_wasm_internal.js', 'vendor/wasm/vision_wasm_internal.wasm',
  'vendor/wasm/vision_wasm_nosimd_internal.js', 'vendor/wasm/vision_wasm_nosimd_internal.wasm',
  '_headers', '404.html', 'REVIEW-NOTICE.txt'];

// Shared by actual-artifact browser probes. Only verified, allowlisted bytes
// enter their HTTP map; no recursive serving or dependency on repository files.
export async function loadVerifiedArtifact(root, { progress = () => {}, signal } = {}) {
  signal?.throwIfAborted();
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', cancel, { once: true });
  const deadline = setTimeout(() => controller.abort(new Error(
    'Artifact verification exceeded 90 seconds; incomplete, not passed. No automatic retry.')), ARTIFACT_LOAD_TIMEOUT_MS);
  try {
    const options = { progress, signal: controller.signal };
    const receiptBytes = (await runReleaseTasks(['release.json'], (name, context) => readPublicInput(root, name, context),
      { ...options, concurrency: 1, label: 'Receipt read' }))[0];
    const receipt = JSON.parse(receiptBytes);
    if (!receipt || receipt.schema !== 'web-review-release/1' || !Array.isArray(receipt.assets) ||
        receipt.assets.length > 5000 + PUBLIC_ARTIFACT_FILES.length ||
        !Number.isSafeInteger(receipt.voiceClips) || receipt.voiceClips < 1 || receipt.voiceClips > 5000)
      throw new Error('Invalid release receipt');
    const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
    if (![receipt.sourceHash, receipt.buildHash, receipt.modelHash].every(hash)) throw new Error('Invalid release hashes');
    const assets = new Map();
    let declaredBytes = 0;
    for (const asset of receipt.assets) {
      if (!asset || typeof asset.path !== 'string' || assets.has(asset.path) ||
          !Number.isSafeInteger(asset.bytes) || asset.bytes < 0 || asset.bytes > MAX_FILE_BYTES || !hash(asset.sha256))
        throw new Error('Invalid or duplicate receipt asset');
      if (!PUBLIC_ARTIFACT_FILES.includes(asset.path)) validateVoiceManifest([asset.path]);
      declaredBytes += asset.bytes;
      if (declaredBytes > MAX_TOTAL_BYTES) throw new Error('Release exceeds 100 MiB review budget');
      assets.set(asset.path, asset);
    }
    if (receipt.totalBytes !== declaredBytes || PUBLIC_ARTIFACT_FILES.some(name => !assets.has(name)) ||
        assets.size !== PUBLIC_ARTIFACT_FILES.length + receipt.voiceClips)
      throw new Error('Incomplete or inconsistent release receipt');
    if (assets.get('index.html').sha256 !== receipt.buildHash ||
        assets.get('models/pose_landmarker_lite.task').sha256 !== receipt.modelHash)
      throw new Error('Release build/model hash does not match its asset');
    const read = async (name, context) => {
      const bytes = await readPublicInput(root, name, context), asset = assets.get(name);
      if (bytes.length !== asset.bytes || sha256(bytes) !== asset.sha256) throw new Error(`Changed asset: ${name}`);
      return bytes;
    };
    const manifestBytes = (await runReleaseTasks(['voice/manifest.json'], read,
      { ...options, concurrency: 1, label: 'Manifest verification' }))[0];
    const clips = validateVoiceManifest(JSON.parse(manifestBytes));
    if (clips.length !== receipt.voiceClips || clips.some(name => !assets.has(name)))
      throw new Error('Voice manifest does not match the release receipt');
    const names = [...assets.keys()].filter(name => name !== 'voice/manifest.json');
    const bytes = await runReleaseTasks(names, read, { ...options, label: 'Asset verification' });
    const loaded = new Map(names.map((name, index) => [name, bytes[index]]));
    loaded.set('voice/manifest.json', manifestBytes);
    const files = new Map([['/release.json', receiptBytes],
      ...[...assets.keys()].map(name => ['/' + name, loaded.get(name)])]);
    return { receipt, receiptBytes, files };
  } finally {
    clearTimeout(deadline);
    signal?.removeEventListener('abort', cancel);
  }
}
