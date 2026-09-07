# Automated test and review loop

One scenario describes timed observations, interruptions and independently stated
expectations. Engine replay, browser testing and recorded-video inference use that
same scenario. Production fixes and deliberate vector refreshes are documented
separately; see the dated findings and `docs/project-status.md`.

## Start

Requires Node 20+; Node 22 is used in CI.

```sh
npm ci
npx playwright install chromium
npm test
```

`npm test` runs infrastructure self-tests, all four original verification harnesses,
then engine and desktop/narrow Chromium scenarios. An assertion failure exits 1.
It also sweeps all **21 movements / 44 supported movement-tier pairs**, rendering
each in both desktop and narrow viewports (**88 exercise browser cases**), and
checks all 12 supported plan-tier combinations plus calibration, camera and voice
queue paths. It does not invent support for unavailable exercise tiers.
It also runs real-time audio capture cases and deliberate audio-capture mutations
(a healthy control, muted clips, overlapping playback and preserved initial silence).
Missing human recordings are explicitly **coverage incomplete**, not a video pass.
Use `--require-video` to make that coverage gap exit 2.

**Regression retained:** First Steps discovered and now protects the fix for the
v4.11 calibration exception. See [FC-LAB-001](findings/calibration-has-demo.md).
Unexpected exceptions must fail; do not turn them into expected failures.

**Retained findings:** [guided off-screen start](findings/guided-offscreen-start.md)
is now fixed at all three Cat–Cow tiers. A separate
[calibration demo rendering defect](findings/calibration-demo-label.md) was also
discovered by the expanded shell sweep. Consult those records for fix status.

**Historical review (7 September):** 17 supplied screen recordings were sampled;
see [the timestamped review](../docs/sessions/historical-recording-review-2026-09-07.md).
They are not clean camera inputs or recovered landmarks. Two new default scenarios
protect [active-state rep position/framing loss](findings/active-rep-position-loss.md)
(FC-LAB-006): after one valid push-up, upright elbow bends or off-screen cycles
previously produced four reps instead of one. The fixed engine/browser paths now
preserve one rep; both original assertions remain. Scenario snapshots expose the actual rep counter.
Personal images/audio/OCR remain local in ignored test results; no human footage
was added to CI. Existing synthetic exercise coverage is unchanged.

**Historical fixes (7 September):** `coach-regressions.test.mjs` adds 18 independent
checks for interrupted cycles/recovery, quality-blocked setup, readiness repetition,
framing wording and unscored bridge motion. The default runner/watch/CI invokes it
against the explicitly selected build and saves `coach-regressions.log` in the
report. Seven more shell cases protect camera error reasons, failed-model cleanup,
prompt withdrawal on recovery and the unscored bridge debrief; real-time audio adds a reminder budget assertion.
The browser/Swift scoring change deliberately refreshes only nine score checkpoint
fields (plus provenance); tolerances and other recorded expectations are unchanged.
See `docs/sessions/historical-fixes-2026-09-07.md` for the policy and limits.

## The loop

**Local-first stack improvements (7 September):** the default suite now also runs
six diagnostic-buffer tests and nine worker-queue tests, plus 17 speech-privacy,
three diagnostic UI and three coaching-context shell cases. The original 18
coaching regressions remain. `coach-regressions.log`, `diagnostics.log` and
`worker-queue.log` retain their results against the saved run build where applicable.
The production recorder lives under **Private diagnostics** below the camera.
It is off by default; no video/audio or automatic upload is added. Its imported
JSON is validated and displayed as text. Exports include the running module's
SHA-256 and configured pose-model identity, not independently verified model bytes.
See [the local-stack handover](../docs/sessions/local-stack-2026-09-07.md).

**New user review, after that green baseline:** `reported-session.test.mjs` retains
five checks in the default loop. Three currently **fail**: the easier-movement prompt
survives recovery, a neck-only clipping event cancels otherwise observed crunch cycles,
and the mobile diagnostic control is covered. Two controls pass (toe-only clipping
does not veto leg raises; entirely off-screen cycles cannot earn reps). These are
open application failures, not whitelisted expected outcomes. Run just these with
`node --test testing/reported-session.test.mjs`; details and recording limitations
are in `docs/sessions/current-recording-review-2026-09-07.md`.

