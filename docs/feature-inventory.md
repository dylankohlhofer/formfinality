# FormFinder — collaboration feature inventory

Reconciled 24 September 2026 against the visible conversation, repository history,
current source and dated implementation records. This covers the work from the
first visible request, **Skip / v4.11** (`799a134`, 4 September), through the
24 September closure work. It includes user features, repairs that change
the experience, native components, prototypes and development tools.

**“Implemented in browser” means present in the repository's browser application,
not publicly launched or validated on every device.** There is no released native
app or connected account service evidenced here. Earlier foundations—MediaPipe,
the original 21 movements, three tiers, authored plans, form tint, reference
drawings, CSV and the original Swift engine—predate this collaboration and are
not claimed as new inventions below.

The 24 September additions are catalogued in section 17. Their original failed
evidence remains linked alongside the repair results.
The [chat backlog](chat-backlog-2026-09-24.md) records undelivered requests and
the remaining conditions for release. Dated entries in
[project status](project-status.md) remain the verification authority.

## Delivery map

| Surface | What exists | What that does not mean |
| --- | --- | --- |
| Browser app | Workout controls, tolerant evidence handling, private diagnostics, summaries, local coaching, optional history/goals and redesigned FormFinder UI | Public launch, installed/offline app, universal recognition or secure paywall |
| Swift package | Updated engine parity; optional local summary/choice selectors, command/speech components and review CLI | Ported SessionCore/CalibrationCore, native workout screens or phone deployment |
| Isolated prototypes | Bounded pose worker, two-client Duo reconciliation/Drive adapter, Remotion squat study | Production worker, connected Duo or installed replacement workout demos |
| Development/release tooling | Shared test/watch/report loop, actual MP3 capture, optional local AI review, static review packager, handover tools, commercial calculator | Remote CI proven operational, pronunciation certification or a deployed website |

## 1. Skipping and honest incomplete-work records — browser

- Added `SessionCore.skip(reason)` through the existing cooldown/effect boundary.
  The current phase is named, logged as skipped and advanced; its phase score is
  `null`, with `skipped:true`, rather than zero.
- Preserved previously observed frames in the existing session accumulation once.
  Finishing/skipping does not add a second phase-level score contribution.
- Added mid-check `CalibrationCore.skip()`: finishing uses the hold actually
  observed. The retained short-hold case produces a Learning verdict.
- Added the header Skip control and keyboard **S**, routed through the same
  active-core handler. Input/select focus protection was subsequently expanded
  to modifiers, repeat keys and modal/interaction state.
- Named skipped exercises in muted debrief rows and removed invented numeric
  assessment for skipped/all-unassessed sessions. Skips remain visible in CSV.
- Later UI wording distinguishes **Ready now** during rest and **Finish check**
  during calibration from abandoning an exercise.
- Bumped the browser build/header to v4.11; kept the legacy filename stable after
  the later public rename to FormFinder.

Evidence: [app](../form-coach-v4.11.html) (`SessionCore`, `CalibrationCore`,
`skipCurrent`, `renderFinish`), [permanent skip suite](../verify-skip.mjs),
[coaching repairs](sessions/historical-fixes-2026-09-07.md),
[specific stale-speech finding](../testing/findings/voice-after-skip.md).
Git: `799a134`, `8014ab8`, `6e203f4`.

## 2. Movement evidence, counting and scoring — browser and matching Swift paths

- Invalid position, view, clipping, missing observations or driver confidence
  interrupt an unfinished rep. Upright arm bends/off-screen cycles after a valid
  push-up no longer add false push-ups.
- A return at the peak cannot complete an interrupted cycle. Completed reps
  survive; a fresh fully observed cycle can count again.
- Separated evidence needed for movement/position/hold from optional form
  measurements, using the `movement-evidence/1` contract.
- A cropped optional neck measurement no longer blocks an otherwise observed
  Crunch. Missing optional quality is omitted from score, tint and correction.
- Required targets cannot disappear from the gate list and become implicit
  passes. The declared optional Leg Raise foot-direction hint retains its
  explicit exception; the ankle-based driver is still required.
- Filtered unavailable, nonfinite, degenerate and out-of-frame observations;
  tracked their missing reasons and contributing sources.
- Cleared obsolete smoothing when a target/source disappears or the scoring pool
  changes. `arm()` resets the new evidence/source state.
- Selected one complete required-observation camera side and retained it through
  confidence flicker. Selection does not chase the better score or stitch two
  incomplete sides together. A real driver-side switch breaks the unfinished rep.
- Applied view eligibility before scoring/smoothing. Unreliable view readings
  produce explicit unavailability instead of penalties, confident cues or tint.
- Corrected the camera adapter's x/z units and required trustworthy in-frame
  shoulder/hip pairs for estimating view.
