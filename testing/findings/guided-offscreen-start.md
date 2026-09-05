# FC-LAB-003: guided Cat–Cow starts with its torso outside the frame

Status: reproduced engine defect, open for review. No product change or exception
has been introduced by the test sweep.

All three supported tiers fail the independent invariant “off-screen required body
parts cannot arm a set”. Start a single Cat–Cow plan, translate a valid all-fours
fixture left by two normalized frame widths (retaining confidence), and replay four
seconds. The state becomes `active` instead of remaining `setup`.

Cause: `Evaluator.evaluate` computes `out.framing`, but its guided early return
occurs before the clipping veto used for judged movements. The position angle is
translation-invariant, so it passes even though both required torso points are
outside the frame. This is not a request to score Cat–Cow: it should remain guided
and unscored, while still checking whether its required position can be observed.

Evidence: `testing/exercise-sweep.mjs` framing assertion, independently rerun per
exercise/tier; each report preserves the actual and expected states. The inputs are
synthetic and do not establish how frequently MediaPipe produces this condition.

A future fix touches the engine: implement in HTML first, run all original harnesses,
and deliberately review any vector differences. The Swift evaluator does exist.
Static inspection found its clipping veto **inside the guided branch**, whereas
the browser's veto is **after that branch returns**, in the judged path. That is a
source-level parity discrepancy requiring a shared edge-case test; the existing
conformance results do not establish parity here. Swift was not changed or executed
by this sweep. Do not weaken the invariant or mark the failure expected.
