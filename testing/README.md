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
checks all 12 declared plan-tier combinations (nine available, three deliberately
excluded at Strong) plus calibration, camera and voice queue paths. It does not
invent support for unavailable exercise tiers.
It also runs real-time audio capture cases and deliberate audio-capture mutations
(a healthy control, muted clips, overlapping playback and preserved initial silence).
Missing human recordings are explicitly **coverage incomplete**, not a video pass.
Use `--require-video` to make that coverage gap exit 2. It requires `--mode all`
or `--mode video` without `--library-only`; engine/browser/audio-only selections
exit 2 immediately. A required-video run needs actual passed video results, not
merely the absence of a blocked row.

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

**Review fixes (23 September):** `references.test.mjs` and `references-*` shell
cases cover the developer demo recorder's malformed/oversized/atomic imports,
legacy coordinate conversion, corrupt-store fallback, scoped reset, quota/stale
writes, export/retry and late file-read callbacks. No recorded people are used.
`duo-sync.test.mjs` also requires unknown confirmation before successful sync,
separate acknowledged/pending routine-days, strict upload field validation and
a Drive response mock that respects the requested incomplete-search field.
Both use the existing default/watch/CI loop; provider access remains simulated.

**Web release/economics (23 September):** `web-release.test.mjs` and
`economics.test.mjs` run in default/watch/CI. They protect allowlisted packaging,
model hashes, symlink/path and size rejection, no overwrite, unchanged engine
module and explicit commercial assumptions. Fake asset fixtures are not inference
evidence. `npm run test:release:smoke -- --dir dist/<exact-build>` separately
checks the emitted artifact with real local runtime/model bytes and blank CPU
inference; CI runs it after model setup. It records same-origin requests, UI
preview, screenshot and clip decoding, not pronunciation or physical-device QA.
See [build/release gates](../docs/web-release.md).

**Local profile/weekly goals (23 September):** `profile-goals.test.mjs` and the
`profile-*` shell cases run in the same default/watch/CI suite. They exercise
separate opt-in, completed-routine eligibility, unassessed labels, fixed civil
timezone/week boundaries, day caps, duplicate finishes, next-week goal changes,
bounded storage/failure/erase and actual desktop/narrow controls. Email-link
tests intercept navigation: no mail is sent and no account is connected.
These do not validate CloudKit, Drive, native apps, delivery or fitness progress.
See [the implemented/planned boundary](../docs/profile-duo-contract.md).

**Duo transport spike (23 September):** `duo-sync.test.mjs` runs two simulated
accounts through the existing profile completion path, a durable local outbox,
weekly reconciliation and a mocked Google Drive HTTP adapter. It covers offline
and lost replies, duplicate/conflicting UUIDs, DST/week rollover, quota and
revoked access, account isolation, no pre-pair backfill and a
disable-during-request race. It does
**not** connect Google accounts, send data, prove `drive.file` cross-owner
visibility or validate native OAuth/consent. The real-account gate is documented
in [the Duo contract](../docs/profile-duo-contract.md).

```sh
node --test testing/profile-goals.test.mjs
node --test testing/duo-sync.test.mjs
node testing/check-shell.mjs form-coach-v4.11.html 'profile-*'
```

**Architecture optimisations (14 September):** `architecture.test.mjs` adds 11
deterministic conversion, no-pressure append complexity, byte-accounting and
transactional retention checks. Four `architecture-*` cases use the existing
shell runner for unchanged DOM writes, continuous dial progress and cache
invalidation/freshness. They run in default/watch/CI; benchmarks do not gate CI.

```sh
node --test testing/architecture.test.mjs
node testing/check-shell.mjs form-coach-v4.11.html 'architecture-*'
node testing/architecture-benchmark.mjs <baseline.html> form-coach-v4.11.html
```

