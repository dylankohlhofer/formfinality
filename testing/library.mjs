import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { exerciseInputs } from './exercise-inputs.mjs';
import { exerciseScenarios, exerciseSweep } from './exercise-sweep.mjs';
import { runBrowser } from './browser.mjs';
import { shellSweep } from './shell-sweep.mjs';
import { hash } from './lib.mjs';

export async function librarySweep({ root, html, engine, frameFor, dir, mode, onResult }) {
  const inputs = exerciseInputs(JSON.parse(await readFile(resolve(root, 'conformance-vectors.json'))).poses);
  const cases = exerciseScenarios(engine), results = [];
  const save = async (r, evidence, scenario) => {
    Object.assign(r, { evidence, scenarioHash: hash(JSON.stringify(scenario)) });
    await writeFile(resolve(dir, evidence, 'scenario.json'), JSON.stringify(scenario, null, 2));
    await writeFile(resolve(dir, evidence, 'result.json'), JSON.stringify(r, null, 2));
    results.push(r); await onResult(r);
    console.log(`${r.status.toUpperCase()} ${r.id}`);
  };
  if (mode !== 'browser') {
    const initial = exerciseSweep(engine, inputs), repeat = initial.some(r => r.status === 'failed') ? exerciseSweep(engine, inputs) : [];
    for (const r of initial) {
      const trace = r.evidence; delete r.evidence;
      const evidence = `${r.id}-engine`; await mkdir(resolve(dir, evidence));
      await writeFile(resolve(dir, evidence, 'events.json'), JSON.stringify(trace));
      if (r.status === 'failed') {
        const again = repeat.find(x => x.id === r.id), failing = r => r.checks.filter(c => !c.pass);
        r.reproduced = JSON.stringify(failing(r)) === JSON.stringify(failing(again));
        await writeFile(resolve(dir, evidence, 'reproduction.json'), JSON.stringify(failing(again), null, 2));
      }
      await save(r, evidence, {
        schema: 'exercise-contract/1', id: r.id, movement: r.movement, tier: r.tier,
        source: 'testing/exercise-sweep.mjs', oracle: r.oracle,
        inputSource: 'testing/exercise-inputs.mjs', anchors: [inputs.frame(r.movement, 0), inputs.frame(r.movement, 1)],
        variants: {
          interrupted: ['start', 'no body 2s', 'zero confidence 2s', 'starting pose 3s', 'no body 2s', 'recover 1s', 'skip'],
          completion: { setupSeconds: 3, seconds: r.kind === 'reps' ? 64 : 20, motion: r.kind === 'reps' ? 'four-second full cycles' : 'steady starting pose' },
          clipped: { translationX: -2, seconds: 4, expectedState: 'setup', evidence: 'events.json: clipped' },
          view: r.kind === 'guided' ? 'not applicable: no quality judgements' : 'opposite declared camera view, 4s, must remain setup',
          regression: engine.M[r.movement].regression || 'not applicable',
          timing: r.kind === 'hold' ? [15, 30, 60] : 'not applicable',
          repFeedback: r.kind === 'reps' ? 'Controlled metric driver: complete cycle, subsequent fast cycle, shallow cycle; counter and explanatory cue assertions' : 'not applicable'
        },
        reproduce: `node testing/run.mjs --build ${resolve(dir, 'build.html')} --library-only --mode engine`
      });
    }
  }
  if (mode !== 'engine') {
    const browser = await chromium.launch();
    try {
      for (const scenario of cases) for (const width of [1280, 390]) {
        const evidence = `${scenario.id}-browser-${width}`, target = resolve(dir, evidence);
        await mkdir(target);
        let r;
        const execute = dir => runBrowser({ root, html, scenario, frameFor, dir, sharedBrowser: browser,
          viewport: { width, height: width === 390 ? 844 : 800 } });
        try {
          r = await execute(target); r.status = r.checks.every(c => c.pass) ? 'passed' : 'failed';
        } catch (error) { r = { status: 'error', error: error.message }; }
        if (r.status !== 'passed') {
          const retry = resolve(target, 'reproduction'); await mkdir(retry);
          try {
            const second = await execute(retry);
            await writeFile(resolve(retry, 'result.json'), JSON.stringify(second, null, 2));
            r.reproduced = !r.error && JSON.stringify(r.checks.filter(c => !c.pass)) === JSON.stringify(second.checks.filter(c => !c.pass));
          } catch (error) { r.reproduced = r.error?.split('\n')[0] === error.message.split('\n')[0]; r.reproductionError = error.message; }
        }
        Object.assign(r, { id: evidence, movement: scenario.movement, tier: scenario.tier, mode: 'browser', description: scenario.description });
        await save(r, evidence, scenario);
      }
      const shell = await shellSweep({ root, html, engine, browser, dir });
      for (const result of shell) {
        if (result.status !== 'passed') {
          const retryDir = resolve(dir, result.evidence, 'reproduction'); await mkdir(retryDir);
          const [again] = await shellSweep({ root, html, engine, browser, dir: retryDir, only: result.id.slice('shell/'.length) });
          result.reproduced = result.error ? result.error.split('\n')[0] === again.error?.split('\n')[0] :
            JSON.stringify(result.checks.filter(c => !c.pass)) === JSON.stringify(again.checks.filter(c => !c.pass));
          await writeFile(resolve(dir, result.evidence, 'result.json'), JSON.stringify(result, null, 2));
        }
        results.push(result); await onResult(result);
      }
    } finally { await browser.close(); }
  }
  return Object.entries(engine.M).map(([id, mv]) => ({ id, name: mv.name, kind: mv.kind, tiers: mv.tiers,
    engine: results.filter(r => r.movement === id && r.mode === 'engine').map(r => ({ id: r.id, tier: r.tier, status: r.status, evidence: r.evidence, checks: r.checks })),
    browser: results.filter(r => r.movement === id && r.mode === 'browser').map(r => ({ id: r.id, tier: r.tier, status: r.status, evidence: r.evidence })),
    realVideo: 'not tested — no consented exercise recording', devices: 'not tested — Chromium viewports are not physical phones',
    limitations: ['Synthetic coordinates are not ground truth about people.', 'Individual-joint occlusion and real-person form-correction accuracy need additional fixtures.',
      ...(mv.kind === 'reps' ? ['Tempo/short-range rejection and cue dispatch tested with controlled driver metrics; anatomical shallow/fast variations need additional geometry clips.'] : [])]
  }));
}