- Removed moving rep drivers from static FORM scoring/tint while retaining their
  range and tempo checks. Glute Bridge counts observed reps with **form not
  scored**, rather than an invented zero or perfect score.
- Paused holds with missing required observations without scoring them as bad
  form; exposed why counting stopped. Guided off-screen timing was also repaired.
- Removed automatic hold-target shortening from a transient low score. Announced
  targets/progress no longer jump because the app inferred fatigue from one score.
- Retained explanations for rejected fast/shallow reps and invalid active setup.

Evidence: [movement contract](movement-evidence-contract.md),
[historical repairs](sessions/historical-fixes-2026-09-07.md),
[movement-evidence implementation](sessions/movement-evidence-fixes-2026-09-08.md),
[body/clothing changes](sessions/body-clothing-tolerance-2026-09-14.md),
[view review repairs](sessions/code-review-fixes-2026-09-14.md),
[shared evidence cases](../testing/movement-evidence-vectors.json),
[Swift evaluator](../swift/FormCoachEngine/Sources/FormCoachEngine/Evaluator.swift).
**These are policy/robustness changes, not validated hidden-ankle reconstruction
or proof of accuracy across all body sizes and clothing.**

## 3. Calibration, setup help and an unassessed escape hatch — browser

- Repaired both calibration demo failures: a missing helper exception and a label
  path that incorrectly depended on a workout session.
- Explained quality-blocked setup before arming instead of offering premature
  “Hold it there” reassurance. Missing frames reset continuous readiness.
- Added a restrained easier-movement offer: five seconds of setup grace, then
  six seconds of continuously observed difficulty with an eligible view and
  passing position gates. Recovery or observation loss withdraws it immediately.
- Kept an unaccepted easier option visual; it does not speak over the user or
  silently replace their exercise. Re-arming resets difficulty accumulation, not
  the once-per-movement offer allowance.
- Calibration pauses after 2.5 seconds of sustained required-evidence loss;
  Restart / Use observed result prevents joining separated bouts into one hold.
- Added **Follow along (unassessed)** for the current workout set. Teaching stays
  available, elapsed time is labelled separately and finishing is manual.
- Follow Along earns no unseen reps, measured hold seconds, form score or ability
  claim. Earlier observed work survives once; the next set returns to assessment.
  Calibration does not manufacture a Follow Along verdict.

Evidence: [setup/recorder repair](sessions/recorder-prompt-fixes-2026-09-07.md),
[body/clothing implementation](sessions/body-clothing-tolerance-2026-09-14.md),
[review regressions](../testing/review-regressions.test.mjs),
[setup-prompt suite](../testing/setup-prompt.test.mjs),
[calibration findings](../testing/findings/calibration-has-demo.md),
[label finding](../testing/findings/calibration-demo-label.md).

## 4. Coaching voice and playback reliability — browser

- Skip, Pause, End, Follow Along and navigation cancel abandoned current/pending
  coaching. Delayed callbacks cannot restart old segments in the next movement.
- Current measured conditions withdraw obsolete form/readiness/praise speech;
  cooldown expiry is not treated as evidence that a fault recovered.
- Readiness explanations share a 30-second reminder budget; sustained completed
  topic instructions have a 20-second continuing-condition budget. Visual
  explanations remain available between spoken reminders.
- Removed stationary-hold praise from rep exercises; retained counting and
  rejected-attempt explanations when optional encouragement is reduced.
- Changed framing wording to top/bottom image edges instead of claiming an
  unseen head or foot is the problem. New wording has separate speech keys.
- Enforced explicitly local English synthesis for fallback and preview, with
  visual unavailability and queue release when no eligible voice exists.
- Turning automatic Voice off cancels current/pending speech; explicit previews
  use the same ownership/cancellation path without re-enabling automatic coaching.
- Made preview and recorded-playback failure visible rather than silently
  leaving a stalled coaching gate.
- Required complete word-bearing recorded instructions. A missing splice part
  cannot leave a number-only fragment masquerading as a complete instruction.
- Added two-second startup/progress checks and at most one fresh-element retry
  before any segment starts. The original start deadline remains in force.
- Stale media sources/cache entries are released. A partially heard stalled line
  is neither replayed nor continued with its remaining fragments; failure frees
  the queue and remains visible.
- Stop/Pause/Skip invalidate retry/progress timers and old media callbacks.
- Simplified consumer voice presentation: default recorded coaching remains;
  name/style personalisation now appears as disabled future paid Account content.

