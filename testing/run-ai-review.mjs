#!/usr/bin/env node
// Explicit opt-in consumer of an existing synthetic run. No new exercise
// harness, remote model, upload, oracle edits, or automatic private-file scan.
import {writeFile,mkdtemp,realpath,open,lstat,unlink,rename} from 'node:fs/promises';
import {resolve,join,sep,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {exportReview,importReview,canonicalReviewJSON} from './ai-review.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export const NATIVE_REVIEW_LIMITS=Object.freeze({timeoutMs:120000,killGraceMs:1000,settleGraceMs:1000,
  stdoutBytes:8192,stderrBytes:256*1024});
export const REVIEW_LOCK_FILE='review.lock';
const signalNative=(child,signal)=>process.platform==='win32'
  ? child.kill(signal) : process.kill(-child.pid,signal);

// Dependency injection is for deterministic process doubles, not a second
// provider. Production starts a fresh process group so descendants receive the
// same termination signals as swift run. No close event is needed to settle.
export function nativeReview(evidencePath,{spawnProcess=spawn,signalProcess=signalNative}={}){
  return new Promise((done,reject)=>{
    const child=spawnProcess('swift',['run','--package-path',resolve(root,'swift/FormCoachEngine'),'formcoach-review','--evidence',evidencePath],
      {cwd:root,stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
    const out=[],err=[],terminationErrors=[];
    let outBytes=0,errBytes=0,timedOut=false,oversized=false,stopping=false,settled=false,killAttempted=false;
    let killTimer,settleTimer,processError;
    const signal=kind=>{
      try{signalProcess(child,kind);}
      catch(error){if(error.code!=='ESRCH')terminationErrors.push({signal:kind,code:error.code || 'unknown',message:String(error.message).slice(0,400)});}
    };
    const force=()=>{if(!killAttempted){killAttempted=true;signal('SIGKILL');}};
    const finish=(code=null,closed=false)=>{
      if(settled)return;
      settled=true;clearTimeout(timer);clearTimeout(killTimer);clearTimeout(settleTimer);
      // Even if swift exits promptly, a descendant may have ignored SIGTERM.
      if(stopping)force();
      child.stdout.destroy();child.stderr.destroy();child.unref();
      if(processError){reject(processError);return;}
      done({code,stdout:Buffer.concat(out).toString('utf8'),stderr:Buffer.concat(err).toString('utf8'),
        timedOut,oversized,killAttempted,settledWithoutClose:!closed,terminationErrors});
    };
    const stop=reason=>{
      if(stopping || settled)return;
      stopping=true;timedOut=reason==='timeout';oversized=reason==='oversized';
      clearTimeout(timer);
      // Schedule both before signalling: a cooperative child can close during
      // signal delivery. The last timer is independent of exit/close/pipe state.
      killTimer=setTimeout(force,NATIVE_REVIEW_LIMITS.killGraceMs);
      settleTimer=setTimeout(()=>finish(),NATIVE_REVIEW_LIMITS.killGraceMs+NATIVE_REVIEW_LIMITS.settleGraceMs);
      signal('SIGTERM');
    };
    const timer=setTimeout(()=>stop('timeout'),NATIVE_REVIEW_LIMITS.timeoutMs);
    child.stdout.on('data',chunk=>{
      if(stopping || settled)return;
      const bytes=Buffer.from(chunk);
      if(outBytes+bytes.length>NATIVE_REVIEW_LIMITS.stdoutBytes){stop('oversized');return;}
      out.push(bytes);outBytes+=bytes.length;
    });
    child.stderr.on('data',chunk=>{
      if(stopping || settled)return;
      const bytes=Buffer.from(chunk);
      if(errBytes+bytes.length>NATIVE_REVIEW_LIMITS.stderrBytes){stop('oversized');return;}
      err.push(bytes);errBytes+=bytes.length;
    });
    child.on('error',error=>{
      if(settled)return;
      processError=error;
      if(child.pid)stop('error');else finish();
    });
    child.once('close',code=>finish(code,true));
  });
}

async function acquireReviewLock(base){
  const path=join(base,REVIEW_LOCK_FILE);
  let handle;
  try{handle=await open(path,'wx+',0o600);}
  catch(error){
    if(error.code==='EEXIST')throw Object.assign(Error('Review already locked for this run. Existing review.lock and current priorities were left untouched; verify its owner before manual recovery.'),{code:'REVIEW_LOCKED'});
    throw error;
  }
  let held;
  try{held=await handle.stat();}catch(error){await handle.close();throw error;}
  const contents=Buffer.from(canonicalReviewJSON({schema:'ai-review-lock/1',owner:randomUUID(),pid:process.pid}));
  const owns=async()=>{
    try{
      const current=await lstat(path);
      if(!current.isFile() || current.dev!==held.dev || current.ino!==held.ino || current.size!==contents.length)return false;
      const bytes=Buffer.alloc(contents.length);
      const read=await handle.read(bytes,0,bytes.length,0);
      return read.bytesRead===contents.length && bytes.equals(contents);
    }catch(error){if(error.code==='ENOENT')return false;throw error;}
  };
  const assertOwned=async()=>{
    if(!await owns())throw Object.assign(Error('Review lock ownership changed. The replacement lock and current priorities were left untouched.'),{code:'REVIEW_LOCK_LOST'});
  };
  const release=async()=>{
    try{await assertOwned();await unlink(path);}
    finally{await handle.close();}
  };
  try{await handle.writeFile(contents);}
  catch(error){await release();throw error;}
  return {assertOwned,release};
}
// Atomic publication never follows a destination symlink or truncates the old
// artifact on failure. Recheck lock ownership after preparing each root file.
export async function writeReviewJSON(path,value,assertOwned=async()=>{}){
  const temporary=join(dirname(path),'.review-write-'+randomUUID()+'.tmp');
  let handle;
  try{
    handle=await open(temporary,'wx',0o600);
    await handle.writeFile(canonicalReviewJSON(value));await handle.close();handle=null;
    let current;
    try{current=await lstat(path);}catch(error){if(error.code!=='ENOENT')throw error;}
    if(current && (!current.isFile() || current.nlink!==1))throw Error('Review output is not an unshared regular file; nothing was overwritten.');
    await assertOwned();
    await rename(temporary,path);
  }finally{
    if(handle)await handle.close();
    try{await unlink(temporary);}catch(error){if(error.code!=='ENOENT')throw error;}
  }
}
const writeJSON=writeReviewJSON;

export async function runLocalReview({runDir,nativeRunner=nativeReview}){
  const base=await realpath(runDir),results=await realpath(resolve(root,'test-results'));
  if(!base.startsWith(results+sep))throw Error('Select an exact saved run inside this repository’s test-results directory.');
  const lock=await acquireReviewLock(base);
  const reportPath=join(base,'report.json'),sourcePath=join(base,'review-source.json');
  let target;
  // Establish invalidation before export: stale receipts, missing inputs and
  // invalid provenance must not leave an earlier successful root selection.
  const saveStatus=async(status,imported)=>{
    await lock.assertOwned();
    const latest=imported || {status:status.status,selectedCandidateIds:[],humanReviewRequired:true,accuracyVerdict:'not-assessed',
      message:'No current AI priority selection. Earlier attempts, if any, remain in their separate ai-review directories.'};
    if(target && imported)await writeJSON(join(target,'review-import.json'),imported);
    await writeJSON(join(base,'review-import.json'),latest,lock.assertOwned);
    if(target)await writeJSON(join(target,'review-status.json'),status);
    await writeJSON(join(base,'review-status.json'),{...status,...(target?{evidenceDirectory:target.slice(base.length+1)}:{})},lock.assertOwned);
    return {...status,directory:target};
  };
  try{
    await saveStatus({status:'preparing',modelRan:false,humanReviewRequired:true,accuracyVerdict:'not-assessed'});
    target=await mkdtemp(join(base,'ai-review-'));
    let evidence;
    try{evidence=await exportReview({reportPath,sourcePath});}
    catch(error){return await saveStatus({status:'export-failed',modelRan:false,message:error.message,humanReviewRequired:true,accuracyVerdict:'not-assessed'});}
    const packagePath=join(target,'review-evidence.json'),responsePath=join(target,'review-selection.json');
    await writeJSON(packagePath,evidence);
    if(!evidence.candidates.length)return await saveStatus({status:'no-candidates',modelRan:false,humanReviewRequired:true,accuracyVerdict:'not-assessed'});
    await saveStatus({status:'reviewing',modelRan:'pending',humanReviewRequired:true,accuracyVerdict:'not-assessed'});
    let execution;
    try{execution=await nativeRunner(packagePath);}
    catch(error){return await saveStatus({status:'native-unavailable',modelRan:false,message:error.message,humanReviewRequired:true,accuracyVerdict:'not-assessed'});}
    await lock.assertOwned();
    await writeFile(join(target,'native.log'),execution.stderr || '');
    if(execution.code!==0 || execution.timedOut || execution.oversized)return await saveStatus({
      status:execution.timedOut?'timed-out':execution.oversized?'invalid-native-output':'native-not-selected',
      modelRan:'see-native-log',exitCode:execution.code,killAttempted:execution.killAttempted ?? false,
      settledWithoutClose:execution.settledWithoutClose ?? false,terminationErrors:execution.terminationErrors ?? [],
      humanReviewRequired:true,accuracyVerdict:'not-assessed'});
    // Rebuild after awaiting AI so changes to evidence or analyzers reject it.
    await writeFile(responsePath,execution.stdout);
    let imported;
    try{imported=await importReview({reportPath,sourcePath,packagePath,responsePath});}
    catch(error){return await saveStatus({status:'selection-rejected',modelRan:true,message:error.message,humanReviewRequired:true,accuracyVerdict:'not-assessed'});}
    return await saveStatus({status:imported.status,modelRan:true,selectedCandidateIds:imported.selectedCandidateIds,
      humanReviewRequired:true,accuracyVerdict:'not-assessed'},imported);
  }finally{await lock.release();}
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const args=process.argv.slice(2);
    if(args.length!==2 || args[0]!=='--run')throw Error('Usage: npm run test:review -- --run test-results/<exact-run>');
    const result=await runLocalReview({runDir:resolve(args[1])});
    console.log(JSON.stringify(result,null,2));
    process.exitCode=['human-review-required','no-candidates'].includes(result.status)?0:2;
  }catch(error){console.error(error.message);process.exitCode=1;}
}
