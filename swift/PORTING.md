# Form Coach — Swift port kit

**Method: the browser engine is the specification, and this kit makes the
specification executable.** The vectors were recorded from the running browser engine —
the build is named in `meta.source` inside `conformance-vectors.json`, and `verify.mjs`
holds the browser side to the same rows. The Swift package's definition of done is one
command:

    cd FormCoachEngine
    swift test

Green = the Swift engine is behaviourally identical to the browser on:

| Section | Rows | What it pins |
|---|---|---|
| `scoreTarget` | 1,428 | every target × tier × 7 probe values, plus cue direction |
| `readMetric` | 169 | every target read off every demo frame |
| `aspect` | 3 | portrait/square/landscape give identical physical angles |
| `filters` | 24 | dt-normalised EMA conversion, incl. identity at 30fps |
| `frameRate` | 4 | the same movement at 24/30/60/90fps scores the same |
| `tempo` | 120 | minMs accept/reject per movement per tier |
| `tintDerivation` | 68 | tint segments derived from every metric spec |
| `tintScenarios` | 3 | severity + hysteresis + the Learning rule, per tier |
| `planExpansion` | 15 | sets × tier scaling |
| `clipResolver` + `slug` | 12 | voice clip resolution and tokenisation |
| `repScenarios` | 3 | priming, baseline drift, the crunch guard |
| `repDispatch` | 2 | which slot each rep event lands in — the atPeak double-count trap |
| `framing` | 7 | in-frame / too-far / clipped verdicts and which way to nudge |
| `neededJoints` | 21 | full judging-joint inventory; movement evidence now derives a separate counting minimum |
| `evaluatorScenarios` | 17 (25 checkpoints) | standing rejection, bridge priming, view gating, cue budgets |

There are now 25 tests: the original 18, one shared movement-evidence test and six
focused evidence regressions. `testMovementEvidence` consumes the 17 independently
declared cases in `testing/movement-evidence-vectors.json` from the repo root, using
the same interpolation, frame rates, losses and expectations as
`testing/evidence-parity.test.mjs`. The focused tests cover side changes, source-aware
scores and tint, missing hold gates, complete observation loss, degenerate geometry
and whole-body framing distance. Synthetic cases establish these software rules,
not camera-model or real-person accuracy.

The 7 September HTML-first fixes deliberately refreshed nine score checkpoint
fields; see `docs/sessions/historical-fixes-2026-09-07.md`. The 8 September browser
movement-evidence migration explicitly refreshed three fields in the existing
`crunch-needs-the-ear` case and declared the optional Leg Raise foot hint. Swift
reads those same root fixtures; this port generates no expected outputs.

## Honest status

The Swift sources compile and `swift test` passes **25/25** on 8 September 2026,
including all 17 shared evidence cases, the original 18 tests and six focused
evidence regressions. The verified browser SHA-256 is
`74bff3f55a1c9cce7e27a9a98f5b973f8894ffab50d3e5ce194bbb243be0b9e9`,
matching `conformance-vectors.json`'s reviewed-evidence metadata.

The browser now preserves `blocking:["framing"]` before the wholly unobserved
early return when framing is clipped; Swift mirrors that reason without crediting
motion or scores. `testGuidedClippingCannotEarnHoldTime` retains its original
blocking/refusal-to-arm/zero-hold assertions and additionally checks unavailable
movement evidence, a null score and the clipping verdict.

`FormResult.evidence` mirrors `movement-evidence/1`, separating movement eligibility
and missing targets from observed/missing form targets and contributing sides.
Per-target observation rejects hidden or unreadable geometry before aggregation;
interruptions and side changes discard stale smoothing and unfinished rep cycles.
`observationPaused` distinguishes missing hold evidence from measured bad form.
Session/Calibration and their presentation of this result remain outside the package.

Two transcription notes encoded in the source: Swift's sort is not guaranteed
stable where JS's is, so cue-offender ordering sorts by (score, index) explicitly;
and JS `??`/truthiness quirks around `w:0` are mirrored with explicit optionals.

## Sequence — do not reorder

1. **`swift test` until green.** No camera, no UI, no Xcode project — just the
   package. Every divergence is a real bug in the port; fix Swift, never the vectors.
2. **Capture adapter.** Strong recommendation: use **MediaPipe Tasks for iOS**
   (Google's official pod) rather than Apple Vision, because the engine's contract
   depends on three things Vision's 2D request does not provide: heel/toe landmarks
   (the `feetUp` gate that separates supine from prone), per-landmark z (the
   sideness estimate driving view-aware coaching), and the exact landmark indices
   the thresholds were tuned against. MediaPipe on iOS matches the contract shape,
   not numeric or model parity; validate the capture adapter separately, including
   model bytes, runtime/delegate, frame timing, coordinates and orientation. Vision
   remains an option later, but it means
   re-deriving two gates and re-validating; that's a project, not a swap.
3. **Orientation on hardware.** `visionOrientation()` / image orientation is the
   known TODO(device): if wrong, the skeleton rotates and every threshold's sign
   flips. Verify with the phone in all four orientations before trusting anything.
   The aspect value passed into PoseFrame must be the *image* W/H after rotation.
4. **Thin SwiftUI session screen** — camera preview + skeleton + HUD, driving the
   Evaluator exactly as the browser loop does (dt from CADisplayLink, now
   monotonic). Port the Coach speech model (priority/TTL/interrupt) onto
   AVSpeechSynthesizer — its delegates are reliable, so the Chrome watchdog becomes
   a mere safety timer — and AudioBank onto AVAudioPlayer with the same
   clipPlanFor resolver (bundle the voice/ folder).
5. **Parity session.** Run the same movement on phone and browser, export both
   TelLog CSVs (port TelLog early — it's ~60 lines), align on the shared clock,
   and diff. That is the acceptance test for the whole port.

## What's in the box

    FormCoachEngine/
      Package.swift
      Sources/FormCoachEngine/
        ContentModels.swift   Codable schemas (decode content-v4.8.json)
        PoseFrame.swift       the engine's only input type
        Geometry.swift        angleAt · readMetric (aspect-corrected) · verticality
        Scoring.swift         scoreTarget · cueFor
        RepCounter.swift      priming · baseline rest-guard · durations
        Evaluator.swift       pos/quality/view gates · score pool · one-cue policy
        PlanExpansion.swift   sets × tier scaling
        ClipResolver.swift    slugTok · clipPlanFor (per-persona numbers)
        Content.swift         loader
      Tests/FormCoachEngineTests/
        ConformanceTests.swift

The fixtures are NOT in this package. `ConformanceTests` walks up to the repo root and
reads the same two files `verify.mjs` reads:

    conformance-vectors.json   ← ground truth, machine-generated
    content-v4.8.json          ← all 21 movements, 5 plans, tiers, REF

They used to be copied into `Tests/…/Vectors/`. The copy went stale — root's content was
corrected after beginner test 01 and the copy was not — and `swift test` reported 19
readMetric failures describing a divergence that did not exist. One canonical copy makes
that class of failure impossible rather than merely unlikely. A missing fixture is a
`fatalError` naming the expected path, because a missing fixture must never look like a pass.

## Not in this kit (deliberately)

The Session state machine (GET SET/arming/rests/sets announcements), Calibration,
the insight engine, TelLog, and all UI — they depend on speech timing and screens,
so they belong in the app target, ported against `technical-documentation.md`
sections 4 and 6 once the engine is green. The engine here is the part where silent
divergence would be fatal; that's why it gets the harness.
