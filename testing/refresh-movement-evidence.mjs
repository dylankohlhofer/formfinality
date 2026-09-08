// Deliberate, surgical vector/content migration for movement-evidence/1.
// Not an oracle generator: the three reviewed expectations are explicit below.
// Run manually with --write; never invoked by test/watch/CI.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
if(process.argv.length !== 3 || process.argv[2] !== '--write')
  throw new Error('Usage: node testing/refresh-movement-evidence.mjs --write');
const html = await readFile(new URL('form-coach-v4.11.html', root), 'utf8');
const file = new URL('conformance-vectors.json', root);
const vectors = JSON.parse(await readFile(file, 'utf8'));
const row = vectors.evaluatorScenarios.find(x => x.id === 'crunch-needs-the-ear');
assert.equal(row.movement, 'crunch');
assert.deepEqual(row.timeline, [{pose:'supine',n:40,conf:{ear:0,shoulder:.6,hip:.6,knee:.6,ankle:.6}},{action:'check'}]);
assert.equal(row.checkpoints.length, 1);
const cp = row.checkpoints[0];
assert.equal(cp.frame, 39);
// The ear no longer invalidates all observation. The original straight-legged
// supine input STILL fails Crunch's bent-knee position gate: no arming/reps/score.
assert.equal(cp.inPosition, false); assert.equal(cp.inPose, false);
assert.equal(cp.score, null); assert.equal(cp.reps, 0);
const changes = {ok:true, blocking:['kneesBent'], suppressed:['unobserved⊘neck']};
const prior = {ok:false, blocking:[], suppressed:[]};
for(const [key, value] of Object.entries(changes)){
  assert.ok([prior[key], value].some(x => JSON.stringify(x) === JSON.stringify(cp[key])),
    `${key} has another reviewed expectation; do not overwrite a later decision`);
  cp[key] = value;
}
vectors.meta.reviewedEvidence = {
  date:'2026-09-08', buildHash:createHash('sha256').update(html).digest('hex'), fields:3,
  scenario:row.id,
  reason:'Optional neck loss no longer vetoes observed Crunch geometry. Unchanged straight-legged supine input still fails kneesBent, so no position/hold/rep/score is earned. Missing neck judgement is logged. All other recorded fields and tolerances unchanged.'
};
await writeFile(file, JSON.stringify(vectors) + '\n');
const contentFile = new URL('content-v4.8.json', root);
const content = JSON.parse(await readFile(contentFile, 'utf8'));
const feet = content.movements['leg-raise'].targets.find(t => t.id === 'feetUp');
assert.equal(feet.pos, true); assert.equal(feet.w, 0);
feet.optionalObservation = true; // name the existing missing-foot-hint exception
await writeFile(contentFile, JSON.stringify(content) + '\n');
console.log('Reviewed three checkpoint fields and the explicit optional foot hint; no other expectations regenerated.');
