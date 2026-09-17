// Dependency-free transfer integrity check. The manifest is not a signature.
import { readFile, lstat, readlink, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const hash = data => createHash('sha256').update(data).digest('hex');
const root = await realpath(resolve(process.argv[2] || resolve(dirname(fileURLToPath(import.meta.url)), '..')));
const manifest = JSON.parse(await readFile(resolve(root, 'handover/SNAPSHOT.json'), 'utf8'));
if (manifest.schema !== 'formcoach-handover/1' || !Array.isArray(manifest.files) || !manifest.files.length)
  throw new Error('Invalid or empty handover manifest');
const seen = new Set(), failures = [];
for (const entry of manifest.files) {
  const name = entry.path;
  if (typeof name !== 'string' || !name || name.includes('\\') || name.includes('\0') ||
      name.split('/').some(p => !p || p === '.' || p === '..') || isAbsolute(name) || seen.has(name) ||
      !/^[a-f0-9]{64}$/.test(entry.sha256) || !['file', 'symlink'].includes(entry.type))
    throw new Error(`Invalid manifest entry: ${JSON.stringify(name)}`);
  seen.add(name);
  try {
    const path = resolve(root, name), target = await realpath(path), rel = relative(root, target);
    if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) throw new Error('Path leaves snapshot');
    const info = await lstat(path);
    if (entry.type === 'symlink') {
      if (name !== 'CLAUDE.md' || entry.target !== 'AGENTS.md') throw new Error('Unexpected symlink');
      if (info.isSymbolicLink()) {
        const link = await readlink(path);
        if (link !== entry.target || hash(link) !== entry.sha256) throw new Error('Changed symlink');
      } else if (!info.isFile() || hash(await readFile(path)) !== hash(await readFile(resolve(root, 'AGENTS.md')))) {
        throw new Error('CLAUDE.md must link to AGENTS.md or contain an identical full-text copy');
      }
    } else {
      if (!info.isFile() || info.isSymbolicLink()) throw new Error('Expected a regular file');
      if (hash(await readFile(path)) !== entry.sha256) throw new Error('SHA-256 mismatch');
    }
  } catch (error) { failures.push(`${name}: ${error.message}`); }
}
for (const name of ['AGENTS.md', 'CLAUDE.md', 'form-coach-v4.11.html', 'package.json', 'package-lock.json',
  'START-HERE.md', 'CONTINUE-PROMPT.md', 'handover/verify-snapshot.mjs', 'handover/BASELINE.json', 'handover/TRANSFER-CHECKS.json'])
  if (!seen.has(name)) failures.push(`Required entry absent: ${name}`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`PASS: ${seen.size} packaged files match. No application/device test or signature verification is implied.`);
}
