// FC-LAB-007 proposed prompt policy, deliberately red against the old build.
// Run: node --test testing/setup-prompt.test.mjs
// FORM_COACH_TEST_BUILD selects an alternate build, as in the existing regressions.
//
// Policy: five seconds of setup grace, THEN six continuous seconds of relevant,
// visible quality-gate failure. Setup grace is elapsed movement time; positioning,
// missing observations, clipping and wrong/limited view never earn difficulty time.
// Earliest setup offer: 11 seconds (allow two sample intervals for clock rounding).
// Active difficulty needs a fresh six-second window after arming, without another
// setup grace. Recovery/observation gaps reset difficulty and withdraw an open offer
// in the same tick. Offer at most once per movement, including after Keep going;
// the optional offer is visual only; acceptance still teaches the easier movement.
// entering another movement resets eligibility/grace. Existing six-second evaluator
// timing motivates the duration; five seconds is an explicit proposed UX policy,
// NOT evidence from beginner testing. Existing 7s/8s offer tests need an intentional,
// documented timeline update by the production owner, not an expectation inversion.
//
// Evidence boundary: all landmarks here are synthetic exercise-inputs fixtures.
// Most cases override ONLY Evaluator.read(bodyLine) to isolate a quality blocker
// from positioning; null represents an unavailable reading. Evaluation, smoothing,
// timing, arming and effects remain real. These are not recovered user measurements
// or anatomical validation. The bent-hip plank control uses geometry with no override.
// The browser case uses real Keep going clicks, with the same labelled metric
// override; camera/model/audio execution remains bypassed by the existing bridge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { loadEngine } from './lib.mjs';
import { exerciseInputs } from './exercise-inputs.mjs';
import { serve } from './browser.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const html = await readFile(process.env.FORM_COACH_TEST_BUILD || new URL('../form-coach-v4.11.html', import.meta.url), 'utf8');
const E = await loadEngine(html);
const inputs = exerciseInputs(JSON.parse(await readFile(new URL('../conformance-vectors.json', import.meta.url), 'utf8')).poses);
const GRACE = 5, DIFFICULTY = 6;
const GAPS = ['null', 'confidence', 'upright', 'view', 'limited-view', 'unknown-view',
  'clipped', 'quality-null', 'quality-confidence', 'position-null', 'position-confidence'];

function session({ fps = 30, id = 'plank', tier = 'learning', steps = [{ ex: id, t: 100 }] } = {}) {
  const core = new E.SessionCore({ name: 'Prompt regression', steps }, tier,
    { speaking: () => false, portrait: () => false, hasDemo: () => true });
  const s = { core, fps, dt: 1 / fps, ticks: 0, visible: false, events: [], last: null };
  s.add = effects => {
    for (const effect of effects) {
      s.events.push({ ...effect, at: s.ticks / fps });
      if (effect.t === 'regressShow') s.visible = true;
      if (effect.t === 'regressHide') s.visible = false;
    }
    return effects;
  };
  s.step = frame => {
    const effects = s.add(core.tick(frame, s.dt, ++s.ticks / fps));
    s.last = { effects, r: effects.find(e => e.t === 'telem')?.r ?? null, state: core.state };
    return s.last;
  };
  s.feed = (seconds, frame = inputs.frame(core.mvId)) => {
    const count = Math.round(seconds * fps);
    assert.ok(Math.abs(seconds * fps - count) < 1e-6, 'Use complete input frames');
    for (let i = 0; i < count; i++) s.step(frame);
    return s.last;
  };
  s.shows = () => s.events.filter(e => e.t === 'regressShow');
  s.add(core.start());
  return s;
}

function controlledQuality(s, initial = 100) {
  const ev = s.core.ev, read = ev.read.bind(ev);
  let value = initial;
  // 100 degrees fails the declared plank bodyLine gate; other targets keep their
  // original readings. Undefined restores geometry; null removes this reading.
  ev.read = (target, frame) => target.id === 'bodyLine' && value !== undefined ? value : read(target, frame);
  return next => { value = next; };
}

function assertDifficulty(r) {
  assert.equal(r?.ok, true, 'Fixture is observed');
  assert.equal(r.inPosition, true, 'Positioning is a passing control');
  assert.equal(r.inPose, false, 'Quality actually blocks the starting shape');
  assert.equal(r.framing.verdict, 'framed');
  assert.ok(r.readings.some(x => x.t.id === 'bodyLine' && x.t.gate && !x.t.pos && x.s === 0));
}

