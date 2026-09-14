# New user test — 9 September 2026

## Outcome

This recording provides new real-room evidence, particularly for calibration and
Plank. It confirms continued recognition friction and early set endings, and exposes
a calibration continuity problem that the current engine reproduces independently.
It does not establish workout completion, beginner satisfaction, or an exercise-wide
accuracy rate. No production code, conformance vectors, thresholds or Swift code were
changed for this review. No fixes, new permanent regression suite, commit or push are
claimed.

**14 September follow-up:** the score-driven target-shortening defect was removed,
with permanent regression coverage and an explicit unassessed follow-along option.
See [the body/clothing implementation review](body-clothing-tolerance-2026-09-14.md).
Calibration continuity and real-person recognition validation remain open; the
evidence and review-only statements below describe the original 9 September work.

Highest priorities: separate a continuous calibration attempt from accumulated work;
stop automatically rewriting hold targets from a transient score; make tracking-loss
recovery and the associated coaching understandable. These are not reasons to relax
every visibility gate or invent credit for unseen movement.

## Evidence and limits

- Source: `Screen Recording 2026-09-09 at 19.55.26.mov`, supplied by the user.
- Duration: 330.723 seconds (5:30.72); 2940×1912; one stereo audio track.
- Source SHA-256: `7a4d506f13330c0a91e17e24d0de542271abace0bac2d0b5abf852b42f136e18`.
- Screen: desktop Brave, `localhost:8000/form-coach-v4.11.html`, header v4.11.
  This identifies the displayed build name, not its exact loaded source hash.
- The user confirmed there is no diagnostic JSON or CSV for this session. Original
  landmarks, confidence values, camera-side transitions and speech events cannot
  be reconstructed from the recording.
- Review derivatives are local and ignored under
  `test-results/user-test-review-2026-09-09/`: 158 distinct timestamped frames,
  overview/detail sheets, OCR, six audio chunks, on-device machine transcript
  hypotheses, signal summaries and isolated software probes. Overview and
  calibration sheets plus selected full-size critical frames were visually
  inspected; dense OCR supports the later transition timeline. This is sampled
  review, not exhaustive frame-by-frame or full listening sign-off.
- Speech recognition was explicitly on-device-only. Its intermediate results were
  retained because the final callback can contain only the last utterance or empty
  text. Partial revisions are not separate repetitions. Transcription contains
  errors, merged utterances and uncertain timing; it is not verified quotation or
  speaker identification. Empty recognition is not proof of silence.
- Source footage was not modified or uploaded to another service. The screenshot
  contains the app's graphics and is not clean-camera re-inference coverage.
- Software probes use HEAD `7edc6ac`, HTML SHA-256
  `74bff3f55a1c9cce7e27a9a98f5b973f8894ffab50d3e5ce194bbb243be0b9e9`.
  They reproduce policies/failure classes using existing synthetic fixtures, not
  the original person's movements. They are review probes, not newly landed tests.

All times below are elapsed recording time, not the telemetry clock.

## Timeline

| Recording time | Observed state |
| --- | --- |
| 00:00–00:54 | Welcome, name/style selection, then calibration start. |
| 00:54–01:40 | Camera positioning, seated subject, framing/view messages, demo and ghost enabled. |
| 01:42–01:52 | First plank attempt; calibration arms, then displayed hold remains around one second. |
| 01:54–02:06 | Subject is out of the plank/repositioning; hold remains one second. |
| 02:08–02:10 | Opposite-facing forearm plank attempt; tracking pause still shows one second. |
| 02:12–02:24 | Timer progresses from two to fourteen seconds. |
| 02:26–02:40 | Kneeling/rest/repositioning; timer remains fifteen seconds without concluding calibration. |
| 02:42–02:54 | Another attempt, including straight-arm support; timer progresses to twenty-six seconds. |
| 03:02 | Building verdict: “You held 26 seconds with a decent line…” |
| 03:33–03:50 | Core Strength selected; a different visible participant begins Plank setup under the existing profile/tier. |
| 03:51–04:12 | First workout set progresses to about twenty counted seconds. |
| 04:13–04:22 | Repeated tracking pauses; target-shortening message appears at 04:20. |
| 04:23–04:27 | Score recovers to around 80; set nevertheless ends at approximately twenty-seven counted seconds. |
| 04:27–04:42 | Fifteen-second rest countdown. |
| 04:46–04:59.8 | Second set; another early end after approximately fourteen counted seconds. |
| 05:15–05:29 | Crunch setup remains 0/12; camera is moved and the session is stopped. No completed Crunch rep is established. |