Focused interface cases (same cases as the default suite):

```sh
node testing/check-shell.mjs form-coach-v4.11.html 'privacy-*'
node testing/check-shell.mjs form-coach-v4.11.html 'diagnostic-*'
node testing/check-shell.mjs form-coach-v4.11.html 'coaching-*'
```

The isolated worker experiment is not shipped in the live camera loop:

```sh
npm run test:worker                           # queue tests + local CPU benchmark
node testing/worker-benchmark.mjs GPU         # separate, explicitly labelled GPU run
```

Both paths process blank synthetic frames through the real pinned MediaPipe model.
Reports include latency, main-thread timer delay, dropped frames and errors, with
the model checksum. Run benchmarks without other test browsers/watchers competing
for resources. A passing benchmark proves wiring, not real-exercise accuracy,
mobile GPU speed, battery life or thermal stability. See the handover for results.

```sh
npm run test:watch
```

Runs immediately, then reruns when app/scenario/harness inputs change. Runs are
serialized and debounced; changes during a run cause one follow-up run. Ctrl+C stops
it. This is a foreground watcher, not an installed background service. Each run
keeps its own evidence and failing scenarios repeat once in a fresh context.
GitHub Actions also runs on pushes/PRs once this workflow is pushed, and preserves
reports even when the app fails. No API key, paid model calls or cloud video service.

Open the directory named in `test-results/LATEST.txt`, then `index.html` or `REVIEW.md`.
The report includes expectations, actual results, evidence links and coverage
boundaries. Each case keeps `scenario.json`, `result.json`, and browser screenshots,
console/page errors and `trace.zip`. Use `npx playwright show-trace <trace.zip>` for
an interactive reconstruction. Legacy suite output is in the four `.log` files.

The report now opens with an **exercise coverage board**, also saved as
`coverage.json`: every movement, supported tiers, engine and browser results,
evidence links, and real-video/device gaps. `exercise-inputs.mjs` contains synthetic
bilateral geometry derived from the surviving pose fixtures, not from the app's
demo drawings. `exercise-sweep.mjs` declares independent behavioral expectations.
`exerciseScenarios` builds the reviewable timeline saved for each exercise case.
The test-only single-exercise plans are injected only into the served copy; real
plan availability is tested separately through the original picker.

Fast isolated library checks:

```sh
node testing/run.mjs --build form-coach-v4.11.html --library-only --mode engine
node testing/run.mjs --build form-coach-v4.11.html --library-only --mode browser
```

The engine sweep checks arming, stationary reps, synthetic completion, skip/null
scoring, tracking loss/recovery, clipping, wrong view, explicit regressions and
hold timing at 15/30/60fps. Counter tests cover fast/shallow cycles; controlled
driver metrics additionally exercise the real evaluator → counter → session cue
path, asserting that rejected attempts are explained. Those metric-level tests
are distinct from claims about anatomical form. Mutation self-tests deliberately
invent zero skip scores and break a counter to verify that the checks fail.

Engine contract-case files use `schema: "exercise-contract/1"`, not the browser
timeline schema. They document their actual input anchors and variants (including
clipping), and include a reproduction command for the engine sweep. Their
`events.json` includes the clipped input and resulting state as well as sampled
events. Do not pass a contract file to `--scenario-file`, which accepts timeline
cases only; use its recorded `reproduce` command instead.

Library event evidence retains all control, speech and event effects plus telemetry
every 30 frames, rather than storing every repetitive UI update. Completion payloads
retain their full 5Hz score traces. Original short scenarios keep their full effects.

Build, scenario, fixture, dependency-lock and test-bridge hashes identify inputs;
`build.html` is saved per run. The Git commit is recorded too (the working tree may
contain additional changes). Reproduce an archived test without using a changed case:

