# Movement evidence, version 1

Implementation order: browser engine first, retained independent tests, then Swift
parity. This contract does not add a new pose model, reconstruct hidden joints, or
change movement range/tempo thresholds.

## Separate questions

- **Position:** are the declared position measurements observable and passing?
- **Movement:** is the declared rep driver observable, in position and at a usable
  view? For holds, the declared shape gates must also be observable and passing.
- **Form:** which quality targets can actually be measured on this frame?

An unavailable optional form target is not a movement veto. An unavailable required
position/driver/hold-gate target is not a passing gate. A visible but failing form
measurement is different from a missing one. No form measurements means `score:null`.
Existing hold quality gates still stop the hold clock when visibly failing.

The content declares the roles: `pos`, `gate`, `reps.driver`, and quality weights.
`optionalObservation:true` on a position target is an explicit exception: use it
when visible, including rejection when it fails, but do not demand its presence.
Initially this names only Leg Raise's existing foot-direction hint; it does not
silently make all position checks optional.

## Observation boundary

Camera observations use finite normalized x/y coordinates, visibility at least 0.5,
and the existing 2% image-edge margin. Geometry helpers remain coordinate arithmetic:
the isotropic authored demos are not camera observations and must not be clipped by
this policy. Confidence is evidence of visibility, not a calibrated probability
that an exercise was performed correctly.

Camera-side metrics use a single, set-local observed side. Keep that side while all
required camera metrics are readable, even if shoulder/hip confidence changes the
adapter's preference. Otherwise select the opposite side only if it supplies every
required camera metric. Choose on availability, never on which side scores better;
do not assemble a movement from complementary incomplete sides. `evidence.camera`
records requested/selected sides, and tint names its actual side. `arm()` clears the
preference. Bilateral metrics retain their declared complete-side aggregation. A
hidden side contributes neither a good nor a bad value; no opposite-limb claim is made.

Missing targets lose their smoothing/tint history. Changing the form-score pool
must not carry a hidden target's old contribution into the new score. A rep driver
source change or interrupted observation invalidates the unfinished cycle, not
completed reps. Recovery must establish a fresh cycle; unseen time is not motion.

## Reviewable result

Evaluator results expose `evidence.schema = "movement-evidence/1"`, a movement
observation status, `eligible` and missing targets, and form landmark coverage with
observed/missing target IDs and reasons. `observed` means geometry is available,
not that position or range passed; `eligible` also requires the applicable gates
and view. `viewLimited`/`viewCue` also describe the viewing constraint. Since the
14 September review fixes, form coverage excludes view-unreliable targets with
`reason:"view"`; suppression uses `view⊘<target-id>`, not an inferred fault.
Unavailable measurements never enter smoothing, scoring, cues or tint. A required
hold depth gate remains unavailable, not silently passed. The 25°/50° alignment
thresholds and 168° depth-target cutoff are unchanged. Optional form loss still
does not veto observed rep cycles.

The camera adapter computes shoulder/hip pair angles with x and z in the same
units. Both members must be finite, at least 0.5 visibility and inside the 2%
edge margin. One trustworthy pair suffices; no trustworthy pair produces
`sideness:null, viewUnavailable:true`, which pauses assessed counting without a
score or an unsupported instruction to turn. Legacy authored/headless fixtures
can omit view; future native adapters must explicitly mark unavailable camera
view, using the matching `PoseFrame.viewUnavailable` field. This is not a hidden
joint reconstruction or a new body-size model.

Calibration allows short tracking flicker without counting unseen time. Once an
armed check loses required evidence continuously for 2.5 seconds, it pauses and
offers Restart or Use observed result. New visible frames cannot join another
bout to that attempt. The grace interval is a UX policy, not an ability measure.

The shell explains interrupted counting through the existing readiness channel.
Optional form loss must not produce a demand to stop otherwise observed movement.
Diagnostics retain the evidence alongside the saved result; no automatic upload or
additional camera recording is introduced.

## Explicit limits

Cropping a Crunch ear should preserve visible torso cycles and suppress neck scoring.
Cropping the Leg Raise ankle removes its current driver: this contract alone cannot
recover those reps. A thigh-based alternative requires independently reviewed
positive **and negative** inputs, compatible range/tempo semantics and an explicit
source-transition policy before adoption. Likewise a Plank without its required
body-line evidence is not automatically a measured hold.

Synthetic geometry tests establish these software rules, not real-person recognition
accuracy. Consented camera input and a physical-phone session remain necessary.

## User-chosen unassessed completion (14 September)

`SessionCore.followAlong()` is separate from evaluator eligibility and the authored
`kind:"guided"` movements. It makes no pose/position/range/tempo judgement at all.
The current set has an elapsed timer and explicit `finishAlong()`; it never finishes
automatically at a nominal hold/rep target. `score:null, followAlong:true` identifies
the phase. `achieved` and session totals retain only observations made before the
choice, if any; `elapsed` is separate and never added to hold time. Prior frame scores
remain accumulated exactly once. No phase insight is inferred from an unassessed set.
Skip remains skip, and the next movement returns to assessed setup. Calibration does
not offer this option, since unobserved exercise must not determine a skill tier.

A low camera score no longer shortens a planned hold automatically. Measured gates
still pause its counted hold, and the user retains easier/Skip/Stop choices. See
[body/clothing implementation](sessions/body-clothing-tolerance-2026-09-14.md).
