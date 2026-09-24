import test from 'node:test';
import assert from 'node:assert/strict';
import {OrthographicCamera, Vector3} from 'three';
import {poseAt, timeline, teachingAt, cameraAt, CAMERA, CAMERA_TURN, stageSize, LENGTHS, DURATION, CYCLE, FPS, TIMING} from '../src/motion.ts';
import {PROPORTIONS} from '../src/proportions.ts';

const distance = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]));
test('invalid times fail loudly', () => {
  for (const frame of [-1, NaN, Infinity, DURATION]) assert.throws(() => poseAt(frame), RangeError);
});
test('three complete authored cycles, closed endpoints and predictable scrubbing', () => {
  assert.deepEqual(poseAt(0), poseAt(DURATION - 1));
  for (let frame = 0; frame < CYCLE; frame++) {
    assert.deepEqual(poseAt(frame), poseAt(frame + CYCLE));
    assert.deepEqual(poseAt(frame), poseAt(frame + 2 * CYCLE));
  }
  assert.equal(timeline(TIMING.bottom).phase, 'pause');
  assert.equal(timeline(TIMING.rise).phase, 'rise');
  assert.equal(timeline(DURATION - 1).progress, 1);
  const samples = [0, 120, 89, 359, 10].map(poseAt);
  assert.deepEqual(samples, [0, 120, 89, 359, 10].map(poseAt));
});
test('each teaching card persists for a full 5.4-second cycle, independent of the short phase changes', () => {
  for (let cycle = 0; cycle < 3; cycle++) {
    const first = teachingAt(cycle * CYCLE);
    for (let frame = 1; frame < CYCLE; frame++) assert.deepEqual(teachingAt(cycle * CYCLE + frame), first);
  }
  assert.equal(new Set([0, CYCLE, 2 * CYCLE].map(frame => teachingAt(frame).title)).size, 3);
  assert.throws(() => teachingAt(DURATION), RangeError);
});
test('the second full squat is front-on and camera turns happen only while standing', () => {
  assert.equal(cameraAt(0).label, 'THREE-QUARTER VIEW');
  assert.equal(cameraAt(DURATION - 1).label, 'THREE-QUARTER VIEW');
  for (let frame = 0; frame < DURATION; frame++) {
    const view = cameraAt(frame), time = timeline(frame);
    if (view.front > 0 && view.front < 1) assert.equal(time.depth, 0, `turn during movement at ${frame}`);
    if (time.phase !== 'stand') {
      assert.equal(view.front, time.repetition === 2 ? 1 : 0);
      if (time.repetition === 2) {
        assert.equal(view.position[2], 0);
        assert.ok(view.position[0] > view.target[0]);
        assert.equal(teachingAt(frame).title, 'Knees follow\nyour toes.');
      }
    }
  }
  assert.equal(cameraAt(CYCLE + CAMERA_TURN.after).front, 1);
  assert.ok(CAMERA_TURN.after < TIMING.lower, 'camera must settle before descent');
});
test('camera seeks are deterministic, invalid frames fail and the loop closes', () => {
  for (const frame of [-1,NaN,Infinity,DURATION]) assert.throws(() => cameraAt(frame), RangeError);
  const frames = [0,165,243,325,400,485];
  const expected = new Map(frames.map(frame => [frame,cameraAt(frame)]));
  for (const frame of frames.toReversed()) assert.deepEqual(cameraAt(frame), expected.get(frame));
  assert.deepEqual(cameraAt(0), cameraAt(DURATION - 1));
});
test('camera orbit is smooth with constant distance, target and elevation', () => {
  const radius = distance(CAMERA.position, CAMERA.target);
  for (let frame = 1; frame < DURATION; frame++) {
    const view = cameraAt(frame), previous = cameraAt(frame - 1);
    assert.deepEqual(view.target, CAMERA.target);
    assert.equal(view.position[1], CAMERA.position[1]);
    assert.ok(Math.abs(distance(view.position, view.target) - radius) < 1e-9);
    assert.ok(distance(view.position, previous.position) < 0.40, `camera jump at ${frame}`);
  }
});
test('marginally quicker reps retain a controlled descent, bottom pause and ascent', () => {
  assert.equal(CYCLE / FPS, 5.4);
  assert.equal(DURATION / FPS, 16.2);
  assert.equal((TIMING.bottom - TIMING.lower) / FPS, 1.8);
  assert.equal((TIMING.rise - TIMING.bottom) / FPS, 0.5);
  assert.equal((TIMING.stand - TIMING.rise) / FPS, 1.8);
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const [frame, phase, depth] of [[0,'stand',0],[27,'lower',0],[81,'pause',1],[96,'rise',1],[150,'stand',0]]) {
      const actual = timeline(cycle * CYCLE + frame);
      assert.equal(actual.phase, phase);
      assert.equal(actual.depth, depth);
    }
  }
});
test('relaxed shoulders stay below the neckline throughout the lean', () => {
  for (let frame = 0; frame < DURATION; frame++) {
    const {left, right, chest, lean} = poseAt(frame);
    for (const side of [left, right]) {
      assert.ok(Math.abs(chest[1] - side.shoulder[1] - 0.045 * Math.cos(lean)) < 1e-9);
      assert.ok(Math.abs(chest[0] - side.shoulder[0] - 0.045 * Math.sin(lean)) < 1e-9);
    }
  }
});
test('fixed feet, constant limb lengths and finite points across every frame', () => {
  for (let frame = 0; frame < DURATION; frame++) {
    const pose = poseAt(frame);
    for (const name of ['left', 'right']) {
      const side = pose[name], initial = poseAt(0)[name];
      for (const joint of ['ankle', 'heel', 'toe']) assert.deepEqual(side[joint], initial[joint]);
      for (const [a, b, length] of [['ankle','knee',LENGTHS.shin],['hip','knee',LENGTHS.thigh],['shoulder','elbow',LENGTHS.upperArm],['elbow','wrist',LENGTHS.forearm]])
        assert.ok(Math.abs(distance(side[a], side[b]) - length) < 1e-9, `${frame} ${name} ${a}-${b}`);
      for (const point of Object.values(side)) assert.ok(point.every(Number.isFinite) && point[1] >= 0);
    }
    assert.ok(Math.abs(distance(pose.hip, pose.chest) - LENGTHS.torso) < 1e-9);
  }
});
test('smooth bounded frame-to-frame movement, including cycle boundary', () => {
  for (let frame = 1; frame < DURATION; frame++)
    for (const side of ['left','right'])
      for (const joint of Object.keys(poseAt(frame)[side]))
        assert.ok(distance(poseAt(frame)[side][joint], poseAt(frame - 1)[side][joint]) < 0.035);
});
for (const portrait of [false, true]) test(`whole figure fits the ${portrait ? 'portrait' : 'landscape'} stage at every frame`, () => {
  const {width, height, zoom, platformRadius} = stageSize(portrait);
  const camera = new OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 30);
  camera.zoom = zoom; camera.updateProjectionMatrix();
  for (let frame = 0; frame < DURATION; frame++) {
    const view = cameraAt(frame);
    camera.position.set(...view.position); camera.lookAt(...view.target); camera.updateMatrixWorld();
    for (let i = 0; i < 96; i++) {
      const angle = i / 96 * Math.PI * 2;
      const screen = new Vector3(platformRadius * Math.cos(angle), 0, platformRadius * Math.sin(angle)).project(camera);
      assert.ok(Math.abs(screen.x) < 0.99 && Math.abs(screen.y) < 0.99, `clipped platform at ${frame}`);
    }
    const pose = poseAt(frame);
    for (const point of [...Object.values(pose.left), ...Object.values(pose.right), pose.head]) {
      // Conservative margin around joint centres to include the visible mesh.
      for (const dx of [-0.15, 0.15]) for (const dy of [-0.15, 0.15]) {
        const screen = new Vector3(point[0] + dx, point[1] + dy, point[2]).project(camera);
        assert.ok(Math.abs(screen.x) < 0.94 && Math.abs(screen.y) < 0.94, `clipped frame ${frame}`);
      }
    }
    for (const side of [pose.left, pose.right]) {
      const fingertip = new Vector3(...side.wrist).add(new Vector3(...side.wrist).sub(new Vector3(...side.elbow)).normalize().multiplyScalar(PROPORTIONS.handReach));
      for (const dx of [-0.07,0.07]) for (const dy of [-0.07,0.07]) for (const dz of [-0.07,0.07]) {
        const screen = fingertip.clone().add(new Vector3(dx,dy,dz)).project(camera);
        assert.ok(Math.abs(screen.x) < 0.94 && Math.abs(screen.y) < 0.94, `clipped hand frame ${frame}`);
      }
    }
  }
});