Evidence: [app](../form-coach-v4.11.html) (`AudioBank`, `Coach`, `clipPlanFor`,
`localVoices`), [local stack](sessions/local-stack-2026-09-07.md),
[audio recovery](sessions/audio-stall-recovery-2026-09-14.md),
[speech contract](local-coach-contract.md),
[clip-resolution parity](../testing/clip-resolution-vectors.json).
**Warm's “two”, full-library intelligibility and later intermittent loading
failures remain open. All-clip screening and a local listening queue now exist
(section 17); screening alone cannot approve pronunciation. No Fish Audio migration or new
voice-bank regeneration is claimed.**

## 5. Workout navigation, interruption and camera ownership — browser

- Made onboarding/help available before loading the pose library; added explicit
  permission/model startup stages and Cancel.
- Added expanded workout previews with scaled sets, rests, camera view and
  other-side steps, followed by explicit Start workout.
- Unified supported-plan validation across picker, search, preview, construction
  and retiering. Unsupported resolved movement/tier combinations are excluded.
- Added persistent current movement, set progress and next movement context.
- Added Pause/Resume and keyboard **P**. Pause freezes observed work, rest and
  unassessed timers and breaks unfinished reps; Resume is explicit.
- Backgrounding pauses the session. Returning, changing camera and closing Help
  do not silently resume assessment or microphone listening.
- Added End confirmation and an honest partial summary: prior completed work
  remains, the current stopped set is unscored and future sets are absent.
- Calibration interruption offers restart/observed result rather than joining
  a discontinuous hold through Resume.
- Added local Help for setup, counting limits, controls and privacy; opening it
  pauses active work and closing it preserves that pause.
- Improved camera error explanations for permission, missing/busy hardware,
  constraints, interrupted startup and model loading.
- Guarded late/cancelled camera requests, pending switches and failed playback.
  End releases every owned stream, including both sides of a pending switch.
- Bound animation callbacks to camera-generation identity, preventing old loops
  from reviving after rapid restart.
- Coalesced optional wake-lock requests and released stale grants; wake-lock
  failures do not prevent starting, resuming or cleaning up a workout.
- Unified touch/typed/spoken Resume readiness checks and guarded confirmed set
  advance while camera recovery is pending.
- Kept demonstration visibility/labels consistent and clarified Guide outline
  as an illustration rather than a body-size target. Fixed a discontinuous demo
  return interpolation; the original reference drawings remain in the live app.

Evidence: [interface review](sessions/interface-review-2026-09-14.md),
[review repairs](sessions/code-review-fixes-2026-09-14.md),
[adversarial repair record](sessions/adversarial-review-2026-09-14.md),
[interface tests](../testing/interface.test.mjs),
[adversarial cases](../testing/adversarial-cases.mjs).
Unexpected camera-track loss is covered by the 24 September repair in section 17.

## 6. Private diagnostics and evidence replay — browser

- Added explicit opt-in, memory-only collection of observed joints, measurements,
  session effects and speech decisions; no automatic upload or video recording.
- Added Start, Pause/Resume, Flag this moment, explicit JSON export and erase.
- Bounded the serialized export to 4 MiB / 4,000 entries, with visible pressure
  handling rather than silent loss of protected evidence.
- Added schema 2 protection for session events/periodic summaries and up to eight
  flagged windows, retaining available ±10 seconds at up to 5 Hz. Recent
  unprotected frames can roll off; protected-space exhaustion pauses capture.
- Added a fixed scrollable diagnostics drawer that does not resize the camera.
  Starting capture closes tools/drawer and keeps the quick-flag button accessible.
- Added local import, timeline playback and display of saved observations;
  replay does not re-infer or issue a new form judgement. Schema 1 stays readable.
- Validated imported frame/summary blocker lists before opening replay; guarded
  read success, failure and cleanup with request/clear identity so stale imports
  cannot hide or overwrite newer reviews.
- Included movement-evidence availability/source information in diagnostics and
  preserved explicit gaps when original recording data was unavailable.

Evidence: [app](../form-coach-v4.11.html) (`DiagnosticBuffer`, `diagnostic*`),
[recorder follow-up](sessions/recorder-prompt-fixes-2026-09-07.md),
[diagnostic tests](../testing/diagnostics.test.mjs),
[adversarial import fixes](sessions/adversarial-review-2026-09-14.md).
Flagged **landmark windows are not screenshots**; automatic repeated-fault photos
are still a separate proposed feature.

## 7. Evidence-backed debriefs — browser

- Added `workout-summary/1`, with a session headline, measurement-coverage wording,
  approved highlights and movement-specific teaching tips.
- Used observed work, recorded cue topics and rep timing; removed unsupported
  fatigue/setup diagnoses, perfect-form claims and automatic harder-tier advice.
- Kept all set rows and totals visible independently of bounded highlights.
  Skipped, stopped, guided and Follow Along sets receive no assessment cards.
- Retained prior measured work once, excluded guided elapsed time from best-hold
  claims and kept null assessment distinct from a zero score.
