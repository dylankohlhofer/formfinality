// Synthetic geometry, not human performance ground truth. Anchors extend the
// surviving recorded fixture poses; no REF drawings or engine outputs are used.
// Expectations live in exercise-sweep.mjs, independently of these inputs.
export function exerciseInputs(poses) {
  const copy = (name, overrides = {}) => ({ ...structuredClone(poses[name]), ...overrides });
  const both = (left, right = left) => ({ left, right });
  const plank = both(copy('plank'));
  const sitting = copy('standing', { ear: [.43, .20], shoulder: [.43, .30], hip: [.43, .55], knee: [.65, .55], ankle: [.65, .80] });
  const deadRest = copy('supine', { knee: [.57, .51], ankle: [.80, .52] });
  const definitions = {
    'knee-plank': [plank], plank: [plank], 'side-plank-knee': [plank], 'side-plank': [plank],
    'bird-dog': [both(
      copy('allFours', { knee: [.74, .44], ankle: [.88, .44] }),
      copy('allFours', { elbow: [.24, .44], wrist: [.10, .44] }))],
    'dead-bug': [both(deadRest), both(copy('supine', { knee: [.77, .73], ankle: [.88, .60] }), deadRest)],
    'glute-bridge': [both(copy('bridgeDown')), both(copy('bridgeUp'))],
    'sit-to-stand': [both(sitting), both(copy('standing'))],
    squat: [both(copy('standing')), both(copy('standing', {
      ear: [.48, .15], shoulder: [.46, .24], hip: [.40, .52], knee: [.63, .52], ankle: [.63, .85] }))],
    'wall-sit': [both(sitting)],
    'hollow-tuck': [both(copy('supine', { knee: [.68, .55], ankle: [.80, .60] }))],
    'hollow-hold': [both(copy('supine', { knee: [.67, .63], ankle: [.80, .51] }))],
    crunch: [both(copy('bridgeDown')), both(copy('bridgeDown', { shoulder: [.35, .60], ear: [.29, .52] }))],
    'leg-raise-bent': [both(copy('bridgeDown')), both(copy('bridgeDown', { knee: [.52, .51], ankle: [.73, .50] }))],
    'leg-raise': [both(copy('supine')), both(copy('supine', { knee: [.56, .53], ankle: [.58, .30], heel: [.60, .29], toe: [.66, .22] }))],
    'wall-push-up': [both(copy('standing', { shoulder: [.45, .25], hip: [.49, .50], knee: [.53, .70], ankle: [.57, .90], elbow: [.60, .25], wrist: [.75, .25] })),
      both(copy('standing', { shoulder: [.55, .25], hip: [.56, .50], knee: [.565, .70], ankle: [.57, .90], elbow: [.63, .33], wrist: [.75, .25] }))],
    'knee-push-up': [both(copy('pushTop')), both(copy('pushBottom'))],
    'push-up': [both(copy('pushTop')), both(copy('pushBottom'))],
    'cat-cow': [both(copy('allFours'))],
    'downward-dog': [both(copy('ddogGood'))],
    cobra: [both(copy('supine', { shoulder: [.30, .62], ear: [.22, .575] }))]
  };
  function frame(id, phase = 0, { confidence = .95, view, clipped = false } = {}) {
    const d = definitions[id];
    if (!d) throw new Error(`No independently authored geometry for ${id}`);
    const a = d[0], b = d[1] || a;
    const mix = Math.max(0, Math.min(1, phase));
    const side = name => Object.fromEntries(Object.keys(a[name]).map(j => {
      const p = a[name][j], q = b[name][j];
      return [j, { x: p[0] + (q[0] - p[0]) * mix - (clipped ? 2 : 0), y: p[1] + (q[1] - p[1]) * mix, c: confidence }];
    }));
    return { left: side('left'), right: side('right'), cam: 'left', conf: confidence,
      aspect: 1, sideness: view ?? (id.startsWith('side-plank') ? 0 : 90) };
  }
  // Four-second cycle: smooth outward movement, a brief peak, smooth return,
  // a brief rest. A complete cycle is independently expected to count once.
  const cycle = t => {
    const p = ((t % 4) + 4) % 4;
    return p < 1.5 ? p / 1.5 : p < 2 ? 1 : p < 3.5 ? 1 - (p - 2) / 1.5 : 0;
  };
  return { ids: Object.keys(definitions), frame, cycle,
    resolve(key, t = 0) {
      const [, id, mode] = key.split(':');
      if (!definitions[id]) throw new Error(`Unknown exercise input ${key}`);
      return frame(id, mode === 'cycle' ? cycle(t) : 0, { confidence: mode === 'lost' ? 0 : .95 });
    }
  };
}
