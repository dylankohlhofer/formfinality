import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadEngine} from '../../testing/lib.mjs';
import {DURATION, FPS, REPETITIONS, TIMING, engineFrameAt} from '../src/motion.ts';

// Reuse the existing build extraction, not a copied judging implementation.
const engine = await loadEngine(await readFile(new URL('../../form-coach-v4.11.html', import.meta.url), 'utf8'));
for (const tier of engine.M.squat.tiers) {
  test(`synthetic side-projected joints: three squat cycles count at ${tier}`, () => {
    const evaluator = new engine.Evaluator(engine.M.squat, tier);
    evaluator.arm(0);
    for (let frame = 0; frame < DURATION; frame++) {
      const result = evaluator.evaluate(engineFrameAt(frame), 1 / FPS, (frame + 1) / FPS);
      assert.equal(result.inPosition, true, `frame ${frame} must pass required position evidence`);
    }
    assert.equal(evaluator.rep.display(), REPETITIONS);
  });
  test(`stationary synthetic geometry earns no reps at ${tier}`, () => {
    for (const poseFrame of [0, TIMING.bottom]) {
      const evaluator = new engine.Evaluator(engine.M.squat, tier); evaluator.arm(0);
      for (let frame = 0; frame < DURATION; frame++) evaluator.evaluate(engineFrameAt(poseFrame), 1 / FPS, (frame + 1) / FPS);
      assert.equal(evaluator.rep.display(), 0);
    }
  });
}