```sh
node testing/run.mjs --build test-results/<run>/build.html --mode browser \
  --scenario-file test-results/<run>/<case>/scenario.json
```

No automatic retention/deletion runs locally. Evidence may contain personal data when
you explicitly supply recordings; keep it local and delete individual run directories
deliberately when no longer needed. CI generates only non-human synthetic footage.

## Real video and faster replay

```sh
npm run test:setup-video
npm run test:video
```

The setup downloads the app's version-1 lite model and verifies its committed SHA-256.
The video smoke generates four seconds of a blank canvas, sends 90 frames through
real MediaPipe and the app's original rendering loop, and checks no observations
become a score. This proves the adapter works, **not** real-exercise accuracy.
Inference uses CPU for portability, not the shipped GPU delegate.

For a consented recording, author a scenario describing the actual footage and its
independently reviewed expectations. Put the video in ignored `testing/private/`:

```sh
node testing/run.mjs --build form-coach-v4.11.html --mode all \
  --scenario first-steps --recording testing/private/consented-first-steps.mp4 --require-video
```

The scenario must match the clip: `frames` segments consume consecutive video time at
30 samples/second; clicks/skips take no footage time. Use an appropriately edited clip
or a separate scenario; do not relabel arbitrary footage to fit an expected result.
The initial First Steps fixture is synthetic, not ground truth about a recording.
`--scenario-file` accepts another independently authored JSON case.

Video runs save raw detections in `landmarks.json`. Replay without running the model:

```sh
node testing/run.mjs --build form-coach-v4.11.html --mode engine \
  --scenario skip-and-dropout --landmarks test-results/<run>/<case>/landmarks.json
```

Recording validation requires 30fps monotonic timestamps, valid dimensions and exact
scenario frame count. No-detection frames are `null`. Conversion uses the app's own
`buildFrame`; expected scores are never copied from model output.

## Agent operating contract

1. Run the committed suite; read the scenario, oracle and evidence.
2. Distinguish an app defect, harness defect, coverage gap and unconfirmed usability
   concern. Reproduction confirms the failure, not automatically its cause.
3. Save newly discovered cases and independent expectations in Git. Never generate
   expected scores from the implementation being checked.
4. Keep production fixes separate and explain causal evidence. Preserve vectors;
   follow AGENTS.md for deliberate behaviour changes and Swift parity.
5. Rerun the focused scenario and complete baseline. Preserve failures and limitations.

This is an automatic **test → reproduce → report** loop. It does not install an
unattended AI agent that edits code, invents test oracles or spends API credits.
An agent can add scenarios and fix reviewed defects using this evidence in a later
development turn. Human review remains necessary for new movement judgements.

## Recorded voice and coaching review

```sh
npm run test:audio
npm run test:audio -- --scenario skip-during-teaching
npm run test:audio:mutations
```

This is part of `npm test`, the default watcher, and the existing GitHub Actions
workflow once pushed. The watcher also reruns on voice MP3/manifest changes.
Thirteen cases cover sustained plank feedback, hip-sag input and recovery,
tracking loss, Skip/Stop during teaching, expired queue items, and real number
clips for all nine persona/tier selections. The last nine are **playback samples**,
not full exercise sessions. They give both numbers an explicit 3000ms deadline;
they do not represent two simultaneous rep events with the app's shorter deadline.

Open **Listen and review the speech timeline** in the main report. Each case saves:

- `audio.webm`: the actual decoded MP3 mix recorded by Chromium, playable locally.
- `audio-review.html`: seekable audio, intended wording, exercise/input state,
  clip start/end, queue drops, review candidates and coverage gaps.
- `audio.json`: wall-clock events, per-clip signal levels, decoded recording
  measurements, manifest and used-clip hashes.
- `screen.webm`: a separate silent screen recording; its startup offset is **not
  measured**, so use the audio/event timeline for timing assertions.
- `scenario.json`, session `inputs.json`, screenshots, browser trace and errors.

