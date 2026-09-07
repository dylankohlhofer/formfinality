import test from 'node:test';
import assert from 'node:assert/strict';
import {PoseWorkerQueue} from './worker-queue.mjs';
function setup(){let now=0;const sent=[],results=[],errors=[];
  const worker={postMessage(m){sent.push(m);},terminate(){this.terminated=true;}};
  const q=new PoseWorkerQueue(worker,{now:()=>now,onResult:r=>results.push(r),onError:e=>errors.push(e)});
  const bitmap=()=>({closed:0,close(){this.closed++;}});
  const reply=(i=sent.length-1)=>q.receive({type:'result',id:sent[i].id,landmarks:[]});
  return{q,worker,sent,results,errors,bitmap,reply,time:n=>now=n};
}
test('worker accepts fresh results with original capture time',()=>{const s=setup();s.q.submit(s.bitmap(),0);s.time(30);s.reply();assert.equal(s.results[0].capturedAt,0);assert.equal(s.results[0].ageMs,30);});
test('backpressure replaces pending frames rather than queueing old work',()=>{const s=setup();const a=s.bitmap(),b=s.bitmap(),c=s.bitmap();s.q.submit(a,0);s.q.submit(b,1);s.q.submit(c,2);assert.equal(b.closed,1);assert.equal(s.sent.length,1);s.reply(0);assert.equal(s.sent.length,2);assert.equal(s.sent[1].bitmap,c);});
test('old results cannot cross a session reset, and reset keeps one inference in flight',()=>{const s=setup();s.q.submit(s.bitmap(),0);s.q.reset();s.q.submit(s.bitmap(),1);assert.equal(s.sent.length,1);s.reply(0);assert.equal(s.results.length,0);assert.equal(s.sent.length,2);s.reply(1);assert.equal(s.results.length,1);});
test('aged results and aged pending frames are discarded',()=>{const s=setup();s.q.submit(s.bitmap(),0);const pending=s.bitmap();s.q.submit(pending,1);s.time(300);s.reply(0);assert.equal(s.results.length,0);assert.equal(pending.closed,1);assert.equal(s.q.stats.stale,2);});
test('unknown response cannot unlock the in-flight slot',()=>{const s=setup();s.q.submit(s.bitmap(),0);s.q.receive({type:'result',id:99});assert.ok(s.q.inFlight);assert.equal(s.results.length,0);});
test('stop releases pending ownership and ignores late callbacks',()=>{const s=setup();s.q.submit(s.bitmap(),0);const pending=s.bitmap();s.q.submit(pending,1);s.q.close();s.reply();const late=s.bitmap();assert.equal(s.q.submit(late,2),false);assert.equal(pending.closed,1);assert.equal(late.closed,1);assert.ok(s.worker.terminated);assert.equal(s.results.length,0);});
test('nonmonotonic input is rejected and released',()=>{const s=setup();s.q.submit(s.bitmap(),1);const b=s.bitmap();assert.throws(()=>s.q.submit(b,1));assert.equal(b.closed,1);});
test('worker errors fail loudly and stop future work',()=>{const s=setup();s.q.submit(s.bitmap(),0);s.q.receive({type:'error',id:1,error:'model failed'});assert.equal(s.errors[0].message,'model failed');assert.ok(s.q.closed);});
test('a result callback submitting another frame cannot bypass backpressure',()=>{const s=setup();s.q.submit(s.bitmap(),0);s.q.submit(s.bitmap(),1);s.q.onResult=()=>s.q.submit(s.bitmap(),2);s.reply(0);assert.equal(s.sent.length,2);assert.equal(s.q.inFlight.id,2);assert.equal(s.q.pending.id,3);});
