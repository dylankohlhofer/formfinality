import { readFile } from 'node:fs/promises';
import { exerciseInputs } from './exercise-inputs.mjs';

// Substitute only media/native delivery; keep Coach, AudioBank, UI handlers,
// SessionCore and applyFx intact. This tests lifecycle, not audible output.
async function controlledPlayback(page, mode = 'recorded') {
  await page.waitForFunction(() => __testLab.audioAccess().AudioBank.enabled);
  await page.evaluate(mode => {
    const { AudioBank, coach } = __testLab.audioAccess();
    coach.reset();
    const p = window.__coaching = { started: [], spoken: [], paused: [], cancels: 0, rejects: {} };
    speechSynthesis.cancel = () => p.cancels++;
    speechSynthesis.getVoices = () => [{ name: 'Local fixture', voiceURI: 'fixture', lang: 'en-GB', localService: true }];
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    speechSynthesis.speak = u => p.spoken.push(u);
    AudioBank.enabled = mode === 'recorded';
    AudioBank.get = path => {
      if (!AudioBank.cache.has(path)) AudioBank.cache.set(path, {
        currentTime: 0, pause: () => p.paused.push(path),
        play() { p.started.push(path); return new Promise((_resolve, reject) => { p.rejects[path] = reject; }); }
      });
      return AudioBank.cache.get(path);
    };
  }, mode);
}

