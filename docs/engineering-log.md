# Form Coach — engineering log

Consolidates eight code reviews into one record: every bug found, why it happened, and what
it taught. The individual reviews are in `archive/code-reviews/` if you want the raw
working; nothing here is lost, only compressed.

**Current state: `verify.mjs` — 3,789 checks against 1,891 recorded vectors.**

*The 17 JS suites this log used to cite were lost with an ephemeral sandbox; the vectors
survived and `verify.mjs` reconstructs the coverage. See `project-status.md`.*

---

## The bug ledger

| # | Bug | Root cause | Class |
|---|---|---|---|
| 14 | Completed holds threw silently every frame | `requestAnimationFrame` scheduled before the work, so a throw killed only that frame's tail | Silent failure |
| 15 | Praise fired before the fault was fixed | Cue emitted on the frame the fault cleared, not after a sustained correction | Timing |
| 16 | Glute bridge said "Higher!" at the correct bottom of every rep | A per-frame cue on a rep driver graded against a fixed ideal pose | Wrong unit of analysis |
| 17 | Rep confirmation flash was dead | Stylesheet rewrite dropped `.pop`; JS kept adding the class | CSS/JS drift |
| 18 | Sets opened judged on setup posture | `arm()` didn't reset `sev`, `pMax` or the target EMAs | Incomplete contract |
| 19 | Chrome stuck dimmed after Stop | Only the finish paths restored it | Missing path |
| 20 | Cooldowns leaked across movements | `lastSaid` persisted through `next()` | State lifetime |
| 21 | Selected persona/tier invisible | Toggled `aria-pressed`, but only classes were styled | Wrong audit dimension |
| 22 | Four console errors on the home screen | `showHome` still called functions the refactor deleted | Incomplete deletion |
| 23 | "Learning\|I'm new" ran together | Template rendered `<b>`+`<span>`; CSS styled an unused `.t` class | CSS/JS drift |
| 24 | Voice preview never changed | Brave farbles `getVoices()`; personas never drove TTS by design | Platform + design mismatch |
| 25 | A clipped body could still arm a set | Framing emitted a cue but didn't gate `inPosition` | Cue without a gate |
| 26 | Swift missed the framing gate | Browser fix not mirrored; vectors unchanged so the diff didn't catch it | Parity |
| 27 | "3·2·1" arrived as a jumble | Shell played clips directly, bypassing the speech queue | Bypassed abstraction |
| 28 | A crunch demanded ankles it never reads | Framing required every declared joint, including setup gates | Over-broad requirement |
| 29 | Swift `neededJoints` unmirrored | Same fix, not carried across | Parity |
| 30 | `cat-cow` had the strictest framing rule | Empty need set read as "no filter" instead of "no requirement" | Inverted default |
| 31 | Dead `case "raw"` handler | Emitter moved to `t:"num"`, handler left behind | Residue |
| 32 | **Calibration threw for every new user** | `framingKey` defined on `SessionCore`, called from `CalibrationCore` | Wrong class |
| 33 | A NaN landmark produced a `NaN` form score | `readMetric` guarded missing joints but not non-finite results | Value domain |
| 34 | User's name interpolated unescaped | No escaping at two markup sites | Input handling |
| 35 | Praise stayed on screen over a red limb | `clearCue` had **zero emitters** — the banner never expired | Stale presentation |
| 36 | Clock started ~8 s before the user was in the shape | `tryArm(inPose, …)` was passed `inPosition` — quality gates never gated arming | Parameter/argument mismatch |
| 37 | Four cues competed to say "you're not ready" | `getin`, framing, `tooFar`, `vis` each held an independent cooldown | Uncoordinated budgets |
| 38 | Rep acknowledged on the way down | Cycle completion and user acknowledgement were the same event | Wrong moment |
| 39 | Side-plank demo never animated the hip | `hip.y` identical across all three keyframes | Dead content |
| 40 | Crunch demo taught a pose the engine rejects | `kneesBent` scored **0** on the demo's own frames | Content vs engine |

**Bugs 35–40 all came from one 20-minute session with one real beginner.** Six defects, none
of which eight code reviews had found, because every one of them lives in the gap between
what the engine computes and what a person perceives. That is the argument for user testing
stated as a number.

Findings A–F from review #1 (frame-rate normalisation, loop error boundary, `minMs`
enforcement, cooldown-at-source, explicit video aspect) are recorded in
`archive/code-reviews/code-review-v4.8.md`. All are closed except **E** (explicit
`video.videoWidth`), scheduled for the port's Week 1 orientation gate.

---

## What each review probed, and what it yielded

