#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { assembleWebRelease, writeWebRelease } from './web.mjs';
const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== '--build' || args[2] !== '--out')
  throw new Error('Usage: node release/build-web.mjs --build <source.html> --out <new-directory>');
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(args[3]);
let lastProgress = 'Preparing source input', writing = false;
const progress = message => { lastProgress = message; console.log(message); };
const deadline = setTimeout(() => {
  console.error(`Web build exceeded ten minutes. Last progress: ${lastProgress}. No automatic retry.`);
  if (writing) console.error(`Inspect the incomplete output at ${output}; it is not a completed release.`);
  process.exit(1);
}, 600000);
try {
  const bundle = await assembleWebRelease({ root, build: args[1], progress });
  progress(`Creating fresh output directory: ${output}`);
  await mkdir(dirname(output), { recursive: true });
  writing = true;
  await writeWebRelease(bundle, output, { progress });
  console.log(`Local review build: ${output}`);
  console.log(`${bundle.receipt.voiceClips} clips; ${(bundle.receipt.totalBytes / 1024 / 1024).toFixed(2)} MiB plus receipt; SHA-256 ${bundle.receipt.buildHash}`);
  console.log('NOT publicly launched, installable/offline, licensed for release or device-validated. See release.json and docs/web-release.md.');
} catch (error) {
  console.error(error);
  if (writing) console.error(`Output may be incomplete: ${output}. Existing files were not overwritten; no automatic cleanup or retry.`);
  // Some filesystem metadata calls cannot be aborted. Do not let a failed
  // operation's outstanding request keep the CLI alive after its deadline.
  process.exit(1);
} finally { clearTimeout(deadline); }
