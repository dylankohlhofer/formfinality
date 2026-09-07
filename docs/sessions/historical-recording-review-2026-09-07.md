# Historical recordings — fix-status review

Reviewed 6–7 September 2026 against `form-coach-v4.11.html` at `6e203f4`.
Application SHA-256: `1cb3b7e685a52e89edcb6c7f780150cafd5b5e80b69355fa7d91b16d366826dc`.

## Scope and confidence

**This is a sampled historical review, not a complete frame-by-frame or listening
sign-off.** All 17 supplied files were sampled: 62m 34.59s of source material,
246 timestamped frames inspected, with denser sampling around the July beginner
test and the August push-up interruption. Six selected audio segments (146.5s)
were processed with macOS on-device speech recognition. Four returned text, with
omissions/errors; two returned empty text. Empty recognition does not establish
silence. Transcripts are not verified quotations, and no speaker identities were
assigned from them. Tone, exact wording, overlap and the full recorded debrief
still need listening review.

The source files contain the application's screen, camera picture, skeleton and
overlays. They do **not** contain the original MediaPipe landmark stream or the
original clean camera feed. Current synthetic reproductions establish a failure
class, not that the identical old camera measurement recurs in v4.11. No source
video was passed off as a clean exercise replay. This is not beginner test 02.

Displayed filenames/header versions identify v4, v4.8 and v4.9, not exact source
hashes. A recording made later can still be running an older file. In particular,
`squat head error.mov` runs **Sit to Stand in v4.8**, not Bodyweight Squat.

All timestamps below are **elapsed time in the recording**, not the app's CSV
clock. Original recordings are unchanged. Personal images, audio and OCR remain
local in ignored `test-results/historical-recording-review-2026-09-07/`.
The source paths and metadata are in that folder's `inventory.json`; each numbered
subfolder has `overview.jpg`, per-frame images and timestamped OCR. Original
browser tabs/room details may be present: do not upload that folder to CI.

## Findings at a glance

| Historical symptom | Current status | Evidence / qualification |
|---|---|---|
| Plank clock starts while standing/getting down | **Fixed failure class** | Standing fixture stays in setup with zero held time at all three tiers. Current orientation gates and sustained arming prevent the old straight-upright-body acceptance. |
| Coming out of plank earns a glute-bridge rep | **Fixed failure class** | Current plank→bridge probe stays at zero; one subsequent full bridge counts once. Priming and the armed-only counter path are present. |
| Glute bridge repeatedly says “Higher” during the rep | **Partly fixed** | No per-frame `bridgehigh` correction on a full valid synthetic cycle; short-range attempts have a cycle-level explanation. The phase-dependent form score is **not** fixed by this speech change. |
| Old praise/corrections remain on screen | **Banner lifetime fix present** | Current praise expires; the red-tint retraction branch is present. Browser probe confirms old praise is absent after bad input, but that probe also permits a replacement cue, so it does not isolate retraction alone. Speech context/repetition is not thereby certified. |
| “Show me how” vanishes as the set arms | **Fixed control path** | `legs demo failure.mov` shows controls disappearing at ~00:04.30. Current browser probe opens the demo after arming. This short clip does not itself show a malformed demo. |
| Malformed/stretched crunch, bridge and side-plank demos/ghosts | **Geometry fixes present; visual sign-off incomplete** | Re-authored frames and isotropic drawing are protected by gate/mutation/drawing harnesses. This does not prove recognisability, automatic body alignment or suitability for every viewer. |
| Push-up count advances through an interrupted return | **Open; current failure class reproduced** | Saved default scenarios count **4 instead of 1** after upright elbow bends or fully clipped cycles. Details below. |
| One side-plank orientation will not start; unhelpful “Hold it there” | **Open / partly reproduced** | Exact historical tracking asymmetry is unverified. Independently, current quality-blocked setup repeats the unhelpful banner and offers no correction in the tested state. |
| Camera error gives localhost instructions on localhost | **Still present** | Current browser permission-denial probe gives the same generic advice and obsolete `form-coach-v4.html` address. The original error's cause cannot be recovered from the screen alone. |
| “Can't see your head” / repeated visibility advice | **Partly addressed, not closed** | Needed-joint filtering and setup cue budgeting exist. Generic missing tracking still has a separate 7s cooldown; edge→body-part wording can still name the wrong anatomy. |

