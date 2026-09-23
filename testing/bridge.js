/* Injected ONLY by the loopback test server. Never shipped in the build.
   Landmark mode bypasses camera acquisition, inference, animation scheduling and
   audio playback. Original UI handlers, core, applyFx and debrief remain intact.
   Video mode uses real inference and loopBody, but file input replaces a webcam. */
voiceChk.checked = false;
const testEffects = [];
let testNow = 0, testCore = null;
const testLandmarks = [];
const testOriginalCamera = openCamera;
const testApplyFx = applyFx;
applyFx = (host, effects) => {
  testCore = host.core;
  testEffects.push(...effects.map(e => ({ ...structuredClone(e), testTime: testNow })));
  testApplyFx(host, effects);
};
openCamera = async () => {
  canvas.width = 1280; canvas.height = 720;
  running = true; lastT = 0; lastVideoTime = -1;
  msgEl.hidden = true;
  startBtn.textContent = 'End'; startBtn.classList.add('live');
  showCamChrome(true);
};
window.__testLab = {
  installPlan(plan) { if (PLANS.some(p => p.id === plan.id)) throw new Error('Duplicate test plan'); PLANS.push(plan); },
  drawDemo(dt = 1 / 30) { drawDemo(dt); },
  drawGhost() {
    const id = (sess && sess.mvId) || calibMv, ref = refFor(id);
    if (!ghostChk.checked || !ref) throw new Error('Ghost not enabled or reference missing');
    drawRef(ctx, refPose(ref, testNow), canvas.width, canvas.height, true);
  },
  realCamera() { openCamera = testOriginalCamera; },
  mockModel(fail = false) { initModel = async () => {
    if (fail) throw new Error('Deliberate model startup failure');
    window.__testModelCalls = 0;
    return { detectForVideo: () => { window.__testModelCalls++; return { landmarks: [] }; } };
  }; },
  audioAccess() { return { Coach, AudioBank, TTL, coach }; },
  diagnosticAccess() { return { diagnostics, DiagnosticBuffer }; },
  renderAccess() { return { apply:effects=>applyFx(calib || sess,effects),ring:setRing,
    telemetry:(r,state)=>renderTelemetry(r,(calib || sess).core.ev,state),clock:TelLog }; },
  coachAccess() { return {routeCoachAction,parseCoachCommand,coachMemory,listener:localListener,
    context:coachContextToken,host:calib || sess,preferences:()=>({...coachPreferences})}; },
  profileAccess() { return {profileGoals,PROFILE_KEY}; },
  snapshot() {
    const core = testCore || calib?.core || sess?.core;
    const last = t => testEffects.findLast(e => e.t === t)?.payload ?? null;
    return { index: core?.i ?? null, movement: core?.mvId ?? null, done: core?.done ?? false,
      state: core?.state ?? null, observation: testEffects.findLast(e => e.t === 'telem')?.r ?? null,
      held: core?.ev?.hold ?? 0, scoreN: core?.scoreN ?? 0, out: core?.out ?? [],
      reps: core?.ev?.rep?.display() ?? 0,
      calibration: last('calibFinish'), finish: last('finish') };
  },
  feed(frame, dt) {
    testNow += dt;
    const host = calib || sess;
    if (!host) throw new Error('No active core for landmark replay');
    testCore = host.core;
    host.tick(frame, dt, testNow);
  },
  effects: () => testEffects,
  landmarks: () => testLandmarks,
  videoDimensions() { canvas.width = video.videoWidth; canvas.height = video.videoHeight; },
  async prepareVideo(url) {
    await loadVision();
    const vision = await FilesetResolver.forVisionTasks('/node_modules/@mediapipe/tasks-vision/wasm');
    landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: '/model.task', delegate: 'CPU' }, runningMode: 'VIDEO', numPoses: 1
    });
    const detector = landmarker;
    landmarker = { detectForVideo(input, time) {
      const result = detector.detectForVideo(input, time);
      testLandmarks.push({ t: testNow, aspect: canvas.width / canvas.height, landmarks: result.landmarks[0] || null });
      return result;
    } };
    Object.defineProperty(performance, 'now', { configurable: true, value: () => testNow * 1000 });
    video.srcObject = null; video.src = url; video.muted = true;
    await new Promise((resolve, reject) => {
      video.onloadeddata = resolve; video.onerror = () => reject(new Error('Video could not be decoded'));
      video.load();
    });
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  },
  async videoFrame(at, dt) {
    if (at >= video.duration) throw new Error('Recording ends before the scenario timeline');
    if (Math.abs(video.currentTime - at) > .00001) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Video seek timed out')), 10000);
        video.onseeked = () => { clearTimeout(timer); resolve(); };
        video.currentTime = at;
      });
    }
    testNow += dt;
    // Run the actual rendering/inference/frame-building loop, with deterministic
    // frame timestamps. Do not replace buildFrame or the model output.
    lastVideoTime = -1;
    lastT = (testNow + 1) * 1000 - dt * 1000;
    const before = testLandmarks.length;
    const disabled = sess?.core.paused || calib?.core.paused ? 'paused' : sess?.core.following && !calib && !recMode ? 'unassessed' : null;
    loopBody((testNow + 1) * 1000);
    if (disabled) {
      if (testLandmarks.length !== before) throw new Error(`Inference ran during ${disabled} video replay`);
      // Retain the tick for exact replay without claiming that a model looked
      // for a person and found none. The timeline supplies the mode actions.
      testLandmarks.push({ t: testNow, aspect: canvas.width / canvas.height,
        landmarks: null, inference: `disabled-${disabled}` });
    } else if (testLandmarks.length !== before + 1) {
      throw new Error('Expected one real inference for an assessed video frame');
    }
    return { at, width: canvas.width, height: canvas.height };
  }
};
