// Optional serial before/after microbenchmark; timings never gate CI.
import {readFile,mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {hash} from './lib.mjs';
import {diagnosticClass,bufferWorkload,bufferProfile,cameraProbe} from './architecture-probes.mjs';
const [baseline,build]=process.argv.slice(2);
if(!baseline||!build)throw new Error('Usage: node testing/architecture-benchmark.mjs <baseline.html> <build.html>');
const inputs=await Promise.all([baseline,build].map(path=>readFile(path,'utf8')));
const classes=inputs.map(diagnosticClass),samples=[[],[]];
// Warm both implementations, then alternate their order to limit warmup/order bias.
for(const B of classes)bufferWorkload(B,500);
for(let round=0;round<5;round++)for(const i of round%2?[1,0]:[0,1])samples[i].push(bufferProfile(classes[i]));
const cases=[];
for(let i=0;i<2;i++){
  const p=await cameraProbe(inputs[i]);for(let n=0;n<90;n++)p.run();
  const sorted=samples[i].map(s=>s.elapsedMs).sort((a,b)=>a-b);
  cases.push({path:[baseline,build][i],sha256:hash(inputs[i]),medianMs:sorted[2],samples:samples[i],
    camera:{inferences:p.counts.inference,conversions:p.converted.length,ticks:p.frames.length}});
}
const output={node:process.version,platform:`${process.platform}/${process.arch}`,cases,
  identicalSnapshots:cases.every(c=>c.samples.every(s=>s.snapshotHash===cases[0].samples[0].snapshotHash)),
  speedup:cases[0].medianMs/cases[1].medianMs,
  limitations:['Synthetic 200-second recorder workload: 6,000 frames, 2,000 events and three flags; no video, AI or private inputs.',
    'Node wall-clock microbenchmark on one desktop, not full-app FPS, heap usage, mobile battery or thermal validation.',
    'Snapshot equivalence supplements independent regressions; it is not a generated correctness oracle. Camera drawing is substituted.']};
await mkdir(resolve('test-results'),{recursive:true});const dir=await mkdtemp(resolve('test-results/architecture-benchmark-'));
await writeFile(resolve(dir,'results.json'),JSON.stringify(output,null,2));
console.log(JSON.stringify(output,null,2));console.log(`Evidence: ${dir}`);
if(!output.identicalSnapshots)process.exitCode=1;