function recover(s, quality) {
  quality(undefined);
  for (let i = 0; i < s.fps; i++) {
    const tick = s.step(inputs.frame(s.core.mvId));
    if (tick.r?.inPose) return tick;
  }
  assert.fail('The independently authored good fixture must recover within a second');
}

function gap(kind) {
  if (kind === 'null') return null;
  if (kind === 'upright') return inputs.frame('squat');
  const frame = inputs.frame('plank', 0, {
    confidence: kind === 'confidence' ? 0 : .95,
    view: kind === 'view' ? 0 : kind === 'limited-view' ? 35 : 90,
    clipped: kind === 'clipped'
  });
  // Average frame confidence remains high; the actual failed gate's hip is not
  // visible. A numeric metric override is not evidence that this joint was seen.
  if (kind === 'quality-confidence') for (const side of ['left', 'right']) frame[side].hip.c = 0;
  // A missing position reading can leave inPosition true because the evaluator
  // omits unavailable readings. Prompt eligibility still needs observed position;
  // this test does not ask for changes to the evaluator's arming/counting rules.
  if (kind === 'position-null') for (const side of ['left', 'right']) delete frame[side].knee;
  if (kind === 'position-confidence') for (const side of ['left', 'right']) frame[side].knee.c = 0;
  if (kind === 'unknown-view') frame.sideness = null;
  return frame;
}

for (const fps of [15, 30, 60]) {
  test(`setup grace precedes six continuous seconds of measured difficulty at ${fps}fps`, () => {
    const s = session({ fps }); controlledQuality(s);
    s.feed(GRACE + DIFFICULTY + 2 / fps);
    assertDifficulty(s.last.r);
    assert.equal(s.core.state, 'setup');
    assert.equal(s.core.ev.hold, 0, 'Prompt policy must not start the hold');
    assert.equal(s.shows().length, 1, 'The legitimate easier alternative remains reachable');
    assert.ok(s.shows()[0].at >= GRACE + DIFFICULTY - 1e-6,
      `First offer at ${s.shows()[0].at}s must respect the explicit 11s policy`);
    assert.ok(s.shows()[0].at <= GRACE + DIFFICULTY + 2 / fps + 1e-6);
    assert.match(s.shows()[0].text, /knee plank/i);
  });

  test(`long positioning cannot fund an offer on the first difficult plank at ${fps}fps`, () => {
    const s = session({ fps }); controlledQuality(s);
    s.feed(20, gap('upright'));
    assert.equal(s.last.r.inPosition, false);
    assert.equal(s.shows().length, 0);
    s.feed(3);
    assertDifficulty(s.last.r);
    assert.equal(s.shows().length, 0, 'Twenty seconds standing is not twenty seconds of plank difficulty');
    s.feed(4);
    assert.equal(s.shows().length, 1, 'Six fresh seconds of visible difficulty still lead to help');
  });

  test(`recovery withdraws an offer before the 1.8s arming window at ${fps}fps`, () => {
    const s = session({ fps }), quality = controlledQuality(s);
    s.feed(12); assert.equal(s.visible, true, 'Offer was actually shown');
    const recovered = recover(s, quality);
    assert.equal(recovered.state, 'setup', 'This assertion must run before arming');
    assert.ok(recovered.effects.some(e => e.t === 'regressHide'), 'First measured recovery withdraws the choice without a click');
    assert.equal(s.visible, false);
    s.feed(2);
    assert.equal(s.core.state, 'active');
    assert.equal(s.visible, false, 'Offer stays absent after arming');
  });

  test(`arming clears setup prompt state and does not revive it at ${fps}fps`, () => {
    const s = session({ fps }), quality = controlledQuality(s);
    s.feed(12); assert.equal(s.visible, true);
    quality(undefined);
    let armed;
    for (let i = 0; i < 3 * fps; i++) {
      const tick = s.step(inputs.frame('plank'));
      if (tick.state === 'active') { armed = tick; break; }
    }
    assert.ok(armed, 'Good fixture arms the exercise');
    assert.equal(s.visible, false, 'The arming transition cannot retain the setup offer');
    quality(100); s.feed(8);
    assert.equal(s.shows().length, 1, 'Arming must preserve the once-per-movement offer budget');
  });

  test(`active offer needs fresh sustained difficulty and withdraws on recovery at ${fps}fps`, () => {
    const s = session({ fps }); s.feed(3);
    assert.equal(s.core.state, 'active');
    const quality = controlledQuality(s);
    const began = s.ticks / fps;
    s.feed(5); assert.equal(s.shows().length, 0);
    s.feed(2); assert.equal(s.shows().length, 1);
    assert.ok(s.shows()[0].at >= began + DIFFICULTY - 1e-6);
    assertDifficulty(s.last.r);
    const recovered = recover(s, quality);
    assert.equal(recovered.state, 'active');
    assert.ok(recovered.effects.some(e => e.t === 'regressHide'));
    assert.equal(s.visible, false);
  });

  test(`arming discards unoffered setup difficulty credit at ${fps}fps`, () => {
    const s = session({ fps }); s.feed(GRACE, null);
    const quality = controlledQuality(s);
    s.feed(4); assertDifficulty(s.last.r);
    assert.equal(s.shows().length, 0);
    quality(undefined); s.feed(3);
    assert.equal(s.core.state, 'active');
    quality(100); s.feed(3);
    assert.equal(s.shows().length, 0, 'Four setup seconds plus three active seconds is not a continuous difficulty');
    s.feed(4);
    assert.equal(s.shows().length, 1, 'Active difficulty starts a reachable fresh window');
  });

  for (const state of ['setup', 'active']) {
    for (const kind of GAPS) {
      test(`${state}: ${kind} gap resets difficulty credit at ${fps}fps`, () => {
        const s = session({ fps });
        if (state === 'active') s.feed(3); else s.feed(GRACE, null);
        const quality = controlledQuality(s);
        s.feed(4); assertDifficulty(s.last.r);
        assert.equal(s.shows().length, 0, 'Four seconds is insufficient');
        if (kind === 'quality-null') quality(null);
        s.feed(1, gap(kind));
        assert.equal(s.shows().length, 0, 'Unknown position/quality/view cannot itself justify an offer');
        quality(100);
        s.feed(3);
        assertDifficulty(s.last.r);
        assert.equal(s.shows().length, 0, 'An interruption resets rather than pauses difficulty time');
        s.feed(4);
        assert.equal(s.shows().length, 1, 'An uninterrupted fresh window remains reachable');
      });
    }
  }
}

