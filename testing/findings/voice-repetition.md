# FC-LAB-005 — repetitive visibility instruction

Status: **reminder policy fixed, 7 September 2026; listening sign-off still open**.

Missing/low-confidence frames, framing, wrong view and setup-quality explanations
now share one 30-second speech budget per movement in Session and Calibration.
Changing the error does not reset the budget; a persistent visual explanation
remains. Rep exercises no longer receive stationary `goodhold`/`fixed` praise.
The old seven-second repetition described below is the pre-fix evidence.

`testing/coach-regressions.test.mjs` checks 65 seconds of missing/alternating input.
The wall-clock `tracking-loss` case also requires an explanation and at most one
reminder request in its 24-second interval. Frequency is an explicit product
policy, not proof of comprehension. New `trackingLost` wording has a new clip key;
it currently falls back to TTS, whose waveform the audio harness does not capture.

```sh
npm run test:audio -- --scenario tracking-loss
```

Energy/Strong, no body visible for 24 seconds. The captured visibility instruction
repeats at roughly seven-second intervals, with the third occurrence at 21.38s.
The actual recorded
clip mix and intended phrase text are saved separately; text is not transcription.
Verified evidence: `test-results/2026-09-06T10-01-24-148Z-51583/` (local/ignored),
with the recorder's initial-silence fix. The repetition concern reproduced.

This matches the explicit 7000ms cooldown in the engine's missing-frame path.
The instruction can be factually supported (no body was observed) and still be
annoying. The test flags three occurrences of the same cue within 60 seconds in
one phase, even if wording varies; it does **not** fail merely because the coach
repeats a legitimate reminder. New runs also repeat review candidates and retain
whether the same candidate rules recur.

Original review question (now implemented): should sustained visibility loss behave like the existing
not-ready budget—an initial instruction, a persistent visual explanation and
less-frequent reminders? Confirm the desired user experience before changing the
cooldown. Avoid replacing speech with silence when a beginner needs an explanation.
