// Explicit, local-only working-source export. Never recursively archive the checkout.
// Usage: node handover/package-snapshot.mjs <completed-test-run-directory>
import { readFile, writeFile, mkdir, mkdtemp, lstat, readlink, symlink, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, basename, extname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const hash = data => createHash('sha256').update(data).digest('hex');
const git = args => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();
const historicalRun = '2026-09-15T03-36-59-711Z-84685';
const reportDir = await realpath(resolve(root, process.argv[2] || 'MISSING-TEST-RUN'));
const reportRelative = relative(resolve(root, 'test-results'), reportDir);
if (!reportRelative || reportRelative.startsWith('..') || reportRelative.includes(sep))
  throw new Error('Supply one completed run directly inside test-results/');
const report = JSON.parse(await readFile(resolve(reportDir, 'report.json'), 'utf8'));
if (report.origin !== 'synthetic' || !report.status?.startsWith('passed checks') ||
    !report.results?.length || report.results.some(r => !['passed', 'blocked'].includes(r.status) || r.checks?.some(c=>!c.pass)))
  throw new Error('A completed synthetic run with no unexpected failures is required');
for(const id of ['verify.mjs','verify-mutations.mjs','verify-draw.mjs','verify-skip.mjs','audio-stalls','architecture','adversarial'])
  if(!report.results.some(r=>r.id===id && r.status==='passed'))throw new Error(`Full baseline lacks ${id}`);
for(const mode of ['engine','browser','shell','audio'])
  if(!report.results.some(r=>r.mode===mode && r.status==='passed'))throw new Error(`Full baseline lacks ${mode}`);
if(!report.testSourceHashes || Object.keys(report.testSourceHashes).length===0)throw new Error('Missing test source provenance');
execFileSync(process.execPath,['--test',resolve(root,'handover/verify-snapshot.test.mjs')],{stdio:'inherit'});

// Only selected public-source metadata is copied, not the raw report or its media.
const expected = {
  'form-coach-v4.11.html': report.buildHash,
  'conformance-vectors.json': report.fixtureHash,
  'package-lock.json': report.lockfileHash,
  'testing/summary-selection-vectors.json': report.summaryFixtureHash,
  'testing/coach-choice-vectors.json': report.coachChoiceFixtureHash,
  'testing/coach-command-vectors.json': report.coachCommandFixtureHash,
  'testing/clip-resolution-vectors.json': report.clipResolutionFixtureHash,
  'testing/movement-evidence-vectors.json': report.movementEvidenceFixtureHash,
  ...Object.fromEntries(Object.entries(report.testSourceHashes || {}).map(([p,h]) => [`testing/${p}`,h]))
};
// Fixture paths are asserted explicitly; fail rather than silently skip a renamed fixture.
for (const [p,h] of Object.entries(expected)) {
  if (!/^[a-f0-9]{64}$/.test(h) || hash(await readFile(resolve(root,p))) !== h)
    throw new Error(`Test checkpoint does not match source: ${p}`);
}

const approvedUntracked = new Set([
  'START-HERE.md', 'CONTINUE-PROMPT.md', 'handover/verify-snapshot.mjs', 'handover/package-snapshot.mjs', 'handover/verify-snapshot.test.mjs',
  'docs/HANDOVER.md', 'docs/restructure-plan.md', 'docs/exercise-and-feedback-plan.md', 'docs/feasibility-study.md',
  'docs/sessions/device-handover-2026-09-16.md', 'docs/sessions/adversarial-review-2026-09-14.md',
  'docs/sessions/architecture-optimisations-2026-09-14.md', 'docs/sessions/audio-stall-recovery-2026-09-14.md',
  'testing/adversarial-cases.mjs', 'testing/adversarial.test.mjs', 'testing/architecture-benchmark.mjs',
  'testing/architecture-cases.mjs', 'testing/architecture-probes.mjs', 'testing/architecture.test.mjs',
  'testing/audio-stalls.test.mjs'
]);
const list = args => execFileSync('git', args, {cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const tracked = list(['ls-files','-z']), untracked = list(['ls-files','--others','--exclude-standard','-z']);
const excluded = tracked.filter(p => p === 'swift-port-kit.zip');
const unknown = untracked.filter(p => !approvedUntracked.has(p));
if (unknown.length) throw new Error(`Review additional untracked files before exporting: ${unknown.join(', ')}`);
const selected = [...new Set([...tracked.filter(p => !excluded.includes(p)), ...untracked])].sort();
const allowed = new Set(['.md','.mjs','.js','.json','.html','.swift','.yml','.mp3','']);
const secret = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b|\bgh[pousr]_[A-Za-z0-9]{24,}\b|\bgithub_pat_[A-Za-z0-9_]{30,}\b|\bAKIA[0-9A-Z]{16}\b/;
const payload = [];
for (const p of selected) {
  if (p.split('/').some(s => !s || s === '.' || s === '..' || ['.git','.codex','.agents','node_modules','test-results','private','assets','.build'].includes(s)) ||
      /(^|\/)(\.env(?:\..*)?|auth\.json|id_rsa|id_ed25519)$/.test(p) || !allowed.has(extname(p)))
    throw new Error(`Not an approved source path: ${p}`);
  const path = resolve(root,p), info = await lstat(path);
  if (info.isSymbolicLink()) {
    const target = await readlink(path);
    if (p !== 'CLAUDE.md' || target !== 'AGENTS.md') throw new Error(`Unexpected symlink: ${p}`);
    payload.push({path:p,type:'symlink',target,sha256:hash(target)});
  } else {
    if (!info.isFile()) throw new Error(`Not a regular source file: ${p}`);
    const real = await realpath(path);
    if (!real.startsWith(root + sep)) throw new Error(`Source escapes checkout: ${p}`);
    const bytes = await readFile(path);
    if (extname(p) !== '.mp3' && secret.test(bytes.toString('utf8')))
      throw new Error(`Possible credential found; review locally before exporting: ${p}`);
    payload.push({path:p,type:'file',sha256:hash(bytes),bytes,mode:info.mode & 0o777});
  }
}
const manifest = JSON.parse(await readFile(resolve(root,'voice/manifest.json'),'utf8'));
const paths = new Set(payload.map(x => x.path));
if (!Array.isArray(manifest) || new Set(manifest).size !== manifest.length ||
    manifest.some(p => typeof p !== 'string' || !p.startsWith('voice/') || !paths.has(p)))
  throw new Error('Every unique active voice asset must be present');

const parent = resolve(root,'test-results/handovers');
await mkdir(parent,{recursive:true});
const out = await mkdtemp(resolve(parent,'formfinality-2026-09-16-'));
const stage = resolve(out,'source/formfinality');
await mkdir(stage,{recursive:true});
for (const f of payload) {
  await mkdir(dirname(resolve(stage,f.path)),{recursive:true});
  if (f.type === 'symlink') await symlink(f.target,resolve(stage,f.path));
  else await writeFile(resolve(stage,f.path),f.bytes,{flag:'wx',mode:f.mode});
}
const baseline = {
  schema:'formcoach-handover-baseline/1', sourceRun:basename(reportDir), historicalRun,
  started:report.started, origin:report.origin, sourcePlatform:report.platform, sourceNode:report.node,
  build:report.build, buildHash:report.buildHash, recordedCommit:report.commit, status:report.status,
  sourceHashes:expected, limitations:report.limitations,
  results:report.results.map(r => ({id:r.id,mode:r.mode,status:r.status,
    checks:r.checks?.length || 0, failedChecks:r.checks?.filter(c => !c.pass).length || 0})),
  note:'Selected metadata only; raw traces, human recordings, audio captures and private diagnostics are excluded. Not validation of the receiving device.'
};
const transfer = {
  schema:'formcoach-transfer-checks/1', date:new Date().toISOString(),
  fullRun:basename(reportDir), reportStatus:report.status,
  matchedCheckpointFiles:Object.keys(expected).length,
  snapshotVerifierTests:'passed (run during packaging, including deliberately corrupted/missing inputs)',
  activeVoiceEntries:manifest.length, activeVoiceFilesPresent:true,
  sourceCredentialPatternScan:'No matches in selected text files; heuristic, not a security certification.',
  excluded:['Git history and credentials','local Codex settings and transcripts','node_modules','test-results media and private data','testing/private','testing/assets','Swift build caches',...excluded],
  includedHistoricalOwnerDocuments:['docs/HANDOVER.md','docs/restructure-plan.md','docs/exercise-and-feedback-plan.md','docs/feasibility-study.md'],
  note:'The sender separately records npm test exit status. Report-derived checks are not proof of physical audio or pronunciation.'
};
for (const [path,data] of [['handover/BASELINE.json',baseline],['handover/TRANSFER-CHECKS.json',transfer]]) {
  const bytes=Buffer.from(JSON.stringify(data,null,2)+'\n');
  await writeFile(resolve(stage,path),bytes,{flag:'wx'});
  payload.push({path,type:'file',sha256:hash(bytes)});
}
const receipt = {
  schema:'formcoach-handover/1', created:new Date().toISOString(),
  branch:git(['branch','--show-current']), commit:git(['rev-parse','HEAD']),
  workingStatus:git(['status','--short']), historyIncluded:false,
  files:payload.map(({path,type,sha256,target}) => ({path,type,sha256,...(target?{target}:{})})).sort((a,b)=>a.path.localeCompare(b.path))
};
await writeFile(resolve(stage,'handover/SNAPSHOT.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
// Catch a watcher/editor changing the source during the export.
for (const f of payload.filter(f=>!['handover/BASELINE.json','handover/TRANSFER-CHECKS.json'].includes(f.path))) {
  const data=f.type==='symlink'?await readlink(resolve(root,f.path)):await readFile(resolve(root,f.path));
  if(hash(data)!==f.sha256)throw new Error(`Source changed during export: ${f.path}`);
}
execFileSync(process.execPath,[resolve(stage,'handover/verify-snapshot.mjs')],{stdio:'inherit'});
const zip=resolve(out,'formfinality-handover-2026-09-16.zip');
const entries=[...receipt.files.map(f=>'formfinality/'+f.path),'formfinality/handover/SNAPSHOT.json'];
execFileSync('/usr/bin/zip',['-q','-y',zip,'-@'],{cwd:dirname(stage),input:entries.join('\n')+'\n',maxBuffer:1024*1024});
const archive=await readFile(zip), checksum=hash(archive);
await writeFile(zip+'.sha256',`${checksum}  ${basename(zip)}\n`,{flag:'wx'});
const restored=resolve(out,'restore-check');
await mkdir(restored);
execFileSync('/usr/bin/unzip',['-q',zip,'-d',restored]);
execFileSync(process.execPath,[resolve(restored,'formfinality/handover/verify-snapshot.mjs')],{stdio:'inherit'});
console.log(JSON.stringify({zip,checksum,bytes:archive.length,files:receipt.files.length,restored:resolve(restored,'formfinality')},null,2));
