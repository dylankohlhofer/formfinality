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
| `neededJoints` | 21 | the framing scope derived from each movement's targets |
| `evaluatorScenarios` | 14 (21 checkpoints) | standing rejection, bridge priming, view gating, cue budgets |

That is all 15 tests. A failure names the scenario, frame and field that diverged.

## Honest status

The vectors and content JSON are machine-generated and machine-verified. The Swift
sources are a careful 1:1 transcription of the JS, and they **compile and pass**:
`swift test` is green at 15/15 against the repo-root fixtures. (This section used to warn
of compile errors on first run, written before anyone had a compiler in the loop — that
has been true for a while now and the warning was left standing longer than it was true.)

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
   the thresholds were tuned against. MediaPipe on iOS keeps 1:1 semantics with the
   browser — zero re-validation. Vision remains an option later, but it means
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
