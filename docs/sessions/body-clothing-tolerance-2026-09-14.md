# Body and clothing tolerance — 14 September 2026

## Decision

Keep the current on-device stack. Improve use of observable movement, provide an
explicit unassessed workout path, and validate real performance before replacing
the pose model or learning personal thresholds. No weight/BMI/body-size detector,
body category, tighter-clothing requirement, cloud inference, paid training service,
new recording format, or automatic personal-data upload has been added.

Larger bodies are part of the target audience, not an exceptional “bad form” case.
Body shape/proportions, limb overlap, fabric, light, camera position and restricted
range can affect different parts of the pipeline. The available screen recordings
cannot identify which caused a particular landmark failure: they do not contain the
original landmark/confidence timeline. A synthetic low-confidence joint is a test
of our response, not a simulation of adipose tissue or a hoodie.

## Implemented

1. **Stable movement-side selection.** The adapter's shoulder/hip-based camera
   preference previously overrode an otherwise complete visible wrist/knee/ankle
   chain on the other side. The evaluator now retains a usable side, switching only
   if the current side lacks required camera measurements and the alternative has
   all of them. This is availability selection, never best-form selection. Required
   metric definitions, confidence thresholds, view gates and range/tempo are unchanged.
   Complementary incomplete sides cannot be stitched together. A genuine driver
   switch still breaks an unfinished rep while preserving completed work.
2. **Provenance through the shell and Swift.** Results record requested/selected
   sides, and tint is drawn on the measured side. Optional easier-movement setup
   checks use that same selected side. `arm()` clears the set-local preference.
   Browser evaluator changes were mirrored in Swift, with shared cases.
3. **No automatic score-driven set shortening.** Removed the rule that converted one
   score below 55 into “five more seconds,” permanently changing the target and its
   halfway milestone. A camera score does not establish fatigue. Existing gates
   still pause measured holds; easier movement, Skip and Stop remain available.
   This also addresses the independently reproduced policy defect in the
   [9 September review](user-test-review-2026-09-09.md), not every recognition issue
   in that recording.
4. **Follow along (unassessed), for the current set.** An explicit button is available
   with the demonstration controls, including when no pose has been detected.
   Choosing it cancels old corrective speech and repeats the movement's teaching.
   Camera preview remains open, but live pose inference and camera judging are
   bypassed for that set. “TIMER · UNASSESSED” measures elapsed time only;
   **Finish this set** is manual, for both reps and holds. No automatic completion,
   inferred reps, measured hold seconds, form score or ability verdict is generated.
   Demonstrations remain available. The next movement returns to assessed setup.
5. **Honest debrief/export.** Followed sets are named and tagged unassessed, with no
   numeric performance verdict or form insight. Previously observed work, if any,
   remains in session totals/average once; unobserved time never enters them. CSV
   events distinguish entering/finishing follow-along from Skip. Private diagnostics
   identify the state without calling intentionally disabled tracking a failure.
   Calibration retains its existing skip path; it cannot classify unassessed work.

This is a current-set escape hatch after opening the camera, **not** a complete
camera-free onboarding flow or an answer to denied camera permission. Automatic
personalised ROM/quality tolerances have not been introduced: learning the initial
pose as “correct” could silently normalise a fault. Existing chosen tiers and
exercise alternatives remain the adaptation mechanisms.

## Model choice and research

Google provides Lite, Full and Heavy on-device Pose Landmarker bundles; changing
the model does not require an application server. The published BlazePose GHUM
model card reports stronger aggregate landmark results for Full than Lite, with
a compute trade-off. It also documents degradation under difficult image conditions
and approximate/guessed occluded landmarks. Its subgroup evidence does not establish
our exercise accuracy across body sizes or clothing. These are reasons to compare
Full locally, not evidence that switching will fix this app.
Sources: [Pose Landmarker overview](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker),
[BlazePose GHUM model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf).

Keep Lite as the shipping model until the existing video runner and a physical
phone compare Lite/Full on the same consented clips: correct/missed/false reps,
hold interruption, false corrections, time to readiness, frame latency and sustained
performance. Do not infer model fairness from our synthetic geometry checks or a
blank-frame worker benchmark. No model download/replacement occurred in this change.

## Durable tests and deliberate changes

- `testing/body-tolerance.test.mjs`: 235 checks, including all 44 supported tier
  pairs at three scale/mirror settings, six straight-Plank segment-ratio cases,
  45 occlusion cases across five movements / three frame rates / three loss modes,
  source stability, no best-form shopping, no incomplete-side stitching, partial
  interruption/recovery, arm reset, target policy, and all-tier unassessed completion.