- Added deterministic card selection and validation of optional approved card IDs;
  the browser does not claim to generate AI prose or run Apple's model.
- Reorganized summaries around observed totals, concise highlights, named set
  results, another-workout navigation and optional technical CSV disclosure.

Evidence: [summary contract](workout-summary-contract.md),
[implementation record](sessions/workout-summaries-2026-09-14.md),
[summary tests](../testing/summary.test.mjs),
[shared card cases](../testing/summary-selection-vectors.json).

## 8. Ask coach, commands and authored workout search — browser

- Added **Ask coach**: pause, explain the latest measured counting condition or
  recent rejection, replay teaching and open the existing demonstration.
  Expired/missing evidence yields uncertainty rather than an invented cause.
- Added typed commands routed to the existing controls, with exact parsing and
  a ten-second contextual confirmation for Skip/Finish/End.
- Added optional spoken commands only where installed, explicitly local English
  recognition is supported. Spoken commands require the “coach” prefix; only
  urgent Pause can use an interim result.
- Required per-workout microphone opt-in, visible local-support failures and
  reachable Mic off controls inside Pause/Help as well as the main interface.
- Suspended input during coach playback and waited 750 ms of quiet before renewal.
  Background/phase/session changes invalidate pending commands and confirmations;
  no transcripts persist and there is no cloud fallback.
- Added bounded English search of **existing authored plans** by name, estimated
  minutes, floor/standing, quiet and equipment constraints.
- Required every substantive clause to be understood and all hard constraints
  to hold after expansion/tier resolution; no-match stays no-match. Selection
  opens a preview and never starts a workout automatically.
- Added the `coach-choice/1` approved-ID boundary for explanations, plans and
  test-review candidates. It cannot invent routines, execute controls or change
  measurements. Browser choices remain deterministic.

Evidence: [local-coach contract](local-coach-contract.md),
[implementation record](sessions/local-coaching-2026-09-14.md),
[command vectors](../testing/coach-command-vectors.json),
[choice vectors](../testing/coach-choice-vectors.json),
[listener tests](../testing/local-command-listener.test.mjs).

## 9. Optional local coaching preferences and History — browser

- Added independent consent for saving preferences and future finished-workout
  records. Visiting or using coach help does not grant persistence consent.
- Added coaching-amount and demonstration preferences; reduced encouragement
  preserves counting, readiness, form and rejected-attempt explanations.
- Added compact history with plan/tier/status/date and observed work counts,
  deduplicated by session UUID. Skips, early ends and unassessed work retain labels.
- Added dated cards and expandable details plus same-plan/tier count summaries;
  these are not inferred fitness improvement or complete lifetime totals.
- Bounded this store to 100 records / 128 KiB; exposed malformed, full, unavailable
  or stale storage failures. Changes can apply for the current visit without saving.
- Added scoped export/erase and immediate in-memory opt-out. History erase does
  not erase diagnostics, references or the separate weekly-goals store.

Evidence: [app](../form-coach-v4.11.html) (`LocalCoachMemory`,
`buildLocalHistoryEntry`, `renderCoachMemory`), [contract](local-coach-contract.md),
[interaction tests](../testing/interaction.test.mjs).
No interrupted-session restore, history import, cloud backup or encrypted database
is claimed.

## 10. Local profile, weekly goals and email draft — browser

- Added a separate default-off `profile-goals/1` participation store, independent
  of diagnostics, microphone, History and coaching-preference consent.
- Added a user-selected weekly target, with subsequent changes starting next
  Monday in the timezone fixed at first opt-in.
- Credited complete routines without skipped/ended sets, independent of form score;
  one civil-day credit, with additional routines recorded without duplicate credit.
- Added an explicit separate choice to count completed guided/Follow Along
  routines, preserving their unassessed label and avoiding retrospective backfill.
- Handled civil dates/week boundaries and daylight-saving changes; missing history
  is unknown, not a failed streak or lack of activity.
- Added This week with saved-days/target, a seven-day calendar, today marker and
  an earned goal-met badge. No fitness level or streak length is invented.
- Bounded storage to 4,000 completions, 1,024 goal changes and 1 MiB; made save
  failures, stale writers, opt-out, export and scoped erase visible.
- Preserved older local nicknames during goal edits without treating them as
  verified identities. The newer UI reserves name editing for future Account.
- Added **Share completion by email…** for eligible completed routines: a fixed,
  recipient-free draft the user sends in their mail application. Unassessed work
  is labelled; no automatic email, address collection or synced-Duo claim.

Evidence: [profile/Duo contract](profile-duo-contract.md),
[profile unit tests](../testing/profile-goals.test.mjs),
[profile browser cases](../testing/profile-goals-cases.mjs),
[app](../form-coach-v4.11.html) (`ProfileGoals`, `profileCompletion`,
`profileCalendar`, `profileEmailDraft`). Git: `cd7334b` and `8cde19a`.

