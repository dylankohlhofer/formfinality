# Form Coach — how the system is built

**Who this is for.** Someone who wants the whole shape of the system in their head before
going near a line of it. No prior knowledge assumed. Where a concept needs teaching from
zero — what a dot product is, what a neural network actually does — this guide names it and
points at `concepts-deep-dive.md` rather than re-teaching it badly.

Updated after the September 14 architecture review. Current verification counts
belong in `project-status.md`; optimization measurements and deferred work are in
`sessions/architecture-optimisations-2026-09-14.md`.

**What this guide is.** A map. `system-reference.md` is the spec, `concepts-deep-dive.md` is
the theory, `swift-port.md` is the plan. This is the thing that tells you which of those you
need, and where in the code anything actually lives.

---

## 1 · What it does, in one breath

You prop a phone or laptop against something, stand back, and do a plank. The app watches
you through the camera, works out where your joints are, decides whether your hips are
sagging, and says *"lift your hips"* in a human voice — while a timer counts your hold. It
does this without sending a single frame anywhere. The video never leaves the device.

It is aimed at **people who don't know how to exercise, at home**. Not physiotherapy, not
athletes, not the military. That audience choice drives almost every technical decision in
here, and it is worth holding onto while you read.

---

## 2 · The four boxes

Everything is one of these, in this order, as fast as the camera delivers frames — around
thirty times a second:

```
   CAMERA          POSE MODEL          ENGINE               SHELL
   ──────          ──────────          ──────               ─────
   a video    →    33 body       →    "hip 0.06 off    →   a voice saying
   frame           landmarks           the line —           "lift your hips",
                                       that's a sag"        a timer, a colour
```

Note what the engine actually deals in: **normalised units and degrees**, never centimetres.
It has no idea how tall you are, and never needs to.

1. **Camera** — a `<video>` element. Raw pixels.
2. **Pose model** — Google's MediaPipe, running *on the device*, turning pixels into 33
   labelled points (left shoulder, right knee…) each with an x, a y, a depth guess, and a
   confidence. This is the browser's pose model; we didn't train it. The optional
   native coaching selectors are separate consumers of approved facts/IDs, not
   alternative pose judges or a cloud coach.
3. **Engine** — pure arithmetic. Takes the points, measures angles, decides what's wrong,
   decides whether to mention it. Knows nothing about screens.
4. **Shell** — puts things on the screen and plays audio. Knows nothing about exercise.

The line between 3 and 4 is the most important idea in the codebase. §5 of this guide is
entirely about it.

---

## 3 · A tour of the repo

```
AGENTS.md                 project rules, audits and current build commands
CLAUDE.md                 symlink to AGENTS.md so both tool conventions resolve
form-coach-v4.11.html     the entire app — engine and shell, one file
content-v4.8.json         all movements/plans/tiers/dialogue, as data
conformance-vectors.json  1,896 recorded cases: the executable specification
verify.mjs                replays the vectors against the build
verify-mutations.mjs      breaks demos on purpose, checks the tests notice
verify-draw.mjs           checks the demo drawings are drawn correctly
verify-skip.mjs           checks both cores record skips as null, never zero
swift/                    the iOS port (a Swift package, engine only)
voice/                    rendered coach audio across three
                          personas plus spoken numbers, indexed by manifest.json
voice-render-kit/         the ElevenLabs tooling that produced them
docs/                     this vault
testing/                  shared replay/browser/audio runner, regressions and profiles
```

### Why one HTML file?

There is one production source entrypoint and no production bundler. Tests have
pinned npm dependencies; recorded voice assets are separate, and the browser still
loads its runtime/model and fonts externally. Opening one HTML file does **not**
make this an offline package. Tests archive the exact HTML and relevant input hashes
so verification cannot silently switch to a newly edited working build.

The large file is a maintenance cost. Named extraction boundaries, the effect
protocol and focused tests matter more than its physical file count. Preserve these
seams now; a future source split must keep an equivalent generated artifact and
test provenance. It is not a prerequisite for removing redundant runtime work.

### The two halves of that file

The file has a hard internal seam at `const VERSION`:

