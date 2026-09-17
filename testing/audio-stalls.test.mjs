import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const html=await readFile(process.env.FORM_COACH_TEST_BUILD || new URL('../form-coach-v4.11.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('const AudioBank = {'),html.indexOf('AudioBank.init();'));
function harness(){
  let now=0,nextId=0;const jobs=new Map(),media=[],events=[],results=[];
  class Audio {
    constructor(src){this.src=src;this.currentTime=0;this.pauses=0;this.loads=0;media.push(this);}
    play(){this.requested=true;return new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;});}
    pause(){this.pauses++;}
    removeAttribute(name){assert.equal(name,'src');this.src='';}
    load(){this.loads++;}
    begin(){this.onplaying?.();this.resolve();}
    end(){this.onended?.();}
  }
  const bank=runInNewContext(source+';AudioBank',{
    Audio,performance:{now:()=>now},diagnosticEvent:(_type,e)=>events.push(e),
    setTimeout:(fn,delay)=>{const id=++nextId;jobs.set(id,{at:now+delay,fn});return id;},clearTimeout:id=>jobs.delete(id)
  });
  bank.enabled=true;bank.manifest=new Set(['one','two','three']);
  const tick=ms=>{
    const end=now+ms;let turns=0;
    while(true){const next=[...jobs].filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;
      assert.ok(++turns<100,'Timers must make progress');const[id,job]=next;jobs.delete(id);now=job.at;job.fn();}
    now=end;
  };
  return {bank,media,events,results,jobs,tick,play:(paths=['one','two'],options)=>bank.play(paths,r=>results.push({...r}),options)};
}
test('unstarted clip retries a fresh element once, then releases the line before the 25s watchdog',()=>{
  const h=harness();h.play();const first=h.media[0];
  h.tick(1999);assert.equal(h.media.length,2);assert.equal(h.results.length,0);
  h.tick(1);assert.equal(h.media.length,3);assert.notEqual(h.bank.cache.get('one'),first);
  assert.equal(first.src,'');assert.equal(first.loads,1);assert.ok(first.pauses>0);
  h.tick(2000);assert.deepEqual(h.results,[{failed:true,reason:'clip loading stalled'}]);
  assert.equal(h.media[1].requested,undefined,'No number-only tail of a failed instruction');
  assert.equal(h.bank.pendingLoads.size,0);assert.equal(h.jobs.size,0);
  h.tick(30000);assert.equal(h.results.length,1);
});
test('a fresh-element retry completes, ignoring old promise and ended callbacks',async()=>{
  const h=harness();h.play();const old=h.media[0],lateEnd=old.onended,latePlaying=old.onplaying;
  h.tick(2000);const fresh=h.media[2];fresh.begin();old.reject(new Error('late old load failure'));await Promise.resolve();
  latePlaying();lateEnd();assert.equal(h.media[1].requested,undefined);
  fresh.end();h.media[1].begin();h.media[1].end();
  assert.deepEqual(h.results,[{failed:false}]);assert.equal(h.bank.pendingLoads.size,0);
});
test('a later missing splice fails the line without repeating heard words or speaking its tail',()=>{
  const h=harness();h.play(['one','two','three']);h.media[0].begin();h.media[0].end();h.tick(2000);
  assert.deepEqual(h.results,[{failed:true,reason:'clip loading stalled'}]);
  assert.equal(h.media.length,3);assert.equal(h.media[2].requested,undefined);assert.equal(h.media[1].src,'');
});
test('a clip that starts but stops making progress is released without a replay',()=>{
  const h=harness();h.play();h.media[0].begin();h.tick(2000);
  assert.deepEqual(h.results,[{failed:true,reason:'clip playback stalled'}]);assert.equal(h.media.length,2);
});
test('long progressing audio is not cut off at the startup budget',()=>{
  const h=harness();h.play(['one']);h.media[0].begin();
  for(let i=1;i<=6;i++){h.media[0].currentTime=i*2;h.tick(2000);assert.equal(h.results.length,0);}
  h.media[0].end();assert.deepEqual(h.results,[{failed:false}]);assert.equal(h.jobs.size,0);
});
for(const duringRetry of [false,true])test(`Stop cancels load timers and stale continuations (${duringRetry?'retry':'first request'})`,async()=>{
  const h=harness();h.play();if(duringRetry)h.tick(2000);
  const old=h.media.at(-1).requested ? h.media.at(-1) : h.media[0],lateEnd=old.onended;
  h.bank.stop();assert.equal(h.bank.pendingLoads.size,0);h.tick(10000);lateEnd();
  old.reject(new Error('cancelled old playback'));await Promise.resolve();
  assert.deepEqual(h.results,[]);assert.equal(h.jobs.size,0);
  h.play(['three']);const fresh=h.media.at(-1);fresh.begin();lateEnd();fresh.end();
  assert.deepEqual(h.results,[{failed:false}]);
});
test('an expiring count cannot retry or start late',()=>{
  const h=harness();h.play(['one'],{deadline:500});const late=h.media[0].onplaying;
  h.tick(500);late();assert.deepEqual(h.results,[{failed:true,reason:'clip expired before playback'}]);
  assert.equal(h.media.length,1);assert.equal(h.jobs.size,0);
});
test('retry cannot extend the original start deadline',()=>{
  const h=harness();h.play(['one'],{deadline:2500});h.tick(2000);assert.equal(h.media.length,2);
  h.tick(500);assert.deepEqual(h.results,[{failed:true,reason:'clip expired before playback'}]);assert.equal(h.jobs.size,0);
});
test('playing callback checks expiry even if its timer has not fired',()=>{
  const h=harness();h.play(['one'],{deadline:0});h.media[0].begin();
  assert.deepEqual(h.results,[{failed:true,reason:'clip expired before playback'}]);assert.equal(h.jobs.size,0);
});
test('a timely started line can finish its later splices after the start deadline',()=>{
  const h=harness();h.play(['one','two'],{deadline:500});h.media[0].begin();h.tick(1000);h.media[0].end();
  h.media[1].begin();h.media[1].end();assert.deepEqual(h.results,[{failed:false}]);
});
test('missing fresh asset on retry fails once without pending timers',()=>{
  const h=harness();h.play(['one']);h.bank.manifest.clear();h.tick(2000);
  assert.deepEqual(h.results,[{failed:true,reason:'clip loading stalled'}]);assert.equal(h.jobs.size,0);
});
