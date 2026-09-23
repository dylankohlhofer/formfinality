import { reveal } from './ui-navigation.mjs';
// Adversarial integration cases use the existing shell/report runner. All streams,
// wake locks and imported data are local synthetic substitutes, not user devices.
async function start(page){
  await page.locator('#skipBtn').click();await page.locator('[data-t="building"]').click();await page.locator('#goBtn').click();
  await nextWorkout(page);
}
async function nextWorkout(page){
  await page.locator('[data-plan="first-steps"]').click();await page.locator('#planStartBtn').click();
  await page.waitForFunction(()=>{const c=__testLab.coachAccess().host?.core;return c && !c.done && !c.paused;},null,{polling:25});
}
async function end(page){await page.locator('#startBtn').click();await page.locator('#endSessionBtn').click();}
async function fakeCamera(page){
  await page.evaluate(()=>{
    __testLab.realCamera();__testLab.mockModel();window.adversarialTracks=[];
    navigator.mediaDevices.getUserMedia=async()=>{
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
      const context=canvas.getContext('2d'),stream=canvas.captureStream(10);
      const timer=setInterval(()=>context.fillRect(0,0,640,360),100);
      for(const track of stream.getTracks()){
        adversarialTracks.push(track);const stop=track.stop.bind(track);
        track.stop=()=>{clearInterval(timer);stop();};
      }
      return stream;
    };
  });
}
function diagnostic(name,blocked=[]){return {schema:'formcoach-diagnostic/1',meta:{version:name,scriptSha256:'a'.repeat(64)},dropped:0,
  entries:[{kind:'control',at:0,data:{action:'Synthetic import'}},
    {kind:'frame',at:1000,data:{frame:null,movement:'plank',phase:0,reps:0,score:null,blocked}}]};}
const file=(name,data)=>({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});

