// One deliberate historical correction, never run automatically by tests/CI.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
if(process.argv.length!==3 || process.argv[2]!=='--write')throw Error('Usage: node testing/refresh-review-speech.mjs --write');
const file=new URL('../conformance-vectors.json',import.meta.url);
const data=JSON.parse(await readFile(file,'utf8'));
const row=data.clipResolver.find(r=>r.key==='rest');
assert.equal(row.tmpl,'Rest — {t}.');assert.equal(row.vars.t,12);
assert.ok(!row.manifest.includes('voice/warm/building/rest.a_0.mp3'));
assert.ok(row.expect===null || JSON.stringify(row.expect)===JSON.stringify(['voice/num/12.mp3']));
row.expect=null;
data.meta.reviewedSpeech={date:'2026-09-14',fields:1,case:'clipResolver/rest',
  buildHash:createHash('sha256').update(await readFile(new URL('../form-coach-v4.11.html',import.meta.url))).digest('hex'),
  reason:'A missing spoken Rest prefix cannot produce a number-only instruction. Fall back to the complete local utterance or visual instruction. All other inputs and expectations unchanged.'};
await writeFile(file,JSON.stringify(data)+'\n');
console.log('Reviewed one clip-resolution expectation plus provenance; no other expectations regenerated.');