## 1. Active-state rep counting — highest priority (FC-LAB-006)

**Historical evidence:** `Screen Recording 2026-08-03 at 17.16.33.mov`, v4.9,
01:48–02:10. The count remains 7 while kneeling. At ~02:02 the person lowers
toward a push-up, then returns to their knees; by ~02:04 it reads 8. This is an
interrupted return, **not evidence that sitting motionless alone added a rep**.
The sampled images cannot recover the precise counter-crossing frame.

**Current reproduction:** after a valid synthetic push-up, feed three cycles of
upright elbow bending. The result is 4 reps instead of 1. Telemetry explicitly
says `in_position:false`, blocked by `torsoLevel|bodyLine`. A second probe moves
all required joints two image widths outside the picture; it also adds three
reps while reporting `framing` as a blocker.

**Causal code evidence:** `Evaluator.evaluate` sets the position/framing flags,
but the later rep-update condition tests only whether a rep counter exists and
the set has armed. It does not require the observation to remain in the exercise
position. The old “no counting before arming” fix therefore does not solve this
after-start path. Do not solve it by disabling all reps, or by treating every
quality deviation as an invalid movement: exercise position, observability and
quality must remain distinct.

Two permanent scenarios now run in the existing engine/browser/watch/CI workflow:

```sh
node testing/run.mjs --build form-coach-v4.11.html --mode engine --scenario pushup-active-position-loss
node testing/run.mjs --build form-coach-v4.11.html --mode engine --scenario pushup-active-framing-loss
```

Each first requires a valid rep to count, then requires the invalid cycles not
to add reps, and checks that the user can still leave the set. They intentionally
remain **failing invariants**, not expected failures. Their synthetic inputs and
independent expectations are tracked; no human footage is required to reproduce.
The new cases are not the original person's recovered landmarks.

## 2. Side-plank setup dead end

`side plank 2 with bug strong.mov`, v4, ~00:13.13–00:19.70: the app reads body-line
angles around 115°/111°, stays at zero and displays “Get set” / “Hold it there…”.
The other orientation starts later (~00:33–00:39). No raw landmarks establish
whether the cause was occlusion, side selection, perspective or actual pose.

Current isolated probe: synthetic side-plank torso in position, hip displaced so
the body-line quality gate fails. After 12s the core is still in setup,
`inPosition:true`, `inPose:false`, blocker `bodyLine`, with only “Hold it there…”
banners and no emitted speech or regression offer.

`SessionCore.tryArm` correctly requires sustained position **and** quality, but
the setup explanation then checks position rather than the quality blocker.
Corrections/regression effects lie below the setup return. Preserve the honest
start gate and explain what prevents starting; do not simply start the timer
early again. This probe is review evidence, not yet an additional default test.

## 3. Rep-phase scoring and inappropriate hold wording

`glute bridge beginner.mov` alternates a low form bar at the bottom with a high
bar at the top, despite counting complete cycles. `glute bridge.mov` shows the
same pattern alongside “Higher — full squeeze at the top” (~00:15–00:31).
The August 3 full-body recording still shows a red bridge at its lower phase
(~11:19), and the August 5 recording shows red segments during crunches/leg raises.
These images alone cannot certify the person's anatomical form.

The narrower current code fact **is** reproducible: glute bridge's `hipExtend`
remains a weighted target with an extended-position ideal. Holding the synthetic
bottom anchor drives its frame score towards zero. Removing its per-frame spoken
correction did not remove the phase-dependent scoring/tint. The diagnostic average
is not a proposed “correct” session score.

