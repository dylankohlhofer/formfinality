import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {diagnosticClass,cameraProbe,bufferWorkload,meta} from './architecture-probes.mjs';
const html=await readFile(process.env.FORM_COACH_TEST_BUILD||new URL('../form-coach-v4.11.html',import.meta.url),'utf8');
const BufferClass=diagnosticClass(html);
for(const aspect of [1,16/9,9/16])test(`one pose conversion is shared by camera drawing and judgement (${aspect})`,async()=>{
  const p=await cameraProbe(html,{aspect});p.run();p.run();
  assert.equal(p.counts.inference,2);assert.equal(p.converted.length,2);
  assert.equal(p.frames.length,2);assert.equal(p.frames[1].frame,p.converted[1]);
  assert.equal(p.frames[1].frame.aspect,aspect);assert.equal(p.counts.draw,2);
  assert.ok(Math.abs(p.frames[1].dt-1/30)<1e-10);
  p.repeat();assert.equal(p.counts.inference,2);assert.equal(p.frames.length,2);
});
for(const mode of ['missing','paused','following'])test(`${mode} frames never manufacture or reuse a converted pose`,async()=>{
  const p=await cameraProbe(html,{[mode]:true});p.run();
  assert.equal(p.counts.inference,mode==='missing'?1:0);assert.equal(p.converted.length,0);
  assert.equal(p.frames[0].frame,null);assert.equal(p.counts.draw,1);
});
test('diagnostic append without pressure does not walk or copy retained history',()=>{
  const b=new BufferClass();b.start(meta);
  for(let i=0;i<3000;i++)b.add('control',i,{action:'synthetic'});
  let reads=0;
  b.items=new Proxy(b.items,{get(target,key,receiver){if(/^\d+$/.test(String(key)))reads++;return Reflect.get(target,key,receiver);}});
  b.add('control',3000,{action:'append'});
  assert.ok(reads<10,`No-pressure append read ${reads} old entries`);
  assert.equal(b.items.length,3001);assert.equal(b.dropped,0);
});
test('diagnostic rolling budget matches retained entries after pressure and flags',()=>{
  const b=bufferWorkload(BufferClass);
  assert.ok(b.dropped>0);assert.equal(b.flags.length,3);
  assert.equal(b.bytes,b.items.reduce((n,x)=>n+x.size,0));
  assert.equal(b.recentBytes,b.items.reduce((n,x)=>n+(x.kind==='frame'&&!x.pinned?x.size:0),0));
  assert.ok(b.recentBytes<=BufferClass.recentBytes);assert.ok(b.items.length<=4000);
  assert.equal(b.items.find(x=>x.kind==='effect').at,0);
  const saved=b.snapshot();assert.deepEqual(BufferClass.parse(JSON.stringify(saved)),saved);
  b.clear();assert.equal(b.recentBytes,0);assert.equal(b.bytes,0);
  b.start(meta);b.add('frame',0,{frame:null});
  assert.equal(b.recentBytes,b.items.find(x=>x.kind==='frame').size);
});
test('failed protected append preserves records and incremental byte bookkeeping',()=>{
  const b=new BufferClass();b.start(meta);
  for(let i=0;i<4000;i++)b.add('control',i,{action:'kept'});
  const before=b.snapshot(),bytes=b.bytes,recent=b.recentBytes;
  assert.throws(()=>b.add('frame',4000,{frame:null}),/Protected diagnostic space/);
  assert.deepEqual(b.snapshot().entries,before.entries);assert.equal(b.bytes,bytes);
  assert.equal(b.recentBytes,recent);assert.equal(b.active,false);
});
test('overlapping retroactive flags count newly protected bytes only once',()=>{
  const b=new BufferClass();b.start(meta);
  for(let at=0;at<=12000;at+=100)b.add('frame',at,{frame:null,blocked:[]});
  for(let i=0;i<8;i++){
    b.add('flag',12000+i,{note:'overlap'});
    assert.equal(b.recentBytes,b.items.reduce((n,x)=>n+(x.kind==='frame'&&!x.pinned?x.size:0),0));
    assert.equal(b.bytes,b.items.reduce((n,x)=>n+x.size,0));
  }
  const before=b.snapshot(),recent=b.recentBytes;
  assert.throws(()=>b.add('flag',12010,{}),/Eight flagged moments/);
  assert.deepEqual(b.snapshot(),before);assert.equal(b.recentBytes,recent);
});
test('a failed retroactive flag cannot commit pins or changed byte totals',()=>{
  const b=new BufferClass();b.start(meta);
  for(let i=0;i<3998;i++)b.add('control',i,{action:'protected'});
  b.add('frame',3998,{frame:null,blocked:[]});
  const before=b.snapshot(),bytes=b.bytes,recent=b.recentBytes;
  assert.equal(b.items.length,4000);assert.ok(recent>0);
  assert.throws(()=>b.add('flag',3999,{}),/Protected diagnostic space/);
  assert.deepEqual(b.snapshot().entries,before.entries);assert.deepEqual(b.flags,[]);
  assert.equal(b.bytes,bytes);assert.equal(b.recentBytes,recent);
  assert.equal(b.items.find(x=>x.kind==='frame').pinned,false);
});
