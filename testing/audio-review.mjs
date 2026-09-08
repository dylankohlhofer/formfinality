import { escape } from './report.mjs';

// Independent, explicit policies. Heuristics produce review candidates, not a
// claim that the model has listened to (or understood) the captured waveform.
export function auditAudio(evidence) {
  const checks = [], concerns = [], events = evidence.events || [], levels = evidence.levels || [];
  const check = (label, actual, expected, pass = actual === expected) => checks.push({ label, actual, expected, pass });
  const starts = events.filter(e => e.type === 'speech-start');
  const captures = events.filter(e => e.type === 'capture-start');
  check('Capture started exactly once', captures.length, 1);
  const ends = events.filter(e => e.type === 'capture-end');
  check('Capture completed exactly once', ends.length, 1);
  const wallSeconds = ((ends[0]?.ms ?? NaN) - (captures[0]?.ms ?? NaN)) / 1000;
  check('Recording covers the measured capture interval (500ms tolerance)', evidence.decoded?.seconds,
    wallSeconds, Number.isFinite(wallSeconds) && Math.abs(evidence.decoded?.seconds - wallSeconds) < .5);
  check('Captured audio decodes to non-silent samples', evidence.decoded,
    'finite duration > 0.25s and RMS > 0.0001', Number.isFinite(evidence.decoded?.seconds) && evidence.decoded.seconds > .25 &&
      Number.isFinite(evidence.decoded?.rms) && evidence.decoded.rms > .0001);
  const failures = events.filter(e => ['clip-error', 'capture-error'].includes(e.type));
  check('No media load, playback or capture errors', failures, [], failures.length === 0);
  const clips = events.filter(e => e.type === 'clip-start');
  check('At least one real clip actually started', clips.length, '> 0', clips.length > 0);
  for (const clip of clips) {
    const end = events.find(e => e.type === 'clip-end' && e.playId === clip.playId);
    if (!end || end.ms - clip.ms < 250) continue; // intentional short interruption; retained in timeline
    const audible = levels.some(l => l.playId === clip.playId && l.rms > .0001);
    check(`Clip ${clip.playId} contains measured signal`, audible, true);
  }
  // Use measured per-source signal, not just overlapping media lifetimes (which
  // include silence and asynchronous end events). Require two adjacent windows.
  const windows = new Map();
  for (const l of levels.filter(l => l.rms > .001)) {
    const bin = Math.floor(l.ms / 50); if (!windows.has(bin)) windows.set(bin, new Set());
    windows.get(bin).add(l.playId);
  }
  const overlap = [...windows].filter(([bin, ids]) => ids.size > 1 && windows.get(bin + 1)?.size > 1).map(([bin]) => bin * 50);
  check('No sustained overlapping recorded voices', overlap, [], overlap.length === 0);
  const expired = starts.filter(e => e.item.ttl !== null && e.ms - e.item.requestedMs > e.item.ttl + 80);
  check('Speech never starts after its expiry deadline (80ms scheduling tolerance)', expired.map(e => e.item), [], !expired.length);
  const stale = starts.filter(e => e.item.requestedState.phase !== e.state.phase || e.item.requestedState.movement !== e.state.movement);
  check('Newly started speech belongs to the current exercise phase', stale.map(e => ({ ms: e.ms, item: e.item, state: e.state })), [], !stale.length);
  const staleClips = clips.filter(e => e.item && (e.item.requestedState.phase !== e.state.phase || e.item.requestedState.movement !== e.state.movement));
  check('New recorded segments never belong to an abandoned exercise phase', staleClips.map(e => ({ ms: e.ms, playId: e.playId, path: e.path, key: e.item.key })), [], !staleClips.length);
  const unresolved = starts.filter(e => /\{[a-z]\}/i.test(e.item.text));
  check('Spoken text contains no unresolved placeholders', unresolved.map(e => e.item.text), [], !unresolved.length);
  const rapid = starts.filter((e, i) => starts.slice(0, i).some(p => p.item.key === e.item.key &&
    p.item.text === e.item.text && p.state.phase === e.state.phase && e.ms - p.ms < 3000 && e.item.key !== 'number'));
  check('Identical non-count speech is not restarted within three seconds', rapid.map(e => ({ ms: e.ms, text: e.item.text })), [], !rapid.length);
  const countAt = new Map();
  for (const e of starts) {
    const key = `${e.state.phase}/${e.item.key}`;
    const previous = (countAt.get(key) || []).filter(t => e.ms - t <= 60000); previous.push(e.ms); countAt.set(key, previous);
    if (previous.length === 3 && e.item.key !== 'number') concerns.push({ rule: 'repetition', ms: e.ms,
      detail: `${e.item.key} spoken three times within 60 seconds in the same phase. Review frequency and wording.`, item: e.item });
    const pose = e.state.observation?.pose, age = e.ms - (e.state.observation?.since ?? e.ms);
    if (['fixed', 'goodhold', 'goodrep'].includes(e.item.key) && ['lost', 'sag'].includes(pose) && age > 1000)
      concerns.push({ rule: 'context', ms: e.ms, detail: `Praise begins during sustained ${pose} input. Review evidence; this is not an anatomical verdict.`, item: e.item });
    if (e.item.key === 'sag' && pose === 'good' && age > 2000)
      concerns.push({ rule: 'context', ms: e.ms, detail: 'Hip correction begins after recovery input has persisted for over two seconds.', item: e.item });
  }
  for (const action of events.filter(e => e.type === 'action' && e.action === 'skip')) {
    const crossing = clips.filter(c => c.ms < action.ms && events.some(e => e.type === 'clip-end' && e.playId === c.playId && e.ms > action.ms + 1000));
    if (crossing.length) concerns.push({ rule: 'speech-across-skip', ms: action.ms, detail: 'Abandoned-phase audio continues more than one second after Skip.', clips: crossing.map(c => c.playId) });
  }
  const stopped = events.findLast(e => e.type === 'action' && e.action === 'stop');
  if (stopped) {
    const after = levels.filter(l => l.ms > stopped.ms + 250 && l.rms > .001);
    check('Stop silences the recorded coach within 250ms', after.length, 0);
  }
  const tts = events.filter(e => e.type === 'tts-request');
  return { checks, concerns, gaps: tts.length ? [`${tts.length} fallback speech request(s): waveform NOT captured; see native TTS events.`] : [],
    summary: { selected: events.filter(e => e.type === 'selected').length, started: starts.length,
      clips: clips.length, expired: events.filter(e => e.type === 'dropped' && e.reason === 'expired').length,
      tts: tts.length, reviewCandidates: concerns.length } };
}

