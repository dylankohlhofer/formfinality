# FC-LAB-005 — repetitive visibility instruction

Status: **open usability review candidate**, not a proven incorrect correction.

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

Review question: should sustained visibility loss behave like the existing
not-ready budget—an initial instruction, a persistent visual explanation and
less-frequent reminders? Confirm the desired user experience before changing the
cooldown. Avoid replacing speech with silence when a beginner needs an explanation.
