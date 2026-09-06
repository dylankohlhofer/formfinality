import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { serve } from './browser.mjs';
import { exerciseInputs } from './exercise-inputs.mjs';

export async function shellSweep({ root, html, engine, browser, dir, only }) {
  const server = await serve(root, html), results = [];
  async function runCase(id, description, task) {
    if (only && id !== only) return;
    const evidence = `shell-${id}`, target = resolve(dir, evidence); await mkdir(target);
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    const errors = [], checks = [], logs = [];
    page.on('pageerror', e => { errors.push(e.message); logs.push({ type: 'pageerror', message: e.message, stack: e.stack }); });
    page.on('console', m => { logs.push({ type: m.type(), message: m.text() }); if (m.type() === 'error') errors.push(m.text()); });
    const check = (label, actual, expected) => checks.push({ label, actual, expected, pass: JSON.stringify(actual) === JSON.stringify(expected) });
    let error;
    try {
      await page.route('**/*', route => new URL(route.request().url()).origin === server.url ? route.continue() : route.abort());
      await page.goto(server.url); await page.waitForFunction(() => !!window.__testLab);
      await task(page, check);
      check('No uncaught browser errors', errors, []);
    } catch (e) { error = e.message; }
    finally {
      await page.screenshot({ path: resolve(target, 'screen.png'), fullPage: true });
      await writeFile(resolve(target, 'console.json'), JSON.stringify(logs, null, 2));
      await context.tracing.stop({ path: resolve(target, 'trace.zip') }); await context.close();
    }
    const result = { id: `shell/${id}`, mode: 'shell', evidence, description, checks, error,
      status: error ? 'error' : checks.every(c => c.pass) ? 'passed' : 'failed' };
    await writeFile(resolve(target, 'scenario.json'), JSON.stringify({ id, description, source: 'testing/shell-sweep.mjs' }, null, 2));
    await writeFile(resolve(target, 'result.json'), JSON.stringify(result, null, 2));
    results.push(result); console.log(`${result.status.toUpperCase()} shell/${id}`);
  }
  try {
    await runCase('calibration-demo', 'A beginner choosing Show me first sees a rendered calibration demonstration.', async (page, check) => {
      await page.locator('[data-know="no"]').click(); await page.locator('#calBtn').click();
      await page.locator('#demo').waitFor({ state: 'visible' });
      await page.evaluate(() => window.__testLab.drawDemo());
      check('Calibration demo names Plank', (await page.locator('#demoLabel').innerText()).includes('PLANK'), true);
    });
    await runCase('camera-denied', 'Actual camera error handler, with permission denial substituted for a device prompt.', async (page, check) => {
      await page.evaluate(() => {
        window.__testLab.realCamera();
        navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Test permission denial', 'NotAllowedError'); };
      });
      await page.locator('#calBtn').click();
      await page.getByRole('heading', { name: 'Camera unavailable' }).waitFor();
      check('Skip stays hidden after denied permission', await page.locator('#skipExBtn').isVisible(), false);
      await page.locator('#backBtn').click();
      check('Back returns to session selection', await page.locator('.plancard').count() > 0, true);
    });
    await runCase('camera-start-flip-stop', 'Original camera acquisition and animation loop with a fake local stream and no-detection model. No hardware access.', async (page, check) => {
      await page.evaluate(() => {
        window.__testLab.realCamera(); window.__testLab.mockModel();
        window.testMedia = { opened: 0, stopped: 0 };
        navigator.mediaDevices.getUserMedia = async () => {
          window.testMedia.opened++;
          const c = document.createElement('canvas'); c.width = 640; c.height = 360;
          const ctx = c.getContext('2d'), stream = c.captureStream(10);
          const paint = setInterval(() => ctx.fillRect(0, 0, c.width, c.height), 100);
          for (const track of stream.getTracks()) {
            const stop = track.stop.bind(track);
            track.stop = () => { clearInterval(paint); window.testMedia.stopped++; stop(); };
          }
          return stream;
        };
      });
      await page.locator('#skipBtn').click(); await page.locator('#goBtn').click();
      await page.locator('[data-plan="first-steps"]').click(); await page.locator('#flipBtn').waitFor({ state: 'visible' });
      await page.locator('#flipBtn').click(); await page.waitForFunction(() => window.testMedia.opened === 2);
      await page.locator('#startBtn').click();
      check('Both opened camera tracks are stopped', await page.evaluate(() => window.testMedia), { opened: 2, stopped: 2 });
      check('Stopped camera hides flip', await page.locator('#flipBtn').isVisible(), false);
      check('Stopped camera hides skip', await page.locator('#skipExBtn').isVisible(), false);
    });
    for (const plan of engine.PLANS) for (const tier of plan.tiers) {
      await runCase(`plan-${plan.id}-${tier}`, `${plan.name} at ${tier}: selection, all steps skipped through to debrief.`, async (page, check) => {
        await page.locator('#skipBtn').click(); await page.locator(`[data-t="${tier}"]`).click(); await page.locator('#goBtn').click();
        check('Only plans declared for this tier are offered', await page.locator('.plancard').evaluateAll(xs => xs.map(x => x.dataset.plan).sort()),
          engine.PLANS.filter(p => p.tiers.includes(tier)).map(p => p.id).sort());
        await page.locator(`[data-plan="${plan.id}"]`).click();
        for (let i = 0; i < 60 && !(await page.evaluate(() => window.__testLab.snapshot().done)); i++) await page.locator('#skipExBtn').click();
        check('Plan reaches the debrief', await page.locator('#msgInner h2').innerText(), 'Session complete');
        const result = await page.evaluate(() => window.__testLab.snapshot().finish);
        check('Every output is unattempted, not zero', result.out.every(p => p.skipped && p.score === null), true);
        check('Unattempted plan has no average', result.avg, null);
        check('Each output appears in the debrief', await page.locator('.prow.skipped').count(), result.out.length);
      });
    }
    await runCase('voice-queue', 'Real Coach queue with simulated clip/TTS completion: priority, stale pending speech, interruption and reset. Not acoustic validation.', async (page, check) => {
      const states = await page.evaluate(() => {
        const { Coach, AudioBank } = window.__testLab.audioAccess();
        let now = 1000, stopped = 0, cancelled = 0; const ends = [], spoken = [];
        Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
        AudioBank.play = (_paths, end) => { ends.push(end); return true; };
        AudioBank.stop = () => stopped++;
        speechSynthesis.cancel = () => cancelled++;
        speechSynthesis.speak = u => spoken.push(u);
        const c = new Coach(), item = (text, pri, ttl = 800) => ({ text, pri, ttl, at: now, clips: ['test.mp3'] });
        c.push(item('ambient', 0)); c.push(item('control', 3));
        const interrupted = c.cur.text === 'control' && stopped === 1 && cancelled === 1;
        ends[0](); const oldCallbackIgnored = c.cur.text === 'control';
        c.push(item('correction', 2)); c.push(item('ambient again', 0));
        const pendingPriority = c.pending.text === 'correction';
        now += 2000; ends[1](); const expiredDiscarded = !c.speaking() && !c.pending;
        AudioBank.play = () => false;
        c.push(item('fallback', 2)); const ttsStarted = spoken.length === 1 && c.speaking();
        c.reset(); spoken[0].onend();
        return { interrupted, oldCallbackIgnored, pendingPriority, expiredDiscarded, ttsStarted,
          reset: !c.speaking() && !c.pending && cancelled === 2 };
      });
      for (const [name, value] of Object.entries(states)) check(name, value, true);
    });
    await runCase('recorded-clip-order', 'Real AudioBank sequence with controlled audio events: clips must play serially.', async (page, check) => {
      const result = await page.evaluate(async () => {
        const { AudioBank } = window.__testLab.audioAccess();
        const started = [], audio = {}, clips = ['intro', 'number', 'unit']; let finished = 0;
        AudioBank.get = key => audio[key] ||= { play: () => { started.push(key); return Promise.resolve(); }, currentTime: 0 };
        AudioBank.play(clips, () => finished++);
        const initial = started.join(','); audio.intro.onended(); const second = started.join(',');
        audio.number.onended(); audio.unit.onended();
        return { initial, second, final: started.join(','), finished };
      });
      check('Recorded speech is sequential', result, { initial: 'intro', second: 'intro,number', final: 'intro,number,unit', finished: 1 });
    });
    await runCase('recorded-clip-cancel', 'Stopping a sequence invalidates delayed play rejection and ended callbacks, but new speech still completes. Controlled media events.', async (page, check) => {
      const result = await page.evaluate(async () => {
        const { AudioBank } = window.__testLab.audioAccess();
        const started = [], paused = []; let rejectOld, oldFinished = 0, newFinished = 0, errorFinished = 0;
        AudioBank.get = key => {
          if (!AudioBank.cache.has(key)) AudioBank.cache.set(key, {
            currentTime: 0, pause: () => paused.push(key),
            play: () => {
              started.push(key);
              if (key === 'old-intro') return new Promise((_resolve, reject) => { rejectOld = reject; });
              if (key === 'broken') return Promise.reject(new Error('deliberate active clip failure'));
              return Promise.resolve();
            }
          });
          return AudioBank.cache.get(key);
        };
        AudioBank.play(['old-intro', 'old-tail'], () => oldFinished++);
        const staleEnded = AudioBank.cache.get('old-intro').onended;
        AudioBank.stop();
        AudioBank.play(['new-intro', 'new-tail'], () => newFinished++);
        rejectOld(new DOMException('Paused while loading', 'AbortError'));
        await Promise.resolve(); await Promise.resolve(); staleEnded();
        const afterCancelledCallbacks = [...started];
        AudioBank.cache.get('new-intro').onended(); AudioBank.cache.get('new-tail').onended();
        AudioBank.play(['broken', 'recovered'], () => errorFinished++);
        await Promise.resolve(); await Promise.resolve(); AudioBank.cache.get('recovered').onended();
        return { afterCancelledCallbacks, paused, oldFinished, newFinished, errorFinished };
      });
      check('Late rejection and ended callback cannot restart old clips', result.afterCancelledCallbacks, ['old-intro', 'new-intro']);
      check('Stop pauses the cached old clips', result.paused, ['old-intro', 'old-tail']);
      check('Abandoned sequence does not report completion', result.oldFinished, 0);
      check('New sequence still completes', result.newFinished, 1);
      check('Active clip errors still advance the current sequence', result.errorFinished, 1);
    });
    const fakePlayback = async page => {
      await page.waitForFunction(() => window.__testLab.audioAccess().AudioBank.enabled);
      await page.evaluate(() => {
        const { AudioBank, coach } = window.__testLab.audioAccess();
        document.getElementById('voice').checked = true;
        window.clipEnds = [];
        AudioBank.play = (_paths, end) => { window.clipEnds.push(end); return true; };
        AudioBank.stop = () => {};
        speechSynthesis.cancel = () => {};
        speechSynthesis.speak = u => window.clipEnds.push(() => u.onend());
        window.seedOldSpeech = () => {
          coach.reset();
          const item = text => ({ text, clips: ['test.mp3'], pri: 3, at: performance.now(), ttl: Infinity });
          coach.push(item('abandoned current')); coach.push(item('abandoned pending'));
          window.staleVoiceEnd = window.clipEnds.at(-1);
        };
      });
    };
    await runCase('skip-voice-context', 'Button/keyboard Skip clear current and pending speech before rest/teaching/debrief. Focus guard must not cancel speech. Simulated playback.', async (page, check) => {
      await fakePlayback(page);
      await page.evaluate(() => window.__testLab.installPlan({ id: 'skip-voice', name: 'First Steps', tiers: ['learning'],
        steps: [{ ex: 'plank', t: 30 }, { rest: 12 }, { ex: 'glute-bridge', t: 8 }] }));
      await page.locator('#skipBtn').click(); await page.locator('[data-t="learning"]').click(); await page.locator('#goBtn').click();
      await page.locator('[data-plan="skip-voice"]').click();
      await page.evaluate(() => {
        window.seedOldSpeech(); const input = document.createElement('input'); input.id = 'skip-focus'; document.body.append(input); input.focus();
      });
      await page.keyboard.press('s');
      check('Typing S leaves current speech alone', await page.evaluate(() => window.__testLab.audioAccess().coach.cur.text), 'abandoned current');
      check('Typing S leaves pending speech alone', await page.evaluate(() => window.__testLab.audioAccess().coach.pending.text), 'abandoned pending');
      check('Typing S does not advance', (await page.evaluate(() => window.__testLab.snapshot())).index, 0);
      await page.locator('#skip-focus').evaluate(el => el.remove());
      for (const [via, expected] of [['button', 'rest'], ['key', 'glute'], ['button', 'debrief']]) {
        await page.evaluate(() => window.seedOldSpeech());
        if (via === 'button') await page.locator('#skipExBtn').click(); else await page.keyboard.press('s');
        const state = await page.evaluate(() => {
          const { coach } = window.__testLab.audioAccess(), current = coach.cur;
          window.staleVoiceEnd();
          return { text: coach.cur?.text || '', pending: coach.pending?.text || '', oldCallbackIgnored: coach.cur === current,
            snapshot: window.__testLab.snapshot() };
        });
        check(`${via} Skip clears abandoned speech`, ![state.text, state.pending].some(x => x.startsWith('abandoned')), true);
        check(`${via} Skip ignores previous completion callback`, state.oldCallbackIgnored, true);
        if (expected === 'debrief') check('Final Skip reaches unscored debrief', state.snapshot.done && state.snapshot.finish.avg === null, true);
        else check(`Next ${expected} instruction starts`, new RegExp(expected, 'i').test(state.text), true);
      }
    });
    await runCase('calibration-skip-voice', 'Calibration Skip preserves the watched hold and both verdict utterances while discarding old speech. Simulated playback, real core.', async (page, check) => {
      await fakePlayback(page); await page.locator('#calBtn').click();
      const frame = exerciseInputs(JSON.parse(await readFile(resolve(root, 'conformance-vectors.json'))).poses).frame('plank');
      const before = await page.evaluate(frame => {
        const { coach } = window.__testLab.audioAccess();
        coach.reset(); // Teaching finished: exercise begins with no audio gate.
        for (let i = 0; i < 195; i++) window.__testLab.feed(frame, 1 / 30);
        const result = window.__testLab.snapshot(); window.seedOldSpeech(); return result;
      }, frame);
      check('Calibration watched about five seconds', before.held >= 4.5 && before.held <= 5.5, true);
      await page.keyboard.press('s');
      const result = await page.evaluate(() => {
        const { coach } = window.__testLab.audioAccess();
        const held = coach.cur, verdict = coach.pending; window.staleVoiceEnd();
        const staleIgnored = coach.cur === held;
        window.clipEnds.at(-1)();
        return { verdict: window.__testLab.snapshot().calibration, staleIgnored,
          heldSpoken: !!held && !held.text.startsWith('abandoned'), verdictSpoken: !!verdict && coach.cur === verdict };
      });
      check('Calibration Skip keeps Learning verdict', result.verdict.tierId, 'learning');
      check('Calibration Skip preserves watched time', result.verdict.held, before.held);
      check('Old callback cannot swallow held-time speech', result.staleIgnored && result.heldSpoken, true);
      check('Calibration verdict still follows held-time speech', result.verdictSpoken, true);
    });
  } finally { await server.close(); }
  return results;
}
