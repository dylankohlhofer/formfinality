import {Bone, Box3, Object3D, Quaternion, SkinnedMesh, Vector3} from 'three';
import {timeline} from './motion.ts';

// Native Mixamo axes: +X left, +Y up, +Z forward, centimetres in this asset.
// The presentation wrapper converts once to the existing isotropic demo stage.
const rad = (degrees: number) => degrees * Math.PI / 180;
const worldPosition = (node: Object3D) => node.getWorldPosition(new Vector3());
const worldRotation = (node: Object3D) => node.getWorldQuaternion(new Quaternion());
const sides = ['Left','Right'] as const;

export function createMixamoRig(root: Object3D) {
  root.updateWorldMatrix(true, true);
  // Work in asset-local coordinates even after React mounts the asset inside
  // the rotated/metre-scaled stage. World-space feedback would double-transform
  // every frame after the first, although an isolated still could look correct.
  const rigPosition = (node: Object3D) => worldPosition(node).applyMatrix4(root.matrixWorld.clone().invert());
  const rigRotation = (node: Object3D) => worldRotation(root).invert().multiply(worldRotation(node));
  const bones = new Map<string, Bone>();
  const meshes: SkinnedMesh[] = [];
  root.traverse(node => {
    if (node instanceof Bone) {
      if (bones.has(node.name)) throw new Error(`Duplicate bone: ${node.name}`);
      bones.set(node.name, node);
    }
    if (node instanceof SkinnedMesh) {
      meshes.push(node); node.castShadow = true; node.receiveShadow = true;
      node.frustumCulled = false;
    }
  });
  const bone = (name: string) => {
    const found = bones.get(`mixamorig${name}`);
    if (!found) throw new Error(`Character is missing mixamorig${name}`);
    return found;
  };
  for (const name of ['Hips','Spine','Spine1','Spine2','Neck','Head', ...sides.flatMap(side =>
    ['Shoulder','Arm','ForeArm','Hand','HandMiddle1','HandIndex1','HandPinky1','UpLeg','Leg','Foot','ToeBase'].map(part => side + part))]) bone(name);
  if (!meshes.length) throw new Error('Character has no skinned mesh');
  const rest = new Map([...bones.values()].map(node => [node, {
    position: node.position.clone(), rotation: node.quaternion.clone(), scale: node.scale.clone(),
    worldPosition: rigPosition(node), worldRotation: rigRotation(node),
  }]));
  const restPoint = (name: string) => rest.get(bone(name))!.worldPosition.clone();
  const restRotation = (name: string) => rest.get(bone(name))!.worldRotation.clone();
  const bounds = new Box3().setFromObject(root, true);
  const height = bounds.max.y - bounds.min.y;
  if (!Number.isFinite(height) || height <= 0) throw new Error('Invalid character bounds');
  const scale = 1.85 / height;
  const floor = bounds.min.y;
  const legs = sides.map(side => {
    const foot = restPoint(side + 'Foot'), knee = restPoint(side + 'Leg');
    const forward = restPoint(side + 'ToeBase').sub(foot); forward.y = 0;
    if (forward.lengthSq() < 1e-10) throw new Error(`${side} foot has no horizontal direction`);
    forward.normalize();
    const normal = new Vector3(forward.z, 0, -forward.x);
    return {side, foot, forward, normal, standingOffset: knee.clone().sub(foot).dot(normal),
      thigh: restPoint(side + 'UpLeg').distanceTo(knee), shin: knee.distanceTo(foot)};
  });
  const averageThigh = (legs[0].thigh + legs[1].thigh) / 2;
  const averageShin = (legs[0].shin + legs[1].shin) / 2;

  function setWorldRotation(name: string, rotation: Quaternion) {
    const node = bone(name);
    node.quaternion.copy(worldRotation(node.parent!).invert().multiply(worldRotation(root)).multiply(rotation));
    node.updateWorldMatrix(false, true);
  }
  function aim(name: string, child: string, direction: Vector3) {
    if (!direction.toArray().every(Number.isFinite) || direction.lengthSq() < 1e-10) throw new Error(`Invalid aim: ${name}`);
    const baseline = restPoint(child).sub(restPoint(name)).normalize();
    const delta = new Quaternion().setFromUnitVectors(baseline, direction.clone().normalize());
    setWorldRotation(name, delta.multiply(restRotation(name)));
  }
  function reset() {
    for (const [node, state] of rest) {
      node.position.copy(state.position); node.quaternion.copy(state.rotation); node.scale.copy(state.scale);
    }
    root.updateWorldMatrix(true, true);
  }

  function apply(frame: number) {
    const {depth} = timeline(frame);
    reset(); // Random seeks never inherit the preceding frame's rotations.
    const hips = bone('Hips');
    hips.position.y += averageThigh * (Math.cos(rad(87 * depth)) - 1) + averageShin * (Math.cos(rad(24 * depth)) - 1);
    hips.position.z += averageShin * Math.sin(rad(24 * depth)) - averageThigh * Math.sin(rad(87 * depth));
    root.updateWorldMatrix(true, true);

    for (const {side, foot, thigh, shin, forward, normal, standingOffset} of legs) {
      const hip = rigPosition(bone(side + 'UpLeg'));
      const towardFoot = foot.clone().sub(hip), distance = towardFoot.length();
      if (distance > thigh + shin + 1e-6 || distance < Math.abs(thigh - shin) + 1e-6) {
        throw new Error(`${side} leg target is unreachable at frame ${frame}`);
      }
      const direction = towardFoot.normalize();
      const along = (thigh * thigh - shin * shin + distance * distance) / (2 * distance);
      const centre = hip.clone().addScaledVector(direction, along);
      // Intersect the fixed-length leg's knee circle with a toe-direction plane.
      // Preserve this model's neutral standing alignment, then bring the knee
      // over its own foot direction as it bends. Purely forward IK collapsed the
      // knees inward, hidden by the original three-quarter camera. This authored
      // trajectory is illustrative, not a universal stance/clinical constraint.
      const lateral = normal.clone().addScaledVector(direction, -normal.dot(direction));
      const normalLength = lateral.length();
      if (normalLength < 1e-8) throw new Error(`${side} knee plane is degenerate at frame ${frame}`);
      lateral.normalize();
      const bend = new Vector3().crossVectors(direction, lateral);
      if (bend.dot(forward) < 0) bend.negate();
      const offset = (standingOffset * (1 - depth) - centre.clone().sub(foot).dot(normal)) / normalLength;
      const remaining = thigh * thigh - along * along - offset * offset;
      if (remaining < -1e-6) throw new Error(`${side} knee tracking is unreachable at frame ${frame}`);
      const knee = centre.addScaledVector(lateral, offset).addScaledVector(bend, Math.sqrt(Math.max(0, remaining)));
      aim(side + 'UpLeg', side + 'Leg', knee.clone().sub(hip));
      aim(side + 'Leg', side + 'Foot', foot.clone().sub(rigPosition(bone(side + 'Leg'))));
      setWorldRotation(side + 'Foot', restRotation(side + 'Foot'));
    }
    setWorldRotation('Spine', new Quaternion().setFromAxisAngle(new Vector3(1,0,0), rad(32 * depth)).multiply(restRotation('Spine')));
    setWorldRotation('Neck', restRotation('Neck'));
    for (const side of sides) {
      const upper = rad(82 * depth), fore = rad(6 + 84 * depth);
      aim(side + 'Arm', side + 'ForeArm', new Vector3(0,-Math.cos(upper),Math.sin(upper)));
      aim(side + 'ForeArm', side + 'Hand', new Vector3(0,-Math.cos(fore),Math.sin(fore)));
      aim(side + 'Hand', side + 'HandMiddle1', new Vector3(0,-Math.cos(fore),Math.sin(fore)));
    }
    for (const mesh of meshes) mesh.skeleton.update();
    return root;
  }
  return {root, bones, meshes, scale, floor, apply, reset};
}

export type MixamoRig = ReturnType<typeof createMixamoRig>;