## 11. FormFinder brand, appearance and simplified interface — browser

- Renamed public header, welcome, relevant email/report/review-artifact wording
  to **FormFinder** while preserving saved-data keys, export schemas, voice paths,
  Swift module names and `form-coach-v4.11.html`.
- Reworked idle navigation around **Workouts / More / About**; compact workout
  cards use two columns on desktop and one on phones.
- Moved optional search, detailed preview, preferences, data tools and technical
  readouts behind disclosures; live Pause/Skip/Ask coach/End remain direct.
- Added accessible inline icons, clearer labels, larger controls, dynamic safe-area
  spacing, focus return, Escape/outside-click menu dismissal and sticky modal
  close controls. Menus do not resize the camera.
- Added default Dark, ivory/plum Light and Match device appearance, persisted in
  the separate `formfinder.appearance.v1` key with visible read/write failures.
- Kept setup and exercise surfaces dark from camera startup, independently of
  the chosen idle theme; body-feedback colour semantics remain separate.
- Added brief heading transitions and reduced-motion support, avoiding animation
  of whole clickable panels after a real navigation/hit-testing regression.
- Added an **Account presentation** for future Apple/Google identity, paid
  personalisation, optional cloud progress and Duo. Name/style previews are
  disabled; no fake sign-in, purchase or entitlement is offered.
- Added **About** with mission, measurement limits, privacy/development status,
  an explicitly future promotional-video placeholder and honest platform status.
- Simplified History/weekly-goal presentation while keeping consent, failures,
  export/erase and unassessed distinctions accessible.

Evidence: [interface simplification](sessions/interface-simplification-2026-09-23.md),
[FormFinder follow-up](sessions/formfinder-interface-2026-09-23.md),
[FormFinder cases](../testing/formfinder-cases.mjs),
[real disclosure navigation helper](../testing/ui-navigation.mjs).
Git: `a1c556f`, `8cde19a`. Device accessibility and beginner ease of use still
require direct validation; responsive desktop screenshots do not establish them.

## 12. Reference authoring and runtime efficiency — browser/developer tools

- Hardened the existing developer reference recorder with bounded validation,
  atomic imports and legacy-coordinate checks. Invalid saved overrides fall back
  visibly to authored references without overwriting the stored evidence.
- Failed reference saves retain an exportable draft with explicit Retry;
  reset removes only `fc_refs`.
- Shared one current-frame conversion between drawing and evaluation instead of
  converting the same detected frame twice.
- Avoided repeated unchanged text/HTML/visibility writes; cached dial segments
  with proper text/markup/target invalidation. Changed clocks, blockers, hold arcs,
  logs and speech are not throttled.
- Made ordinary diagnostic appends use incremental byte/count accounting while
  retaining transactional flag pinning and pressure/eviction behavior.
- Added reproducible architecture probes: the synthetic recorder workload measured
  2.34× faster with identical exports at its dated checkpoint. This is not a
  whole-app FPS, phone battery or inference-speed claim.

Evidence: [reference repair record](sessions/code-review-fixes-2026-09-23.md),
[reference tests](../testing/references.test.mjs),
[architecture record](sessions/architecture-optimisations-2026-09-14.md),
[architecture probes](../testing/architecture-probes.mjs),
[benchmark](../testing/architecture-benchmark.mjs).

## 13. Swift components — local native libraries, not a delivered mobile app

| Component | Implemented during this collaboration | Boundary |
| --- | --- | --- |
| `FormCoachEngine` parity | Mirrors reviewed rep/evidence/side-selection/view/scoring and complete clip-resolution changes; shares evidence and clip vectors with HTML | Original math/content/evaluator library predates this work; SessionCore and CalibrationCore remain absent |
| `FormCoachSummary` | Trusted summary-envelope validation, exact one/two-card selection, template-first coordinator, availability/deadline/cancellation/request guards; optional `SystemLanguageModel.default` selector | No generated prose, new measurements, browser integration or full native debrief UI |
| `FormCoachInteraction` | Shared exact commands, local speech-capture adapter/coordinator, bounded approved-ID choices, stale-request guards and review-input validation | Host must supply UI, permission/consent and lifecycle integration; no physical-microphone or phone certification |
| `FormCoachReviewCLI` | Optional local-model prioritisation of existing synthetic test candidates, validated import and fallback | Developer tool; no private evidence upload, oracle rewriting or automatic bug closure |

