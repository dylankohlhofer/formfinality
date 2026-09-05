import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { chromium } from 'playwright';
import { runTimeline, benignConsoleError } from './lib.mjs';

export async function serve(root, html, recording) {
  const bridge = await readFile(resolve(root, 'testing/bridge.js'), 'utf8');
  const remoteImport = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
  if (!html.includes(remoteImport)) throw new Error('MediaPipe import boundary changed; review browser adapter');
  const instrumented = html.replace(remoteImport, '/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs')
    .replace(/<link[^>]+https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>/g, '')
    .replace('</script>', '\n' + bridge + '\n</script>');
  const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.wasm': 'application/wasm',
    '.json': 'application/json', '.mp4': 'video/mp4', '.webm': 'video/webm', '.css': 'text/css' };
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

export async function runBrowser({ root, html, scenario, frameFor, dir, viewport, recording }) {
  const server = await serve(root, html, recording);
  let browser, context, result;
  const errors = [], consoleLog = [];
  try {
    browser = await chromium.launch();
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
          await page.locator(`.plancard[data-plan="${scenario.plan}"]`).click();
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
          const frame = frameFor(step.pose);
          await page.evaluate(({ frame, dt, n }) => {
            for (let i = 0; i < n; i++) window.__testLab.feed(frame, dt);
          }, { frame, dt, n });
        }
      },
      async skip(via) {
        if (via === 'button') await page.locator('#skipExBtn').click();
        else { await page.locator('body').click({ position: { x: 1, y: 1 } }); await page.keyboard.press('s'); }
      },
      async ui(step, index) {
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
    if (recording) {
      const landmarks = await page.evaluate(() => window.__testLab.landmarks());
      await writeFile(resolve(dir, 'landmarks.json'), JSON.stringify({ schema: 1, frames: landmarks }));
      result.checks.push({ label: 'Real inference ran for every requested video frame', actual: landmarks.length,
        expected: Math.round(videoTime * 30), pass: landmarks.length === Math.round(videoTime * 30) });
    }
    result.checks.push({ label: 'No browser or console errors', actual: errors, expected: [], pass: errors.length === 0 });
    return result;
  } finally {
    await writeFile(resolve(dir, 'console.json'), JSON.stringify(consoleLog, null, 2));
    if (context) await context.tracing.stop({ path: resolve(dir, 'trace.zip') });
    if (browser) await browser.close();
    await server.close();
  }
}
