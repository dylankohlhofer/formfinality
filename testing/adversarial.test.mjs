// Seeded policy tests, not generated scoring oracles or real-person accuracy.
// A failing seed and its action history are printed for exact reproduction.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {engineSource} from './lib.mjs';
import {exerciseInputs} from './exercise-inputs.mjs';

const html=await readFile(process.env.FORM_COACH_TEST_BUILD || new URL('../form-coach-v4.11.html',import.meta.url),'utf8');
const E=await import('data:text/javascript;base64,'+Buffer.from(engineSource(html)+
  '\nexport {SessionCore,Evaluator,M};').toString('base64'));
const input=exerciseInputs(JSON.parse(await readFile(new URL('../conformance-vectors.json',import.meta.url))).poses);
const diagnosticSource=html.split('class DiagnosticBuffer {')[1]?.split('/* DIAGNOSTIC BUFFER END */')[0];
assert.ok(diagnosticSource);
const DiagnosticBuffer=Function('return class DiagnosticBuffer {'+diagnosticSource)();
const env={speaking:()=>false,portrait:()=>false,hasDemo:()=>true};
const seeds=[0x1a2b3c4d,0x5eed1234,0x71cafe01];
function random(seed){let n=seed>>>0;return ()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return (n>>>0)/4294967296;};}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const work=c=>({i:c.i,out:structuredClone(c.out),hold:c.ev?.hold,reps:c.ev?.rep?.display(),
  scoreN:c.scoreN,scoreSum:c.scoreSum,elapsed:c.followElapsed,rest:c.restLeft});

for(const [id,mv]of Object.entries(E.M))for(const tier of mv.tiers)for(const [profile,seed]of seeds.entries())
  test(`Seeded controls ${id}/${tier}/seed-${seed.toString(16)}`,()=>{
    const rng=random(seed),fps=[15,30,60][profile],history=[];
    const c=new E.SessionCore({name:'Seeded controls',steps:[{ex:id,t:120},{rest:8},{ex:id,t:120},{rest:8},{ex:id,t:120}]},tier,env);
    let now=0,finishes=0; c.start();
    function tick(mode,seconds){
      for(let n=0;n<Math.round(seconds*fps);n++){
        const before=work(c),state=c.state,paused=c.paused,done=c.done,following=c.following,phase=c.steps[c.i];
        const f=mode==='missing'?null:input.frame(id,mode==='cycle'?input.cycle(now):0);
        const effects=c.tick(f,1/fps,now+=1/fps);finishes+=effects.filter(e=>e.t==='finish').length;
        if(paused || done){assert.deepEqual(effects,[]);assert.deepEqual(work(c),before);}
        if(!done && !paused && phase?.rest==null && (mode==='missing' || following)){
          near(c.ev.hold,before.hold);assert.equal(c.ev.rep?.display(),before.reps);
          assert.equal(c.scoreN,before.scoreN);near(c.scoreSum,before.scoreSum);
        }
        // Arming deliberately discards setup samples; monotonic credit begins
        // only after that boundary, not during the setup evaluator's warm-up.
        if(!done && state==='active' && c.i===before.i){assert.ok(c.ev?.hold>=before.hold || !c.ev);assert.ok((c.ev?.rep?.display()??0)>=(before.reps??0));}
        assert.deepEqual(c.out.slice(0,before.out.length),before.out,'Earlier records cannot change');
      }
    }
    try{
      tick('rest',4);tick('cycle',8); // Every history includes observed positive work.
      const actions=['cycle','cycle','missing','pause','resume','followAlong','finishAlong','skip'];
      for(let step=0;step<128;step++){
        const action=actions[Math.floor(rng()*actions.length)];history.push(action);
        if(['cycle','missing'].includes(action)){tick(action,.2+Math.floor(rng()*3));continue;}
        const before=work(c),done=c.done,paused=c.paused;
        const effects=c[action](action==='skip'?'seeded user choice':undefined);
        finishes+=effects.filter(e=>e.t==='finish').length;
        if(done || paused && ['followAlong','finishAlong','skip'].includes(action)){
          assert.deepEqual(effects,[]);assert.deepEqual(work(c),before);
        }
        assert.deepEqual(c.out.slice(0,before.out.length),before.out);
        for(const row of c.out)if(row.skipped || row.stopped || row.followAlong)assert.equal(row.score,null);
      }
      const sum=c.scoreSum,n=c.scoreN,fx=c.stop();finishes+=fx.filter(e=>e.t==='finish').length;
      assert.equal(finishes,1,'Exactly one terminal effect per session');
      assert.equal(c.done,true);near(c.scoreSum,sum);assert.equal(c.scoreN,n);
      assert.equal(c.reps,c.out.filter(row=>row.kind==='reps').reduce((s,row)=>s+row.achieved,0));
      near(c.bestHold,Math.max(0,...c.out.filter(row=>row.kind!=='reps').map(row=>row.achieved)));
      if(fx.length)assert.equal(fx.find(e=>e.t==='finish').payload.avg,n?Math.round(sum/n):null);
      assert.deepEqual(c.stop(),[]);assert.deepEqual(c.skip(),[]);
    }catch(error){throw new Error(`Reproduce seed=${seed.toString(16)}, fps=${fps}; actions=${JSON.stringify(history)}\n${error.message}`,{cause:error});}
  });

