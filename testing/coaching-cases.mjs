// Queue tests use actual Coach code with controlled playback callbacks. No claim
// about acoustic audibility; audio-sweep measures real recorded clip output.
export async function coachingCases(runCase){
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
}
