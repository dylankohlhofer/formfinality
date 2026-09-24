import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { exerciseInputs } from './exercise-inputs.mjs';
import { reveal } from './ui-navigation.mjs';

async function camera(page) {
  await page.evaluate(() => {
    __testLab.realCamera(); __testLab.mockModel(); window.lossStreams = [];
    window.lossCamera = async () => {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
      const context = canvas.getContext('2d'), stream = canvas.captureStream(10);
      const timer = setInterval(() => context.fillRect(0,0,640,360),100);
      for (const track of stream.getTracks()) {
        const stop = track.stop.bind(track);
        track.stop = () => { clearInterval(timer); stop(); };
      }
      lossStreams.push(stream); return stream;
    };
    navigator.mediaDevices.getUserMedia = lossCamera;
  });
}
async function start(page) {
  await page.locator('#skipBtn').click(); await page.locator('[data-t="building"]').click();
  await page.locator('#goBtn').click(); await page.locator('[data-plan="first-steps"]').click();
  await page.locator('#planStartBtn').click(); await page.locator('#pauseBtn').waitFor();
}
async function disconnect(page, event = true) {
  await page.evaluate(event => {
    const track = document.getElementById('cam').srcObject.getVideoTracks()[0];
    track.stop(); if(event) track.dispatchEvent(new Event('ended'));
  }, event);
  await page.locator('#restartCameraBtn').waitFor();
}
async function recoveryChecks(page, check) {
  check('Camera loss has a specific heading',await page.locator('#sessionDialogTitle').innerText(),'Camera disconnected');
  check('Assessment pauses',await page.evaluate(() => __testLab.coachAccess().host.core.paused),true);
  check('Dead camera is detached',await page.locator('#cam').evaluate(v => v.srcObject === null),true);
  check('Resume cannot bypass restart',await page.locator('#resumeBtn').isDisabled(),true);
  check('Typed Resume cannot bypass restart',await page.evaluate(() => __testLab.coachAccess().routeCoachAction('resume')),false);
}

