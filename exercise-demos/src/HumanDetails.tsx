import {useMemo} from 'react';
import {BufferGeometry, Float32BufferAttribute, Quaternion, Shape, Vector2, Vector3} from 'three';
import type {Point} from './motion';
import {PROPORTIONS} from './proportions';
import {handOrientation} from './avatar-rig';

// Natural illustrative materials are not assessment colours or a live form tint.
export const SKIN = '#a97557';
const HAIR = '#292321';
const headProfile = [[0.018,-0.13],[0.047,-0.122],[0.067,-0.097],[0.083,-0.045],[0.092,0.015],[0.093,0.065],[0.078,0.108],[0.046,0.135],[0,0.145]].map(([x,y]) => new Vector2(x,y));
const shirtProfile = [[0.12,-0.03],[0.13,0.02],[0.132,0.12],[0.15,0.25],[0.19,0.35],[0.22,0.40],[0.205,0.448],[0.14,0.475],[0.067,0.505]].map(([x,y]) => new Vector2(x,y));

function Ellipsoid({position, scale, color, roughness = 0.75}: {position: Point; scale: Point; color: string; roughness?: number}) {
  return <mesh position={position} scale={scale} castShadow>
    <sphereGeometry args={[1, 28, 20]} /><meshStandardMaterial color={color} roughness={roughness} />
  </mesh>;
}

function Stroke({a, b, radius, color}: {a: Point; b: Point; radius: number; color: string}) {
  const from = new Vector3(...a), to = new Vector3(...b), direction = to.clone().sub(from);
  return <mesh position={from.clone().add(to).multiplyScalar(0.5)} quaternion={new Quaternion().setFromUnitVectors(new Vector3(0,1,0),direction.clone().normalize())} castShadow>
    <cylinderGeometry args={[radius * 0.8, radius, direction.length(), 12]} /><meshStandardMaterial color={color} roughness={0.8} />
  </mesh>;
}

