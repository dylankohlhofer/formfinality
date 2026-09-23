import { reveal, openAccount } from './ui-navigation.mjs';
import { readFile } from 'node:fs/promises';
import { exerciseInputs } from './exercise-inputs.mjs';

// Integrate with: await privacyCases(runCase). Each runCase must supply a fresh
// page/context and retain shell-sweep's uncaught page/console error checks.
// Hooks: existing audioAccess(), feed(), snapshot(); #speechStatus must be visible
// on unavailable/error paths. voiceschanged must refresh #voiceSel (the existing
// second onvoiceschanged assignment currently overwrites that refresh).
// Controlled speech/media events test routing and lifecycle, not audible output.
const voice = (name, localService, lang = 'en-GB') => ({
  name, localService, lang, voiceURI: `privacy:${name}`, default: false
});
const remote = voice('Google English Natural', false);
const local = voice('Daniel', true);
const enhanced = voice('Samantha Enhanced', true, 'en-US');
const foreign = voice('French Premium', true, 'fr-FR');

async function setup(page, voices) {
  // Let the shipped manifest settle before disabling the bank; otherwise init()
  // can race the test and restore recorded playback/the hidden picker.
  await page.waitForFunction(() => window.__testLab.audioAccess().AudioBank.enabled);
  await page.evaluate(voices => {
    const { AudioBank, coach } = window.__testLab.audioAccess();
    window.__privacy = { voices, spoken: [] };
    Object.defineProperty(speechSynthesis, 'getVoices', {
      configurable: true, value: () => window.__privacy.voices
    });
    Object.defineProperty(speechSynthesis, 'speak', {
      configurable: true, value: u => window.__privacy.spoken.push(u)
    });
    Object.defineProperty(speechSynthesis, 'cancel', { configurable: true, value: () => {} });
    // Native utterance.voice rejects plain fixture objects before speak is called.
    // Keep assignment observable and default null; never call the native service.
    window.SpeechSynthesisUtterance = class {
      constructor(text) { this.text = text; this.voice = null; }
    };
    coach.reset();
    AudioBank.enabled = false;
    document.getElementById('voice').checked = true;
    window.__privacy.item = (text, clips = null) => ({
      text, clips, pri: 3, at: performance.now(), ttl: Infinity
    });
  }, voices);
}

async function unavailableStatus(page, check) {
  const status = page.locator('#speechStatus');
  check('Speech status is visible', await status.isVisible(), true);
  const text = (await status.count()) ? await status.innerText() : '';
  check('Status identifies local/on-device speech', /local|on[ -]device/i.test(text), true);
  check('Status explains voice unavailability', /unavailable|not available|no .*voice|could not|couldn.t|cannot|can.t/i.test(text), true);
}

function released(check, state) {
  check('Current speech is released immediately', state.cur, null);
  check('Pending speech is released immediately', state.pending, null);
  check('Speech no longer gates exercise readiness', state.speaking, false);
}

