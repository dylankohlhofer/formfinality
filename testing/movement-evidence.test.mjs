// Independent synthetic evidence contract. No human footage, REF geometry,
// altered movement declarations, mocked readings, or generated expected outputs.
// Run only this engine file: node --test testing/movement-evidence.test.mjs
// FORM_COACH_TEST_BUILD selects the build, as in the existing regression tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadEngine } from './lib.mjs';
import { exerciseInputs } from './exercise-inputs.mjs';

const build = process.env.FORM_COACH_TEST_BUILD || new URL('../form-coach-v4.11.html', import.meta.url);
const html = await readFile(build, 'utf8');
const E = await loadEngine(html);
const input = exerciseInputs(JSON.parse(await readFile(new URL('../conformance-vectors.json', import.meta.url), 'utf8')).poses);
const modes = ['missing', 'outside', 'low-confidence'];
const env = { speaking: () => false, portrait: () => false, hasDemo: () => true };

// Change ONLY the named landmarks, on both sides so bilateral aggregation cannot
// replace the lost observation with an identical healthy synthetic counterpart.
// Keep global confidence and view healthy: this is local evidence loss.
function unavailable(frame, joints, mode) {
  const f = structuredClone(frame);
  for (const side of ['left', 'right']) for (const joint of joints) {
    if (mode === 'missing') delete f[side][joint];
    else if (mode === 'outside') f[side][joint].x = 1.05;
    else if (mode === 'low-confidence') f[side][joint].c = .1;
    else throw new Error(`Unknown evidence loss: ${mode}`);
  }
  return f;
}

function evaluator(id, tier = 'building', fps = 30) {
  const ev = new E.Evaluator(E.M[id], tier);
  ev.arm(0);
  let ticks = 0;
  return { ev, feed(seconds, source) {
    const rows = [];
    for (let i = 0; i < Math.round(seconds * fps); i++) {
      const f = typeof source === 'function' ? source(i / fps) : source;
      rows.push(ev.evaluate(f, 1 / fps, ++ticks / fps));
    }
    return rows;
  } };
}

function session(id, tier = 'building') {
  const core = new E.SessionCore({ name: 'Evidence contract', steps: [{ ex: id, t: 100 }] }, tier, env);
  core.start();
  let ticks = 0;
  return { core, feed(seconds, source) {
    const effects = [];
    for (let i = 0; i < Math.round(seconds * 30); i++) {
      const f = typeof source === 'function' ? source(i / 30) : source;
      effects.push(...core.tick(f, 1 / 30, ++ticks / 30));
    }
    return effects;
  } };
}

const cycle = id => t => input.frame(id, input.cycle(t));
const lostCycle = (id, joints, mode) => t => unavailable(cycle(id)(t), joints, mode);
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-8,
  `${label}: expected ${expected}s, got ${actual}s`);

function noUnavailableJudgement(rows, targets, joints, cues) {
  assert.ok(rows.length, 'Exercise was actually evaluated');
  for (const r of rows) {
    // Either omit an unreadable target or retain an explicitly unmeasured entry.
    for (const x of r.readings.filter(x => targets.includes(x.t.id))) {
      assert.ok(x.v == null && x.s == null && x.cue == null,
        `${x.t.id} must not produce a value, score or correction without its landmarks`);
    }
    assert.ok(!cues.includes(r.cue), `Unavailable target emitted ${r.cue}`);
    assert.ok(!(r.tint?.segs || []).some(s => joints.includes(s.a) || joints.includes(s.b)),
      'Unavailable landmarks must not receive form tint');
  }
}

test('evidence contract uses the current declared drivers and required plank ankle', t => {
  t.diagnostic(`Build SHA-256: ${createHash('sha256').update(html).digest('hex')}`);
  assert.equal(E.M.crunch.reps.driver, 'trunk', 'No alternate crunch driver is approved');
  const trunk = E.M.crunch.targets.find(x => x.id === 'trunk').m;
  assert.deepEqual([trunk.k, trunk.v, trunk.a, trunk.c],
    ['angle', 'hip', 'shoulder', 'knee'], 'Keep the validated crunch driver joints');
  assert.equal(E.M['push-up'].reps.driver, 'elbowAngle', 'No alternate push-up driver is approved');
  const neck = E.M.crunch.targets.find(x => x.id === 'neck');
  assert.equal(neck.m.a, 'ear');
  assert.ok(!neck.pos && !neck.gate, 'Crunch neck feedback is optional quality');
  assert.ok(E.M.plank.targets.some(x => x.id === 'legsStraight' && x.pos && x.m.c === 'ankle'),
    'Plank ankle is required position evidence, even though quality also reads it');
  assert.ok(E.M.plank.targets.some(x => x.id === 'bodyLine' && x.gate && x.m.c === 'ankle'));
  assert.ok(E.M['side-plank'].targets.some(x => x.id === 'bodyLine' && x.gate && x.m.c === 'ankle'),
    'A hold shape gate cannot become optional just because it is not labelled pos');
  // The current push-up has NO neck target. Ear loss below is an unused-landmark
  // control, not a claim that the shipped engine measures push-up neck quality.
  assert.ok(!E.M['push-up'].targets.some(x => Object.values(x.m).includes('ear')));
});