function scalpGeometry() {
  const points: number[] = [], indices: number[] = [];
  const rings = 20, segments = 64;
  for (let row = 0; row <= rings; row++) {
    for (let column = 0; column <= segments; column++) {
      const phi = column / segments * Math.PI * 2;
      // A close-cropped shell follows the skull, without the oversized crown/nape.
      const hairlineY = 0.02 + 0.045 * Math.cos(phi);
      const crownY = 0.1485;
      // Match the skull's crown rings: a thin shell must not cut across a
      // profile corner and reveal little scalp patches between its samples.
      const crownRings = [crownY,0.145,0.135,0.108,0.065];
      const y = row < crownRings.length ? crownRings[row]
        : 0.065 - (row - 4) / (rings - 4) * (0.065 - hairlineY);
      const upper = headProfile.findIndex(point => point.y >= y);
      let radius: number;
      if (y > 0.145) radius = 0.0025 * Math.sqrt(Math.max(0, (crownY - y) / (crownY - 0.145)));
      else {
        const lo = headProfile[Math.max(0, upper - 1)], hi = headProfile[Math.max(1, upper)];
        radius = lo.x + (hi.x - lo.x) * (y - lo.y) / (hi.y - lo.y) + 0.0025;
      }
      // Follow the actual skull surface so hair cannot intersect it in bands.
      points.push(radius * 1.08 * Math.cos(phi), y, radius * 0.95 * Math.sin(phi));
      if (row < rings && column < segments) {
        const a = row * (segments + 1) + column, b = a + segments + 1;
        indices.push(a,a+1,b,b,a+1,b+1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(points,3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export function HumanHead({position}: {position: Point}) {
  const scalp = useMemo(scalpGeometry, []);
  return <group position={position}>
    <mesh scale={[1.08,1,0.95]} castShadow><latheGeometry args={[headProfile,48]} /><meshStandardMaterial color={SKIN} roughness={0.83} /></mesh>
    <mesh geometry={scalp} castShadow><meshStandardMaterial color={HAIR} roughness={0.96} /></mesh>
    {[-1,1].map(sign => <group key={sign}>
      <Ellipsoid position={[-0.005,-0.016,0.084 * sign]} scale={[0.012,0.023,0.009]} color={SKIN} />
      {/* Small, level eyes: no bright whites, tilted brows or implied expression. */}
      <Ellipsoid position={[0.086,0.03,0.043 * sign]} scale={[0.006,0.0035,0.009]} color="#4a362b" />
    </group>)}
    <Ellipsoid position={[0.095,-0.008,0]} scale={[0.014,0.025,0.013]} color={SKIN} />
    <Stroke a={[0.082,-0.058,-0.022]} b={[0.086,-0.058,0]} radius={0.0014} color="#825945" />
    <Stroke a={[0.086,-0.058,0]} b={[0.082,-0.058,0.022]} radius={0.0014} color="#825945" />
  </group>;
}

export function Shirt({hip, lean}: {hip: Point; lean: number}) {
  return <group position={hip} rotation={[0,0,-lean]}>
    <mesh scale={[0.65,1,1]} castShadow><latheGeometry args={[shirtProfile,48]} /><meshStandardMaterial color="#dadbdf" roughness={0.95} /></mesh>
    <mesh position={[0,0.496,0]} rotation={[Math.PI / 2,0,0]} scale={[0.65,1,1]}>
      <torusGeometry args={[0.064,0.008,12,48]} /><meshStandardMaterial color="#bfc1c7" roughness={1} />
    </mesh>
  </group>;
}

export function Hand({wrist, elbow}: {wrist: Point; elbow: Point}) {
  const thumbSide = wrist[2] > 0 ? -1 : 1;
  return <group position={wrist} quaternion={handOrientation(wrist, elbow)}>
      <Ellipsoid position={[0,0.044,0]} scale={[0.024,0.054,0.041]} color={SKIN} />
      {[-0.03,-0.01,0.01,0.03].map((z,i) => {
        const tip = PROPORTIONS.handReach - [0.025,0.008,0.013,0.038][i];
        return <group key={z}>
          <Stroke a={[0,0.078,z]} b={[0.002,0.112,z]} radius={0.008} color={SKIN} />
          <Stroke a={[0.002,0.112,z]} b={[0.004,tip,z]} radius={0.007} color={SKIN} />
          <Ellipsoid position={[0.004,tip,z]} scale={[0.0065,0.008,0.0065]} color={SKIN} />
        </group>;
      })}
      <Stroke a={[0.004,0.025,0.032 * thumbSide]} b={[0.012,0.05,0.058 * thumbSide]} radius={0.012} color={SKIN} />
      <Stroke a={[0.012,0.05,0.058 * thumbSide]} b={[0.021,0.083,0.064 * thumbSide]} radius={0.009} color={SKIN} />
  </group>;
}

const shoeOutline = new Shape();
shoeOutline.moveTo(-0.1,0.025);
shoeOutline.lineTo(0.21,0.025);
shoeOutline.quadraticCurveTo(0.235,0.036,0.215,0.063);
shoeOutline.quadraticCurveTo(0.17,0.09,0.05,0.104);
shoeOutline.lineTo(-0.035,0.142);
shoeOutline.quadraticCurveTo(-0.1,0.143,-0.1,0.025);

export function Shoe({z}: {z: number}) {
  return <group position={[0,0,z]} scale={PROPORTIONS.shoeScale}>
    <mesh position={[0,0,-0.053]} castShadow>
      <extrudeGeometry args={[shoeOutline,{depth:0.106,bevelEnabled:true,bevelThickness:0.006,bevelSize:0.006,bevelSegments:3,steps:1,curveSegments:12}]} />
      <meshStandardMaterial color="#c4c6ca" roughness={0.95} />
    </mesh>
    <mesh position={[0.052,0.016,0]} scale={[0.17,0.016,0.063]} castShadow>
      <sphereGeometry args={[1,32,16]} /><meshStandardMaterial color="#f0f0ef" roughness={1} />
    </mesh>
    {[0.035,0.067,0.099].map(x => <Stroke key={x} a={[x,0.12 - x * 0.24,-0.035]} b={[x + 0.006,0.12 - x * 0.24,0.035]} radius={0.003} color="#f2f1ed" />)}
  </group>;
}
