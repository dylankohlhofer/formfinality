# Form Coach — project status report

**Every figure below was computed against the shipped build.** Where any other document
disagrees, this file wins.

**Last updated:** 4 September 2026 — operational figures refreshed against v4.11. The
product verdict still rests on beginner test 01 (Max, 26 July); no second beginner session
has happened yet.

**5 September 2026 — automated test lab added.** `testing/README.md` describes a
shared engine/browser/recorded-video test → reproduce → report loop. The original
four harnesses still pass unchanged. New First Steps browser coverage reproduces
the `hasDemo is not defined` exception during calibration on both desktop and
narrow Chromium viewports; see `testing/findings/calibration-has-demo.md`. A separate
shell-only fix now calls the existing helper, with the regression retained. A synthetic blank-video
smoke validates real local pose-inference wiring, not exercise accuracy. No human
recordings or second beginner session have been added; that release gate remains.

**Expanded exercise sweep:** all 21 movements / 44 supported movement-tier pairs now
have synthetic completion, interruption, tracking, framing and applicable counter
checks. All 88 desktop/narrow exercise browser cases passed, including demos, ghosts,
debriefs and CSV downloads. All 12 plan-tier selections passed, as did substituted
camera lifecycle/denial and simulated voice-queue tests. The sweep found a second
calibration demo-label defect (FC-LAB-002), and Cat–Cow can arm with its required
torso points outside the frame at all three tiers (FC-LAB-003, open). These are
recorded in `testing/findings/`; no failure was whitelisted. Real-video exercise
accuracy remains untested. See `testing/README.md` and the per-run coverage board.

---

## Executive summary

**The core thesis is validated.** A first-contact user who had never seen the app said the
real-time form corrections and the red/amber body tint were what he liked about it. That was
the unproven bet everything rested on.

**Zero wrong corrections** in the session — the gate criterion. But the app did confuse him
about his own form via a stale banner, so v4.9 was cut to close that and four other defects
the test exposed.

**One beginner session down, one to go.** Test 02 on v4.11 is the remaining gate requirement
before the Swift port is justified.

---

## Ground truth

| | |
|---|---|
| **Build** | `form-coach-v4.11.html` — single file, 215 KiB, no dependencies but the pose model CDN |
| **Verification** | Four browser harnesses green: `verify.mjs` **4,127/4,127** against 1,896 recorded vectors · mutations 8/8 caught · drawing 250/250 · skip 26/26 · `swift test` 15/15 |
| **Content** | 21 movements (10 rep · 10 hold · 1 guided), 5 plans, 3 tiers, 3 personas |
| **Voice** | 1,351 clips planned · **210 pending render** (~£1–2.50) |
| **Swift kit** | 12 sources, conformance vectors current |
| **Beginner tests** | **1 of 2 complete** — see `test-01-max.md` |

### A note on the test count

The project previously reported "3,789 vector checks". **Those suites are gone** — they
lived only in an ephemeral sandbox and were lost when it reset. They were never delivered
files.

The **vectors survived**, and they held the valuable half: the expected outputs. `verify.mjs`
reconstructs 4,127 checks from them, in a better shape than what it replaced — one file, one
source of truth, shared with the Swift tests so the two cannot drift.

**The 23 divergences are closed, and all 23 were *harness* faults** — the build never diverged
and the vectors were never wrong (the reasoning is kept in `README-verify.md`, including a note
that two of the diagnoses were wrong in their specifics while right about the cause).
`verify.mjs` now exits 0 and `swift test` passes 15/15 against the same JSON. The `frameRate`
section (4 vectors) is still skipped: it isn't replayable without the lost generator.

**What was genuinely lost:** the behavioural scenario suites — cooldown neutrality, plan
completion, regression swaps — and **`gen-refs.mjs`, the FK rig that generated every demo
skeleton**. The rig's loss is why the corrected keyframes are hand-authored; they are checked
instead by running each frame through the Evaluator's own read path against the movement's
real gates. Rebuilding either is worth less than beginner test 02 and is sequenced after it.

---

## What is proven

**The coaching engine.** Scoring, tier scaling, rep counting with hysteresis and tempo
floors, short-range detection, view-awareness, cue selection, frame-rate normalisation, form
tint, framing. All vector-covered and deterministic.

**Robustness.** Out-of-order API calls, degenerate input (null frames, `NaN`, out-of-range
coordinates), dropout and recovery, rapid position flicker — all absorbed without throwing.

**The product on a real body.** Real-time correction works and reads as help. The interface
is legible. The tint communicates.

## What is not proven

**That the fixes worked for another beginner.** v4.9 addressed five defects that test 01
found; v4.11 carries those fixes plus the later reference-drawing and skip work. Nobody has
put the current build through beginner test 02.

