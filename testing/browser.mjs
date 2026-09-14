import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { chromium } from 'playwright';
import { runTimeline, benignConsoleError, compactEffects } from './lib.mjs';

export async function serve(root, html, recording, { audio = false } = {}) {
  const bridge = await readFile(resolve(root, 'testing/bridge.js'), 'utf8') +
    (audio ? '\n' + await readFile(resolve(root, 'testing/audio-bridge.js'), 'utf8') : '');
  const remoteImport = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
  if (!html.includes(remoteImport)) throw new Error('MediaPipe import boundary changed; review browser adapter');
  const instrumented = html.replace(remoteImport, '/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs')
    .replace(/<link[^>]+https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>/g, '')
    .replace('</script>', '\n' + bridge + '\n</script>');
  const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.wasm': 'application/wasm',
    '.json': 'application/json', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.css': 'text/css' };
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (path === '/') { res.setHeader('Content-Type', 'text/html'); res.end(instrumented); return; }
      if (path === '/favicon.ico') { res.writeHead(204); res.end(); return; }
      // Do not expose the repository, .git, credentials, or arbitrary private files.
      let file;
      if (path === '/recording' && recording) file = recording;
      else if (path === '/model.task') file = resolve(root, 'testing/assets/pose_landmarker_lite.task');
      else if (path.startsWith('/node_modules/@mediapipe/tasks-vision/') || path.startsWith('/voice/')) {
        file = await realpath(resolve(root, '.' + path));
        const allowed = path.startsWith('/voice/') ? resolve(root, 'voice') : resolve(root, 'node_modules/@mediapipe/tasks-vision');
        if (!file.startsWith(allowed + sep)) throw new Error('Path outside allowed assets');
      } else { res.writeHead(404); res.end(); return; }
      const { size } = await stat(file);
      res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
      // Browser seeking needs byte ranges for many MP4 encodings.
      const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
      if (range) {
        const start = Number(range[1]), end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
        if (start > end || start >= size) { res.writeHead(416); res.end(); return; }
        res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
        createReadStream(file, { start, end }).on('error', error => res.destroy(error)).pipe(res);
      } else createReadStream(file).on('error', error => res.destroy(error)).pipe(res);
    } catch (error) { res.writeHead(error.code === 'ENOENT' ? 404 : 500); res.end('Test asset unavailable'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}

export async function runBrowser({ root, html, scenario, frameFor, dir, viewport, recording, sharedBrowser }) {
  const server = await serve(root, html, recording);
  let browser, context, result;
  const errors = [], consoleLog = [];
  try {
    browser = sharedBrowser || await chromium.launch();
    context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', e => { errors.push(e.message); consoleLog.push({ type: 'pageerror', text: e.message, stack: e.stack }); });
    page.on('console', m => {
      consoleLog.push({ type: m.type(), text: m.text(), classifiedInfo: benignConsoleError(m.text()) });
      if (m.type() === 'error' && !benignConsoleError(m.text())) errors.push(m.text());
    });
    await page.route('**/*', route => new URL(route.request().url()).origin === server.url
      ? route.continue() : route.abort('blockedbyclient'));
    await page.goto(server.url);
    await page.waitForFunction(() => !!window.__testLab);
    if (scenario.planSpec) await page.evaluate(plan => window.__testLab.installPlan(plan), scenario.planSpec);
    let started = false, videoReady = false, videoTime = 0;
    const adapter = {
      snapshot: () => page.evaluate(() => window.__testLab.snapshot()),
      async start(core) {
        if (core === 'calibration') await page.locator('#calBtn').click();
        else {
          if (await page.locator('#okBtn').count()) await page.locator('#okBtn').click();
          else if (!started) {
            await page.locator('#skipBtn').click();
            await page.locator(`.tiercard[data-t="${scenario.tier}"]`).click();
            await page.locator('#goBtn').click();
          }
          await page.locator(`.plancard[data-plan="${scenario.plan}"]`).click(); await page.locator('#planStartBtn').click();
        }
        await page.locator('#skipExBtn').waitFor({ state: 'visible' }); started = true;
        if (recording && !videoReady) {
          await page.evaluate(() => window.__testLab.prepareVideo('/recording')); videoReady = true;
        }
        if (recording) await page.evaluate(() => window.__testLab.videoDimensions());
      },
      async frames(step) {
        const n = Math.ceil(step.seconds * 30), dt = step.seconds / n;
        if (recording) {
          for (let i = 0; i < n; i++) {
            await page.evaluate(({ at, dt }) => window.__testLab.videoFrame(at, dt), { at: videoTime, dt });
            videoTime += dt;
          }
        } else {
          const frames = Array.from({ length: n }, (_, i) => frameFor(step.pose, i * dt));
          await page.evaluate(({ frames, dt }) => {
            for (const frame of frames) window.__testLab.feed(frame, dt);
          }, { frames, dt });
        }
      },
      async skip(via) {
        if (via === 'button') await page.locator('#skipExBtn').click();
        else { await page.locator('body').click({ position: { x: 1, y: 1 } }); await page.keyboard.press('s'); }
      },
      async followAlong() { await page.locator('#followAlongBtn').click(); },
      async finishAlong() { await page.locator('#finishAlongBtn').click(); },
      async ui(step, index) {
        if (step.do === 'demo') {
          await page.locator('#showBtn').click();
          const visible = await page.locator('#demo').isVisible();
          await page.evaluate(() => window.__testLab.drawDemo());
          const demo = await page.locator('#demoCanvas').evaluate(c => {
            const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let lit = 0; for (let i = 0; i < data.length; i += 4) if (data[i] > 100) lit++;
            return lit > 100;
          });
          await page.locator('#ghostChk').check();
          await page.evaluate(() => window.__testLab.drawGhost());
          const ghost = await page.locator('#overlay').evaluate(c => c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0));
          await page.screenshot({ path: resolve(dir, `step-${index}.png`), fullPage: true });
          await page.locator('#showBtn').click();
          return [{ label: step.label, step: index, actual: { visible, demo, ghost }, expected: { visible: true, demo: true, ghost: true }, pass: visible && demo && ghost }];
        }
        if (step.do === 'csv') {
          const downloading = page.waitForEvent('download');
          await page.locator('#csvDlBtn').click();
          const download = await downloading;
          const path = resolve(dir, 'telemetry.csv'); await download.saveAs(path);
          const csv = await readFile(path, 'utf8'), header = csv.split(/\r?\n/)[0];
          const pass = header.includes('movement') && header.includes('state') && csv.includes(scenario.movement || 'plank');
          return [{ label: step.label, actual: { header, bytes: csv.length }, expected: 'CSV with movement and state data', pass }];
        }
        if (step.do === 'focusGuard') {
          const checks = [];
          for (const tag of ['input', 'select', 'textarea', 'div']) {
            const before = await adapter.snapshot();
            await page.evaluate(tag => {
              const el = document.createElement(tag); el.id = 'test-focus';
              if (tag === 'div') el.contentEditable = 'true';
              document.body.append(el); el.focus();
            }, tag);
            await page.keyboard.press('s');
            checks.push({ label: `S does not skip while ${tag} has focus`, step: index,
              actual: (await adapter.snapshot()).index, expected: before.index,
              pass: (await adapter.snapshot()).index === before.index });
            await page.locator('#test-focus').evaluate(el => el.remove());
          }
          await page.screenshot({ path: resolve(dir, `step-${index}.png`), fullPage: true });
          return checks;
        }
        const loc = page.locator(step.selector);
        let actual, expected;
        if (Object.hasOwn(step, 'count')) { actual = await loc.count(); expected = step.count; }
        else if (Object.hasOwn(step, 'visible')) { actual = await loc.isVisible(); expected = step.visible; }
        else { actual = await loc.innerText(); expected = step.text; }
        return [{ label: step.label, step: index, actual, expected, pass: actual === expected }];
      },
      capture: index => page.screenshot({ path: resolve(dir, `step-${index}.png`), fullPage: true })
    };
    result = await runTimeline(scenario, adapter);
    result.effects = await page.evaluate(() => window.__testLab.effects());
    if (scenario.movement) result.effects = compactEffects(result.effects);
    if (recording) {
      const landmarks = await page.evaluate(() => window.__testLab.landmarks());
      await writeFile(resolve(dir, 'landmarks.json'), JSON.stringify({ schema: 1, frames: landmarks }));
      result.checks.push({ label: 'Every video tick retained real inference or an explicit unassessed interval', actual: landmarks.length,
        expected: Math.round(videoTime * 30), pass: landmarks.length === Math.round(videoTime * 30) });
    }
    result.checks.push({ label: 'No browser or console errors', actual: errors, expected: [], pass: errors.length === 0 });
    return result;
  } finally {
    await writeFile(resolve(dir, 'console.json'), JSON.stringify(consoleLog, null, 2));
    if (context) await context.tracing.stop({ path: resolve(dir, 'trace.zip') });
    if (context) await context.close();
    if (browser && !sharedBrowser) await browser.close();
    await server.close();
  }
}