Evidence: [Swift package](../swift/FormCoachEngine/Package.swift),
[engine sources](../swift/FormCoachEngine/Sources/FormCoachEngine),
[summary sources](../swift/FormCoachEngine/Sources/FormCoachSummary),
[interaction sources](../swift/FormCoachEngine/Sources/FormCoachInteraction),
[review CLI](../swift/FormCoachEngine/Sources/FormCoachReviewCLI/main.swift),
[summary](workout-summary-contract.md) and [local-coach](local-coach-contract.md)
contracts. Explicit local model smokes succeeded on this Mac in September;
deterministic CI does not run those models by default.

## 14. Three isolated prototypes

### Bounded pose worker

Implemented a local MediaPipe worker experiment with bounded admission/backlog,
stale/future timestamp rejection, result ownership, delivered-result accounting,
queue tests and CPU/GPU benchmark tooling. The desktop blank-frame CPU comparison
reduced p95 main-thread timer delay from 10.7 ms to 1.1 ms at its checkpoint;
the GPU result was slower. **The production camera still uses its original loop.**

Evidence: [worker queue](../testing/worker-queue.mjs),
[worker inference](../testing/worker-pose.js),
[benchmark](../testing/worker-benchmark.mjs),
[local-stack record](sessions/local-stack-2026-09-07.md).

### Duo reconciliation and Google Drive transport

Implemented a transport-independent two-member completion ledger, durable bounded
outbox, no pre-pair backfill, matching shared policy, one credit/member/day,
offline/quota/revocation retention, ambiguous-upload reconciliation, duplicate and
conflicting-ID handling, disappearing-event detection and account/pair scoping.

The injected-token Drive adapter validates exact minimal envelopes and owner/user
metadata, requests `incompleteSearch`, and rejects incomplete scans. Cached,
pending and acknowledged credits are distinct; weekly confirmation stays unknown
until a complete successful sync and records its last-sync time. Disable/re-enable
guards prevent obsolete callbacks applying later.

Evidence: [sync](../duo/sync.mjs), [Drive](../duo/drive.mjs),
[simulated two-account tests](../testing/duo-sync.test.mjs),
[contract and live-account gate](profile-duo-contract.md).
**No OAuth, real accounts/folders, invitation UI, production pairing, CloudKit,
background sync or remote notifications exist in the app.**

### Remotion squat demonstration

- Built an isolated React/Remotion/Three.js composition in landscape and portrait,
  with the user-approved dark page, stage, instruction cards and iris progress.
- Authored three deterministic squat cycles, now 5.4 seconds each / 16.2 seconds
  total, at 30 fps. Full-rep teaching cards replaced rapidly changing phase text.
- Iterated the procedural figure's face, shoulders, hips, feet and hands; retained
  that source for comparison after replacing the preview with the user's Mixamo
  **Alien Soldier** rig.
- Added local FBX→GLB preparation, embedded/reduced textures, normalized skinning
  and material regrouping, preserving the source and recording conversion limits.
- Added foot-locked posing, stable bone lengths and asset-local transforms to
  avoid post-mount scaling/rotation errors.
- Added a front-facing second rep to teach knees following foot direction, with
  camera turns only while standing and a small viewing-angle label.
- Corrected inward knee travel exposed by that front view; framing includes the
  actual skinned mesh in both formats throughout the timeline.
- Added geometry/seek/timing/engine-projection tests, cold-render pixel checks and
  Studio playback/restart/frame-step checks. Synthetic side projections count
  three reps at the two supported tiers; this is not pixel inference or technique
  certification.
- Documented Remotion, Product Design and GitHub plugin roles and creative-asset
  provenance. No extra generation account or private-media upload was performed.

Evidence: [prototype README](../exercise-demos/README.md),
[composition](../exercise-demos/src/SquatDemo.tsx),
[motion](../exercise-demos/src/motion.ts),
[rig](../exercise-demos/src/mixamo-rig.ts),
[asset record](../exercise-demos/assets/alien-soldier.md).
The prototype remains separate from root CI. Its source/prepared model binaries are ignored;
a fresh checkout needs the licensed asset. No final MP4 or in-app replacement
has been delivered, and no other exercise composition is implemented.

## 15. Automated development and review infrastructure

### Shared exercise test loop

- Landed the permanent Skip suite requested as a committed smoke test (now 26
  checks), supplementing vectors that cannot exercise skip paths.
- Added one shared scenario/action format across headless engine, desktop/narrow
  browser and recorded-video modes, with immutable per-run build/scenario/input
  snapshots and hashes.
- Added `npm test`, focused modes/packs and a serialized/debounced foreground
  `npm run test:watch`; changes during a run produce one follow-up run.
- Added automatic single fresh-context failure reproduction without erasing the
  original failure or treating reproduction as a cause diagnosis.
- Added HTML/Markdown/JSON reports, exercise coverage board, expected/actual
  outcomes, screenshots, browser traces/errors and reproduction commands.
