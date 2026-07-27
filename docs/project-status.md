# Form Coach — project status report

**Every figure below was computed against the shipped build.** Where any other document
disagrees, this file wins.

**Last updated:** after beginner test 01 (Max, 26 July) and the v4.9 fixes.

---

## Executive summary

**The core thesis is validated.** A first-contact user who had never seen the app said the
real-time form corrections and the red/amber body tint were what he liked about it. That was
the unproven bet everything rested on.

**Zero wrong corrections** in the session — the gate criterion. But the app did confuse him
about his own form via a stale banner, so v4.9 exists to close that and four other defects
the test exposed.

**One beginner session down, one to go.** Test 02 on v4.9 is the remaining gate requirement
before the Swift port is justified.

---

## Ground truth

| | |
|---|---|
| **Build** | `form-coach-v4.9.html` — single file, 197 KB, no dependencies but the pose model CDN |
| **Verification** | `verify.mjs` — **3,789 checks passing** against 1,891 recorded vectors |
| **Content** | 21 movements (10 rep · 10 hold · 1 guided), 5 plans, 3 tiers, 3 personas |
| **Voice** | 1,351 clips planned · **210 pending render** (~£1–2.50) |
| **Swift kit** | 12 sources, conformance vectors current |
| **Beginner tests** | **1 of 2 complete** — see `test-01-max.md` |

### A note on the test count

The project previously reported "3,789 vector checks". **Those suites are gone** — they
lived only in an ephemeral sandbox and were lost when it reset. They were never delivered
files.

The **vectors survived**, and they held the valuable half: the expected outputs. `verify.mjs`
reconstructs 3,789 checks from them, in a better shape than what it replaced — one file, one
source of truth, shared with the Swift tests so the two cannot drift.

**23 known divergences remain**, classified in `test-recovery-kit.zip`: 13 are harness
artifacts, 10 are a real ~1.3% gap on one target worth investigating. The `frameRate`
section isn't replayable without the lost generator.

**What was genuinely lost:** the behavioural scenario suites — cooldown neutrality, plan
completion, regression swaps. Rebuilding those in a real repo is a first task for Claude Code.

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

**That the fixes worked.** v4.9 addresses five defects that test 01 found. Nobody has used it.

**That a beginner can complete a session unaided.** Max needed clarification on "side-on",
and several movements had unregistered reps. Whether v4.9 resolves that is the open question.

**Device variation.** One phone, one room, one body.

---

## Critical path

```
NOW ──▶ render 210 voice clips (~£1–2.50, 10 min)
        └─ mixed recorded/TTS was likely half the "overlapping voices" complaint

    ──▶ smoke-test v4.9 yourself (15 min)
        └─ watch one crunch and one side plank: those demos should now teach

    ──▶ ★ BEGINNER TEST 02 on v4.9 ★
        └─ measures the fixes · ask the wrong-corrections question explicitly

    ──▶ score both sessions against swift-port.md
        PASS → pay Apple fee → Week 1 of the port
        FAIL → fix in the browser, re-test
```

---

## Open items

**From test 01** — see `test-01-max.md` for the full list. Highest value: demo audio synced
to the animation, and a per-exercise debrief (the data is already logged).

**Engineering** — two orphaned movements (`hollow-tuck`, `hollow-hold`); `dead-bug` and
`leg-raise-bent` demos fail their own gates; tint solo coupled to `cueBudget`; explicit
`video.videoWidth` aspect (port Week 1); framing is 2D-only so it can't detect bad camera
*tilt*.

**Deliberately unpatched** — a frame with no `cam` throws. Unreachable from `buildFrame` and
boundary-caught; changing engine code immediately before user testing is the worse trade.

---

## Assessment

**Strengths.** The engine/shell split keeps paying out — every test-01 fix landed in one
place and most port for free. Content-as-data meant correcting a broken demo was editing
nine numbers, and the vector diff caught it. The honesty principle is enforced by audit.
Zero running costs make £4.99 one-time viable.

**Risks.** The demos are the weakest part of the product and two more are known broken. The
privacy promise constrains features (history, voice control) in ways that need respecting
rather than working around. Single-camera geometry means some faults — squat valgus above all
— are permanently invisible and must be taught rather than corrected.

**The shape of the remaining work has changed.** Before test 01 the question was "does this
work at all?" It does. The question now is "does it work *well enough to teach someone*?" —
and that turns on the demos and the debrief far more than on the engine.

**One line:** thesis validated, five defects fixed, one beginner session to go.