const repCases = [
  { id: 'crunch', tiers: ['learning', 'building'], optional: 'ear', targets: ['neck'], cues: ['neckpull'], unscored: true },
  { id: 'push-up', tiers: ['building', 'strong'], optional: 'ear', targets: [], cues: ['neck'], unscored: false },
  // Unlike plank's ankle, wall push-up's ankle belongs ONLY to bodyLine quality.
  { id: 'wall-push-up', tiers: ['learning'], optional: 'ankle', targets: ['bodyLine'], cues: ['straighten'], unscored: true },
  { id: 'leg-raise', tiers: ['building', 'strong'], optional: 'knee', targets: ['kneesStraight'], cues: ['knees'], unscored: true }
];

for (const c of repCases) for (const tier of c.tiers) {
  test(`${c.id}/${tier}: stationary control earns zero; three visible cycles earn three reps`, () => {
    const run = evaluator(c.id, tier);
    run.feed(4, input.frame(c.id));
    assert.equal(run.ev.rep.display(), 0);
    run.feed(12, cycle(c.id));
    assert.equal(run.ev.rep.display(), 3);
  });

  for (const mode of modes) {
    test(`${c.id}/${tier}: ${mode} optional ${c.optional} preserves three observed cycles`, () => {
      const run = evaluator(c.id, tier);
      const rows = run.feed(12, lostCycle(c.id, [c.optional], mode));
      assert.equal(run.ev.rep.display(), 3, 'Only optional quality evidence was removed');
      assert.ok(rows.every(r => r.ok && r.inPosition && !r.repPaused),
        'Visible required evidence must remain usable throughout the cycle');
    });

    test(`${c.id}/${tier}: ${mode} optional ${c.optional} is excluded from quality judgements`, () => {
      const run = evaluator(c.id, tier);
      const rows = run.feed(4, lostCycle(c.id, [c.optional], mode));
      noUnavailableJudgement(rows, c.targets, [c.optional], c.cues);
      if (c.unscored) {
        assert.ok(rows.every(r => r.score === null), 'No remaining quality means null, never zero or 100');
        assert.equal(run.ev.avg(), null);
        assert.equal(run.ev.n, 0, 'Unavailable quality cannot create average samples');
        assert.equal(run.ev.scoreTrace.length, 0, 'Unavailable quality cannot create trace samples');
      } else {
        assert.ok(rows.every(r => Number.isFinite(r.score)), 'Visible push-up hip quality still supplies a score');
      }
    });

    test(`${c.id}/${tier}: ${mode} optional ${c.optional} midway through a rep preserves that cycle`, () => {
      const run = evaluator(c.id, tier);
      run.feed(4, cycle(c.id));
      assert.equal(run.ev.rep.display(), 1);
      run.feed(2, input.frame(c.id, 1));
      assert.equal(run.ev.rep.state, 'up');
      run.feed(1 / 30, unavailable(input.frame(c.id, 1), [c.optional], mode));
      run.feed(2, input.frame(c.id, 1));
      run.feed(2, input.frame(c.id));
      assert.equal(run.ev.rep.display(), 2, 'Required evidence stayed visible across the optional loss');
    });
  }
}

// feetUp has an explicit historical exception: missing foot orientation is an
// optional hint. Required torso/hipAngle evidence must still be visible. This
// asserts behavior without fixing the proposed optional-declaration field name.
for (const mode of modes) for (const joints of [['toe'], ['heel', 'toe']]) {
  test(`leg-raise: ${mode} optional feetUp ${joints.join('+')} preserves visible ankle-driver cycles`, () => {
    const run = evaluator('leg-raise');
    const rows = run.feed(12, lostCycle('leg-raise', joints, mode));
    assert.equal(run.ev.rep.display(), 3, 'Foot orientation loss must not veto the visible hip/ankle cycle');
    assert.ok(rows.every(r => r.inPosition && !r.repPaused));
    const s = session('leg-raise');
    s.feed(3, unavailable(input.frame('leg-raise'), joints, mode));
    assert.equal(s.core.state, 'active', 'Optional foot orientation does not prevent setup');
  });

  test(`leg-raise: ${mode} optional feetUp ${joints.join('+')} is not reported as a measurement`, () => {
    const run = evaluator('leg-raise');
    noUnavailableJudgement(run.feed(4, lostCycle('leg-raise', joints, mode)), ['feetUp'], joints, []);
  });
}

