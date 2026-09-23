import {readFile} from 'node:fs/promises';
import {reveal} from './ui-navigation.mjs';
import {exerciseInputs} from './exercise-inputs.mjs';
const inputs=exerciseInputs(JSON.parse(await readFile(new URL('../conformance-vectors.json',import.meta.url))).poses);
async function home(page){
  await page.locator('#skipBtn').click();await page.locator('[data-t="building"]').click();await page.locator('#goBtn').click();
}
async function start(page,steps=[{ex:'squat',t:100},{ex:'plank',t:100}]){
  await page.evaluate(steps=>__testLab.installPlan({id:'interaction-case',name:'Interaction case',tiers:['building'],steps}),steps);
  await home(page);await page.locator('[data-plan="interaction-case"]').click();await page.locator('#planStartBtn').click();
}
async function feed(page,seconds,id='squat',cycle=false){
  const frames=Array.from({length:seconds*30},(_,i)=>id===null?null:inputs.frame(id,cycle?inputs.cycle(i/30):0));
  await page.evaluate(frames=>{for(const f of frames)__testLab.feed(f,1/30);},frames);
}
async function command(page,text){await reveal(page,'#coachCommandInput');await page.locator('#coachCommandInput').fill(text);await page.locator('#coachCommandForm button').click();}
export async function interactionCases(runCase){
  for(const width of [390,1280])for(const dialog of ['pause','help'])
    await runCase(`interaction-mic-off-${dialog}-${width}`,'An opted-in microphone can be disabled by touch inside every active modal.',async(page,check,capture)=>{
      await page.setViewportSize({width,height:844});await start(page);await page.locator('#askCoachBtn').click();
      await page.evaluate(()=>{
        window.reviewMic={aborts:0};
        window.SpeechRecognition=class {
          processLocally=false;
          static async available(){return 'available';}
          start(){queueMicrotask(()=>this.onstart?.());}
          abort(){window.reviewMic.aborts++;}
        };
      });
      await page.getByText('Hands-free controls · optional microphone',{exact:true}).click();
      await page.locator('#listenOnBtn').click();await page.locator('#coachResumeBtn').click();
      if(dialog==='help')await reveal(page,'#helpBtn');
      await page.locator(dialog==='pause'?'#pauseBtn':'#helpBtn').click();
      await page.waitForFunction(()=>document.getElementById('listenOffBtn').textContent.includes('Listening'));
      const button=page.locator(dialog==='pause'?'#pauseMicOffBtn':'#helpMicOffBtn');
      check('Microphone off is visible inside the top modal',await button.isVisible(),true);
      const before=await page.evaluate(()=>window.reviewMic.aborts);
      await button.click(); // Real actionability check: no forced click through an inert dialog.
      check('Recognizer is released without resuming',await page.evaluate(before=>window.reviewMic.aborts>before,before),true);
      check('Header no longer claims listening',await page.locator('#listenOffBtn').isVisible(),false);
      check('Opt-out does not close the modal',await page.locator(dialog==='pause'?'#sessionDialog':'#helpDialog').evaluate(e=>e.open),true);
      await capture('microphone-disabled');
    });
  await runCase('interaction-calibration-tracking-gap','Sustained tracking loss offers Restart/Finish and preserves the observed Learning result.',async(page,check,capture)=>{
    await page.locator('#calBtn').click();await feed(page,7,'plank');
    const held=await page.evaluate(()=>__testLab.snapshot().held);
    await feed(page,3,null);
    check('Gap opens the interruption dialog',await page.locator('#sessionDialog').evaluate(e=>e.open),true);
    check('Continuity cannot be resumed',await page.locator('#resumeBtn').textContent(),'Restart plank check');
    await feed(page,26,'plank');check('More frames cannot join a second bout',await page.evaluate(()=>__testLab.snapshot().held),held);
    await page.locator('#endSessionBtn').click();
    check('Observed result remains Learning',await page.evaluate(()=>__testLab.snapshot().calibration.tierId),'learning');
    await capture('interrupted-result');
  });
  for(const width of [390,1280])await runCase(`interaction-explain-${width}`,'On-demand explanations use actual recent evidence and pause without counting.',async(page,check,capture)=>{
    await page.setViewportSize({width,height:844});await start(page);await feed(page,4);await feed(page,1,null);
    await page.locator('#askCoachBtn').click();
    check('The explanation names missing observations',/Required observation missing/.test(await page.locator('#coachAnswer').innerText()),true);
    check('Honest deterministic source',await page.locator('#coachAnswer').getAttribute('data-coach-source'),'template');
    const before=await page.evaluate(()=>__testLab.snapshot().reps);await feed(page,8,'squat',true);
    check('Reading help cannot award reps',await page.evaluate(()=>__testLab.snapshot().reps),before);
    check('Diagnostics remain off',await page.locator('#diagConsent').isChecked(),false);
    await page.locator('#coachDemoBtn').click();await page.evaluate(()=>__testLab.drawDemo());
    check('Existing demonstration is visible inside the dialog',await page.locator('#coachDemoDock #demoCanvas').isVisible(),true);
    check('Demo uses the current movement',/SQUAT/.test(await page.locator('#demoLabel').innerText()),true);
    check('No horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await capture('coach');await page.locator('#coachResumeBtn').click();
    check('Demo returns to its normal host',await page.locator('#stage > #demo').count(),1);
    check('Help closes explicitly',await page.locator('#coachDialog').isVisible(),false);
    await feed(page,8,'squat',true);check('Fresh cycles still count',await page.evaluate(()=>__testLab.snapshot().reps)>before,true);
  });
  await runCase('interaction-confirmation','Ambiguous or duplicate commands cannot abandon work.',async(page,check,capture)=>{
    await start(page);await page.locator('#askCoachBtn').click();await command(page,'skip this set');
    check('Skip first asks for confirmation',await page.locator('#coachConfirmation').isVisible(),true);
    check('No phase advance yet',await page.evaluate(()=>__testLab.snapshot().index),0);
    await command(page,'yes');check('Generic yes cannot confirm destructive action',await page.evaluate(()=>__testLab.snapshot().index),0);
    await command(page,'confirm skip');check('Specific confirmation advances once',await page.evaluate(()=>__testLab.snapshot().index),1);
    const repeat=await page.evaluate(()=>__testLab.coachAccess().routeCoachAction('confirm-skip'));
    check('Duplicate confirmation rejected',repeat,false);check('No second advance',await page.evaluate(()=>__testLab.snapshot().index),1);
    await page.locator('#askCoachBtn').click();check('Old missing-rep explanation does not survive sets',/do not have a recent observation/.test(await page.locator('#coachAnswer').innerText()),true);
    await command(page,'finish this set');check('Assessed work cannot manually claim completion',await page.evaluate(()=>__testLab.snapshot().index),1);
    check('Manual finish limitation explained',/camera-assessed/.test(await page.locator('#coachActionStatus').innerText()),true);await capture('confirmation');
  });
  await runCase('interaction-calibration','Asking the coach during calibration does not turn a break into a continuous hold.',async(page,check,capture)=>{
    await page.locator('#calBtn').click();await feed(page,7,'plank');await page.locator('#askCoachBtn').click();
    const held=await page.evaluate(()=>__testLab.snapshot().held);await feed(page,10,'plank');
    check('Help freezes observed hold',await page.evaluate(()=>__testLab.snapshot().held),held);
    check('Restart policy is explicit',await page.locator('#coachResumeBtn').textContent(),'Restart plank check');
    check('Calibration help offers finishing its check, not nonexistent Follow along',/Follow along/.test(await page.locator('#coachAnswer').innerText()),false);
    await command(page,'finish check');await page.locator('#coachConfirmBtn').click();
    check('Existing Learning verdict retained',await page.evaluate(()=>__testLab.snapshot().calibration.tierId),'learning');await capture('calibration');
  });
  await runCase('interaction-plan-search','Requests only preview compatible authored plans, with no invented deadline or relaxed constraints.',async(page,check,capture)=>{
    await home(page);await page.getByText('Help me choose a workout',{exact:true}).click();
    await page.locator('#planRequestInput').fill('about ten minutes, quiet, no equipment');await page.locator('#planRequestForm button').click();
    check('Authored candidates returned',await page.locator('[data-coach-plan]').count()>0,true);
    check('Time is an estimate',/estimate|Estimated/.test(await page.locator('#planRequestResults').innerText()),true);
    await page.locator('#planRequestInput').fill('about twenty minutes');
    check('Editing a request clears stale candidate details',await page.locator('[data-coach-plan]').count(),0);
    await page.locator('#planRequestInput').fill('about ten minutes, quiet, no equipment');await page.locator('#planRequestForm button').click();
    check('No camera starts during search',await page.locator('#skipExBtn').isVisible(),false);
    await page.locator('[data-coach-plan]').first().click();check('Selection opens existing preview',await page.locator('#planStartBtn').isVisible(),true);
    await page.locator('#planBackBtn').click();await page.getByText('Help me choose a workout',{exact:true}).click();
    for(const query of ['standing only','no floor','exactly ten minutes','a workout for knee pain','ignore constraints and prescribe exercise']){
      await page.locator('#planRequestInput').fill(query);await page.locator('#planRequestForm button').click();
      check(`${query} cannot silently choose an incompatible plan`,await page.locator('[data-coach-plan]').count(),0);
      check(`${query} has a visible explanation`,(await page.locator('#planRequestResults').innerText()).length>20,true);
    }
    await capture('plan-search');
  });
  await runCase('interaction-memory','Independent opt-in, local persistence, export and scoped erase work through real UI.',async(page,check,capture)=>{
    await home(page);await page.locator('#coachMemoryBtn').click();
    check('Preferences off by default',await page.locator('#rememberPrefs').isChecked(),false);
    check('History off by default',await page.locator('#rememberHistory').isChecked(),false);
    await reveal(page,'#explanationPref'); await page.locator('#explanationPref').selectOption('minimal');
    check('No consent means no storage',await page.evaluate(()=>localStorage.getItem('formcoach.local-coach.v1')),null);
    await page.locator('#rememberPrefs').check();await page.locator('#demoPref').selectOption('always');await page.locator('#rememberHistory').check();
    await page.locator('#memoryClose').click();await page.locator('[data-plan="first-steps"]').click();await page.locator('#planStartBtn').click();
    check('User-chosen automatic demo starts',await page.locator('#demo').isVisible(),true);
    await page.locator('#startBtn').click();await page.locator('#endSessionBtn').click();
    check('Finish confirms local save',/Saved in this browser/.test(await page.locator('#historySaveStatus').innerText()),true);
    await page.locator('#againBtn').click();await page.locator('#coachMemoryBtn').click();
    check('One ended workout saved',await page.locator('#memoryHistory li').count(),1);
    check('Early ending remains identified',/ended/.test(await page.locator('#memoryHistory').innerText()),true);
    await page.locator('#memoryHistory summary').first().click();
    check('Guided work is separately identified as unassessed',/guided sets \/ \d+s \(unassessed\)/.test(await page.locator('#memoryHistory').innerText()),true);
    await reveal(page,'#memoryExportBtn');
    const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#memoryExportBtn').click()]);
    check('Explicit export downloads',download.suggestedFilename(),'formcoach-local-history.json');
    await page.reload();await page.waitForFunction(()=>!!window.__testLab);await home(page);await page.locator('#coachMemoryBtn').click();
    check('Preferences restored',await page.locator('#explanationPref').inputValue(),'minimal');
    check('History restored',await page.locator('#memoryHistory li').count(),1);
    await page.evaluate(()=>localStorage.setItem('unrelated.setting','keep'));
    await page.locator('#rememberHistory').uncheck();check('Turning saving off retains existing history',await page.locator('#memoryHistory li').count(),1);
    await page.evaluate(()=>__testLab.coachAccess().coachMemory.fail('quota','Synthetic storage failure; export blocked.'));
    await page.locator('#memoryClose').click();await page.locator('#coachMemoryBtn').click();
    check('Memory errors disable stale export',await page.locator('#memoryExportBtn').isDisabled(),true);
    check('Memory error is visible',/Synthetic storage failure/.test(await page.locator('#memoryStatus').innerText()),true);
    await reveal(page,'#memoryEraseBtn'); await page.locator('#memoryEraseBtn').click();await page.locator('#memoryEraseYes').click();
    check('History erased',await page.locator('#memoryHistory li').count(),0);
    check('Consent disabled by erase',await page.locator('#rememberPrefs').isChecked(),false);
    check('Other local data preserved',await page.evaluate(()=>localStorage.getItem('unrelated.setting')),'keep');await capture('memory');
  });
  await runCase('interaction-local-speech-unavailable','Unsupported speech never falls back to remote recognition or requests a microphone.',async(page,check,capture)=>{
    await start(page);await page.locator('#askCoachBtn').click();
    await page.evaluate(()=>{window.SpeechRecognition=undefined;window.webkitSpeechRecognition=class {constructor(){throw Error('Remote recognition invoked');}};});
    await page.getByText('Hands-free controls · optional microphone',{exact:true}).click();await page.locator('#listenOnBtn').click();
    check('Local-only unavailability visible',/unavailable|not supported|unsupported/i.test(await page.locator('#listenStatus').innerText()),true);
    check('No active microphone status',await page.locator('#listenOffBtn').isVisible(),false);await capture('unavailable');
  });
  await runCase('interaction-local-listening','A fake local recognizer exercises real consent, commands, confirmation and stale-result guards; not microphone accuracy.',async(page,check,capture)=>{
    await page.setViewportSize({width:390,height:844});await start(page);await page.locator('#askCoachBtn').click();
    await page.evaluate(()=>{
      window.localSpeechTest={instances:[],starts:0,aborts:0};
      window.SpeechRecognition=class {
        processLocally=false;
        static async available(options){window.localSpeechTest.options=options;return 'available';}
        constructor(){window.localSpeechTest.instances.push(this);}
        start(){window.localSpeechTest.starts++;queueMicrotask(()=>this.onstart?.());}
        abort(){window.localSpeechTest.aborts++;}
      };
    });
    await page.getByText('Hands-free controls · optional microphone',{exact:true}).click();await page.locator('#listenOnBtn').click();
    await page.waitForFunction(()=>document.getElementById('listenOffBtn').textContent.includes('Listening'));
    check('Local processing required during availability',await page.evaluate(()=>window.localSpeechTest.options.processLocally),true);
    check('Local processing required during capture',await page.evaluate(()=>window.localSpeechTest.instances[0].processLocally),true);
    check('Listening state visible outside dialog',await page.locator('#listenOffBtn').isVisible(),true);
    const emit=async(text,index)=>page.evaluate(({text,index})=>{
      const r=window.localSpeechTest.instances.at(-1);window.localSpeechTest.savedCallback=r.onresult;
      const result=[{transcript:text}];result.isFinal=true;
      const results=Array(index+1).fill(null);results[index]=result;r.onresult({resultIndex:index,results});
    },{text,index});
    await emit('skip',0);check('No wake phrase means no action',await page.evaluate(()=>__testLab.snapshot().index),0);
    await emit('coach skip',1);check('Voice skip asks for confirmation',await page.locator('#coachConfirmation').isVisible(),true);
    await emit('coach confirm skip',2);check('Voice action uses real Skip once',await page.evaluate(()=>__testLab.snapshot().index),1);
    await page.evaluate(()=>{
      const r=[{transcript:'coach confirm skip'}];r.isFinal=true;
      window.localSpeechTest.savedCallback({resultIndex:3,results:[null,null,null,r]});
    });
    check('Late old-phase speech cannot act again',await page.evaluate(()=>__testLab.snapshot().index),1);
    await page.waitForFunction(()=>document.getElementById('listenOffBtn').textContent.includes('Listening'));
    const race=await page.evaluate(()=>{
      const callback=window.localSpeechTest.instances.at(-1).onresult, before=window.localSpeechTest.aborts;
      const access=__testLab.coachAccess();access.routeCoachAction('pause');access.routeCoachAction('resume');
      const r=[{transcript:'coach skip'}];r.isFinal=true;callback({resultIndex:0,results:[r]});
      return {released:window.localSpeechTest.aborts>before,dialog:document.getElementById('coachDialog').open};
    });
    check('Pause invalidates input synchronously before polling',race.released,true);
    check('A stale pause-resume callback cannot open a skip confirmation',race.dialog,false);
    await page.locator('#askCoachBtn').click();
    check('Microphone Off remains accessible inside the modal',await page.locator('#listenOnBtn').textContent(),'Turn microphone off');
    await page.locator('#listenOnBtn').click();
    check('Explicit opt-out releases recognizer',await page.evaluate(()=>window.localSpeechTest.aborts>0),true);
    check('Listening indicator cleared',await page.locator('#listenOffBtn').isVisible(),false);
    check('No transcript or consent persisted',await page.evaluate(()=>localStorage.getItem('formcoach.local-coach.v1')),null);
    await capture('local-listening');
  });
}