export async function adversarialCases(runCase){
  await runCase('adversarial-pending-camera-end','End must release every acquired track before an unresolved replacement play promise settles.',async(page,check,capture)=>{
    await fakeCamera(page);await start(page);
    await page.evaluate(()=>{document.getElementById('cam').play=()=>new Promise(resolve=>{window.adversarialResolvePlay=resolve;});});
    await reveal(page, '#flipBtn'); await page.locator('#flipBtn').click();await page.waitForFunction(()=>typeof adversarialResolvePlay==='function');
    check('Two actual synthetic streams were acquired',await page.evaluate(()=>adversarialTracks.length),2);
    await page.locator('#endSessionBtn').click();
    check('Debrief is reachable during hung replacement',await page.locator('#msg h2').innerText(),'Workout ended');
    check('End immediately releases both original and replacement tracks',await page.evaluate(()=>adversarialTracks.map(t=>t.readyState)),['ended','ended']);
    await capture('ended-before-play-settles');
    await page.evaluate(async()=>{adversarialResolvePlay();await new Promise(resolve=>setTimeout(resolve,0));});
    check('Late playback cannot reopen camera UI',await page.locator('#flipBtn').isVisible(),false);
    check('Settled stale playback retains no tracks',await page.evaluate(()=>adversarialTracks.every(t=>t.readyState==='ended')),true);
  });
  await runCase('adversarial-animation-restart','Rapid End/start sequences cannot revive an earlier requestAnimationFrame chain.',async(page,check)=>{
    await fakeCamera(page);
    await page.evaluate(()=>{
      window.adversarialRaf=new Map();let id=0;
      window.requestAnimationFrame=callback=>{adversarialRaf.set(++id,callback);return id;};
      window.cancelAnimationFrame=id=>adversarialRaf.delete(id);
    });
    await start(page);
    check('First workout has one scheduled animation',await page.evaluate(()=>adversarialRaf.size),1);
    for(let round=1;round<=3;round++){
      await page.evaluate(()=>{window.adversarialOld=[...adversarialRaf];});
      await end(page);await page.locator('#againBtn').click();await nextWorkout(page);
      await page.evaluate(()=>{
        for(const [id,callback]of adversarialOld){adversarialRaf.delete(id);callback(performance.now());}
      });
      check(`Only the new workout owns a live animation chain after restart ${round}`,await page.evaluate(()=>adversarialRaf.size),1);
    }
    await end(page);
    await page.evaluate(()=>{const queued=[...adversarialRaf];adversarialRaf.clear();for(const [,callback]of queued)callback(performance.now());});
    check('Stopped loops stay stopped',await page.evaluate(()=>adversarialRaf.size),0);
    check('All restart streams released',await page.evaluate(()=>adversarialTracks.every(t=>t.readyState==='ended')),true);
  });
  for(const outcome of ['resolve','reject'])
    await runCase(`adversarial-camera-restart-${outcome}`,'Stale replacement playback cannot release or restore a camera owned by a newer workout.',async(page,check)=>{
      await fakeCamera(page);await start(page);
      await page.evaluate(()=>{
        const video=document.getElementById('cam');window.adversarialOriginalPlay=video.play;
        video.play=()=>new Promise((resolve,reject)=>{window.adversarialPlay={resolve,reject};});
      });
      await reveal(page, '#flipBtn'); await page.locator('#flipBtn').click();await page.waitForFunction(()=>!!window.adversarialPlay);
      await page.locator('#endSessionBtn').click();
      check('Both pending-switch streams end before settlement',await page.evaluate(()=>adversarialTracks.map(t=>t.readyState)),['ended','ended']);
      await page.evaluate(()=>{document.getElementById('cam').play=adversarialOriginalPlay;});
      await page.locator('#againBtn').click();await nextWorkout(page);
      await page.evaluate(async outcome=>{
        window.adversarialNewStream=document.getElementById('cam').srcObject;
        window.adversarialNewCore=__testLab.coachAccess().host.core;
        if(outcome==='resolve')adversarialPlay.resolve();else adversarialPlay.reject(new Error('Old playback failed'));
        await new Promise(resolve=>setTimeout(resolve,0));
      },outcome);
      check('Only the newer camera remains live',await page.evaluate(()=>adversarialTracks.map(t=>t.readyState)),['ended','ended','live']);
      check('New stream remains attached',await page.evaluate(()=>document.getElementById('cam').srcObject===adversarialNewStream),true);
      check('New workout remains active and unpaused',await page.evaluate(()=>{
        const c=__testLab.coachAccess().host.core;return c===adversarialNewCore&&!c.done&&!c.paused;
      }),true);
      check('Late playback cannot reopen the old pause dialog',await page.locator('#sessionDialog').isVisible(),false);
      await end(page);
      check('New workout releases its own stream',await page.evaluate(()=>adversarialTracks.every(t=>t.readyState==='ended')),true);
    });
  await runCase('adversarial-wakelock-overlap','Overlapping optional wake-lock requests must not orphan a lock after End.',async(page,check)=>{
    await fakeCamera(page);
    await page.evaluate(()=>{
      window.adversarialLocks=[];window.adversarialLockGrants=[];
      Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:()=>new Promise(resolve=>{
        adversarialLockGrants.push(()=>{const lock={released:false,release:async()=>{lock.released=true;}};adversarialLocks.push(lock);resolve(lock);});
      })}});
    });
    await start(page);await page.locator('#pauseBtn').click();await page.locator('#resumeBtn').click();
    check('Pause/resume shares the still-pending wake-lock request',await page.evaluate(()=>adversarialLockGrants.length),1);
    await page.evaluate(async()=>{for(const grant of adversarialLockGrants)grant();await new Promise(resolve=>setTimeout(resolve,0));});
    check('Wake-lock feature did not block startup/resume',await page.locator('#sessionDialog').isVisible(),false);
    await end(page);
    check('Every granted wake lock is released on End',await page.evaluate(()=>adversarialLocks.every(lock=>lock.released)),true);
    check('Camera still releases normally',await page.evaluate(()=>adversarialTracks.every(t=>t.readyState==='ended')),true);
  });
  for(const first of ['old','new'])
    await runCase(`adversarial-wakelock-restart-${first}`,'Late wake-lock grants belong to their original workout, in either completion order.',async(page,check)=>{
      await fakeCamera(page);await pendingWakeLocks(page);await start(page);await end(page);
      await page.locator('#againBtn').click();await nextWorkout(page);
      check('A hung old request does not block a new workout request',await page.evaluate(()=>adversarialLockRequests.length),2);
      await grantWakeLock(page,first==='old'?0:1);
      await page.locator('#pauseBtn').click();await page.locator('#resumeBtn').click();
      check('Old completion cannot clear newer ownership or trigger an extra request',await page.evaluate(()=>adversarialLockRequests.length),2);
      await grantWakeLock(page,first==='old'?1:0);
      check('Stale grant is released and current grant is retained',await page.evaluate(()=>adversarialLockRequests.map(r=>r.lock.released)),[true,false]);
      await end(page);
      check('Every grant releases at its owning workout end',await page.evaluate(()=>adversarialLockRequests.every(r=>r.lock.released)),true);
    });
  for(const outcome of ['paused','reject'])
    await runCase(`adversarial-wakelock-retry-${outcome}`,'A rejected or no-longer-useful wake-lock request must release ownership and allow retry.',async(page,check)=>{
      await fakeCamera(page);await pendingWakeLocks(page);await start(page);await page.locator('#pauseBtn').click();
      if(outcome==='paused'){
        await grantWakeLock(page,0);
        check('Grant arriving while paused is released',await page.evaluate(()=>adversarialLockRequests[0].lock.released),true);
      }else await page.evaluate(async()=>{adversarialLockRequests[0].reject(new Error('Optional wake lock unavailable'));await new Promise(resolve=>setTimeout(resolve,0));});
      await page.locator('#resumeBtn').click();
      check('Resume can request again after optional failure or stale grant',await page.evaluate(()=>adversarialLockRequests.length),2);
      await grantWakeLock(page,1);
      check('New grant stays active',await page.evaluate(()=>adversarialLockRequests[1].lock.released),false);
      await end(page);
      check('Retried lock releases on End',await page.evaluate(()=>adversarialLockRequests[1].lock.released),true);
    });
  for(const [suffix,blocked]of [['string','tracking'],['object',{length:1,0:'tracking'}]])
    await runCase(`adversarial-diagnostic-shape-${suffix}`,'Malformed imported blocker lists must be rejected before replay can throw.',async(page,check)=>{
      await reveal(page, '#diagToggle'); await page.locator('#diagToggle').click();
      await page.locator('#diagImport').setInputFiles(file('malformed.json',diagnostic('malformed',blocked)));
      await page.waitForFunction(()=>document.getElementById('diagImport').value==='');
      const rejected=await page.locator('#diagViewer').isHidden();
      check('Malformed field shape is rejected before opening',rejected,true);
      if(!rejected){
        await page.locator('#diagSeek').evaluate(el=>{el.value='1';el.dispatchEvent(new Event('input',{bubbles:true}));});
        await page.waitForTimeout(25);
      }
      check('Import gives a useful validation error',/invalid|malformed|blocker/i.test(await page.locator('#diagStatus').innerText()),true);
    });
  await runCase('adversarial-diagnostic-valid','Valid diagnostic lists and markup-like text remain readable without script execution.',async(page,check)=>{
    await reveal(page, '#diagToggle'); await page.locator('#diagToggle').click();
    const data=diagnostic('<img src=x onerror=alert(1)>',['tracking']);
    await page.locator('#diagImport').setInputFiles(file('valid.json',data));await page.locator('#diagViewer').waitFor();
    await page.locator('#diagSeek').evaluate(el=>{el.value='1';el.dispatchEvent(new Event('input',{bubbles:true}));});
    check('Valid blocker list is readable',/Blocked by: tracking/.test(await page.locator('#diagSummary').innerText()),true);
    check('Imported markup remains text',await page.locator('#diagReadout img').count(),0);
    check('Version text is preserved', (await page.locator('#diagReadout').textContent()).includes(data.meta.version),true);
  });
  for(const reset of ['clear','replace']) for(const outcome of ['resolve','reject'])
    await runCase(`adversarial-diagnostic-${reset==='clear'?'stale':'replace'}-${outcome}`,'A pending import must not replace or erase a newer import, with or without Clear.',async(page,check)=>{
      await reveal(page, '#diagToggle'); await page.locator('#diagToggle').click();
      await page.evaluate(()=>{
        const original=File.prototype.text;
        File.prototype.text=function(){
          if(this.name!=='old.json')return original.call(this);
          return new Promise((resolve,reject)=>{window.adversarialImport={resolve,reject};});
        };
      });
      await page.locator('#diagImport').setInputFiles(file('old.json',diagnostic('old')));
      await page.waitForFunction(()=>!!window.adversarialImport);
      if(reset==='clear')await page.locator('#diagClear').click();
      await page.locator('#diagImport').setInputFiles(file('new.json',diagnostic('new')));await page.locator('#diagViewer').waitFor();
      await page.evaluate(async({outcome,text})=>{
        if(outcome==='resolve')adversarialImport.resolve(text);else adversarialImport.reject(new Error('Old synthetic file read failed'));
        await new Promise(resolve=>setTimeout(resolve,0));
      },{outcome,text:JSON.stringify(diagnostic('old'))});
      check('Newer import remains visible',await page.locator('#diagViewer').isVisible(),true);
      check('Old failure cannot replace the newer success status',/Opened locally/.test(await page.locator('#diagStatus').innerText()),true);
      check('Newer data remains selected',/Build: new;/.test(await page.locator('#diagReadout').textContent()),true);
    });
  for(const outcome of ['resolve','reject'])
    await runCase(`adversarial-diagnostic-pending-${outcome}`,'Stale completion cannot clear a newer file selection while that file is still loading.',async(page,check)=>{
      await reveal(page, '#diagToggle'); await page.locator('#diagToggle').click();
      await page.evaluate(()=>{
        window.adversarialReads={};
        File.prototype.text=function(){return new Promise((resolve,reject)=>{adversarialReads[this.name]={resolve,reject};});};
      });
      await page.locator('#diagImport').setInputFiles(file('old.json',diagnostic('old')));
      await page.locator('#diagImport').setInputFiles(file('new.json',diagnostic('new')));
      await page.evaluate(async({outcome,text})=>{
        if(outcome==='resolve')adversarialReads['old.json'].resolve(text);else adversarialReads['old.json'].reject(new Error('Old file read failed'));
        await new Promise(resolve=>setTimeout(resolve,0));
      },{outcome,text:JSON.stringify(diagnostic('old'))});
      check('New pending selection is retained',await page.locator('#diagImport').evaluate(el=>el.files[0]?.name),'new.json');
      check('Old data never opens during the newer read',await page.locator('#diagViewer').isVisible(),false);
      check('Old failure does not replace current status',/Old file read failed/.test(await page.locator('#diagStatus').innerText()),false);
      await page.evaluate(text=>adversarialReads['new.json'].resolve(text),JSON.stringify(diagnostic('new')));
      await page.locator('#diagViewer').waitFor();
      check('Current import opens successfully',/Build: new;/.test(await page.locator('#diagReadout').textContent()),true);
      check('Only current completion clears the input',await page.locator('#diagImport').inputValue(),'');
    });
}

async function pendingWakeLocks(page){
  await page.evaluate(()=>{
    window.adversarialLockRequests=[];
    Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:()=>new Promise((resolve,reject)=>{
      adversarialLockRequests.push({resolve,reject,lock:null});
    })}});
  });
}
async function grantWakeLock(page,index){
  await page.evaluate(async index=>{
    const request=adversarialLockRequests[index],lock={released:false,release:async()=>{lock.released=true;}};
    request.lock=lock;request.resolve(lock);await new Promise(resolve=>setTimeout(resolve,0));
  },index);
}