// Queue tests use actual Coach code with controlled playback callbacks. No claim
// about acoustic audibility; audio-sweep measures real recorded clip output.
export async function coachingCases(runCase){
  await runCase('coaching-stalled-calibration','Never-starting recorded teaching fails visibly and releases actual calibration without manually clearing the coach.',async(page,check)=>{
    await controlledPlayback(page);
    await page.locator('#voice').check();await page.locator('#calBtn').click();
    check('Actual calibration teaching owns the queue',await page.evaluate(()=>__testLab.audioAccess().coach.cur?.key),'teach.plank');
    await page.waitForFunction(()=>!__testLab.audioAccess().coach.speaking(),null,{timeout:6000});
    check('One fresh-element retry, no unplayed instruction tail',await page.evaluate(()=>__coaching.started.length),2);
    check('Failure explains the on-screen alternative',await page.locator('#speechStatus').innerText().then(s=>/recorded speech could not finish.*on-screen/i.test(s)),true);
    const {poses}=JSON.parse(await readFile(new URL('../conformance-vectors.json',import.meta.url),'utf8'));
    const held=await page.evaluate(frame=>{
      for(let i=0;i<195;i++)__testLab.feed(frame,1/30);
      return __testLab.snapshot().held;
    },exerciseInputs(poses).frame('plank'));
    check('Fresh observed calibration hold can accrue after audio failure',held>=4.5&&held<=5.5,true);
    check('No automatic native voice is substituted',await page.evaluate(()=>__coaching.spoken.length),0);
  });
  await runCase('coaching-context-withdrawal','Resolved faults discard pending speech and cancel active speech without disturbing valid teaching.',async(page,check)=>{
    const r=await page.evaluate(()=>{
      const {Coach,AudioBank}=__testLab.audioAccess(); let stops=0; const ends=[];
      AudioBank.play=(_p,end)=>{ends.push(end);return true;}; AudioBank.stop=()=>stops++; speechSynthesis.cancel=()=>{};
      const c=new Coach(), item=(key,topic,pri=2)=>({key,topic,text:key,pri,at:performance.now(),ttl:10000,clips:['test']});
      c.updateContext({keys:['sag'],positive:false,readiness:null});
      c.push(item('teach.plank',null,3)); c.push(item('sag','form'));
      c.updateContext({keys:[],positive:true,readiness:null});
      const pendingGone=!c.pending, teachingRetained=c.cur.key==='teach.plank'; ends[0]();
      c.updateContext({keys:['sag'],positive:false,readiness:null}); c.push(item('sag','form')); const stale=ends.at(-1);
      c.updateContext({keys:[],positive:false,readiness:'trackingLost'});
      const faultCancelled=!c.cur&&stops===1;
      c.push(item('trackingLost','readiness')); const current=c.cur; stale(); const callbackIgnored=c.cur===current;
      c.updateContext({keys:[],positive:true,readiness:null}); const readinessCancelled=!c.cur;
      c.reset();return{pendingGone,teachingRetained,faultCancelled,callbackIgnored,readinessCancelled};
    });
    for(const [k,v] of Object.entries(r))check(k,v,true);
  });
  await runCase('coaching-continuing-condition','Current facts survive cue cooldown; duplicates are suppressed only while the same condition continues.',async(page,check)=>{
    const r=await page.evaluate(()=>{
      const {Coach,AudioBank}=__testLab.audioAccess(); const ends=[];let now=1000;
      Object.defineProperty(performance,'now',{value:()=>now,configurable:true});
      AudioBank.play=(_p,end)=>{ends.push(end);return true;}; AudioBank.stop=()=>{};speechSynthesis.cancel=()=>{};
      const c=new Coach(), item=()=>({key:'sag',topic:'form',text:'sag',pri:2,at:now,ttl:5000,clips:['test']});
      const bad={keys:['sag'],readiness:null,positive:false},good={keys:[],readiness:null,positive:true};
      c.updateContext(bad);c.push(item());c.updateContext(bad);const stillValid=c.cur?.key==='sag';
      c.push(item());const noDuplicate=!c.pending;ends[0]();c.push(item());const recentlyCompletedSuppressed=!c.cur;
      now+=21000;c.push(item());const reminderAllowed=c.cur?.key==='sag';ends.at(-1)();
      c.updateContext(good);c.updateContext(bad);c.push(item());const recurrenceAllowed=c.cur?.key==='sag';
      c.reset();return{stillValid,noDuplicate,recentlyCompletedSuppressed,reminderAllowed,recurrenceAllowed};
    });
    for(const [k,v] of Object.entries(r))check(k,v,true);
  });
  await runCase('coaching-failed-playback','A failed recording does not become a completed instruction or suppress the next eligible attempt.',async(page,check)=>{
    const r=await page.evaluate(()=>{
      const {Coach,AudioBank}=__testLab.audioAccess();let end,calls=0;
      AudioBank.play=(_p,fn)=>{end=fn;calls++;return true;};AudioBank.stop=()=>{};speechSynthesis.cancel=()=>{};
      const c=new Coach();c.updateContext({keys:['sag'],positive:false,readiness:null});
      const item=()=>({key:'sag',topic:'form',text:'sag',pri:2,at:performance.now(),ttl:5000,clips:['test']});
      c.push(item());end({failed:true});c.push(item());const retry=calls===2&&!!c.cur;c.reset();return retry;
    });check('Failed delivery remains retryable',r,true);
  });

  for (const mode of ['recorded', 'native']) {
    await runCase(`coaching-voice-toggle-${mode}`, 'Actual Voice and Hear it handlers: explicit preview while muted, immediate cancellation, stale callbacks and fresh speech after re-enabling.', async (page, check) => {
      await controlledPlayback(page, mode);
      await page.locator('#voicePrev').click();
      check('Explicit Hear it works with automatic Voice off', await page.evaluate(() => {
        const { coach } = __testLab.audioAccess();
        return !document.getElementById('voice').checked && coach.cur?.key === 'preview';
      }), true);
      await page.evaluate(() => __testLab.audioAccess().coach.reset());
      await page.locator('#voice').check();
      await page.locator('#calBtn').click();
      const before = await page.evaluate(mode => {
        const { coach, AudioBank } = __testLab.audioAccess(), p = __coaching;
        coach.say('getset', { vars: { x: 'plank' }, pri: 3 });
        p.oldEnd = mode === 'recorded' ? AudioBank.cache.get(p.started.at(-1)).onended : p.spoken.at(-1).onend;
        p.oldError = mode === 'recorded' ? () => p.rejects[p.oldPath](new Error('Cancelled fixture')) : p.spoken.at(-1).onerror;
        p.oldPath = p.started.at(-1); p.cancelBefore = p.cancels;
        return { current: coach.cur?.key, pending: coach.pending?.key };
      }, mode);
      check('Production calibration teaching is current', before.current, 'teach.plank');
      check('Another instruction is pending', before.pending, 'getset');
      await page.locator('#voice').uncheck();
      const stopped = await page.evaluate(async mode => {
        const { coach } = __testLab.audioAccess(), p = __coaching;
        const calls = p.started.length + p.spoken.length;
        p.oldEnd(); p.oldError(); await Promise.resolve(); await Promise.resolve();
        coach.say('go', { pri: 3 });
        return { released: !coach.cur && !coach.pending && !coach.speaking(),
          stopped: mode === 'recorded' ? p.paused.includes(p.oldPath) : p.cancels > p.cancelBefore,
          noNewPlayback: calls === p.started.length + p.spoken.length,
          noStaleError: document.getElementById('speechStatus').hidden };
      }, mode);
      for (const [key, value] of Object.entries(stopped)) check(key, value, true);
      await page.locator('#voice').check();
      check('Enabling Voice does not replay abandoned speech', await page.evaluate(() => !__testLab.audioAccess().coach.speaking()), true);
      check('Fresh speech survives old completion callbacks', await page.evaluate(() => {
        const { coach } = __testLab.audioAccess(); coach.say('go', { pri: 3 });
        const current = coach.cur; __coaching.oldEnd();
        return current?.key === 'go' && coach.cur === current;
      }), true);
    });
  }

  for (const exercise of ['plank', 'side-plank']) for (const pending of [false, true]) {
    await runCase(`coaching-view-${exercise}-${pending ? 'pending' : 'current'}`, 'Real plan selection, pose observations and effect plumbing withdraw view speech while retaining the once-per-set hint budget.', async (page, check) => {
      await controlledPlayback(page);
      const input = exerciseInputs(JSON.parse(await readFile(new URL('../conformance-vectors.json', import.meta.url))).poses);
      const key = exercise === 'plank' ? 'turnside' : 'turnfront';
      const good = input.frame(exercise), limited = input.frame(exercise, 0, { view: exercise === 'plank' ? 35 : 55 });
      await page.evaluate(exercise => __testLab.installPlan({ id: 'view-audit', name: 'Core Strength', tiers: ['building'], steps: [{ ex: exercise, t: 100 }] }), exercise);
      await page.locator('#skipBtn').click(); await page.locator('[data-t="building"]').click();
      await page.locator('#goBtn').click(); await page.locator('[data-plan="view-audit"]').click(); await page.locator('#planStartBtn').click();
      await page.evaluate(good => { for (let i = 0; i < 90; i++) __testLab.feed(good, 1 / 30); }, good);
      await page.locator('#voice').check();
      const result = await page.evaluate(({ good, limited, pending, key, exercise }) => {
        const { coach, AudioBank } = __testLab.audioAccess(), p = __coaching;
        if (pending) coach.say(`teach.${exercise}`, { vars: { t: 100 }, pri: 3 });
        const teaching = coach.cur;
        __testLab.feed(limited, 1 / 30);
        const warning = (pending ? coach.pending : coach.cur)?.key;
        const stale = !pending ? AudioBank.cache.get(p.started.at(-1)).onended : null;
        __testLab.feed(limited, 1 / 30);
        const retained = (pending ? coach.pending : coach.cur)?.key === key;
        __testLab.feed(good, 1 / 30);
        const withdrawn = pending ? !coach.pending && coach.cur === teaching : !coach.cur;
        stale?.();
        __testLab.feed(limited, 1 / 30);
        const hints = __testLab.effects().filter(e => e.t === 'say' && e.key === key);
        return { armed: __testLab.effects().some(e => e.t === 'log' && e.row.event === 'armed'),
          warning, retained, withdrawn, hints: hints.length,
          notRevived: coach.cur?.key !== key && coach.pending?.key !== key };
      }, { good, limited, pending, key, exercise });
      check('Actual session armed', result.armed, true);
      check('Active view hint reaches playback queue', result.warning, key);
      check('Continuing limited view retains the instruction', result.retained, true);
      check('Recovery withdraws warning and preserves teaching', result.withdrawn, true);
      check('Recovery and recurrence do not bypass the per-set hint budget', result.hints, 1);
      check('Abandoned callbacks and recurrence do not revive the warning', result.notRevived, true);
    });
  }

  await runCase('coaching-recorded-error-visible', 'Actual calibration teaching and AudioBank rejection release the queue with visible failure, no native retry, and successful later playback.', async (page, check) => {
    await controlledPlayback(page);
    await page.locator('#voice').check(); await page.locator('#calBtn').click();
    const failed = await page.evaluate(async () => {
      const { coach } = __testLab.audioAccess(), p = __coaching;
      const key = coach.cur?.key;
      // Reject each segment through the real AudioBank continuation chain.
      for (let i = 0; coach.cur && i < 20; i++) {
        p.rejects[p.started.at(-1)](new Error('Deliberate recorded playback failure'));
        await Promise.resolve(); await Promise.resolve();
      }
      return { key, released: !coach.cur && !coach.pending, nativeCalls: p.spoken.length };
    });
    check('Failure occurs in actual calibration teaching', failed.key, 'teach.plank');
    check('Failed sequence releases speech gate', failed.released, true);
    check('Recorded failure never retries native speech', failed.nativeCalls, 0);
    check('Failure explanation is visible', await page.locator('#speechStatus').isVisible(), true);
    check('Explanation names recorded failure and visual guidance', await page.locator('#speechStatus').innerText().then(t => /recorded speech could not finish.*on-screen/i.test(t)), true);
    const recovered = await page.evaluate(() => {
      const { coach, AudioBank } = __testLab.audioAccess(); coach.say('go', { pri: 3 });
      const started = !!coach.cur;
      for (let i = 0; coach.cur && i < 20; i++) AudioBank.cache.get(__coaching.started.at(-1)).onended();
      return started && !coach.cur && !coach.pending && document.getElementById('speechStatus').hidden;
    });
    check('A later successful recording completes and clears failure status', recovered, true);
    check('Recorded success does not hide an unavailable local voice', await page.evaluate(() => {
      const { coach, AudioBank } = __testLab.audioAccess();
      AudioBank.enabled = false; speechSynthesis.getVoices = () => [];
      coach.say('trackingLost', { pri: 3 });
      const status = document.getElementById('speechStatus'), unavailable = status.textContent;
      AudioBank.enabled = true; coach.say('go', { pri: 3 });
      for (let i = 0; coach.cur && i < 20; i++) AudioBank.cache.get(__coaching.started.at(-1)).onended();
      return /Local English voice unavailable/.test(unavailable) && status.textContent === unavailable && !status.hidden && !__coaching.spoken.length;
    }), true);
  });
}
