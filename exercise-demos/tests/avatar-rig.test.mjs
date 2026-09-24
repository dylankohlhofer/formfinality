import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {handOrientation} from '../src/avatar-rig.ts';
import {poseAt, DURATION, TIMING} from '../src/motion.ts';

test('hand orientation rejects missing or degenerate forearms', () => {
  assert.throws(() => handOrientation([0,0,0], [0,0,0]), RangeError);
  assert.throws(() => handOrientation([NaN,0,0], [0,0,0]), RangeError);
  assert.throws(() => handOrientation([0,0,0], [0,Infinity,0]), RangeError);
});

test('both hands stay aligned with their forearms without frame-to-frame twisting', () => {
  for (const name of ['left','right']) {
    let previous;
    for (let frame = 0; frame < DURATION; frame++) {
      const {wrist, elbow} = poseAt(frame)[name];
      const rotation = handOrientation(wrist, elbow);
      const forearm = new Vector3(...wrist).sub(new Vector3(...elbow)).normalize();
      const hand = new Vector3(0,1,0).applyQuaternion(rotation);
      assert.ok(hand.distanceTo(forearm) < 1e-9);
      assert.ok(Math.abs(rotation.length() - 1) < 1e-9);
      if (previous) assert.ok(rotation.angleTo(previous) < 0.12, `${name} hand twists at ${frame}`);
      previous = rotation;
    }
  }
});

test('raised palms face down rather than being angled toward the camera', () => {
  const pose = poseAt(TIMING.bottom);
  for (const name of ['left','right']) {
    const {wrist, elbow} = pose[name];
    const rotation = handOrientation(wrist, elbow);
    const palmNormal = new Vector3(1,0,0).applyQuaternion(rotation);
    const fingers = new Vector3(0,1,0).applyQuaternion(rotation);
    assert.ok(palmNormal.distanceTo(new Vector3(0,-1,0)) < 1e-9);
    assert.ok(fingers.distanceTo(new Vector3(1,0,0)) < 1e-9);
  }
});
