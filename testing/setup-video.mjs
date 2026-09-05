#!/usr/bin/env node
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { hash } from './lib.mjs';
const url = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const response = await fetch(url);
if (!response.ok) throw new Error(`Model download failed: ${response.status}`);
const data = Buffer.from(await response.arrayBuffer());
const manifest = JSON.parse(await readFile(new URL('./model.json', import.meta.url)));
if (hash(data) !== manifest.sha256) throw new Error('Model checksum mismatch; do not bless a changed model automatically');
await mkdir(new URL('./assets/', import.meta.url), { recursive: true });
await writeFile(new URL('./assets/pose_landmarker_lite.task', import.meta.url), data);
console.log(`Model downloaded locally: SHA-256 ${hash(data)}`);