// These required landmarks are chosen explicitly from M, not by asking the
// implementation which missing observations it would prefer to tolerate.
const requiredRepCases = [
  { id: 'crunch', joint: 'knee', role: 'trunk driver and bent-knee position' },
  { id: 'crunch', joint: 'ankle', role: 'bent-knee position (driver still visible)' },
  { id: 'push-up', joint: 'wrist', role: 'elbow driver' },
  { id: 'push-up', joint: 'ankle', role: 'straight-leg position (driver still visible)' },
  { id: 'leg-raise', joint: 'ankle', role: 'hipAngle driver (no knee-driver substitute)' }
];

for (const c of requiredRepCases) for (const mode of modes) {
  test(`${c.id}: ${mode} required ${c.joint} cannot arm or earn unseen reps`, () => {
    const run = evaluator(c.id);
    run.feed(8, lostCycle(c.id, [c.joint], mode));
    assert.equal(run.ev.rep.display(), 0, `Missing ${c.role} cannot be replaced by another moving joint`);
    const s = session(c.id);
    s.feed(4, unavailable(input.frame(c.id), [c.joint], mode));
    assert.equal(s.core.state, 'setup', 'Required observations must precede arming');
    assert.equal(s.core.ev.rep.display(), 0);
  });

  test(`${c.id}: ${mode} required ${c.joint} breaks partial/hidden cycles; fresh recovery counts`, () => {
    const run = evaluator(c.id);
    run.feed(4, cycle(c.id));
    assert.equal(run.ev.rep.display(), 1, 'Completed work before interruption');
    run.feed(2, input.frame(c.id, 1));
    assert.equal(run.ev.rep.state, 'up', 'A genuinely observed partial cycle is pending');
    run.feed(1 / 30, unavailable(input.frame(c.id, 1), [c.joint], mode));
    run.feed(2, input.frame(c.id, 1));
    run.feed(2, input.frame(c.id));
    assert.equal(run.ev.rep.display(), 1, 'Even one missing frame must break the interrupted cycle');
    const hidden = run.feed(8, lostCycle(c.id, [c.joint], mode));
    assert.equal(run.ev.rep.display(), 1, 'Two hidden cycles cannot add work');
    assert.ok(hidden.every(r => !r.inPosition && r.score === null && r.rep == null),
      'Unavailable required evidence pauses movement judgement');
    run.feed(2, input.frame(c.id, 1));
    run.feed(2, input.frame(c.id));
    assert.equal(run.ev.rep.display(), 1, 'Reappearing at peak and returning is not a new complete rep');
    run.feed(4, cycle(c.id));
    assert.equal(run.ev.rep.display(), 2, 'A fresh observed rest/peak/return cycle counts exactly once');
  });
}

for (const id of ['crunch', 'push-up']) {
  test(`${id}: wholly off-screen cycles earn nothing and cannot bridge recovery`, () => {
    const s = session(id);
    s.feed(3, input.frame(id));
    assert.equal(s.core.state, 'active');
    s.feed(4, cycle(id));
    assert.equal(s.core.ev.rep.display(), 1);
    s.feed(8, t => input.frame(id, input.cycle(t), { clipped: true }));
    s.feed(2, input.frame(id, 1));
    s.feed(2, input.frame(id));
    assert.equal(s.core.ev.rep.display(), 1);
    s.feed(4, cycle(id));
    assert.equal(s.core.ev.rep.display(), 2);
  });
}

for (const mode of modes) {
  test(`crunch session: ${mode} ear permits setup and counting without neck speech or FORM`, () => {
    const s = session('crunch');
    const rest = unavailable(input.frame('crunch'), ['ear'], mode);
    s.feed(3, rest);
    assert.equal(s.core.state, 'active');
    const effects = s.feed(12, lostCycle('crunch', ['ear'], mode));
    assert.equal(s.core.ev.rep.display(), 3);
    assert.equal(s.core.scoreN, 0);
    assert.ok(!effects.some(e => e.t === 'say' && ['neckpull', 'fixed', 'goodhold'].includes(e.key)));
    assert.ok(!effects.some(e => e.t === 'scoreFill' || e.t === 'scoreCol' && e.on));
    assert.ok(effects.filter(e => e.t === 'coachContext').every(e => !e.keys.includes('neckpull') && !e.positive));
  });

  test(`crunch: ${mode} ear withdraws an observed neck fault immediately; quality recovers`, () => {
    const fault = input.frame('crunch');
    // Ear on the shoulder-to-hip ray gives a 0-degree neck angle. Required
    // torso/knee geometry is untouched; this is a synthetic visible fault.
    for (const side of ['left', 'right']) {
      const p = fault[side];
      p.ear = { x: p.shoulder.x + .25 * (p.hip.x - p.shoulder.x),
        y: p.shoulder.y + .25 * (p.hip.y - p.shoulder.y), c: .95 };
    }
    const run = evaluator('crunch');
    const before = run.feed(1, fault);
    assert.ok(before.some(r => r.cue === 'neckpull'), 'Visible fault must actually be detected');
    assert.ok(before.at(-1).score < 100);
    const samples = run.ev.n;
    const missing = run.feed(1, unavailable(fault, ['ear'], mode));
    noUnavailableJudgement(missing, ['neck'], ['ear'], ['neckpull']);
    assert.ok(missing.every(r => r.score === null), 'Old smoothed quality is not a current observation');
    assert.equal(run.ev.n, samples);
    const recovery = run.feed(2, input.frame('crunch'));
    assert.ok(recovery.every(r => Number.isFinite(r.score)));
    assert.equal(run.ev.n, samples + 60, 'Fresh visible quality resumes sampling');
    assert.ok(recovery.at(-1).score > before.at(-1).score);
  });
}

