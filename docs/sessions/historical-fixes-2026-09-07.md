# Historical review — implemented fixes, 7 September 2026

Follows [the sampled historical review](historical-recording-review-2026-09-07.md).
The user authorised fixes after that review. The review remains a dated record of
the earlier build; this document records the subsequent changes to v4.11.

## Changes

- **FC-LAB-006, active rep validity:** position, view, clipping, driver-joint
  confidence and missing observations invalidate the unfinished cycle. A one-frame
  interruption is enough; smoothing cannot carry a good pose across it. Completed
  reps and the observed baseline survive. Returning at the peak does not earn a
  rep; rest followed by a fresh complete cycle does. Imperfect form is not the
  same thing as leaving the exercise position. Invalid observations are unscored
  and the interface explains why counting paused. That warning is withdrawn on
  recovery, so it cannot persist while new reps count.
- **Setup:** quality blockers receive an explanation before arming, rather than
  unearned “Hold it there” praise. An existing eligible regression can be offered
  during setup. A missing frame resets the continuous readiness window. The
  session's 1.8s sustained position-and-quality requirement is unchanged.
- **Scoring:** the rep-driving angle is a changing movement, not a fixed posture
  target. It still controls range/tempo decisions, but contributes neither static
  FORM score nor red driver tint. Other quality measurements remain scored. Bridge
  has no remaining independent form measurement: its score is null, its bar is
  hidden, and the debrief names “form not scored” while retaining completed reps.
  No 0/100 substitute or second session-score accumulation was added. Hold
  scoring and existing tempo/short-range counters are unchanged.
- **Speech:** no stationary `goodhold`/`fixed` praise during rep movements.
  Missing tracking and other readiness explanations now share one reminder per
  30 seconds per movement, including calibration. Changing the error does not
  create a rotating stream of instructions. Visual explanations remain available.
- **Framing:** top/bottom clipping names the image edge, not an invented missing
  head or feet. New keys prevent playing old body-part recordings under new text.
- **Camera:** permission, missing hardware, unavailable/busy camera, unsupported
  settings and interrupted startup get distinct advice. Model startup is
  distinguished from camera access. Failed startup releases its stream/wake lock
  and restores the controls; the obsolete v4 localhost address is gone.
- **FC-LAB-003:** guided clipping is checked before accumulating hold time.
  Cat–Cow remains guided/unscored; no exercise or failing test was removed.

## Deliberate specification change

Exactly nine existing `evaluatorScenarios` score fields changed:

| Scenario | Frame(s) | Before → after |
|---|---|---|
| bridge-priming | 89, 149, 209, 353 | 100 / 0 / 0 / 3 → null |
| pushup-standing-blocked | 19 | 100 → null |
| legraise-feet-gate | 39 | 51 → null (invalid position) |
| legraise-feet-gate | 79 | 50 → 100 (straight-knee quality, no moving-driver penalty) |
| reps-need-arming | 203, 407 | 3 / 3 → null |

`testing/refresh-reviewed-vectors.mjs` is a constrained, explicit one-time refresh:
it checks the independently reviewed values above before writing. It is **not**
invoked by the test runner and is not a general recorder that turns failures green.
Other checkpoint fields, all other vector sections, inputs and tolerances are
unchanged. Metadata names v4.11 and records the reviewed application hash. Five
new dialogue keys were mechanically exported into the existing root content pack.

HTML was changed and verified first, then the matching `Evaluator`/`RepCounter`
Swift paths. The previously misplaced Swift clipping guard is aligned for judged
as well as guided movements. Session, Calibration and the browser shell are not
in the Swift port yet; no fictional mirror of those classes is claimed.

## Verification

Eighteen permanent coaching regressions include positive controls, interrupted
returns, subsequent valid reps, setup explanations, timer continuity, reminder
budgets, scoring and framing language. They run in the default test/watch/CI loop
against its selected build. New browser cases check camera error text, release
after model failure and the actual unscored debrief. The original six FC-LAB-006
executions and three FC-LAB-003 cases retain their original expectations.

Swift passes 18 tests, including independent interruption/recovery, bridge-null
and guided-clipping checks. Original browser harnesses remain at 4,127 conformance
checks, 8 caught mutations, 250 drawing checks and 26 skip checks.

Final `npm test` exits 0. Saved run:
`test-results/2026-09-07T13-39-12-715Z-23358/` (local/ignored).
Application SHA-256:
`17e98a0017efd809760941ea2287019797572a37de9e77c785c32f4ada42cac8`.
This matches the reviewed vector metadata; the saved build is the verified build.

| Suite | Passing cases/tests | Passing assertions |
|---|---:|---:|
| Infrastructure, including actual silence/overlap mutations | 59/59 | — |
| Historical coaching regressions | 18/18 | — |
| Engine scenarios | 48/48 | 1,207/1,207 |
| Desktop/narrow browser scenarios | 96/96 | 694/694 |
| Shell/interface scenarios | 27/27 | 140/140 |
| Recorded-clip audio scenarios | 13/13 | 237/237 |

All 21 exercises / 44 supported exercise-tier pairs are represented. There are
no failing cases or speech review candidates in this run. Five missing-video
entries remain blocked coverage, not passes. Two audio cases each requested one
native-TTS fallback whose waveform is not captured. Audio assertion totals follow
the clips actually captured; fewer recorded reminders do not establish TTS coverage.
The report therefore says **passed checks; video and audio coverage incomplete**.

During development the tests caught a syntax error in the test-only model stub
and assertions that ignored CSS uppercasing or the word “is” in “counting is
paused”. These were repaired without changing app wording or hiding exceptions.
An early combined-module syntax test is retained.
The debrief was visually inspected. Static sweeps found no unresolved literal DOM
ids/CSS variables, missing/dead effect handlers or duplicate top-level functions;
runtime classes/selected states and the global hidden override remain styled.

## Remaining limits

Five new speech keys currently fall back to native TTS until recorded clips are
rendered. The capture harness measures recorded MP3 output, not TTS waveforms or
physical speakers; it keeps that gap visible. No paid rendering or cloud upload
was performed. Passing timing/queue checks does not certify wording comprehension,
pronunciation or encouragement.

These are synthetic regressions, not the original person's recovered landmarks.
Historical side-plank asymmetry, demo recognisability and live pose accuracy are
not certified by these fixes. Clean consented camera inputs and beginner test 02
remain necessary before release. Broader exercise-content changes are out of scope.