`goodhold` is also emitted for rep movements when their instantaneous score is
high; some available wording is hold-oriented. The old strong crunch clip's
repeated “Hold” banners make this worth reviewing, not automatically repeating
the same wording across all rep exercises.

**Next decision:** define what a rep's form score means over its cycle, including
what is genuinely measurable. Then add phase-aware expectations before changing
scoring/vectors/Swift. Do not patch by inventing a 100 at the bottom or silently
dropping measurements just to improve the average.

## 4. Camera errors and framing explanations

August 3, 17.10.18 recording, ~00:40.68 and 01:14.58: “Camera unavailable” gives
localhost/https setup advice although the address is already localhost. Current
`camError()` does the same for a simulated `NotAllowedError`; callers discard the
actual error. Existing camera-denial coverage checked navigation, not explanation.

`squat head error.mov`, ~00:12.38: required framing is blocked while the upright
body extends beyond the top. At ~00:14.15 the body is lower and the telemetry says
“in position — arming”, while the earlier head warning remains. This mixes real
camera placement, stale wording and readiness timing; it is not enough to declare
the pose model broken. The movement is Sit to Stand, at an old tier combination.

Current checks confirm the ear alone being off-screen does not block Sit to Stand:
its judging joints are shoulder, hip and knee. However, `framing()` still maps the
top edge to `seeDown` and the UI calls that a missing head. A synthetic leg raise
with the ankle above the top edge and the head visible gets that same head message.
The blocked edge does not establish which body part was lost.

Missing/low-confidence frames also return before the newer shared setup budget,
retaining their 7s `vis` cooldown. See FC-LAB-005. The September 6 full verification
did not trigger its repetition heuristic; the September 7 full run did (three
visibility messages within 60s in the same phase). No app change removed the
concern. Sparse screenshots or incomplete transcription cannot count every actual
utterance reliably.

## 5. Existing fixes supported by these recordings

- `plank test.mov`, v4, ~00:07.16–00:14.31: the hold advances while upright.
  Current standing probes remain at zero at all three tiers.
- `glute bridge.mov`, v4, ~00:07.62: 1/10 before the first visible bridge.
  The current priming/arming probe rejects the preceding plank and counts a
  subsequent complete bridge normally.
- July 26 recording, v4.8, ~03:10–03:20: a correction remains visible while
  current telemetry reads FORM 100. Current banner expiry exists. The known
  praise/red-body finding is also recorded in `docs/test-01-max.md`; this review
  does not claim its exact FORM 66 moment was re-found in the sampled frames.
- July 26 ~12:12–12:16: side-plank time starts before the person has settled into
  the shape. Current arming requires 1.8s continuous position and quality.
- July 26 ~05:20–05:30 shows the old folded-leg crunch demo. August 3 ~11:19
  shows an oversized/mismatched bridge ghost. Current reference gate and drawing
  checks support the documented geometry fixes, not a full visual acceptance.
- `legs demo failure.mov`, v4.9, ~00:02.46–00:04.30: setup controls disappear as
  the movement arms. Current controls remain usable after arming. Counting is
  still on the completed return, with a peak acknowledgement earlier; a zero
  count at the first raised-leg frame is not automatically a missed rep.

## Recording inventory

The numbers match subfolders in the local evidence directory. Every source has
12 overview samples; source 11 has 30 extra samples and source 14 has 12 extra.