const optionalHoldCases = [
  { id: 'plank', joints: ['ear', 'elbow'], targets: ['neck', 'elbows'], cues: ['neck', 'elbows'] },
  // All backFlat quality is lost here, but the declared, weighted kneeAngle
  // position remains measurable. Do not demand null for that real measurement.
  { id: 'wall-sit', joints: ['shoulder'], targets: ['backFlat'], cues: ['backwall'] }
];
for (const c of optionalHoldCases) for (const mode of modes) for (const fps of [15, 30, 60]) {
  test(`${c.id}/${fps}fps: ${mode} optional ${c.joints.join('+')} preserves observed hold time`, () => {
    const run = evaluator(c.id, 'building', fps);
    const rows = run.feed(3, unavailable(input.frame(c.id), c.joints, mode));
    near(run.ev.hold, 3, 'Only the three observed seconds count');
    assert.ok(rows.every(r => r.inPosition && r.inPose));
    noUnavailableJudgement(rows, c.targets, c.joints, c.cues);
  });
}

const requiredHoldCases = [
  { id: 'plank', joint: 'ankle', role: 'legsStraight position and bodyLine hold shape' },
  { id: 'side-plank', joint: 'ankle', role: 'bodyLine hold shape, even while torsoLevel passes' },
  { id: 'hollow-tuck', joint: 'knee', role: 'hipAngle hold shape, even while torsoLevel passes' }
];
for (const c of requiredHoldCases) for (const mode of modes) {
  test(`${c.id}: ${mode} required ${c.joint} cannot invent hold time; observed recovery resumes`, () => {
    const run = evaluator(c.id);
    const frame = input.frame(c.id);
    run.feed(2, frame);
    near(run.ev.hold, 2, 'Positive control');
    const rows = run.feed(3, unavailable(frame, [c.joint], mode));
    near(run.ev.hold, 2, `No hold time without ${c.role}`);
    assert.ok(rows.every(r => !r.inPose), 'Missing gates cannot disappear from the required conjunction');
    run.feed(2, frame);
    near(run.ev.hold, 4, 'Recovery adds only newly observed time, with no gap catch-up');
  });

  test(`${c.id}: ${mode} required ${c.joint} keeps hold setup unarmed`, () => {
    const s = session(c.id);
    s.feed(4, unavailable(input.frame(c.id), [c.joint], mode));
    assert.equal(s.core.state, 'setup', c.role);
    near(s.core.ev.hold, 0, 'Unobserved hold has earned no time');
    s.feed(3, input.frame(c.id));
    assert.equal(s.core.state, 'active', 'Observed shape permits fresh setup');
    assert.ok(s.core.ev.hold > 0 && s.core.ev.hold < 3, 'Missing setup seconds were not credited');
  });
}

// Edge audit of docs/movement-evidence-contract.md. All expectations below are
// observable invariants or elementary geometry, not output captured as an oracle.
const reading = (r, id) => r.readings.find(x => x.t.id === id);
function missingEvidence(r, lane, target, reason) {
  assert.equal(r.evidence.schema, 'movement-evidence/1');
  const item = r.evidence[lane].missing.find(x => x.target === target);
  assert.ok(item, `${lane} must report missing ${target}`);
  assert.equal(item.reason, reason);
}
function observedSides(r, target, sides) {
  const item = r.evidence.form.observed.find(x => x.target === target);
  assert.ok(item, `Form coverage must identify observed ${target}`);
  assert.deepEqual(item.sides, sides, 'Provenance names only sides supplying a usable measurement');
}
function loseSide(frame, side, joints, mode) {
  const changed = unavailable(frame, joints, mode);
  changed[side === 'left' ? 'right' : 'left'] = structuredClone(frame[side === 'left' ? 'right' : 'left']);
  return changed;
}
function neckRay(frame, forward) {
  const f = structuredClone(frame);
  for (const side of ['left', 'right']) {
    const p = f[side], sign = forward ? 1 : -1;
    p.ear = { x: p.shoulder.x + sign * .25 * (p.hip.x - p.shoulder.x),
      y: p.shoulder.y + sign * .25 * (p.hip.y - p.shoulder.y), c: .95 };
  }
  return f;
}

