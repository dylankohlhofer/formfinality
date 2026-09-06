// Deliberately broken TEST-COPY playback must fail the real capture path. Keep
// these permanent: unit tests on fabricated evidence alone cannot prove the tap.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { audioSweep } from './audio-sweep.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const html = await readFile(resolve(root, 'form-coach-v4.11.html'), 'utf8');
await mkdir(resolve(root, 'test-results'), { recursive: true });
const dir = await mkdtemp(resolve(root, 'test-results/audio-mutation-'));
await writeFile(resolve(dir, 'build.html'), html);
console.log(`Audio mutation evidence: ${dir}`);

test('real decoded playback control is audible and sequential', async () => {
  const [r] = await audioSweep({ root, html, dir: resolve(dir, 'control'), only: 'clips-steady-building', repeatFailures: false,
    verification: { variant: 'healthy control', expected: 'passes', source: 'testing/audio-capture.test.mjs' } });
  assert.equal(r.status, 'passed', JSON.stringify(r));
});
test('muting actual media elements is caught as silence', async () => {
  const [r] = await audioSweep({ root, html, dir: resolve(dir, 'silence'), only: 'clips-steady-building', repeatFailures: false,
    verification: { variant: 'deliberately muted media elements', expected: 'silence assertions fail; NOT an app bug', source: 'testing/audio-capture.test.mjs' },
    mutate: page => page.evaluate(() => {
      const { AudioBank } = window.__testLab.audioAccess(), get = AudioBank.get;
      AudioBank.get = function(path) { const a = get.call(this, path); if (a) a.muted = true; return a; };
    }) });
  assert.ok(!r.error, r.error);
  assert.ok(r.checks.some(c => !c.pass && c.label.includes('non-silent')), JSON.stringify(r));
});
test('bypassing the queue makes real clips overlap and is caught', async () => {
  const [r] = await audioSweep({ root, html, dir: resolve(dir, 'overlap'), only: 'clips-steady-building', repeatFailures: false,
    verification: { variant: 'deliberately bypassed Coach queue', expected: 'overlap assertion fails; NOT an app bug', source: 'testing/audio-capture.test.mjs' },
    mutate: page => page.evaluate(() => {
      const { coach } = window.__testLab.audioAccess(); coach.push = item => coach.start(item);
    }) });
  assert.ok(!r.error, r.error);
  assert.ok(r.checks.some(c => !c.pass && c.label.includes('overlapping')), JSON.stringify(r));
});
test('initial silence stays in the recording and preserves timeline alignment', async () => {
  const [r] = await audioSweep({ root, html, dir: resolve(dir, 'initial-silence'), only: 'clips-steady-building', repeatFailures: false,
    verification: { variant: 'delay first clip by 1s', expected: 'recording retains initial silence and passes duration check', source: 'testing/audio-capture.test.mjs' },
    mutate: page => page.evaluate(() => {
      const begin = window.__audioLab.begin;
      window.__audioLab.begin = async options => { await begin(options); await new Promise(resolve => setTimeout(resolve, 1000)); };
    }) });
  assert.equal(r.status, 'passed', JSON.stringify(r));
  const e = JSON.parse(await readFile(resolve(dir, 'initial-silence/audio-clips-steady-building/audio.json')));
  assert.ok(e.decoded.seconds >= 4.8, JSON.stringify(e.decoded));
  // A decodable blob is not enough: the saved, offline review must also play
  // and seek successfully. MediaRecorder WebM may initially report Infinity
  // duration; the recorded timeline buttons must still work.
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(resolve(dir, 'initial-silence/audio-clips-steady-building/audio-review.html')).href);
    const at = await page.locator('audio').evaluate(async audio => {
      await audio.play(); audio.pause();
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Saved recording cannot seek')), 5000);
        audio.onseeked = () => { clearTimeout(timeout); resolve(); }; audio.currentTime = 1.5;
      });
      return audio.currentTime;
    });
    assert.ok(Math.abs(at - 1.5) < .05);
  } finally { await browser.close(); }
});