| | Search anchors | What lives there |
|---|---|---|
| **Core / headless helpers** | `const TIERS` → `const VERSION` | Content, geometry, evaluator, counters, session/calibration state machines, approved coaching contracts and injected drawing helpers |
| **Browser shell** | `const VERSION` onward | Voice, local diagnostics, DOM effects, controls, screens, camera ownership and animation loop |

This is not a comment — it is load-bearing. `verify.mjs` literally slices the file at those
two markers, and imports the engine as a module to test it headlessly. That is why the
engine can be tested in Node with no browser: **it never touches the DOM**.

---

## 4 · The engine, section by section

The file is divided by banner comments numbered 1–12. Sections 1–6 are engine; 7–12 are
shell. Here is what each group of functions is *for*.

> The numbered headings below are **the code's own banner numbers**, not this guide's
> section numbers. `### 5 · GEOMETRY` is a banner in the HTML file; `## 5 ·` is a chapter
> of this document. Search the build for `5 ·` and you'll land on the right one.

### 1 · TIERS — `learning` / `building` / `strong`

Three difficulty levels. A tier is not a label; it is a set of multipliers. `tol` widens
every tolerance, `repMin` scales the minimum rep duration, and so on. A beginner planking
gets a wider band of "acceptable" before anyone says anything.

**The ids are frozen.** They name clip folders on disk, columns in the vectors, and keys in
the dialogue. Labels are brand and can change; ids are plumbing and cannot.

### 2 · MOVEMENTS — a movement is a *set of targets*, not one angle

The single most important data structure in the product. Twenty-one movements, each
declaring what to measure and what "good" is. Here is a real one, from `plank`:

```js
{id:"bodyLine", m:{k:"angle", v:"hip", a:"shoulder", c:"ankle"},
 ideal:180, tol:8, range:35, w:2, gate:true}
```

Read it as: *"measure the angle at the **hip**, between the **shoulder** and the **ankle**.
Perfect is 180° — a straight line. Within 8° is still perfect. The score reaches zero 35°
out. It's worth double weight in the form score, and it gates the hold clock."*

Three kinds of measurement exist, and only three:

- **`angle`** — the angle at a joint, between two others. Knee bend, hip hinge.
- **`line`** — how far a joint sits off the line between two others. **Signed**, which is
  what makes it powerful: the same measurement distinguishes two opposite faults.
- **`vert`** — how far a segment is from vertical. Torso uprightness.

`plank` carries all three. The one that actually produces the coaching is the `line`:

```js
{id:"hipAlign", m:{k:"line", of:"hip", from:"shoulder", to:"ankle"},
 ideal:0, tol:0.025, range:0.09, w:2, above:"sag", below:"pike"}
```

*"How far does the **hip** sit off the line from **shoulder** to **ankle**? Zero is perfect.
Above the band, the fault is `sag`; below it, `pike`."* One measurement, two named faults,
because the sign carries the direction. Note that `bodyLine` above is the **gate** — it
decides whether the clock runs — while `hipAlign` is what speaks. Separating "is this good
enough to count" from "what should I say" is deliberate.

Targets also carry flags that decide *what kind of authority* the measurement has:

| Flag | Meaning |
|---|---|
| `pos:true` | A **position gate** — "are you on the floor, on your side?" Decides whether a set can start at all |
| `gate:true` | A **quality gate** — "is the shape good?" Decides only whether the hold clock runs |
| `w:` | Weight in the form score. `w:0` means measured but not scored |

Gating the *start* on quality was an early design error worth remembering: a sagging side
plank failed its own quality gate, never armed, and so the coach said nothing at all — to
exactly the person who needed coaching most.

### 3 · PLANS — workouts as data

Five plans. A plan is a list of steps; a step names a movement and a duration. Tier scaling
expands them: a step declaring `sets:2` becomes three sets with rests between at Strong.
`expandPlanSteps` does this and nothing else.

### 4 · DIALOGUE — everything the coach can say

A cascade lookup: `persona[tier][key] → tier[key] → base[key]`. Ask for the key `sag` as the
`warm` persona at `learning` tier, and you get the warmest, most beginner-appropriate phrasing
that exists, falling back gracefully if a specific one was never written.

### 5 · GEOMETRY — turning points into numbers