- Covered all 21 movements / 44 supported tier pairs synthetically, plus plan
  selection, frames-per-second/hold timing, wrong-view/clipping, static and
  misleading-motion negatives, recovery, skip and regression behavior.
- Added a four-exercise partial-view pack—Squat, Crunch, Leg Raise and Plank—using
  the same runner. Unsolved recognition remains a coverage-gap finding.
- Added retained suites for prompts, diagnostics, evidence parity, body/clothing,
  interface, summaries, commands/memory, profiles/Duo, references and releases.
- Added seeded control histories, uneven cadence, diagnostic retention histories
  and long-session lifecycle probes; retained all five repaired adversarial bugs.
- Hardened original harness execution to use the saved build; archived mutation
  verification requires a genuinely healthy control. Missing video can explicitly
  fail a required-video run instead of being silently counted as coverage.
- Added a pinned-model download/checksum step, real MediaPipe blank-video wiring
  smoke, raw-landmark export and faster replay of saved detections. User footage
  stays local; expected judgments are independently authored.
- Reviewed historical and later user recordings locally, retaining dated findings
  and synthetic regression reproductions where possible. Screen recordings are
  not recovered clean camera/landmark ground truth.

Evidence: [test guide](../testing/README.md), [runner](../testing/run.mjs),
[watcher](../testing/watch.mjs), [reporter](../testing/report.mjs),
[exercise sweep](../testing/exercise-sweep.mjs),
[partial pack](../testing/partial-visibility.md),
[historical review](sessions/historical-recording-review-2026-09-07.md),
[September 9 review](sessions/user-test-review-2026-09-09.md).

### Actual recorded-audio capture

- Added real-time production-queue cases capturing decoded MP3 output, measured
  signal, per-clip start/end/cancel/retry events and state/wording timelines.
- Added a local seekable listening report and separate silent screen recordings.
- Added deliberate silence/overlap, wrong lifecycle, stalled-request and missing
  second-number controls; samples must prove both numbers complete audibly.
- Corrected capture-specific omitted initial silence, pending-play cancellation
  ownership and action-dispatch timestamp handling, retaining negative controls.
- Added stale-phase speech, expired queue, tracking, Ask/Repeat/Resume, Pause and
  Follow Along cancellation cases plus all nine persona/tier number samples.
- Preserved questionable repetition/context as review candidates; intended clip
  text is never labelled transcription or intelligibility approval.

Evidence: [audio runner](../testing/audio-sweep.mjs),
[capture bridge](../testing/audio-bridge.js),
[analyzer](../testing/audio-review.mjs),
[capture mutations](../testing/audio-capture.test.mjs),
[audio case declarations](../testing/audio-cases.json).
Real MP3 tests remain separate from accelerated camera-video replay and native
TTS/physical-speaker tests.

### Optional AI triage and CI configuration

- Added provenance-checked synthetic evidence packages and explicit
  `test:review -- --run <exact-run>` for bounded local AI candidate selection.
  Private inputs, stale sources and invalid output fail visibly; unselected gaps
  remain open. Default tests never invoke a model automatically.
- Added GitHub Actions push/PR/manual configuration for browser/original/audio
  suites, blank-video inference, deterministic Swift and static artifact smoke.
- Added same-ref/event obsolete-run cancellation, job deadlines and failure
  evidence retention. See the latest closure record for commit/push status;
  configured CI is not proof of an actual completed remote run.
- Added exploratory Chromium/Firefox/WebKit real camera/model-path testing on
  synthetic streams, including camera disconnect injection. The September 23
  probe is retained as historical evidence; the maintained packaged-artifact
  suite now lives in `testing/camera-e2e.mjs` and is wired into CI.

Evidence: [AI review guide](../testing/ai-review.md),
[review runner](../testing/run-ai-review.mjs),
[workflow](../.github/workflows/test-lab.yml),
[full end-to-end review](sessions/full-e2e-review-2026-09-23.md).

## 16. Release, handover and project operations

- Renamed the authoritative rules file to `AGENTS.md`; retained `CLAUDE.md` as a
  symlink and corrected active tooling references and v4.11 harness commands.
- Removed the stale recovery ZIP and documented tracked root files as recovery;
  corrected nonexistent artifacts/archive descriptions and erroneous case counts.
- Preserved historical planning documents, added continuation instructions and
  maintained dated implementation/review records instead of treating old proposals
  as current implementation claims.
- Added source-snapshot packaging/checking with input hashes, selected synthetic
  verification receipts and extracted-package integrity controls. The attempted
  Ethan handover was interrupted and later cancelled; no completed transfer is
  claimed merely because the tooling exists.