**That a beginner can complete a session unaided.** Max needed clarification on "side-on",
and several movements had unregistered reps. Whether v4.11 resolves that is the open question.

**Device variation.** One phone, one room, one body.

---

## Critical path

**Updated engineering gate:** the original four harnesses remain green, but the new
shell/exercise coverage exposed defects listed above. Close or explicitly review those
findings before treating engineering as clear. The earlier beginner-test and voice-render
steps below remain relevant; synthetic coverage does not satisfy them.

```
NOW ──▶ render 210 voice clips (~£1–2.50, 10 min)
        └─ mixed recorded/TTS was likely half the "overlapping voices" complaint

    ──▶ smoke-test v4.11 yourself (15 min)
        └─ crunch and side plank — re-authored after test 01
        └─ GLUTE BRIDGE — step 2 of First Steps, the demo a beginner meets
           earliest of all, and the one that was never on anyone's list
        └─ REF has coverage (refGates) and so does its DRAWING (verify-draw,
           after bug #43 — every demo was being stretched by the canvas
           aspect); the rest of the SHELL still has none, and no test can
           tell you a demo reads as the movement — only you can
        └─ the demos are now drawn ~29% smaller in the 480x340 box, which
           fits a square: correct proportions, less of the box used. Judge
           it on screen — the canvas is one line if it wants changing

    ──▶ ★ BEGINNER TEST 02 on v4.11 ★
        └─ measures the fixes · ask the wrong-corrections question explicitly

    ──▶ score both sessions against swift-port.md
        PASS → pay Apple fee → Week 1 of the port
        FAIL → fix in the browser, re-test
```

*Engineering work that exists but does not gate any of the above: rebuild the lost behavioural
suites; `drawRef`'s ground line; `hollow-tuck`'s folded leg. All in `engineering-log.md` under
known open items.*

---

## Open items

**From test 01** — see `test-01-max.md` for the full list. Highest value: demo audio synced
to the animation, and a per-exercise debrief (the data is already logged).

**Engineering** — two orphaned movements (`hollow-tuck`, `hollow-hold`, the first still
carrying the rig's folded leg but having no knee gate to author against); `leg-raise-bent` is
**unreachable** — no plan lists it and its only route, regression from `leg-raise`, needs a
`learning`-tier user in a `building`/`strong`-only plan; `dead-bug` frame 1 fails
`kneeTucked` permanently and correctly; `drawRef`'s ground line floats above a correct
dead-bug tabletop; tint solo coupled to `cueBudget`; explicit `video.videoWidth` aspect (port
Week 1); framing is 2D-only so it can't detect bad camera *tilt*.

**Deliberately unpatched** — a frame with no `cam` throws. Unreachable from `buildFrame` and
boundary-caught; changing engine code immediately before user testing is the worse trade.

---

## Assessment

**Strengths.** The engine/shell split keeps paying out — every test-01 fix landed in one
place and most port for free. Content-as-data meant correcting a broken demo was editing
nine numbers, and the vector diff caught it. The honesty principle is enforced by audit.
Zero running costs make £4.99 one-time viable.

**Risks.** The demos are the weakest part of the product; five more frames across three
movements have now been corrected, and the way they were found is the warning. They were sat
on for a week behind a diagnosis ("asymmetric movements a single-sided skeleton can't show")
that was plausible, wrong, and — because it pointed at *asymmetry* — steered attention away
from `glute-bridge`, the most-used demo of the three. **None of it was caught by a test,
because the demos had no automated coverage.** They do now — `refGates` (224 checks) asserts
every demo against its own gates and is itself mutation-tested, so this exact class fails by
name rather than waiting for someone to look. A second gap in the same area closed with bug
#43: `refGates` reads keyframe *numbers*, and every demo was being **drawn** stretched by the
canvas aspect — 1.41x in the demo box, 1.78x in the ghost, which meant a correct pose could
never line up with the ghost it was being asked to copy. `verify-draw.mjs` (250 checks) now
holds the drawing. What neither can judge is whether a demo *reads* as the movement:
`glute-bridge` frame 1 passed every gate for months while drawn rigidly rotated ~51°. The
privacy promise constrains features (history, voice control) in ways that need respecting
rather than working around. Single-camera geometry means some faults — squat valgus above all
— are permanently invisible and must be taught rather than corrected.

**The shape of the remaining work has changed.** Before test 01 the question was "does this
work at all?" It does. The question now is "does it work *well enough to teach someone*?" —
and that turns on the demos and the debrief far more than on the engine.

**One line:** thesis validated, five defects fixed, one beginner session to go.
