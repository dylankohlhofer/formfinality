import { readFile } from 'node:fs/promises';
import { exerciseInputs } from './exercise-inputs.mjs';
const frame = exerciseInputs(JSON.parse(await readFile(new URL('../conformance-vectors.json', import.meta.url))).poses).frame('plank');

const summary = '#diagPanel > summary';
const drawerControls = ['#diagConsent', '#diagStart', '#diagStop', '#diagFlag', '#diagExport', '#diagClear', '#diagReview', '#diagImport', '#diagClose'];
const viewports = [
  ['portrait', { width: 390, height: 844 }],
  ['landscape', { width: 844, height: 390 }],
  ['desktop', { width: 1280, height: 800 }]
];
const savedEntries = page => page.evaluate(() => __testLab.diagnosticAccess().diagnostics.snapshot().entries);
const workout = page => page.evaluate(() => __testLab.snapshot());
const stageSize = page => page.locator('#stage').evaluate(el => {
  const { width, height } = el.getBoundingClientRect(); return { width, height };
});
async function openRecorder(page) {
  await page.locator(summary).click();
  await page.locator('#diagBody').waitFor({ state: 'visible' });
}
async function startRecorder(page, check) {
  await page.locator('#diagStart').click();
  await page.waitForFunction(() => __testLab.diagnosticAccess().diagnostics.active);
  await page.locator('#diagBody').waitFor({ state: 'hidden' });
  check('Start or Resume automatically closes the native disclosure', await page.locator('#diagPanel').evaluate(el => el.open), false);
}
async function closeRecorder(page, check, via = 'button') {
  if (via === 'escape') {
    await page.keyboard.press('Tab');
    check('Keyboard reaches the open drawer before Escape', await page.locator('#diagBody').evaluate(el => el.contains(document.activeElement)), true);
    await page.keyboard.press('Escape');
  }
  // Opening the native summary leaves keyboard focus on it even when the fixed
  // drawer covers its pointer target. Enter must retain native toggle behavior.
  else if (via === 'summary keyboard') await page.keyboard.press('Enter');
  else await page.locator('#diagClose').click();
  await page.locator('#diagBody').waitFor({ state: 'hidden' });
  check(`${via} closes the native disclosure`, await page.locator('#diagPanel').evaluate(el => el.open), false);
  check(`${via} returns focus to the summary`, await page.locator(summary).evaluate(el => document.activeElement === el), true);
}
async function reachable(page, check, selectors, when) {
  for (const selector of selectors) {
    const control = page.locator(selector);
    // Normal scrolling plus a hit test catches controls clipped by the drawer or
    // covered by workout chrome. Disabled controls still need to be readable.
    await control.scrollIntoViewIfNeeded();
    check(`${when}: ${selector} fits and is uncovered`, await control.evaluate(el => {
      const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { withinViewport: r.width > 0 && r.height > 0 && r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
        uncovered: !!hit && el.contains(hit) };
    }), { withinViewport: true, uncovered: true });
    if (await control.isEnabled()) await control.click({ trial: true });
  }
}
async function importRecording(page, data, name) {
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#diagImport').click();
  await (await chooser).setFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await page.locator('#diagViewer').waitFor({ state: 'visible' });
}
async function seekEntry(page, index) {
  const seek = page.locator('#diagSeek');
  const max = Number(await seek.getAttribute('max'));
  if (!Number.isInteger(index) || index < 0 || index > max) throw new Error(`Saved entry ${index} is outside the replay timeline`);
  const fromEnd = index > max / 2;
  await seek.press(fromEnd ? 'End' : 'Home');
  for (let i = 0, steps = fromEnd ? max - index : index; i < steps; i++) await seek.press(fromEnd ? 'ArrowLeft' : 'ArrowRight');
}