for (const visible of ['left', 'right']) for (const mode of modes) {
  const hidden = visible === 'left' ? 'right' : 'left';
  test(`audit bilateral: best uses only complete ${visible} side when opposite ankle is ${mode}`, () => {
    const f = input.frame('bird-dog');
    // Both candidate shoulder/hip/ankle lines are horizontal and straight.
    f.right.ankle = structuredClone(f.left.ankle);
    const run = evaluator('bird-dog');
    const rows = run.feed(1, loseSide(f, hidden, ['ankle'], mode));
    near(run.ev.hold, 1, 'One complete best-side hold gate is enough');
    for (const r of rows) {
      assert.equal(reading(r, 'legLine').v, 180);
      observedSides(r, 'legLine', [visible]);
      assert.equal(r.evidence.movement.status, 'observed');
      assert.equal(r.evidence.movement.eligible, true);
    }
  });

  test(`audit bilateral: worst uses only complete ${visible} side when opposite knee is ${mode}`, () => {
    const f = input.frame('leg-raise');
    for (const p of [f.left, f.right]) p.knee = {
      x: (p.hip.x + p.ankle.x) / 2, y: (p.hip.y + p.ankle.y) / 2, c: .95 };
    const r = evaluator('leg-raise').feed(1 / 30, loseSide(f, hidden, ['knee'], mode))[0];
    assert.ok(Math.abs(reading(r, 'kneesStraight').v - 180) < 1e-5);
    observedSides(r, 'kneesStraight', [visible]);
    assert.equal(r.inPosition, true);
    assert.equal(r.score, 100, 'An unseen knee cannot be interpreted as a bent knee');
  });

  test(`audit bilateral: mean uses only complete ${visible} side when opposite ankle is ${mode}`, () => {
    const run = evaluator('crunch');
    const rows = run.feed(12, t => {
      const f = cycle('crunch')(t);
      for (const p of [f.left, f.right]) p.ankle = { x: .84, y: .74, c: .95 };
      // hip (.56,.74), knee (.70,.60), ankle (.84,.74): exactly 90 degrees.
      return loseSide(f, hidden, ['ankle'], mode);
    });
    assert.equal(run.ev.rep.display(), 3);
    assert.ok(rows.every(r => Math.abs(reading(r, 'kneesBent').v - 90) < 1e-8));
  });
}

test('audit bilateral: two incomplete sides cannot be stitched into a complete target', () => {
  const f = input.frame('crunch');
  delete f.left.ankle;
  delete f.right.knee;
  const r = evaluator('crunch').feed(1 / 30, f)[0];
  missingEvidence(r, 'movement', 'kneesBent', 'tracking');
  assert.equal(r.evidence.movement.eligible, false);
  assert.equal(reading(r, 'kneesBent'), undefined);
});

test('audit bilateral: complete alternate camera side is selected with explicit provenance', () => {
  const f = input.frame('push-up');
  delete f.left.wrist;
  const r = evaluator('push-up').feed(1 / 30, f)[0];
  assert.deepEqual(r.evidence.camera, {requested:'left', selected:'right'});
  assert.equal(r.evidence.movement.source, 'right');
  assert.equal(r.evidence.movement.eligible, true);
  assert.equal(r.rep, null, 'Changing the observed side is not a repetition');
});

for (const id of ['crunch', 'push-up']) {
  test(`audit source: ${id} camera-side switch cannot complete a pending rep`, () => {
    const run = evaluator(id);
    run.feed(4, cycle(id));
    run.feed(2, input.frame(id, 1));
    assert.equal(run.ev.rep.display(), 1);
    assert.equal(run.ev.rep.state, 'up');
    // A confidence-only camera preference no longer changes the measured side.
    // Make the old driver genuinely unavailable to exercise a real source switch.
    const other = phase => {
      const f = {...input.frame(id, phase), cam:'right'};
      delete f.left[id === 'crunch' ? 'knee' : 'wrist'];
      return f;
    };
    const changed = run.feed(1 / 30, other(1))[0];
    assert.equal(changed.evidence.movement.source, 'right');
    assert.equal(changed.rep, null);
    run.feed(2, other(1)); run.feed(2, other(0));
    assert.equal(run.ev.rep.display(), 1, 'The return of the old side cannot be credited to the new side');
    run.feed(4, t => other(input.cycle(t)));
    assert.equal(run.ev.rep.display(), 2, 'A fresh complete cycle on the new side counts');
  });
}

