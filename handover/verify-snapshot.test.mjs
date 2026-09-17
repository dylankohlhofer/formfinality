import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink, unlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const verifier=fileURLToPath(new URL('./verify-snapshot.mjs',import.meta.url));
const hash=x=>createHash('sha256').update(x).digest('hex');
const required=['AGENTS.md','form-coach-v4.11.html','package.json','package-lock.json',
  'START-HERE.md','CONTINUE-PROMPT.md','handover/verify-snapshot.mjs','handover/BASELINE.json','handover/TRANSFER-CHECKS.json'];
async function fixture(t) {
  const root=await mkdtemp(join(tmpdir(),'formcoach-handover-check-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'handover'));
  const files=[];
  for(const path of required) {
    const bytes=path==='handover/verify-snapshot.mjs'?await readFile(verifier):Buffer.from('fixture '+path);
    await writeFile(join(root,path),bytes);
    files.push({path,type:'file',sha256:hash(bytes)});
  }
  // Full-text alias is the portable fallback supported by the verifier.
  await writeFile(join(root,'CLAUDE.md'),await readFile(join(root,'AGENTS.md')));
  files.push({path:'CLAUDE.md',type:'symlink',target:'AGENTS.md',sha256:hash('AGENTS.md')});
  const save=()=>writeFile(join(root,'handover/SNAPSHOT.json'),JSON.stringify({schema:'formcoach-handover/1',files}));
  await save();
  return {root,files,save,run:()=>spawnSync(process.execPath,[verifier,root],{encoding:'utf8',timeout:10000})};
}
test('intact transfer and full-text CLAUDE alias verify',async t=>{
  const f=await fixture(t), r=f.run(); assert.equal(r.status,0,r.stderr); assert.match(r.stdout,/10 packaged files/);
});
test('changed source cannot verify',async t=>{
  const f=await fixture(t); await writeFile(join(f.root,'form-coach-v4.11.html'),'changed');
  const r=f.run(); assert.equal(r.status,1); assert.match(r.stderr,/SHA-256 mismatch/);
});
test('missing source cannot verify',async t=>{
  const f=await fixture(t); await unlink(join(f.root,'package-lock.json')); assert.equal(f.run().status,1);
});
test('path traversal in a manifest is rejected',async t=>{
  const f=await fixture(t); f.files.push({path:'../outside',type:'file',sha256:hash('x')}); await f.save();
  const r=f.run(); assert.equal(r.status,1); assert.match(r.stderr,/Invalid manifest entry/);
});
test('duplicate manifest entries are rejected',async t=>{
  const f=await fixture(t); f.files.push(f.files[0]); await f.save(); assert.equal(f.run().status,1);
});
test('removing a required file from the manifest cannot mask its absence',async t=>{
  const f=await fixture(t); f.files.splice(f.files.findIndex(x=>x.path==='AGENTS.md'),1); await f.save();
  const r=f.run(); assert.equal(r.status,1); assert.match(r.stderr,/Required entry absent: AGENTS.md/);
});
test('a CLAUDE file containing only the symlink name is not loaded rules',async t=>{
  const f=await fixture(t); await writeFile(join(f.root,'CLAUDE.md'),'AGENTS.md'); assert.equal(f.run().status,1);
});
test('real CLAUDE symlink verifies', {skip:process.platform==='win32'},async t=>{
  const f=await fixture(t); await unlink(join(f.root,'CLAUDE.md')); await symlink('AGENTS.md',join(f.root,'CLAUDE.md'));
  const r=f.run(); assert.equal(r.status,0,r.stderr);
});
test('symlinked source outside the snapshot is rejected', {skip:process.platform==='win32'},async t=>{
  const f=await fixture(t), outside=await mkdtemp(join(tmpdir(),'formcoach-outside-check-'));
  t.after(()=>rm(outside,{recursive:true,force:true}));
  await writeFile(join(outside,'file'),'outside'); await unlink(join(f.root,'package.json'));
  await symlink(join(outside,'file'),join(f.root,'package.json'));
  const r=f.run(); assert.equal(r.status,1); assert.match(r.stderr,/Path leaves snapshot/);
});
