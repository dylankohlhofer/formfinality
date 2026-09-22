# Form Coach — project status report

**Each verification entry names the build checkpoint it measured.** Older entries
are history, not current counts. Where any other document disagrees, this file wins.

**22 September 2026 — repository continuation.** The owner cancelled the Ethan
transfer and resumed work on their own account. Runtime fixes are committed on
`codex/automated-test-lab`; the interrupted ZIP is not a verified export. Original
planning documents are preserved as historical context. The HTML and all 63
JavaScript test-source hashes still match the passing full run
`2026-09-17T03-20-21-942Z-89339` (16 September local time), whose totals match the
audio-recovery checkpoint below. No new full-run or physical-device result is
claimed by this documentation cleanup. The next engineering task remains the
voice-library intelligibility audit; Warm's "two" is specifically named in the
historical feasibility study and should be investigated first.

**Last updated:** 14 September 2026 — bounded recorded-audio recovery, following architecture review and measured runtime
optimisations, following authorized lifecycle/import fixes and the adversarial review,
two full-code-review passes and local
coaching controls, evidence-backed explanations, authored-workout requests, opt-in
history and optional on-device quality review. These use the existing test
infrastructure. The 9 September
recording adds real-room evidence but is not a completed independent beginner
protocol; that release gate remains open.

**5 September 2026 — automated test lab added.** `testing/README.md` describes a
shared engine/browser/recorded-video test → reproduce → report loop. The original
four harnesses still pass unchanged. New First Steps browser coverage reproduces
the `hasDemo is not defined` exception during calibration on both desktop and
narrow Chromium viewports; see `testing/findings/calibration-has-demo.md`. A separate
shell-only fix now calls the existing helper, with the regression retained. A synthetic blank-video
smoke validates real local pose-inference wiring, not exercise accuracy. No human
recordings or second beginner session have been added; that release gate remains.

**Expanded exercise sweep:** all 21 movements / 44 supported movement-tier pairs now
have synthetic completion, interruption, tracking, framing and applicable counter
checks. All 88 desktop/narrow exercise browser cases passed, including demos, ghosts,
debriefs and CSV downloads. All 12 plan-tier selections passed, as did substituted
camera lifecycle/denial and simulated voice-queue tests. The sweep found a second
calibration demo-label defect (FC-LAB-002, now fixed separately), and Cat–Cow can arm with its required
torso points outside the frame at all three tiers (FC-LAB-003, open). These are
recorded in `testing/findings/`; no failure was whitelisted. Real-video exercise
accuracy remains untested. See `testing/README.md` and the per-run coverage board.

**6 September 2026 — actual voice capture added.** Dedicated wall-clock cases now
record Chromium's decoded MP3 output and retain a speech/exercise timeline, measured
signal, queue decisions and silent screen recording. This closes part of the old
simulated-audio gap. Thirteen cases and permanent silence/overlap mutations are
included in the default test/watch workflow. Repetition and context concerns are
saved for review; selected phrase text is **not** audio transcription. Native TTS
waveforms, speaker audibility and human comprehension remain untested. No app,
vector or Swift behaviour was changed by this infrastructure work.
The first captures found abandoned Plank teaching continuing after Skip, including
new segments starting in the Glute Bridge phase (FC-LAB-004, subsequently fixed
below), and repeated visibility instructions (FC-LAB-005, usability review candidate).
The former became a failing audio invariant; the latter is flagged for listening
and policy review. Initial voice run before the fix: **12/13 cases pass, 237/238 assertions pass**, with only the
reproduced stale-segment failure remaining. All nine persona/tier number samples
pass. The original four harnesses, 92 browser cases and 17 shell cases remained
green; the three previously known Cat–Cow engine failures remain. The capture
harness's omitted-initial-silence defect was fixed and retained as a regression;
it is not an application bug. Use the current audio report rather than those
earlier misaligned recordings.

**6 September 2026 — Skip speech fixed (FC-LAB-004).** The browser now cancels
current/pending speech before applying Skip's new-phase effects. Stopped clip
sequences also ignore delayed rejection/completion callbacks. The original audio
case now passes, including explicit proof that Glute Bridge teaching plays after
abandoning Plank. New shell regressions protect both controls, focus guards,
rest/debrief transitions and the five-second calibration verdict. No engine,
vector or Swift behaviour changed. Reminder frequency is unchanged (FC-LAB-005).
Full verification: **13/13 audio cases (240 checks), 20/20 shell cases (115 checks),
92/92 browser cases (670 checks), and 54/54 infrastructure self-tests pass**.
All four original harnesses pass unchanged. The full run still exits 1 solely for
the three known Cat–Cow engine failures; none are suppressed. Evidence:
`test-results/2026-09-06T17-41-45-725Z-2348/` (local/ignored).

---

## Executive summary

**Latest changes: bounded recorded-audio recovery and stricter playback checks.**
The player checks stalled startup/progress, makes at most one fresh-element retry
before any words start, and retains the original first-start deadline. A failed
line releases the coaching gate with visual guidance; no automatic native/cloud
fallback is added. Tests now require both declared number clips to complete with
their own measured signal and reject hidden watchdog/recorded-utterance failures.
The full `npm test` **passes**, including the two new real-transport fault checks.
The archived build fails both new fault checks
and the stalled-calibration case. The underlying OS/browser trigger of the original
stalls is not established. See [the recovery record](sessions/audio-stall-recovery-2026-09-14.md).

**Latest verification (14 September local time, audio stall recovery):** `npm test`
exits **0** at `test-results/2026-09-15T03-36-59-711Z-84685/`. All **82 infrastructure
tests**, **1,507 targeted tests in 20 suites**, and the four original harnesses pass.
The report contains **346 rows: 334 passing and 12 blocked real-video rows**, with
zero unexpected failures. All six earlier audio failures now pass stricter rules.

| Mode | Cases passed | Assertions |
|---|---:|---:|
| Engine | 55/55 | 1,307 |
| Browser | 110/110 | 942 |
| Interface / shell | 129/129 | 1,106 |
| Recorded-clip audio | 16/16 | 388 |