export async function privacyCases(runCase) {
  for (const [id, voices, count] of [['local', [local, remote], 1], ['remote', [remote], 0]]) {
    await runCase(`privacy-preview-${id}`, 'The Hear it preview obeys the same local-only boundary as session speech.', async (page, check) => {
      await setup(page, voices); await openAccount(page); await reveal(page, '#voicePrev'); await page.locator('#voicePrev').click();
      check('Preview invokes only an explicitly local voice', await page.evaluate(() => window.__privacy.spoken.map(u => u.voice?.localService)), count ? [true] : []);
      if (!count) await unavailableStatus(page, check);
    });
  }
  await runCase('privacy-voice-ranking', 'Only explicitly local English voices qualify; enhanced local voice outranks ordinary local voice.', async (page, check) => {
    await setup(page, [remote, local, foreign, enhanced, voice('Unknown Premium', undefined), voice('Truthy Premium', 'true')]);
    const result = await page.evaluate(() => {
      const { Coach } = window.__testLab.audioAccess(), c = new Coach();
      const picked = c.pickVoice();
      c.push(window.__privacy.item('Local routing control'));
      const spoken = window.__privacy.spoken.map(u => ({ name: u.voice?.name ?? null, local: u.voice?.localService ?? null }));
      c.reset();
      return { picked: picked?.name ?? null, spoken };
    });
    check('Ranking chooses the enhanced local English voice', result.picked, enhanced.name);
    check('Speak receives an explicitly assigned local voice', result.spoken, [{ name: enhanced.name, local: true }]);
  });

  for (const [id, voices] of [
    ['remote-only', [remote]], ['empty', []], ['non-english', [foreign]],
    ['unproven-local', [voice('Unknown English', undefined), voice('Truthy English', 'true')]]
  ]) await runCase(`privacy-${id}`, 'No eligible local English voice: never use remote/default speech; release current/pending and explain visually.', async (page, check) => {
    await setup(page, voices);
    const result = await page.evaluate(() => {
      const { Coach } = window.__testLab.audioAccess(), c = new Coach(), p = window.__privacy;
      const picked = c.pickVoice();
      c.pending = p.item('Pending unavailable instruction');
      c.start(p.item('Current unavailable instruction'));
      const result = { picked: picked?.name ?? null, calls: p.spoken.length, cur: c.cur, pending: c.pending, speaking: c.speaking() };
      c.reset();
      return result;
    });
    check('No eligible voice is selected', result.picked, null);
    check('No native speech call, including an unassigned default', result.calls, 0);
    released(check, result);
    await unavailableStatus(page, check);
  });

  for (const source of ['cached', 'selected']) for (const replacement of ['remote', 'missing', 'local']) {
    await runCase(`privacy-${source}-${replacement}`, 'Revalidate a previously usable voice at start, even without a voiceschanged event.', async (page, check) => {
      await setup(page, [local]);
      if(source === 'selected') await openAccount(page);
      const result = await page.evaluate(({ source, replacement, remote, enhanced }) => {
        const { Coach } = window.__testLab.audioAccess(), p = window.__privacy;
        if (source === 'selected') {
          // Exercise the real change handler; a formerly valid selection may now
          // identify a remote service. No setter for chosenVoiceName is needed.
          const sel = document.getElementById('voiceSel');
          sel.replaceChildren(new Option(p.voices[0].name, p.voices[0].name));
          sel.value = p.voices[0].name;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const c = new Coach();
        c.push(p.item('Initially local'));
        const initial = p.spoken.map(u => u.voice?.localService ?? null);
        if (p.spoken[0]) p.spoken[0].onend();
        // Cache can already be remote, or an old local can disappear entirely.
        if (replacement === 'remote') {
          p.voices = [{ ...p.voices[0], localService: false }];
          if (source === 'cached') c.voice = p.voices[0];
        } else p.voices = replacement === 'local' ? [remote, enhanced] : [remote];
        p.spoken.length = 0;
        c.push(p.item('After voice inventory changes'));
        const result = { initial, spoken: p.spoken.map(u => ({ name: u.voice?.name ?? null, local: u.voice?.localService ?? null })),
          cur: c.cur, pending: c.pending, speaking: c.speaking() };
        c.reset();
        return result;
      }, { source, replacement, remote, enhanced });
      check('Control utterance used a local voice', result.initial, [true]);
      check('Changed inventory never uses stale, remote or default voice', result.spoken,
        replacement === 'local' ? [{ name: enhanced.name, local: true }] : []);
      if (replacement !== 'local') {
        released(check, result);
        await unavailableStatus(page, check);
      }
    });
  }

  await runCase('privacy-native-error', 'A local native speech error is visible and releases the queue without a remote/default retry.', async (page, check) => {
    await setup(page, [local, remote]);
    const result = await page.evaluate(() => {
      const { Coach } = window.__testLab.audioAccess(), c = new Coach(), p = window.__privacy;
      c.push(p.item('Local speech that fails'));
      const initial = p.spoken.map(u => u.voice?.localService ?? null);
      c.push(p.item('Pending instruction'));
      // The failure coincides with local service loss; draining must revalidate.
      p.voices = p.voices.filter(v => !v.localService);
      if (p.spoken[0]) p.spoken[0].onerror({ error: 'synthesis-failed' });
      const result = { initial, calls: p.spoken.length, cur: c.cur, pending: c.pending, speaking: c.speaking() };
      c.reset();
      return result;
    });
    check('Local speech was attempted', result.initial, [true]);
    check('Error never retries remote/default speech', result.calls, 1);
    released(check, result);
    await unavailableStatus(page, check);
  });

  await runCase('privacy-recorded-clip', 'Recorded playback still completes when native voices are remote-only. Real AudioBank sequencing, controlled media completion.', async (page, check) => {
    await setup(page, [remote]);
    const result = await page.evaluate(async () => {
      const { Coach, AudioBank } = window.__testLab.audioAccess(), c = new Coach(), p = window.__privacy;
      c.push(p.item('Unavailable fallback first'));
      const fallbackReleased = !c.speaking();
      AudioBank.enabled = true;
      const started = [], media = {};
      AudioBank.get = path => media[path] ||= {
        currentTime: 0, pause() {}, play() { started.push(path); return Promise.resolve(); }
      };
      c.push(p.item('Recorded coach instruction', ['privacy-intro.mp3', 'privacy-tail.mp3']));
      const initial = [...started], speaking = c.speaking();
      if (media['privacy-intro.mp3']) media['privacy-intro.mp3'].onended();
      if (media['privacy-tail.mp3']) media['privacy-tail.mp3'].onended();
      await Promise.resolve();
      const result = { fallbackReleased, initial, speaking, started, calls: p.spoken.length,
        cur: c.cur, pending: c.pending, finished: !c.speaking() };
      c.reset();
      return result;
    });
    check('Unavailable fallback releases queue before recording', result.fallbackReleased, true);
    check('Recording starts with only the first clip', result.initial, ['privacy-intro.mp3']);
    check('Recording holds the speech gate until completion', result.speaking, true);
    check('Both recorded clips play in order', result.started, ['privacy-intro.mp3', 'privacy-tail.mp3']);
    check('No native speech calls', result.calls, 0);
    released(check, { ...result, speaking: !result.finished });
  });

  await runCase('privacy-voice-dropdown', 'voiceschanged refreshes the fallback dropdown and excludes remote/non-English/unproven voices.', async (page, check) => {
    await setup(page, [remote, local, foreign, enhanced, voice('Unknown English', undefined)]);
    await openAccount(page);
    await page.evaluate(() => speechSynthesis.dispatchEvent(new Event('voiceschanged')));
    const sel = page.locator('#voiceSel');
    await reveal(page,'#voiceSel');
    check('Local fallback picker is visible', await sel.isVisible(), true);
    check('Picker offers exactly the local English voices', await sel.locator('option').allTextContents().then(xs => xs.sort()),
      [local.name, enhanced.name].sort());
    await page.evaluate(remote => {
      window.__privacy.voices = [remote];
      speechSynthesis.dispatchEvent(new Event('voiceschanged'));
    }, remote);
    check('Picker offers no stale/remote voices after local removal', await sel.locator('option').allTextContents(), []);
    check('Empty picker is hidden or disabled', !(await sel.isVisible()) || await sel.isDisabled(), true);
    check('Updating voices does not start native speech', await page.evaluate(() => window.__privacy.spoken.length), 0);
  });

  await runCase('privacy-calibration-arming', 'With speech enabled but no local voice, valid plank input still advances calibration without waiting for a speech watchdog.', async (page, check) => {
    const { poses } = JSON.parse(await readFile(new URL('../conformance-vectors.json', import.meta.url), 'utf8'));
    const frame = exerciseInputs(poses).frame('plank');
    await setup(page, [remote]);
    await page.locator('#calBtn').click();
    const result = await page.evaluate(frame => {
      // Deliberately do not reset coach or bypass speaking() while feeding frames.
      for (let i = 0; i < 195; i++) window.__testLab.feed(frame, 1 / 30);
      const { coach } = window.__testLab.audioAccess();
      return { held: window.__testLab.snapshot().held, calls: window.__privacy.spoken.length,
        cur: coach.cur, pending: coach.pending, speaking: coach.speaking() };
    }, frame);
    check('Calibration accrues about five seconds of valid hold', result.held >= 4.5 && result.held <= 5.5, true);
    check('Calibration never invokes native remote/default speech', result.calls, 0);
    released(check, result);
    await unavailableStatus(page, check);
  });
}
