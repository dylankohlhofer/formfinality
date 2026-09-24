import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {Box3, Group, OrthographicCamera, Quaternion, Texture, Vector3} from 'three';
import {createMixamoRig} from '../src/mixamo-rig.ts';
import {cameraAt, CYCLE, DURATION, FPS, REPETITIONS, TIMING, stageSize} from '../src/motion.ts';
import {loadEngine} from '../../testing/lib.mjs';

// Missing licensed assets fail visibly. Run scripts/prepare-mixamo.mjs locally;
// geometry tests do not pretend a missing model or unrendered texture passed.
const data = await readFile(new URL('../public/models/alien-soldier.glb', import.meta.url));
const manifest = JSON.parse(data.subarray(20,20 + data.readUInt32LE(12)).toString());
const loader = new GLTFLoader();
loader.register(() => ({name: 'geometry-only-test', loadTexture: () => Promise.resolve(new Texture())}));
const asset = await loader.parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset + data.byteLength), '');
const makeRig = () => createMixamoRig(clone(asset.scene));
const pos = (rig, name) => rig.bones.get('mixamorig' + name).getWorldPosition(new Vector3());
const rot = (rig, name) => rig.bones.get('mixamorig' + name).getWorldQuaternion(new Quaternion());
const snapshot = rig => [...rig.bones.values()].map(b => [...b.position.toArray(), ...b.quaternion.toArray()]);

test('import includes a 65-bone skinned character and embedded, bounded textures', () => {
  assert.equal(manifest.skins[0].joints.length, 65);
  assert.equal(manifest.meshes[0].primitives.length, 2, 'retain only two opaque material groups');
  assert.ok(manifest.meshes[0].primitives.every(p => p.attributes.JOINTS_0 !== undefined && p.attributes.WEIGHTS_0 !== undefined));
  assert.equal(manifest.images.length, 4);
  const binaryStart = 20 + data.readUInt32LE(12) + 8;
  for (const image of manifest.images) {
    assert.equal(image.uri, undefined); assert.equal(image.mimeType, 'image/png');
    const offset = binaryStart + manifest.bufferViews[image.bufferView].byteOffset;
    assert.ok(data.readUInt32BE(offset + 16) <= 1024 && data.readUInt32BE(offset + 20) <= 1024);
  }
  assert.ok(data.length < 12 * 1024 * 1024);
  const rig = makeRig();
  for (const mesh of rig.meshes) {
    const weights = mesh.geometry.attributes.skinWeight;
    for (let i = 0; i < weights.count; i++) {
      const values = [weights.getX(i),weights.getY(i),weights.getZ(i),weights.getW(i)];
      assert.ok(values.every(v => Number.isFinite(v) && v >= 0));
      assert.ok(Math.abs(values.reduce((a,b) => a + b, 0) - 1) < 1e-5);
    }
  }
});

test('missing bones and invalid frames fail instead of showing a replacement character', () => {
  assert.throws(() => createMixamoRig(new Group()), /missing mixamorig/);
  const rig = makeRig();
  for (const frame of [-1,NaN,Infinity,DURATION]) assert.throws(() => rig.apply(frame), RangeError);
});

test('retargeting is seek-order independent with three closed loops', () => {
  const rig = makeRig();
  const expected = new Map([0,27,61,81,96,130,150,161].map(frame => {rig.apply(frame); return [frame,snapshot(rig)];}));
  for (const frame of [81,0,130,161,27,150,61,96]) {
    for (const cycle of [2,0,1]) { rig.apply(frame + cycle * CYCLE); assert.deepEqual(snapshot(rig), expected.get(frame)); }
  }
  rig.apply(0); const start = snapshot(rig); rig.apply(DURATION - 1); assert.deepEqual(snapshot(rig), start);
});

test('both feet and toes stay planted and every bone length stays unchanged', () => {
  const rig = makeRig();
  rig.apply(0);
  const contacts = ['LeftFoot','RightFoot','LeftToeBase','RightToeBase'];
  const fixed = contacts.map(name => ({name, p:pos(rig,name), q:rot(rig,name)}));
  const lengths = [...rig.bones.values()].map(b => b.position.length());
  for (let frame = 0; frame < CYCLE; frame++) {
    rig.apply(frame);
    for (const {name,p,q} of fixed) {
      assert.ok(pos(rig,name).distanceTo(p) * rig.scale < 1e-6, `${name} slides at ${frame}`);
      assert.ok(rot(rig,name).angleTo(q) < 1e-6, `${name} turns at ${frame}`);
    }
    [...rig.bones.values()].forEach((b,i) => {
      assert.ok(b.matrixWorld.elements.every(Number.isFinite));
      if (b.name !== 'mixamorigHips') assert.ok(Math.abs(b.position.length() - lengths[i]) < 1e-9);
    });
  }
});

test('presentation transforms cannot contaminate later animation frames', () => {
  const rig = makeRig(); rig.apply(0);
  const foot = pos(rig,'LeftFoot');
  const stage = new Group(); stage.rotation.y = Math.PI / 2; stage.scale.setScalar(rig.scale);
  stage.position.y = -rig.floor * rig.scale; stage.add(rig.root); stage.updateMatrixWorld(true);
  for (const frame of [81,0,130,27,485]) {
    rig.apply(frame);
    const local = pos(rig,'LeftFoot').applyMatrix4(stage.matrixWorld.clone().invert());
    assert.ok(local.distanceTo(foot) < 1e-6, `foot drift after stage transform at ${frame}`);
  }
});

