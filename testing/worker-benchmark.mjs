// Isolated local experiment. Never imported by the production application.
import {createServer} from 'node:http';
import {readFile,realpath,mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../',import.meta.url)),delegate=process.argv[2]||'CPU';
if(!['CPU','GPU'].includes(delegate))throw new Error('Usage: node testing/worker-benchmark.mjs [CPU|GPU]');
const manifest=JSON.parse(await readFile(resolve(root,'testing/model.json')));
const model=await readFile(resolve(root,'testing/assets/pose_landmarker_lite.task'));
if(createHash('sha256').update(model).digest('hex')!==manifest.sha256)throw new Error('Pose model checksum mismatch');
const server=createServer(async(req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(path==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Local pose worker benchmark</title><p>Non-person synthetic frames; no camera permission.</p>');return;}
    if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}
    const fixed={'/worker.js':'testing/worker-pose.js','/queue.mjs':'testing/worker-queue.mjs','/vision_bundle.mjs':'node_modules/@mediapipe/tasks-vision/vision_bundle.mjs'};
    if(path==='/model.task'){res.end(model);return;}
    let file=fixed[path]&&resolve(root,fixed[path]);
    if(path.startsWith('/wasm/')){
      const allowed=resolve(root,'node_modules/@mediapipe/tasks-vision/wasm');
      file=await realpath(resolve(allowed,path.slice('/wasm/'.length)));
      if(!file.startsWith(allowed+sep))throw new Error('Path escaped assets');
    }
    if(!file){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':'text/javascript');res.end(await readFile(file));
  }catch(error){res.writeHead(500);res.end('Benchmark asset error');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}`;
await mkdir(resolve(root,'test-results'),{recursive:true});const dir=await mkdtemp(resolve(root,'test-results/worker-benchmark-'));
let browser;const output={delegate,modelSha256:manifest.sha256,runtime:'@mediapipe/tasks-vision@0.10.14',results:[],
  limitations:['Blank canvas frames exercise local model loading, detection, transfer and scheduling, not human landmark accuracy or tracked-person workloads.',
    'Single desktop Chromium host, not physical phone battery/thermal performance. No cloud requests or camera permission.',
    'The prototype is not connected to the production camera loop. GPU and CPU results must be labelled separately.']};
try{
  browser=await chromium.launch();output.browser=browser.version();
  for(const mode of ['main','worker']){
    const page=await browser.newPage();const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>new URL(r.request().url()).origin===url?r.continue():r.abort());
    await page.goto(url);
    const result=await page.evaluate(async({mode,delegate})=>{
      const {FilesetResolver,PoseLandmarker}=await import('/vision_bundle.mjs');
      const {PoseWorkerQueue}=await import('/queue.mjs');
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#888';ctx.fillRect(0,0,640,360);
      const inference=[],age=[],heartbeat=[],failures=[];let model,queue,worker,previous=0,poseCount=0;
      const accept=r=>{inference.push(r.processingMs);age.push(r.ageMs);poseCount+=r.landmarks.length;};
      const loadStart=performance.now();
      if(mode==='worker'){
        worker=new Worker('/worker.js');
        await new Promise((resolve,reject)=>{
          const timer=setTimeout(()=>reject(new Error('Worker startup timeout')),30000);
          worker.onerror=e=>{clearTimeout(timer);reject(new Error(e.message));};
          worker.onmessage=({data})=>{clearTimeout(timer);data.type==='ready'?resolve():reject(new Error(data.error));};
          worker.postMessage({type:'init',delegate});
        });
        queue=new PoseWorkerQueue(worker,{onResult:accept,onError:e=>failures.push(e.message),maxAgeMs:200});
      }else model=await PoseLandmarker.createFromOptions(await FilesetResolver.forVisionTasks('/wasm'),{
        baseOptions:{modelAssetPath:'/model.task',delegate},runningMode:'VIDEO',numPoses:1});
      const loadMs=performance.now()-loadStart;
      async function feed(){
        const capturedAt=performance.now(),bitmap=await createImageBitmap(canvas);
        if(queue)queue.submit(bitmap,capturedAt);
        else{try{const start=performance.now(),r=model.detectForVideo(bitmap,capturedAt);accept({processingMs:performance.now()-start,ageMs:performance.now()-capturedAt,landmarks:r.landmarks});}finally{bitmap.close();}}
      }
      async function drained(){
        const deadline=performance.now()+10000;
        while(queue&&(queue.inFlight||queue.pending)&&!queue.closed){if(performance.now()>deadline)throw new Error('Worker did not drain');await new Promise(r=>setTimeout(r,10));}
      }
      try{
        // Warm both paths before measuring. Identical pixels, different scheduling.
        for(let i=0;i<12;i++){await feed();await drained();}
        inference.length=0;age.length=0;const statsBefore=queue?{...queue.stats}:null;
        previous=performance.now();const heart=setInterval(()=>{const now=performance.now();heartbeat.push(Math.max(0,now-previous-16));previous=now;},16);
        const start=performance.now();
        try{for(let i=0;i<90;i++){await feed();await new Promise(r=>setTimeout(r,Math.max(0,start+(i+1)*1000/30-performance.now())));}await drained();}
        finally{clearInterval(heart);}
        const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))]??null;
        const stats=queue?Object.fromEntries(Object.entries(queue.stats).map(([k,v])=>[k,v-statsBefore[k]])):null;
        return{mode,delegate,loadMs,elapsedMs:performance.now()-start,samples:inference.length,poseCount,
          inferenceP50Ms:percentile(inference,.5),inferenceP95Ms:percentile(inference,.95),ageP95Ms:percentile(age,.95),
          mainThreadDelayP95Ms:percentile(heartbeat,.95),mainThreadDelayMaxMs:Math.max(0,...heartbeat),stats,failures};
      }finally{queue?.close();model?.close();}
    },{mode,delegate});
    result.errors=errors;output.results.push(result);console.log(JSON.stringify(result));await page.close();
  }
  output.passed=output.results.every(r=>r.samples>0&&r.poseCount===0&&!r.failures.length&&!r.errors.length);
  if(!output.passed)process.exitCode=1;
}catch(error){output.error=error.stack;process.exitCode=1;console.error(error);}
finally{
  await browser?.close();await new Promise(r=>server.close(r));
  await writeFile(resolve(dir,'results.json'),JSON.stringify(output,null,2));
  console.log(`Benchmark evidence: ${dir}`);
}
