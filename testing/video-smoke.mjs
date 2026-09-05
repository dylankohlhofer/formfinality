#!/usr/bin/env node
// Generate a explicitly non-human fixture; tests inference wiring and absence of
// false observations, NOT pose accuracy. No webcam permission or personal video.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const build = process.argv[2];
if (!build) throw new Error('Usage: node testing/video-smoke.mjs <build.html>');
const browser = await chromium.launch();
let bytes;
try {
  const page = await browser.newPage();
  bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#888'; ctx.fillRect(0, 0, 640, 360);
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
    const chunks = [];
    recorder.ondataavailable = event => chunks.push(event.data);
    const stopped = new Promise(resolve => { recorder.onstop = resolve; });
    const paint = setInterval(() => { ctx.fillRect(0, 0, 640, 360); }, 33);
    recorder.start(); await new Promise(resolve => setTimeout(resolve, 4000));
    recorder.stop(); await stopped; clearInterval(paint); stream.getTracks().forEach(t => t.stop());
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  });
} finally { await browser.close(); }
await mkdir(new URL('./private/', import.meta.url), { recursive: true });
const recording = fileURLToPath(new URL('./private/synthetic-blank.webm', import.meta.url));
await writeFile(recording, Buffer.from(bytes));
const result = spawnSync(process.execPath, ['testing/run.mjs', '--build', build, '--mode', 'video',
  '--scenario', 'skip-and-dropout', '--recording', recording], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
