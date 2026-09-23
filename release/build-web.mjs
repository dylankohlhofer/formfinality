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
const deadline = setTimeout(() => { console.error('Web build exceeded ten minutes; check local file availability. No automatic retry.'); process.exit(1); }, 600000);
try {
  const bundle = await assembleWebRelease({ root, build: args[1], progress: console.log });
  await mkdir(dirname(output), { recursive: true });
  await writeWebRelease(bundle, output);
  console.log(`Local review build: ${output}`);
  console.log(`${bundle.receipt.voiceClips} clips; ${(bundle.receipt.totalBytes / 1024 / 1024).toFixed(2)} MiB plus receipt; SHA-256 ${bundle.receipt.buildHash}`);
  console.log('NOT publicly launched, installable/offline, licensed for release or device-validated. See release.json and docs/web-release.md.');
} finally { clearTimeout(deadline); }
