import {ThreeCanvas} from '@remotion/three';
import {useLayoutEffect, useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import {Object3D, Quaternion, Vector3} from 'three';
import {cameraAt, poseAt, stageSize} from './motion';
import type {Point} from './motion';
import {Hand, HumanHead, Shirt, Shoe, SKIN} from './HumanDetails';
import {PROPORTIONS} from './proportions';
import {AlienSoldier} from './AlienSoldier';

const trousers = '#36383e';
function Segment({from, to, radius, color, endRadius = radius}: {from: Point; to: Point; radius: number; endRadius?: number; color: string}) {
  const a = new Vector3(...from), b = new Vector3(...to), direction = b.clone().sub(a);
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize());
  return <group>
    <mesh position={a.clone().add(b).multiplyScalar(0.5)} quaternion={rotation} castShadow>
      <cylinderGeometry args={[endRadius, radius, direction.length(), 24]} />
      <meshStandardMaterial color={color} roughness={0.68} />
    </mesh>
    <mesh position={from} castShadow><sphereGeometry args={[radius, 24, 16]} /><meshStandardMaterial color={color} roughness={0.68} /></mesh>
    <mesh position={to} castShadow><sphereGeometry args={[endRadius, 24, 16]} /><meshStandardMaterial color={color} roughness={0.68} /></mesh>
  </group>;
}

export function ProceduralFigure({frame}: {frame: number}) {
  const pose = poseAt(frame);
  return <group>
    {([pose.left, pose.right]).map((side, i) => <group key={i}>
      <Segment from={side.hip} to={side.knee} radius={0.082} endRadius={0.065} color={trousers} />
      <Segment from={side.knee} to={side.ankle} radius={0.064} endRadius={0.040} color={trousers} />
      <Shoe z={side.ankle[2]} />
      <Segment from={side.shoulder} to={side.elbow} radius={0.053} endRadius={0.042} color={SKIN} />
      <Segment from={side.elbow} to={side.wrist} radius={0.043} endRadius={0.027} color={SKIN} />
      <Segment from={side.shoulder} to={side.shoulder.map((v,j) => v + (side.elbow[j] - v) * 0.4) as Point} radius={0.059} endRadius={0.056} color="#dadbdf" />
      <Hand wrist={side.wrist} elbow={side.elbow} />
    </group>)}
    <mesh position={pose.hip} scale={PROPORTIONS.pelvisScale} rotation={[0, 0, -pose.lean]} castShadow>
      <sphereGeometry args={[1, 32, 24]} /><meshStandardMaterial color={trousers} roughness={0.95} />
    </mesh>
    <Shirt hip={pose.hip} lean={pose.lean} />
    <Segment from={pose.chest} to={[pose.head[0], pose.head[1] - 0.065, 0]} radius={0.043} color={SKIN} />
    <HumanHead position={pose.head} />
  </group>;
}

function DemoCamera({frame}: {frame: number}) {
  const camera = useThree(state => state.camera);
  useLayoutEffect(() => {
    const view = cameraAt(frame);
    camera.position.set(...view.position);
    camera.lookAt(...view.target);
    camera.updateMatrixWorld();
  }, [camera, frame]);
  return null;
}

export function Stage({frame, portrait}: {frame: number; portrait: boolean}) {
  const size = stageSize(portrait);
  const view = cameraAt(frame);
  const fillTarget = useMemo(() => { const target = new Object3D(); target.position.set(0,1,0); return target; }, []);
  return <ThreeCanvas width={size.width} height={size.height} orthographic shadows
    camera={{position: view.position, zoom: size.zoom, near: 0.1, far: 30}}
    gl={{alpha: true, antialias: true, preserveDrawingBuffer: true}}
    onCreated={({camera}) => camera.lookAt(...view.target)}>
    <DemoCamera frame={frame} />
    <ambientLight intensity={1.1} />
    <directionalLight position={[2, 5, 4]} intensity={3} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0001} />
    <directionalLight position={[-3, 3, -3]} intensity={2.1} />
    {/* Horizontal fill reveals the suit without illuminating the horizontal floor. */}
    <primitive object={fillTarget} />
    <directionalLight position={[3,1,5]} target={fillTarget} intensity={10} />
    <directionalLight position={[-3,1,-3]} target={fillTarget} intensity={5} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.006, 0]} receiveShadow>
      <circleGeometry args={[size.platformRadius, 96]} /><meshStandardMaterial color="#1d1e24" roughness={1} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.004, 0]}>
      <ringGeometry args={[size.platformRadius - 0.02, size.platformRadius - 0.015, 96]} /><meshBasicMaterial color="#3c3d44" />
    </mesh>
    <AlienSoldier frame={frame} />
  </ThreeCanvas>;
}