`audio-cases.json` contains the longer case inputs and independent expectations.
Audio case files use `schema: "audio-case/1"`, not the accelerated timeline schema;
use their saved `--mode audio --scenario <id>` reproduction command. Source/clip
hashes identify changes between runs; real playback timing is not bit-for-bit
deterministic. Failing rules and review candidates repeat in a fresh browser context and retain both
captures. Matching failed rule names indicates reproduction, not identical timing.

The engine runs at wall-clock speed with original `Coach.speaking()` gating and
actual media completion events. No fast-forwarding while clips play. The test-only
Web Audio tap routes media elements into a recorder instead of the speakers.
An always-running zero-signal source preserves silence before the first clip;
otherwise some captures omit that wait and misalign the timeline. A permanent
check verifies the captured duration and that the saved local review plays/seeks.
It measures silence and overlapping signal, checks expiry and stale phase context,
and catches unresolved placeholders or rapid identical speech restarts.
New segments of a spliced sentence are also checked against the current phase;
an utterance starting before Skip does not exempt its later clips.
Repetition (three occurrences of a cue in 60 seconds, excluding numbers), praise
during sustained bad/missing input and speech continuing across Skip are **review
candidates**, not automatic proof that the wording is wrong. Thresholds are
explicit test policies, not measurements of beginner comprehension.

Regression record: [old movement audio after Skip, now fixed](findings/voice-after-skip.md).
The shell sweep also protects cancelled-clip callbacks, keyboard/button Skip,
rest/debrief transitions and calibration verdict speech. The original capture
case requires next-exercise teaching to play after cancellation.
Frequency policy fixed; listening review remains: [visibility reminders](findings/voice-repetition.md). A passing signal
check is not approval of the coaching experience.

Important limits:

- Text is the app's selected wording, **not a transcription**. Wrong words inside
  an MP3, pronunciation, encouraging tone and meaning still need listening/review.
- Browser-generated `SpeechSynthesis` audio is **not in the captured waveform**.
  Native local voice start/end/error events are logged; missing local voices are
  labelled unavailable, not simulated as successful speech. Remote voices are
  blocked to avoid sending text outside the device. TTS use appears as a coverage
  gap even when other checks pass. Captured silence cannot establish TTS silence.
  The production app now enforces local-only routing too, including preview.
  The harness records a coverage gap when production rejects an unavailable local
  voice before calling `speak()`; it must not mistake that for tested audio output.
- Media-element capture is not microphone/system-audio capture, speaker audibility
  or physical-device validation. These scenarios use synthetic landmarks; they
  do not yet combine audio with the accelerated MediaPipe video replay mode.
- The runner makes no cloud transcription/model calls, uploads or production edits.
  Reports and recordings stay in ignored `test-results/` locally; CI uploads
  synthetic-test evidence only. No microphone/camera permission is requested.

Implementation references: [media-element routing](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaElementSource),
[recordable audio destination](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamDestination)
and [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder).

## Boundaries

- Landmark browser mode runs real DOM handlers, effects and debrief. Camera
  acquisition, inference, animation scheduling and audio playback are bypassed.
- Video mode runs inference, geometry conversion and the original rendering loop;
  a video file and controlled clock replace the webcam and wall time.
- Tests use fallback fonts, no external requests, and loopback-only asset serving.
  One exact native `INFO` startup message is classified as informational and still
  saved; unexpected console errors and all uncaught page errors fail the test.
- Viewport checks are not physical-device tests. Speaker/native-TTS audio, permissions,
  camera flipping and real-time performance on actual devices need more coverage.
  The dedicated shell sweep tests the real camera handlers with a substituted local
  stream/permission error, and real voice queues with simulated audio completion.
  All-exercise demos/ghosts are checked for successful drawing, not recognisability.
  Dedicated audio cases add actual recorded-clip playback/signal coverage separately.
- Historical human screen recordings have been reviewed locally, but no clean-camera
  exercise replay is claimed. Beginner test 02 is not replaced.
