// Explicit reviewed migration, never an automatic expected-output generator.
// Seven fields only. Run manually with --write after the independent regressions.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
if(process.argv.length!==3 || process.argv[2]!=='--write')throw Error('Usage: node testing/refresh-review-view.mjs --write');
const file=new URL('../conformance-vectors.json',import.meta.url);
const data=JSON.parse(await readFile(file,'utf8'));
const changes=[
  ['view-blocked',29,{score:100,suppressed:[]},
    {score:null,suppressed:['view⊘torsoLevel','view⊘legsStraight','view⊘bodyLine','view⊘hipAlign','view⊘neck','view⊘elbows']}],
  ['view-limited-depth-suppressed',59,{score:33,viewCue:null,suppressed:['view⊘hipshigh']},
    {score:null,viewCue:'turnside',suppressed:['view⊘hipAngle']}],
  ['sideplank-wants-front',29,{score:100,suppressed:[]},
    {score:null,suppressed:['view⊘torsoLevel','view⊘bodyLine','view⊘hipAlign']}]
];
for(const [id,frame,prior,next] of changes){
  const row=data.evaluatorScenarios.find(x=>x.id===id);
  assert.equal(row.checkpoints.length,1);const cp=row.checkpoints[0];assert.equal(cp.frame,frame);
  assert.equal(cp.inPosition,false);assert.equal(cp.inPose,false);assert.equal(cp.hold,0);assert.equal(cp.reps,0);
  for(const [key,value] of Object.entries(next)){
    assert.ok([prior[key],value].some(x=>JSON.stringify(x)===JSON.stringify(cp[key])),`${id}.${key}: unexpected prior expectation`);
    cp[key]=value;
  }
}
data.meta.reviewedView={date:'2026-09-14',fields:7,scenarios:changes.map(x=>x[0]),
  buildHash:createHash('sha256').update(await readFile(new URL('../form-coach-v4.11.html',import.meta.url))).digest('hex'),
  reason:'Unreliable viewing geometry cannot create form samples. Required depth gates remain unavailable rather than passing or failing from an unreliable value; request a better view. Suppressions identify targets, not inferred faults. All other fields, inputs, thresholds and tolerances unchanged.'};
await writeFile(file,JSON.stringify(data)+'\n');
console.log('Reviewed seven fields in three view scenarios plus provenance; no other expectations regenerated.');