for (const transition of ['both-to-left', 'left-to-both', 'left-to-right']) {
  test(`audit source: dead-bug aggregate ${transition} cannot complete a pending rep`, () => {
    const run = evaluator('dead-bug');
    const from = transition.startsWith('both') ? 'both' : 'left';
    const to = transition.endsWith('right') ? 'right' : transition.endsWith('both') ? 'both' : 'left';
    const frame = (phase, sides) => {
      const f = input.frame('dead-bug', phase);
      // Keep the existing driver and its geometry; choose which complete side
      // supplies it. Both sides use the authored moving leg for this input.
      f.right.knee = structuredClone(f.left.knee);
      // The library relies on the OTHER resting knee to pass kneeTucked during
      // mid-cycle extension. With just one side available, keep that side's knee
      // at 90 degrees by placing its ankle perpendicular to the thigh. This
      // changes no trunk-driver joints and keeps required position observable.
      for (const p of [f.left, f.right]) {
        const dx = p.hip.x - p.knee.x, dy = p.hip.y - p.knee.y;
        const scale = .18 / Math.hypot(dx, dy);
        p.ankle = { x: p.knee.x + dy * scale, y: p.knee.y - dx * scale, c: .95 };
      }
      return sides === 'both' ? f : loseSide(f, sides === 'left' ? 'right' : 'left', ['knee'], 'missing');
    };
    run.feed(4, t => frame(input.cycle(t), from));
    assert.equal(run.ev.rep.display(), 1);
    run.feed(2, frame(1, from));
    assert.equal(run.ev.rep.state, 'up');
    const changed = run.feed(1 / 30, frame(1, to))[0];
    assert.equal(changed.evidence.movement.source, to === 'both' ? 'left+right' : to);
    run.feed(2, frame(1, to)); run.feed(2, frame(0, to));
    assert.equal(run.ev.rep.display(), 1);
    run.feed(4, t => frame(input.cycle(t), to));
    assert.equal(run.ev.rep.display(), 2);
  });
}

for (const mode of modes) {
  test(`audit stale: ${mode} neck resets its filter and removes its score contribution immediately`, () => {
    const run = evaluator('plank');
    const bad = neckRay(input.frame('plank'), true);
    const before = run.feed(2, bad).at(-1);
    assert.equal(reading(before, 'neck').v, 0);
    assert.ok(before.score < 100);
    assert.ok(before.tint.segs.some(s => s.a === 'ear' || s.b === 'ear'));
    const samples = run.ev.n;
    const dropped = run.feed(1 / 30, unavailable(bad, ['ear'], mode))[0];
    assert.equal(dropped.score, 100, 'The remaining straight hips and vertical elbows have full quality');
    assert.equal(run.ev.n, samples + 1, 'Earlier legitimately observed samples are preserved');
    assert.equal(dropped.evidence.form.status, 'partial');
    missingEvidence(dropped, 'form', 'neck', mode === 'outside' ? 'clipped' : 'tracking');
    assert.ok(dropped.suppressed.includes('unobserved⊘neck'));
    const recovery = run.feed(1 / 30, neckRay(input.frame('plank'), false))[0];
    assert.equal(reading(recovery, 'neck').v, 180, 'Recovered target starts from fresh geometry');
    assert.equal(recovery.score, 100);
    assert.ok(!recovery.tint.segs.some(s => s.a === 'ear' || s.b === 'ear'));
  });
}

for (const mode of ['missing', 'low-confidence']) {
  test(`audit setup: ${mode} required crunch ankle explains tracking, not a form correction`, () => {
    const s = session('crunch');
    const effects = s.feed(1, unavailable(input.frame('crunch'), ['ankle'], mode));
    assert.equal(s.core.state, 'setup');
    assertPausedHold(effects, 'Rep setup');
    assert.ok(effects.some(e => e.t === 'say' && e.topic === 'readiness' && e.key === 'trackingLost'));
    assert.ok(!effects.some(e => e.t === 'say' && ['getin', 'setupShape'].includes(e.key)),
      'The required pose is unobserved, not a measured wrong position');
  });
}

test('audit tint: far-side knee quality cannot color an unseen camera-side knee', () => {
  const f = input.frame('leg-raise');
  f.right.hip = { x: .54, y: .75, c: .95 };
  f.right.ankle = { x: .8, y: .75, c: .95 };
  f.right.knee = { x: .9, y: .75, c: .95 }; // Visible far-side knee angle is 0.
  delete f.left.knee;
  const r = evaluator('leg-raise').feed(1 / 30, f)[0];
  observedSides(r, 'kneesStraight', ['right']);
  assert.equal(reading(r, 'kneesStraight').v, 0);
  assert.equal(r.cue, 'knees', 'The observed far-side fault still supports coaching');
  assert.ok(r.score < 100);
  assert.ok(!r.tint.segs.some(s => s.a === 'knee' || s.b === 'knee'),
    'The tint renderer draws the camera side, whose knee is unavailable');
});

test('AUDIT-STALE-ALL: complete hold observation loss clears target smoothing before recovery', () => {
  const run = evaluator('plank');
  run.feed(2, neckRay(input.frame('plank'), true));
  const lost = run.feed(1 / 30, input.frame('plank', 0, { confidence: 0 }))[0];
  assert.equal(lost.score, null);
  const recovered = run.feed(1 / 30, neckRay(input.frame('plank'), false))[0];
  assert.equal(reading(recovered, 'neck').v, 180, 'No 0-degree neck history survives a wholly unobserved frame');
  assert.ok(!recovered.tint.segs.some(s => s.a === 'ear' || s.b === 'ear'));
});

