import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { serve } from './browser.mjs';
import { hash } from './lib.mjs';
import { exerciseInputs } from './exercise-inputs.mjs';
import { auditAudio, audioReviewPage } from './audio-review.mjs';

export async function clickAudioAction(page,action){
  const controls={skip:'#skipExBtn',stop:'#startBtn',pause:'#pauseBtn',resume:'#resumeBtn',
    ask:'#askCoachBtn',repeat:'#coachRepeatBtn','coach-resume':'#coachResumeBtn','follow-along':'#followAlongBtn'};
  if(!Object.hasOwn(controls,action))throw new Error(`Unknown audio action: ${action}`);
  const selector=controls[action];
  // Mark the actual DOM click, before the app's handler. Playwright can spend
  // hundreds of ms scrolling/waiting for actionability before dispatching it.
  // That automation delay is not application cancellation latency.
  await page.evaluate(({selector,action})=>{
    const element=document.querySelector(selector);
    if(!element)throw new Error(`Missing audio action control: ${selector}`);
    element.addEventListener('click',()=>window.__audioLab.mark(action),{capture:true,once:true});
  },{selector,action});
  await page.locator(selector).click();
  if(action==='stop')await page.locator('#endSessionBtn').click();
}

export async function audioSweep({ root, html, dir, onResult = async () => {}, only, mutate, repeatFailures = true, verification }) {
  const declared = JSON.parse(await readFile(resolve(root, 'testing/audio-cases.json')));
  // Every persona/tier actually decodes its own shipped number clips. Full-length
  // scenario coverage is separately declared above; this is not a 9x exercise claim.
  const cases = [...declared, ...['steady', 'warm', 'energy'].flatMap(persona => ['learning', 'building', 'strong'].map(tier => ({
    id: `clips-${persona}-${tier}`, kind: 'clips', persona, tier, seconds: 4,
    description: `Actual ${persona}/${tier} recorded numbers through the Coach queue.`,
    oracle: 'One followed by two with an explicit 3000ms TTL (playback sample, not simultaneous rep events), real non-silent decoded clips, no overlapping audio.'
  })))].filter(c => !only || c.id === only);
  if (!cases.length) throw new Error(`Unknown audio case ${only}`);
  const inputs = exerciseInputs(JSON.parse(await readFile(resolve(root, 'conformance-vectors.json'))).poses);
  const server = await serve(root, html, undefined, { audio: true });
  let browser;
  try { browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); }
  catch (error) { await server.close(); throw error; }
  async function execute(scenario, target) {
    await mkdir(target, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: target, size: { width: 1280, height: 800 } } });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const page = await context.newPage(), logs = [], errors = [], checks = [];
    page.setDefaultTimeout(10000);
    page.on('console', m => { logs.push({ type: m.type(), text: m.text() }); if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => { logs.push({ type: 'pageerror', text: e.message }); errors.push(e.message); });
    let evidence, error, begun = false;
    const check = (label, actual, expected) => checks.push({ label, actual, expected, pass: actual === expected });
    try {
      await page.route('**/*', route => new URL(route.request().url()).origin === server.url ? route.continue() : route.abort());
      await page.goto(server.url); await page.waitForFunction(() => !!window.__audioLab && window.__testLab.audioAccess().AudioBank.enabled);
      if (mutate) await mutate(page);
      await page.evaluate(scenario => window.__audioLab.begin(scenario), scenario); begun = true;
      if (scenario.kind === 'session') {
        // Reuse an existing spoken plan-name token, avoiding an artificial TTS
        // fallback caused solely by naming the synthetic plan "Voice review".
        const plan = { id: 'audio-' + scenario.id, name: scenario.tier === 'learning' ? 'First Steps' : 'Core Strength', tiers: [scenario.tier], steps: scenario.steps };
        await page.evaluate(plan => window.__testLab.installPlan(plan), plan);
        await page.locator('#skipBtn').click(); await page.locator(`[data-t="${scenario.tier}"]`).click(); await page.locator('#goBtn').click();
        await page.locator(`[data-plan="${plan.id}"]`).click(); await page.locator('#planStartBtn').click();
        const segments = scenario.segments.map(s => {
          let frame = s.pose === 'lost' || s.pose === 'none' ? null : inputs.frame('plank');
          if (s.pose === 'sag') for (const side of ['left', 'right']) frame[side].hip.y += .07;
          return { ...s, frame };
        });
        await writeFile(resolve(target, 'inputs.json'), JSON.stringify({
          schema: 'audio-inputs/1', description: 'Exact synthetic input frames. After Skip the same plank shape is deliberately retained; good means the authored plank, not the next movement.',
          segments }, null, 2));
        // Each segment uses wall time; original timers and Coach.speaking gate are
        // active. Do not fast-forward the engine while MP3s play in real time.
        for (const [i, segment] of segments.entries()) {
          if (segment.action) {
            await clickAudioAction(page,segment.action);
          } else {
            await page.evaluate(async s => {
              window.__audioLab.observe(s.pose);
              const start = performance.now(); let previous = start;
              while (performance.now() - start < s.seconds * 1000) {
                await new Promise(resolve => setTimeout(resolve, 1000 / 30));
                const at = performance.now(), dt = Math.min((at - previous) / 1000, .15); previous = at;
                if (s.pose !== 'none') window.__testLab.feed(s.frame, dt);
              }
            }, segment);
          }
          await page.screenshot({ path: resolve(target, `segment-${i}.png`) });
        }
        if (scenario.id === 'tracking-loss') check('No body never arms the session', await page.evaluate(() => window.__audioLab.state().state), 'setup');
      } else {
        await page.evaluate(kind => kind === 'queue' ? window.__audioLab.queueExpiry() : window.__audioLab.sequence(), scenario.kind);
        await page.waitForTimeout(scenario.seconds * 1000);
      }
    } catch (e) { error = e.stack; }
    finally {
      if (begun) {
        try { evidence = await page.evaluate(() => window.__audioLab.finish()); }
        catch (e) { error = [error, `Capture finalization failed: ${e.stack}`].filter(Boolean).join('\n'); }
      }
      await writeFile(resolve(target, 'console.json'), JSON.stringify(logs, null, 2));
      await context.tracing.stop({ path: resolve(target, 'trace.zip') });
      await context.close();
      await rename(await page.video().path(), resolve(target, 'screen.webm'));
    }
    let audit = { checks: [], concerns: [], gaps: [] };
    if (evidence) {
      await writeFile(resolve(target, 'audio.webm'), Buffer.from(evidence.base64, 'base64')); delete evidence.base64;
      // Playwright's video starts before navigation; no frame-accurate video sync
      // is claimed. Audio and event clocks are measured within the same page.
      evidence.screenOffsetMs = null;
      evidence.limitations.push('Screen recording has no audio and its startup offset is unmeasured; use the audio/event timeline for timing assertions.');
      evidence.manifestHash = hash(await readFile(resolve(root, 'voice/manifest.json')));
      evidence.clipHashes = {};
      for (const path of new Set(evidence.events.filter(e => e.type === 'clip-request').map(e => e.path))) {
        try { evidence.clipHashes[path] = hash(await readFile(resolve(root, path))); }
        catch (e) { evidence.clipHashes[path] = `unavailable: ${e.code}`; }
      }
      audit = auditAudio(evidence, {numbers:scenario.kind === 'clips' ? [1,2] : []});
      if (scenario.id === 'tracking-loss') {
        const reminders = evidence.events.filter(e => e.type === 'effect' && e.effect.t === 'say' && ['vis', 'trackingLost'].includes(e.effect.key));
        check('Persistent missing tracking requests at most one reminder in 24 seconds', reminders.length <= 1, true);
        check('Tracking loss still receives an explanation after teaching', reminders.length >= 1, true);
      }
      if (scenario.id === 'plank-feedback') {
        check('Feedback case reaches an active set', evidence.events.some(e => e.type === 'effect' && e.effect.key === 'go'), true);
        check('Synthetic hip sag produces an actually started correction clip', evidence.events.some(e => e.type === 'clip-start' && e.item?.key === 'sag'), true);
        const sag = evidence.events.find(e => e.type === 'observation' && e.state.observation.pose === 'sag');
        const recovered = evidence.events.find(e => e.type === 'observation' && e.ms > sag?.ms && e.state.observation.pose === 'good');
        const sagClips = new Set(evidence.events.filter(e => e.type === 'clip-start' && e.item?.key === 'sag').map(e => e.playId));
        check('Recovery is present in the audio timeline', !!recovered, true);
        check('Resolved sag is not spoken after two seconds of recovery', evidence.levels.some(l => sagClips.has(l.playId) && l.ms > recovered?.ms + 2000 && l.rms > .001), false);
      }
      if (scenario.id === 'skip-during-teaching') {
        const skip = evidence.events.find(e => e.type === 'action' && e.action === 'skip');
        const boundary = evidence.events.find(e => e.ms > skip.ms && e.type === 'effect' && e.state.phase !== skip.state.phase);
        const oldClips = new Set(evidence.events.filter(e => e.type === 'clip-start' &&
          e.item?.requestedState.phase === skip.state.phase).map(e => e.playId));
        check('Skip reaches the next phase', boundary?.state.movement, 'glute-bridge');
        check('Abandoned clips are silent within 250ms of the phase change',
          evidence.levels.some(l => oldClips.has(l.playId) && l.ms > boundary?.ms + 250 && l.rms > .001), false);
        check('Next exercise teaching actually plays after Skip', evidence.events.some(e =>
          e.type === 'clip-start' && e.ms > skip.ms && e.item?.key === 'teach.glute-bridge'), true);
      }
      if(scenario.id === 'follow-along-cancels-correction') {
        const choice = evidence.events.find(e=>e.type==='action' && e.action==='follow-along');
        const boundary = evidence.events.find(e=>e.ms>=choice?.ms && e.state.state==='follow-along');
        const oldClips = new Set(evidence.events.filter(e=>e.type==='clip-start' && e.ms<choice?.ms).map(e=>e.playId));
        const correctionClips = new Set(evidence.events.filter(e=>e.type==='clip-start' && e.item?.key==='sag' && e.ms<choice?.ms).map(e=>e.playId));
        check('Choice enters follow-along',!!boundary,true);
        check('Actual correction played before the choice',evidence.events.some(e=>e.type==='clip-start' && e.item?.key==='sag' && e.ms<choice?.ms),true);
        check('Choice interrupts an audibly active correction, not an already silent clip',
          evidence.levels.some(l=>correctionClips.has(l.playId) && l.ms>=choice?.ms-250 && l.ms<=choice?.ms && l.rms>.001),true);
        check('Old clips are silent within 250ms of the mode change',
          evidence.levels.some(l=>oldClips.has(l.playId) && l.ms>boundary?.ms+250 && l.rms>.001),false);
        check('Teaching actually plays after choosing follow-along',evidence.events.some(e=>e.type==='clip-start' && e.ms>choice?.ms && e.item?.key==='teach.plank'),true);
        check('Unassessed mode has no started correction, praise or readiness speech',evidence.events.some(e=>
          e.type==='speech-start' && e.state.state==='follow-along' && e.item?.key!=='teach.plank'),false);
      }
      if(scenario.id === 'ask-repeat-resume'){
        const ask = evidence.events.find(e=>e.type==='action' && e.action==='ask');
        const repeat = evidence.events.find(e=>e.type==='action' && e.action==='repeat');
        const resume = evidence.events.find(e=>e.type==='action' && e.action==='coach-resume');
        const boundary = evidence.events.find(e=>e.ms>=ask?.ms && e.state.state==='paused');
        const correction = new Set(evidence.events.filter(e=>e.type==='clip-start' && e.item?.key==='sag' && e.ms<ask?.ms).map(e=>e.playId));
        const teaching = new Set(evidence.events.filter(e=>e.type==='clip-start' && e.item?.key==='teach.plank' && e.ms>=repeat?.ms && e.ms<resume?.ms).map(e=>e.playId));
        check('Ask interrupts audible correction',evidence.levels.some(l=>correction.has(l.playId)&&l.ms>=ask?.ms-250&&l.ms<=ask?.ms&&l.rms>.001),true);
        check('Ask pauses actual workout',!!boundary,true);
        check('Ask silences old correction within 250ms',evidence.levels.some(l=>correction.has(l.playId)&&l.ms>boundary?.ms+250&&l.rms>.001),false);
        check('Paused teaching cannot award held time',resume?.state.held,boundary?.state.held);
        check('Explicit repeat starts real teaching while paused',evidence.events.some(e=>e.type==='clip-start'&&teaching.has(e.playId)&&e.state.state==='paused'),true);
        check('Repeated teaching has measured audio signal',evidence.levels.some(l=>teaching.has(l.playId)&&l.rms>.001),true);
        check('Resume cancels repeated teaching within 250ms',evidence.levels.some(l=>teaching.has(l.playId)&&l.ms>resume?.ms+250&&l.rms>.001),false);
        check('Only explicitly requested teaching starts during help',evidence.events.some(e=>e.type==='speech-start'&&e.state.state==='paused'&&e.item?.key!=='teach.plank'),false);
        check('Recovery does not restart obsolete correction',evidence.events.some(e=>e.type==='speech-start'&&e.ms>resume?.ms&&e.item?.key==='sag'),false);
        check('Fresh observed hold resumes after help',evidence.events.some(e=>e.ms>resume?.ms&&e.state.held>resume?.state.held),true);
      }
      if(scenario.id === 'pause-cancels-correction'){
        const pause = evidence.events.find(e=>e.type==='action' && e.action==='pause');
        const resume = evidence.events.find(e=>e.type==='action' && e.action==='resume');
        const boundary = evidence.events.find(e=>e.ms>=pause?.ms && e.state.state==='paused');
        const clips = new Set(evidence.events.filter(e=>e.type==='clip-start' && e.item?.key==='sag' && e.ms<pause?.ms).map(e=>e.playId));
        check('Pause interrupts an audibly active correction',evidence.levels.some(l=>clips.has(l.playId)&&l.ms>=pause?.ms-250&&l.ms<=pause?.ms&&l.rms>.001),true);
        check('Paused state is present',!!boundary,true);
        check('Old correction silent within 250ms',evidence.levels.some(l=>clips.has(l.playId)&&l.ms>boundary?.ms+250&&l.rms>.001),false);
        check('No speech starts while paused',evidence.events.some(e=>e.type==='speech-start'&&e.state.state==='paused'),false);
        check('Paused held time does not advance',resume?.state.held,boundary?.state.held);
        check('Recovery cannot restart obsolete sag',evidence.events.some(e=>e.type==='speech-start'&&e.ms>resume?.ms&&e.item?.key==='sag'),false);
        check('Fresh observed hold resumes',evidence.events.some(e=>e.ms>resume?.ms&&e.state.held>resume?.state.held),true);
      }
      if (scenario.kind === 'queue') {
        check('An expired correction is actually discarded', evidence.events.some(e => e.type === 'dropped' && e.reason === 'expired' && e.item.key === 'sag'), true);
        check('Expired correction is never started', evidence.events.some(e => e.type === 'speech-start' && e.item.key === 'sag'), false);
      }
      if (scenario.kind === 'clips') {
        const spoken = evidence.events.filter(e => e.type === 'speech-start').map(e => e.item.text);
        check('One then two, through the original queue', JSON.stringify(spoken), JSON.stringify(['1', '2']));
        check('Number sample does not fall back to uncaptured TTS', audit.summary.tts, 0);
      }
      await writeFile(resolve(target, 'audio.json'), JSON.stringify(evidence));
      await writeFile(resolve(target, 'audio-review.html'), audioReviewPage(scenario, evidence, audit));
    }
    check('No uncaught browser/console errors', errors.length, 0);
    const result = { id: `audio/${scenario.id}`, mode: 'audio', description: scenario.description, error,
      checks: [...checks, ...audit.checks], concerns: audit.concerns, audioGaps: audit.gaps,
      audio: !!evidence, summary: audit.summary };
    result.status = error ? 'error' : result.checks.every(c => c.pass) ? 'passed' : 'failed';
    await writeFile(resolve(target, 'scenario.json'), JSON.stringify({ schema: 'audio-case/1', ...scenario, seed: 12345,
      buildHash: hash(html), verification,
      source: 'testing/audio-sweep.mjs', reproduce: verification ? 'npm run test:audio:mutations' :
        `node testing/run.mjs --build ${resolve(dir, 'build.html')} --mode audio --scenario ${scenario.id}` }, null, 2));
    await writeFile(resolve(target, 'result.json'), JSON.stringify(result, null, 2));
    return result;
  }
  const results = [];
  try {
    // Two contexts keep wall-clock runs practical without racing the same Coach.
    let cursor = 0;
    await Promise.all(Array.from({ length: 2 }, async () => {
      while (cursor < cases.length) {
        const scenario = cases[cursor++], evidence = `audio-${scenario.id}`, target = resolve(dir, evidence);
        const result = await execute(scenario, target); result.evidence = evidence;
        if ((result.status !== 'passed' || result.concerns.length) && repeatFailures) {
          const again = await execute(scenario, resolve(target, 'reproduction'));
          const failedLabels = r => r.checks.filter(c => !c.pass).map(c => c.label).sort();
          result.reproduced = result.error ? result.error.split('\n')[0] === again.error?.split('\n')[0] :
            JSON.stringify(failedLabels(result)) === JSON.stringify(failedLabels(again));
          result.reproductionBasis = 'Matching failed rule labels, not identical audio timing. Both captures retained.';
          result.concernsReproduced = JSON.stringify(result.concerns.map(c => c.rule).sort()) === JSON.stringify(again.concerns.map(c => c.rule).sort());
        }
        await writeFile(resolve(target, 'result.json'), JSON.stringify(result, null, 2));
        results.push(result); await onResult(result); console.log(`${result.status.toUpperCase()} audio/${scenario.id}: ${result.concerns.length} review candidates`);
      }
    }));
  } finally { await browser.close(); await server.close(); }
  return results;
}
