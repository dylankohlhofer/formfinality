import test from 'node:test';
import assert from 'node:assert/strict';
import { auditAudio, audioReviewPage } from './audio-review.mjs';
import { findings } from './report.mjs';
const state = { phase: 0, movement: 'plank', observation: { pose: 'good', since: 0 } };
const item = { id: 1, key: 'goodhold', text: 'Good.', requestedMs: 0, ttl: 2500, requestedState: state };
const evidence = () => ({ events: [
  { type: 'capture-start', ms: 0, state },
  { type: 'speech-start', ms: 0, item, state },
  { type: 'clip-start', ms: 20, playId: 2, path: 'voice/test.mp3', item, state },
  { type: 'clip-end', ms: 1020, playId: 2, state },
  { type: 'capture-end', ms: 1100, state }
], levels: [{ ms: 100, playId: 2, rms: .1 }], decoded: { seconds: 1.1, rms: .1 }, limitations: [] });
const failures = e => auditAudio(e).checks.filter(c => !c.pass).map(c => c.label);
test('healthy recorded speech passes independent rules', () => assert.deepEqual(failures(evidence()), []));
test('missing recorder cannot pass', () => { const e = evidence(); e.events.shift(); assert.match(failures(e).join(), /Capture/); });
test('truncated recording cannot pass on one audible sample', () => { const e = evidence(); e.decoded.seconds = .4; assert.match(failures(e).join(), /capture interval/); });
test('silent waveform is not a playback pass', () => { const e = evidence(); e.decoded.rms = 0; assert.match(failures(e).join(), /non-silent/); });
test('NaN decoded signal cannot pass', () => { const e = evidence(); e.decoded.rms = NaN; assert.match(failures(e).join(), /non-silent/); });
test('one silent clip cannot hide behind another audible clip', () => { const e = evidence(); e.levels = []; assert.match(failures(e).join(), /measured signal/); });
test('actual overlap is detected from simultaneous signal', () => {
  const e = evidence(); e.levels = [100, 160].flatMap(ms => [2, 3].map(playId => ({ ms, playId, rms: .1 })));
  assert.match(failures(e).join(), /overlapping/);
});
test('sequential clips do not count as overlap', () => {
  const e = evidence(); e.levels = [{ ms: 100, playId: 2, rms: .1 }, { ms: 200, playId: 3, rms: .1 }];
  assert.deepEqual(failures(e), []);
});
test('late speech is detected even if native playback succeeds', () => {
  const e = evidence(); e.events[1].ms = 3000; assert.match(failures(e).join(), /expiry/);
});
test('old-phase teaching is detected', () => {
  const e = evidence(); e.events[1].state = { ...state, phase: 1, movement: 'glute-bridge' };
  assert.match(failures(e).join(), /current exercise/);
});
test('later parts of an already-started sentence cannot escape stale-phase checks', () => {
  const e = evidence(); e.events[2].state = { ...state, phase: 1, movement: 'glute-bridge' };
  assert.match(failures(e).join(), /abandoned exercise/);
});
test('unresolved spoken variable fails', () => {
  const e = evidence(); e.events[1].item = { ...item, text: 'Hold for {t}.' }; assert.match(failures(e).join(), /placeholders/);
});
test('restarted identical speech fails', () => {
  const e = evidence(); e.events.push({ ...e.events[1], ms: 500 }); assert.match(failures(e).join(), /three seconds/);
});
test('repetition across variants remains a review candidate', () => {
  const e = evidence(); for (const ms of [11000, 22000]) e.events.push({ ...e.events[1], ms, item: { ...item, requestedMs: ms, text: `Variant ${ms}` } });
  assert.deepEqual(failures(e), []); assert.equal(auditAudio(e).concerns[0].rule, 'repetition');
});
test('praise during no observations is flagged, not certified semantically', () => {
  const e = evidence(); e.events[1] = { ...e.events[1], ms: 2000, state: { ...state, observation: { pose: 'lost', since: 0 } } };
  assert.equal(auditAudio(e).concerns[0].rule, 'context');
});
test('native TTS is explicitly a waveform coverage gap', () => {
  const e = evidence(); e.events.push({ type: 'tts-request', item, ms: 0, state });
  assert.match(auditAudio(e).gaps[0], /NOT captured/);
});
test('playback errors survive the app swallowing them', () => {
  const e = evidence(); e.events.push({ type: 'clip-error', error: 'decode failed' }); assert.match(failures(e).join(), /playback/);
});
test('sound after stop fails', () => {
  const e = evidence(); e.events.push({ type: 'action', action: 'stop', ms: 100, state });
  e.levels.push({ ms: 800, playId: 2, rms: .1 }); assert.match(failures(e).join(), /Stop silences/);
});
test('review renderer escapes speech and marks intended text, not transcription', () => {
  const e = evidence(); e.events[1].item = { ...item, text: '<img src=x onerror=bad()>' };
  const page = audioReviewPage({ id: 'case', description: 'test' }, e, auditAudio(e));
  assert.ok(!page.includes('<img src=x')); assert.match(page, /not an audio transcription/);
});
test('review concerns and TTS gaps remain visible in main findings', () => {
  const f = findings([{ id: 'audio', checks: [], concerns: [{ detail: 'Repetition', ms: 1 }], audioGaps: ['No waveform'] }]);
  assert.equal(f.length, 2); assert.match(f[0].kind, /human judgement/); assert.equal(f[1].kind, 'coverage gap');
});