Run the optional serial benchmark without competing tests/watchers. It records
build hashes, five alternating workload samples, snapshot equivalence and pose
conversion counts. It uses synthetic data, substituted drawing and no model or
private recordings. Buffer timings are not full-app FPS, heap or physical-phone
battery/thermal measurements. See [the review and measurements](../docs/sessions/architecture-optimisations-2026-09-14.md).

**Adversarial review and authorized fixes (14 September):** `adversarial.test.mjs` adds
198 seeded control, uneven-cadence, diagnostic round-trip and accelerated long-session
checks. The initial eight browser cases reproduced five application defects through
six failures: pending camera cleanup, duplicate animation chains, overlapping wake
locks, malformed diagnostic blocker lists and a stale import-error callback. The
original failing evidence is retained. The user subsequently authorized repairs;
all original assertions remain, with ten additional browser cases covering restart
success/failure, wake-lock grant ordering/retry and overlapping diagnostic imports.
The resulting **18 cases / 89 checks** pass in the focused shell run. Six additional
parser tests check both diagnostic schemas and frame/summary records, including
valid absent/null/empty blocker lists. Engine, vectors and Swift are unchanged.
See [findings, reproduction and verification](../docs/sessions/adversarial-review-2026-09-14.md).

```sh
node --test testing/adversarial.test.mjs
node testing/check-shell.mjs form-coach-v4.11.html 'adversarial-*'
```

**Full-code review fixes (14 September):** `review-regressions.test.mjs` adds 70
independent checks for view-eligible scoring, camera-coordinate/visibility rules,
calibration continuity, every demo's return interpolation and unsupported plan
startup/retiering and recorded-instruction completeness. Seventeen new shared clip
cases and all eight historical clip rows test the actual browser resolver; Swift
reads the same cases. Eight appended shared evidence cases bring JavaScript/Swift
parity to 35. Five new shell cases use real modal controls to disable substituted
local recognizers and finish an interrupted calibration. Five infrastructure
checks protect required-video selection and exit status. Five further `review-*`
shell cases cover pending/failed/stale camera replacement, honest unavailable-view
telemetry and full local speech fallback when recorded words are absent. A harness
invocation regression requires all four legacy suites to read the archived build,
never a changed working file. A real archived-build mutation run and three faulty
verifier controls also protect path portability and prevent false-green controls.
All use the existing
default/watch/CI loop; no new parallel harness or real microphone is introduced.
`refresh-review-view.mjs --write` is a manual-only, seven-field migration across
three historical view scenarios, not an oracle generator. See
[the fix record](../docs/sessions/code-review-fixes-2026-09-14.md).
`refresh-review-speech.mjs --write` deliberately changes only the historical Rest
case with a missing prefix: complete local fallback, not an isolated number.

**Evidence-backed summaries (14 September):** `summary.test.mjs` adds 50 checks
and `summary-cases.mjs` adds ten browser cases through this same runner. The
HTML-first `workout-summary/1` envelope is built from recorded work, not inferred
fatigue, setup causes, perfect form or historical progress. Skips, early stops,
guided and follow-along sets cannot acquire assessment highlights. Previously
watched work still counts once; the best-hold tile excludes guided time.
The mobile/desktop cases also protect measurement-limit disclosure, navigation,
no summary persistence and the honest browser `template` source label.

```sh
node --test testing/summary.test.mjs
node testing/check-shell.mjs form-coach-v4.11.html 'summary-*'
swift test --package-path swift/FormCoachEngine
```

`summary-selection-vectors.json` contains 22 independently authored selection
cases shared by JavaScript and native `FormCoachSummary`; the full runner records
its hash and retains `summary.log`. Selection can return only one or two distinct
approved card IDs, never new prose or measurements. Deliberate invalid-selection
and causal-claim mutations must still be detected. Actual evaluator-to-summary
cases protect Crunch neck alignment (not pulling) and movement-appropriate
Push-Up/Knee Push-Up advice.

