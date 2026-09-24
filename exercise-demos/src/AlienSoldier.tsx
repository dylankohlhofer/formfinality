import {useMemo} from 'react';
import {useLoader} from '@react-three/fiber';
import {staticFile} from 'remotion';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {createMixamoRig} from './mixamo-rig';

export function AlienSoldier({frame}: {frame: number}) {
  // ThreeCanvas's Suspense integration waits for both the asset and the committed
  // canvas. Resolving a fetch alone can otherwise export a successful blank frame.
  const asset = useLoader(GLTFLoader, staticFile('models/alien-soldier.glb'));
  const rig = useMemo(() => createMixamoRig(clone(asset.scene)), [asset.scene]);
  rig.apply(frame);
  return <group rotation={[0,Math.PI / 2,0]} scale={rig.scale} position={[0,-rig.floor * rig.scale,0]}>
    <primitive object={rig.root} />
  </group>;
}
