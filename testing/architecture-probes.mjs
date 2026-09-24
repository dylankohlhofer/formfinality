// Shared local probes for the default regressions and optional before/after profile.
// No model, private recording, network request or alternative exercise judgement.
import {loadEngine,hash} from './lib.mjs';
export function diagnosticClass(html){
  const source=html.split('class DiagnosticBuffer {')[1]?.split('/* DIAGNOSTIC BUFFER END */')[0];
  if(!source)throw new Error('Diagnostic boundary missing');
  return Function('return class DiagnosticBuffer {'+source)();
}
export const meta={version:'architecture-synthetic',scriptSha256:'a'.repeat(64)};
export const landmarks=Array.from({length:33},(_,i)=>({x:.3+i*.008,y:.2+i*.015,z:i%2?.2:0,visibility:.99}));
export async function cameraProbe(html,{paused=false,following=false,missing=false,aspect=16/9}={}){
  const engine=await loadEngine(html);
  const body=html.slice(html.indexOf('function loopBody(t){'),html.indexOf('const clock = s =>'));
  if(!body.startsWith('function loopBody(t){'))throw new Error('Camera loop boundary missing');
  return Function('convert','landmarks','paused','following','missing','aspect',`
    const frames=[],converted=[],counts={inference:0,demo:0,draw:0};
    const buildFrame=(...args)=>{const frame=convert(...args);converted.push(frame);return frame;};
    const video={currentTime:0,readyState:2,videoWidth:360*aspect,videoHeight:360},canvas={width:360*aspect,height:360};
    const cameraSwitchState='idle';
    const ctx=new Proxy({},{get:(_target,key)=>()=>{if(key==='drawImage')counts.draw++;},set:()=>true});
    ${html.match(/const BONES = [^;]+;/)?.[0] || 'throw new Error("Bones boundary missing");'}
    const JOINTS=Object.keys(convert(landmarks,aspect).left);
    const performance={now:()=>1000};
    let lastVideoTime=-1,lastT=0,lastTint=null,camFacing='user';
    const ghostChk={checked:false},calibMv=null,calib=null,recMode=null;
    const sess={core:{paused,following},tick:(frame,dt,now)=>frames.push({frame,dt,now})};
    const landmarker={detectForVideo:()=>{counts.inference++;return{landmarks:missing?[]:[landmarks]};}};
    const drawDemo=()=>counts.demo++;
    ${body}
    return {frames,converted,counts,run(){video.currentTime+=1/30;loopBody(video.currentTime*1000);},
      repeat(){loopBody(video.currentTime*1000);}};
  `)(engine.buildFrame,landmarks,paused,following,missing,aspect);
}
export function bufferWorkload(BufferClass,frames=6000){
  const buffer=new BufferClass();buffer.start(meta);
  const side=Object.fromEntries(['ear','shoulder','elbow','wrist','hip','knee','ankle','heel','toe'].map((j,i)=>[j,{x:.3,y:.1+i*.08,z:0,c:.99}]));
  for(let i=0;i<frames;i++){
    const at=i*1000/30;
    buffer.add('frame',at,{frame:{left:side,right:side,cam:'left',aspect:16/9},phase:0,movement:'plank',tier:'building',
      reps:0,held:i/30,score:null,blocked:['tracking'],after:{state:'setup'}});
    if(i%3===0)buffer.add('effect',at,{type:'synthetic-control',number:i});
    if(i>0&&i%1500===0)buffer.add('flag',at,{note:'Synthetic retention check'});
  }
  return buffer;
}
export function bufferProfile(BufferClass){
  const started=performance.now(),buffer=bufferWorkload(BufferClass),elapsedMs=performance.now()-started;
  const snapshot=buffer.snapshot();BufferClass.parse(JSON.stringify(snapshot));
  return{elapsedMs,snapshotHash:hash(JSON.stringify(snapshot)),retained:snapshot.entries.length,
    dropped:snapshot.dropped,bytes:buffer.bytes,flags:snapshot.retention.flags.length};
}