| ID | File | Duration | Visible version | Main review use |
|---|---|---:|---|---|
| 00 | crunch test strong.mov | 01:19.09 | v4 | Rep counter, hold-oriented banners, phase scores |
| 01 | glute bridge beginner.mov | 00:31.20 | v4 | Bottom/top scoring and rep acknowledgement |
| 02 | glute bridge.mov | 00:42.23 | v4 | Phantom first rep, “Higher” feedback |
| 03 | leg raises strong.mov | 01:02.04 | v4 | Count progression and correction context |
| 04 | legs demo failure.mov | 00:07.06 | v4.9 | Setup controls lost on arming |
| 05 | plank test beginner.mov | 00:26.68 | v4 | Hold starts during approach/setup |
| 06 | plank test strong.mov | 01:07.55 | v4 | Sustained hold, cue context; no additional confirmed defect from overview |
| 07 | plank test.mov | 00:26.54 | v4 | Upright body earns plank time |
| 08 | side plank 1 strong.mov | 00:43.10 | v4 | Successful orientation for comparison |
| 09 | side plank 2 with bug strong.mov | 01:12.52 | v4 | Opposite orientation stalls in setup |
| 10 | squat head error.mov | 00:19.75 | v4.8 | Actually Sit to Stand; framing/readiness wording |
| 11 | Screen Recording 2026-07-26 at 12.45.51.mov | 22:26.47 | v4.8 | Beginner test; old banners/demos/early arming |
| 12 | Screen Recording 2026-08-03 at 17.10.18.mov | 01:14.88 | v4.8 | Camera error and misleading recovery instructions |
| 13 | Screen Recording 2026-08-03 at 17.13.22.mov | 01:32.71 | v4.8 | Sit to Stand framing/view setup |
| 14 | Screen Recording 2026-08-03 at 17.16.33.mov | 02:59.27 | v4.9 | Interrupted push-up return and continued corrections |
| 15 | Screen Recording 2026-08-03 at 17.19.56.mov | 13:50.40 | v4.9 | Push-up/squat/plank/bridge and mismatched ghosts |
| 16 | Screen Recording 2026-08-05 at 20.24.19.mov | 12:33.09 | v4.9 | Crunch/leg raise/side plank and transitions |

## Verification and next actions

Before adding coverage, the complete September 6 verification passed all four
original harnesses, 54 infrastructure self-tests, 92 browser cases, 20 shell
cases and 13 audio cases. The only existing assertion failures were the three
Cat–Cow off-screen starts. Baseline: `test-results/2026-09-06T19-40-37-729Z-6640/`.

The new push-up scenarios expose a gap in that coverage rather than a production
regression: **the application, vectors and Swift sources were not edited**.

Complete verification after adding them: `npm test`, 7 September 2026,
`test-results/2026-09-07T08-19-42-453Z-12402/index.html` (local/ignored).

| Suite | Result |
|---|---|
| Original conformance / mutation / drawing / skip harnesses | 4,127 checks / 8 mutations / 250 checks / 26 checks, all green |
| Infrastructure self-tests | 58/58 pass |
| Engine scenarios | 43/48 cases pass; 1,207 checks, 5 failures |
| Browser scenarios, desktop and narrow viewports | 92/96 cases pass; 694 checks, 4 failures |
| Shell scenarios | 20/20 cases, 115/115 checks pass |
| Recorded-clip audio scenarios | 13/13 cases, 240/240 checks pass; one repetition review candidate |
| Human-video replay | 5 blocked coverage entries, not successful tests |

All six new engine/browser case failures reproduce in fresh contexts: expected
one rep, actual four. The other three failures are the existing Cat–Cow off-screen
starts, also reproduced. No existing case changed pass/fail status relative to
the baseline. The run correctly exits 1; no assertion was weakened or whitelisted.
The unchanged application hash is recorded above. Swift was not rerun for this
test-only change. The historical recordings remain review material, not successful
automated real-video exercise validation.

Recommended order:

1. Fix active-state observation/position handling and its interruption/recovery
   semantics, protected by FC-LAB-006. Verify that valid reps still count and that
   a partly completed rep cannot leak across an invalid interval.
2. Explain quality-blocked setup and camera errors accurately. Do not remove the
   start gates to escape the setup dead end.
3. Decide cycle-level score/colour and rep-specific speech policy, then test it.
4. Densely review the remaining human audio and ambiguous tracking episodes;
   obtain clean, consented input video for any actual pose-accuracy replay.
5. Validate the corrected product in beginner test 02. These historical files
   provide valuable regression evidence but do not satisfy that gate.
