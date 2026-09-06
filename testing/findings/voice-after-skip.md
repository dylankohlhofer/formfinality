# FC-LAB-004 — abandoned movement audio continues after Skip

Status: **open, reproduced with actual recorded-clip playback**. Production unchanged.

Reproduce:

```sh
npm run test:audio -- --scenario skip-during-teaching
```

The committed case selects Warm/Learning, starts a two-movement test plan, then
skips Plank while its teaching line is in progress. It intentionally keeps the
same synthetic plank input after the transition; no claim about a real body.

Verified evidence: `test-results/2026-09-06T10-01-24-148Z-51583/` (local/ignored).
Skip was requested at 10.77s; the original Plank teaching kept playing. Its
number and final segment then **started at 21.54s and 22.38s**, after the UI had
advanced to Glute Bridge. Stop paused playback. Exact timing varies; both event
evidence and the actual MP3 mix are retained by each new run.
The stale-segment failure and continuing-speech concern both reproduced. Use this
run rather than the initial captures: the recorder now preserves initial silence.

The audio audit now asserts that newly started **segments**, not merely newly
started utterances, belong to the current phase. This matters for spliced speech:
checking only `Coach.start()` would miss the later parts of a stale sentence.
Already-playing audio crossing Skip is also retained as a review candidate.

Source inspection: `SessionCore.skipRaw()` advances with `next(E)` without a reset
effect. The new teaching instruction has the same priority as the old instruction;
`Coach.push()` queues it rather than interrupting. `AudioBank.play()` continues the
old sequence on each native `ended` event. This is distinct from overlapping clips:
the captured clips can be perfectly sequential while describing the wrong exercise.

Next decision: invalidate old-context current/pending speech on a phase change,
without accidentally losing the new teaching line, rest countdown or calibration
verdict. Keep the failing case; review engine-versus-shell ownership before fixing,
and follow the HTML/vector/Swift rule if engine effects change. No fix was bundled
with the new test infrastructure.
