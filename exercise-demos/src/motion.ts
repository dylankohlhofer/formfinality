/** Authored illustrative geometry, not captured human motion or an assessment model.
 * World units are isotropic: +x forward, +y up, +z across the body. */
import {PROPORTIONS} from './proportions.ts';
export type Point = [number, number, number];
export type Side = Record<'ankle' | 'heel' | 'toe' | 'knee' | 'hip' | 'shoulder' | 'elbow' | 'wrist' | 'ear', Point>;
export const FPS = 30;
export const REPETITIONS = 3;
export const CYCLE = 162;
export const DURATION = CYCLE * REPETITIONS;
export const TIMING = {lower: 27, bottom: 81, rise: 96, stand: 150};
export const CAMERA = { position: [2.8, 1.85, 6] as Point, target: [0.06, 0.95, 0] as Point };
// Turn only during the standing gap; the full second squat is front-on.
export const CAMERA_TURN = {before: CYCLE - TIMING.stand, after: 18};
export const LENGTHS = { shin: 0.44, thigh: 0.45, torso: 0.51, upperArm: 0.285, forearm: 0.255 };
const rad = (degrees: number) => degrees * Math.PI / 180;
const ease = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;

export function timeline(frame: number) {
  if (!Number.isFinite(frame) || frame < 0 || frame >= DURATION) throw new RangeError('Frame outside demo timeline');
  const local = frame % CYCLE;
  const depth = local < TIMING.lower ? 0 : local < TIMING.bottom ? ease((local - TIMING.lower) / (TIMING.bottom - TIMING.lower))
    : local < TIMING.rise ? 1 : local < TIMING.stand ? 1 - ease((local - TIMING.rise) / (TIMING.stand - TIMING.rise)) : 0;
  const phase: 'stand' | 'lower' | 'pause' | 'rise' = local < TIMING.lower || local >= TIMING.stand ? 'stand' : local < TIMING.bottom ? 'lower' : local < TIMING.rise ? 'pause' : 'rise';
  return {depth, phase, repetition: Math.floor(frame / CYCLE) + 1, progress: frame / (DURATION - 1)};
}

export function cameraAt(frame: number) {
  timeline(frame); // Share the timeline's validation, including random seeks.
  const turn = (boundary: number) => ease(Math.max(0, Math.min(1,
    (frame - boundary + CAMERA_TURN.before) / (CAMERA_TURN.before + CAMERA_TURN.after))));
  const front = turn(CYCLE) - turn(2 * CYCLE);
  const radius = Math.hypot(CAMERA.position[0] - CAMERA.target[0], CAMERA.position[2]);
  const angle = Math.atan2(CAMERA.position[2], CAMERA.position[0] - CAMERA.target[0]) * (1 - front);
  const position: Point = front === 0 ? [...CAMERA.position]
    : [CAMERA.target[0] + radius * Math.cos(angle), CAMERA.position[1], radius * Math.sin(angle)];
  return {position, target: [...CAMERA.target] as Point, front,
    label: front === 1 ? 'FRONT VIEW' : front === 0 ? 'THREE-QUARTER VIEW' : 'CHANGING VIEW'};
}

/** Teaching cards last a full 5.4-second cycle, not the half-second bottom pause. */
export function teachingAt(frame: number) {
  const {repetition} = timeline(frame);
  return [
    {label: 'FIND YOUR BASE', title: 'Feet\nplanted.', detail: 'Start a little wider than hip-width.\nKeep your whole foot grounded.'},
    {label: 'WATCH FROM THE FRONT', title: 'Knees follow\nyour toes.', detail: 'Let knees travel in your toe direction.\nA comfortable gap—not a fixed width.'},
    {label: 'MAKE IT YOURS', title: 'Find your\nrange.', detail: 'Choose a depth you can control.\nDon’t force the movement.'},
  ][repetition - 1];
}

export function poseAt(frame: number) {
  const {depth} = timeline(frame);
  const shin = rad(24 * depth), thigh = rad(87 * depth), lean = rad(32 * depth);
  const ankleY = 0.115;
  // The hip-to-knee lateral offset is included in the fixed femur length.
  const thighSagittal = Math.sqrt(LENGTHS.thigh ** 2 - 0.055 ** 2);
  const kneeX = LENGTHS.shin * Math.sin(shin), kneeY = ankleY + LENGTHS.shin * Math.cos(shin);
  const hipX = kneeX - thighSagittal * Math.sin(thigh), hipY = kneeY + thighSagittal * Math.cos(thigh);
  const shoulderX = hipX + LENGTHS.torso * Math.sin(lean), shoulderY = hipY + LENGTHS.torso * Math.cos(lean);
  const upper = rad(82 * depth), fore = rad(6 + 84 * depth);
  function side(sign: number): Side {
    const z = 0.19 * sign;
    // Relax the shoulder girdle below the neckline; preserve the authored arm angles.
    const shoulder: Point = [shoulderX - PROPORTIONS.shoulderDrop * Math.sin(lean), shoulderY - PROPORTIONS.shoulderDrop * Math.cos(lean), 0.225 * sign];
    const elbow: Point = [shoulder[0] + LENGTHS.upperArm * Math.sin(upper), shoulder[1] - LENGTHS.upperArm * Math.cos(upper), shoulder[2]];
    const wrist: Point = [elbow[0] + LENGTHS.forearm * Math.sin(fore), elbow[1] - LENGTHS.forearm * Math.cos(fore), shoulder[2]];
    return {ankle: [0, ankleY, z], heel: [-0.085 * PROPORTIONS.shoeScale[0], 0.04, z], toe: [0.22 * PROPORTIONS.shoeScale[0], 0.04, z],
      knee: [kneeX, kneeY, z], hip: [hipX, hipY, 0.135 * sign], shoulder, elbow, wrist,
      ear: [shoulderX, shoulderY + 0.20, 0.09 * sign]};
  }
  return {left: side(-1), right: side(1), hip: [hipX, hipY, 0] as Point,
    chest: [shoulderX, shoulderY, 0] as Point, head: [shoulderX, shoulderY + 0.22, 0] as Point, lean};
}

/** Separate diagnostic side projection. This is NOT MediaPipe inference of pixels. */
export function engineFrameAt(frame: number) {
  const pose = poseAt(frame);
  const project = (side: Side) => Object.fromEntries(Object.entries(side).map(([joint, p]) =>
    [joint, {x: 0.43 + p[0] / 2.5, y: 0.94 - p[1] / 2.5, c: 1}]));
  return {left: project(pose.left), right: project(pose.right), cam: 'left', conf: 1, aspect: 1, sideness: 90};
}

export function stageSize(portrait: boolean) {
  return portrait ? {width: 920, height: 1010, zoom: 420, platformRadius: 1} : {width: 980, height: 820, zoom: 340, platformRadius: 1.15};
}
