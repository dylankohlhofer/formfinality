import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadEngine } from './lib.mjs';
import { exerciseInputs } from './exercise-inputs.mjs';

const E = await loadEngine(await readFile(process.env.FORM_COACH_TEST_BUILD || new URL('../form-coach-v4.11.html', import.meta.url), 'utf8'));
const input = exerciseInputs(JSON.parse(await readFile(new URL('../conformance-vectors.json', import.meta.url))).poses);
const env = { speaking: () => false, portrait: () => false, hasDemo: () => true };
function session(id, tier = 'building') {
  const core = new E.SessionCore({ name: 'Regression', steps: [{ ex: id, t: 100 }] }, tier, env);
  const effects = core.start(); let now = 0;
  const feed = (seconds, source) => {
    for (let i = 0; i < Math.round(seconds * 30); i++) {
      now += 1 / 30;
      effects.push(...core.tick(typeof source === 'function' ? source(i / 30) : source, 1 / 30, now));
    }
  };
  return { core, effects, feed };
}
for (const loss of ['upright', 'clipped', 'view', 'confidence', 'driver', 'null']) {
  test(`interrupted push-up cannot cross ${loss} loss; fresh reps still count`, () => {
    const s = session('push-up');
    s.feed(3, input.frame('push-up'));
    s.feed(4, t => input.resolve('exercise:push-up:cycle', t));
    assert.equal(s.core.ev.rep.display(), 1, 'positive control');
    s.feed(2, input.frame('push-up', 1));
    assert.equal(s.core.ev.rep.state, 'up', 'an unfinished rep exists');
    const bad = input.frame('push-up', 1, { clipped: loss === 'clipped', view: loss === 'view' ? 0 : 90,
      confidence: loss === 'confidence' ? 0 : .95 });
    if (loss === 'driver') for (const side of ['left', 'right']) bad[side].wrist.c = 0;
    s.feed(1 / 30, loss === 'null' ? null : loss === 'upright' ? input.resolve('exercise:push-up:upright-cycle', 0) : bad);
    s.feed(2, input.frame('push-up', 1)); // recovery at the peak cannot re-prime
    s.feed(2, input.frame('push-up'));
    assert.equal(s.core.ev.rep.display(), 1, 'return of interrupted rep is not credited');
    s.feed(4, t => input.resolve('exercise:push-up:cycle', t));
    assert.equal(s.core.ev.rep.display(), 2, 'one fresh complete cycle counts');
    assert.ok(s.effects.some(e => e.t === 'banner' && /count|track|position|frame/i.test(e.text)), 'interruption is explained');
  });
}
test('position-valid imperfect form does not disable the rep counter', () => {
  const ev = new E.Evaluator(E.M['push-up'], 'building'); ev.arm(0);
  const read = ev.read.bind(ev); ev.read = (t, f) => t.id === 'bodyLine' ? 100 : read(t, f);
  let last;
  for (let i = 0; i < 180; i++) last = ev.evaluate(input.resolve('exercise:push-up:cycle', i / 30), 1 / 30, (i + 1) / 30);
  assert.equal(last.inPosition, true); assert.equal(last.inPose, false);
  assert.ok(ev.rep.display() >= 1, 'quality is not confused with position');
});
test('quality-blocked side plank explains the blocker without arming', () => {
  const s = session('side-plank'), f = input.frame('side-plank');
  for (const side of ['left', 'right']) f[side].hip.y += .21;
  s.feed(12, f);
  assert.equal(s.core.state, 'setup'); assert.equal(s.core.ev.hold, 0);
  assert.ok(s.effects.some(e => e.t === 'say' && ['sagside', 'setupShape'].includes(e.key)));
  assert.ok(!s.effects.some(e => e.t === 'banner' && e.text === 'Hold it there…'));
});
test('missing and alternating setup problems share a thirty-second voice budget', () => {
  const s = session('push-up');
  s.feed(65, t => Math.floor(t) % 2 ? null : input.frame('push-up', 0, { clipped: true }));
  const speech = s.effects.filter(e => e.t === 'say' && !['start', 'teach.push-up'].includes(e.key));
  assert.ok(speech.length >= 2 && speech.length <= 3, `reminders: ${speech.map(e => e.key)}`);
  assert.equal(s.core.state, 'setup');
});
test('no-observation gap resets the continuous setup window', () => {
  const s = session('push-up'); s.feed(1.7, input.frame('push-up')); s.feed(1, null);
  s.feed(.2, input.frame('push-up')); assert.equal(s.core.state, 'setup');
  s.feed(1.7, input.frame('push-up')); assert.equal(s.core.state, 'active');
});
test('bridge motion has no fabricated static FORM grade or red driver tint', () => {
  const s = session('glute-bridge'); s.feed(3, input.frame('glute-bridge'));
  s.feed(8, t => input.resolve('exercise:glute-bridge:cycle', t));
  assert.equal(s.core.ev.rep.display(), 2);
  assert.equal(s.core.ev.avg(), null); assert.equal(s.core.scoreN, 0);
  for (const e of s.effects.filter(e => e.t === 'telem')) {
    assert.equal(e.r.score, null); assert.deepEqual(e.r.tint?.segs ?? [], []);
  }
  assert.ok(!s.effects.some(e => e.t === 'say' && ['goodhold', 'fixed'].includes(e.key)));
});
test('normal squat cycle retains stable-posture scoring, not a knee-depth penalty', () => {
  const ev = new E.Evaluator(E.M.squat, 'building'); ev.arm(0);
  const read = ev.read.bind(ev);
  ev.read = (t, f) => t.id === 'torsoLean' ? 20 : read(t, f);
  for (let i = 0; i < 240; i++) {
    const r = ev.evaluate(input.resolve('exercise:squat:cycle', i / 30), 1 / 30, (i + 1) / 30);
    assert.equal(r.score, 100, 'independently fixed upright torso is the scored quantity');
    assert.ok(!r.tint.segs.some(s => s.a === 'knee' || s.b === 'knee'));
  }
});
test('rep exercise never receives stationary hold praise', () => {
  const s = session('push-up'); s.feed(3, input.frame('push-up'));
  s.feed(20, t => input.resolve('exercise:push-up:cycle', t));
  assert.ok(!s.effects.some(e => e.t === 'say' && ['goodhold', 'fixed'].includes(e.key)));
});
test('calibration uses the same reminder budget and resets setup on lost tracking', () => {
  const c = new E.CalibrationCore(env), effects = []; let now = 0;
  const feed = (n, frame) => { for (let i = 0; i < n; i++) { now += 1 / 30; effects.push(...c.tick(frame, 1 / 30, now)); } };
  feed(1950, null);
  assert.equal(effects.filter(e => e.t === 'say').length, 3);
  feed(30, input.frame('plank')); feed(1, null); feed(10, input.frame('plank'));
  assert.equal(c.armed, false);
});
test('top-edge clipping does not invent a missing head or reuse its recorded key', () => {
  const f = input.frame('leg-raise', 1);
  for (const side of ['left', 'right']) f[side].ankle.y = -.1;
  const key = E.framingCue(E.framing(f, E.neededJoints(E.M['leg-raise'])));
  assert.equal(key, 'frameTop'); assert.ok(!/head|feet/i.test(E.BASE[key][0]));
  assert.ok(f.left.ear.y > 0 && f.left.ear.y < 1);
});
test('quality-blocked Learning setup can offer its declared easier movement', () => {
  const s = session('plank', 'learning'), f = input.frame('plank');
  // Controlled gate failure without altering the position gate.
  const read = s.core.ev.read.bind(s.core.ev);
  s.core.ev.read = (t, frame) => t.id === 'bodyLine' ? 100 : read(t, frame);
  // Deliberate FC-LAB-007 policy: 5s setup grace, then 6s sustained difficulty.
  s.feed(12, f);
  assert.equal(s.core.state, 'setup'); assert.ok(s.effects.some(e => e.t === 'regressShow'));
});
test('completed bridge-only session names the absence of a form assessment', () => {
  const s = session('glute-bridge'); s.core.target = 2;
  s.feed(3, input.frame('glute-bridge')); s.feed(9, t => input.resolve('exercise:glute-bridge:cycle', t));
  const p = s.effects.find(e => e.t === 'finish')?.payload;
  assert.equal(p?.reps, 2); assert.equal(p.avg, null); assert.equal(p.out[0].score, null);
  assert.equal(p.nothingWrong, false); assert.match(p.headline, /No form score was measured/);
});
test('readiness warning is withdrawn as soon as tracking/position recovers', () => {
  const s = session('push-up'); s.feed(3, input.frame('push-up')); s.feed(1, null);
  assert.equal(s.core.readinessActive, true);
  const start = s.effects.length; s.feed(1 / 30, input.frame('push-up'));
  assert.ok(s.effects.slice(start).some(e => e.t === 'clearBanner'));
  assert.equal(s.core.readinessActive, false);
});