export function audioReviewPage(scenario, evidence, audit) {
  const rows = evidence.events.filter(e => ['speech-start', 'clip-start', 'clip-end', 'clip-pause-request', 'clip-cancelled', 'clip-error', 'dropped', 'tts-request', 'tts-unavailable', 'observation', 'action'].includes(e.type));
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Voice review — ${escape(scenario.id)}</title>
  <style>body{font:16px/1.5 system-ui;max-width:1100px;margin:32px auto;padding:0 20px;color:#222}table{border-collapse:collapse;width:100%}td,th{padding:8px;border-bottom:1px solid #ccc;text-align:left;vertical-align:top}small{color:#555}audio{width:100%}button,a{color:#534693}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style>
  <h1>${escape(scenario.id)} — voice review</h1><p>${escape(scenario.description)}</p>
  <p>Listen to actual decoded app clips. Text below is the app's intended wording, <strong>not an audio transcription</strong>. Missing TTS sound is a coverage gap, never evidence of silence.</p>
  <audio id="audio" controls preload="metadata" src="audio.webm"></audio><p><a href="audio.json">Full timestamped evidence and audio levels</a> · <a href="screen.webm">Screen recording (silent; audio is above)</a> · <a href="scenario.json">Saved test case</a></p>
  <p>Capture starts at ${(evidence.events.find(e => e.type === 'capture-start')?.ms / 1000).toFixed(2)}s on the event clock. Screen recording starts earlier; its offset is unmeasured. Timeline buttons seek the audio, not the video.</p>
  <h2>Checks and review candidates</h2><ul>${audit.checks.map(c => `<li>${c.pass ? 'PASS' : 'FAIL'}: ${escape(c.label)}</li>`).join('')}
  ${audit.concerns.map(c => `<li>REVIEW at ${(c.ms / 1000).toFixed(2)}s: ${escape(c.detail)}</li>`).join('')}
  ${audit.gaps.map(g => `<li>COVERAGE GAP: ${escape(g)}</li>`).join('')}</ul>
  <h2>Speech and exercise timeline</h2><table><thead><tr><th>Time</th><th>Event</th><th>Exercise / input</th><th>Intended words or clip</th></tr></thead><tbody>
  ${rows.map(e => `<tr><td><button data-seek="${Math.max(0, (e.ms - (evidence.events.find(x => x.type === 'capture-start')?.ms || 0)) / 1000)}">${(e.ms / 1000).toFixed(2)}s</button></td><td>${escape(e.type)}<br><small>${escape(e.reason || e.action || e.error || '')}</small></td><td>${escape(e.state.movement || 'no session')}<br><small>${escape(e.state.state || '')} · ${escape(e.state.observation.pose)}</small></td><td>${escape(e.item?.text || e.path || '')}<br><small>${escape(e.item?.key || '')}</small></td></tr>`).join('')}</tbody></table>
  <h2>Limits</h2><ul>${evidence.limitations.map(l => `<li>${escape(l)}</li>`).join('')}</ul>
  <script>document.querySelectorAll('[data-seek]').forEach(b=>b.onclick=()=>{document.getElementById('audio').currentTime=Number(b.dataset.seek)});</script></html>`;
}