The existing GitHub Actions workflow now has a macOS Swift job as well as the
browser job. Swift tests validate the envelope, selection and asynchronous failure
paths using local stubs. **They do not run Apple's model by default.** The opt-in
synthetic model smoke is:

```sh
FORM_COACH_LOCAL_MODEL_SMOKE=1 swift test --package-path swift/FormCoachEngine --filter LocalModelSmokeTests
```

Read its availability/status output: unavailable is a coverage gap, not successful
model inference. The smoke uses the coordinator's default ten-second budget with
an immediate usable template. The first local Mac probe took about five seconds;
this motivated increasing the initial three-second policy. A model-smoke pass on
one Mac is not evidence of cold-start latency or acceptable performance across
phones. No cloud provider, personal workout input or feedback upload is used.
The browser has no native bridge and does not run a language model. See
[the contract](../docs/workout-summary-contract.md).

**Interface review (14 September):** `interface.test.mjs` adds 56 core/structural
checks; `interface-cases.mjs` adds 13 shell cases in the same runner. Workout
selection now opens a preview; tests explicitly choose Start workout. End opens a
paused confirmation and preserves an honest partial debrief. Pause/background,
calibration interruption, four viewport layouts, navigation and camera-cancellation
races have durable coverage. A fifteenth real-time audio case requires actual
correction playback before Pause, prompt silence, no speech while paused and fresh
observed work after Resume. Video replay marks deliberately paused inference
intervals explicitly without weakening the assessed-frame checks.
Geometry checks wait for rendering (the accelerated pose feed is not a paint
clock); a deliberate portrait-overlap mutation must still fail both original
overlap assertions. They are not retried until green.

```sh
node --test testing/interface.test.mjs
node testing/check-shell.mjs form-coach-v4.11.html 'ui-*'
node testing/run.mjs --build form-coach-v4.11.html --mode audio --scenario pause-cancels-correction
```

See [the feature-by-feature review](../docs/sessions/interface-review-2026-09-14.md).
These are browser/software contracts, not physical-phone, accessibility or beginner
usability certification. The full `npm test` still runs all original harnesses and
existing recognition, privacy, diagnostics and audio checks.

**Body/clothing robustness (14 September):** `body-tolerance.test.mjs` runs 235
software checks in default test/watch/CI. Stable required-observation side selection
and all-tier scale/mirror/follow-along checks are not real-body accuracy validation.
Ten appended shared evidence cases bring browser/Swift parity to 27 rows; the
original rows and root conformance vectors remain unchanged. The default
`clothing-side-recovery` and `follow-along-unassessed` scenarios use the existing
engine/browser runner. Four `follow-along-*` shell cases check actual controls,
layout, honest completion in portrait/landscape/desktop and inference suspension
through the real animation loop with synthetic video. A fourteenth wall-clock
audio case captures correction cancellation and fresh teaching on mode change.
Follow-along is explicit,
unassessed, and per set: no automatic camera credit or calibration tier verdict.
The low-score automatic hold-shortening rule was removed. See
[the policy, deliberate test migrations and remaining gaps](../docs/sessions/body-clothing-tolerance-2026-09-14.md).

**Four-exercise partial-visibility pack:** run `npm run test:partial` to select
Squat, Crunch, Leg Raise and Plank in this same runner (engine, desktop/narrow
browser, saved screenshots/traces, automatic failure reproduction and explicit
video gaps). No new app, model, dashboard or recording format is introduced.
`npm run test:partial -- --mode engine` is the quick counting-only pass.
The four scenarios are also discovered by default test/watch/CI, and 30 companion
tests run as `partial-visibility` in the default regression loop, including all
nine supported exercise-tier pairs and deliberate false-credit mutations.
Read [the pack guide](partial-visibility.md) for the cases, existing recording
provenance and narrowly specified new-evidence needs. Missing-ankle counting/hold
recognition remains explicitly incomplete in both JSON/HTML and `REVIEW.md`, even
when the no-false-credit checks pass. The existing audio suite remains separate:
these accelerated browser scenarios do not capture or judge speech.

