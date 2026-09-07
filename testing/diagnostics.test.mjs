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
test('entry cap rolls off oldest evidence and records the coverage loss', () => {
  const b = new BufferClass(); b.start(metadata);
  for(let i=0;i<4010;i++) b.add('flag',i,{note:'test'});
  assert.equal(b.items.length,4000); assert.equal(b.dropped,10); assert.equal(b.snapshot().entries[0].at,10);
});
test('UTF-8 byte cap bounds exported files, including non-ASCII speech', () => {
  const b = new BufferClass(); b.start(metadata);
  for(let i=0;i<300;i++) b.add('speech',i,{text:'語'.repeat(10000)});
  assert.ok(b.dropped > 0); const json=JSON.stringify(b.snapshot());
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
