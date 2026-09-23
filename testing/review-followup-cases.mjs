import { reveal } from './ui-navigation.mjs';
// Integration regressions from the second September 14 review. These use the
// existing shell runner and local synthetic streams, never a real microphone.
import {readFile} from 'node:fs/promises';
import {exerciseInputs} from './exercise-inputs.mjs';
const inputs=exerciseInputs(JSON.parse(await readFile(new URL('../conformance-vectors.json',import.meta.url))).poses);
async function start(page){
  await page.locator('#skipBtn').click();await page.locator('[data-t="building"]').click();await page.locator('#goBtn').click();
  await page.locator('[data-plan="first-steps"]').click();await page.locator('#planStartBtn').click();
}
async function fakeCamera(page){
  await page.evaluate(()=>{
    __testLab.realCamera();__testLab.mockModel();window.reviewTracks=[];
    window.reviewCamera=()=>{
      const c=document.createElement('canvas');c.width=640;c.height=360;
      const context=c.getContext('2d'),stream=c.captureStream(10);
      const timer=setInterval(()=>context.fillRect(0,0,640,360),100);
      for(const track of stream.getTracks()){
        reviewTracks.push(track);const stop=track.stop.bind(track);
        track.stop=()=>{clearInterval(timer);stop();};
      }
      return stream;
    };
    navigator.mediaDevices.getUserMedia=async()=>reviewCamera();
  });
}
export async function reviewFollowupCases(runCase){
  await runCase('review-speech-incomplete-bank','Missing spoken sentence parts choose the complete explicitly local utterance, or explain unavailability visually.',async(page,check)=>{
    await start(page);
    const result=await page.evaluate(()=>{
      const {coach,AudioBank}=__testLab.audioAccess();coach.reset();
      document.getElementById('voice').checked=true;
      const played=[],spoken=[];
      AudioBank.enabled=true;AudioBank.manifest=new Set(['voice/steady/num/40.mp3','voice/num/40.mp3']);
      AudioBank.play=paths=>{played.push(paths);return true;};
      window.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
      speechSynthesis.getVoices=()=>[{name:'Local test',voiceURI:'test',lang:'en-GB',localService:true}];
      speechSynthesis.speak=u=>spoken.push({text:u.text,local:u.voice.localService});
      Math.random=()=>0;
      coach.say('teach.plank',{vars:{t:40},pri:3});
      const first={played,spoken};
      coach.reset();speechSynthesis.getVoices=()=>[];
      coach.say('teach.plank',{vars:{t:40},pri:3});
      return {...first,released:!coach.speaking(),status:document.getElementById('speechStatus').textContent};
    });
    check('No incomplete recording is played',result.played,[]);
    check('Fallback preserves movement and target',result.spoken.length===1 && /plank/i.test(result.spoken[0].text) && result.spoken[0].text.includes('40'),true);
    check('Fallback voice is explicitly local',result.spoken[0]?.local,true);
    check('Unavailable fallback releases the queue',result.released,true);
    check('Unavailable local voice is explained',/Local English voice unavailable/.test(result.status),true);
  });
  await runCase('review-camera-command-race','Voice/typed routes cannot resume or advance an assessed set while camera replacement is pending.',async(page,check,capture)=>{
    await fakeCamera(page);await start(page);
    await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>{window.reviewGrant=()=>resolve(reviewCamera());});});
    await reveal(page, '#flipBtn'); await page.locator('#flipBtn').click();
    check('Touch resume is disabled during replacement',await page.locator('#resumeBtn').isDisabled(),true);
    const resumed=await page.evaluate(()=>__testLab.coachAccess().routeCoachAction('resume'));
    check('Command resume is rejected too',resumed,false);
    check('Core remains paused',await page.evaluate(()=>__testLab.coachAccess().host.core.paused),true);
    await page.evaluate(()=>__testLab.coachAccess().routeCoachAction('skip'));
    check('Coach resume cannot bypass pending replacement',await page.locator('#coachResumeBtn').isDisabled(),true);
    check('Confirmed Skip cannot unpause into replacement',await page.evaluate(()=>__testLab.coachAccess().routeCoachAction('confirm-skip')),false);
    check('No phase was advanced',await page.evaluate(()=>__testLab.coachAccess().host.core.i),0);
    await capture('pending-switch');
    await page.evaluate(()=>reviewGrant());await page.waitForFunction(()=>!document.getElementById('flipBtn').disabled);
    check('Replacement alone does not resume',await page.evaluate(()=>__testLab.coachAccess().host.core.paused),true);
    check('Explicit resume after replacement succeeds',await page.evaluate(()=>__testLab.coachAccess().routeCoachAction('resume')),true);
    check('Fresh view can now be assessed',await page.evaluate(()=>__testLab.coachAccess().host.core.paused),false);
    await page.locator('#startBtn').click();await page.locator('#endSessionBtn').click();
    check('Both streams released on End',await page.evaluate(()=>reviewTracks.every(t=>t.readyState==='ended')),true);
  });
  await runCase('review-camera-playback-failure','If replacement and original playback both fail, End remains usable but no control can resume a dead camera.',async(page,check)=>{
    await fakeCamera(page);await start(page);
    await page.evaluate(()=>{document.getElementById('cam').play=()=>Promise.reject(new DOMException('Synthetic playback failure','NotSupportedError'));});
    await reveal(page, '#flipBtn'); await page.locator('#flipBtn').click();await page.getByText('Neither camera could resume playback.',{exact:false}).waitFor();
    check('Failed playback disables Resume',await page.locator('#resumeBtn').isDisabled(),true);
    check('Command Resume cannot bypass playback failure',await page.evaluate(()=>__testLab.coachAccess().routeCoachAction('resume')),false);
    check('Failed camera leaves the core paused',await page.evaluate(()=>__testLab.coachAccess().host.core.paused),true);
    await page.locator('#endSessionBtn').click();
    check('Observed result remains accessible',await page.locator('#msg h2').innerText(),'Workout ended');
    check('Failed camera tracks released',await page.evaluate(()=>reviewTracks.every(t=>t.readyState==='ended')),true);
  });
  await runCase('review-unavailable-telemetry','Wrong or unknown view is unavailable observation, not a guided exercise.',async(page,check)=>{
    await start(page);
    for(const unknown of [false,true]){
      const frame=inputs.frame('plank');frame.sideness=unknown?null:0;frame.viewUnavailable=unknown;
      await page.evaluate(frame=>__testLab.feed(frame,1/30),frame);
      const text=await page.locator('#tel').innerText();
      check(`Unavailable view is named (${unknown})`,/unavailable|paused/i.test(text),true);
      check(`No false guided label (${unknown})`,/guided/i.test(text),false);
      check(`View blocker remains inspectable (${unknown})`,/view/i.test(text),true);
    }
  });
  await runCase('review-camera-stale-recovery','A delayed playback-recovery failure from an ended workout cannot disable Resume in a new workout.',async(page,check)=>{
    await fakeCamera(page);await start(page);
    await page.evaluate(()=>{
      const video=document.getElementById('cam');window.reviewPlay=video.play.bind(video);let calls=0;
      video.play=()=>++calls===1?Promise.reject(new DOMException('Replacement failed','NotSupportedError')):
        new Promise((_resolve,reject)=>{window.reviewRejectRecovery=()=>reject(new DOMException('Old recovery failed','NotSupportedError'));});
    });
    await reveal(page, '#flipBtn'); await page.locator('#flipBtn').click();await page.waitForFunction(()=>typeof window.reviewRejectRecovery==='function');
    await page.locator('#endSessionBtn').click();
    await page.evaluate(()=>{document.getElementById('cam').play=reviewPlay;});
    await page.locator('#againBtn').click();await page.locator('[data-plan="first-steps"]').click();await page.locator('#planStartBtn').click();
    await page.evaluate(async()=>{reviewRejectRecovery();await new Promise(resolve=>setTimeout(resolve,0));});
    await page.locator('#pauseBtn').click();
    check('Stale failure cannot disable fresh Resume',await page.locator('#resumeBtn').isEnabled(),true);
    check('Stale failure cannot reject a new command',await page.evaluate(()=>__testLab.coachAccess().routeCoachAction('resume')),true);
    check('The new core resumes',await page.evaluate(()=>__testLab.coachAccess().host.core.paused),false);
    await page.locator('#startBtn').click();await page.locator('#endSessionBtn').click();
    check('No stream leaked across the two workouts',await page.evaluate(()=>reviewTracks.every(t=>t.readyState==='ended')),true);
  });
}