**Local-first stack improvements (7 September):** the default suite also runs
17 diagnostic-buffer tests, 120 setup-prompt tests and thirteen worker-queue tests,
plus 17 speech-privacy, seven diagnostic UI and ten coaching-context/lifecycle shell cases. The original 18
coaching regressions remain. `coach-regressions.log`, `diagnostics.log` and
`worker-queue.log` retain their results against the saved run build where applicable.
`setup-prompt.log` retains timing, observation and recovery checks at 15/30/60fps.
The production recorder lives under **Private diagnostics** in the header.
It is off by default; no video/audio or automatic upload is added. Its imported
JSON is validated and displayed as text. Exports include the running module's
SHA-256 and configured pose-model identity, not independently verified model bytes.
See [the local-stack handover](../docs/sessions/local-stack-2026-09-07.md).

**New user review and subsequent fixes:** `reported-session.test.mjs` retains
five checks in the default loop. All five now pass: easier-movement prompt recovery,
mobile recorder access, toe-only leg-raise clipping, the wholly off-screen negative
control and neck-only clipping during otherwise observed Crunch cycles. No original
expectation was inverted or whitelisted. Run just these with
`node --test testing/reported-session.test.mjs`; details and recording limitations
are in `docs/sessions/current-recording-review-2026-09-07.md`.

**Movement evidence (8 September):** `movement-evidence.test.mjs` adds 229 independent
engine checks, while `evidence-parity.test.mjs` and Swift consume the same 17 cases
in `movement-evidence-vectors.json`. Both suites run against the saved build in the
default loop and retain their named logs. `crunch-partial-quality` adds an engine
and two browser timelines with screenshots, real counter/form effects, interruption
and recovery. Missing optional quality is not a rep veto; missing required drivers
and gates do not disappear. Source changes break unfinished reps, and unavailable
form contributes no score, cue or tint. Invalid/degenerate geometry and stale score
history have dedicated regressions. These are synthetic software contracts, not
validation of a knee-only Leg Raise driver or a Plank with hidden required ankles.
See `docs/movement-evidence-contract.md` and the dated implementation handover.

The deliberate vector migration changed only `ok`, `blocking` and `suppressed` in
`crunch-needs-the-ear`, plus provenance. That input still has straight legs, so
its bent-knee position fails and its score/reps/hold remain unchanged. The migration
script `refresh-movement-evidence.mjs --write` is manual-only, not an automatic
oracle regeneration step in test/watch/CI. The content change names the existing
optional Leg Raise foot-orientation hint explicitly; it changes no thresholds.

**Recorder/prompt follow-up:** `docs/sessions/recorder-prompt-fixes-2026-09-07.md`
documents the implementation and deliberate policy changes. The fixed, scrollable
diagnostic drawer does not resize the camera. Start/Resume closes it; a header quick
flag remains available during exercise. The session timeline records events plus
periodic/changed-state summaries; recent full-rate frames roll off. Up to eight flags
retain available ±10-second joint windows at up to 5Hz, not complete full-rate replay.
The 4 MiB serialized-export / 4,000-entry limit remains. If protected records fill it,
capture pauses with a visible notice and preserves existing evidence. Clear/reload
still erase everything. Schema 2 exports record retention boundaries; schema 1
imports do not acquire invented protection. No camera video or sound is recorded.

Optional easier-movement help has a 5s setup grace then requires 6s continuous visible
quality difficulty, known camera view and observed passing position targets. Recovery
or missing evidence immediately withdraws it; each movement can offer once. It stays
visual until accepted. Earlier 7s/8s tests deliberately now hold difficulty for 12s,
preserving their original offer/recovery assertions. Evaluator thresholds and vectors
are unchanged. Physical-phone usability and beginner interpretation remain unvalidated.

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