for (const state of ['setup', 'active']) {
  for (const kind of GAPS) {
    test(`${state}: an open offer is withdrawn when ${kind} removes its evidence`, () => {
      const s = session();
      if (state === 'active') s.feed(3);
      const quality = controlledQuality(s);
      s.feed(12); assert.equal(s.visible, true);
      if (kind === 'quality-null') quality(null);
      // Position is smoothed for holds; require same-tick withdrawal once the
      // evaluator reports loss, without changing that measurement behaviour.
      let unsupported;
      for (let i = 0; i < s.fps; i++) {
        const tick = s.step(gap(kind));
        if (kind.startsWith('quality-') || kind.startsWith('position-') || kind === 'unknown-view' ||
          !tick.r?.inPosition || tick.r?.viewLimited) { unsupported = tick; break; }
      }
      assert.ok(unsupported, 'Fixture actually removes the supporting evidence');
      assert.ok(unsupported.effects.some(e => e.t === 'regressHide'), 'Withdraw in the first unsupported evaluation');
      assert.equal(s.visible, false);
    });
  }

  test(`${state}: repeated short quality transients never become sustained difficulty`, () => {
    const s = session();
    if (state === 'active') s.feed(3);
    const quality = controlledQuality(s);
    for (let i = 0; i < 4; i++) {
      quality(100); s.feed(4); assertDifficulty(s.last.r);
      quality(undefined); s.feed(.5);
      assert.equal(s.last.r.inPose, true, 'Every pulse genuinely recovers under the evaluator');
    }
    assert.equal(s.shows().length, 0, 'Separate four-second difficulties cannot accumulate');
  });

  test(`${state}: the easier offer stays visual until the user accepts`, () => {
    const s = session();
    if (state === 'active') s.feed(3);
    controlledQuality(s); s.feed(12);
    assert.equal(s.shows().length, 1, 'Optional help remains available');
    assert.equal(s.events.some(e => e.t === 'say' && e.key === 'regress'), false,
      'Do not announce a change the user has not chosen');
    assert.equal(s.events.some(e => e.t === 'say' && e.key === 'teach.knee-plank'), false);
    const accepted = s.add(s.core.swapToRegression());
    assert.ok(accepted.some(e => e.t === 'say' && e.key === 'teach.knee-plank'),
      'Acceptance still teaches the selected movement');
  });
}

