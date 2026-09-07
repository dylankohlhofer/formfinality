// Deliberate, limited refresh for the 2026-09-07 scoring-policy change.
// Not a general "make tests green" recorder: exactly nine reviewed fields may move.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { engineSource, loadEngine, hash } from './lib.mjs';
const build = process.argv[2];
if (!build || process.argv[3] !== '--write-reviewed') throw new Error('Usage: node testing/refresh-reviewed-vectors.mjs <build> --write-reviewed');
const html = await readFile(build, 'utf8'), E = await loadEngine(html);
const vectorsPath = new URL('../conformance-vectors.json', import.meta.url);
const v = JSON.parse(await readFile(vectorsPath));
const reviewed = {
  'bridge-priming': [[89, 100, null], [149, 0, null], [209, 0, null], [353, 3, null]],
  'pushup-standing-blocked': [[19, 100, null]],
  'legraise-feet-gate': [[39, 51, null], [79, 50, 100]],
  'reps-need-arming': [[203, 3, null], [407, 3, null]]
};
let changed = 0;
for (const sc of v.evaluatorScenarios) {
  const ev = new E.Evaluator(E.M[sc.movement], sc.tier); let now = 0, index = 0;
  const seen = new Map();
  for (const step of sc.timeline) {
    if (step.action === 'arm') { ev.arm(now); continue; }
    if (step.action === 'check') continue;
    for (let i = 0; i < step.n; i++) {
      const side = Object.fromEntries(Object.entries(v.poses[step.pose]).map(([j, [x, y]]) => [j, { x, y, c: step.conf?.[j] ?? .95 }]));
      now += v.meta.dt;
      seen.set(index++, ev.evaluate({ left: side, right: structuredClone(side), cam: 'left', conf: .95, ...step.over }, v.meta.dt, now));
    }
  }
  for (const [frame, before, expected] of reviewed[sc.id] || []) {
    const checkpoint = sc.checkpoints.find(cp => cp.frame === frame);
    assert.ok(checkpoint, `${sc.id}/${frame} exists`);
    assert.ok(checkpoint.score === before || checkpoint.score === expected, 'unexpected old value');
    assert.equal(seen.get(frame).score, expected, `${sc.id}/${frame}: independent reviewed policy`);
    if (checkpoint.score !== expected) { checkpoint.score = expected; changed++; }
  }
}
v.meta.source = build;
v.meta.reviewedScoring = { date: '2026-09-07', buildHash: hash(html), fields: 9,
  reason: 'Rep drivers measure cycle range/tempo, not static form; bridge has no remaining form grade. Invalid rep position has no score. Straight knees remain the leg-raise form measurement. Other checkpoint fields and tolerances unchanged.' };
await writeFile(vectorsPath, JSON.stringify(v));
// Mechanical content export: the five new spoken keys need their own clip identity.
const { BASE } = await import('data:text/javascript;base64,' + Buffer.from(engineSource(html) + '\nexport { BASE };').toString('base64'));
const contentPath = new URL('../content-v4.8.json', import.meta.url), c = JSON.parse(await readFile(contentPath));
for (const key of ['frameTop', 'frameBottom', 'trackingLost', 'repPosition', 'setupShape']) c.dialogue.base[key] = BASE[key];
await writeFile(contentPath, JSON.stringify(c));
console.log(`${changed} reviewed score fields refreshed; five new dialogue keys exported. No tolerances changed.`);
