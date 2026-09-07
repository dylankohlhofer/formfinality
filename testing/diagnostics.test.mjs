import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const html = await readFile(process.env.FORM_COACH_TEST_BUILD || new URL('../form-coach-v4.11.html', import.meta.url), 'utf8');
const source = html.split('class DiagnosticBuffer {')[1]?.split('/* DIAGNOSTIC BUFFER END */')[0];
assert.ok(source, 'Production diagnostic buffer boundary exists');
const BufferClass = Function('return class DiagnosticBuffer {' + source)();
const metadata = { version: 'test', scriptSha256: 'a'.repeat(64) };
test('diagnostics are off by default and ignore observations', () => {
  const b = new BufferClass(); b.add('flag', 1, {note:'private'}); assert.equal(b.items.length, 0);
});
test('diagnostics retain independent copies and actual null measurements', () => {
  const b = new BufferClass(); b.start(metadata); const d = {frame:null, score:null}; b.add('frame', 1, d); d.score = 0;
  const saved = BufferClass.parse(JSON.stringify(b.snapshot())); assert.equal(saved.entries[0].data.score, null);
  saved.entries[0].data.score = 100; assert.equal(b.snapshot().entries[0].data.score, null);
});
test('entry cap rolls off unprotected frames, not the session timeline', () => {
  const b = new BufferClass(); b.start(metadata);
  b.add('control',0,{action:'recording started'});
  for(let i=0;i<4010;i++) b.add('frame',i,{frame:null, score:null});
  assert.equal(b.items.length,4000); assert.ok(b.dropped>0);
  const saved=b.snapshot();
  assert.equal(saved.entries[0].data.action,'recording started');
  assert.equal(saved.entries.find(e=>e.kind==='summary').at,0);
  assert.ok(saved.entries.find(e=>e.kind==='frame').at>0);
});
test('UTF-8 capacity pauses capture without discarding protected non-ASCII speech', () => {
  const b = new BufferClass(); b.start(metadata);
  assert.throws(()=>{for(let i=0;i<300;i++) b.add('speech',i,{text:'語'.repeat(10000)});},/Protected diagnostic space/);
  assert.equal(b.active,false); assert.equal(b.dropped,0);
  assert.equal(b.snapshot().entries[0].at,0);
  assert.ok(b.snapshot().retention.stopReason.includes('Capture paused'));
  const json=JSON.stringify(b.snapshot());
  assert.ok(new TextEncoder().encode(json).length <= BufferClass.maxBytes); BufferClass.parse(json);
});
test('clear revokes recording and removes all retained data', () => {
  const b = new BufferClass(); b.start(metadata); b.add('flag',1,{note:'secret'}); b.clear();
  assert.equal(b.active,false); assert.equal(b.meta,null); assert.equal(b.bytes,0); assert.deepEqual(b.items,[]);
});
test('invalid clocks, oversized entries and malformed imports fail loudly', () => {
  const b = new BufferClass(); b.start(metadata); b.add('flag',2,{});
  assert.throws(()=>b.add('flag',1,{})); assert.throws(()=>b.add('flag',3,{note:'x'.repeat(65537)}));
  assert.throws(()=>b.add('frame',3,{score:NaN})); assert.throws(()=>b.add('frame',3,{score:Infinity}));
  const valid=b.snapshot();
  for(const bad of [{...valid,schema:'other'}, {...valid,dropped:-1}, {...valid,entries:[{kind:'frame',at:1,data:{frame:{cam:'left',aspect:1,left:{},right:{wrist:{x:0,y:0,c:null}}}}}]}])
    assert.throws(()=>BufferClass.parse(JSON.stringify(bad)));
  assert.throws(()=>BufferClass.parse('x'.repeat(BufferClass.maxBytes+1)));
});

