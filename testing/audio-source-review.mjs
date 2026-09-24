// Development evidence only. This helper copies PUBLIC, manifest-listed sources
// beside a completed audio capture; it never decodes, transcribes or approves.
import { lstat, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { readPublicInput, validateVoiceManifest, sha256 } from '../release/web.mjs';

export const SOURCE_REVIEW_LIMITS = Object.freeze({ maxClips: 64, maxRequests: 256,
  maxClipBytes: 2 * 1024 * 1024, maxTotalBytes: 16 * 1024 * 1024,
  maxTransportRows: 2048, ioTimeoutMs: 30_000, totalTimeoutMs: 120_000 });
const HASH = /^[a-f0-9]{64}$/;
const record = value => value && typeof value === 'object' && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));

// A deadline revokes admission to later work even when lstat cannot be aborted.
// Exported for a deterministic hung-operation control, not for network I/O.
export async function sourceReviewDeadline(task, { signal, timeoutMs, label, onTimeout = () => {} }) {
  signal?.throwIfAborted();
  const controller = new AbortController();
  let timer, cancel;
  const interrupted = new Promise((_, reject) => {
    cancel = () => { controller.abort(signal.reason); reject(signal.reason); };
    signal?.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => {
      const error = new Error(`${label} timed out after ${timeoutMs}ms`);
      controller.abort(error); onTimeout(error); reject(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([interrupted, Promise.resolve().then(() => {
      controller.signal.throwIfAborted(); return task(controller.signal);
    })]);
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}

/**
 * copyAudioSources({root, target, paths?, clipHashes, manifestHash?,
 *                   transportResponses?, caseId?, signal?, limits?})
 *   -> Promise<{clips: Row[], errors: {path: string|null, message: string}[],
 *               status: string, sourceMeaning: string}>
 *
 * root: repository/fixture root. target: existing capture directory, absolute or
 * relative to root, strictly BELOW root/test-results/. No symlinked ancestors.
 * paths defaults to Object.keys(clipHashes); duplicates retain only their first
 * row. clipHashes is evidence.clipHashes: {"voice/...mp3": capturedSHA256}.
 * manifestHash, when supplied, is evidence.manifestHash and must still match.
 * transportResponses: optional server rows {path:'/voice/...', sha256, size,
 * bytes, range?:{start,end}, finishedAt, statusCode, caseId}. caseId is required
 * with nonempty transport rows; other cases never contribute identity evidence.
 * Only finished complete 200 (no range) or 206 (range 0..size-1), bytes===size,
 * can establish full-source identity. ALL qualifying hashes must match source
 * bytes and clipHashes. Partial/missing/intercepted responses are UNVERIFIED,
 * never compared as whole files and never promoted by another case's request.
 * limits may reduce, never increase, the exported caps. No network or installs.
 *
 * Row: {path, sha256, localPath, bytes, sourceIdentity, transport, error?}.
 * localPath is report-relative
 * "source-clips/<sha>.mp3" only after verification; otherwise null. sha256/bytes
 * describe actually read bytes, or null when unavailable. error rows are visible
 * failures, never pronunciation judgements. All failures, including invalid
 * arguments, are returned in errors; counts/invalid lists may have no clip rows.
 * Caller must surface errors in the saved report without discarding the capture.
 *
 * Exact bytes are written with wx, deduplicated by content hash, then rechecked.
 * Existing identical evidence may be reused; changed/partial/symlinked files
 * fail and are NEVER overwritten, removed or silently repaired by this helper.
 * A cancelled/failed write can leave a partial file; its row has no source link.
 *
 * Example after capture (no browser needed here):
 * const sourceReview = await copyAudioSources({root, target,
 *   paths: ['voice/warm/num/2.mp3', 'voice/steady/num/2.mp3', 'voice/energy/num/2.mp3'],
 *   clipHashes: evidence.clipHashes, manifestHash: evidence.manifestHash,
 *   transportResponses: serverRows, caseId: scenario.id});
 */
async function copyChecked({ root, target, paths, clipHashes, manifestHash,
  transportResponses = [], caseId, signal, limits = {} } = {}) {
  if (typeof root !== 'string' || !root || typeof target !== 'string' || !target ||
      !record(clipHashes) || !record(limits) || !Array.isArray(transportResponses))
    throw new Error('Invalid audio source review arguments');
  if (Object.keys(limits).some(key => !Object.hasOwn(SOURCE_REVIEW_LIMITS, key))) throw new Error('Unknown source review limit');
  const cap = { ...SOURCE_REVIEW_LIMITS, ...limits };
  for (const [key, value] of Object.entries(cap))
    if (!Number.isInteger(value) || value < 1 || value > SOURCE_REVIEW_LIMITS[key]) throw new Error(`Invalid source review limit: ${key}`);
  if (transportResponses.length > cap.maxTransportRows) throw new Error('Transport evidence row budget exceeded');
  if (transportResponses.length && (typeof caseId !== 'string' || !caseId || caseId.length > 240))
    throw new Error('Explicit capture caseId required with transport evidence');
  paths ??= Object.keys(clipHashes);
  if (!Array.isArray(paths) || paths.length > cap.maxRequests || paths.some(p => typeof p !== 'string' || p.length > 240))
    throw new Error('Invalid/over-budget source request list');
  const names = [...new Set(paths)];
  if (names.length > cap.maxClips) throw new Error('Source clip count budget exceeded');
  const rootDir = resolve(root), targetDir = resolve(rootDir, target), targetName = relative(rootDir, targetDir).split(sep).join('/');
  if (target.includes('\\') || target.split('/').includes('..') ||
      !targetName.startsWith('test-results/') || targetName.split('/').some(p => !p || p === '.' || p === '..'))
    throw new Error('Source evidence target must be below root/test-results/ without traversal');
  if (!names.length) return [];
  const rows = names.map(emptyRow);
  const controller = new AbortController();
  const abort = error => controller.abort(error);
  const onCancel = () => abort(signal.reason);
  signal?.addEventListener('abort', onCancel, { once: true });
  if (signal?.aborted) onCancel();
  const timer = setTimeout(() => abort(new Error('Source review total deadline exceeded')), cap.totalTimeoutMs);
  const io = (label, task) => sourceReviewDeadline(task, { signal: controller.signal,
    timeoutMs: cap.ioTimeoutMs, label, onTimeout: abort });
  const read = name => io(`Read ${name}`, signal => readPublicInput(rootDir, name, { signal }));
  const fail = (row, error) => { row.localPath = null; row.error = String(error?.message || error).slice(0, 1600); };
  let admittedBytes = 0;
  try {
    const manifestBytes = await read('voice/manifest.json');
    if (manifestBytes.length > 1024 * 1024) throw new Error('Voice manifest exceeds 1 MiB');
    if (manifestHash !== undefined && (!HASH.test(manifestHash) || sha256(manifestBytes) !== manifestHash))
      throw new Error('Captured voice manifest hash is stale or invalid');
    const allowlist = new Set(validateVoiceManifest(JSON.parse(manifestBytes)));
    // Validate every output ancestor, not just the final source-clips directory.
    let directory = rootDir;
    for (const part of ['', ...targetName.split('/')]) {
      if (part) directory = resolve(directory, part);
      const info = await io('Inspect source evidence directory', () => lstat(directory));
      if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('Unsafe/symlinked source evidence directory');
    }
    const sourceDir = resolve(targetDir, 'source-clips');
    await io('Create source-clips directory', async () => {
      try { await mkdir(sourceDir); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    });
    const info = await io('Inspect source-clips directory', () => lstat(sourceDir));
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('Unsafe/symlinked source-clips directory');
    const copied = new Set();
    for (const row of rows) {
      try {
        controller.signal.throwIfAborted();
        validateVoiceManifest([row.path]);
        if (!allowlist.has(row.path)) throw new Error('Requested source is not in the public voice manifest');
        const expected = Object.hasOwn(clipHashes, row.path) ? clipHashes[row.path] : null;
        if (typeof expected !== 'string' || !HASH.test(expected)) throw new Error('Missing/invalid captured clip hash');
        const bytes = await read(row.path);
        row.bytes = bytes.length; row.sha256 = sha256(bytes);
        admittedBytes += bytes.length;
        if (bytes.length > cap.maxClipBytes || admittedBytes > cap.maxTotalBytes) {
          const error = new Error('Source clip/aggregate byte budget exceeded'); abort(error); throw error;
        }
        if (row.sha256 !== expected) throw new Error(`Stale captured clip hash: expected ${expected}, current ${row.sha256}`);
        const responses = transportResponses.filter(r => r && r.path === '/' + row.path && r.caseId === caseId);
        const full = responses.filter(r => Number.isFinite(r.finishedAt) && r.finishedAt > 0 &&
          Number.isSafeInteger(r.size) && r.size >= 0 && r.bytes === r.size &&
          (r.statusCode === 200 && r.range == null || r.statusCode === 206 &&
            r.range?.start === 0 && r.range?.end === r.size - 1));
        row.transport = { status: 'unverified', fullResponses: full.length,
          partialOrIncompleteResponses: responses.length - full.length,
          reason: 'No complete full-body response for this capture; source identity is post-capture only.' };
        if (full.length) {
          if (full.some(r => typeof r.sha256 !== 'string' || !HASH.test(r.sha256) || r.sha256 !== expected || r.size !== bytes.length)) {
            row.transport.status = 'mismatch';
            row.transport.reason = 'Complete response body identity disagrees with the captured/current source or lacks a valid hash.';
            throw new Error(row.transport.reason);
          }
          row.transport.status = 'verified-full-response'; row.transport.sha256 = expected;
          row.transport.reason = 'Exact complete served bytes match this source. This does not prove audible playback.';
        }
        const localPath = `source-clips/${row.sha256}.mp3`, destination = resolve(targetDir, localPath);
        if (!copied.has(row.sha256)) {
          await io(`Save ${localPath}`, async signal => {
            try { await writeFile(destination, bytes, { flag: 'wx', signal }); }
            catch (error) { if (error.code !== 'EEXIST') throw error; }
          });
          const saved = await read(`${targetName}/${localPath}`);
          if (saved.length !== row.bytes || sha256(saved) !== row.sha256)
            throw new Error('Existing/saved source evidence differs; refusing to overwrite');
          copied.add(row.sha256);
        }
        row.localPath = localPath;
        row.sourceIdentity = 'saved-after-capture-matches-clipHashes';
      } catch (error) { fail(row, error); }
    }
  } catch (error) { for (const row of rows) fail(row, error); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', onCancel); }
  return rows;
}

function emptyRow(path) {
  return { path, sha256: null, localPath: null, bytes: null, sourceIdentity: 'not-saved',
    transport: { status: 'unverified', reason: 'No verified full-response identity.' } };
}

export async function copyAudioSources(options = {}) {
  let clips = [], errors = [];
  try {
    clips = await copyChecked(options);
    errors = clips.filter(row => row.error).map(row => ({ path: row.path, message: row.error }));
  } catch (error) {
    const message = String(error?.message || error).slice(0, 1600);
    // Keep ordinary request failures next to their intended source. Oversized or
    // malformed lists are summarized, never expanded into an unbounded report.
    const requested = Array.isArray(options?.paths) ? options.paths : record(options?.clipHashes) ? Object.keys(options.clipHashes) : [];
    if (requested.length <= SOURCE_REVIEW_LIMITS.maxRequests && requested.every(p => typeof p === 'string' && p.length <= 240)) {
      const names = [...new Set(requested)];
      if (names.length <= SOURCE_REVIEW_LIMITS.maxClips) clips = names.map(path => ({ ...emptyRow(path), error: message }));
    }
    errors = [{ path: null, message }];
  }
  return { clips, errors, status: errors.length ? 'incomplete' : clips.length ? 'sources-saved' : 'no-sources',
    sourceMeaning: 'Source files saved after capture and matched to evidence.clipHashes. Only verified-full-response rows also establish exact served-byte identity; neither establishes audible signal, words or pronunciation.' };
}
