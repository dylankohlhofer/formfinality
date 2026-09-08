import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { exerciseInputs } from './exercise-inputs.mjs';
import { partialVisibilityInputs } from './partial-visibility-inputs.mjs';

export const hash = data => createHash('sha256').update(data).digest('hex');
export function compactEffects(effects) {
  let frame = 0;
  const keep = new Set(['reset', 'say', 'num', 'repPeak', 'bigLabel', 'tip', 'demoOff', 'regressShow', 'regressHide', 'finish', 'calibFinish']);
  return { sampling: 'All control/speech/event effects; telemetry every 30 frames; finish payload retains the full 5Hz score trace.',
    total: effects.length, events: effects.filter(e => keep.has(e.t) || e.t === 'log' && (e.force || e.row.event) || e.t === 'telem' && frame++ % 30 === 0) };
}
// Emscripten routes this informational startup line to console.error. Keep it
// in evidence, but classify ONLY this exact known line as info, never all stderr.
export const benignConsoleError = text => text === 'INFO: Created TensorFlow Lite XNNPACK delegate for CPU.';
export function validateRecording(recording, scenario) {
  const count = scenario.steps.filter(s => s.do === 'frames').reduce((n, s) => n + Math.ceil(s.seconds * 30), 0);
  if (recording.schema !== 1 || recording.frames?.length !== count) throw new Error('Landmark recording length does not match scenario');
  let previous = 0;
  for (const f of recording.frames) {
    if (!Number.isFinite(f.t) || f.t <= previous || Math.abs(f.t - previous - 1 / 30) > .001 ||
        !Number.isFinite(f.aspect) || f.aspect <= 0 ||
        !(f.landmarks === null || (Array.isArray(f.landmarks) && f.landmarks.length === 33 &&
          f.landmarks.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.visibility)))))
      throw new Error('Invalid recorded frame or non-30fps timeline');
    previous = f.t;
  }
  return recording.frames;
}
export function engineSource(html) {
  const modules = html.split('<script type="module">');
  if (modules.length !== 2) throw new Error('Expected exactly one app module');
  const js = modules[1].split('</script>')[0];
  const start = js.indexOf('const TIERS'), end = js.indexOf('const VERSION');
  if (start < 0 || end <= start) throw new Error('Engine extraction boundary changed');
  return js.slice(start, end);
}
export async function loadEngine(html) {
  return import('data:text/javascript;base64,' + Buffer.from(engineSource(html) +
    '\nexport { SessionCore, CalibrationCore, PLANS, M, TIERS, Rep, Evaluator, neededJoints, buildFrame, framing, framingCue, BASE };').toString('base64'));
}
export function validate(s) {
  if (s.schema !== 1 || !/^[a-z0-9-]+$/.test(s.id ?? '') || !s.oracle ||
      !['learning', 'building', 'strong'].includes(s.tier) || !s.plan || !s.steps?.length)
    throw new Error('Invalid scenario header');
  const kinds = ['start', 'frames', 'check', 'skip', 'finishBySkipping', 'ui', 'focusGuard', 'demo', 'csv'];
  if (s.planSpec && (s.planSpec.id !== s.plan || !s.planSpec.steps?.length || !s.planSpec.steps.every(x => typeof x.ex === 'string' && Number.isFinite(x.t))))
    throw new Error('Invalid test-only plan');
  if (s.coverageGaps !== undefined && (!Array.isArray(s.coverageGaps) ||
      !s.coverageGaps.every(x => typeof x === 'string' && x.trim()))) throw new Error('Invalid scenario coverage gaps');
  if (s.steps[0].do !== 'start') throw new Error('Scenario must start a core');
  if (!s.steps.some(step => step.do === 'check')) throw new Error('Scenario must contain an independent engine assertion');
  for (const step of s.steps) {
    if (!kinds.includes(step.do)) throw new Error(`Unknown action: ${step.do}`);
    if (step.do === 'start' && !['session', 'calibration'].includes(step.core)) throw new Error('Invalid core');
    if (step.do === 'skip' && !['key', 'button'].includes(step.via)) throw new Error('Invalid skip control');
    if (step.do === 'frames' && (!Number.isFinite(step.seconds) || step.seconds <= 0 || step.seconds > 120 ||
        Math.abs(step.seconds * 30 - Math.round(step.seconds * 30)) > .000001 ||
        !(step.pose === null || typeof step.pose === 'string'))) throw new Error('Invalid frame segment');
    if (step.do === 'check' && (!step.label || !step.path ||
        (Object.hasOwn(step, 'equals') === Object.hasOwn(step, 'between')))) throw new Error('Invalid assertion');
    if (Object.hasOwn(step, 'between') && (!Array.isArray(step.between) || step.between.length !== 2 || !step.between.every(Number.isFinite) || step.between[0] > step.between[1]))
      throw new Error('Invalid assertion interval');
    if (step.do === 'ui' && (!step.label || !step.selector ||
        ['text', 'count', 'visible'].filter(k => Object.hasOwn(step, k)).length !== 1)) throw new Error('Invalid UI assertion');
  }
  return s;
}
export function assertion(step, snapshot) {
  const actual = step.path.split('.').reduce((v, k) => v?.[k], snapshot);
  const expected = step.between ?? step.equals;
  const pass = step.between
    ? typeof actual === 'number' && Number.isFinite(actual) && actual >= expected[0] && actual <= expected[1]
    : actual !== undefined && isDeepStrictEqual(actual, expected);
  const reported = actual === undefined ? '(missing)' : typeof actual === 'number' && !Number.isFinite(actual) ? String(actual) : actual;
  return { label: step.label, path: step.path, actual: reported, expected, pass };
}
export function snapshot(core, effects) {
  const last = t => effects.findLast(e => e.t === t)?.payload ?? null;
  return { index: core?.i ?? null, movement: core?.mvId ?? null, done: core?.done ?? false,
    state: core?.state ?? null, observation: effects.findLast(e => e.t === 'telem')?.r ?? null,
    held: core?.ev?.hold ?? 0, scoreN: core?.scoreN ?? 0, out: core?.out ?? [],
    reps: core?.ev?.rep?.display() ?? 0,
    calibration: last('calibFinish'), finish: last('finish') };
}
export async function fixtures(root) {
  const vectors = JSON.parse(await readFile(new URL('../conformance-vectors.json', root), 'utf8'));
  const exercise = exerciseInputs(vectors.poses);
  const partial = partialVisibilityInputs(exercise, vectors.poses);
  return (pose, t = 0) => {
    if (pose === null) return null;
    if (pose.startsWith('partial:')) return partial(pose, t);
    if (pose.startsWith('exercise:')) return exercise.resolve(pose, t);
    const joints = vectors.poses[pose];
    if (!joints) throw new Error(`Missing pose fixture: ${pose}`);
    const side = Object.fromEntries(Object.entries(joints).map(([k, [x, y]]) => [k, { x, y, c: .95 }]));
    return { left: side, right: structuredClone(side), cam: 'left', conf: .95 };
  };
}
export async function runTimeline(scenario, adapter) {
  const checks = [], checkpoints = [];
  let seconds = 0;
  for (const [index, step] of scenario.steps.entries()) {
    if (step.do === 'check') checks.push({ ...assertion(step, await adapter.snapshot()), step: index, seconds });
    else if (['ui', 'focusGuard', 'demo', 'csv'].includes(step.do)) {
      if (adapter.ui) checks.push(...await adapter.ui(step, index));
    } else if (step.do === 'frames') {
      await adapter.frames(step, seconds); seconds += step.seconds;
    } else if (step.do === 'finishBySkipping') {
      let attempts = 0;
      while (!(await adapter.snapshot()).done && attempts++ < 30) await adapter.skip('key');
      if (!(await adapter.snapshot()).done) throw new Error('Session failed to finish after 30 skips');
    } else await adapter[step.do](step.do === 'start' ? step.core : step.via);
    if (['check', 'ui'].includes(step.do)) {
      checkpoints.push({ step: index, seconds, state: structuredClone(await adapter.snapshot()) });
      if (adapter.capture && (scenario.capture !== 'ui' || step.do === 'ui')) await adapter.capture(index);
    }
  }
  return { checks, checkpoints };
}
export function engineAdapter(engine, scenario, frameFor, recordedFrames) {
  let core, now = 0, frameIndex = 0;
  const effects = [];
  const add = E => effects.push(...E.map(e => ({ ...e, testTime: now })));
  const env = { speaking: () => false, portrait: () => false, hasDemo: () => true };
  return {
    effects,
    async start(kind) {
      if (kind === 'calibration') core = new engine.CalibrationCore(env);
      else {
        const plan = scenario.planSpec || engine.PLANS.find(p => p.id === scenario.plan);
        if (!plan) throw new Error(`Missing plan: ${scenario.plan}`);
        core = new engine.SessionCore(plan, scenario.tier, env); add(core.start());
      }
    },
    async frames(step) {
      const n = Math.ceil(step.seconds * 30), dt = step.seconds / n;
      for (let i = 0; i < n; i++) {
        const saved = recordedFrames?.[frameIndex++];
        const frame = saved ? saved.landmarks ? engine.buildFrame(saved.landmarks, saved.aspect) : null : frameFor(step.pose, i * dt);
        now += dt; add(core.tick(frame, dt, now));
      }
    },
    async skip() { add(core.skip('user')); },
    async snapshot() { return snapshot(core, effects); }
  };
}
