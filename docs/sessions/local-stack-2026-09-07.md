# Local-first stack improvements — 7 September 2026

The user authorised this sequence: local-only speech, private replayable diagnostics,
stronger coaching state, then an isolated worker prototype and benchmark. No server,
cloud inference, automatic upload or paid API was added. The build remains v4.11;
the verified artifact hash identifies the precise revision.

## Implemented in the application

### Local-only speech

Both session speech and **Hear it** preview now select only English voices whose
platform-provided `localService` is exactly `true`. Cached/selected voices are
revalidated at every utterance. A missing local voice never falls through to an
unspecified browser default. Recorded clips still work; unavailable/error paths
release the speech gate and explain the limitation on screen.

The voice picker also filters remote/unproven voices, handles changing inventories
and renders names as text. This closes a second preview-only escape path as well
as the original remote-voice preference. The browser/OS supplies the locality flag;
physical-device/network validation is still a release check.

Reference: [SpeechSynthesisVoice.localService](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService).

### Private diagnostics

Open **Private diagnostics** below the camera, opt in, then choose **Start recording**.
Use **Flag this moment** when something seems wrong. Pause/Resume preserves retained
details; Clear or unchecking consent erases them. Recording never starts itself and
does not survive a reload. Export is an explicit local JSON download, not an upload.

The buffer retains at most 4 MiB / 4,000 entries and counts older entries discarded.
It captures joint coordinates/confidence, engine/camera timing, measured targets,
scores including null, blockers, suppressions, rep-counter state, phase transitions,
requested/queued/dropped/completed/failed/cancelled speech and media playback events.
No camera pixels, microphone input or audio waveform is recorded. Intended speech
text can contain the entered name: these exports are personal data, not anonymous.

Stop the camera to review. The local viewer supports timeline scrubbing/playback,
an unmirrored skeleton, a brief event summary and expandable technical details.
It displays **saved observations and decisions**, not re-running the pose model or
re-evaluating a truncated session. The exports are not conformance vectors or
independently reviewed test expectations. Missing old entries cannot be reconstructed.

Exports fingerprint the running JavaScript module and name the configured model,
runtime and delegate. This is not a fingerprint of the whole HTML/CSS or the actual
downloaded model bytes. Imported fingerprints are reported provenance, not a signature
or proof of authenticity. File size, structure, finite numbers, clock ordering and
complexity are checked before display; imported content is never executed as markup.

### Coaching state

Session and Calibration emit current coaching facts separately from rate-limited
cue requests. The playback layer cancels obsolete form/readiness/praise utterances,
discards obsolete pending items and ignores abandoned completion callbacks. A cue
being cooldown-limited is not interpreted as a resolved fault.

For contextual topics, the same continuing condition is not queued repeatedly and
a successfully completed sequence has a 20-second repeat budget. Resolution clears
that history, so recurrence can be explained; failed playback does not falsely count
as a completed instruction. Existing 30-second readiness budgeting still applies.
Rep-event explanations, numbers, teaching and phase controls retain their own rules.
Timeouts stop underlying playback before letting the queue continue.

No exercise thresholds, scoring policy, movement declarations, reference drawings
or vector expectations changed in this work. The Session/Calibration speech-policy
classes are not in Swift yet; the existing evaluator/counter port is unchanged.

## Worker prototype — deliberately not enabled in production

`testing/worker-pose.js` loads the pinned MediaPipe model inside a dedicated worker.
`worker-queue.mjs` allows one transferred frame in flight and one replaceable pending
frame. It closes discarded bitmaps, rejects old-generation/aged results and retains
the original capture timestamps. Reset does not pretend an in-flight task vanished.

Nine independent queue tests cover freshness, backpressure, reset, disposal, errors,
timestamp rejection, unknown callbacks and a reentrant result consumer. They run
in the normal test/watch/CI path. The heavier benchmark is explicit:

```sh
npm run test:worker
node testing/worker-benchmark.mjs GPU
```

Reference: [MediaPipe's worker guidance](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js).

### Isolated desktop measurements

Same 640×360 blank canvas, 12 warm-up observations, then 90 submitted frames with
a nominal 30fps cadence. No person, camera permission or external request is needed.
Model checksum: `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`.

| Delegate / path | Accepted timed samples | p95 inference | p95 result age | p95 main-thread timer delay | Timed wall duration |
|---|---:|---:|---:|---:|---:|
| CPU / main | 90 | 12.8ms | 12.9ms | 10.7ms | 3.00s |
| CPU / worker | 90 | 11.9ms | 12.0ms | 1.1ms | 3.01s |
| GPU / main | 90 | 156.4ms | 156.4ms | 166.8ms | 13.16s |
| GPU / worker | 19 | 166.2ms | 170.7ms | 1.0ms | 3.21s |

Local evidence: `test-results/worker-benchmark-Gpm6Ue/` (CPU) and
`test-results/worker-benchmark-90Xcey/` (GPU). The GPU worker processed 22 of 90
submitted frames: 68 pending frames were replaced and three results exceeded the
200ms freshness limit. The reported worker latency samples are accepted results,
not all submitted frames. Neither mode produced a person detection.

These are single-run results on one desktop Chromium configuration, not a general
speed guarantee. The GPU delegate label does not establish physical GPU acceleration
in headless Chromium. Blank-frame detection is not the tracked-person landmark
workload, and the slow main-thread GPU run did not sustain its target cadence.
No concurrent test browser was running during these two measurements.

Decision: promising responsiveness, insufficient evidence to replace the app loop.
Next gate: real-exercise inputs on physical target phones, measuring counting/hold
accuracy, timestamp behaviour, frame loss, battery/temperature and camera lifecycle.
Do not simply feed a different observation cadence into the session and assume parity.

## Remaining boundaries

The application still loads its existing runtime/model/font assets externally at
startup; this work does not add offline installation or remove those dependencies.
Diagnostic import/replay is local once the application is loaded. No TypeScript,
framework, pose-model replacement or production worker migration was performed.

New unrendered phrases require a verified local TTS voice or remain visual-only.
The audio harness captures recorded MP3 output, not native-TTS waveforms or speakers.
Existing real-person/device coverage gaps and beginner test 02 remain release gates.

## Verification

`npm test` exits 0 against the final artifact: 59 infrastructure tests, 18 historical
coaching regressions, six diagnostic-buffer tests, nine worker-queue tests; 48 engine
cases / 1,207 checks, 96 browser cases / 694 checks, 50 shell cases / 293 checks,
13 audio cases / 238 checks. Original harnesses: 4,127 conformance checks, eight
mutations, 250 drawing checks and 26 skip checks. Swift remains 18/18.

Evidence: `test-results/2026-09-07T18-21-56-328Z-32487/` (local/ignored).
Whole HTML SHA-256: `c1b75ca9c116802c6eb09d0616c14172e850e875c9e790809f73cafade82571d`.
Running module SHA-256: `ca51cfebcb36953fa6d7d04d5692792926de399f8a3a785a3d2828e5836acd25`.
Static checks found no unresolved literal DOM IDs, undefined CSS variables, duplicate
named functions or mismatched effect handlers. Runtime classes and selected-state
rules remain styled; global `[hidden] !important` remains. Only one native speech
invocation remains, in the verified-local-voice path. Diagnostic review was visually
inspected. No vector, content or Swift files changed.

Five video entries remain coverage gaps; two audio cases each report an uncaptured
native-TTS fallback. No speech review candidates occurred in this synthetic run.
This is not a claim that physical-device speech or real-exercise behaviour is sound.
The user supplied a new recording and diagnostic export after this verification;
their reported failures require a separate review, not dismissal because tests passed.
