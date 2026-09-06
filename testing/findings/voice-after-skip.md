# FC-LAB-004 — abandoned movement audio continues after Skip

Status: **fixed in the browser playback layer**, with the failing regression retained.

Run the regression:

```sh
npm run test:audio -- --scenario skip-during-teaching
```

The committed case selects Warm/Learning, starts a two-movement test plan, then
skips Plank while its teaching line is in progress. It intentionally keeps the
same synthetic plank input after the transition; no claim about a real body.

Before-fix evidence: `test-results/2026-09-06T10-01-24-148Z-51583/` (local/ignored).
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

## Fix and verification

`skipCurrent()` now resets current/pending recorded and native-TTS speech **before**
calling the active shell's `skip()`. Resetting afterwards would erase new teaching
or the calibration verdict. Existing idle, recorder-mode and keyboard-focus guards
remain in front of cancellation.

`AudioBank.stop()` also invalidates old sequence callbacks before pausing clips.
A pending `play()` rejection or a late `ended` callback previously could start the
next abandoned segment even after a stop. A per-stop epoch prevents both routes,
without changing error recovery for an active sequence.

The new controlled-event cases failed before the fix and passed afterwards:
`recorded-clip-cancel`, `skip-voice-context`, `calibration-skip-voice` in
`testing/shell-sweep.mjs`. They cover button and keyboard Skip, focus guards,
current/pending speech, rest, final debrief, stale callbacks, and a five-second
calibration hold with both held-time and verdict speech preserved.

Focused recorded-audio evidence:
`test-results/2026-09-06T17-38-21-260Z-2034/` (local/ignored): **20/20 checks pass**.
Skip was requested at 10.44s, old speech reset at 10.48s, and actual Glute Bridge
teaching started at 10.51s. No abandoned clips restarted or continued across Skip.
The case now also asserts that new teaching actually plays, so silencing all
speech cannot produce a passing fix.

Full-suite evidence: `test-results/2026-09-06T17-41-45-725Z-2348/` (local/ignored).
All 13 audio cases, 20 shell cases, 92 browser cases and 54 infrastructure self-tests
pass, along with the four original harnesses. Only the existing three Cat–Cow
engine failures remain. No stale-audio check was relaxed or whitelisted.

Only `AudioBank` and `skipCurrent()` changed in production. Engine classes,
emitted effects, scoring and vectors are unchanged; no vector regeneration or
Swift change is needed. This fix does not alter automatic phase completion,
regression swaps or reminder frequency (FC-LAB-005 remains a separate review).