test('synthetic bent-hip plank geometry, without metric overrides, retains its declared easier alternative', () => {
  const s = session(), frame = inputs.frame('plank');
  for (const side of ['left', 'right']) {
    const p = frame[side];
    p.hip.y += .21;
    // Keep the leg straight while bending at the hip, so this fixture does not
    // accidentally fail the separate legsStraight POSITION gate.
    p.knee.x = (p.hip.x + p.ankle.x) / 2;
    p.knee.y = (p.hip.y + p.ankle.y) / 2;
  }
  s.feed(12, frame); assertDifficulty(s.last.r);
  assert.equal(s.shows().length, 1);
  assert.match(s.shows()[0].text, /knee plank/i);
  s.add(s.core.swapToRegression());
  assert.equal(s.core.mvId, 'knee-plank');
  assert.equal(s.core.state, 'setup');
  assert.equal(s.visible, false);
  assert.equal(s.core.ev.hold, 0);
  s.feed(3);
  assert.equal(s.core.state, 'active', 'The declared easier alternative is usable');
});

test('accepting a measured plank offer teaches the declared knee plank with fresh setup', () => {
  const s = session(); controlledQuality(s);
  s.feed(12); assert.equal(s.visible, true);
  const effects = s.add(s.core.swapToRegression());
  assert.equal(s.core.mvId, 'knee-plank');
  assert.equal(s.core.state, 'setup');
  assert.equal(s.core.ev.hold, 0);
  assert.equal(s.visible, false);
  assert.ok(effects.some(e => e.t === 'say' && e.key === 'teach.knee-plank'));
  s.feed(3);
  assert.equal(s.core.state, 'active');
  assert.equal(s.shows().length, 1, 'The easier movement has no invented next regression');
});

test('skip through rest clears the old offer and grants the next movement its own grace and budget', () => {
  const s = session({ steps: [{ ex: 'plank', t: 100 }, { rest: 10 }, { ex: 'plank', t: 100 }] });
  controlledQuality(s); s.feed(12); assert.equal(s.visible, true);
  s.add(s.core.skip('user'));
  assert.equal(s.visible, false);
  assert.equal(s.core.mv, null);
  assert.equal(s.core.out[0].score, null);
  assert.equal(s.core.out[0].skipped, true);
  s.feed(1, null); s.add(s.core.skip('user'));
  assert.equal(s.core.state, 'setup');
  controlledQuality(s); const began = s.ticks / s.fps;
  s.feed(12);
  assert.equal(s.shows().length, 2, 'Each phase gets one independent offer');
  assert.ok(s.shows()[1].at >= began + GRACE + DIFFICULTY - 1e-6, 'Prior movement/rest time is not fresh setup time');
  s.add(s.core.skip('user'));
  assert.equal(s.core.done, true);
  assert.equal(s.visible, false, 'Finishing by skip cannot retain a choice');
});

test('normal completion resets the prompt budget and grace for the next movement', () => {
  const s = session({ steps: [{ ex: 'plank', t: 10 }, { ex: 'plank', t: 100 }] });
  const quality = controlledQuality(s); s.feed(12);
  quality(undefined);
  for (let i = 0; i < 12 * s.fps && s.core.i === 0; i++) s.step(inputs.frame('plank'));
  assert.equal(s.core.i, 1);
  assert.equal(s.core.state, 'setup');
  assert.equal(s.visible, false);
  controlledQuality(s); const began = s.ticks / s.fps;
  s.feed(12);
  assert.equal(s.shows().length, 2);
  assert.ok(s.shows()[1].at >= began + GRACE + DIFFICULTY - 1e-6);
});

for (const tier of ['building', 'strong']) {
  test(`${tier} retains its declared no-automatic-regression policy`, () => {
    const s = session({ tier }); controlledQuality(s); s.feed(20);
    assertDifficulty(s.last.r);
    assert.equal(s.shows().length, 0);
  });
}

