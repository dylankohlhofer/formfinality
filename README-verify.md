# verify.mjs — what it is and how to read it

Replays the conformance vectors against the browser build. The browser-side twin of
`swift test`: same recorded cases, same specification, so the two can't drift.

```bash
node verify.mjs path/to/build.html   # the build is REQUIRED
```

Exit 0 = every vector matches. Exit 2 = you didn't name a build.

There is **no default build**. There used to be (`form-coach-v4.8.html`), and since the
vectors are recorded from v4.9 a bare `node verify.mjs` quietly graded one build's vectors
against a different build — green, and proving nothing about the file being edited. Naming
the build is the whole point of the tool.

All numeric slack lives in **`meta.tolerances`** in the vectors, and both harnesses read it
from there. Nothing may hardcode a tolerance in either one: `score` was 1.5 inline here and
1.0 in `meta` for the Swift tests, and the drift surfaced as ten phantom "port divergences"
on rows where Swift matched the browser to the last bit. Each value is the measured
worst-case quantisation error of the recorded rows — `value` 1e-3 (max 4.96e-4), `score` 1.5
(max 1.4178), `hold` 0.05 (max 3.33e-4), `filter` 5e-5 (max 4.90e-6). A missing tolerance
exits 2 rather than silently defaulting.

## Why it exists

The original 17 test suites lived only in an ephemeral sandbox and were lost when it reset.
The **vectors survived**, and they hold the valuable half — the expected outputs. This
harness is a better shape than what it replaces: one file, one source of truth, shared with
the Swift tests.

## Known state

**3,847 passing, 0 divergences** against `form-coach-v4.9.html`. It exits 0.

Up from 3,812: `repDispatch` is new, and `repScenarios` went from asserting *nothing* to
asserting 30-odd things. It read `sc.reps`/`sc.rushed`, fields no row has, behind
`!== undefined` guards — three scenarios reported ok while checking nothing at all. It now
reads `finalReps`/`finalState`/`primed`/`events`. Separately, `evaluatorScenarios` applied a
blanket ±1.5 to *every* numeric checkpoint field, `reps` included, so a counter that
double-counted a rep would have passed; counts are now exact and only measured quantities
get slack.

It formerly reported ~3,789 passing / 23 divergences. All 23 were **harness** faults — the
build never diverged and the vectors were never wrong. Kept here because the reasoning is
the useful part:

| Section | Was | Resolution |
|---|---|---|
| `scoreTarget` | 10 | **Harness precision.** `r.v` is stored at 3dp, but the generator scored each row at full precision (the falloff probe sits at `v = tol × 2.185`). Recomputing from the rounded `v` moves the score by up to ~1.5 points near the falloff edge — just past the old tolerance of 1.0. Confirmed by solving for the pre-rounding `v`: it reproduces every recorded score to 4dp on all three affected targets. Fixed by widening that one check's tolerance to 1.5. Exactly those 10 rows use the widened band (largest delta 1.4178); the other 1,418 stay within 1.0, so nothing is masked. The **proper** fix is storing `v` at 6dp, which needs the lost generator — prefer it over the widened tolerance if the generator is ever rebuilt. |
| `evaluatorScenarios` | 11 | **Dropped input.** Timeline steps carry an `over` field (`{"sideness": 38}`) setting frame-level fields the synthetic 2-D poses can't supply — `sideness` is derived from landmark z, which they have none of. The harness ignored it, so all four view scenarios graded a frame whose viewing angle was never set. Now applied via `Object.assign`. The 4 scenarios using `over` were precisely the 4 failing; the other 10 always passed. |
| `aspect` | 2 | **Missing normalisation, not the frame choice.** These rows assert aspect *invariance*: one physical pose reads the same angle at any capture orientation. MediaPipe normalises x by width and y by height separately, so standing in for a capture at aspect `A` means dividing x by `A` — the distortion `readMetric`'s `A` undoes. The harness set `frame.aspect` on unnormalised coords, asking the engine to correct a distortion nothing had applied; `1.0` passed because it is a no-op both ways. `frames[1]` was right all along — with x pre-scaled it yields 102.551 for all three aspects. |
| `frameRate` | skipped | Still skipped. Not replayable: these rows record probes from a scripted scenario whose generator didn't survive. The property they protect is still covered by `filters`. |

Worth noting for next time: the two "harness" diagnoses above were both *wrong in their
specifics* while right that the harness was at fault — the `aspect` fix was never about
finding a different frame. Re-derive before acting on them.

This is exactly the kind of task to hand to Claude Code with the repo in front of it.

## What it covers

`scoreTarget` (1,428) · `readMetric` (169) · `filters` (24) · `tempo` (120) ·
`neededJoints` (21) · `framing` (7) · `tintDerivation` (68) · `tintScenarios` (3) ·
`planExpansion` (15) · `aspect` (3) · `slug` (4) · `repScenarios` (3) ·
`repDispatch` (2) · `evaluatorScenarios` (14) · content integrity (5)

`repDispatch` is the v4.9 **atPeak** coverage: acknowledgement (the up-crossing, where the
effort peaks) is a separate event from accounting (the completed cycle). Each row records
which `FormResult` slot every rep event landed in and what the count read at that frame, so
routing `atPeak` into `rep` — which tells the shell a rep completed at the top *and* at the
bottom, while the count never moves — fails by name rather than by inspection.

## What it does *not* cover

The UI shell — every bug in reviews #17, #19, #21, #22, #23 and #31 lived there, and none
would be caught here. A manual smoke pass remains its only test.
