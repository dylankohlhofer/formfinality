import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { serve } from './browser.mjs';

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
  } finally { await server.close(); }
  return results;
}