test('AUDIT-STALE-POOL: complete hold observation loss empties the score pool before recovery', () => {
  const run = evaluator('plank');
  run.feed(2, neckRay(input.frame('plank'), true));
  const n = run.ev.n;
  run.feed(1 / 30, input.frame('plank', 0, { confidence: 0 }));
  assert.equal(run.ev.n, n, 'No score samples during the gap');
  const recovered = run.feed(1 / 30, neckRay(input.frame('plank'), false))[0];
  assert.equal(recovered.score, 100, 'All currently observed quality is good; hidden history is not part of the new pool');
});

test('AUDIT-STALE-SIDE: losing the bad side of worst quality removes its smoothed contribution', () => {
  const f = input.frame('leg-raise');
  for (const p of [f.left, f.right]) {
    p.hip = { x: .54, y: .75, c: .95 }; p.ankle = { x: .8, y: .75, c: .95 };
    p.knee = { x: .67, y: .75, c: .95 };
  }
  f.right.knee.x = .9; // Right knee angle is 0 degrees; left is 180.
  const run = evaluator('leg-raise');
  const before = run.feed(2, f).at(-1);
  assert.equal(reading(before, 'kneesStraight').v, 0);
  const after = run.feed(1 / 30, loseSide(f, 'right', ['knee'], 'missing'))[0];
  observedSides(after, 'kneesStraight', ['left']);
  assert.equal(reading(after, 'kneesStraight').v, 180, 'The missing right knee cannot be blended into the visible left knee');
  assert.equal(after.score, 100);
});

const invalidPoints = [
  ['missing confidence', p => { delete p.c; }],
  ['NaN confidence', p => { p.c = NaN; }],
  ['infinite confidence', p => { p.c = Infinity; }],
  ['string confidence', p => { p.c = '.95'; }],
  ['NaN x', p => { p.x = NaN; }],
  ['infinite y', p => { p.y = Infinity; }]
];
for (const [name, change] of invalidPoints) {
  test(`audit invalid: ${name} is not optional neck evidence or a movement veto`, () => {
    const f = input.frame('crunch');
    for (const p of [f.left.ear, f.right.ear]) change(p);
    const r = evaluator('crunch').feed(1 / 30, f)[0];
    missingEvidence(r, 'form', 'neck', 'tracking');
    assert.equal(r.evidence.form.status, 'unavailable');
    assert.equal(r.evidence.movement.status, 'observed');
    assert.equal(r.evidence.movement.eligible, true);
    assert.equal(r.score, null); assert.equal(r.cue, null);
    assert.ok(r.suppressed.includes('unobserved⊘neck'));
  });

  test(`audit invalid: ${name} on the required wrist interrupts push-up evidence`, () => {
    const f = input.frame('push-up');
    for (const p of [f.left.wrist, f.right.wrist]) change(p);
    const r = evaluator('push-up').feed(1 / 30, f)[0];
    missingEvidence(r, 'movement', 'elbowAngle', 'tracking');
    assert.equal(r.evidence.movement.status, 'unavailable');
    assert.equal(r.evidence.movement.eligible, false);
    assert.equal(r.score, null); assert.equal(r.rep, null);
    assert.ok(r.evidence.movement.source == null, 'No source is claimed for an unreadable driver');
  });
}

for (const [label, c, x, observed] of [
  ['confidence boundary', .5, .24, true], ['below confidence boundary', .499999, .24, false],
  ['left margin boundary', .95, .02, true], ['inside left margin', .95, .019999, false],
  ['right margin boundary', .95, .98, true], ['inside right margin', .95, .980001, false]
]) {
  test(`audit boundary: ${label} follows the declared camera observation threshold`, () => {
    const f = input.frame('crunch');
    for (const p of [f.left.ear, f.right.ear]) Object.assign(p, { c, x });
    const r = evaluator('crunch').feed(1 / 30, f)[0];
    assert.equal(r.evidence.form.observed.some(v => v.target === 'neck'), observed);
    assert.equal(r.evidence.movement.eligible, true);
  });
}

for (const [coordinate, value] of [['x', NaN], ['y', Infinity]]) {
  test(`AUDIT-NAN: rejected optional ${coordinate} cannot poison framing metadata`, () => {
    const f = input.frame('crunch');
    f.left.ear[coordinate] = value;
    const r = evaluator('crunch').feed(1 / 30, f)[0];
    missingEvidence(r, 'form', 'neck', 'tracking');
    assert.ok(r.framing.fill == null || Number.isFinite(r.framing.fill),
      'The result must not export NaN/Infinity as a measured frame fill');
  });
}

