import { isDeepStrictEqual } from 'node:util';
import { compactEffects } from './lib.mjs';

const env = { speaking: () => false, portrait: () => false, hasDemo: () => true };
export function singlePlan(id) {
  return { id: `lab-${id}`, name: `Test ${id}`, tiers: ['learning', 'building', 'strong'], disc: 'TEST',
    blurb: 'Synthetic single-exercise test plan; never added to the production file.', steps: [{ ex: id, t: 8 }] };
}
export function exerciseSweep(E, inputs) {
  if (!isDeepStrictEqual(Object.keys(E.M).sort(), inputs.ids.slice().sort())) throw new Error('Movement library changed: author fixtures deliberately');
  const results = [];
  for (const [id, mv] of Object.entries(E.M)) for (const tier of mv.tiers) {
    const checks = [], evidence = [];
    const check = (label, actual, expected, category) => checks.push({ label, actual, expected, category, pass: isDeepStrictEqual(actual, expected) });
    const setup = () => {
      const core = new E.SessionCore(singlePlan(id), tier, env), effects = [...core.start()]; let now = 0;
      return { core, effects, feed(seconds, source, fps = 30) {
        const n = Math.round(seconds * fps), dt = seconds / n;
        for (let i = 0; i < n; i++) { now += dt; effects.push(...core.tick(typeof source === 'function' ? source(i * dt) : source, dt, now)); }
      } };
    };
    const run = setup();
    check('Starts the named movement, not an accidental regression', run.core.mvId, id, 'lifecycle');
    run.feed(2, null);
    check('No body cannot arm the movement', run.core.state, 'setup', 'tracking');
    check('No body cannot add measured frames', run.core.scoreN, 0, 'tracking');
    run.feed(2, inputs.frame(id, 0, { confidence: 0 }));
    check('Low confidence cannot arm the movement', run.core.state, 'setup', 'tracking');
    run.feed(3, inputs.frame(id));
    check('Authored starting geometry arms the exercise', run.core.state, 'active', 'geometry');
    const held = run.core.ev.hold, count = run.core.ev.rep?.display() ?? 0, scoreN = run.core.scoreN;
    run.feed(2, null);
    check('Tracking loss freezes hold time', run.core.ev.hold, held, 'tracking');
    check('Tracking loss adds no reps', run.core.ev.rep?.display() ?? 0, count, 'tracking');
    check('Tracking loss adds no score samples', run.core.scoreN, scoreN, 'tracking');
    run.feed(1, inputs.frame(id));
    check('Tracking recovers without resetting the exercise', run.core.state, 'active', 'tracking');
    if (mv.kind === 'reps') check('Remaining still does not invent reps', run.core.ev.rep.display(), 0, 'counting');
    const observedN = run.core.scoreN, observedSum = run.core.scoreSum;
    run.effects.push(...run.core.skip('test-interruption'));
    check('Skip finishes the one-exercise plan', run.core.done, true, 'skip');
    check('Skipped phase score is null', run.core.out[0]?.score, null, 'skip');
    check('Skipped phase is marked skipped', run.core.out[0]?.skipped, true, 'skip');
    check('Skip preserves sample count exactly once', run.core.scoreN, observedN, 'skip');
    check('Skip preserves score sum exactly once', run.core.scoreSum, observedSum, 'skip');
    check('Skip appears in telemetry', run.effects.some(e => e.t === 'log' && e.row.state === 'skipped'), true, 'skip');
    const finish = run.effects.findLast(e => e.t === 'finish')?.payload;
    check('Debrief averages only watched frames', finish?.avg, observedN ? Math.round(observedSum / observedN) : null, 'skip');
    const completion = setup(); completion.feed(3, inputs.frame(id));
    if (mv.kind === 'reps') {
      completion.feed(64, t => inputs.frame(id, inputs.cycle(t)));
      check('Complete cycles finish the prescribed rep set', completion.core.done, true, 'completion');
      check('Only the prescribed number of reps is recorded', completion.core.out[0]?.achieved, completion.core.target, 'counting');
    } else {
      completion.feed(20, inputs.frame(id));
      check('Valid hold completes without skipping', completion.core.done, true, 'completion');
      check('Completion records the hold duration', (completion.core.out[0]?.achieved ?? 0) >= completion.core.target, true, 'completion');
    }
    check('Normal completion is not marked skipped', completion.core.out[0]?.skipped === true, false, 'completion');
    if (mv.kind === 'guided') {
      check('Guided frames never emit a form score', completion.effects.filter(e => e.t === 'telem').every(e => e.r.score === null), true, 'honesty');
      check('Guided phase has no score', completion.core.out[0]?.score, null, 'honesty');
      check('Guided session has no average form score', completion.effects.findLast(e => e.t === 'finish')?.payload.avg, null, 'honesty');
    }
    const clipped = setup(); clipped.feed(4, inputs.frame(id, 0, { clipped: true }));
    check('Off-screen required body parts cannot arm a set', clipped.core.state, 'setup', 'framing');
    if (mv.kind !== 'guided') {
      const wrongView = setup(); wrongView.feed(4, inputs.frame(id, 0, { view: mv.view === 'front' ? 90 : 0 }));
      check('Wrong camera view cannot arm a judged set', wrongView.core.state, 'setup', 'view');
      check('Wrong view is explained', wrongView.effects.some(e => e.t === 'say' && ['turnfront', 'turnside'].includes(e.key)), true, 'view');
    }
    if (mv.regression) {
      const regression = setup(); regression.feed(3, inputs.frame(id));
      regression.effects.push(...regression.core.swapToRegression());
      check('Explicit regression resolves to declared easier movement', regression.core.mvId, mv.regression, 'regression');
      check('Regression returns to setup', regression.core.state, 'setup', 'regression');
      check('Regression discards previous hold time', regression.core.ev.hold, 0, 'regression');
    }
    if (mv.kind === 'hold') {
      const durations = [15, 30, 60].map(fps => {
        const c = setup(); c.feed(3, inputs.frame(id), fps); c.feed(3, inputs.frame(id), fps); return c.core.ev.hold;
      });
      check('Hold time agrees across 15/30/60fps within one slow frame', Math.max(...durations) - Math.min(...durations) <= 1 / 15 + 1e-8, true, 'timing');
    }
    if (mv.reps) {
      // Isolate counter semantics with declared driver units, not fake body frames.
      const s = mv.reps, rep = new E.Rep(s); let now = 0;
      const rest = s.baseline ? 150 : s.rising ? s.downBelow - 20 : s.downAbove + 20;
      const peak = s.baseline ? 110 : s.rising ? s.upAbove + 20 : s.upBelow - 20;
      const tick = (value, seconds = .1) => { now += seconds; return rep.update(value, now, seconds, E.TIERS[tier].repMin); };
      tick(rest); tick(peak, 2); tick(rest, 2);
      check('One complete driver cycle counts once', rep.display(), 1, 'tempo');
      tick(peak); const fast = tick(rest);
      check('A subsequent rushed cycle is explicitly rejected', !!fast?.rejected, true, 'tempo');
      check('Rejected cycle does not increase count', rep.display(), 1, 'tempo');
      const down = s.baseline ? 150 + s.downAbove : s.rising ? s.downBelow : s.downAbove;
      const up = s.baseline ? 150 + s.upBelow : s.rising ? s.upAbove : s.upBelow;
      tick(down + .65 * (up - down), 2); const short = tick(rest, 2);
      check('Partial-range cycle is explicitly identified', !!short?.short, true, 'tempo');
      // Independently isolate dispatch at the metric boundary. The original
      // evaluator, smoothing, Rep and SessionCore remain in the path. This is not
      // a claim that a particular anatomical pose was observed.
      const dispatch = setup();
      let driver = rest;
      const read = dispatch.core.ev.read.bind(dispatch.core.ev);
      dispatch.core.ev.read = (target, frame) => target.id === s.driver ? driver : read(target, frame);
      const drive = (v, seconds) => { driver = v; dispatch.feed(seconds, inputs.frame(id)); };
      drive(rest, 3); drive(peak, 2);
      // Stop at the first completed return: dwelling at rest would count toward
      // the NEXT rep duration and make a subsequent quick movement legitimately
      // exceed the tempo floor. This fixture must actually produce a fast cycle.
      for (let i = 0; i < 90 && dispatch.core.ev.rep.display() === 0; i++) drive(rest, 1 / 30);
      check('Dispatch fixture first completes a real driver cycle', dispatch.core.ev.rep.display(), 1, 'feedback');
      drive(peak, 7 / 30); drive(rest, 7 / 30);
      check('Rejected fast rep produces an explanatory slower cue', dispatch.effects.some(e => e.t === 'say' && e.key === 'slower'), true, 'feedback');
      drive(rest, 1); drive(down + .65 * (up - down), 2); drive(rest, 2);
      check('Shallow rep produces the movement-specific explanation', dispatch.effects.some(e => e.t === 'say' && e.key === s.shortCue), true, 'feedback');
    }
    evidence.push({ kind: 'interrupted', effects: compactEffects(run.effects) }, { kind: 'completed', effects: compactEffects(completion.effects) });
    results.push({ id: `exercise-${id}-${tier}`, movement: id, tier, kind: mv.kind, mode: 'engine',
      status: checks.every(c => c.pass) ? 'passed' : 'failed', checks, evidence,
      oracle: 'Independent invariants: no observations => no progress, one cycle => one rep, interrupted phase => null, guided => no score. Inputs are synthetic geometry, not human ground truth.' });
  }
  return results;
}

