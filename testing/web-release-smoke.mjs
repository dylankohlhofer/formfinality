#!/usr/bin/env node
// Exercise the emitted artifact, not the test-instrumented app. No webcam, user
// data or external requests. CPU blank-canvas inference is only a wiring check.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { loadVerifiedArtifact, sha256 } from '../release/web.mjs';
import { benignConsoleError } from './lib.mjs';
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--dir') throw new Error('Usage: node testing/web-release-smoke.mjs --dir <built-directory>');
let lastProgress = 'Loading release receipt';
const deadline = setTimeout(() => {
  console.error(`Web artifact smoke exceeded 90 seconds; incomplete, not passed. Last progress: ${lastProgress}`);
  process.exit(1);
}, 90000);
const root = resolve(args[1]);
let artifact;
try {
  artifact = await loadVerifiedArtifact(root, { progress: message => { lastProgress = message; console.log(message); } });
} catch (error) {
  console.error(error);
  process.exit(1);
}
const { receipt, receiptBytes, files } = artifact;
lastProgress = 'Assets verified; starting browser, preview, model and audio checks';
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript',
  '.json':'application/json','.wasm':'application/wasm','.mp3':'audio/mpeg'};
const headers = Object.fromEntries(files.get('/_headers').toString().split('\n').filter(l => l.startsWith('  ')).map(line => {
  const i = line.indexOf(':'); return [line.slice(0,i).trim(),line.slice(i+1).trim()];
}));
const server = createServer((req,res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  const name = path === '/' ? '/index.html' : path;
  const bytes = files.get(name);
  res.writeHead(bytes ? 200 : 404, {...headers,'Content-Type':types[extname(name)] || 'application/octet-stream'});
  res.end(bytes || 'Not found');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const dir = resolve('test-results', `web-release-${Date.now()}-${process.pid}`);
await mkdir(dir, {recursive:true});
const result = { schema:'web-release-smoke/1', buildHash:receipt.buildHash, releaseHash:sha256(receiptBytes),
  status:'failed', requests:[], console:[], limitations:[
    'CPU inference on blank canvas, not shipped GPU camera path or body recognition.',
    'Clip decoding/signal, not listening, pronunciation or physical speakers.',
    'Loopback HTTP with host-style headers, not a deployed HTTPS origin or offline install.',
    'Chromium only; Safari, Windows Edge and physical devices still need testing.' ] };
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  const errors = [], external = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    result.console.push({type:m.type(),text:m.text()});
    if (m.type() === 'error' && !benignConsoleError(m.text())) errors.push(m.text());
  });
  await page.route('**/*', route => {
    const url = route.request().url(); result.requests.push(url.replace(origin, ''));
    if (new URL(url).origin !== origin) { external.push(url); return route.abort(); }
    return route.continue();
  });
  const response = await page.goto(origin);
  assert.equal(response.headers()['x-robots-tag'], 'noindex, nofollow');
  assert.equal((await page.request.get(origin + '/.git/config')).status(), 404);
  assert.equal((await page.request.get(origin + '/testing/private/user.mov')).status(), 404);
  await page.locator('#skipBtn').click();
  await page.locator('.tiercard[data-t="learning"]').click();
  await page.locator('#goBtn').click();
  await page.locator('.plancard').first().click();
  await page.locator('#planStartBtn').waitFor({state:'visible'});
  await page.screenshot({path:resolve(dir,'workout-preview.png'),fullPage:true});
  result.inference = await page.evaluate(async () => {
    const { FilesetResolver, PoseLandmarker } = await import('./vendor/vision_bundle.mjs');
    const vision = await FilesetResolver.forVisionTasks('./vendor/wasm');
    const model = await PoseLandmarker.createFromOptions(vision, {baseOptions:{modelAssetPath:'./models/pose_landmarker_lite.task',delegate:'CPU'},runningMode:'VIDEO',numPoses:1});
    try {
      const canvas = document.createElement('canvas'); canvas.width=640; canvas.height=360;
      const ctx = canvas.getContext('2d'); ctx.fillStyle='#888'; ctx.fillRect(0,0,640,360);
      return {frames:3,detections:[1,34,67].map(at => model.detectForVideo(canvas,at).landmarks.length)};
    } finally { model.close(); }
  });
  assert.deepEqual(result.inference.detections,[0,0,0]);
  result.clip = await page.evaluate(async () => {
    const manifest = await (await fetch('./voice/manifest.json')).json();
    const name = 'voice/warm/num/2.mp3';
    if (!manifest.includes(name)) throw new Error('Missing Warm two');
    const context = new AudioContext();
    try {
      const decoded = await context.decodeAudioData(await (await fetch(name)).arrayBuffer());
      const data = decoded.getChannelData(0);
      let power = 0; for (const value of data) power += value*value;
      return {name, duration:decoded.duration, rms:Math.sqrt(power/data.length)};
    } finally { await context.close(); }
  });
  assert.ok(result.clip.duration > 0 && result.clip.rms > .00001);
  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
  result.status='passed';
} catch (error) { result.error=error.stack; process.exitCode=1; }
finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  await writeFile(resolve(dir,'result.json'),JSON.stringify(result,null,2)+'\n');
}
console.log(`Web review artifact ${result.status}: ${dir}`);
if (result.error) console.error(result.error);
clearTimeout(deadline);