for(const [id,mv]of Object.entries(E.M))for(const tier of mv.tiers)
  test(`Irregular observation timing ${id}/${tier}`,()=>{
    const ev=new E.Evaluator(mv,tier);ev.arm(0);
    const cadence=[1/15,1/60,1/24,1/30,1/60,1/20];let at=0,index=0;
    while(at<12-1e-9){const dt=Math.min(cadence[index++%cadence.length],12-at);at+=dt;ev.evaluate(input.frame(id,input.cycle(at-dt)),dt,at);}
    if(mv.kind==='reps')assert.equal(ev.rep.display(),3,'Three independently authored four-second cycles');
    else near(ev.hold,12);
    assert.ok(ev.avg()===null || Number.isFinite(ev.avg()));
  });

for(let seed=1;seed<=20;seed++)test(`Diagnostic lifecycle round trip seed-${seed}`,()=>{
  const rng=random(seed),b=new DiagnosticBuffer(),meta={version:'synthetic-test',scriptSha256:'a'.repeat(64)};
  b.start(meta);let at=0;
  for(let i=0;i<200;i++){
    at+=Math.floor(rng()*300);const pick=rng();
    if(pick<.03){b.clear();b.start(meta);at=0;}
    else if(pick<.1){b.pause();const before=b.snapshot();assert.equal(b.add('frame',at,{frame:null}),false);assert.deepEqual(b.snapshot(),before);b.active=true;}
    else if(pick<.16 && b.flags.length<8)b.add('flag',at,{note:'Synthetic flag — 語'});
    else if(pick<.25)b.add('speech',at,{event:'synthetic',text:'<b>text only</b> 語'});
    else b.add('frame',at,{frame:null,movement:'plank',phase:0,reps:0,held:0,score:null,blocked:['tracking']});
    const value=b.snapshot(),text=JSON.stringify(value);
    assert.ok(Buffer.byteLength(text)<=DiagnosticBuffer.maxBytes);assert.ok(value.entries.length<=DiagnosticBuffer.maxEntries);
    assert.deepEqual(DiagnosticBuffer.parse(text),value,`seed=${seed}, operation=${i}`);
  }
});

test('45-minute unassessed session plus a 12-minute pause cannot invent observed work',()=>{
  const c=new E.SessionCore({name:'Long visit',steps:[{ex:'plank',t:120},{ex:'squat',t:120}]},'building',env);
  c.start();c.followAlong();let now=0;
  for(let i=0;i<13500;i++)c.tick(null,.2,now+=.2);
  near(c.followElapsed,2700);assert.equal(c.done,false);assert.equal(c.i,0);
  assert.equal(c.ev.hold,0);assert.equal(c.scoreN,0);assert.deepEqual(c.ev.scoreTrace,[]);
  c.pause();const before=work(c);
  for(let i=0;i<3600;i++)assert.deepEqual(c.tick(null,.2,now+=.2),[]);
  assert.deepEqual(work(c),before);c.resume();c.finishAlong();
  assert.equal(c.following,false);assert.equal(c.i,1);assert.equal(c.state,'setup');
  const p=c.stop().find(e=>e.t==='finish').payload;
  assert.equal(p.avg,null);assert.equal(p.reps,0);assert.equal(p.bestHold,0);
  assert.equal(p.out[0].followAlong,true);assert.equal(p.out[0].achieved,0);near(p.out[0].elapsed,2700);
});

test('45-minute diagnostic retention preserves all eight flags inside the export budget',()=>{
  const b=new DiagnosticBuffer();b.start({version:'synthetic-soak',scriptSha256:'b'.repeat(64)});
  b.add('control',0,{action:'synthetic start'});
  const times=Array.from({length:8},(_,i)=>60000+i*300000);
  for(let at=200;at<=2700000;at+=200){
    if(times.includes(at))b.add('flag',at,{note:'Synthetic flag'});
    b.add('frame',at,{frame:null,movement:'plank',phase:0,reps:0,held:0,score:null,blocked:['tracking']});
  }
  const value=b.snapshot(),text=JSON.stringify(value);
  assert.equal(b.active,true);assert.equal(value.retention.flags.length,8);assert.ok(value.dropped>0);
  assert.ok(Buffer.byteLength(text)<=DiagnosticBuffer.maxBytes);assert.ok(value.entries.length<=4000);
  assert.deepEqual(value.entries.filter(e=>e.kind==='flag').map(e=>e.at),times);
  for(const flag of value.retention.flags){assert.equal(flag.firstFrameAt,flag.from);assert.equal(flag.lastFrameAt,flag.until);assert.equal(flag.endedBy,'window elapsed');}
  assert.deepEqual(DiagnosticBuffer.parse(text),value);
});