The participant switch is a test-context limitation, not evidence that the app
identified or assessed the second participant separately. No identities or exercise
experience are inferred from appearance. This is not an unaided, completed First
Steps protocol pass, and it supplies no post-session willingness-to-pay/use-again
answers. It should not close the beginner release gate.

## 1. Calibration combines separate attempts into its verdict

**Confirmed screen behaviour; current software failure class reproduced.**

At 02:26 the participant leaves the plank with fifteen seconds displayed. They are
upright on their knees through the sampled 02:28–02:36 frames. Calibration stays
open; returning to the plank later increases the same counter to twenty-six.
The 03:02 verdict describes that total as a held plank and infers familiarity with
exercise. It does not explain the interruption or distinguish continuous duration
from accumulated observed work.

Relevant current code: `Evaluator.evaluate` sets `observationPaused` when required
hold evidence is missing, resets `outOfPose` to zero, and returns. `CalibrationCore`
then returns before its finish check. That check otherwise requires more than five
held seconds and more than 2.5 seconds out of pose (or thirty held seconds).
Consequently, missing measurements during an observable change of activity can
prevent the attempt from concluding. A later return continues `ev.hold`.

The local comparison probe starts with about 13.1 seconds of synthetic valid hold:

- Fully observed standing ends calibration and retains about 13.13 seconds.
- The same standing fixture without ankles leaves calibration open after twelve
  seconds, with no additional hold credit and `outOfPose:0`.
- Returning to valid input adds another thirteen seconds. An explicit Skip then
  finishes with about 26.1 seconds and a Building verdict.

The probe uses Skip to inspect the final payload; it does not claim Skip caused the
recorded verdict. Nor does it claim the paused interval itself was credited.
**The defect is the meaning of the accumulated result and continuation policy.**

Proposed direction: retain completed work honestly, but represent continuous bouts,
known exit, temporary observation loss and explicit finish separately. A prolonged
unknown interval cannot support an unbroken-hold claim. Do not turn missing evidence
into a zero score, erase previous work or infer lack of ability from camera failure.

## 2. Automatic target shortening recurs, even after recovery

**Confirmed recurrence of the policy behind FC-LAB-011; not a skipped numeral.**

The selected plan and machine-recognized opening instruction indicate forty-second
Plank sets. At 04:20 the screen shows FORM 46, twenty-two counted seconds and
“Form's fading. Five more, then we stop.” It subsequently recovers to FORM 80–81 at
04:24–04:26, but rest begins at 04:27, consistent with a shortened target near 27.

The second set starts around 04:46. At 04:55.1 FORM is 83; by 04:55.2 it is 47 and
the progress ring has advanced sharply. Later the score recovers to 98–100 at
04:59–04:59.6, yet rest begins by 04:59.8, consistent with a target near 14.
These targets are inferred from the visible transitions and the current policy;
the recording has no original target-change event export.

Current `SessionCore.tickRaw` shortens a hold once `score < 55`, `held > 6`, and
`held < target - 6`, assigning `round(held + 5)`. It requires neither sustained
deterioration nor confirmation and never restores the original target on recovery.
One controlled score of 54 at about 8.23 seconds changes a forty-second target to
thirteen in the diagnostic probe; a subsequent score of 100 leaves it thirteen.
The probe isolates the control policy, not the source of the person's low score.

Recommendation: keep the announced target and progress scale stable. Any suggestion
to finish early must be a separate, intelligible decision, not a silent consequence
of one unstable measurement. This changes existing behaviour and needs deliberate
regressions before implementation.

## 3. Plank observation remains brittle in an ordinary room

**Confirmed recognition/UX limitation; exact landmark cause not recoverable.**