| Pass | Angle | Yield |
|---|---|---|
| 1 | Architecture read + first static scripts | Whole-feature breakage (dead CSS, unstyled states) |
| 2 | Contract checks (does `arm()` reset what it claims?) | Contract violations, state leaks |
| 3 | The newly-added feature | A missing gate |
| 4 | Swift parity by regeneration | Parity gap, inverted default |
| 5 | Effect stream, both directions | Dead handler |
| 6 | **Constructed states** rather than endpoints | **A crash in every new user's first seconds** |
| 7 | API fuzzing + transitional states, systematically | Closed one defect, disproved three suspicions, no crashes |
| 8 | Value domains, data integrity, growth, input | NaN propagation, unescaped input |

**The pattern, stated plainly: yield tracks what you probe, not how mature the code is.**
Five passes of increasingly refined static analysis found progressively less. Review #6
constructed a *state* nobody had built and immediately found the worst bug in weeks. Review
#7 constructed states systematically and the code held. Review #8 attacked value domains and
found two more.

Each new angle yields once, then stops.

---

## Lessons worth carrying into the Swift port

**Silent resilience is worse than failure.** Bug #14 hid for months because the loop
survived its own exceptions. Fail loudly, recover gracefully — never `try?` the session tick.

**A contract that says "discard state X" must be re-checked whenever state is added.**
Bug #18: three fields added after `arm()` was written fell outside its contract silently.

**Choose the unit of analysis deliberately.** Bug #16 and the short-rep design both turn on
frame vs cycle. A rep driver graded against a fixed ideal *will* look wrong on most frames of
a correct rep.

**Empty collections need an explicit meaning.** Bug #30: an empty set read as "no filter"
rather than "no requirement" gave the app's most humble movement its strictest rule. The
Swift equivalent reproduces this exactly, which is why the fallback lives inside
`neededJoints` rather than at the call site.

**Both parity checks are needed.** Bug #26 changed no vectors (source-only drift); bug #29
did change them. Regenerate *and* diff the sources.

**Static analysis finds what reading misses.** Bugs #17, #21, #22, #23 and #31 were all found
by scripts comparing one artefact against another. Reading the same code found none of them.

**A parameter name is not a contract.** Bug #36: `tryArm(inPose, …)` was passed
`inPosition` for months. The name documented an intention the call site didn't honour, and no
test caught it because both values are booleans that are usually equal.

**Content can be dead too.** Bug #39: the side-plank demo's hip coordinate was identical
across every keyframe, so the movement's defining action was never shown. Audits checked that
code was reachable; nothing checked that *animation actually animated*.

**When a broad new probe reports many failures at once, suspect the probe.** Twice in review
#5 and once in #8, an alarming result was my harness, not the product — mirrored single-sided
demo skeletons, static frames that can't drive reps, and measuring collections after they'd
been cleared. Measuring the disagreement beat patching the engine to satisfy a bad test.

---

## The permanent audits

These run every review. Each exists because a bug got past the previous set.

- Every runtime-toggled **class** is styled *(bug #17)*
- Every `var(--x)` is **defined** *(the redesign orphaned five)*
- Every `$()` and `getElementById` **resolves** to real markup
- No calls to **deleted or duplicate** functions *(bugs #22, and a duplicate I introduced)*
- Every `aria-pressed` toggler has a **selected-state rule** *(bug #21 — the class audit
  was checking the wrong dimension)*
- `[hidden]` **beats author display** *(the fix that silently didn't work)*
- Effect stream clean **in both directions** *(bug #31)*
- Shipped file **byte-identical** to the working copy

---

## Known open items

| Item | Why it's open |
|---|---|
| `hollow-tuck` / `hollow-hold` orphaned | Built and tested, in no plan. Additive whenever wanted |
| Tint solo coupled to `cueBudget === 1` | Should be an explicit tier flag. Five minutes |
| Explicit `video.videoWidth` aspect (finding E) | Needs hardware; scheduled for port Week 1 |
| Framing is 2D only | Catches "cut off" and "too far", not "bad camera tilt" |
| Frame without `cam` throws | Unreachable from `buildFrame`, boundary-caught. Deliberately unpatched before user testing |
| `ev.hold` accumulates pre-arm | No observable effect; the verdict is armed-guarded |
| Learning teach lines run 12–16s | A content judgement. Test 01 suggests the issue is that they play against a *static screen* — pairing them with the demo animation is the fix |
| `dead-bug` / `leg-raise-bent` demos fail their own gates | Same class as #40, but these are asymmetric movements a single-sided demo skeleton can't represent |
| 23 divergences in `verify.mjs` | 13 harness, 10 a real ~1.3% gap on one target. First Claude Code task |
