/* Test-copy only. Real wall time, real MP3 decoding and original Coach/AudioBank.
   A Web Audio tap captures app media elements, NOT OS output or SpeechSynthesis.
   No microphone, webcam, paid service or remote speech voice is used. */
window.__audioLab = (() => {
  const events = [], levels = [], items = new WeakMap(), attached = new WeakSet();
  let ctx, destination, recorder, clockSource, origin, sequence = 0, activeItem = null, invoking = null;
  let observation = { pose: 'none', since: 0 }, latest = null, sampler, stopped = false;
  const live = new Map(), chunks = [];
  const now = () => Math.round((performance.now() - origin) * 10) / 10;
  const state = () => {
    const c = calib?.core || sess?.core;
    return { phase: c?.i ?? null, movement: c?.mvId ?? null, done: c?.done ?? false,
      state: c?.steps?.[c.i]?.rest != null ? 'rest' : c?.state ?? null,
      reps: c?.ev?.rep?.display() ?? null, held: c?.ev?.hold ?? 0,
      observation: { ...observation }, score: latest?.score ?? null, cue: latest?.cue ?? null };
  };
  const log = (type, data = {}) => {
    const e = { type, ms: now(), state: state(), ...data }; events.push(e); return e;
  };
  const describe = item => {
    if (!items.has(item)) items.set(item, { id: ++sequence, key: invoking?.key ?? 'raw',
      text: item.text, clips: item.clips, priority: item.pri,
      requestedMs: item.at - origin, ttl: Number.isFinite(item.ttl) ? item.ttl : null,
      requestedState: state(), vars: invoking?.vars ?? {} });
    return items.get(item);
  };
  // Observe decisions without replacing queue selection, timing, audio events or callbacks.
  const say = coach.say, raw = coach.raw, push = coach.push, start = coach.start, drain = coach.drain, reset = coach.reset;
  coach.say = function(key, options = {}) {
    invoking = { key, vars: options.vars || {} };
    log('request', invoking);
    try { return say.call(this, key, options); } finally { invoking = null; }
  };
  coach.raw = function(text, ...args) {
    invoking = { key: 'number', vars: { number: Number(text) } }; log('request', { ...invoking, text });
    try { return raw.call(this, text, ...args); } finally { invoking = null; }
  };
  coach.push = function(item) {
    const meta = describe(item), old = this.cur, pending = this.pending;
    log('selected', { item: meta });
    const result = push.call(this, item);
    if (old && this.cur !== old) log('interrupted', { item: describe(old) });
    if (this.pending === item) log('queued', { item: meta });
    if (this.cur !== item && this.pending !== item) log('dropped', { item: meta, reason: 'queue-priority' });
    if (pending && pending !== this.pending && pending !== this.cur) log('dropped', { item: describe(pending), reason: 'pending-replaced' });
    return result;
  };
  coach.start = function(item) {
    activeItem = describe(item); log('speech-start', { item: activeItem });
    return start.call(this, item);
  };
  coach.drain = function() {
    if (activeItem) log('speech-finish', { item: activeItem });
    activeItem = null;
    const p = this.pending, result = drain.call(this);
    if (p && this.cur !== p) log('dropped', { item: describe(p), reason: 'expired' });
    return result;
  };
  coach.reset = function() { log('reset'); activeItem = null; return reset.call(this); };
  const fx = applyFx;
  applyFx = (host, effects) => {
    latest = effects.findLast(e => e.t === 'telem')?.r ?? latest;
    for (const effect of effects) if (['say', 'num', 'reset', 'finish', 'calibFinish', 'bigLabel'].includes(effect.t))
      log('effect', { effect });
    return fx(host, effects);
  };
  const get = AudioBank.get;
  AudioBank.get = function(path) {
    const a = get.call(this, path);
    if (!a || attached.has(a)) return a;
    attached.add(a);
    const source = ctx.createMediaElementSource(a), analyser = ctx.createAnalyser();
    analyser.fftSize = 2048; source.connect(analyser); analyser.connect(destination);
    // Only the recorder receives sound: no surprise speaker playback during CI.
    const data = new Float32Array(analyser.fftSize);
    let playId;
    const play = a.play.bind(a), pause = a.pause.bind(a);
    a.play = () => {
      playId = ++sequence;
      log('clip-request', { playId, path, item: activeItem });
      return play().catch(error => { log('clip-error', { playId, path, error: error.message }); throw error; });
    };
    const end = reason => {
      if (!live.has(a)) return;
      log('clip-end', { playId: live.get(a).playId, path, reason }); live.delete(a);
    };
    a.pause = () => { end('paused'); return pause(); };
    a.addEventListener('playing', () => {
      if (live.has(a)) return;
      live.set(a, { playId, analyser, data });
      log('clip-start', { playId, path, item: activeItem });
    });
    a.addEventListener('ended', () => end('ended'));
    a.addEventListener('error', () => log('clip-error', { playId, path, error: a.error?.message || 'Media decode/load failed' }));
    return a;
  };
  // Preserve native local TTS events, but explicitly exclude its waveform. Remote
  // platform voices could upload text outside browser request routing, so block them.
  const speak = speechSynthesis.speak.bind(speechSynthesis);
  speechSynthesis.speak = u => {
    const local = speechSynthesis.getVoices().filter(v => v.localService && v.lang.startsWith('en'));
    const item = activeItem;
    log('tts-request', { item, text: u.text, waveformCaptured: false });
    if (!local.length) {
      log('tts-unavailable', { item, reason: 'No installed local English voice; not simulated as audible.' });
      queueMicrotask(() => u.onerror?.({ error: 'test-local-voice-unavailable' })); return;
    }
    if (!u.voice?.localService) u.voice = local[0];
    for (const name of ['start', 'end', 'error']) u.addEventListener(name, e => log('tts-' + name, { item, error: e.error }));
    return speak(u);
  };
  return {
    async begin({ persona: personaId, tier: tierId, seed = 12345 }) {
      origin = performance.now();
      // Repeatable variant selection, NOT a replacement phrase bank.
      Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      persona = personaId; tier = tierId; voiceChk.checked = true;
      ctx = new AudioContext(); destination = ctx.createMediaStreamDestination();
      // An unconnected destination can omit the wait before the first clip.
      // Keep the graph clocked with literal zero samples, preserving initial
      // silence and the audio/event offset. This adds NO synthetic audible signal.
      clockSource = ctx.createConstantSource(); clockSource.offset.value = 0;
      clockSource.connect(destination); clockSource.start();
      await ctx.resume();
      if (ctx.state !== 'running') throw new Error('Audio context did not start');
      recorder = new MediaRecorder(destination.stream, { mimeType: 'audio/webm;codecs=opus' });
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder.onerror = e => log('capture-error', { error: e.error?.message || 'Recorder failed' });
      recorder.start(250); log('capture-start', { contextTime: ctx.currentTime, sampleRate: ctx.sampleRate });
      sampler = setInterval(() => {
        for (const { playId, analyser, data } of live.values()) {
          analyser.getFloatTimeDomainData(data);
          let sum = 0, peak = 0;
          for (const v of data) { sum += v * v; peak = Math.max(peak, Math.abs(v)); }
          levels.push({ ms: now(), playId, rms: Math.sqrt(sum / data.length), peak });
        }
      }, 20);
    },
    observe(pose) { observation = { pose, since: now() }; log('observation'); },
    mark(action) { log('action', { action }); },
    state,
    queueExpiry() {
      coach.say('teach.plank', { vars: { t: 30 }, pri: 3 });
      coach.say('sag', { pri: 2, ttl: 200 });
    },
    // This is a playback-order sample, not two simultaneous rep counts. Give
    // the second number an explicit 3s deadline; real expiry has its own case.
    sequence() { coach.raw('1', 2, 3000); coach.raw('2', 2, 3000); },
    async finish() {
      if (stopped) throw new Error('Capture already stopped'); stopped = true;
      log('capture-end'); coach.reset(); clearInterval(sampler);
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Recorder stop timed out')), 5000);
        recorder.onstop = () => { clearTimeout(timeout); resolve(); }; recorder.stop();
      });
      const bytes = await new Blob(chunks, { type: recorder.mimeType }).arrayBuffer();
      const decoded = await ctx.decodeAudioData(bytes.slice(0));
      let sum = 0, peak = 0, count = 0;
      for (let c = 0; c < decoded.numberOfChannels; c++) for (const v of decoded.getChannelData(c)) {
        sum += v * v; peak = Math.max(peak, Math.abs(v)); count++;
      }
      let binary = ''; const data = new Uint8Array(bytes);
      for (let i = 0; i < data.length; i += 8192) binary += String.fromCharCode(...data.subarray(i, i + 8192));
      clockSource.stop(); destination.stream.getTracks().forEach(t => t.stop()); await ctx.close();
      return { schema: 'audio-evidence/1', events, levels, mime: recorder.mimeType, base64: btoa(binary),
        decoded: { seconds: decoded.duration, samples: count, rms: Math.sqrt(sum / count), peak },
        limitations: ['Capture is the app media-element mix, not speakers, microphone or OS output.',
          'Displayed wording is selected application text, NOT a transcription of the recording.',
          'SpeechSynthesis waveform is not captured; local native events are logged; remote voices are blocked.',
          'Synthetic frames and real wall time are used. No human motion or model inference is implied.'] };
    }
  };
})();