Small, pure, and the foundation everything else stands on.

- `angleAt(b, a, c)` — the angle at `b`. Dot product and an arccosine. See
  `concepts-deep-dive.md` §1.3 if that sentence meant nothing.
- `readMetric(m, frame, side)` — evaluates one metric spec against one frame. This is the
  function that turns the declaration in §2 into an actual number.
- `framing(frame, need)` — is the person fully in shot, too far, or clipped? A bounding box
  over the joints this movement actually needs.
- `buildFrame(lms, aspect)` — packages raw model output into the shape the engine expects,
  and computes `sideness` (how side-on the body is) from depth.

**The aspect correction lives here and is the subtlest thing in the file.** MediaPipe reports
x as a fraction of the *width* and y as a fraction of the *height*. If the frame isn't square,
those are different physical scales, and the same physical hip angle measures 55.6° in
landscape and 109.6° in portrait. `readMetric` multiplies x by the aspect ratio to undo it.
Forgetting this boundary caused bug #43 — see §9.

### 6 · FORM EVALUATOR — the actual coach

The largest section, and where judgement happens.

- **`scoreTarget(t, v, tier)`** — one reading → 0–100. Flat 100 inside the tolerance band,
  then falling linearly. Continuous, not pass/fail, because "nearly right" and "badly wrong"
  need different responses.
- **`class Evaluator`** — the per-set brain. Holds smoothing state, the running score, the
  cue budget, hold time, the log of when each fault occurred. `evaluate(frame, dt, now)` is
  called once per frame and returns everything the shell needs.
- **`class Rep`** — counts reps. Far harder than it sounds: it needs two thresholds rather
  than one, a "primed" flag so you can't score a rep you never started, and a minimum
  duration so a bounced rep doesn't count. See the hysteresis and debouncing rows in §7.
- **`sessionInsights` / `buildWorkoutSummary`** — summarize observed work and select
  approved teaching. Timing is an observation, **not a fatigue or setup diagnosis**.
  Missing measurements remain missing; unassessed sets do not acquire assessment
  highlights. See `workout-summary-contract.md`.
- **`SessionCore` / `CalibrationCore`** — the state machines that drive a whole workout and
  the initial "what tier are you?" assessment.
- **`REF` / `refPose` / `drawRef`** — the demo stick figures. Hand-authored keyframes, the
  interpolation between them, and the drawing.

> **A naming trap.** `SessionCore` (engine) and the shell's section 8 "SESSION ENGINE" are
> different things. The `*Core` classes decide *what happens*; the shell sections wire that
> to the DOM. If you're looking for logic, you want the `Core`.

---

## 5 · The one architectural idea: pure engine, thin shell

The engine never touches the screen. Instead it **returns a list of effects** — plain data
describing what should happen:

```js
{t:"say", key:"sag", pri:2}    {t:"bigTime", secs:23.4}    {t:"scoreFill", pct:71}
```

Each carries a `t` (the type) and whatever fields that type needs — `say` takes a dialogue
key plus priority and cooldown, `bigTime` takes seconds, `scoreFill` takes a percentage.
Types include `say`, `banner`, `bigReps`, `pop`, `tip` and `telem`. A single
shell function, `applyFx`, is a switch statement that replays each one onto the DOM.

**Why this is worth the ceremony:**

- **The engine is testable in Node.** No browser, no screen, no camera. `verify.mjs` imports
  it and replays 1,896 recorded cases in about a second.
- **The engine is portable.** Swift can implement the same logic and prove it identical,
  because "identical" means *emits the same effects for the same input*.
- **Judgement stays outside the shell.** `applyFx` applies the ordered effects, while
  platform adapters own asynchronous camera, voice and import state. Those adapters
  can still have bugs: explicit ownership and browser regressions are essential.
- **It is deterministic.** Same frames in, same effects out, every time. That is what makes
  recorded vectors a viable specification at all.

The house rule that protects it: *keep judgement in the engine; keep the shell too thin to
hide a bug.* Display optimisations belong in the shell; exercise decisions do not.
Platform state and resource ownership need independent lifecycle tests.

### Runtime ownership and passive rendering