- Added a static **local review** builder with pinned runtime/model, manifest-only
  voice assets, no remote fonts, headers, 404/review notice, checksums/receipt,
  path/symlink/size checks and fresh-directory-only output.
- Added emitted-artifact UI/inference/decoded-audio/same-origin smoke tests.
  The September 23 timeout is retained; a fresh 24 September build completed
  and passed its emitted-artifact smoke and conformance verification.
- Added a parameterized unit-economics calculator and tests for price, fees,
  tax/refunds, support, development time and break-even sensitivity.
- Documented a low-cost browser-starter/paid-native direction, provider trade-offs,
  quota estimates and cross-platform Duo options. These are planning deliverables,
  not a changed price, deployed free tier, ad system, domain or purchased service.

Evidence: [rules](../AGENTS.md), [start guide](../START-HERE.md),
[continuation prompt](../CONTINUE-PROMPT.md),
[snapshot packager](../handover/package-snapshot.mjs),
[snapshot checker](../handover/verify-snapshot.mjs),
[handover record](sessions/device-handover-2026-09-16.md),
[release guide](web-release.md), [release builder](../release/web.mjs),
[economics](../commercial/economics.mjs),
[commercial decision](business-model-2026-09.md).

## 17. September 24 loose-end closure

- Camera-track loss now pauses assessment, cancels speech/listening, releases
  all owned streams and detaches the ended feed before it reaches inference.
  Restart preserves the workout and waits for explicit Resume. Calibration can
  use its observed result or start fresh; interrupted reference recordings are
  discarded with a visible explanation.
- Added eleven permanent shell cases for startup/disconnect/retry/switch/End
  races, calibration choices and incomplete reference capture. Existing lifecycle
  and architecture checks remain; no judgement engine/vector/Swift change.
- Added a maintained packaged-app GPU camera/model test across Chromium desktop
  and phone, Firefox phone and WebKit phone. All four flows passed 19 checks each.
  Generated blank camera streams do not validate human recognition.
- Changed release assembly to eight bounded rolling I/O slots, with per-file
  deadlines and named progress; output writes its receipt last. A shared verified
  loader checks every served asset against the allowlist and hashes. The fresh
  build read 1,294 clips in 162.8 seconds and passed artifact/conformance tests.
  Underlying slow filesystem reads remain unexplained.
- Added the development-only whole-library voice audit and local listening queue:
  exact source/wording/analyser hashes, sample-level signal and MP3 integrity
  screening, independent bad-audio controls and Warm “two”/numbers 1–20 priority.
  All 1,294 clips decoded; 68 are machine review candidates, with no read/decode
  errors. All pronunciations remain unreviewed; no recordings were replaced.
- Registered the audit's 22 unit/control tests in default test/watch/CI and added
  packaged camera recovery to CI. Full screening stays an explicit serial command.
- Reconciled 77 retained chat items and replaced obsolete active next-step/
  continuation instructions, including repo-root serving advice and stale claims
  about absent shell tests or already-existing offline/native/cloud features.

Evidence: [closure record](sessions/loose-ends-2026-09-24.md),
[camera cases](../testing/camera-loss-cases.mjs),
[packaged camera suite](../testing/camera-e2e.mjs),
[voice audit](voice-library-audit.md), [release guide](web-release.md),
[reconciled backlog](chat-backlog-2026-09-24.md).

## Prior verified checkpoint and remaining boundaries

The latest completed review before this closure work is
[23 September's full run](sessions/full-e2e-review-2026-09-23.md), on HTML hash
`d15aa0bb63863b082dd47bd7b0257548776bc3ca5bd11fab44db46bb46071aa1`:

| Area | Recorded result at that checkpoint |
| --- | --- |
| Original harnesses | 4,127 conformance checks; eight caught mutations and healthy control; 250 drawing checks; 26 skip checks |
| Shared loop | 25 regression suites; 55 engine, 110 browser, 151 shell and 16 recorded-audio cases passed |
| Swift | 105 deterministic tests passed; three optional model smokes skipped |
| Remotion | 30 prototype checks and Studio playback smoke passed |
| New browser paths | 15 checks each in Chromium desktop/phone, Firefox phone and WebKit phone passed on synthetic streams |
| Open evidence | 12 missing human-video cases; 26 retained review candidates; earlier intermittent audio failures; disconnect defect; fresh packaging timeout |

These figures describe the earlier checkpoint. See the linked 24 September
closure record and project status for verification after the new work.

User-visible features still absent include repeated-fault screenshots, completed
voice intelligibility approval, validated hidden-joint inference, new in-app video
demos, custom/circuit workouts, automatic progression, real accounts/entitlements,
connected cloud Duo, scheduled notifications, native store apps and public/offline
distribution. Each is tracked with its next condition in the
[chat backlog reconciliation](chat-backlog-2026-09-24.md).