The 26 review candidates are existing coverage gaps; no AI review or physical-device
validation is claimed. The original totals remain **4,127 conformance**, **eight
caught mutations plus healthy control**, **250 drawing** and **26 skip**; four lost
frame-rate vectors remain unreplayable. The actual-audio mutation suite is retained
at `test-results/audio-mutation-4OUVyI/`, with all ten tests passing while its
deliberately broken captures remain failures.

Final HTML SHA-256:
`cb6e83e77533d22db76f0681128066771fb13feaacc4245ec6f7806106f31bf5`.
The archived build and all 63 recorded JavaScript test-source hashes match the
working files. Judgement/drawing, content, vectors, voice assets, dependencies and
Swift are unchanged in this follow-up. Changes remain uncommitted and unpushed.

**Previous changes: measured browser-boundary optimisations, no engine changes.**
One current-frame conversion feeds drawing and judgement. Passive UI writes are
idempotent without throttling changed observations. Diagnostic appends use
incremental accounting while retaining transactional flag/eviction protection.
The isolated synthetic recorder workload improved **2.34×** (550.22 → 235.37 ms
median), with identical exported snapshots; this is not whole-app FPS or mobile
battery evidence. Eleven new default regression checks and four shell cases
protect the optimisations. All **1,495 targeted tests across 19 suites**, the four
original harnesses and the **14-check blank-video smoke** pass. The final full run
does **not** pass: six recorded-audio cases fail with stalled local clip requests.
The architecture/system guides now describe current boundaries rather than obsolete
UI-coverage and fatigue claims. See
[the architecture review](sessions/architecture-optimisations-2026-09-14.md).

**Previous verification (14 September local time, architecture optimisations):**
`npm test` exits **1** at `test-results/2026-09-15T02-55-42-639Z-80560/`. All **77
infrastructure tests**, **19 targeted suites**, **four original harnesses**, **55
engine cases / 1,307 assertions**, **110 browser / 942**, and **128 shell / 1,100**
pass. Recorded audio is **10/16 cases passing, 293/307 assertions**. The report
has **344 rows: 326 passing, six failed, 12 blocked real-video**. Its 39 review
candidates include failed checks and existing coverage gaps, not 39 distinct bugs.

The six failures involve Ask/Resume, Pause/Resume, queue expiry, tracking-loss
speech and two Warm number samples. Traces show unanswered local MP3 requests and
playback watchdog/cancellation events; all six automatic repeats pass their checks,
but the initial failures remain open. A separate baseline comparison stalled while
importing browser tooling and was stopped. No root cause or environment-only
explanation is established. No audio expectations or production speech logic were
changed to get green. See the architecture review for exact evidence and the
limits of the number-sample checks.

Final HTML SHA-256:
`f8796a4f1cfa83f3ebe2687f810c2dcda0572fd638d4e40eeb9df86cd45cb502`.
The separate final-build blank-video smoke passes **14/14** at
`test-results/2026-09-15T02-54-59-462Z-80424/`. The earlier first-optimisation
full run passed, but predates the final text-node cache edge-case fix and is not
the current verification checkpoint. Changes remain uncommitted and unpushed.