- Ten independent cases were **appended** to `movement-evidence-vectors.json`
  (27 total). The original 17 rows and all 1,896 root conformance rows are unchanged.
  Browser/Swift consume the same transformations/expected results.
- Three old JavaScript source-policy tests changed deliberately: complete alternate
  camera evidence is now selected with provenance; the two actual-source-change
  tests hide the original driver to force a genuine switch. All no-false-credit
  assertions remain. The corresponding Swift source-change test was updated likewise.
  Initial run before that migration: 226/229 passed, exactly those three failed.
- `clothing-side-recovery` and `follow-along-unassessed` are default shared
  engine/desktop/narrow scenarios, with screenshots, tracing, saved inputs and
  explicit real-person/video gaps. Four additional shell cases cover portrait,
  landscape and desktop reachability, notice/timer/control separation, debrief and
  inference suspension/resumption through the real animation loop with synthetic video.
- `follow-along-cancels-correction` is the fourteenth real-time audio case: it
  captures audible correction before the choice, silence from old clips after it,
  fresh recorded teaching and no subsequent corrective speech in unassessed mode.
  Capture is decoded MP3 output, not native TTS, physical speakers or a transcript.
- Recorded-video replay retains intentionally unassessed ticks with explicit
  `disabled-unassessed` markers. It still requires exactly one inference per
  assessed tick, and rejects unexpected inference during follow-along. A permanent
  infrastructure regression includes missing, duplicate and unexpected-call
  negatives. These adapter checks are not human-video recognition coverage.
- First UI run found the follow-along control hidden when setup had no frames.
  Showing the setup controls when a movement starts fixed the actual app path.
  Visual review then found the narrow timer/notice/control overlap; dedicated
  geometry checks and the mode-specific layout now cover it. The same review
  caught ordinary phone setup overlapping its warning/counter/controls before the
  choice: portrait HUD and warning shelves, landscape warning position and the
  landscape tip's left margin were corrected and checked before fallback too.
  The failed artifacts
  remain in local test results; no failure was whitelisted.
- The first Swift build was interrupted by a changed intermediate `.o` file;
  a clean rerun of `swift test` passed 25/25, including all 27 shared evidence rows.

Focused reproduction:

```sh
node --test testing/body-tolerance.test.mjs testing/evidence-parity.test.mjs
node testing/run.mjs --build form-coach-v4.11.html --scenario clothing-side-recovery
node testing/run.mjs --build form-coach-v4.11.html --scenario follow-along-unassessed
node testing/check-shell.mjs form-coach-v4.11.html 'follow-along-*'
```

Final full-run identity and results are recorded in
[project status](../project-status.md). All four original harnesses pass:
4,127 conformance checks, all eight deliberate mutations, 250 drawing checks and
26 skip checks. Swift passes 25/25. The original conformance JSON was not refreshed.

The existing `npm run test:video` smoke also passes 14/14 checks with 90 real CPU
inference frames from an explicitly synthetic blank canvas:
`test-results/2026-09-14T04-42-50-305Z-17930/` (local/ignored). This verifies ordinary
recorded-video wiring after the adapter change, not human clothing recognition or
a real-person follow-along session. Chromium first needed an approved launch outside
the macOS sandbox; the denied launch was not an application/test assertion failure.

## Next validation — use the existing infrastructure

Recruit a small, consented pilot across different body sizes/proportions and usual
exercise clothing, including loose tops/trousers; do not infer anyone's weight or
collect BMI. Let people choose clothing they are comfortable wearing. Include
different skin tones, room/background contrast and portrait/landscape phone setups.
Treat six to eight volunteers as a practical discovery pilot, not a representative
fairness study or a statistically validated accuracy claim.

Use short, repeatable Squat, Plank, Push-Up and Leg Raise trials plus stationary,
repositioning and out-of-frame negatives. Record independent human rep/hold labels,
which cues were unsupported, how often counting paused, whether the explanations
were helpful, and whether follow-along let the person finish comfortably. Flag
diagnostic windows only with consent; keep originals private/local. Clean camera
clips can enter the existing video runner and saved landmarks the existing replay.
Never manufacture model-success labels from the model's own output.

If both sides remain unobservable, required Plank geometry and the Leg Raise ankle
driver still cannot count automatically. There is no hidden-motion reconstruction.
Scale/mirror tests prove movement invariants, **not** identical quality scores across
all proportions: legacy signed-line form metrics still use image-relative offsets.
Normalising those measures requires an explicit content/vector migration and actual
camera labels; this implementation does not hide that outstanding limitation.
Calibration's interrupted-bout aggregation from the recent recording also remains
open. Neither is permission to infer ability or fatigue from poor tracking.