At 01:50 and 02:08–02:10 the person is visibly in a plank-like position while the
counter is stalled. Telemetry explicitly suppresses missing `bodyLine`/`hipAlign`
measurements. Some other sampled intervals show visible failing shape gates as
well, so the whole 01:50–02:10 window must not be labelled a correct uninterrupted
plank with twenty missed seconds: it includes repositioning and failed readings.

During the first workout set, 04:13–04:22 contains repeated missing `legsStraight`,
`bodyLine` and other readings, sometimes total tracking loss, while the subject
remains supported on the floor. The generic tracking message does not identify a
useful recovery action. Furniture, a fan/vacuum near the feet, body overlap and
changing viewpoint are visible. Their causal contribution is plausible, not proven;
the current source-side confidences are absent.

This extends the existing Plank evidence gap beyond a simple synthetic image-edge
crop. A body can appear largely inside the image while the required joint chain
is not reliably measurable. Lowering every threshold would also create false
credit and unsupported corrections. Test alternative evidence and recovery using
independently reviewed positive/negative cases, including this room-layout class.

## 4. Coaching can contradict its own score and adaptation

**Confirmed on-screen contradiction; audio supports continued output, not full sign-off.**

At 04:55.2–04:56.9 the banner says “Halfway there, you're doing well” while the
displayed score drops through the 40s and the set target has just shortened.
The current core explains this sequence: after shortening the denominator, its
next tick can satisfy the new halfway threshold and emit `half`. The local probe
returns `degrade`, followed on the next still-low-score tick by `half`.

The second set also displays elbow corrections repeatedly around 04:46, 04:52 and
04:58, with praise and adaptation in between. These are cue-density/context review
concerns, not a numerical claim that identical audio was played on every banner.
Machine-recognized speech includes the second-set introduction, praise, elbow
wording, form-fading instruction and rest over a short interval. Exact overlaps,
cut-off words and speaker attribution need listening verification.

Coach-like speech is recognized through the final Crunch instruction around
05:16–05:18. Thus this is evidence against a *complete* late-session voice shutdown,
not proof that every requested utterance played, that native fallback is fixed, or
that the voice experience is acceptable. Unlike the earlier file-URL session, this
recording uses localhost, so its audio-loading environment is different.

## 5. Demo/ghost and supported plank variant need a clearer contract

**Visible UX mismatch and declaration gap; not a new anatomical judgement.**

At 02:10 the live participant faces opposite the large ghost. At 03:50 the ghost's
torso is visibly above the participant, and the controls/banner sit over their
upper-body area. Current ghost rendering fits an authored reference to the canvas;
it does not align that reference to the participant's position, size or direction.
The previous isotropic drawing fixes remain present; correct proportions alone do
not establish useful body alignment. No touch-interception defect is claimed here.

The participant also uses straight-arm support at 02:48–02:50, and the workout
participant changes support around 04:54. The app continues counting while the demo
shows forearm Plank. The current `elbows` metric measures shoulder-to-elbow
verticality, not elbow flexion. A synthetic straight-arm fixture passes and receives
hold credit. High Plank is not inherently an invalid exercise: the unresolved
question is whether this declaration intentionally accepts both variants and teaches
that fact. Do not call this a safety defect or silently impose a new angle gate.

## Recommended next implementation order

1. Decide and test calibration bout/exit/unknown-state semantics. Preserve prior
   observed work while removing unsupported continuous-hold and ability claims.
2. Remove or redesign transient-score target rewriting; retain a stable timer and
   prevent contradictory halfway/praise messages during adaptation.
3. Improve observability recovery and assess alternate Plank evidence with positive
   and misleading-motion controls. Keep existing no-false-credit tests intact.
4. Simplify ghost/demo presentation and review recorded speech for density and
   interrupted phrases. Clarify forearm versus high-plank support explicitly.

For fixes, turn the reviewed policies into committed cases in the existing runner,
then follow HTML-first/vector/Swift parity rules. No private footage should enter
CI. The report's isolated probes are not a substitute for that committed suite.

The existing full-suite result in `../project-status.md` remains the last full
verification; it was not rerun or reinterpreted as user-test approval here.
