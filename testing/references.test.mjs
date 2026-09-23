import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {engineSource} from './lib.mjs';
const html = await readFile(process.env.FORM_COACH_TEST_BUILD || new URL('../form-coach-v4.11.html', import.meta.url), 'utf8');
const E = await import('data:text/javascript;base64,' + Buffer.from(engineSource(html) +
  '\nexport {ReferenceStore,parseReferenceBundle,refPose,M};').toString('base64'));
const valid = () => ({space:'iso', fps:15, frames:[{shoulder:[.25,.4],hip:[.5,.4]}],recorded:true,loop:true});
class Storage {
  data = new Map(); fail = false;
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key,value) { if(this.fail) throw Error('quota'); this.data.set(key,value); }
  removeItem(key) { if(this.fail) throw Error('denied'); this.data.delete(key); }
}
test('A valid reference survives saving/reload and both static and moving interpolation', () => {
  const storage = new Storage(), store = new E.ReferenceStore(storage), ref = valid();
  assert.equal(store.save({plank:ref}).ok,true);
  ref.frames[0].hip[0] = 7;
  const restored = new E.ReferenceStore(storage);
  assert.equal(restored.refs.plank.frames[0].hip[0],.5,'Caller cannot mutate a saved reference');
  assert.equal(E.refPose(restored.refs.plank,1).hip[0],.5);
  const moving = {...valid(),frames:[valid().frames[0],{shoulder:[.3,.4],hip:[.6,.4]}]};
  assert.equal(restored.save({squat:moving}).ok,true);
  for(let t=0;t<3;t+=.1) assert.ok(E.refPose(restored.refs.squat,t).hip.every(Number.isFinite));
});
for(const [label,change] of Object.entries({empty:{frames:[]},missing:{frames:undefined},nullFrame:{frames:[null]},
  noJoints:{frames:[{}]},badJoint:{frames:[{hip:[null,.4]}]},extraJoint:{frames:[{hip:[.5,.4],secret:[1,2]}]},
  nonfinite:{frames:[{hip:[NaN,.4]}]},dimension:{frames:[{hip:[.5,.4,1]}]},zeroFPS:{fps:0},infiniteFPS:{fps:Infinity},
  highFPS:{fps:121},wrongSpace:{space:'unknown'},badAspect:{aspect:0},badLabel:{labels:[{html:'x'}]},
  tooManyLabels:{labels:['a','b']},badProp:{props:{chair:'yes'}},missingChairHip:{props:{chair:true},frames:[{shoulder:[.2,.3]}]},
  extra:{score:100},hugeCoordinate:{frames:[{hip:[1e100,.4]}]},
  convertedOutOfBounds:{space:undefined,aspect:10,frames:[{hip:[1.5,.4]}]},
  tooManyFrames:{frames:Array.from({length:601},()=>valid().frames[0])}}))
  test(`Invalid ${label} reference cannot partially replace any stored demo`, () => {
    const storage = new Storage(), store = new E.ReferenceStore(storage);
    store.save({plank:valid()}); const before = storage.getItem('fc_refs');
    assert.equal(store.save({squat:valid(),plank:{...valid(),...change}}).ok,false);
    assert.equal(storage.getItem('fc_refs'),before); assert.equal(store.refs.squat,undefined);
    assert.equal(store.refs.plank.frames[0].hip[0],.5);
  });
test('Malformed collections, unknown IDs and prototype keys are rejected before use', () => {
  for(const raw of ['null','[]','42','{',JSON.stringify({unknown:valid()}),'{"__proto__":{}}'])
    assert.throws(()=>E.parseReferenceBundle(raw));
  assert.throws(()=>E.parseReferenceBundle(' '.repeat(1024*1024)+'{}'));
});
test('Legacy camera coordinates are converted once, including after an export/import cycle', () => {
  const legacy = {fps:15,aspect:2,frames:[{hip:[0,.5],shoulder:[.25,.5]}]};
  const parsed = E.parseReferenceBundle(JSON.stringify({plank:legacy}));
  assert.deepEqual(parsed.plank.frames[0].hip,[-.5,.5]);
  assert.deepEqual(parsed.plank.frames[0].shoulder,[0,.5]);
  assert.deepEqual(E.parseReferenceBundle(JSON.stringify(parsed)),parsed);
});
test('Corrupt saved references are preserved for recovery and never installed as overrides', () => {
  const storage = new Storage(), raw = JSON.stringify({squat:valid(),plank:{space:'iso',fps:15,frames:[]}});
  storage.setItem('fc_refs',raw); storage.setItem('unrelated','keep');
  const store = new E.ReferenceStore(storage);
  assert.deepEqual(Object.keys(store.refs),[]); assert.match(store.message,/Built-in demos/);
  assert.equal(store.save({plank:valid()}).ok,false); assert.equal(storage.getItem('fc_refs'),raw);
  assert.equal(store.erase().ok,true); assert.equal(storage.getItem('unrelated'),'keep');
  assert.equal(store.save(store.pending).ok,true);
  assert.equal(new E.ReferenceStore(storage).refs.plank.frames.length,1);
});
test('Quota failure retains prior demos and an exportable draft; explicit retry persists it', () => {
  const storage = new Storage(), store = new E.ReferenceStore(storage); store.save({plank:valid()});
  const raw = storage.getItem('fc_refs'); storage.fail = true;
  const next = {...valid(),fps:10};
  assert.equal(store.save({plank:next}).ok,false);
  assert.equal(store.refs.plank.fps,15); assert.equal(storage.getItem('fc_refs'),raw);
  assert.equal(E.parseReferenceBundle(JSON.stringify(store.pending)).plank.fps,10);
  assert.match(store.message,/could not be saved/);
  assert.equal(store.erase().ok,false); assert.equal(storage.getItem('fc_refs'),raw);
  storage.fail = false; assert.equal(store.save(store.pending).ok,true); assert.equal(store.pending,null);
  assert.equal(new E.ReferenceStore(storage).refs.plank.fps,10);
});
test('A stale writer cannot overwrite a newer saved collection', () => {
  const storage = new Storage(), a = new E.ReferenceStore(storage), b = new E.ReferenceStore(storage);
  a.save({plank:valid()}); const raw = storage.getItem('fc_refs');
  assert.equal(b.save({squat:valid()}).ok,false); assert.equal(storage.getItem('fc_refs'),raw);
  assert.equal(b.refs.squat,undefined); assert.ok(b.pending.squat); assert.match(b.message,/another window/);
});
test('The combined store budget preserves its previous data when the next collection is too large', () => {
  const storage = new Storage(), store = new E.ReferenceStore(storage), names = Object.keys(E.M);
  const ref = {...valid(),frames:Array.from({length:600},()=>Object.fromEntries(
    ['ear','shoulder','elbow','wrist','hip','knee','ankle','heel','toe'].map(j=>[j,[1.123456789,-1.23456789]])))};
  let failed = false;
  for(const id of names){
    const before = storage.getItem('fc_refs'), result = store.save({[id]:ref});
    if(!result.ok){
      failed = true; assert.match(result.message,/1 MiB/); assert.equal(storage.getItem('fc_refs'),before);
      assert.equal(store.refs[id],undefined); assert.ok(store.pending[id]); break;
    }
  }
  assert.equal(failed,true,'Budget was actually reached');
});