test('audit degeneracy: collapsed optional angle is unavailable, not good neck form', () => {
  const f = input.frame('crunch');
  f.left.ear = structuredClone(f.left.shoulder);
  const r = evaluator('crunch').feed(1 / 30, f)[0];
  missingEvidence(r, 'form', 'neck', 'unreadable');
  assert.equal(r.score, null);
  assert.equal(r.evidence.movement.eligible, true);
});

test('AUDIT-DEGENERATE-VERT: coincident endpoints do not measure an upright wall-sit back', () => {
  const f = input.frame('wall-sit');
  f.left.shoulder = structuredClone(f.left.hip);
  const r = evaluator('wall-sit').feed(1 / 30, f)[0];
  missingEvidence(r, 'form', 'backFlat', 'unreadable');
  assert.equal(reading(r, 'backFlat'), undefined, 'atan2(0,0) is not an observed direction');
});

test('AUDIT-DEGENERATE-LINE: coincident endpoints do not measure a straight plank hip line', () => {
  const f = input.frame('plank');
  f.left.ankle = structuredClone(f.left.shoulder);
  const r = evaluator('plank').feed(1 / 30, f)[0];
  missingEvidence(r, 'form', 'hipAlign', 'unreadable');
  assert.equal(reading(r, 'hipAlign'), undefined, 'An undefined line cannot return perfect deviation');
});

test('AUDIT-PROVENANCE: a degenerate side is not listed as a contributing best-side measurement', () => {
  const f = input.frame('bird-dog');
  f.left.wrist = structuredClone(f.left.shoulder); // null angle on the left
  // The authored right arm is extended in line with the torso (180 degrees).
  const r = evaluator('bird-dog').feed(1 / 30, f)[0];
  assert.equal(reading(r, 'armLine').v, 180);
  observedSides(r, 'armLine', ['right']);
});

test('audit provenance: visible failing position is observed but ineligible, never missing', () => {
  const r = evaluator('push-up').feed(1 / 30, input.resolve('exercise:push-up:upright-cycle', 0))[0];
  assert.equal(r.evidence.movement.status, 'observed');
  assert.deepEqual(r.evidence.movement.missing, []);
  assert.equal(r.evidence.movement.eligible, false);
  assert.ok(r.blocking.includes('torsoLevel'));
});

test('audit provenance: a movement with no declared form targets is unscored, not unavailable', () => {
  const r = evaluator('glute-bridge').feed(1 / 30, input.frame('glute-bridge'))[0];
  assert.equal(r.evidence.form.status, 'unscored');
  assert.deepEqual(r.evidence.form.observed, []);
  assert.deepEqual(r.evidence.form.missing, []);
  assert.equal(r.score, null);
});

function assertPausedHold(effects, label) {
  assert.ok(effects.some(e => e.t === 'banner' && e.style === 'teach'), `${label}: explain the missing evidence visually`);
  assert.ok(!effects.some(e => e.t === 'scoreFill' || e.t === 'scoreCol' && e.on));
  assert.ok(!effects.some(e => e.t === 'say' && (e.topic === 'form' || e.topic === 'positive' ||
    ['goodhold', 'fixed', 'degrade'].includes(e.key))), 'Missing evidence is not bad form, recovery or praise');
  const contexts = effects.filter(e => e.t === 'coachContext');
  assert.ok(contexts.length);
  assert.ok(contexts.every(e => !e.positive && e.keys.length === 0));
}

for (const c of requiredHoldCases) for (const mode of modes) {
  test(`audit active-hold: ${c.id} ${mode} ${c.joint} is explained without form or praise`, () => {
    const s = session(c.id), frame = input.frame(c.id);
    s.feed(3, frame);
    assert.equal(s.core.state, 'active');
    const held = s.core.ev.hold, n = s.core.scoreN;
    const effects = s.feed(1, unavailable(frame, [c.joint], mode));
    near(s.core.ev.hold, held, 'Only observed hold time survives');
    assert.equal(s.core.scoreN, n);
    assertPausedHold(effects, c.id);
    const recovered = s.feed(1 / 30, frame);
    assert.ok(recovered.some(e => e.t === 'clearBanner'), 'Recovery withdraws the obsolete readiness message');
    near(s.core.ev.hold, held + 1 / 30, 'Recovery adds one new observed frame');
  });
}

for (const mode of modes) {
  test(`AUDIT-CALIBRATION: active plank ${mode} ankle is explained through readiness`, () => {
    const core = new E.CalibrationCore(env);
    let ticks = 0;
    const feed = (seconds, f) => {
      const effects = [];
      for (let i = 0; i < Math.round(seconds * 30); i++) effects.push(...core.tick(f, 1 / 30, ++ticks / 30));
      return effects;
    };
    feed(3, input.frame('plank'));
    assert.equal(core.armed, true);
    const held = core.ev.hold;
    const effects = feed(1, unavailable(input.frame('plank'), ['ankle'], mode));
    near(core.ev.hold, held, 'Calibration must also freeze missing hold evidence');
    assertPausedHold(effects, 'Calibration');
  });
}