export async function cameraLossCases(runCase, root) {
  for(const when of ['before-play','pending-play']) await runCase(`camera-loss-startup-${when}`,
    'An ended camera during startup gives a recoverable camera error without creating a workout.',async(page,check) => {
      await camera(page);
      await page.evaluate(when => {
        if(when === 'before-play') navigator.mediaDevices.getUserMedia = async () => {
          const stream = await lossCamera(); stream.getTracks().forEach(t=>t.stop()); return stream;
        };
        else document.getElementById('cam').play = () => new Promise(resolve => { window.lossResolve = resolve; });
      },when);
      await page.locator('#calBtn').click();
      if(when === 'pending-play'){
        await page.waitForFunction(() => !!window.lossResolve);
        await page.evaluate(() => { const t=lossStreams[0].getVideoTracks()[0]; t.stop(); t.dispatchEvent(new Event('ended')); });
      }
      await page.getByRole('heading',{name:'Camera unavailable'}).waitFor();
      if(when === 'pending-play') await page.evaluate(async () => { lossResolve(); await new Promise(ok=>setTimeout(ok,0)); });
      check('Camera error retains Back navigation',await page.locator('#backBtn').isVisible(),true);
      check('Startup loss releases camera',await page.locator('#cam').evaluate(v=>v.srcObject===null),true);
      check('No calibration starts from an ended stream',await page.evaluate(() => __testLab.coachAccess().host===null),true);
    });
  await runCase('camera-loss-recorder','An interrupted reference recording does not save an incomplete demo or leave live controls.',async(page,check) => {
    await camera(page);
    await page.evaluate(() => __testLab.referenceAccess().record('squat'));
    await page.locator('#skipExBtn').waitFor();
    await page.evaluate(() => { const t=lossStreams[0].getVideoTracks()[0]; t.stop(); t.dispatchEvent(new Event('ended')); });
    check('Recording loss returns to workouts',await page.locator('#startBtn').innerText(),'Workouts');
    check('Incomplete recording is explicitly not saved',/incomplete demo was not saved/.test(await page.locator('#msgInner').innerText()),true);
    check('No incomplete reference saved',await page.evaluate(() => !!__testLab.referenceAccess().store.refs.squat),false);
    check('Recorder camera released',await page.locator('#cam').evaluate(v=>v.srcObject===null),true);
  });
  for(const event of [true,false]) await runCase(`camera-loss-${event ? 'event' : 'poll'}`,
    'An ended camera pauses, detaches, and requires successful restart plus explicit Resume.',async(page,check) => {
      await camera(page); await start(page);
      const before = await page.evaluate(() => {
        window.lossCore = __testLab.coachAccess().host.core;
        return {out:lossCore.out,scoreN:lossCore.scoreN};
      });
      await disconnect(page,event); await recoveryChecks(page,check);
      const calls = await page.evaluate(() => __testModelCalls);
      await page.waitForTimeout(250);
      check('No inference after disconnect',await page.evaluate(() => __testModelCalls),calls);
      await page.locator('#restartCameraBtn').click();
      await page.waitForFunction(() => !document.getElementById('resumeBtn').disabled);
      check('Restart preserves the same workout',await page.evaluate(() => __testLab.coachAccess().host.core === lossCore),true);
      check('Restart waits for explicit Resume',await page.evaluate(() => lossCore.paused),true);
      check('Interrupted time adds no observations',await page.evaluate(() => ({out:lossCore.out,scoreN:lossCore.scoreN})),before);
      await page.locator('#resumeBtn').click();
      check('Explicit Resume unpauses',await page.evaluate(() => lossCore.paused),false);
      await page.locator('#pauseBtn').click(); await page.locator('#endSessionBtn').click();
      check('End releases original and restarted cameras',await page.evaluate(() => lossStreams.map(s => s.getVideoTracks()[0].readyState)),['ended','ended']);
    });
  await runCase('camera-loss-retry','Failed reconnection keeps observations, offers retry, and remains endable.',async(page,check) => {
    await camera(page); await start(page); await disconnect(page);
    await page.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied','NotAllowedError'); }; });
    await page.locator('#restartCameraBtn').click();
    await page.waitForFunction(() => !document.getElementById('restartCameraBtn').disabled);
    check('Retry failure is explained',/could not reconnect/.test(await page.locator('#sessionDialogCopy').innerText()),true);
    await recoveryChecks(page,check);
    await page.evaluate(() => { navigator.mediaDevices.getUserMedia = lossCamera; });
    await page.locator('#restartCameraBtn').click();
    await page.waitForFunction(() => !document.getElementById('resumeBtn').disabled);
    await page.locator('#endSessionBtn').click();
    check('Paused reconnected workout can end',await page.locator('#msg h2').innerText(),'Workout ended');
  });
  for(const pending of ['permission','playback']) await runCase(`camera-loss-end-${pending}`,
    'End while reconnecting releases late streams and prevents a stale camera from reviving the workout.',async(page,check) => {
      await camera(page); await start(page); await disconnect(page);
      await page.evaluate(pending => {
        if(pending === 'permission') navigator.mediaDevices.getUserMedia = () => new Promise(resolve => { window.lossResolve = async () => resolve(await lossCamera()); });
        else document.getElementById('cam').play = () => new Promise(resolve => { window.lossResolve = resolve; });
      },pending);
      await page.locator('#restartCameraBtn').click();
      await page.waitForFunction(() => !!window.lossResolve);
      await page.locator('#endSessionBtn').click();
      await page.evaluate(async () => { await lossResolve(); await new Promise(resolve => setTimeout(resolve,0)); });
      check('Ended summary remains visible',await page.locator('#msg h2').innerText(),'Workout ended');
      check('All tracks released after stale reconnect',await page.evaluate(() => lossStreams.every(s => s.getTracks().every(t => t.readyState === 'ended'))),true);
      check('Late reconnect cannot attach camera',await page.locator('#cam').evaluate(v => v.srcObject === null),true);
      check('Late reconnect cannot open a pause dialog',await page.locator('#sessionDialog').isVisible(),false);
    });
  await runCase('camera-loss-switch','Loss during pending camera switch releases both streams and keeps restart available.',async(page,check) => {
    await camera(page); await start(page);
    await page.evaluate(() => { document.getElementById('cam').play = () => new Promise(resolve => { window.lossResolve = resolve; }); });
    await reveal(page,'#flipBtn'); await page.locator('#flipBtn').click();
    await page.waitForFunction(() => !!window.lossResolve);
    await disconnect(page); await recoveryChecks(page,check);
    await page.evaluate(async () => { lossResolve(); await new Promise(resolve => setTimeout(resolve,0)); });
    check('Both switch streams released',await page.evaluate(() => lossStreams.map(s => s.getVideoTracks()[0].readyState)),['ended','ended']);
    check('Stale switch cannot enable Resume',await page.locator('#resumeBtn').isDisabled(),true);
    await page.locator('#endSessionBtn').click();
  });
  const poses = JSON.parse(await readFile(resolve(root,'conformance-vectors.json'))).poses;
  const plank = exerciseInputs(poses).frame('plank');
  for(const choice of ['finish','restart']) await runCase(`camera-loss-calibration-${choice}`,
    'Interrupted calibration preserves only the observed hold; restart creates a fresh check.',async(page,check) => {
      await camera(page); await page.locator('#calBtn').click(); await page.locator('#skipExBtn').waitFor();
      const observed = await page.evaluate(frame => {
        for(let i=0;i<240;i++) __testLab.feed(frame,1/30);
        window.lossCore = __testLab.coachAccess().host.core;
        return lossCore.ev.hold;
      },plank);
      check('Fixture actually observes a short hold',observed > 3 && observed < 10,true);
      await disconnect(page); await recoveryChecks(page,check);
      if(choice === 'finish') {
        await page.locator('#endSessionBtn').click();
        const verdict = await page.evaluate(() => __testLab.snapshot().calibration);
        check('Observed short hold produces Learning',verdict?.tierId,'learning');
        check('Verdict retains exactly the observed hold',verdict?.held,observed);
      } else {
        await page.locator('#restartCameraBtn').click(); await page.locator('#skipExBtn').waitFor();
        await page.waitForFunction(() => !!__testLab.coachAccess().host?.core && __testLab.coachAccess().host.core !== lossCore);
        check('Fresh check does not join the old hold',await page.evaluate(() => __testLab.coachAccess().host.core.t),0);
        await page.locator('#startBtn').click(); await page.locator('#endSessionBtn').click();
      }
      check('Calibration releases all streams',await page.evaluate(() => lossStreams.every(s => s.getTracks().every(t => t.readyState === 'ended'))),true);
    });
}
