// Deliberately broken TEST-COPY playback must fail the real capture path. Keep
// these permanent: unit tests on fabricated evidence alone cannot prove the tap.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { audioSweep } from './audio-sweep.mjs';
import { registerAudioSpliceTests } from './audio-splice-cases.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const html = await readFile(resolve(root, process.env.FORM_COACH_TEST_BUILD || 'form-coach-v4.11.html'), 'utf8');
await mkdir(resolve(root, 'test-results'), { recursive: true });
const dir = await mkdtemp(resolve(root, 'test-results/audio-mutation-'));
await writeFile(resolve(dir, 'build.html'), html);
console.log(`Audio mutation evidence: ${dir}`);

test('real decoded playback control is audible and sequential', async () => {
  const [r] = await audioSweep({ root, html, dir: resolve(dir, 'control'), only: 'clips-steady-building', repeatFailures: false,
    verification: { variant: 'healthy control', expected: 'passes', source: 'testing/audio-capture.test.mjs' } });
  assert.equal(r.status, 'passed', JSON.stringify(r));
});
test('a legally delayed second number is captured through its real media completion', async () => {
  // Pre-read the exact source bytes so this tests capture finalization, not
  // variable filesystem latency. Slow only this TEST-COPY second clip enough
  // to cross the old four-second cutoff, while retaining the original 3s TTL.
  const clips = new Map(await Promise.all([1,2].map(async n => [String(n),
    await readFile(resolve(root, `voice/warm/num/${n}.mp3`))])));
  // Keep the failing fixed-window capture as a permanent negative control and
  // retain it beside the healthy completion-aware run. No retry-to-green.
  for (const fixedCutoff of [true, false]) {
    const target = resolve(dir, fixedCutoff ? 'delayed-number-fixed-cutoff' : 'delayed-number-completion');
    const [r] = await audioSweep({ root, html, dir: target, only: 'clips-warm-building', repeatFailures: false,
      verification: { variant: `${fixedCutoff ? 'force the old fixed 4s cutoff; ' : ''}first response at 0.5s, second at 2.7s with real Warm two at 0.65x speed`,
        expected: fixedCutoff ? 'second-number completion assertion fails; capture-policy negative control, NOT an app bug'
          : 'both clips complete with measured signal; 3000ms start deadlines unchanged', source: 'testing/audio-capture.test.mjs' },
      mutate: async page => {
        if (fixedCutoff) await page.evaluate(() => {
          // Force the sampler to finish at its unchanged 4s minimum, reproducing
          // the former policy without changing media/Coach completion or TTLs.
          window.__audioLab.captureStatus = () => ({busy:false, quietMs:1000});
        });
        await page.evaluate(() => {
          const sequence = window.__audioLab.sequence;
          window.__audioLab.sequence = () => { window.__numberControlStart = performance.now(); return sequence(); };
          const { AudioBank } = window.__testLab.audioAccess(), get = AudioBank.get;
          AudioBank.get = function(path) {
            const a = get.call(this, path);
            if (a && path === 'voice/warm/num/2.mp3') a.playbackRate = .65;
            return a;
          };
        });
        await page.route('**/voice/warm/num/*.mp3', async route => {
          const number = new URL(route.request().url()).pathname.match(/\/(\d+)\.mp3$/)?.[1];
          if (!clips.has(number)) return route.continue();
          await page.evaluate(async targetMs => {
            const remaining = window.__numberControlStart + targetMs - performance.now();
            if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
          }, number === '1' ? 500 : 2700);
          await route.fulfill({ status: 200, contentType: 'audio/mpeg', body: clips.get(number) });
        });
      } });
    const e = JSON.parse(await readFile(resolve(target, 'audio-clips-warm-building/audio.json')));
    const second = e.events.find(e => e.type === 'clip-start' && e.item?.text === '2');
    assert.ok(second, 'The delayed second recording must actually start');
    assert.equal(second.item.ttl, 3000);
    assert.ok(second.ms - second.item.requestedMs >= 2600 && second.ms - second.item.requestedMs < 3000,
      `Actual delayed media start must be inside the original deadline: ${JSON.stringify(second)}`);
    if (fixedCutoff) {
      assert.ok(!r.error, r.error);
      assert.equal(r.status, 'failed');
      assert.deepEqual(r.checks.filter(c => !c.pass).map(c => c.label),
        ['Number 2 actually plays to completion with measured signal']);
      assert.equal(e.events.find(e => e.type === 'clip-end' && e.playId === second.playId)?.reason, 'paused');
      continue;
    }
    assert.equal(r.status, 'passed', JSON.stringify(r));
    const end = e.events.find(e => e.type === 'clip-end' && e.playId === second.playId);
    assert.equal(end?.reason, 'ended');
    assert.ok(end.ms - second.item.requestedMs > 4000, 'Control must exercise audio beyond the old capture cutoff');
    assert.ok(e.events.find(e => e.type === 'capture-end').ms > end.ms);
    assert.equal(e.captureWindow.reason, 'settled');
    assert.ok(e.captureWindow.elapsedMs > 4000 && e.captureWindow.elapsedMs < 7000);
  }
});
test('pausing pending real playback is retained as cancellation, with per-request ownership on reuse', async () => {
  const target = resolve(dir, 'pending-pause');
  const [r] = await audioSweep({ root, html, dir: target, only: 'clips-steady-building', repeatFailures: false,
    verification: { variant: 'pause pending playback then reuse the same element', expected: 'observed AbortError cancellation is retained; the next request plays', source: 'testing/audio-capture.test.mjs' },
    mutate: page => page.evaluate(() => {
      const sequence = window.__audioLab.sequence;
      window.__audioLab.sequence = async () => {
        const a = window.__testLab.audioAccess().AudioBank.get('voice/steady/num/3.mp3');
        const first = a.play(); a.pause();
        const second = a.play(); // Start before the first rejection callback runs.
        let rejected = false;
        await first.catch(error => {
          if (error.name !== 'AbortError') throw error;
          rejected = true;
        });
        if (!rejected) throw new Error('The pending-play cancellation was not exercised');
        await second; a.pause();
        return sequence();
      };
    }) });
  assert.equal(r.status, 'passed', JSON.stringify(r));
  const e = JSON.parse(await readFile(resolve(target, 'audio-clips-steady-building/audio.json')));
  const requests = e.events.filter(e => e.type === 'clip-request' && e.path === 'voice/steady/num/3.mp3');
  assert.equal(requests.length, 2);
  const cancelled = e.events.filter(e => e.type === 'clip-cancelled');
  assert.equal(cancelled.length, 1);
  assert.equal(cancelled[0].playId, requests[0].playId);
  assert.equal(cancelled[0].errorName, 'AbortError');
  // The marker and log sample the clock separately; require ordering/ownership,
  // not identical rounded timestamps from those two reads.
  assert.ok(e.events.some(e => e.type === 'clip-pause-request' && e.playId === requests[0].playId &&
    e.ms >= cancelled[0].pausedAt && e.ms <= cancelled[0].ms));
  assert.ok(e.events.some(e => e.type === 'clip-start' && e.playId === requests[1].playId));
  assert.ok(!e.events.some(e => e.type === 'clip-start' && e.playId === requests[0].playId));
  assert.match(await readFile(resolve(target, 'audio-clips-steady-building/audio-review.html'), 'utf8'), /clip-cancelled/);
});
for (const variant of ['unrequested-abort', 'paused-decode-error', 'reused-unrequested-abort']) {
  test(`the capture tap still fails ${variant}`, async () => {
    const target = resolve(dir, variant);
    const [r] = await audioSweep({ root, html, dir: target, only: 'clips-steady-building', repeatFailures: false,
      verification: { variant, expected: 'real playback-error assertion fails; NOT an app bug', source: 'testing/audio-capture.test.mjs' },
      mutate: page => page.evaluate(variant => {
        const nativePlay = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function() {
          if (this.src.endsWith('/voice/steady/num/3.mp3'))
            return Promise.reject(new DOMException('Deliberate capture mutation', variant === 'paused-decode-error' ? 'NotSupportedError' : 'AbortError'));
          return nativePlay.call(this);
        };
        const sequence = window.__audioLab.sequence;
        window.__audioLab.sequence = async () => {
          const a = window.__testLab.audioAccess().AudioBank.get('voice/steady/num/3.mp3');
          const pending = a.play();
          if (variant !== 'unrequested-abort') a.pause();
          await pending.catch(() => {}); // The independent tap must still fail.
          if (variant === 'reused-unrequested-abort') await a.play().catch(() => {});
          return sequence();
        };
      }, variant) });
    assert.ok(!r.error, r.error);
    const failure = r.checks.find(c => !c.pass && c.label === 'No media load, playback or capture errors');
    assert.ok(failure, JSON.stringify(r));
    assert.equal(failure.actual.length, 1);
    assert.equal(failure.actual[0].errorName, variant === 'paused-decode-error' ? 'NotSupportedError' : 'AbortError');
    const e = JSON.parse(await readFile(resolve(target, 'audio-clips-steady-building/audio.json')));
    assert.equal(e.events.filter(e => e.type === 'clip-cancelled').length, variant === 'reused-unrequested-abort' ? 1 : 0);
    if (variant === 'reused-unrequested-abort') {
      const requests = e.events.filter(e => e.type === 'clip-request' && e.path === 'voice/steady/num/3.mp3');
      assert.equal(failure.actual[0].playId, requests[1].playId);
      assert.equal(failure.actual[0].pausedAt, null);
    }
  });
}
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
test('a stalled second number cannot pass on the first audible number', async () => {
  const target=resolve(dir,'stalled-second-number');
  const [r] = await audioSweep({root,html,dir:target,only:'clips-steady-building',repeatFailures:false,
    verification:{variant:'withhold the second number response',expected:'second number completion/signal check fails; NOT an app bug',source:'testing/audio-capture.test.mjs'},
    // Leave precisely this request unanswered until the test closes its context.
    mutate:page=>page.route('**/voice/steady/num/2.mp3',()=>{})});
  assert.ok(!r.error,r.error);
  assert.ok(r.checks.find(c=>c.label==='Number 1 actually plays to completion with measured signal')?.pass,JSON.stringify(r));
  assert.equal(r.checks.find(c=>c.label==='Number 2 actually plays to completion with measured signal')?.pass,false);
  const e=JSON.parse(await readFile(resolve(target,'audio-clips-steady-building/audio.json')));
  assert.ok(e.events.some(e=>e.type==='coach-decision' && e.event==='failed' && e.item.text==='2' && e.ms<3500),
    'An unavailable number must release the queue within its original 3s deadline, not after the 25s watchdog');
  assert.ok(!e.events.some(e=>e.type==='tts-request'),'No unsolicited TTS fallback');
});
test('an unanswered first clip retries once and both real numbers still finish', async()=>{
  const target=resolve(dir,'recover-first-request');let requests=0;
  const [r]=await audioSweep({root,html,dir:target,only:'clips-steady-building',repeatFailures:false,
    verification:{variant:'withhold only the first number request',expected:'fresh retry recovers actual complete audio within the original deadlines',source:'testing/audio-capture.test.mjs'},
    mutate:page=>page.route('**/voice/steady/num/1.mp3',route=>{if(++requests>1)return route.continue();})});
  assert.equal(r.status,'passed',JSON.stringify(r));assert.equal(requests,2);
  const e=JSON.parse(await readFile(resolve(target,'audio-clips-steady-building/audio.json')));
  const loads=e.events.filter(e=>e.type==='clip-request' && e.path==='voice/steady/num/1.mp3');
  assert.equal(loads.length,2);
  assert.ok(e.events.some(e=>e.type==='clip-cancelled' && e.playId===loads[0].playId));
  assert.ok(!e.events.some(e=>e.type==='clip-start' && e.playId===loads[0].playId));
  assert.ok(e.events.some(e=>e.type==='clip-start' && e.playId===loads[1].playId));
  assert.equal(e.events.filter(e=>e.type==='clip-stalled' && e.retry).length,1);
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
    const at = await page.locator('#audio').evaluate(async audio => {
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

registerAudioSpliceTests({root,html,dir});