test('browser: Keep going dismisses once and cannot reoffer through recovery, arming or recurrence', async () => {
  // Test-only access in the served string; no production or bridge file is edited.
  const served = html.replace('</script>', '\nwindow.__setupPromptCore = () => sess.core;\n</script>');
  const server = await serve(root, served); let browser;
  const errors = [];
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(5000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/*', route => new URL(route.request().url()).origin === server.url ? route.continue() : route.abort());
    await page.goto(server.url); await page.waitForFunction(() => !!window.__testLab);
    await page.evaluate(() => __testLab.installPlan({ id: 'setup-prompt', name: 'Core Strength', tiers: ['learning'], steps: [{ ex: 'plank', t: 100 }] }));
    await page.locator('#skipBtn').click();
    await page.locator('[data-t="learning"]').click();
    await page.locator('#goBtn').click();
    await page.locator('[data-plan="setup-prompt"]').click();
    await page.evaluate(frame => {
      const core = __setupPromptCore(), read = core.ev.read.bind(core.ev);
      window.__setupPromptBlocked = true;
      core.ev.read = (target, observation) => __setupPromptBlocked && target.id === 'bodyLine' ? 100 : read(target, observation);
      for (let i = 0; i < 360; i++) __testLab.feed(frame, 1 / 30);
    }, inputs.frame('plank'));
    assert.equal(await page.locator('#regressNo').isVisible(), true, 'A real offer precedes dismissal');
    await page.locator('#regressNo').click();
    assert.equal(await page.locator('#regressNo').isVisible(), false);
    await page.evaluate(frame => {
      for (let i = 0; i < 600; i++) __testLab.feed(frame, 1 / 30);
      window.__setupPromptBlocked = false;
      for (let i = 0; i < 90; i++) __testLab.feed(frame, 1 / 30);
      window.__setupPromptBlocked = true;
      for (let i = 0; i < 240; i++) __testLab.feed(frame, 1 / 30);
    }, inputs.frame('plank'));
    assert.equal(await page.evaluate(() => __setupPromptCore().state), 'active');
    assert.equal(await page.evaluate(() => __testLab.effects().filter(e => e.t === 'regressShow').length), 1);
    assert.equal(await page.locator('#regressNo').isVisible(), false);
    assert.deepEqual(errors, [], 'Unexpected shell errors fail the case');
  } finally {
    try { await browser?.close(); } finally { await server.close(); }
  }
});

// Three bounded viewport tests, each exercising BOTH choices in fresh contexts.
// Keep all earlier engine policy assertions unchanged. The demo opens BEFORE the
// offer arrives: no force clicks, synthetic click events or injected display CSS.
for (const size of [
  { name: 'desktop', viewport: { width: 1280, height: 900 }, touch: false },
  { name: 'portrait', viewport: { width: 390, height: 844 }, touch: true },
  { name: 'landscape', viewport: { width: 844, height: 390 }, touch: true }
]) {
  test(`browser: ${size.name} demo and easier choice never overlap and both ordinary choices work`, { timeout: 30000 }, async t => {
    // Simultaneous-display policy: the prompt and actual drawing canvas do not
    // overlap; both choices receive pointer input and leave the demo available.
    // Portrait also exercises real consent/start/flag controls and header wrapping.
    // These are Chromium viewport/touch checks, not physical-device validation.
    const served = html.replace('</script>', '\nwindow.__setupPromptCore = () => sess.core;\n</script>');
    const server = await serve(root, served); let browser;
    // Optional review artifacts, one image per viewport; default runs write none.
    const screenshots = process.env.FORM_COACH_PROMPT_SCREENSHOTS;
    try {
      if (screenshots) await mkdir(screenshots, { recursive: true });
      browser = await chromium.launch();
      for (const choice of ['Keep going', 'Yes, show me']) {
        const page = await browser.newPage({ viewport: size.viewport, hasTouch: size.touch, isMobile: size.touch });
        page.setDefaultTimeout(3000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        try {
          await page.route('**/*', route => new URL(route.request().url()).origin === server.url ? route.continue() : route.abort());
          await page.goto(server.url); await page.waitForFunction(() => !!window.__testLab);
          await page.evaluate(() => __testLab.installPlan({ id: 'demo-prompt', name: 'Core Strength', tiers: ['learning'], steps: [{ ex: 'plank', t: 100 }] }));
          await page.locator('#skipBtn').click();
          await page.locator('[data-t="learning"]').click();
          await page.locator('#goBtn').click();
          await page.locator('[data-plan="demo-prompt"]').click();
          if (size.name === 'portrait') {
            await page.locator('#diagToggle').click();
            await page.locator('#diagConsent').check();
            await page.locator('#diagStart').click();
            await page.waitForFunction(() => __testLab.diagnosticAccess().diagnostics.active && !document.querySelector('#diagPanel').open);
            await page.locator('#diagQuickFlag').click();
            assert.equal(await page.locator('#diagQuickFlag').isVisible(), true);
          }
          await page.evaluate(frame => {
            const core = __setupPromptCore(), read = core.ev.read.bind(core.ev);
            // Controlled quality reading; observation/timing and shell remain real.
            core.ev.read = (target, observation) => target.id === 'bodyLine' ? 100 : read(target, observation);
            for (let i = 0; i < 30; i++) __testLab.feed(frame, 1 / 30);
          }, inputs.frame('plank'));
          await page.locator('#showBtn').click();
          assert.equal(await page.locator('#demo').isVisible(), true);
          assert.equal(await page.locator('#regress').isVisible(), false, 'The demo opens within setup grace');
          await page.evaluate(frame => {
            for (let i = 0; i < 330; i++) __testLab.feed(frame, 1 / 30);
            __testLab.drawDemo();
          }, inputs.frame('plank'));
          assert.equal(await page.locator('#demo').isVisible(), true, 'Offering help must not close the demo');
          assert.equal(await page.locator('#regress').isVisible(), true, 'Both panels are displayed');
          assert.equal(await page.evaluate(() => __setupPromptCore().state), 'setup');
          const layout = await page.evaluate(() => {
            const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
            return { offer: rect('#regress'), drawing: rect('#demoCanvas'), header: rect('header') };
          });
          if (screenshots && choice === 'Keep going') {
            const path = resolve(screenshots, `${size.name}-demo-offer.png`);
            await page.screenshot({ path, animations: 'disabled' });
            t.diagnostic(`Simultaneous demo/offer screenshot: ${path}`);
          }
          const { offer, drawing } = layout;
          assert.ok(offer.width > 0 && offer.height > 0 && drawing.width > 0 && drawing.height > 0,
            'Both bounding boxes represent displayed content');
          assert.ok(offer.right <= drawing.left || drawing.right <= offer.left ||
            offer.bottom <= drawing.top || drawing.bottom <= offer.top,
          `${choice}: the easier choice must not obscure any part of the demo canvas: ${JSON.stringify(layout)}`);
          for (const id of ['regressNo', 'regressYes']) {
            const access = await page.locator(`#${id}`).evaluate(button => {
              const r = button.getBoundingClientRect();
              return {
                inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
                receivesPointer: button.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2))
              };
            });
            assert.equal(access.inside, true, `${id} fits within the viewport`);
            assert.equal(access.receivesPointer, true, `${id} is not covered by the demo or header`);
            await page.locator(`#${id}`).click({ trial: true });
          }
          if (size.name === 'portrait') await page.locator('#diagQuickFlag').click({ trial: true });
          await page.locator(choice === 'Keep going' ? '#regressNo' : '#regressYes').click();
          assert.equal(await page.locator('#regress').isVisible(), false, 'The selected choice dismisses the offer');
          assert.equal(await page.locator('#demo').isVisible(), true, 'The demonstration remains available after either choice');
          const result = await page.evaluate(() => ({
            movement: __setupPromptCore().mvId,
            state: __setupPromptCore().state,
            offers: __testLab.effects().filter(e => e.t === 'regressShow').length,
            teaching: __testLab.effects().filter(e => e.t === 'say' && e.key === 'teach.knee-plank').length
          }));
          assert.equal(result.movement, choice === 'Keep going' ? 'plank' : 'knee-plank');
          assert.equal(result.state, 'setup');
          assert.equal(result.offers, 1);
          assert.equal(result.teaching, choice === 'Keep going' ? 0 : 1, 'Acceptance alone teaches the easier exercise');
          assert.deepEqual(errors, [], 'Unexpected browser errors fail the case');
          t.diagnostic(`${choice}: accessible; prompt and demo canvas have no overlap${size.name === 'portrait' ? '; local recording and quick flag active' : ''}`);
        } finally {
          await page.close();
        }
      }
    } finally {
      try { await browser?.close(); } finally { await server.close(); }
    }
  });
}
