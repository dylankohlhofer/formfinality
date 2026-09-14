# Evidence-backed workout summaries

The HTML engine is the source of truth. `buildWorkoutSummary(out, avg, stopped)`
produces `workout-summary/1` at session finish. Counts, hold times, scores and set
statuses remain the existing engine's responsibility. This is a debrief feature,
not an evaluator, calibration change or continuous-video model.

## Contract

```json
{
  "schema": "workout-summary/1",
  "headline": "Deterministic session-status wording",
  "coverage": "Mandatory description of measurement limits",
  "cards": [
    {"id": "set-1-focus", "movement": "Plank", "kind": "observation",
     "text": "Recorded coaching flagged hips dropping. This does not tell us why.",
     "tip": "Review the alignment shown in this movement's demonstration."}
  ],
  "defaultCardIds": ["set-1-focus"]
}
```

The envelope is **trusted engine-authored content**, not a public import format.
No name, joints, video, free-text skip reason, diagnosis or historical comparison
enters the contract. Cards are ordered by set, capped at 24 for bounded model
context. All set rows and totals remain visible separately; limiting highlights
must not erase observations or rewrite the workout record.

`kind` is `observation`, `tempo` or `recorded`. Unknown coaching keys are omitted.
Log time is when coaching fired, not when a fault began or proof of its cause.
Rep-cycle timing describes recorded durations, not control, fatigue or ability.
Skipped, stopped, guided and follow-along sets generate no assessment cards;
previously measured work still contributes once to the existing session totals.
An empty catalog produces an empty highlight selection, not invented praise.
Absence of a correction is not evidence of perfect form or progress.

## Optional local AI selection

The only accepted model response is `{"cardIds":["set-1-focus"]}`: one or two
distinct IDs from this exact catalog. Extra fields, prose, unknown IDs, duplicates,
empty/non-array selections or more than two cards invalidate the entire result.
The renderer resolves IDs back to original engine text; **no model-authored text
is displayed or spoken**. This deliberately delivers AI-selected, not freely
AI-written, summaries. Schema-conforming prose would not guarantee truthful advice.

The HTML's `selectSummaryCards` is the reference selection policy. Missing model
selection returns the deterministic `defaultCardIds` with source `template` and
reason `not-requested`; a rejected selection uses `invalid-selection`. Accepted
selection uses source `on-device` and reason `selected`.

The browser always uses templates; there is no browser AI bridge, download, remote
provider, cloud fallback or misleading AI button. The native implementation must
use only `SystemLanguageModel.default`, check availability, expose its fallback
reason and keep generation outside the frame loop. On unsupported OS/device,
disabled/unready model, cancellation, timeout or error, keep the usable template.
Capture the debrief request ID before scheduling AI selection. Check that identity
before starting generation and before applying a response; leaving the debrief or
starting a newer request invalidates old queued work and output, even if cancellation is ignored. Do not
send framework feedback attachments or automatically persist prompts/responses.

## Validation and limits

`testing/summary-selection-vectors.json` is a shared, independently authored
selection specification for JavaScript and Swift. Dedicated engine tests must
exercise real finish/skip/stop/follow-along paths, not just hand-built envelopes.
Browser cases use the existing shell runner, screenshots and traces. Native tests
substitute selectors to exercise failure and lifecycle behavior; these do not
prove real-model quality, latency, battery use or physical-phone performance.

Native session/calibration/UI are not yet ported. This module is an integration
component, not a claim that Apple AI is active in the browser. A local synthetic
model smoke is separate from deterministic CI and must report unavailable as a
coverage gap, never pretend that fallback exercised a model.

Apple references: [on-device SystemLanguageModel](https://developer.apple.com/documentation/foundationmodels/systemlanguagemodel),
[Foundation Models introduction and structured-output limits](https://developer.apple.com/videos/play/wwdc2025/286/).