Video runs save raw detections in `landmarks.json`. Explicit follow-along intervals
retain timed null rows marked `inference: "disabled-unassessed"`, not failed model
detections; the scenario replays the same mode actions. Assessed frames still require
exactly one real inference. Replay without running the model:

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
Sixteen cases cover sustained plank feedback, hip-sag input and recovery,
tracking loss, Skip/Stop during teaching, switching to unassessed follow-along,
expired queue items, and real number
clips for all nine persona/tier selections. The last nine are **playback samples**,
not full exercise sessions. They give both numbers an explicit 3000ms deadline;
they do not represent two simultaneous rep events with the app's shorter deadline.
Each number must now actually start, complete and contain its own measured signal;
queue decisions plus one audible number cannot pass an incomplete sample. Whole-
line watchdog timeouts and failed recorded utterances are also explicit failures.

**Stall recovery (14 September):** `audio-stalls.test.mjs` adds 12 deterministic
startup/progress, retry, cancellation and deadline checks to default/watch/CI.
`coaching-stalled-calibration` proves failed teaching does not strand actual
calibration. Two additional real-media fault tests run in `npm test` and
`test:audio:mutations`: one unanswered first request recovers via a fresh element;
a permanently absent second number stays a failed capture and releases its queue.
The player checks progress every two seconds, retries at most once before a line
starts and respects its original first-start deadline. Stalled partial instructions
are not replayed or advanced into their remaining fragments. `clip-stalled` events
and retry decisions are retained in the audio timeline. See
[the causal tests and limits](../docs/sessions/audio-stall-recovery-2026-09-14.md).

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
action clock is captured at actual DOM click dispatch, before the app's handler;
Playwright's scrolling/actionability wait is not cancellation latency. A dedicated
unit regression delays dispatch by 400 ms and verifies that boundary. Older runs
marked click intent earlier; do not read that delay as a measured app response.
The test-only
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
The tap also distinguishes cancellation of a still-pending `play()` from failed
playback: only an `AbortError` following an observed pause of the **same request**
is recorded as `clip-cancelled`. The original rejection still reaches the app;
the pause, error name/message and request ID remain in the review evidence.
Four additional capture tests protect real cancellation/element reuse and ensure
unrequested aborts, paused decode failures and stale cancellation history still
fail. See `docs/sessions/audio-pending-cancellation-2026-09-08.md` for the original
failed run and its passing reproduction; neither was discarded.
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

## Local coaching and optional AI review

The default loop now also runs the `interaction`, `local-coach`,
`local-command-listener`, `ai-review` and `review-workflow` regression suites.
They cover evidence-backed explanations, exact typed/spoken command routing,
destructive-action confirmations, authored-plan constraints, independent local
memory consent, microphone lifecycle and stale/private review rejection. The
shell sweep exercises the actual new controls on desktop and narrow viewports.
Shared command and choice JSON vectors are consumed by JavaScript and Swift.

Finalized repository-synthetic runs prepare `review-evidence.json` and
`review-status.json` beside the existing report. Default tests, watch and CI
never invoke AI or a real microphone. An explicit local review of a named run is:

```sh
npm run test:review -- --run test-results/<exact-run>
```

This calls the native on-device selector and validates its chosen existing
candidate IDs against freshly rehashed evidence. It cannot create expected
results, erase failures or pronounce unselected gaps solved. Unavailable models
remain unavailable, not simulated passes. Private recordings, landmark imports
and external scenarios are excluded; historical reports need a new synthetic
run, not a manufactured provenance receipt. See [the review contract](ai-review.md)
and [the product interaction contract](../docs/local-coach-contract.md).

Microphone tests use substituted recognizers; they do not establish accent/noise
accuracy, local-pack availability, physical permissions, echo handling on phone
speakers or battery use. Native UI/session cores remain unported.

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