**Previous changes: all five adversarial findings repaired in the browser shell.**
End owns and immediately releases both pending-switch streams; animation callbacks
carry camera-generation identity; wake-lock requests coalesce and reject stale
grants. Diagnostic imports validate blocker lists before replay and guard success,
failure and input cleanup against older reads. The original eight browser cases
now pass; expanded coverage is **18 cases / 89 checks**, plus **221 targeted
control/diagnostic tests**. The **14-check blank-video smoke** passes. Engine
extraction is byte-identical to `e639a9b`;
vectors, Swift, voice assets and dependencies are unchanged. Changes remain
uncommitted and unpushed. See [the repair follow-up](sessions/adversarial-review-2026-09-14.md#authorized-repair-follow-up--14-september-2026).

**Previous verification (14 September local time, authorized repairs):** `npm test`
exits **0** at `test-results/2026-09-15T02-18-47-243Z-76360/`. All **77 infrastructure
tests**, **1,484 targeted tests in 18 suites**, and all four original harnesses pass.
The report contains **339 rows: 327 passing and 12 blocked real-video rows**, with
zero unexpected failures. All six original adversarial failures are now passing;
the other previous rows retain their statuses.

| Mode | Cases passed | Assertions |
|---|---:|---:|
| Engine | 55/55 | 1,307 |
| Browser | 110/110 | 942 |
| Interface / shell | 124/124 | 1,081 |
| Recorded-clip audio | 16/16 | 338 |

The four harness totals are unchanged: **4,127 conformance**, **eight caught
mutations plus healthy control**, **250 drawing** and **26 skip**. The four lost
historical frame-rate vectors remain explicitly unreplayable. The report's **26
review candidates are existing coverage gaps**, not new failures or solved
recognition limits; no AI reviewer was invoked. `npm run test:video` separately
passes **14/14** at `test-results/2026-09-15T02-18-02-794Z-76218/` using synthetic
blank footage, not a human exercise recording.

Repaired HTML SHA-256:
`0b6e49759815f582c3f0196e6613c0aa2b4dae7a7b87e360a416e55b2fdb70ab`.
The archived build, nine recorded build/fixture/lockfile/bridge hashes and all 58
JavaScript test-source hashes match the final files. The expanded browser suite
also deliberately fails **14/18 cases** on the archived pre-fix build, retaining
four healthy controls. No expectations were weakened to make the repairs pass.

**Prior review checkpoint: five open defects; no application changes.** New
adversarial tests reproduce a retained camera stream after End during pending
replacement, revived old animation loops, an orphaned wake lock, malformed
diagnostic blocker lists crashing replay and stale import failure hiding a newer
review. The user explicitly chose review/tests only; nothing was fixed, committed
or pushed. See [the prioritized findings and reproductions](sessions/adversarial-review-2026-09-14.md).

**Prior verification (14 September local time, adversarial review):** `npm test`
exits **1** at `test-results/2026-09-15T02-00-08-396Z-74284/`, for six new shell
failures representing those five bugs. All six automatically reproduce. The
**77 infrastructure tests**, **1,478 targeted tests in 18 suites**, all four original
harnesses, **55 engine / 1,307 assertions**, **110 browser / 942**, and **16 audio /
338** pass. Shell coverage is **108 passing / six failing cases**, with **1,014
passing / 13 failed assertions**. All pre-existing cases retain their statuses.

The report contains **329 rows: 311 passing, six failing, 12 blocked video**.
Its **39 review candidates** are 26 existing coverage gaps plus 13 failed assertions,
not 39 distinct bugs. No unexpected speech concerns or automatic AI review were
added. New coverage includes 132 seeded control histories across all 44 supported
exercise/tier pairs, 44 uneven-cadence cases, 20 diagnostic histories and two
accelerated long-session tests (198 tests total), plus eight browser cases.

The HTML hash remains
`21a6f523e98d178c16c0a715580a743446a19b76ab691ba2e93da8aac4d1cc67`.
The archived build, nine recorded build/fixture/lockfile/bridge hashes and all 58
JavaScript test-source hashes match the final files. Production HTML, root vectors,
Swift and dependencies are unchanged from `e639a9b`. Testing/docs changes remain
uncommitted; real-person, physical-device and cross-browser gaps remain open.

**Full-code review fixes:** view-unreliable form no longer affects scores, cues or
tint; calibration cannot join separate bouts across sustained tracking loss;
camera view uses consistent x/z units and observed shoulder/hip pairs. Pause and
Help expose microphone-off controls inside their modals. Demo return interpolation
is continuous. Workout availability is consistent across picker/search/preview/start
(nine supported plan/tier combinations, three Strong exclusions), and required-video
runs cannot succeed without video. No model, server or movement thresholds changed.
The second pass closes command/touch camera-readiness divergence, dead-camera
Resume, stale recovery callbacks, misleading unavailable-view telemetry and
partial recorded instructions. The original harnesses now consume the saved
build; the mutation harness handles archived paths and cannot call a failed or
missing verifier a healthy control.
See [the fix record](sessions/code-review-fixes-2026-09-14.md), including the explicit
seven-field view migration, one corrected clip expectation and retained failures.

**Earlier verification (14 September local time, second review pass):** `npm test`
exits **0** at `test-results/2026-09-15T00-47-17-766Z-71918/`. All **77
infrastructure tests**, **1,280 targeted tests across 17 suites**, and all four
original harnesses pass. The **320 report rows** contain **308 passing entries**
and **12 blocked video entries**, with zero unexpected failures.

| Mode | Cases passed | Assertions |
|---|---:|---:|
| Engine | 55/55 | 1,307 |
| Browser | 110/110 | 942 |
| Interface / shell | 106/106 | 992 |
| Recorded-clip audio | 16/16 | 338 |

Original harness totals: **4,127 conformance**, **eight caught mutations and a
healthy control**, **250 drawing**, **26 skip**. Four historical frame-rate
vectors remain unreplayable; their missing generator was not recovered.
Swift passes **105 deterministic tests** (26 engine, 22 summary, 57 interaction),
with three optional real-model tests skipped. Shared parity includes **35 movement
evidence rows** and **17 clip-resolution rows**. The separate blank-video smoke
passes **14/14** at `test-results/2026-09-15T00-46-13-980Z-71677/`; it verifies the
MediaPipe adapter on blank synthetic footage, not human recognition accuracy.

All **26 coverage-gap findings** remain explicit: 12 missing-video entries, two
native-TTS waveform gaps and 12 case-level recognition/real-person warnings.
There are no unexpected speech review candidates. No AI reviewer, physical-device
test or new real-model smoke was invoked. No push or remote CI run is claimed.

Final HTML SHA-256:
`21a6f523e98d178c16c0a715580a743446a19b76ab691ba2e93da8aac4d1cc67`.
The saved build, all nine recorded build/fixture/lockfile/bridge hashes and all
56 recorded JavaScript test-source hashes match the final files. Documentation
was updated afterwards for the requested review commit. The earlier failed
second-review run is retained: it exposed the mutation harness's archived-path
assumption, now repaired and covered by real archived-build and failed-control
tests. See the fix record for both review passes and the deliberately limited
eight-field root-expectation migration.

**Earlier verification (14 September, first review pass):** `npm test` exits
**0** at `test-results/2026-09-14T23-02-24-220Z-66545/`. All **72 infrastructure
tests**, **1,255 targeted tests across 17 suites**, and the four original harnesses
pass. The **315 report rows** comprise 303 passing entries and 12 blocked video
entries; there are zero unexpected failures.

| Mode | Cases passed | Assertions |
|---|---:|---:|
| Engine | 55/55 | 1,307 |
| Browser | 110/110 | 942 |
| Interface / shell | 101/101 | 957 |
| Recorded-clip audio | 16/16 | 338 |

Swift passes **104 deterministic tests**, including the **35 shared movement
evidence cases**, with three optional real-model smokes skipped. The final-build
blank-video smoke separately passes **14/14** at
`test-results/2026-09-14T22-59-57-152Z-66194/`. This is adapter wiring, not human
exercise accuracy. All **26 coverage-gap findings** remain explicit; no AI reviewer
was invoked and no gap was labelled solved by passing software tests.

That checkpoint's HTML SHA-256:
`6f4c41fd1841f88a6609c016c89082fe76380b49d1544de6f708f27b790d89b5`.
The saved build, root vector hash and every recorded JavaScript test-source hash
matched that checkpoint's files; documentation was updated afterwards. Seven historical
view-checkpoint fields were deliberately migrated, with all other root expectations
and the original 27 shared evidence rows preserved. Those changes were still
uncommitted at that checkpoint and are included in the subsequent review commit.

**Local coaching interactions:** Ask coach pauses and explains recent measured
counting conditions, with existing demos and repeat teaching. Typed and optional
strictly local spoken commands use the actual controls, with expiring explicit
Skip/Finish/End confirmation and no model authority over counting. Authored-plan
search never relaxes a hard constraint or invents a routine. Independent local
memory opt-ins save bounded preferences/activity counts, not scores or inferred
improvement. Browser choices are deterministic; native `FormCoachInteraction`
provides optional local speech and approved-ID AI selection for the future host.
SessionCore/CalibrationCore and native UI remain unported. The existing runner
prepares synthetic review evidence; `npm run test:review -- --run <exact-run>`
optionally prioritises existing findings without changing an oracle or closing
coverage gaps. See [implementation and evidence](sessions/local-coaching-2026-09-14.md).

**Earlier verification (14 September, local-coaching checkpoint):** `npm test`
exits **0** at `test-results/2026-09-14T15-22-34-852Z-54396/`. All **67
infrastructure tests**, **1,202 targeted checks across 16 suites**, and all four
original harnesses pass. Scenario results:

| Mode | Cases passed | Assertions |
|---|---:|---:|
| Engine | 55/55 | 1,307 |
| Browser | 110/110 | 942 |
| Interface / shell | 96/96 | 935 |
| Recorded-clip audio | 16/16 | 338 |

The new suites add **402 targeted checks**, eight shell cases and a real-clip
Ask → Repeat → Resume case. Original checks remain **4,127 conformance**, **8
caught mutations and a green control**, **250 drawing** and **26 skip**. No root
vectors were regenerated. All **26 coverage-gap findings** remain explicit: 12
missing-video entries, two native-TTS waveform gaps and 12 case-level recognition/
real-person warnings. There are no unexpected failures or speech review candidates.
The export packages all **309 case rows** without invoking AI automatically.

Swift passes **104 deterministic tests**, with three opt-in model tests skipped
in its default 107-test run. The two new explicit real-model choice smokes pass
on this Mac (7.316s explanation, 0.724s synthetic plan). Model availability and
valid IDs are demonstrated, not semantic quality, microphone recognition or
physical-phone performance. Native UI/session cores remain unported.

The explicit native reviewer also passes on that final full report at
`ai-review-g1NNFD/`: four batches and a final selection all used the actual local
model. It selected one existing native-TTS waveform gap and preserved the other
25 candidates, with `humanReviewRequired:true` and `accuracyVerdict:not-assessed`.
This proves bounded transport/import, not correct prioritisation or resolved gaps.
The final-build blank-video smoke separately passes **14/14** at
`test-results/2026-09-14T15-32-39-212Z-56068/`, establishing wiring, not exercise accuracy.

Tested HTML SHA-256:
`2c36d8972395c71829a8c2e540b5b7b072d32c900f79440b6df5b448c1efdfcc`.
These are working-tree tests based on `519dbae`; the HTML and every recorded JS
test-source hash match the final files. Documentation is updated afterwards.
The CI job includes all suites and has a bounded 30-minute allowance for browser,
actual-audio, dependency setup and evidence upload. Remote CI was not run/pushed
in this turn. Earlier incomplete and failed runs, including the action-timestamp
measurement correction, are retained and explained in the session handover.

**Evidence-backed summaries:** the browser now presents concise recorded-work
highlights and explicit measurement limits. Unsupported fatigue/setup diagnoses,
perfect-form/progress claims and automatic harder-tier advice are removed. Native
`FormCoachSummary` is an optional, separately packaged on-device card selector;
it cannot generate measurements or new coaching prose. The browser still uses
templates, and SessionCore/CalibrationCore/native UI remain unported. See
[the implementation and evidence](sessions/workout-summaries-2026-09-14.md).

**Previous verification (14 September, summary checkpoint):** `npm test` exits **0**
at `test-results/2026-09-14T13-36-38-583Z-35989/`. All **65 infrastructure tests**,
**800 targeted regression checks across 11 suites**, all four original harnesses,
**55 engine / 1,307 assertions**, **110 browser / 942**, **88 shell / 847**, and
**15 recorded-audio / 301** pass. The new summary tests contribute **50 checks**
and **ten shell cases / 70 assertions**. The original conformance vectors are
unchanged; all 26 existing coverage-gap findings remain explicit. The separate
blank-video smoke passes **14/14** at `2026-09-14T13-41-03-467Z-37556`.

Swift passes **47 tests**, with one opt-in model smoke deliberately skipped in
the default run. Its new summary tests share 22 selection vectors with JavaScript.
The explicit real-model smoke separately passes on this Mac: local model available,
one valid card selected in **3.110 seconds** within the final ten-second deadline.
The initial probe took **5.032 seconds**, motivating the larger budget; templates
are immediately available throughout. Neither run certifies selection quality or
physical-phone performance. The existing CI workflow now includes a macOS Swift
job, but remote CI has not been run/pushed in this turn.

Final tested HTML SHA-256:
`2989c28d498fc6a2f5a21e533d94bc4351a47c92ffe80696dd90d8d92a0d2e3d`.
These are working-tree tests based on `bcdfdb0`; final app and JS test-source hashes
match the saved report. Native changes were tested separately after that report.

**Interface review:** clearer onboarding/navigation, actual expanded-set workout
previews, current/next movement context, explicit pause/resume, background pause,
early-end summaries and local in-app help. Startup no longer waits for the pose
library to show onboarding. Camera requests can be cancelled; late requests release
their streams, and failed camera switches preserve the existing workout. Critical
controls stay legible, mobile layout spacing follows actual control/header size,
and stale exercise instructions no longer cover debrief exits. Pausing cancels
speech; returning cannot resume an old correction or finish a partial rep across
an unobserved gap. No new service, dependency or persistent personal-data store.
See [the feature-by-feature audit](sessions/interface-review-2026-09-14.md), including
the explicit physical-device, accessibility and human-usability limits.

**Previous verification (14 September, interface checkpoint):** `npm test` exits
**0** at `test-results/2026-09-14T05-52-19-649Z-29535/`. All **65 infrastructure
tests**, **750 targeted regression checks across ten suites**, and all four
original harnesses pass. The scenario results are:

| Mode | Cases passed | Assertions |
|---|---:|---:|
| Engine | 55/55 | 1,307 |
| Browser | 110/110 | 942 |
| Interface / shell | 78/78 | 777 |
| Recorded-clip audio | 15/15 | 301 |

The original harnesses retain **4,127 conformance checks**, **8 caught mutations
and a green control**, **250 drawing checks** and **26 skip checks**. The new
interface suite has **56 checks**, including all supported exercise/tier pauses
and a deliberate portrait-layout mutation. No recorded vectors were regenerated.
There are zero unexpected failures and zero speech review candidates, but **12
missing-video entries, two native-TTS waveform gaps and 12 case-level recognition/
real-person warnings remain** (some repeated across modes). Passing software checks
do not validate human body/clothing recognition or beginner intuitiveness.

The separate real-inference blank-video smoke passes **14/14**, with 90 CPU
inference frames, at `test-results/2026-09-14T05-41-12-690Z-26770/`. It is wiring
coverage, not exercise accuracy. Swift was unchanged and not rerun for this UI
pass: SessionCore and CalibrationCore are not present in that package yet.

These are working-tree runs based on `375798a`. The final full report's app and
all recorded test-source hashes match the final code; documentation alone was
updated afterwards. Tested HTML SHA-256:
`d69c49ba3c2ac473e2f7b869e25c01f630d5908923a2d14f7c5ef39cc73ccee7`.
The failed run at `2026-09-14T05-41-57-906Z-27043` is retained: an accelerated
geometry assertion ran before ResizeObserver delivered layout. The trace diagnosis,
paint-aligned timing correction and permanent real-overlap negative control are
documented in the interface review; the original overlap assertions remain intact.

**Body/clothing tolerance:** keep a complete observed movement side through
confidence flicker; change sides only for missing required observations, never for
a better form score. A real source change still breaks unfinished reps. The explicit
**Follow along (unassessed)** option keeps current-set teaching and a manual finish,
without invented camera reps/hold time/form. Next movement returns to assessed setup.
Low camera scores no longer automatically shorten hold targets. No model, range,
tempo, confidence or weight/BMI-based thresholds changed. Browser evaluator behavior
was mirrored in Swift. See [the implementation and validation plan](sessions/body-clothing-tolerance-2026-09-14.md).

New coverage uses the same default runner/watch/CI: **235 body-tolerance checks**,
**27 shared browser/Swift evidence cases** (ten appended, original 17 unchanged),
two engine/browser timelines, four shell cases and a fourteenth real-clip audio
case. These prove software invariants, not accuracy across larger bodies or clothing.
Both-side missing required geometry, legacy image-relative line quality metrics,
and calibration's interrupted-bout aggregation remain explicit limitations.

**Previous verification (14 September, body/clothing checkpoint):** `npm test` exits **0** at
`test-results/2026-09-14T04-42-17-567Z-17587/`: **65 infrastructure tests**, all nine
regression suites and four original harnesses; **55 engine cases / 1,307 checks,
110 browser cases / 942 checks, 65 shell cases / 673 checks, and 14 audio cases /
270 checks**. Zero failures or speech review candidates. Twelve missing-video
entries, two native-TTS waveform gaps and twelve case-level recognition/real-person
warnings remain (repeated across execution modes); these are not accuracy passes.
Swift passes **25/25**, including the 27 shared evidence rows. The separate existing
blank-video smoke passes **14/14**, with 90 real CPU inference frames, not a human
recognition trial. See the implementation note for its artifact directory.

This was a working-tree run based on `7edc6ac`, not a claim that the old commit
contains those changes. The report's app and test-source hashes matched the final
code at that checkpoint; only documentation changed after that run. Tested HTML SHA-256:
`698b5821364326a64d1e123c996869764fdf28d94b0bb0ae950e3d155baae579`.
The earlier full run at `test-results/2026-09-14T04-30-11-959Z-15344/` also passed;
the final run additionally includes the recorded-video interval accounting regression.

**Four-exercise test pack, existing infrastructure:** `npm run test:partial` selects
Squat, Crunch, Leg Raise and Plank through the same engine/browser/video runner,
reports, screenshots/traces and failure reproduction. Four new timelines are also
in default test/watch/CI. Thirty companion tests cover all nine supported tier
pairs, fixture transformations, exact hold freezes, false-credit mutations and
explicit unresolved-recognition reporting. No production HTML, model, thresholds,
vectors, speech or Swift behaviour changed. See `testing/partial-visibility.md`.

The focused run passes **4 engine cases / 77 checks** and **8 desktop/narrow browser
cases / 180 checks**. Requiring missing video correctly exits 2. Leg Raise/Plank
ankle-loss safety checks remain labelled recognition gaps, not a claimed fix.
Screenshot review additionally flagged a narrow-screen warning/control overlap;
the 14 September layout pass fixes it with dedicated phone geometry and interaction
checks. Physical-device and enlarged-text layout validation remain open.
See `testing/findings/partial-view-mobile-warning.md` for the retained evidence.

**Previous verification (8 September):** `npm test` exits **0** at
`test-results/2026-09-08T08-11-50-039Z-80412/`: 64 infrastructure tests, all eight
regression suites (including the 30 new pack tests), the original four harnesses,
**53 engine cases / 1,291 checks, 106 browser cases / 894 checks, 61 shell cases /
628 checks and 13 audio cases / 238 checks**. Ten missing-video entries, two native-
TTS waveform gaps and six case-level recognition warnings (two unresolved problems
repeated across engine/desktop/narrow modes) remain. Zero speech review candidates
does not certify coaching quality; the separate manually reviewed layout candidate
above was still open at that run. Swift was unchanged and not rerun for that infrastructure-only
change. See `sessions/partial-visibility-pack-2026-09-08.md` for artifact identity.

**Latest user recording — software fixes are not release validation.** All five
retained cases in `testing/reported-session.test.mjs` now pass. Optional cropped
neck evidence no longer vetoes otherwise visible Crunch cycles or invents a neck
score. Required movement/position/hold evidence cannot silently disappear from
the gates. Missing targets and side changes clear stale smoothing and unfinished
cycles, while completed work remains. See `movement-evidence-contract.md` and
`sessions/movement-evidence-fixes-2026-09-08.md`.

The Leg Raise ankle driver and required Plank geometry are still necessary under
the current declarations. No alternative thigh driver or hidden-joint reconstruction
has been validated. Native speech startup and calibration continuity still need
validation/work; automatic target shortening was removed on 14 September. Synthetic
green checks do not disprove the recording's recognition issues.

**Native experiment:** the final read-only check finds an iPhone 16 Plus **available
(paired)**, first-launch setup passes, and the installed CoreDevice version matches
Xcode's wrapper. The initial component lookup failure is not a current blocker.
No usable signing identity is available; selecting the user's Apple account/team
in Xcode remains necessary before deployment. No native app has been deployed or
phone performance measured. The protocol and signing prerequisite are in
`sessions/native-spike-readiness-2026-09-08.md`. Full interface porting and
modularisation remain separate; there is no framework/model replacement in this fix.

**Previous movement-evidence verification:** `npm test` exits **0** at
`test-results/2026-09-07T23-49-22-795Z-63278/`: 64 infrastructure tests; 18 coaching,
120 prompt, 17 diagnostic, 13 worker, five reported-session, 229 movement-evidence
tests and 17 shared cases; all four original harnesses; **49 engine cases / 1,214
checks, 98 browser cases / 714 checks, 61 shell cases / 628 checks and 13 audio
cases / 239 checks**. Swift passes **25/25** separately. Six video entries and two
native-TTS waveform gaps remain; zero speech review candidates is not listening
approval. Artifact hashes and a subsequent focused test-only clock-assertion check
are in `sessions/movement-evidence-fixes-2026-09-08.md`.

The preceding complete run at `test-results/2026-09-07T23-26-06-025Z-57814/` exited
1 for one audio-monitor cancellation assertion (12/13 cases, 236/237 checks), not
a movement failure. Its automatic reproduction passed; neither capture was
discarded. The separate repair and permanent negative controls are documented in
`sessions/audio-pending-cancellation-2026-09-08.md`.

**Recorder and optional-help fixes:** the recorder opens in a fixed, scrollable header
drawer without resizing the stage; starting capture closes it and leaves a quick flag
button. Schema 2 protects events/periodic summaries and up to eight available ±10s
flagged windows at up to 5Hz. Unprotected recent frames roll off; protected-space
exhaustion visibly pauses capture without replacing saved evidence. Legacy imports
remain readable. Everything stays opt-in and memory-only, with explicit export/erase.

Optional help now requires five seconds of setup grace followed by six continuous
seconds of observed difficulty, known view and visible passing position targets.
Recovery immediately withdraws the choice; an unaccepted alternative is visual only.
This is a usability policy, not an ability measurement. That earlier recorder/prompt
phase changed no evaluator thresholds, vector expectations or Swift code. See
`sessions/recorder-prompt-fixes-2026-09-07.md` for policies, tests and verification.
The earlier lost landmarks cannot be recovered. The subsequent partial-view change
deliberately refreshes only three fields in `crunch-needs-the-ear`, plus provenance;
its failed bent-knee gate and zero credited work remain unchanged. Thresholds and
other recorded expectations are unchanged. Swift mirrors the browser changes and
passes 25/25, including the 17 additional shared evidence cases and six focused
regressions.

**Previous recorder/prompt verification:** `npm test` exited **1 solely for partial-view Crunch** in the
five-case reported-session suite (four pass, one fails). All other suites pass:
60 infrastructure, 18 historical coaching, 120 prompt, 17 diagnostic-buffer and 13
worker-queue tests; **48 engine cases / 1,207 checks, 96 browser cases / 694 checks,
61 shell cases / 628 checks, 13 audio cases / 238 checks**. All four original harnesses
pass unchanged. Evidence: `test-results/2026-09-07T22-38-12-040Z-47950/`;
the linked recorder/prompt handover records the exact artifact hashes and remaining
five video / two native-TTS coverage gaps. Swift is unchanged and was not rerun in
this phase; the earlier 18/18 result remains its last verification.

**Parallel audit fixes:** turning automatic Voice off now stops current/pending
speech, active camera-angle instructions withdraw on recovery, and recorded playback
failures get a visible explanation. Explicit **Hear it** previews share the same
playback ownership and remain available while automatic Voice is off. Seven new
browser cases protect these paths. The isolated worker also rejects future timestamps
without damaging its queue, and counts only results actually delivered to its consumer;
four new unit tests protect that hardening. These are not claimed fixes for the
recording's native speech timeouts or partial-visibility failures.

**Previous parallel-audit verification:** `npm test` exited **1 solely for the new
`reported-session` suite** (two controls pass, three cases fail). All other checks
pass: 60 infrastructure tests, 18 historical coaching regressions, six diagnostic
tests, 13 worker-queue tests; **48/48 engine cases (1,207 checks), 96/96 browser
cases (694 checks), 57/57 shell cases (349 checks), 13/13 audio cases (238 checks)**.
All four original harnesses pass unchanged. Swift source is unchanged from its
earlier 18/18 run. Evidence: `test-results/2026-09-07T21-56-42-550Z-40759/`;
artifact hashes and coverage limits are in `sessions/local-stack-2026-09-07.md`.

**7 September 2026 — local-first stack improvements.** Session speech and the preview
now require an explicitly local English voice; unavailable speech is explained visually
without blocking the workout or using a remote default. Opt-in, memory-only diagnostics
retain bounded joint/measurement/coaching evidence, with flagging, pause/resume, explicit
export and local timeline review. Replay shows saved observations, not new inference.
Current coaching facts withdraw obsolete speech and limit repetition without treating
cue cooldown as recovery. See `sessions/local-stack-2026-09-07.md` for the privacy
boundaries, retained tests and benchmark evidence.

The pose worker remains an **isolated experiment**, not the live app loop. A desktop
blank-frame CPU benchmark reduced p95 main-thread timer delay from 10.7ms to 1.1ms;
the headless GPU run was much slower and discarded stale frames. Neither proves
real-exercise accuracy or phone performance. Physical-phone testing is required before
adoption. No vector expectations or Swift source changed in this follow-up.

**Earlier local-first baseline verification:** `npm test` exited 0: 59 infrastructure tests, 18 coaching
regressions, six diagnostics tests, nine worker-queue tests; **48/48 engine cases
(1,207 checks), 96/96 browser cases (694 checks), 50/50 shell cases (293 checks),
13/13 audio cases (238 checks)**. The original four harnesses and Swift 18/18 also
pass. Evidence: `test-results/2026-09-07T18-21-56-328Z-32487/`; precise artifact
hashes are in the linked local-stack handover. Five video gaps and two native-TTS
waveform gaps remain. A new user recording supplied after this run reports further
real-world failures; these are not disproved by synthetic green checks.

**7 September 2026 — historical fixes implemented.** The browser now rejects
active-state false reps and interrupted returns, explains quality-blocked setup,
withdraws recovered tracking warnings, gives specific camera-error advice and
shares one 30-second readiness-reminder budget. Rep drivers measure range/tempo,
not static FORM: glute bridge retains its reps with a null form score. Stationary
hold praise no longer fires during rep movements. Guided clipping is fixed too.
The matching evaluator/counter changes are mirrored in Swift; Session/Calibration
are not yet in that port. Exactly nine score checkpoint fields were deliberately
refreshed, with unchanged tolerances and other expectations. See
`sessions/historical-fixes-2026-09-07.md` for the policy, regressions and remaining
real-person/audio coverage limits. The review baseline below predates these fixes.

**Historical-fix baseline verification (before the local-first follow-up):** `npm test` exits 0: **59/59 infrastructure tests,
18/18 coaching regressions, 48/48 engine cases (1,207 checks), 96/96 browser cases
(694 checks), 27/27 shell cases (140 checks), and 13/13 audio cases (237 checks)**.
All four original harnesses pass, as do **18/18 Swift tests**. All 21 exercises /
44 supported tier pairs are represented; no failure was suppressed. Five video
entries remain coverage gaps, and two audio cases each report an uncaptured
native-TTS fallback. No speech review candidates occurred in this run, which is
not listening or beginner sign-off. Evidence:
`test-results/2026-09-07T13-39-12-715Z-23358/` (local/ignored); the saved build hash
matches the reviewed vector metadata and the linked implementation follow-up.

**7 September 2026 — historical recordings reviewed.** A sampled review of 17
screen recordings (246 frames, selected local-only machine transcription) confirms
several old fixes and identifies remaining counting, setup explanation, scoring
and camera-message concerns. See `sessions/historical-recording-review-2026-09-07.md`.
Two new default engine/browser scenarios reproduce FC-LAB-006: after one valid
push-up, upright elbow bends or off-screen cycles increase the count to four.
At that review baseline these were open failing invariants, not expected failures.
No production, vector or Swift changes were made during the review. Human screen recordings are now available for
review, but no clean-camera/landmark replay or second beginner trial is claimed.

Full verification after adding those cases: **58/58 infrastructure self-tests**;
all four original harnesses green (4,127 vector checks, 8 mutations, 250 drawing
checks, 26 skip checks); **43/48 engine cases (1,207 checks), 92/96 browser cases
(694 checks), 20/20 shell cases (115 checks), 13/13 audio cases (240 checks)**.
The nine failing cases are six executions of the two new push-up scenarios and
the three existing Cat–Cow failures; all reproduce. No existing case changed
pass/fail status. Five video entries remain coverage gaps, and one visibility-
speech repetition concern was flagged for review. The full run exits 1; nothing
was whitelisted. Evidence: `test-results/2026-09-07T08-19-42-453Z-12402/` (local/ignored).

**The core thesis is validated.** A first-contact user who had never seen the app said the
real-time form corrections and the red/amber body tint were what he liked about it. That was
the unproven bet everything rested on.

**Zero wrong corrections** in the session — the gate criterion. But the app did confuse him
about his own form via a stale banner, so v4.9 was cut to close that and four other defects
the test exposed.

**One beginner session down, one to go.** Test 02 on v4.11 is the remaining gate requirement
before the Swift port is justified.

---

## Ground truth

| | |
|---|---|
| **Build** | `form-coach-v4.11.html` — single file, 367,224 bytes (359 KiB); existing external runtime, model and font assets remain; not yet an offline package |
| **Verification** | Four harnesses green: `verify.mjs` **4,127/4,127** against 1,896 recorded vectors · mutations 8/8 caught with a verified control · drawing 250/250 · skip 26/26 · Swift 105 deterministic tests, including 35 shared movement-evidence and 17 clip-resolution cases, plus three opt-in model smokes skipped |
| **Content** | 21 movements (10 rep · 10 hold · 1 guided), 5 plans, 3 tiers, 3 personas |
| **Voice** | Previous render plan: 1,351 clips, 210 pending. Five new readiness/framing keys also need recorded clips; fallback requires a verified local English voice or remains visual-only. No new render/cost estimate is claimed. |
| **Swift package** | 36 Swift files (24 source files, 11 test files and Package.swift); root conformance and movement-evidence fixtures current; native session cores/UI remain unported |
| **Beginner tests** | **1 of 2 complete** — see `test-01-max.md` |

### A note on the test count

The project previously reported "3,789 vector checks". **Those suites are gone** — they
lived only in an ephemeral sandbox and were lost when it reset. They were never delivered
files.

The **vectors survived**, and they held the valuable half: the expected outputs. `verify.mjs`
reconstructs 4,127 checks from them, in a better shape than what it replaced — one file, one
source of truth, shared with the Swift tests so the two cannot drift.

**The 23 divergences are closed, and all 23 were *harness* faults** — the build never diverged
and the vectors were never wrong (the reasoning is kept in `README-verify.md`, including a note
that two of the diagnoses were wrong in their specifics while right about the cause).
`verify.mjs` now exits 0 and `swift test` passes 18/18 against the same JSON. The `frameRate`
section (4 vectors) is still skipped: it isn't replayable without the lost generator.

**What was genuinely lost:** the behavioural scenario suites — cooldown neutrality, plan
completion, regression swaps — and **`gen-refs.mjs`, the FK rig that generated every demo
skeleton**. The rig's loss is why the corrected keyframes are hand-authored; they are checked
instead by running each frame through the Evaluator's own read path against the movement's
real gates. Rebuilding either is worth less than beginner test 02 and is sequenced after it.

---

## What is proven

**The coaching engine.** Scoring, tier scaling, rep counting with hysteresis and tempo
floors, short-range detection, view-awareness, cue selection, frame-rate normalisation, form
tint, framing. All vector-covered and deterministic.

**Robustness.** Out-of-order API calls, degenerate input (null frames, `NaN`, out-of-range
coordinates), dropout and recovery, rapid position flicker — all absorbed without throwing.

**The product on a real body.** Real-time correction works and reads as help. The interface
is legible. The tint communicates.

## What is not proven

**That the fixes worked for another beginner.** v4.9 addressed five defects that test 01
found; v4.11 carries those fixes plus the later reference-drawing and skip work. Nobody has
put the current build through beginner test 02.

**That a beginner can complete a session unaided.** Max needed clarification on "side-on",
and several movements had unregistered reps. Whether v4.11 resolves that is the open question.

**Device variation.** One phone, one room, one body.

---

## Critical path

**Updated engineering gate:** recorder usability/retention and prompt recovery are now
fixed. The partial-view Crunch case and further speech/timing issues remain open.
Resolve the linked findings before treating engineering as clear. Next priorities are
separate movement/form evidence, stable hold behaviour and a consistent bundled voice.
Physical-phone checks and beginner test 02 remain necessary; replay does not replace them.

```
NOW ──▶ render 210 voice clips (~£1–2.50, 10 min)
        └─ mixed recorded/TTS was likely half the "overlapping voices" complaint

    ──▶ smoke-test v4.11 yourself (15 min)
        └─ crunch and side plank — re-authored after test 01
        └─ GLUTE BRIDGE — step 2 of First Steps, the demo a beginner meets
           earliest of all, and the one that was never on anyone's list
        └─ REF has coverage (refGates) and so does its DRAWING (verify-draw,
           after bug #43 — every demo was being stretched by the canvas
           aspect); the shell now has automated coverage, but no test can
           tell you a demo reads as the movement — only you can
        └─ the demos are now drawn ~29% smaller in the 480x340 box, which
           fits a square: correct proportions, less of the box used. Judge
           it on screen — the canvas is one line if it wants changing

    ──▶ ★ BEGINNER TEST 02 on v4.11 ★
        └─ measures the fixes · ask the wrong-corrections question explicitly

    ──▶ score both sessions against swift-port.md
        PASS → pay Apple fee → Week 1 of the port
        FAIL → fix in the browser, re-test
```

*Engineering work that exists but does not gate any of the above: rebuild the lost behavioural
suites; `drawRef`'s ground line; `hollow-tuck`'s folded leg. All in `engineering-log.md` under
known open items.*

---

## Open items

**From test 01** — see `test-01-max.md` for the full list. Highest value: demo audio synced
to the animation, and a per-exercise debrief (the data is already logged).

**Engineering** — two orphaned movements (`hollow-tuck`, `hollow-hold`, the first still
carrying the rig's folded leg but having no knee gate to author against); `leg-raise-bent` is
**unreachable** — no plan lists it and its only route, regression from `leg-raise`, needs a
`learning`-tier user in a `building`/`strong`-only plan; `dead-bug` frame 1 fails
`kneeTucked` permanently and correctly; `drawRef`'s ground line floats above a correct
dead-bug tabletop; tint solo coupled to `cueBudget`; explicit `video.videoWidth` aspect (port
Week 1); framing is 2D-only so it can't detect bad camera *tilt*.

**Deliberately unpatched** — a frame with no `cam` throws. Unreachable from `buildFrame` and
boundary-caught; changing engine code immediately before user testing is the worse trade.

---

## Assessment

**Strengths.** The engine/shell split keeps paying out — every test-01 fix landed in one
place and most port for free. Content-as-data meant correcting a broken demo was editing
nine numbers, and the vector diff caught it. The honesty principle is enforced by audit.
Zero running costs make £4.99 one-time viable.

**Risks.** The demos are the weakest part of the product; five more frames across three
movements have now been corrected, and the way they were found is the warning. They were sat
on for a week behind a diagnosis ("asymmetric movements a single-sided skeleton can't show")
that was plausible, wrong, and — because it pointed at *asymmetry* — steered attention away
from `glute-bridge`, the most-used demo of the three. **None of it was caught by a test,
because the demos had no automated coverage.** They do now — `refGates` (224 checks) asserts
every demo against its own gates and is itself mutation-tested, so this exact class fails by
name rather than waiting for someone to look. A second gap in the same area closed with bug
#43: `refGates` reads keyframe *numbers*, and every demo was being **drawn** stretched by the
canvas aspect — 1.41x in the demo box, 1.78x in the ghost, which meant a correct pose could
never line up with the ghost it was being asked to copy. `verify-draw.mjs` (250 checks) now
holds the drawing. What neither can judge is whether a demo *reads* as the movement:
`glute-bridge` frame 1 passed every gate for months while drawn rigidly rotated ~51°. The
privacy promise constrains features (history, voice control) in ways that need respecting
rather than working around. Single-camera geometry means some faults — squat valgus above all
— are permanently invisible and must be taught rather than corrected.

**The shape of the remaining work has changed.** Before test 01 the question was "does this
work at all?" It does. The question now is "does it work *well enough to teach someone*?" —
and that turns on the demos and the debrief far more than on the engine.

**One line:** thesis validated, five defects fixed, one beginner session to go.
