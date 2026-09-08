# Partial-visibility pack — existing test/reproduce/report loop

## Run and review

```sh
npm run test:partial                         # same engine/browser/video-gap runner
npm run test:partial -- --mode engine        # quick logic pass, no browser
npm run test:partial -- --mode browser       # desktop + narrow UI, no camera
node --test testing/partial-visibility.test.mjs
```

The full pack includes the existing original harnesses/regression suites, then the
four selected timelines. It omits the unrelated exercise-library sweep and the
separate audio suite. `npm test` still runs those, plus all four new scenarios.
The watcher discovers the scenario/input/pack changes and invokes the same runner;
GitHub Actions continues to run `npm test`. No workflow/platform replacement.

Read the run's `REVIEW.md` and `index.html`, identified by `test-results/LATEST.txt`.
They retain actual/expected checks, selected scenario declarations, screenshots at
UI checkpoints, traces, console errors and automatic reproduction of failures.
`pack.json` and its hash identify a selected pack. The Building-tier browser runs
use desktop and narrow viewports; the companion regression suite replays these
same files across **all nine supported exercise-tier pairs**.

Screenshot review also flagged [a narrow-screen warning/control overlap](findings/partial-view-mobile-warning.md).
That manually identified usability candidate is not automatically assessed by
the passing counter checks; its source screenshot and reproduction are retained.

## What the four cases establish

| Exercise | Observable positives | Negative controls | Still unvalidated |
|---|---|---|---|
| Squat | Complete cycles with head/hands/far side unavailable | Stationary legs while arms move; hidden ankle cycles; interrupted peak; fully off-screen cycles | Actual detector behaviour under camera cropping |
| Crunch | Visible torso cycles without a neck score when the ear is cropped; one complete side | Rigid translation without a curl; hidden ankle-dependent position evidence; interrupted peak; fully off-screen cycles | Recognition on clean human camera inputs |
| Leg Raise | Current ankle-driver cycles with unused head/hands/far side absent | Knee bending with the shoulder/hip/ankle driver stationary; missing ankles; interrupted peak; fully off-screen cycles | A validated thigh-based fallback for the filmed missed reps |
| Plank | Observed hold with optional head/hands/far side unavailable | Standing; required ankle loss; fully off-screen time | Partial-view hold recognition and unseen lower-body alignment |

Rep timelines expect six complete observed cycles, not a count inferred from the
implementation. Hold bounds follow the declared 1.8-second setup period and elapsed
observable time, allowing three 30fps frames around the boundary. Companion tests
also require **exactly unchanged held time** across missing-evidence intervals.
All phases finish through existing Skip; null scores and explicit skipped status
remain protected. The test-only snapshot exposes the latest real telemetry and
core state in both adapters; it does not calculate another judgement.

The synthetic input helper builds on the existing independent fixture anchors.
Head/feet variants move specified coordinates outside the image; hand/far-side
variants remove observations. These are not crops of a real image and do not test
whether MediaPipe hallucinates, misses or reacquires a joint. Production code,
model bytes, conformance vectors and thresholds are unchanged.
The misleading-motion controls isolate landmark changes; they do not establish
anatomically faithful human motion. Real knee bending/repositioning still needs
independently labelled camera examples before validating an alternative driver.

Thirty companion tests verify the declarations, transformations, all-tier results,
exact hold freezes, reporting and negative controls. Deliberately broken counters,
hidden-time credit and fabricated form must fail the shared expectations. The
tests never regenerate expected values from the engine.

## Unresolved means unresolved

The Leg Raise and Plank scenarios declare `coverageGaps` that appear in JSON,
HTML and the review queue even when every software assertion passes. Pausing an
unobservable movement is a **safety baseline**, not approval of the user experience.
There is no new thigh driver, hidden-joint reconstruction or measured camera
recognition improvement in this pack. Native speech and physical speakers are
not captured by these accelerated scenarios; keep using the existing audio cases.

## Reuse existing human evidence first

The September review at
`docs/sessions/current-recording-review-2026-09-07.md` supplies symptom provenance:
Plank stalls around 01:50–02:18, Leg Raise clipping/refusals around 06:52–08:40,
and separate speech/Side Plank target issues. The original diagnostic export lost
the earlier exercise frames and retains Side Plank landmarks only. Do not pretend
it supplies the missing Plank or Leg Raise detector stream. Historical screen
recordings also contain overlays and are not substituted for clean camera inputs.
No personal media is copied into Git/CI or uploaded by this pack.

For the remaining questions, use the **existing opt-in diagnostic flags/export**
during a short live session. Only request additional consented camera footage when
the model itself must be rerun. Independently label real rep/hold events and any
uncertainty before creating a recording-specific scenario through `--scenario-file`.
Do not attach an arbitrary recording to these synthetic timings or use one video
for all four cases. The existing `--recording` / `--landmarks` adapters remain the
replay path; their declared frame/timestamp requirements still apply.

Priority evidence pairs are straight-leg raises versus knee bending/repositioning
with ankles cropped, and genuine Plank versus kneeling/standing transitions with
similar upper-body views. These are hypotheses for review, not instructions to
perform beyond someone's ability. Stop or skip any uncomfortable movement.

Astra's review should classify failures as application, harness, environment or
unresolved, then retain a minimal reproduction and before/after evidence. New form
or fallback judgements still need human review; a passing synthetic suite is not
its own answer key.
