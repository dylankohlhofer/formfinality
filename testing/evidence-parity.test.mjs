import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadEngine } from './lib.mjs';
const root = new URL('../', import.meta.url);
const E = await loadEngine(await readFile(process.env.FORM_COACH_TEST_BUILD || new URL('form-coach-v4.11.html', root), 'utf8'));
const vectors = JSON.parse(await readFile(new URL('conformance-vectors.json', root), 'utf8'));
const suite = JSON.parse(await readFile(new URL('testing/movement-evidence-vectors.json', root), 'utf8'));
assert.equal(suite.schema, 'movement-evidence-parity/1');
for(const row of suite.cases) test(`shared Swift/browser evidence: ${row.id}`, () => {
  const fixture = suite.fixtures[row.movement], rest = vectors.poses[fixture.rest];
  const peak = fixture.peakPose ? vectors.poses[fixture.peakPose] : {...rest, ...fixture.peak};
  const ev = new E.Evaluator(E.M[row.movement], 'building'); ev.arm(0);
  let r;
  for(let i = 0; i < 12 * row.fps; i++){
    const p = (i / row.fps) % 4;
    const mix = !row.cycle ? 0 : p < 1.5 ? p / 1.5 : p < 2 ? 1 : p < 3.5 ? 1 - (p - 2) / 1.5 : 0;
    const side = Object.fromEntries(Object.entries(rest).map(([j, a]) => [j,
      {x:a[0] + (peak[j][0] - a[0]) * mix, y:a[1] + (peak[j][1] - a[1]) * mix, c:.95}]));
    if(row.loss) for(const j of row.loss.all ? Object.keys(side) : row.loss.joints){
      if(row.loss.mode === 'missing') delete side[j];
      else if(row.loss.mode === 'outside') side[j].x = 1.05;
      else if(row.loss.mode === 'low') side[j].c = .1;
      else assert.fail('Unknown loss mode');
    }
    r = ev.evaluate({left:side,right:structuredClone(side),cam:'left',conf:.95,aspect:1,
      sideness:row.movement === 'side-plank' ? 0 : 90}, 1 / row.fps, (i + 1) / row.fps);
    assert.equal(r.evidence.schema, 'movement-evidence/1');
    if(row.unscored) assert.equal(r.score, null, `frame ${i} must remain unscored`);
  }
  assert.equal(ev.rep?.display() || 0, row.reps);
  assert.ok(Math.abs(ev.hold - row.held) < 1e-8);
  assert.equal(r.evidence.movement.eligible, row.eligible);
  if(row.form) assert.equal(r.evidence.form.status, row.form);
});
