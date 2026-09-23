// Local review artifacts only. Never upload the repository or recursively copy it.
import { lstat, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
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
export async function readPublicInput(root, name) {
  if (!name || name.startsWith('/') || name.split(/[\\/]/).some(s => !s || s === '.' || s === '..'))
    throw new Error('Unsafe input path');
  let file = resolve(root);
  for (const segment of name.split('/')) {
    file = resolve(file, segment);
    if ((await lstat(file)).isSymbolicLink()) throw new Error(`Symlink not publishable: ${name}`);
  }
  const info = await lstat(file);
  if (!info.isFile() || info.size > MAX_FILE_BYTES) throw new Error(`Asset exceeds file budget or is not a file: ${name}`);
  const bytes = await readFile(file);
  if (bytes.length > MAX_FILE_BYTES) throw new Error(`Asset exceeds file budget: ${name}`);
  return bytes;
}

export async function assembleWebRelease({ root, build, progress = () => {} }) {
  if (!build) throw new Error('Name the source build explicitly');
  const buildName = relative(resolve(root), resolve(root, build)).split(sep).join('/');
  const inputs = {};
  const read = async name => {
    const bytes = await readPublicInput(root, name);
    inputs[name] = sha256(bytes);
    return bytes;
  };
  const source = await read(buildName);
  const html = packageHTML(source.toString('utf8'));
  const version = source.toString('utf8').match(/const VERSION\s*=\s*["']([^"']+)["']/)?.[1];
  if (!version) throw new Error('Missing build VERSION');
  const pkg = JSON.parse(await read('node_modules/@mediapipe/tasks-vision/package.json'));
  if (pkg.version !== '0.10.14' || pkg.license !== 'Apache-2.0') throw new Error('Unexpected MediaPipe package');
  const modelSpec = JSON.parse(await read('testing/model.json'));
  const model = await read('testing/assets/pose_landmarker_lite.task');
  if (modelSpec.url !== MODEL_URL || sha256(model) !== modelSpec.sha256) throw new Error('Model checksum mismatch');
  const manifestBytes = await read('voice/manifest.json');
  const clips = validateVoiceManifest(JSON.parse(manifestBytes));
  const files = new Map();
  let totalBytes = 0;
  const add = (name, bytes) => {
    if (totalBytes + bytes.length > MAX_TOTAL_BYTES) throw new Error('Release exceeds 100 MiB review budget');
    totalBytes += bytes.length; files.set(name, bytes);
  };
  add('index.html', Buffer.from(html)); add('models/pose_landmarker_lite.task', model);
  add('voice/manifest.json', manifestBytes);
  for (const name of ['vision_bundle.mjs', 'wasm/vision_wasm_internal.js', 'wasm/vision_wasm_internal.wasm',
    'wasm/vision_wasm_nosimd_internal.js', 'wasm/vision_wasm_nosimd_internal.wasm'])
    add(`vendor/${name}`, await read(`node_modules/@mediapipe/tasks-vision/${name}`));
  progress(`Runtime/model verified; reading ${clips.length} allowlisted clips.`);
  // Bounded parallel reads; preserve sorted output/provenance, regardless of I/O order.
  for (let i = 0; i < clips.length; i += 4) {
    const batch = await Promise.all(clips.slice(i, i + 4).map(async name => [name, await read(name)]));
    for (const [name, bytes] of batch) add(name, bytes);
    if (i % 200 === 0) progress(`Clips read: ${Math.min(i + 4, clips.length)}/${clips.length}`);
  }
  for (const name of ['_headers', '404.html', 'REVIEW-NOTICE.txt']) add(name, await read(`release/${name}`));
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

export async function writeWebRelease(bundle, destination) {
  // No overwrite/delete flag. Each explicit fresh destination is a reviewable release.
  await mkdir(destination, { recursive: false });
  for (const [name, bytes] of bundle.files) {
    const file = resolve(destination, name);
    if (!file.startsWith(resolve(destination) + sep)) throw new Error('Unsafe output path');
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, bytes, { flag: 'wx' });
  }
}