test('knees open with the feet instead of collapsing inward during descent', () => {
  const rig = makeRig();
  const restKnees = ['Left','Right'].map(side => pos(rig,side + 'Leg'));
  rig.apply(0);
  for (const [i,side] of ['Left','Right'].entries()) {
    rig.apply(0);
    assert.ok(pos(rig,side + 'Leg').distanceTo(restKnees[i]) < 1e-6, 'neutral stance must not be warped');
    const foot = pos(rig,side + 'Foot');
    const forward = pos(rig,side + 'ToeBase').sub(foot); forward.y = 0; forward.normalize();
    const normal = new Vector3(forward.z,0,-forward.x);
    let previousOffset = Infinity, previousWidth = 0;
    for (let frame = 0; frame <= TIMING.bottom; frame++) {
      rig.apply(frame);
      const knee = pos(rig,side + 'Leg');
      const offset = Math.abs(knee.clone().sub(foot).dot(normal));
      assert.ok(offset <= previousOffset + 1e-6, `knee moves away from toe direction: ${side} at ${frame}`);
      assert.ok(Math.abs(knee.x) >= previousWidth - 1e-6, `knee collapses inward: ${side} at ${frame}`);
      previousOffset = offset; previousWidth = Math.abs(knee.x);
    }
    for (let frame = TIMING.bottom; frame <= TIMING.rise; frame++) {
      rig.apply(frame);
      assert.ok(Math.abs(pos(rig,side + 'Leg').sub(foot).dot(normal)) * rig.scale < 1e-6,
        'bottom knee must lie in its own toe-direction plane');
    }
  }
});

test('corrected knee and pelvis paths remain smooth across every phase and loop boundary', () => {
  const rig = makeRig(), names = ['LeftLeg','RightLeg','Hips'];
  rig.apply(0); let previous = names.map(name => pos(rig,name));
  for (let frame = 1; frame < DURATION; frame++) {
    rig.apply(frame);
    const points = names.map(name => pos(rig,name));
    points.forEach((point,i) => assert.ok(point.distanceTo(previous[i]) * rig.scale < 0.035, `${names[i]} jumps at ${frame}`));
    previous = points;
  }
});

for (const portrait of [false,true]) test(`actual skinned mesh stays within the ${portrait ? 'portrait' : 'landscape'} stage`, () => {
  const rig = makeRig(), {width,height,zoom} = stageSize(portrait);
  const camera = new OrthographicCamera(-width / 2,width / 2,height / 2,-height / 2,0.1,30);
  camera.zoom = zoom; camera.updateProjectionMatrix();
  for (let frame = 0; frame < DURATION; frame++) {
    const view = cameraAt(frame);
    camera.position.set(...view.position); camera.lookAt(...view.target); camera.updateMatrixWorld();
    rig.apply(frame);
    const box = new Box3().setFromObject(rig.root, true);
    for (const x of [box.min.x,box.max.x]) for (const y of [box.min.y,box.max.y]) for (const z of [box.min.z,box.max.z]) {
      const screen = new Vector3(z * rig.scale,(y - rig.floor) * rig.scale,-x * rig.scale).project(camera);
      assert.ok(Math.abs(screen.x) < 0.94 && Math.abs(screen.y) < 0.94, `clipped mesh at frame ${frame}`);
    }
    assert.ok((box.min.y - rig.floor) * rig.scale > -0.015, `mesh below floor at ${frame}`);
  }
});

const engine = await loadEngine(await readFile(new URL('../../form-coach-v4.11.html', import.meta.url), 'utf8'));
function sideProjection(rig) {
  const project = side => Object.fromEntries(Object.entries({hip:'UpLeg',knee:'Leg',ankle:'Foot',toe:'ToeBase',
    shoulder:'Arm',elbow:'ForeArm',wrist:'Hand',ear:'Head'}).map(([joint,part]) => {
    const p = pos(rig, part === 'Head' ? part : side + part);
    return [joint,{x:0.43 + p.z * rig.scale / 2.5,y:0.94 - (p.y - rig.floor) * rig.scale / 2.5,c:1}];
  }));
  return {left:project('Left'),right:project('Right'),cam:'left',conf:1,aspect:1,sideness:90};
}
for (const tier of engine.M.squat.tiers) test(`imported bones' synthetic side projection: three reps and no stationary credit at ${tier}`, () => {
  const rig = makeRig();
  const evaluator = new engine.Evaluator(engine.M.squat, tier); evaluator.arm(0);
  for (let frame = 0; frame < DURATION; frame++) {
    rig.apply(frame);
    const result = evaluator.evaluate(sideProjection(rig),1 / FPS,(frame + 1) / FPS);
    assert.equal(result.inPosition,true, `position at ${frame}`);
  }
  assert.equal(evaluator.rep.display(), REPETITIONS);
  for (const frame of [0,TIMING.bottom]) {
    rig.apply(frame); const input = sideProjection(rig);
    const still = new engine.Evaluator(engine.M.squat,tier); still.arm(0);
    for (let i = 0; i < DURATION; i++) still.evaluate(input,1 / FPS,(i + 1) / FPS);
    assert.equal(still.rep.display(),0);
  }
});