Each camera generation owns its scheduled animation and all acquired streams,
including both streams during a pending switch. End releases them immediately;
late callbacks cannot join another workout. Optional wake-lock requests coalesce
and release obsolete grants. Diagnostics use both a Clear epoch and per-import
identity, guarding success, failure and input cleanup.

`loopBody` converts each detected pose once and shares it with drawing and the core.
It does not lower inference cadence or reuse a previous observation. Paused and
explicit follow-along intervals retain their existing no-inference/null contracts.

Passive text/HTML writes use `setText`/`setHTML`; visibility writes use `setHidden`.
Unchanged values avoid DOM work, but changes are never time-throttled. Text writes
invalidate the cached HTML for that owned node. The dial keeps segment references
until its target changes; continuous hold progress remains continuous. Speech,
logs, measurements and controls are not coalesced or dropped with display updates.

`DiagnosticBuffer` accounts bytes incrementally. Appends without pressure or a new
flag do not copy/scan retained history. Retroactive flag protection and eviction
still scan as needed; speculative changes commit only after all budgets fit.
This is a bounded transactional buffer, not an unbounded queue or a guarantee of
constant-time work under eviction. The 4 MiB limit measures serialized exports,
not JavaScript heap use.

---

## 6 · Content is data, not code

Adding a movement means adding a **declaration**, never adding logic. `content-v4.8.json`
holds five keys — `tiers`, `movements`, `plans`, `dialogue`, `ref` — and is the same content
the HTML build carries inline.

This buys something specific: because a metric spec *names its joints*, several features are
**derived rather than authored**.

- **Which joints must be in frame** (`neededJoints`) — read off the targets.
- **Which body parts to tint** when a fault fires (`tintSegs`) — an `angle` metric lights the
  two limbs meeting at the vertex, because that is literally what it measures.

Nobody maintains a separate "which limbs to highlight for a plank" table, so nobody can
forget to update one. That is the whole argument for content-as-data, in one example.

---

## 7 · The computing principles, and where each lives

`concepts-deep-dive.md` teaches these from zero. This table is the index: which idea, where
it lives, and what it is protecting against.

| Principle | Where | What breaks without it |
|---|---|---|
| **Trigonometry / dot products** | `angleAt` | No angles at all |
| **Exponential moving average** | `Evaluator.smooth` | Jitter — the model's output shakes several degrees frame to frame |
| **Frame-rate independence** | `emaAlpha` | Filters converge twice as fast at 60fps as at 30, so tuning done on a laptop is wrong on a phone. Shipped as a real bug |
| **Hysteresis** (two thresholds) | `Rep`, tint severity | A value sitting on a boundary strobes between states every frame |
| **Debouncing / state machines** | `Rep.update` | Reps double-count or never count |
| **Weighted averages** | the form score | One target dominating, or dividing by zero when every target has `w:0` |
| **Budgets under constraint** | `Evaluator.raised` | The coach nags. A beginner needs one thing to fix, not five |
| **Pure functions & side effects** | the engine/shell seam | Nothing is testable |
| **Determinism** | throughout | Recorded vectors stop being a specification |
| **Coordinate spaces** | `readMetric`'s `A`, `camToIso`, `refFit` | Angles that change with phone orientation; demos drawn stretched |

A few worth pulling out because they are *product* decisions wearing engineering clothes:

**Only correct what you can measure; teach what you cannot.** A single camera cannot see
knee valgus in a squat. So the app does not guess — it teaches that cue in the instructions
and stays silent during the set. `cat-cow` is marked `guided`: it judges nothing at all.

**Never say something you can't support.** If a joint isn't visible, or the viewing angle
makes a reading unreliable, the cue is suppressed *and the suppression is logged*. The log
matters — it is how you find out the coach has gone quiet for a bad reason.

**A rep that doesn't count must be explained.** Too fast gets "slower". Too shallow gets
"deeper". Silence reads as a broken counter, and a broken counter reads as a broken product.

**Don't ask the user what the camera can see.** "Stand 2 metres back" was replaced by
measuring the bounding box. The machine can see; asking is an admission that it isn't
looking.

---

## 8 · How it is tested

There is a **recorded specification**, plus independent unit, property, lifecycle,
browser, audio and infrastructure tests in the shared `testing/` loop.

