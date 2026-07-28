# Form Coach — the Swift port

Merges the conversion plan and the go/no-go gate into one document. The old separate
versions are in `archive/superseded-docs/`.

---

## Part 1 — the gate: when porting is justified

Porting is weeks of work that locks in the current design. Pay that cost only once you know
the design is worth locking in. **The browser prototype exists to answer cheaply what Swift
would answer expensively.**

Three parts. All must pass.

### A · It works on a real body

**2 beginner sessions** per `beginner-test-protocol.md`, each producing a TelLog CSV, a
screen recording with microphone, and written verbatim answers.

**Pass condition:** both people complete First Steps **unaided**, and across both sessions
the coach gives **zero corrections you'd disagree with**. Missed faults are tolerable at
this gate; *wrong* faults are not — Swift would faithfully reproduce the hole.

### B · It works on real hardware

**1 phone session** confirming: the skeleton tracks without visible lag, cues arrive while
the fault is still happening, orientation stays sane in portrait and both landscapes, and
(with earbuds) a measured Bluetooth latency figure.

**Pass condition:** the engine behaves at phone frame rates. Any divergence is fixed **in
HTML and re-vectored before Swift** — otherwise you port a bug.

### C · The specification is frozen and executable

Already true; confirm on the day.

| | Status |
|---|---|
| `swift test` runs and names divergences | ✅ Xcode licensed, **15/15 passing** |
| Content exported as data, zero hand-transcription | ✅ `content-v4.8.json` |
| Vectors cover every engine behaviour | ✅ 1,893 rows · `verify.mjs` 4,044 checks, 0 divergences |
| No open engine bugs | ✅ eight reviews |

### The sequence

```
0  Render 210 pending voice clips  (~£1–2.50, 10 min)
1  Desktop smoke pass              (15 min — the shell's only test)
2  Phone session                   → Part B
      ├── engine misbehaved? fix in HTML, re-vector, repeat. Do NOT start Swift
      └── behaved? continue
3  TWO BEGINNER SESSIONS           → Part A   ← the actual gate
      ├── wrong corrections? the design has a hole. Fix in the browser (cheap), re-test
      └── passed? continue
4  Confirm Part C
5  Pay the Apple Developer fee     ← now, and not before
6  Week 1 below
```

### Not in the gate

Named so they don't creep in: a polished app (the port needs a correct *core*), all 21
movements beginner-validated (First Steps proves the loop; the rest share the engine), the
orphaned movements, more than 2 beginners (a third only if the first two disagree), and
anything commercial — that gates *launch*, not *porting*.

---

## Part 2 — the port itself

### The method

**The browser engine is the specification; the vectors make it executable.** Everything in
`Vectors/` was recorded from the running v4.8 engine. Write Swift 1:1, run `swift test`, and
failures name the exact divergence.

**The anti-divergence rule, which matters more than any schedule:** never change behaviour in
Swift first. Change the HTML → regenerate vectors → make Swift pass. Two implementations
drifting is the failure mode that kills ports.

### What `swift test` green means

| Section | Rows | Pins |
|---|---|---|
| `scoreTarget` | 1,428 | every target × tier × probe value, plus cue direction |
| `readMetric` | 169 | every target read off every demo frame |
| `aspect` | 3 | portrait/square/landscape give identical physical angles |
| `filters` | 24 | dt-normalised EMA, identity at 30 fps |
| `frameRate` | 4 | same movement at 24/30/60/90 fps scores the same |
| `tempo` | 120 | `minMs` accept/reject per movement per tier |
| `neededJoints` | 21 | framing requirements per movement |
| `framing` | 7 | every verdict and edge-direction |
| `tintDerivation` | 68 | tint segments from every metric spec |
| `tintScenarios` | 3 | severity + hysteresis + the Learning rule |
| `planExpansion` | 15 | sets × tier scaling |
| `clipResolver` + `slug` | 12 | voice resolution and tokenisation |
| `repScenarios` | 3 | priming, baseline drift, the crunch guard |
| `evaluatorScenarios` | 14 | standing rejection, view gating, cue budgets |

### Seven weeks, gated

**Week 0 — engine green.** `swift test` compiles and passes. Expect compile errors first,
then real divergences. *Two Swift traps already encoded: sort by `(score, index)` because
Swift's sort isn't stable, and explicit optionals for `w: 0`.*

**Week 1 — capture adapter.** MediaPipe Tasks for iOS, **not** Vision (Vision lacks the
heel/toe/z landmarks the engine reads). Riskiest week. The orientation gate is
non-negotiable, and finding E (explicit `video.videoWidth` aspect) folds in here.
*Start Apple Developer enrolment now — approval takes days — but don't pay until the
beginner test has passed.*

**Week 2 — session + speech.** `SessionCore` and `CalibrationCore` port from the effect
stream; `AVSpeechSynthesizer` plus the clip bank. **Note:** `CalibrationCore` isn't in the
kit yet, so the corrected post-bug-#32 structure is what ports.

**Week 3 — SwiftUI screens.** `interface-principles.md` is the specification. Several of its
rules are testable: the colour lanes, control gating (a visibility matrix), and the
`[hidden]`-equivalent guarantee that hiding always beats layout.

**Week 4 — onboarding and persistence.** SwiftData. This is where history/streaks would
live if built — nothing to port, since the browser has no persistence at all.

**Week 5 — parity and device tuning.** TelLog CSV diff between browser and Swift on the same
recorded session; target ≤2° divergence.

**Week 6 — TestFlight and beginner tests on device.**

### Model allocation

The organising principle: **give the harder model the work no test can check; give the
cheaper one the work the compiler and tests already check.** Week 0.2 (extending the
conformance harness to the Session layer) was the highest-leverage task, because it converted
Week 2 from careful translation into a red/green loop.
