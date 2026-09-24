import {Quaternion, Vector3} from 'three';
import type {Point} from './motion';

/** Fingers follow the forearm; palms turn down as the arms lift.
 * Presentation only: this does not change observed/synthetic exercise joints. */
export function handOrientation(wrist: Point, elbow: Point) {
  const direction = new Vector3(...wrist).sub(new Vector3(...elbow));
  if (!direction.toArray().every(Number.isFinite) || direction.lengthSq() === 0) {
    throw new RangeError('Hand requires a finite, nonzero forearm');
  }
  direction.normalize();
  const thumbSide = wrist[2] > 0 ? -1 : 1;
  const alignment = new Quaternion().setFromUnitVectors(new Vector3(0,1,0), direction);
  const roll = new Quaternion().setFromAxisAngle(new Vector3(0,1,0), -thumbSide * Math.PI / 2 * Math.abs(direction.y));
  return alignment.multiply(roll);
}