`conformance-vectors.json` holds 1,896 cases captured from a known-good build: inputs and the
outputs they produced. Four harnesses cover the recorded specification and the derived
invariants that cannot be expressed as frame timelines.

| Harness | Checks | What it proves |
|---|---|---|
| `verify.mjs` | 4,127 | The engine still behaves exactly as recorded |
| `verify-mutations.mjs` | 8 mutations | That the demo checks *still bite* — it breaks demos on purpose and confirms failure |
| `verify-draw.mjs` | 250 | The demo figures are drawn in the proportions they were authored in |
| `verify-skip.mjs` | 26 | A skipped phase is not attempted (`score:null`), never scored zero; calibration keeps the hold |

```bash
node verify.mjs form-coach-v4.11.html
node verify-mutations.mjs form-coach-v4.11.html
node verify-draw.mjs form-coach-v4.11.html
node verify-skip.mjs form-coach-v4.11.html   # all four must exit 0
```

**The rule that matters: fix the build, never the vectors.** A failing vector means behaviour
changed. If the change was intended, you regenerate the vectors deliberately and say so in
the commit. Editing a vector to make a test pass destroys the only specification there is.

**Why `verify-mutations.mjs` exists** is the best lesson in the repo. The check "every demo
must pass the exercise it demonstrates" was real once, lived in a tool called `gen-refs.mjs`,
and was lost when a sandbox reset. Three documents went on *claiming* the coverage while
nothing ran it, and two bugs walked straight through the gap. So now the test has a test.
**An assertion nobody has watched fail is an assumption.**

**The honest gap:** substantial automated shell coverage uses substituted camera
streams and recognizers, desktop/narrow Chromium and synthetic poses. It does not
validate physical iOS/Android lifecycle, real-body/clothing recognition or beginner
comprehension. Real recorded-clip audio is tested separately; native TTS waveforms
and hardware speakers remain gaps. Missing human recordings stay blocked.
`refGates` and `verify-draw` prove gate/proportion consistency, not that a demo reads
clearly to a beginner. See `testing/README.md` for the exact mode boundaries.

---

## 9 · A worked example of a bug, because it explains the architecture

Bug #43, fixed recently, is the clearest illustration of why coordinate spaces get their own
row in the table above.

The demo stick figures are authored **isotropically** — x and y in the same units, so a thigh
measures the same number whether it points sideways or downwards. The drawing code mapped
them to the screen with `x * width, y * height` — which is the *anisotropic* convention
MediaPipe uses, and the exact distortion `readMetric` exists to undo.

Result: every demo was stretched by the canvas shape. 1.41× wider than it should be in the
demo box, 1.78× in the ghost overlay. The tell was the head — its size derives from the drawn
torso, so the same rig drew a head 1.78× bigger in a lying demo than a standing one, and
nobody read that as a bug because a stick figure has no obvious right size.

Worse: the **ghost** exists to be superimposed on your body, and the live skeleton beside it
was drawn undistorted. The two were related by no single scale at all — so a *correct* pose
could never line up with the shape it was being asked to copy, no matter where the person
stood.

The lesson is structural, not arithmetic: **the check that reads the numbers cannot see the
picture.** `refGates` passed clean throughout and was right to — it verifies authored
coordinates, and those were never wrong. The fix converts at the boundary in both directions
(`camToIso` in, `refFit` out) so there is one space, and `verify-draw.mjs` now holds that line.

---

## 10 · Moving to Swift

### What is being ported

The core engine lives in `swift/FormCoachEngine`. Its engine target contains:

| File | Mirrors |
|---|---|
| `Geometry.swift` | `angleAt`, `readMetric`, aspect correction |
| `Scoring.swift` | `scoreTarget`, `cueFor` |
| `Filters.swift` | `emaAlpha` — frame-rate independence |
| `RepCounter.swift` | `class Rep` |
| `Evaluator.swift` | `class Evaluator` and shared movement-evidence contracts |
| `PlanExpansion.swift` | `expandPlanSteps` |
| `ClipResolver.swift` | voice clip lookup |
| `ContentModels.swift` | `Codable` mirrors of the content schemas |
| `Content.swift` | decodes a `ContentPack` from a JSON file |
| `PoseFrame.swift` | the frame/joint structures |

