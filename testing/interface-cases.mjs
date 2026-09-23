import { reveal } from './ui-navigation.mjs';
// Feature-by-feature UI contracts in the existing shell runner. Synthetic camera
// input and Chromium viewports are not physical-phone or beginner validation.
import {readFile} from 'node:fs/promises';
import {exerciseInputs} from './exercise-inputs.mjs';
const inputs = exerciseInputs(JSON.parse(await readFile(new URL('../conformance-vectors.json',import.meta.url))).poses);
async function home(page,tier='building'){
  await page.locator('#skipBtn').click(); await page.locator(`[data-t="${tier}"]`).click(); await page.locator('#goBtn').click();
}
async function start(page){
  await home(page); await page.locator('[data-plan="first-steps"]').click(); await page.locator('#planStartBtn').click();
}
async function feed(page,seconds,frame=inputs.frame('plank')){
  await page.evaluate(({seconds,frame})=>{for(let i=0;i<seconds*30;i++)__testLab.feed(frame,1/30);},{seconds,frame});
}
export async function interfaceCases(runCase){
  for(const [name,viewport] of [['phone',{width:320,height:640}],['desktop',{width:1280,height:800}]]){
    await runCase(`ui-disclosures-${name}`,'Secondary features disclose through real controls; navigation, consent and urgent workout actions remain explicit.',async(page,check,capture)=>{
      await page.setViewportSize(viewport);
      check('Only Workouts and More occupy the idle header',await page.locator('header button:visible,header summary:visible,header input:visible').allTextContents(),['Workouts','More']);
      check('Optional preferences start collapsed',await page.locator('#welcomePreferences').evaluate(el=>el.open),false);
      await reveal(page,'#nameIn'); await page.locator('#nameIn').fill('Sam'); await capture('preferences');
      await page.locator('#welcomePreferences > summary').click();
      await page.locator('#toolsToggle').focus(); await page.keyboard.press('Enter');
      check('Keyboard opens native More disclosure',await page.locator('#toolsMenu').evaluate(el=>el.open),true);
      check('No consent granted by navigation',await page.evaluate(()=>({diagnostics:__testLab.diagnosticAccess().diagnostics.active,profile:document.getElementById('profileEnabled').checked,history:document.getElementById('rememberHistory').checked})),{diagnostics:false,profile:false,history:false});
      await capture('tools'); await page.keyboard.press('Escape');
      check('Escape closes tools and returns focus',await page.locator('#toolsToggle').evaluate(el=>el===document.activeElement&&!document.getElementById('toolsMenu').open),true);
      await home(page); await capture('workouts');
      await page.locator('#profileOpenBtn').click(); await capture('weekly-goals'); await page.locator('#profileClose').click();
      check('Closing weekly goals restores its trigger',await page.locator('#profileOpenBtn').evaluate(el=>el===document.activeElement),true);
      await page.locator('#coachMemoryBtn').click(); await capture('history'); await page.locator('#memoryClose').click();
      await page.locator('#coachSettingsBtn').click();
      check('Coach setup opens its settings instead of another closed disclosure',await page.locator('#welcomePreferences').evaluate(el=>el.open),true);
      await page.locator('#startBtn').click();
      await page.locator('[data-plan="first-steps"]').click();
      check('Detailed plan is optional; Start remains visible',await page.locator('#planDetails').evaluate(el=>!el.open)&&await page.locator('#planStartBtn').isVisible(),true);
      await reveal(page,'.planSteps'); check('Every set is still available',await page.locator('.planSteps li:not(.planRest)').count(),5);
      await page.locator('#planDetails > summary').click(); await capture('preview');
      await page.locator('#planStartBtn').click();
      check('Live essentials do not require a menu',await page.locator('#sessionControls button:visible').allTextContents(),['Pause','Skip ›','Ask coach']);
      check('Outline is not a competing workout control',await page.locator('#ghostChk').isVisible(),false);
      check('Technical readout is off by default',await page.locator('#tel').isVisible(),false);
      const before=await page.locator('#stage').boundingBox();
      await reveal(page,'#ghostChk'); await page.locator('#ghostChk').check();
      check('Tools do not resize the camera',await page.locator('#stage').boundingBox(),before);
      await feed(page,1,null); await page.locator('#telemetryToggle').check();
      check('Technical readout remains available by explicit choice',await page.locator('#tel').isVisible(),true);
      await page.locator('#telemetryToggle').uncheck();
      check('Technical readout can be dismissed again',await page.locator('#tel').isVisible(),false);
      await page.keyboard.press('Escape'); await capture('live');
      await page.locator('#askCoachBtn').click();
      check('Typed command field starts out of the way',await page.locator('#coachCommandInput').isVisible(),false);
      await reveal(page,'#coachCommandInput'); await page.locator('#coachCommandInput').fill('repeat that'); await capture('coach');
      await page.locator('#coachResumeBtn').click();
      check('Coach help returns to explicit resumed workout',await page.locator('#coachDialog').isVisible(),false);
      await page.locator('#pauseBtn').click(); await page.locator('#endSessionBtn').click(); await capture('summary');
      check('Save status is not buried with optional exports',await page.locator('#historySaveStatus').isVisible(),true);
      check('CSV is available without cluttering the summary',await page.locator('#csvDlBtn').isVisible(),false);
      await reveal(page,'#csvDlBtn'); check('CSV is revealed by a real click',await page.locator('#csvDlBtn').isVisible(),true);
    });
  }
  await runCase('ui-startup','Welcome and help open without first loading the pose library.',async(page,check,capture)=>{
    check('Welcome visible without camera',await page.locator('#calBtn').isVisible(),true);
    check('Pose module not requested before starting',await page.evaluate(()=>performance.getEntriesByType('resource').some(x=>x.name.includes('vision_bundle'))),false);
    check('Optional name has a real label',await page.getByLabel('What should I call you?',{exact:false}).count(),1);
    check('Workouts is an honest action label',await page.locator('#startBtn').textContent(),'Workouts');
    await reveal(page, '#helpBtn'); await page.locator('#helpBtn').click();
    check('Help is a modal',await page.locator('#helpDialog').evaluate(el=>el.matches(':modal')),true);
    await capture('help'); await page.keyboard.press('Escape');
    check('Escape closes help',await page.locator('#helpDialog').isVisible(),false);
    check('Focus returns to Help',await page.locator('#helpBtn').evaluate(el=>el===document.activeElement),true);
    await capture('welcome');
  });
  await runCase('ui-plan-preview','Preview lists actual expanded sets, scaled rest and the second side, without opening a camera.',async(page,check,capture)=>{
    await home(page,'strong');
    check('Unsupported Core Strength tier cannot be previewed',await page.locator('[data-plan="core-strength"]').count(),0);
    await page.locator('[data-plan="full-body"]').click();
    await reveal(page,'.planSteps');
    check('12 Strong work sets, not the four authored groups',await page.locator('.planSteps li:not(.planRest)').count(),12);
    check('11 expanded rest intervals',await page.locator('.planRest').count(),11);
    check('Scaled hold',await page.locator('.planSteps li').filter({hasText:'Plank'}).first().innerText(),'Plank\nSet 1 of 3 · 53 seconds · side view');
    check('Scaled intra-set rest',await page.locator('.planRest').first().innerText(),'Rest · 11 seconds');
    check('Camera remains closed during preview',await page.locator('#skipExBtn').isVisible(),false);
    await capture('plan-preview'); await page.locator('#planBackBtn').click();
    check('Back preserves level',await page.locator('[data-tier="strong"]').getAttribute('aria-pressed'),'true');
    await reveal(page, '[data-tier="building"]'); await page.locator('[data-tier="building"]').click();await page.locator('[data-plan="core-strength"]').click();
    await reveal(page,'.planSteps');
    check('Core Strength has eight supported Building sets',await page.locator('.planSteps li:not(.planRest)').count(),8);
    check('Second side is still explicitly named',await page.locator('.planSteps').innerText().then(x=>x.includes('Other side')),true);
    await capture('second-side-preview');
  });
  for(const [name,viewport] of [['small',{width:320,height:640}],['portrait',{width:390,height:844}],['landscape',{width:844,height:390}],['desktop',{width:1280,height:800}]]){
    await runCase(`ui-layout-${name}`,'Welcome, plans, help and workout controls remain reachable in a constrained viewport.',async(page,check,capture)=>{
      await page.setViewportSize(viewport);
      const reachable=async selector=>page.locator(selector).evaluate(el=>{
        const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
        return r.width>=44&&r.height>=44&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&el.contains(hit);
      });
      await page.locator('#skipBtn').scrollIntoViewIfNeeded();
      check('Primary onboarding escape reachable',await reachable('#skipBtn'),true); await capture('welcome');
      await home(page); await capture('workouts');
      await page.locator('[data-plan="first-steps"]').click();
      await page.locator('#planStartBtn').scrollIntoViewIfNeeded();
      check('Preview start is reachable by scrolling',await reachable('#planStartBtn'),true); await capture('preview');
      await page.locator('#planStartBtn').click(); await feed(page,3,null);
      check('Current movement is named',await page.locator('#movementName').innerText(),'Plank');
      check('Next movement is named',await page.locator('#movementNext').innerText().then(x=>x.includes('Glute Bridge')),true);
      for(const id of ['pauseBtn','skipExBtn','startBtn','toolsToggle'])check(`${id} touch target`,await reachable('#'+id),true);
      await reveal(page,'#helpBtn'); check('Help touch target in More',await reachable('#helpBtn'),true);
      await page.keyboard.press('Escape');
      await capture('live'); await page.locator('#pauseBtn').click();
      check('Pause dialog fits and Resume is reachable',await reachable('#resumeBtn'),true); await capture('paused');
      await page.locator('#endSessionBtn').click();
      check('Early end is not labelled completion',await page.locator('#msg h2').innerText(),'Workout ended');
      await page.locator('#againBtn').scrollIntoViewIfNeeded(); check('Debrief exit reachable',await reachable('#againBtn'),true); await capture('debrief');
    });
  }
  await runCase('ui-pause-resume','Pause freezes counts, blocks Skip, survives Escape and resumes without hidden credit.',async(page,check,capture)=>{
    await start(page); await feed(page,5);
    const before=await page.evaluate(()=>__testLab.snapshot());
    await page.locator('#pauseBtn').click(); await feed(page,10);
    check('Held time freezes',await page.evaluate(()=>__testLab.snapshot().held),before.held);
    check('No paused score samples',await page.evaluate(()=>__testLab.snapshot().scoreN),before.scoreN);
    await page.keyboard.press('s'); await page.keyboard.press('Escape');
    check('Escape does not resume into a pose',await page.locator('#sessionDialog').isVisible(),true);
    check('S cannot skip behind a modal',await page.evaluate(()=>__testLab.snapshot().index),before.index);
    await capture('pause'); await page.locator('#resumeBtn').click(); await feed(page,1);
    check('Observed work resumes',await page.evaluate(()=>__testLab.snapshot().held)>before.held,true);
    await page.locator('#startBtn').click(); await page.locator('#endSessionBtn').click();
    const after=await page.evaluate(()=>__testLab.snapshot().finish);
    check('Ending retains observed hold',after.bestHold>before.held,true);
    check('Current stopped set is not given a verdict',after.out[0].score,null);
    check('Unstarted sets are not marked skipped',after.out.length,1);
  });
  await runCase('ui-background','A simulated visibility interruption freezes session/rest and requires explicit resume.',async(page,check)=>{
    await start(page); await feed(page,4); await page.locator('#skipExBtn').click();
    const before=await page.locator('#big').innerText();
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true}); document.dispatchEvent(new Event('visibilitychange'));});
    await feed(page,10,null); check('Rest clock frozen',await page.locator('#big').innerText(),before);
    check('Background shows paused state',await page.locator('#sessionDialog').isVisible(),true);
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false}); document.dispatchEvent(new Event('visibilitychange'));});
    check('Returning does not auto-resume',await page.locator('#sessionDialog').isVisible(),true);
    await page.locator('#resumeBtn').click(); await feed(page,1,null);
    check('Rest continues only after consent',await page.locator('#big').innerText()!==before,true);
  });
  await runCase('ui-calibration-interruption','A background break offers a fresh check or observed result, never a resumed continuous hold.',async(page,check)=>{
    await page.locator('#calBtn').click(); await feed(page,7);
    const before=await page.evaluate(()=>__testLab.snapshot().held);
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true}); document.dispatchEvent(new Event('visibilitychange'));});
    await feed(page,10); check('Calibration freezes',await page.evaluate(()=>__testLab.snapshot().held),before);
    check('Resume cannot merge bouts',await page.locator('#resumeBtn').textContent(),'Restart plank check');
    await page.locator('#endSessionBtn').click();
    check('Observed result retained',await page.evaluate(()=>__testLab.snapshot().calibration.held),before);
  });
  await runCase('ui-finish-speech-navigation','Navigating away invalidates delayed debrief speech.',async(page,check)=>{
    await start(page);
    await page.evaluate(()=>{window.uiRaw=[];const {coach}=__testLab.audioAccess();coach.raw=(...a)=>uiRaw.push(a);document.getElementById('voice').checked=true;});
    while(!await page.evaluate(()=>__testLab.snapshot().done))await page.locator('#skipExBtn').click();
    await page.locator('#againBtn').click(); await page.waitForTimeout(700);
    check('No delayed debrief speech on home',await page.evaluate(()=>uiRaw.length),0);
  });
  // These use the production acquisition handlers, with local canvas tracks.
  // No hardware permission, physical lens switching or inference is simulated.
  async function fakeCamera(page){
    await page.evaluate(()=>{
      __testLab.realCamera(); __testLab.mockModel();
      window.mediaAudit={opened:0,stopped:0};
      window.makeCamera=()=>{
        mediaAudit.opened++;
        const c=document.createElement('canvas'); c.width=640;c.height=360;
        const ctx=c.getContext('2d'),s=c.captureStream(10);
        const timer=setInterval(()=>ctx.fillRect(0,0,640,360),100);
        for(const t of s.getTracks()){
          const stop=t.stop.bind(t);let stopped=false;
          t.stop=()=>{if(!stopped){stopped=true;clearInterval(timer);mediaAudit.stopped++;stop();}};
        }
        return s;
      };
      navigator.mediaDevices.getUserMedia=async()=>makeCamera();
    });
  }
  await runCase('ui-camera-cancel','Cancel escapes a pending permission request and releases a late grant without reopening the UI.',async(page,check)=>{
    await fakeCamera(page);
    await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>{window.grantCamera=()=>resolve(makeCamera());});});
    await page.locator('#calBtn').click(); await page.locator('#cancelCameraBtn').waitFor();
    check('Duplicate startup blocked',await page.locator('#startBtn').isDisabled(),true);
    check('Startup cannot finish behind a Help modal',await page.locator('#helpBtn').isDisabled(),true);
    await page.locator('#cancelCameraBtn').click();
    check('Cancel returns to workouts',await page.locator('.plancard').count()>0,true);
    check('Help is available again after Cancel',await page.locator('#helpBtn').isEnabled(),true);
    await page.evaluate(()=>grantCamera()); await page.waitForFunction(()=>mediaAudit.stopped===1);
    check('Late grant is released',await page.evaluate(()=>mediaAudit),{opened:1,stopped:1});
    check('No late camera chrome',await page.locator('#skipExBtn').isVisible(),false);
    check('No retained cancelled stream',await page.locator('#cam').evaluate(v=>v.srcObject===null),true);
  });
  await runCase('ui-camera-flip-failure','A failed camera switch keeps the original stream and core, with explicit recovery.',async(page,check)=>{
    await fakeCamera(page); await start(page); await reveal(page, '#flipBtn'); await page.locator('#flipBtn').waitFor();
    await page.evaluate(()=>{window.originalCamera=document.getElementById('cam').srcObject;
      navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Unavailable lens','NotReadableError');};});
    await reveal(page, '#flipBtn'); await page.locator('#flipBtn').click();
    await page.getByText('Couldn’t switch cameras.',{exact:false}).waitFor();
    check('Original stream remains live',await page.evaluate(()=>document.getElementById('cam').srcObject===originalCamera && originalCamera.getVideoTracks()[0].readyState==='live'),true);
    check('No measured work discarded',await page.evaluate(()=>__testLab.snapshot().done),false);
    await page.locator('#resumeBtn').click(); check('Can resume original camera',await page.locator('#sessionDialog').isVisible(),false);
    await page.evaluate(()=>{
      navigator.mediaDevices.getUserMedia=async()=>makeCamera();
      const v=document.getElementById('cam'),play=v.play.bind(v);let first=true;
      v.play=()=>{if(first){first=false;return Promise.reject(new DOMException('Replacement playback failed','NotSupportedError'));}return play();};
    });
    await reveal(page, '#flipBtn'); await page.locator('#flipBtn').click(); await page.waitForFunction(()=>!document.getElementById('flipBtn').disabled);
    check('Playback failure restores a playing original stream',await page.evaluate(()=>{
      const v=document.getElementById('cam'); return v.srcObject===originalCamera && !v.paused;
    }),true);
    check('Failed replacement released',await page.evaluate(()=>mediaAudit),{opened:2,stopped:1});
    await page.locator('#resumeBtn').click();
    await page.locator('#startBtn').click(); await page.locator('#endSessionBtn').click();
    check('Original track released on End',await page.evaluate(()=>mediaAudit),{opened:2,stopped:2});
  });
  await runCase('ui-camera-late-flip','Ending while a camera switch is pending cannot leak a late stream or reopen a finished session.',async(page,check)=>{
    await fakeCamera(page); await start(page); await reveal(page, '#flipBtn'); await page.locator('#flipBtn').waitFor();
    await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>{window.grantCamera=()=>resolve(makeCamera());});});
    await reveal(page, '#flipBtn'); await page.locator('#flipBtn').click();
    check('Pending camera switch cannot resume into a changing view',await page.locator('#resumeBtn').isDisabled(),true);
    await page.locator('#endSessionBtn').click();
    await page.evaluate(()=>grantCamera()); await page.waitForFunction(()=>mediaAudit.stopped===2);
    check('Both tracks released',await page.evaluate(()=>mediaAudit),{opened:2,stopped:2});
    check('Debrief remains visible',await page.locator('#msg h2').innerText(),'Workout ended');
    check('Late switch cannot reattach a camera',await page.locator('#cam').evaluate(v=>v.srcObject===null),true);
  });
}
