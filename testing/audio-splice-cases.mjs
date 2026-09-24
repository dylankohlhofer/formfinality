// Registered by audio-capture.test.mjs so real-media controls run serially.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {audioSweep} from './audio-sweep.mjs';

export function registerAudioSpliceTests({root,html,dir}){
  for(const failedPart of [1,2])test(`a corrupt real-media splice ${failedPart} cannot speak the remaining sentence`,async()=>{
    const target=resolve(dir,`corrupt-splice-${failedPart}`);
    const [result]=await audioSweep({root,html,dir:target,only:'clips-steady-building',repeatFailures:false,
      verification:{variant:`corrupt sentence fragment ${failedPart}`,expected:'explicit whole-line failure, no tail, next independent line succeeds',source:'testing/audio-splice-cases.mjs'},
      mutate:async page=>{
        await page.route(`**/voice/steady/num/${failedPart}.mp3`,route=>route.fulfill({
          status:200,contentType:'audio/mpeg',body:Buffer.from('Deliberate invalid MP3 in test response only')
        }));
        await page.evaluate(()=>{
          const {coach}=window.__testLab.audioAccess();
          window.__audioLab.sequence=()=>{
            coach.push({key:'splice-test',text:'One two three',clips:[1,2,3].map(n=>`voice/steady/num/${n}.mp3`),
              pri:2,ttl:3000,at:performance.now()});
            // A new independent instruction must survive failure of the old one.
            coach.raw('4',2,3000);
          };
          const finish=window.__audioLab.finish;
          window.__audioLab.finish=async()=>{
            const status=document.getElementById('speechStatus').textContent;
            const idle=!coach.cur&&!coach.pending;
            const evidence=await finish();return {...evidence,spliceProbe:{status,idle}};
          };
        });
      }});
    assert.ok(!result.error,result.error);
    const evidence=JSON.parse(await readFile(resolve(target,'audio-clips-steady-building/audio.json')));
    const events=evidence.events;
    const failures=events.filter(e=>e.type==='coach-decision'&&e.event==='failed'&&e.item?.key==='splice-test');
    assert.equal(failures.length,1,'Exactly one reported failure, not successful partial teaching');
    assert.equal(events.some(e=>e.type==='clip-request'&&e.path==='voice/steady/num/3.mp3'),false,
      'Preloading a tail is not permission to play it after missing words');
    const recovered=events.find(e=>e.type==='clip-start'&&e.path==='voice/steady/num/4.mp3');
    assert.ok(recovered,'The separate next line must actually start');
    assert.ok(events.some(e=>e.type==='clip-end'&&e.playId===recovered.playId&&e.reason==='ended'));
    assert.ok(evidence.levels.some(e=>e.playId===recovered.playId&&e.rms>.0001));
    if(failedPart===2){
      const first=events.find(e=>e.type==='clip-start'&&e.path==='voice/steady/num/1.mp3');
      assert.ok(first&&events.some(e=>e.type==='clip-end'&&e.playId===first.playId&&e.reason==='ended'));
    }
    assert.equal(events.some(e=>e.type==='tts-request'),false,'No automatic replay through TTS');
    assert.equal(evidence.spliceProbe.idle,true,'A failed sentence must release Coach');
    assert.equal(result.checks.find(c=>c.label==='No recorded utterance fails behind other audible clips')?.pass,false,
      'Intentional corruption stays a failed audio capture, never hidden by successful recovery');
  });
}