export function exerciseScenarios(E) {
  return Object.entries(E.M).flatMap(([id, mv]) => mv.tiers.map(tier => ({ schema: 1,
    id: `exercise-${id}-${tier}`, movement: id, tier, plan: `lab-${id}`, planSpec: singlePlan(id), capture: 'ui',
    description: `${mv.name} at ${tier}: synthetic movement in original shell; demonstration, ghost, completion and CSV.`,
    oracle: 'UI must reflect the named movement and completed work, without exceptions. Test-only single-movement plan, not proof of availability in shipped plans.',
    steps: [
      { do: 'start', core: 'session' },
      { do: 'check', label: 'Correct movement starts', path: 'movement', equals: id },
      { do: 'frames', pose: `exercise:${id}:rest`, seconds: 1 },
      { do: 'demo', label: 'Demo renders and ghost draws without exceptions' },
      { do: 'frames', pose: `exercise:${id}:rest`, seconds: 2 },
      { do: 'frames', pose: `exercise:${id}:${mv.kind === 'reps' ? 'cycle' : 'rest'}`, seconds: mv.kind === 'reps' ? 64 : 20 },
      { do: 'check', label: 'Exercise completes', path: 'done', equals: true },
      { do: 'ui', label: 'Debrief is visible', selector: '#msgInner h2', text: 'Session complete' },
      { do: 'ui', label: 'One movement is reported', selector: '.prow', count: 1 },
      { do: 'csv', label: 'Telemetry CSV downloads with movement and state columns' }
    ]
  })));
}
