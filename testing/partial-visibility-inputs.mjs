// Test inputs only. These alter synthetic observations, NOT camera pixels or
// MediaPipe inference. No thresholds, REF data, or evaluator outputs author them.
export const partialMovements = ['squat', 'crunch', 'leg-raise', 'plank'];
export const partialModes = ['rest', 'cycle', 'rise', 'peak', 'head-rest', 'head-cycle',
  'hands-cycle', 'far-side-cycle', 'feet-rest', 'feet-cycle', 'feet-peak',
  'offscreen-cycle', 'misleading'];

export function partialVisibilityInputs(exercise, poses) {
  return (key, t = 0) => {
    const [prefix, id, mode, extra] = key.split(':');
    if (prefix !== 'partial' || extra !== undefined || !partialMovements.includes(id) || !partialModes.includes(mode))
      throw new Error(`Unknown partial-visibility input ${key}`);
    if (!Number.isFinite(t) || t < 0) throw new Error('Invalid partial-visibility time');
    const phase = mode.endsWith('cycle') || mode === 'rise' ? exercise.cycle(t) : mode.endsWith('peak') ? 1 : 0;
    const f = exercise.frame(id, phase);
    for (const name of ['left', 'right']) {
      const side = f[name];
      if (mode.startsWith('head-')) side.ear.y = -.05;
      if (mode.startsWith('feet-')) for (const j of ['ankle', 'heel', 'toe']) if (side[j]) side[j].y = 1.05;
      if (mode === 'hands-cycle') for (const j of ['wrist', 'index', 'pinky', 'thumb']) delete side[j];
      if (mode === 'offscreen-cycle') for (const p of Object.values(side)) p.x -= 2;
      if (mode === 'misleading') {
        const p = exercise.cycle(t);
        if (id === 'squat') { // Arm movement, stationary hips/knees/ankles.
          side.elbow.y += .08 * p; side.wrist.y -= .08 * p;
        } else if (id === 'leg-raise') { // Knee bends; hip/shoulder/ankle driver stays still.
          side.knee.y -= .15 * p;
        } else if (id === 'crunch') { // Whole-pose translation; no torso curl.
          for (const joint of Object.values(side)) joint.y += .015 * Math.sin(t * Math.PI / 2);
        } else { // Standing up is not a Plank, even when limbs remain visible.
          f[name] = Object.fromEntries(Object.entries(poses.standing).map(([j, [x, y]]) => [j, {x, y, c:.95}]));
        }
      }
    }
    if (mode === 'far-side-cycle') f.right = {};
    return f;
  };
}