The package additionally contains `FormCoachSummary`, `FormCoachInteraction` and
the explicit local-review CLI. Those targets constrain optional on-device model
selection and local commands; they are not a completed native workout application.
SessionCore/CalibrationCore and the camera/UI lifecycle are still unported.
Content stays in shared JSON, decoded at launch; drawing remains platform-specific.

> **Stale naming, worth knowing before it confuses you.** `ContentModels.swift` and
> `PORTING.md` still say `content-v4.7.json`. The tests actually read **`content-v4.8.json`
> from the repo root**. Believe the code, not the comment.

**One canonical copy of everything.** The vectors and content used to be *copied* into the
test bundle. The copy went stale — root's content was corrected after beginner test 01 and
the copy wasn't — and `swift test` reported 19 failures describing a divergence that did not
exist. Now the test file walks up five directories to the repo root and reads the very same
files `verify.mjs` reads. There is nothing left to keep in sync, which is a better guarantee
than remembering to sync it. Missing fixtures `fatalError` by name, because a missing fixture
must never look like a pass.

### What changes

| | Browser | Swift / iOS |
|---|---|---|
| Pose model | MediaPipe via CDN, WASM | MediaPipe iOS, or Vision's `VNDetectHumanBodyPose` |
| Voice | `<audio>` elements | `AVAudioPlayer` / `AVAudioEngine` |
| Rendering | Canvas 2D | SwiftUI / Core Graphics |
| Camera | `getUserMedia` | `AVCaptureSession` |
| Types | JavaScript's implicit conversions | Static types, `Optional`, real `Int` vs `Double` |
| Content | Inline JS objects | `Codable` structs from JSON |

The shell is rewritten from scratch, because a shell is platform-specific by definition. That
is precisely why it was kept thin.

### What must NOT change

**Rule one of this repo: never change behaviour in Swift first.** Change the HTML → regenerate
the vectors → make Swift pass. Two implementations quietly drifting apart is the failure mode
that kills ports, and it is easy to do accidentally: you fix something in Swift because it is
obviously right, and now the browser is wrong and nothing tells you.

`swift test` consumes **the same root conformance vectors** plus shared evidence,
clip, summary, choice and command cases. Deterministic tests and stubbed lifecycle
checks are distinct from the optional real-model smoke tests. A green result proves
the cases executed, not a completed port or physical-phone behavior.

### Things that will bite

- **Floating point.** JS numbers are all `Double`. Swift will make you choose, and an `Int`
  where a `Double` belonged is a silent divergence. The vectors carry explicit tolerances in
  `meta.tolerances` for exactly this reason, and both harnesses read them from there — they
  used to be hardcoded separately and drifted.
- **Optionals.** `readMetric` returning `null` for "unreadable" becomes `Double?`, and Swift
  will force you to handle every case. This is an improvement, but it surfaces places where
  the JS was quietly doing something on `undefined`.
- **Frame timing.** `requestAnimationFrame` gives ~60fps; `AVCaptureSession` gives whatever
  the device thermals allow. The `dt`-normalised filters exist so this doesn't matter — but
  only as long as `dt` is passed honestly rather than assumed.
- **Fail loudly.** Swift's `try?` is exactly as dangerous as swallowing an exception in the
  browser was. A bug once hid for months behind `requestAnimationFrame` surviving its own
  exceptions. Do not repeat it in a new language.

### When native application integration starts

Engine and optional coaching packages already exist. A complete native workout
shell does not. The beginner-validation gate in `swift-port.md` remains important:
porting an unvalidated interaction can build the same wrong thing twice while
conformance proves only that the implementations agree.

---

## Where to go next

| You want | Read |
|---|---|
| The theory, from zero | `concepts-deep-dive.md` |
| The precise spec | `system-reference.md` |
| Why the UI looks like that | `interface-principles.md` |
| Every bug and its lesson | `engineering-log.md` |
| The port plan and its gate | `swift-port.md` |
| What to actually do next | `next-steps-guide.md` |
| Where the project stands | `project-status.md` — it wins over everything, including this |
