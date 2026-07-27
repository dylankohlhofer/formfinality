# Form Coach — project context

Read this before changing anything. It encodes rules that were learned the hard way; several
were paid for with bugs that shipped.

## What this is

A camera-based form coach for **people who don't know how to exercise, at home**. Not
physio, not medical, not military. On-device pose estimation (MediaPipe), zero server, video
never leaves the device. One-time £4.99, no subscription.

**Founding principle:** *only correct what you can measure; teach what you cannot.*

## Repo layout

```
form-coach-v4.8.html      the entire browser app — engine + shell in one file
verify.mjs                replays conformance vectors against the build
conformance-vectors.json  1,891 recorded cases: the executable specification
content-v4.8.json         all movements/plans/tiers/dialogue as data
swift/                    the Swift port (FormCoachEngine SPM package)
voice/                    rendered coach audio, indexed by manifest.json
voice-render-kit/         ElevenLabs render tooling
docs/                     see docs/README.md
```

## Non-negotiable rules

**1 · The anti-divergence rule.** Never change behaviour in Swift first. Change the HTML →
regenerate vectors → make Swift pass. Two implementations drifting is the failure mode that
kills ports.

**2 · Fix the build, never the vectors.** A failing vector means the build changed. If the
change was intended, regenerate the vectors deliberately and say so.

**3 · Colour means the body.** Mint/amber/red are form feedback *only*. Iris (#9D8DF1) is
the user's choices and progress. Everything else is monochrome. If a new element wants
colour, it must name its lane.

**4 · Fail loudly.** Never `try?` or silently swallow in the session tick. A bug hid for
months behind `requestAnimationFrame` surviving its own exceptions.

**5 · Don't ask the user what the camera can see.** Framing, position and readiness are
measured, not requested. "Stand 2 metres back" was replaced by a bounding-box check for
exactly this reason.

**6 · Never say something you can't support.** If a joint isn't visible or the view angle
makes a reading unreliable, suppress the cue and log the suppression. `cat-cow` is `guided`
— it judges nothing — and that is the standard, not an exception.

**7 · A rep that doesn't count must be explained.** Too fast → "slower". Too shallow →
"deeper". Silence reads as a broken counter.

## Before you commit

```bash
node verify.mjs form-coach-v4.9.html   # must exit 0 — naming the build is required
```

Then the permanent static audits — each exists because a bug got past the previous set:

- every runtime-toggled CSS class is styled
- every `var(--x)` is defined
- every `$()` / `getElementById` resolves to real markup
- no calls to deleted functions; no duplicate function definitions
- every `aria-pressed` toggler has a selected-state rule
- `[hidden]` beats author `display` (a global `!important` rule — do not remove)
- every emitted effect has a handler, and no handler is dead

## Architecture, briefly

Pure engine, thin shell. The engine emits **effects** (`{t:"say"…}`, `{t:"bigTime"…}`) and
`applyFx` replays them onto the DOM. Keep judgement in the engine; keep the shell too thin
to hide a bug. The Swift port takes the engine; the shell is platform-specific.

**Content is data.** Adding a movement means adding a declaration, never logic. Metric specs
name their joints, which is why the form tint and framing scope are *derived* rather than
authored.

**Tier ids (`learning`/`building`/`strong`) are frozen** — they name clip folders, vector
rows, CSV columns and dialogue keys. Labels are editable brand; ids are plumbing.

## Traps that have already bitten

- A per-frame cue on a **rep driver** fires at the bottom of every *correct* rep. Judge reps
  over the cycle, not the frame.
- `arm()` discards setup state. **Any field added later must be added to it.**
- An **empty collection** must mean "no requirement", not "no filter".
- Author `display` silently defeats the `hidden` attribute.
- Demo (`REF`) data is a **single-sided** skeleton; mirroring it can't represent asymmetric
  movements. Demos are drawings, never evaluated.

## Current state

17 suites of coverage were lost to an ephemeral sandbox; `verify.mjs` reconstructs ~3,800
checks from the surviving vectors. The UI shell has **no** automated coverage — a manual
smoke pass is its only test.

**The next milestone is not code.** It's two beginner test sessions
(`docs/beginner-test-protocol.md`). See `docs/project-status.md`.
