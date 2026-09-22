# Form Coach — handover

Written to be read by a different assistant, or by you in six months. It captures the
decisions and reasoning that live in conversation rather than in code — the part that
doesn't transfer by copying a folder.

**Read `docs/project-status.md` first for current state.** This file is the *why*.

---

## What the product is

A camera-based form coach for **people who don't know how to exercise, at home**. Not
physio, not medical, not for gym-goers. On-device pose estimation (MediaPipe), video
never leaves the device, **zero servers**, one-time **£4.99** rather than a subscription.

**The founding principle, which everything else follows from:**
> *Only correct what you can measure. Teach what you cannot.*

## Rules that must not be broken

Each was learned the hard way, several from shipped bugs.

**1 · The anti-divergence rule.** Never change behaviour in Swift first. Change the HTML
→ regenerate vectors → make Swift pass. Two implementations drifting is what kills ports.

**2 · Fix the build, never the vectors.** A failing vector means the build changed. If
that change was intended, regenerate deliberately and record why in `meta.note`.

**3 · Colour means the body.** Mint/amber/red are form feedback *only*. Iris (#9D8DF1)
is the user's choices and progress. Everything else is monochrome.

**4 · Fail loudly.** Never swallow errors in the session tick. A bug hid for months
behind `requestAnimationFrame` surviving its own exceptions.

**5 · Don't ask what the camera can see.** Framing and readiness are measured, not
requested.

**6 · Never claim what you can't support.** If a joint isn't visible or the angle makes a
reading unreliable, suppress the cue and log the suppression.

**7 · A rep that doesn't count must be explained.** Too fast → "slower". Too shallow →
"deeper". Silence reads as a broken counter.

**8 · Zero is a measurement claim.** A skipped exercise records `score: null`, never 0 —
we didn't watch someone perform badly, we didn't watch them at all. The same argument
killed a stray `AVG FORM: 0` on the debrief when every phase was skipped.

## Architecture in one paragraph

Pure engine, thin shell. The engine emits **effects** (`{t:"say"…}`, `{t:"bigTime"…}`)
and `applyFx` replays them onto the DOM. Judgement lives in the engine; the shell is too
thin to hide a bug. **The Swift port takes the engine only** — that boundary is why the
architecture is shaped this way. All content (21 movements, plans, tiers, personas, 84
dialogue keys) is **declarative data**, so adding a movement is adding a declaration,
never logic.

## Verification

The browser engine **is** the specification; the vectors make it executable. Four
harnesses, all must exit 0 before a commit:

```
node verify.mjs           <build>   ~4,127 checks against 1,896 recorded cases
node verify-mutations.mjs <build>   breaks demo keyframes; asserts refGates bites
node verify-draw.mjs      <build>   250 checks on drawing — refGates reads numbers, not pictures
node verify-skip.mjs      <build>   26 checks on the skip paths, which have no vector coverage
swift test                          15/15 against the same JSON
```

Plus permanent static audits (every toggled class styled, every `var()` defined,
`[hidden]` beating author display, no dead effect handlers) — each exists because a bug
got past the previous set.

**Two meta-rules about the tests themselves**, both learned expensively:

- **A suite that passes on everything catches nothing.** Every harness has a mutation
  test proving it bites. `repScenarios` once asserted *nothing* — it read fields no row
  had — and reported green for weeks.
- **A test you can name but not run is worse than one you never claimed.** Three
  documents credited a self-consistency check that had been lost with a sandbox, and
  three demos drifted through the gap because nobody looked.

## Traps that have already bitten

- A per-frame cue on a **rep driver** fires at the bottom of every *correct* rep. Judge
  reps over the cycle, not the frame.
- `arm()` discards setup state — **any field added later must be added to it.**
- An **empty collection** must mean "no requirement", not "no filter".
- Author `display` silently defeats the `hidden` attribute.
- Demo (`REF`) data is a **single-sided** skeleton; mirroring can't represent asymmetric
  movements.
- **A parameter name is not a contract** — `tryArm(inPose, …)` was passed `inPosition`
  for months and no test caught it, because both are booleans that are usually equal.
- **Content can be dead too** — a demo's hip coordinate was identical across every
  keyframe, so the movement's defining action was never animated.
- **Git only honours `#` at line start** — trailing comments in `.gitignore` turn
  patterns into literals matching nothing.

## Where the project is

**The concept is validated.** One blind beginner test (Max, 26 July) confirmed the core
bet: real-time form correction and the body tint were what he named as good, unprompted.
**Zero wrong corrections** — the gate criterion.

**The next milestone is not code. It is beginner test 02.** See
`docs/beginner-test-protocol.md`, and `docs/swift-port.md` for the gate that decides
whether the port is justified.

**Outstanding, in order:** render ~210 voice clips (£1–2.50) · smoke-test the build by
eye · beginner test 02 · then the restructure in `docs/restructure-plan.md`.

## Decisions made — don't relitigate without new information

| Decision | Reasoning |
|---|---|
| **No medical/HealthKit condition data** | The physio pivot through a side door: App Store medical scrutiny, liability, possible MHRA territory |
| **No cloud LLM for the debrief** | Needs a server for the key, adds per-session cost to a one-time purchase, sends data off-device. On-device (Apple Foundation Models) is the right version |
| **No Pull category** | No bodyweight pull movement is both equipment-free and side-on measurable. "Push · Legs · Core" is honest |
| **Recorded video demos, not stick figures** | Four separate bug classes came from hand-authored keyframes |
| **Circuit format** (one set each, rotating) | Decided; note that straight sets aid *learning form* and a tier-aware split is the compromise if it disappoints |
| **Remove the yoga movements** | Keep `guided` as a *capability* — it's the honesty principle's worked example |
| **Streaks, if built, gate on performance not attendance** | The person most likely to break a streak is a nervous beginner — precisely the user |

## For a new assistant

The repo root has **`AGENTS.md`** (the cross-tool convention) with a `CLAUDE.md` symlink
pointing at it, so both names resolve. Point the tool at the repo and tell it to read
`AGENTS.md` and `docs/README.md` first.

**The single most useful instruction:** run the four verifiers before and after any
change, and never edit a vector to make a test pass.