export async function diagnosticCases(runCase) {
  await runCase('diagnostic-off', 'Normal exercise never opts the person into private diagnostic capture.', async(page,check)=>{
    await page.locator('#calBtn').click(); await page.evaluate(f=>{for(let i=0;i<90;i++)__testLab.feed(f,1/30);},frame);
    check('No diagnostic entries without opt-in',await page.evaluate(()=>__testLab.diagnosticAccess().diagnostics.items.length),0);
  });
  await runCase('diagnostic-export-replay', 'Opt-in capture, flag, export, local replay, clear and import work without saving pixels or uploading.', async(page,check,capture)=>{
    await openRecorder(page); await page.locator('#diagConsent').check(); await startRecorder(page, check);
    await page.locator('#calBtn').click();
    await page.evaluate(f=>{for(let i=0;i<90;i++)__testLab.feed(f,1/30);__testLab.feed(null,1/30);},frame);
    await openRecorder(page); await page.locator('#diagFlag').click(); await closeRecorder(page, check);
    await page.locator('#skipExBtn').click(); await openRecorder(page); await page.locator('#diagStop').click();
    const countBefore=await page.evaluate(()=>__testLab.diagnosticAccess().diagnostics.items.length);
    const entriesBefore = await savedEntries(page);
    await startRecorder(page, check); await openRecorder(page); await page.locator('#diagStop').click();
    check('Resume preserves the previous recording',await page.evaluate(()=>__testLab.diagnosticAccess().diagnostics.items.length)>countBefore,true);
    check('Resume preserves every earlier entry unchanged', JSON.stringify((await savedEntries(page)).slice(0, entriesBefore.length)) === JSON.stringify(entriesBefore), true);
    const download=page.waitForEvent('download'); await page.locator('#diagExport').click();
    const file=await download, text=await readFile(await file.path(),'utf8'), data=JSON.parse(text);
    check('Export uses the current snapshot schema', data.schema, 'formcoach-diagnostic/2');
    check('Export includes a source fingerprint', /^[a-f0-9]{64}$/.test(data.meta.scriptSha256),true);
    check('Flag is retained',data.entries.some(e=>e.kind==='flag'),true);
    check('Tracking loss remains null, not invented geometry or zero score',data.entries.some(e=>e.kind==='frame'&&e.data.frame===null&&e.data.score===null),true);
    check('Export contains observed joint frames',data.entries.some(e=>e.kind==='frame'&&e.data.frame),true);
    check('Frame payload has joints but no pixels/media',data.entries.filter(e=>e.kind==='frame'&&e.data.frame).every(e=>Object.keys(e.data.frame).sort().join(',')==='aspect,cam,conf,left,right,sideness'),true);
    check('Skip is present in timeline',data.entries.some(e=>e.data.event==='skipped'),true);
    await page.locator('#diagReview').click(); check('Saved replay is available',await page.locator('#diagViewer').isVisible(),true);
    await page.locator('#diagViewer details summary').click();
    await seekEntry(page, data.entries.findIndex(e=>e.kind==='frame'));
    check('Replay is labelled saved evidence, not reassessment',/Saved observations/.test(await page.locator('#diagReadout').innerText()),true);
    await capture('replay');
    await page.locator('#diagClear').click();
    check('Clear revokes consent and erases retained entries',await page.evaluate(()=>!document.getElementById('diagConsent').checked&&__testLab.diagnosticAccess().diagnostics.items.length===0),true);
    data.meta.version='<img src=x onerror="window.injectedDiagnostic=true">';
    const legacy = { schema: 'formcoach-diagnostic/1', meta: { version: data.meta.version, scriptSha256: data.meta.scriptSha256 },
      dropped: data.dropped, replay: data.replay, entries: data.entries.filter(e => e.kind !== 'summary') };
    // Schema 1 predates periodic summary entries; its fixture uses only the
    // original entry kinds. The current snapshot below is imported in full.
    // Import the actual current snapshot, including its metadata extras, and the
    // older file envelope. Neither path invents a new test-only buffer API.
    for (const [name, imported] of [['legacy', legacy], ['snapshot', data]]) {
      await importRecording(page, imported, `${name}.json`);
      check(`${name}: imported data never executes markup`,await page.evaluate(()=>window.injectedDiagnostic===undefined&&document.querySelectorAll('#diagReadout img').length===0),true);
      check(`${name}: imported markup is shown as literal evidence`, (await page.locator('#diagReadout').textContent()).includes(data.meta.version), true);
      check(`${name}: import does not re-enable recording`,await page.evaluate(()=>__testLab.diagnosticAccess().diagnostics.active),false);
      check(`${name}: import does not opt in or populate the recorder`, await page.evaluate(() =>
        !document.getElementById('diagConsent').checked && __testLab.diagnosticAccess().diagnostics.items.length === 0), true);
      const nullIndex = imported.entries.findIndex(e => e.kind === 'frame' && e.data.frame === null && e.data.score === null);
      await seekEntry(page, nullIndex);
      check(`${name}: saved missing measurements still display null`, /"frame": null/.test(await page.locator('#diagReadout').textContent()) &&
        /"score": null/.test(await page.locator('#diagReadout').textContent()), true);
      await page.locator('#diagClear').click();
    }
    // Reload with a nonempty imported review, so disappearance is not vacuous.
    await importRecording(page, data, 'reload-review.json');
    await page.reload(); await page.waitForFunction(()=>!!window.__testLab);
    check('Reload retains no diagnostic data',await page.evaluate(()=>__testLab.diagnosticAccess().diagnostics.items.length),0);
    check('Reload removes imported review and consent', await page.evaluate(() =>
      document.getElementById('diagViewer').hidden && document.getElementById('diagReadout').textContent === '' && !document.getElementById('diagConsent').checked), true);
  });
  await runCase('diagnostic-consent-revocation', 'Unchecking consent clears captured details without stopping the workout.', async(page,check)=>{
    await openRecorder(page); await page.locator('#diagConsent').check(); await startRecorder(page, check);
    await page.locator('#calBtn').click();
    await page.evaluate(f=>__testLab.feed(f,1/30),frame);
    check('Revocation starts with captured details', (await savedEntries(page)).length > 0, true);
    const before = await workout(page);
    await openRecorder(page); await page.locator('#diagConsent').uncheck();
    check('Revocation preserves the workout state', await workout(page), before);
    await page.evaluate(f=>__testLab.feed(f,1/30),frame);
    check('Revocation clears and disables capture',await page.evaluate(()=>{const b=__testLab.diagnosticAccess().diagnostics;return !b.active&&b.items.length===0&&b.meta===null;}),true);
    check('Workout is still running',await page.locator('#skipExBtn').isVisible(),true);
    check('Revocation hides the quick flag', await page.locator('#diagQuickFlag').isVisible(), false);
  });

  await runCase('diagnostic-replay-gap', 'An imported synthetic frame at 0ms expires during the real-time gap between Pause at 10ms and Resume at 2000ms. Saved controls never operate the recorder.', async (page, check, capture) => {
    const recording = { schema: 'formcoach-diagnostic/1', meta: { version: 'synthetic replay gap', scriptSha256: 'a'.repeat(64) }, dropped: 0,
      entries: [
        { kind: 'frame', at: 0, data: { frame, phase: 0, movement: 'plank', reps: 0, score: null, blocked: [] } },
        { kind: 'control', at: 10, data: { action: 'pause recording' } },
        { kind: 'control', at: 2000, data: { action: 'recording resumed' } }
      ] };
    const replayState = () => page.evaluate(() => {
      const canvas = document.getElementById('diagCanvas');
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let painted = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) painted++;
      const summary = document.getElementById('diagSummary').textContent;
      return { painted, time: Number.parseFloat(summary), summary, readout: document.getElementById('diagReadout').textContent,
        seek: Number(document.getElementById('diagSeek').value), playing: document.getElementById('diagPlay').textContent === 'Pause' };
    });
    await openRecorder(page); await importRecording(page, recording, 'synthetic-replay-gap.json');
    await page.locator('#diagViewer details summary').click();
    const initial = await replayState();
    check('Initial saved frame paints actual skeleton pixels', initial.painted > 0, true);
    check('Replay begins at the saved frame without autoplay', { time: initial.time, seek: initial.seek, playing: initial.playing }, { time: 0, seek: 0, playing: false });
    await page.locator('#diagCanvas').scrollIntoViewIfNeeded(); await capture('gap-initial-frame');
    await page.locator('#diagPlay').click();
    // Keep the real browser clock: a seek or simulated timer would not catch
    // geometry incorrectly aged against the selected entry's frozen timestamp.
    await page.waitForTimeout(700);
    const gap = await replayState();
    check('Skeleton is cleared by about 700ms into the recording gap', gap.painted, 0);
    check('Playback continues while the selected saved entry is still Pause', { playing: gap.playing, seek: gap.seek }, { playing: true, seek: 1 });
    check('Displayed playback time advances beyond the saved 10ms event', gap.time >= .6 && gap.time < 2, true);
    check('Visible gap summary explicitly says no nearby joint snapshot', /No nearby joint snapshot retained\./.test(gap.summary), true);
    check('Technical gap readout explicitly says no nearby saved frame', /No nearby saved joint frame\./.test(gap.readout) && !/Nearby saved frame, not interpolation\./.test(gap.readout), true);
    await page.locator('#diagCanvas').scrollIntoViewIfNeeded(); await capture('gap-expired-frame');
    await page.waitForFunction(() => document.getElementById('diagSeek').value === '2' && document.getElementById('diagPlay').textContent === 'Play');
    const end = await replayState();
    check('Replay reaches Resume at two seconds without reviving old geometry', { time: end.time >= 2, seek: end.seek, playing: end.playing, painted: end.painted }, { time: true, seek: 2, playing: false, painted: 0 });
    check('Imported Pause and Resume never enable capture or consent', await page.evaluate(() => {
      const b = __testLab.diagnosticAccess().diagnostics;
      return !b.active && b.items.length === 0 && !document.getElementById('diagConsent').checked;
    }), true);
  });

  for (const [layout, viewport] of viewports) {
    await runCase(`diagnostic-recorder-${layout}`, `${viewport.width}×${viewport.height}: ordinary recorder clicks, scroll, focus and quick flags preserve the workout and local-only lifecycle. Synthetic landmarks, not a physical-device test.`, async (page, check, capture) => {
      await page.setViewportSize(viewport);
      check('Recorder keeps its native summary in the header', await page.locator('#diagPanel').evaluate(el =>
        el.tagName === 'DETAILS' && el.firstElementChild?.tagName === 'SUMMARY' && !!el.closest('header')), true);
      check('Quick flag belongs to the header', await page.locator('header #diagQuickFlag').count(), 1);
      check('Quick flag is hidden before recording', await page.locator('#diagQuickFlag').isVisible(), false);
      await reachable(page, check, [summary], 'Before recording');
      const initialSize = await stageSize(page), initialWorkout = await workout(page);
      await openRecorder(page);
      check('Drawer is fixed and scrollable', await page.locator('#diagBody').evaluate(el => {
        const s = getComputedStyle(el); return s.position === 'fixed' && ['auto', 'scroll'].includes(s.overflowY);
      }), true);
      check('Drawer fits inside the viewport', await page.locator('#diagBody').evaluate(el => {
        const r = el.getBoundingClientRect(); return r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
      }), true);
      check('Opening before the workout preserves stage dimensions', await stageSize(page), initialSize);
      await reachable(page, check, drawerControls, 'Before consent');
      await capture('drawer-before-start');
      await page.locator('#diagConsent').check();
      check('Consent alone does not start capture', await page.evaluate(() => __testLab.diagnosticAccess().diagnostics.active), false);
      await startRecorder(page, check);
      check('Starting capture preserves stage dimensions', await stageSize(page), initialSize);
      check('Starting capture does not start or reset a workout', await workout(page), initialWorkout);
      await reachable(page, check, ['#diagQuickFlag'], 'Ready to start the workout');
      await capture('recording-before-workout');

      // This must be an actual click: a trial click alone never proves calibration starts.
      await page.locator('#calBtn').click();
      await page.locator('#skipExBtn').waitFor({ state: 'visible' });
      await page.evaluate(f => { for (let i = 0; i < 195; i++) __testLab.feed(f, 1 / 30); }, frame);
      const activeWorkout = await workout(page), activeSize = await stageSize(page);
      check('Workout has measured progress to preserve', activeWorkout.held > 0 && !activeWorkout.done, true);
      const flagsBefore = (await savedEntries(page)).filter(e => e.kind === 'flag').length;
      await reachable(page, check, ['#diagQuickFlag'], 'During the workout');
      await page.locator('#diagQuickFlag').click();
      check('Quick flag records exactly one moment with the drawer closed', (await savedEntries(page)).filter(e => e.kind === 'flag').length, flagsBefore + 1);
      check('Quick flag leaves the drawer closed', await page.locator('#diagPanel').evaluate(el => el.open), false);
      check('Quick flag leaves workout progress intact', await workout(page), activeWorkout);
      await capture('workout-quick-flag');

      await openRecorder(page);
      check('Opening during the workout preserves stage dimensions', await stageSize(page), activeSize);
      check('Opening during the workout preserves progress', await workout(page), activeWorkout);
      await reachable(page, check, drawerControls, 'Recording');
      await page.locator('#diagFlag').click();
      check('Drawer flag also records exactly one moment', (await savedEntries(page)).filter(e => e.kind === 'flag').length, flagsBefore + 2);
      await capture('drawer-during-workout');
      await closeRecorder(page, check);
      check('Close preserves stage dimensions', await stageSize(page), activeSize);
      check('Close preserves workout progress', await workout(page), activeWorkout);
      for (const via of ['escape', 'summary keyboard']) {
        await openRecorder(page); await closeRecorder(page, check, via);
        check(`${via} preserves stage dimensions`, await stageSize(page), activeSize);
        check(`${via} preserves workout progress`, await workout(page), activeWorkout);
      }

      await openRecorder(page); await page.locator('#diagStop').click();
      const paused = await savedEntries(page);
      check('Pause disables capture', await page.evaluate(() => __testLab.diagnosticAccess().diagnostics.active), false);
      check('Pause retains captured entries', paused.length > 0, true);
      check('Pause hides the quick flag', await page.locator('#diagQuickFlag').isVisible(), false);
      await closeRecorder(page, check);
      await page.evaluate(f => { for (let i = 0; i < 30; i++) __testLab.feed(f, 1 / 30); }, frame);
      check('Paused capture adds or changes no entries', JSON.stringify(await savedEntries(page)) === JSON.stringify(paused), true);
      const continuedWorkout = await workout(page);
      check('Workout keeps progressing while capture is paused', continuedWorkout.held > activeWorkout.held, true);
      await openRecorder(page); await startRecorder(page, check);
      const resumed = await savedEntries(page);
      check('Resume preserves every paused entry and appends an event', resumed.length > paused.length && JSON.stringify(resumed.slice(0, paused.length)) === JSON.stringify(paused), true);
      check('Resume preserves workout progress', await workout(page), continuedWorkout);
      check('Resume preserves stage dimensions', await stageSize(page), activeSize);
      await reachable(page, check, ['#diagQuickFlag'], 'Resumed');
      await page.locator('#diagQuickFlag').click();
      check('Resumed quick flag records another moment', (await savedEntries(page)).filter(e => e.kind === 'flag').length, flagsBefore + 3);

      await openRecorder(page); await page.locator('#diagConsent').uncheck();
      check('Revocation erases capture and metadata at this viewport', await page.evaluate(() => {
        const b = __testLab.diagnosticAccess().diagnostics; return !b.active && b.meta === null && b.items.length === 0;
      }), true);
      check('Revocation preserves workout progress at this viewport', await workout(page), continuedWorkout);
      check('Revocation hides the quick flag at this viewport', await page.locator('#diagQuickFlag').isVisible(), false);
      await page.locator('#diagConsent').check(); await startRecorder(page, check);
      await page.evaluate(f => __testLab.feed(f, 1 / 30), frame);
      await page.locator('#diagQuickFlag').click();
      await page.locator('#startBtn').click();
      await page.locator('#skipExBtn').waitFor({ state: 'hidden' });
      await openRecorder(page); await page.locator('#diagStop').click();
      await page.locator('#diagReview').click(); await page.locator('#diagViewer').waitFor({ state: 'visible' });
      await reachable(page, check, ['#diagPlay', '#diagSeek', '#diagViewer details summary'], 'Saved replay');
      await page.locator('#diagSeek').press('End');
      check('Timeline is usable with ordinary keyboard input', await page.locator('#diagSeek').inputValue(), await page.locator('#diagSeek').getAttribute('max'));
      await page.locator('#diagViewer details summary').click();
      check('Replay keeps the saved-observation explanation', /Saved observations/.test(await page.locator('#diagReadout').innerText()), true);
      await capture('drawer-replay');
      await reachable(page, check, ['#diagClear', '#diagImport', '#diagClose'], 'After replay');
      await page.locator('#diagClear').click();
      check('Clear erases capture, consent and replay', await page.evaluate(() => {
        const b = __testLab.diagnosticAccess().diagnostics;
        return !b.active && b.meta === null && b.items.length === 0 && !document.getElementById('diagConsent').checked &&
          document.getElementById('diagViewer').hidden && document.getElementById('diagReadout').textContent === '';
      }), true);
      await page.locator('#diagConsent').check(); await startRecorder(page, check);
      await page.locator('#diagQuickFlag').click();
      check('Reload starts with an active nonempty recording', await page.evaluate(() => {
        const b = __testLab.diagnosticAccess().diagnostics; return b.active && b.items.length > 0;
      }), true);
      await page.reload(); await page.waitForFunction(() => !!window.__testLab);
      check('Reload erases capture and consent at this viewport', await page.evaluate(() => {
        const b = __testLab.diagnosticAccess().diagnostics;
        return !b.active && b.meta === null && b.items.length === 0 && !document.getElementById('diagConsent').checked;
      }), true);
      check('Reload closes the drawer', await page.locator('#diagPanel').evaluate(el => el.open), false);
      check('Reload hides the quick flag', await page.locator('#diagQuickFlag').isVisible(), false);
    });
  }
}