function frames(b,from,to,step=100){
  for(let at=from;at<=to;at+=step)b.add('frame',at,{frame:null,phase:0,movement:'plank',reps:0,held:at/1000,score:null,blocked:['tracking']});
}
test('flagged pre/post detail survives much later frame rolloff with its session summary',()=>{
  const b=new BufferClass();b.start(metadata);b.add('control',0,{action:'start'});
  frames(b,0,15000);b.add('flag',15000,{note:'problem here'});frames(b,15100,600000);
  const data=BufferClass.parse(JSON.stringify(b.snapshot()));
  assert.ok(data.dropped>0);assert.equal(data.entries[0].data.action,'start');
  assert.ok(data.entries.some(e=>e.kind==='flag'&&e.at===15000));
  const pinned=data.entries.filter(e=>e.kind==='frame'&&e.at>=5000&&e.at<=25000);
  assert.equal(pinned.length,101,'±10s at 5Hz including both endpoints');
  assert.equal(pinned[0].at,5000);assert.equal(pinned.at(-1).at,25000);
  assert.ok(pinned.every((e,i)=>!i||e.at-pinned[i-1].at===200));
  assert.ok(data.entries.some(e=>e.kind==='summary'&&e.at===0));
  assert.ok(data.entries.some(e=>e.kind==='summary'&&e.at===600000));
  assert.equal(data.retention.flags[0].endedBy,'window elapsed');
  assert.equal(data.retention.flags[0].firstFrameAt,5000);
  assert.equal(data.retention.flags[0].lastFrameAt,25000);
});
test('overlapping flagged windows share snapshots and never duplicate the timeline',()=>{
  const b=new BufferClass();b.start(metadata);frames(b,0,10000);b.add('flag',10000,{});
  frames(b,10100,12000);b.add('flag',12000,{});frames(b,12100,600000);
  const data=b.snapshot(),times=data.entries.filter(e=>e.kind==='frame').map(e=>e.at);
  assert.equal(new Set(times).size,times.length);assert.equal(data.retention.flags.length,2);
  assert.ok(times.includes(0));assert.ok(times.includes(22000));
  BufferClass.parse(JSON.stringify(data));
});
test('eight saved flags cannot be silently replaced by a ninth',()=>{
  const b=new BufferClass();b.start(metadata);
  for(let i=0;i<8;i++)b.add('flag',i*1000,{note:`flag ${i}`});
  const before=b.snapshot();assert.throws(()=>b.add('flag',9000,{}),/Eight flagged moments/);
  assert.deepEqual(b.snapshot(),before);assert.equal(before.entries.filter(e=>e.kind==='flag').length,8);
});
test('pause closes an incomplete flag window; resuming does not invent the missing interval',()=>{
  const b=new BufferClass();b.start(metadata);frames(b,0,1000);b.add('flag',1000,{});frames(b,1100,2000);b.pause();
  assert.equal(b.add('frame',9000,{frame:null}),false);
  b.active=true;frames(b,15000,600000);
  const data=BufferClass.parse(JSON.stringify(b.snapshot())),f=data.retention.flags[0];
  assert.equal(f.endedBy,'paused');assert.equal(f.closedAt,2000);assert.equal(f.lastFrameAt,2000);
  assert.ok(!data.entries.some(e=>e.kind==='frame'&&e.at>2000&&e.at<15000));
});
test('a flag with no observed body records that absence, not a fabricated snapshot',()=>{
  const b=new BufferClass();b.start(metadata);b.add('flag',1000,{});b.pause();
  const f=b.snapshot().retention.flags[0];
  assert.equal(f.firstFrameAt,null);assert.equal(f.lastFrameAt,null);
  assert.equal(b.snapshot().entries.filter(e=>e.kind==='frame').length,0);
  BufferClass.parse(JSON.stringify(b.snapshot()));
});
test('summary preserves brief changed state between periodic samples, never joints',()=>{
  const b=new BufferClass();b.start(metadata);frames(b,0,0);
  b.add('frame',30,{frame:null,movement:'plank',reps:1,score:null,blocked:[],after:{state:'active'}});
  const summaries=b.snapshot().entries.filter(e=>e.kind==='summary');
  assert.equal(summaries.length,2);assert.equal(summaries[1].data.reps,1);
  assert.equal(summaries[1].data.score,null);assert.equal('frame' in summaries[1].data,false);
});
test('clear erases protected windows, summary bookkeeping and capacity notices as well',()=>{
  const b=new BufferClass();b.start(metadata);frames(b,0,1000);b.add('flag',1000,{});b.clear();
  assert.deepEqual(b.flags,[]);assert.equal(b.summaryAt,-Infinity);assert.equal(b.stopReason,'');
  b.start(metadata);frames(b,0,0);assert.equal(b.snapshot().entries.filter(e=>e.kind==='summary').length,1);
});
test('legacy rolling exports remain readable without pretending their flags were pinned',()=>{
  const old={schema:'formcoach-diagnostic/1',meta:metadata,dropped:17124,entries:[{kind:'flag',at:1000,data:{note:'legacy'}}]};
  assert.deepEqual(BufferClass.parse(JSON.stringify(old)),old);assert.equal('retention' in old,false);
});
test('new retention metadata validates limits, order, duration and finite bounds',()=>{
  const b=new BufferClass();b.start(metadata);b.add('flag',1000,{});const valid=b.snapshot();
  for(const change of [r=>r.flags.push(...Array(8).fill(r.flags[0])),r=>r.flagSampleMs=1,r=>r.flags[0].until=999999,
    r=>r.flags[0].firstFrameAt=-1,r=>r.flags[0].endedBy='full coverage guaranteed',r=>r.flags[0].closedAt=1e10,
    r=>r.flags[0].endedBy='paused',r=>r.flags[0].closedAt=1000,
    r=>Object.assign(r.flags[0],{endedBy:'paused',closedAt:1000,firstFrameAt:0,lastFrameAt:1500}),
    r=>Object.assign(r.flags[0],{firstFrameAt:0,lastFrameAt:0})]){
    const bad=structuredClone(valid);change(bad.retention);assert.throws(()=>BufferClass.parse(JSON.stringify(bad)));
  }
  const missing=structuredClone(valid);missing.entries=[];assert.throws(()=>BufferClass.parse(JSON.stringify(missing)));
});
test('byte pressure during a flag window pauses without replacing any protected snapshot',()=>{
  const b=new BufferClass();b.start(metadata);b.add('flag',0,{note:'must survive'});
  let before;
  assert.throws(()=>{
    for(let at=0;at<20000;at+=100){
      if(at===5000)b.add('flag',at,{note:'extend protected interval beyond one window'});
      before=b.snapshot();b.add('frame',at,{frame:null,score:null,detail:'x'.repeat(60000)});
    }
  },/Protected diagnostic space/);
  assert.equal(b.active,false);const after=b.snapshot();
  assert.deepEqual(after.entries,before.entries,'Even the failing append is transactional');
  assert.equal(after.entries[0].kind,'flag');assert.equal(after.retention.flags.at(-1).endedBy,'capacity reached');
  assert.equal(after.retention.flags.at(-1).lastFrameAt,before.retention.flags.at(-1).lastFrameAt);
  BufferClass.parse(JSON.stringify(after));
  assert.ok(Buffer.byteLength(JSON.stringify(after))<=BufferClass.maxBytes);
});
test('invalid or oversized startup metadata cannot produce an unexportable capture',()=>{
  for(const meta of [{...metadata,n:NaN},{...metadata,n:Infinity},{...metadata,extra:'語'.repeat(3000)}]){
    const b=new BufferClass();assert.throws(()=>b.start(meta));assert.equal(b.active,false);
  }
});
