# Partial-view movement evidence — 8 September 2026

## Outcome and limits

The retained cropped-ear Crunch reproduction now counts its three observed cycles
without a neck score or neck correction. The architecture change is a per-target
observation boundary, not a new model or a lower form/range threshold.

Optional form loss no longer cancels otherwise observable movement. The same rule
is tested for a wall push-up's ankle-only form check, a Leg Raise's knee-quality
check, and optional Plank neck/elbow measurements. That is **not** a fix for the
recording's missing Leg Raise ankle driver or the required Plank body-line geometry.
Those need independently validated alternative evidence, not invented hidden motion.

The native camera/audio experiment's prerequisites were inspected separately; the
phone is now available and paired, but development signing remains to be set up.
See [native readiness](native-spike-readiness-2026-09-08.md). No native app was deployed
and no physical-device performance or speech-startup fix is claimed. Modularisation
remains a separate later change; the shipped artifact is still the single HTML file.

## Contract and implementation

[Movement evidence v1](../movement-evidence-contract.md) defines the roles. Required
position/driver/hold targets cannot become passing gates by disappearing from the
readings list. `optionalObservation:true` explicitly names the existing Leg Raise
foot-direction hint; no other position target receives that exception.

- Camera-side metrics require that side. Bilateral metrics use only complete,
  observed, geometrically readable sides and retain contributing-side provenance.
- Visibility below 0.5, missing/nonfinite coordinates, the existing 2% edge margin
  and degenerate geometry make a measurement unavailable. Pure geometry helpers
  remain separate, so isotropic REF drawings are not treated as camera frames.
- Missing targets produce no form score, correction or tint. No remaining form
  means null. Scoring remains per observed frame; no second phase accumulation.
- Required observation loss or a driver-source change discards unfinished rep
  state, not completed reps. Recovery starts a fresh observable cycle.
- Per-target and score smoothing no longer carries a now-hidden contributor into
  the recovery score. New source/pool fields reset in `arm()`.
- Missing hold evidence pauses time without scoring it as bad form. Session and
  calibration explain the interruption through the existing readiness channel.
- Results expose `movement-evidence/1`: movement availability/eligibility and form
  landmark coverage, missing reasons and contributing sides. Diagnostics retain
  that evidence in frame records and changed-state summaries, without new pixels,
  audio, persistence or uploads. Existing buffer/consent limits remain.

Coverage describes landmark availability, not complete anatomical certainty.
Existing view-angle policy remains separate. No body-part reconstruction, model
upgrade, worker promotion, voice-bank rendering or side-plank target-policy change
was included.

## Deliberate expectation changes

Exactly three existing fields changed in `conformance-vectors.json`, plus provenance:

| `crunch-needs-the-ear`, frame 39 | Before | After |
|---|---|---|
| `ok` | false | true |
| `blocking` | empty | `kneesBent` |
| `suppressed` | empty | `unobserved⊘neck` |

This is the original straight-legged **supine** input with low ear confidence, not
a valid Crunch cycle. Its bent-knee position still fails: `inPosition:false`,
`inPose:false`, `score:null`, zero reps and zero hold are unchanged. The case ID and
input are retained for historical traceability. All other recorded expectations
and tolerances are unchanged. `testing/refresh-movement-evidence.mjs --write` records
this reviewed migration explicitly and is never run automatically by tests.

`content-v4.8.json` changes only the optional foot-hint declaration. The model,
movement thresholds, rep tempo, REF data and drawing logic are unchanged.

## Retained coverage

- 229 independent engine tests cover optional/required loss, interruption/recovery,
  15/30/60fps holds, bilateral sources, invalid geometry, null scores, suppression,
  stale history and active hold/calibration explanations.
- 17 independently declared cases in `testing/movement-evidence-vectors.json` are
  consumed by both the browser-engine test and Swift. Their inputs, frame-rate
  interpolation and expected outcomes are shared; no copied fixture bank.
- `crunch-partial-quality` runs through engine and actual desktop/narrow browser
  effects: three visible cycles, no form bar, two unobservable cycles contributing
  nothing, and a fresh recovered cycle adding exactly one. Screenshots and traces
  are saved by the default loop. The camera is substituted, not filmed.
- All five original `reported-session` expectations remain intact.

Independent audit exposed stale whole-frame/side contributions, nonfinite framing
metadata and collapsed geometry being accepted as direction. Those were fixed,
not whitelisted. Swift's retained guided-clipping test also caught loss of the
`framing` reason on the new wholly-unobserved early return. The reason was restored
in HTML first, then mirrored; the rejection and zero hold time were never weakened.

The physical-phone/beginner gates remain open. Historical recordings are not
recovered camera landmarks, and synthetic passing cases cannot certify all 21
movements on real bodies.

## Verification and artifact identity

HTML SHA-256:
`74bff3f55a1c9cce7e27a9a98f5b973f8894ffab50d3e5ce194bbb243be0b9e9`

Module SHA-256:
`2dbb48dd7215c9d3fcc597bbdcd3aca7cf4f80bf1c9bd8b34bcbd2bc55655546`

The HTML is 267,922 bytes. Reviewed vector metadata records the same HTML hash.
The retained build, input and test-source hashes identify the dirty working copy;
the report's parent commit is `5307f45`, not a claim these edits were committed then.

The complete run at `test-results/2026-09-07T23-26-06-025Z-57814/` passed all four
original harnesses (4,127 conformance, 8 mutations, 250 drawing and 26 skip checks),
all seven regression suites, 49 engine cases / 1,214 checks, 98 browser cases /
714 checks, and 61 shell cases / 628 checks. Swift passed 25/25 separately.
That run exited 1 for one audio-monitor cancellation assertion: 12/13 audio cases,
236/237 checks passed, and its automatic reproduction passed. The failure and the
separate monitor repair are documented in
[pending audio cancellation](audio-pending-cancellation-2026-09-08.md).

Six video entries and two native-TTS waveform gaps remain explicit. No speech
review candidate is not a listening or comprehension sign-off. Workspace reads
also stalled while macOS offloaded local files; no saved evidence was deleted to
work around it.

The subsequent complete `npm test` run exited **0**:

`test-results/2026-09-07T23-49-22-795Z-63278/`

| Coverage | Result |
|---|---|
| Infrastructure, including actual audio controls/mutations | 64/64 |
| Coaching / prompt / diagnostics / worker / reported-session | 18 / 120 / 17 / 13 / 5, all pass |
| Movement evidence / shared cases | 229 / 17, all pass |
| Conformance / mutations / drawing / skip | 4,127 / 8 / 250 / 26, all pass |
| Engine timelines and exercise library | 49 cases, 1,214 checks, all pass |
| Desktop/narrow browser | 98 cases, 714 checks, all pass |
| Shell | 61 cases, 628 checks, all pass |
| Recorded audio | 13 cases, 239 checks, all pass |
| Swift | 25/25, including the same 17 shared evidence cases |

After that run, the new pending-audio test's timestamp assertion was corrected to
the actual contract: pause/request ownership and ordered timestamps, not equality
between two separately sampled clocks. No production or monitor code changed.
The focused real-browser case passed again; evidence is in
`test-results/audio-mutation-THtNjA/`. Its final test source therefore differs from
the complete run's saved test-source hash only by this assertion/comment cleanup.
The complete run's HTML/module/fixture identity remains unchanged.
