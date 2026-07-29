# Form Coach — how the system is built

**Who this is for.** Someone who wants the whole shape of the system in their head before
going near a line of it. No prior knowledge assumed. Where a concept needs teaching from
zero — what a dot product is, what a neural network actually does — this guide names it and
points at `concepts-deep-dive.md` rather than re-teaching it badly.

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
   confidence. This is the only machine learning in the product, and we didn't train it.
3. **Engine** — pure arithmetic. Takes the points, measures angles, decides what's wrong,
   decides whether to mention it. Knows nothing about screens.
4. **Shell** — puts things on the screen and plays audio. Knows nothing about exercise.

The line between 3 and 4 is the most important idea in the codebase. §5 of this guide is
entirely about it.

---

## 3 · A tour of the repo

```
form-coach-v4.9.html      the entire app — engine and shell, one file
content-v4.8.json         all movements/plans/tiers/dialogue, as data
conformance-vectors.json  1,893 recorded cases: the executable specification
verify.mjs                replays the vectors against the build
verify-mutations.mjs      breaks demos on purpose, checks the tests notice
verify-draw.mjs           checks the demo drawings are drawn correctly
swift/                    the iOS port (a Swift package, engine only)
voice/                    rendered coach audio — 1,478 clips across three
                          personas plus spoken numbers, indexed by manifest.json
voice-render-kit/         the ElevenLabs tooling that produced them
docs/                     this vault
```

### Why one HTML file?

It looks eccentric. It is deliberate. A single file has no build step, no bundler, no
`node_modules`, no version skew between what you tested and what you shipped. You open it in
a browser and that is the product. For a solo project whose next milestone is *watching a
beginner use it*, the ability to change one line and refresh is worth more than module
hygiene.

The cost is real: 3,752 lines in one file, and your editor's outline view is the only
navigation. That cost is paid down by the numbered section banners described next.

### The two halves of that file

The file has a hard internal seam at `const VERSION`:

| | Lines | What lives there |
|---|---|---|
| **Engine** | ~505–2545 | Content declarations, geometry, scoring, evaluator, rep counter, session logic |
| **Shell** | ~2545–3750 | Voice playback, DOM updates, screens, camera, the animation loop |

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
- **`sessionInsights`** — turns *when* faults happened into advice. Sag at 22 seconds of a
  30-second plank is fatigue: hold shorter sets. Sag at 2 seconds is technique: fix the
  setup. Same fault, same count, opposite advice. It is the most trainer-like thing in the
  product.
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
There are 23 types in all (`say`, `banner`, `bigReps`, `pop`, `tip`, `telem`…). A single
shell function, `applyFx`, is a switch statement that replays each one onto the DOM.

**Why this is worth the ceremony:**

- **The engine is testable in Node.** No browser, no screen, no camera. `verify.mjs` imports
  it and replays 1,893 recorded cases in about a second.
- **The engine is portable.** Swift can implement the same logic and prove it identical,
  because "identical" means *emits the same effects for the same input*.
- **The shell is too thin to hide a bug.** If `applyFx` is only ever a switch statement, there
  is nowhere for judgement to accumulate in the UI layer.
- **It is deterministic.** Same frames in, same effects out, every time. That is what makes
  recorded vectors a viable specification at all.

The house rule that protects it: *keep judgement in the engine; keep the shell too thin to
hide a bug.* Every time something clever ends up in `applyFx`, it becomes untestable.

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

There are no unit tests in the usual sense. There is a **recorded specification**.

`conformance-vectors.json` holds 1,893 cases captured from a known-good build: inputs and the
outputs they produced. Three harnesses replay them.

| Harness | Checks | What it proves |
|---|---|---|
| `verify.mjs` | 4,071 | The engine still behaves exactly as recorded |
| `verify-mutations.mjs` | 8 mutations | That the demo checks *still bite* — it breaks demos on purpose and confirms failure |
| `verify-draw.mjs` | 250 | The demo figures are drawn in the proportions they were authored in |

```bash
node verify.mjs form-coach-v4.9.html        # must exit 0
```

**The rule that matters: fix the build, never the vectors.** A failing vector means behaviour
changed. If the change was intended, you regenerate the vectors deliberately and say so in
the commit. Editing a vector to make a test pass destroys the only specification there is.

**Why `verify-mutations.mjs` exists** is the best lesson in the repo. The check "every demo
must pass the exercise it demonstrates" was real once, lived in a tool called `gen-refs.mjs`,
and was lost when a sandbox reset. Three documents went on *claiming* the coverage while
nothing ran it, and two bugs walked straight through the gap. So now the test has a test.
**An assertion nobody has watched fail is an assumption.**

**The honest gap:** the UI shell has almost no automated coverage. A manual smoke pass is
its only test. `refGates` and `verify-draw` between them prove a demo passes its gates and is
drawn undistorted — neither can tell you it *reads* as the movement. Only a person looking
can do that.

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

**The engine only.** `swift/FormCoachEngine` is a Swift package of ten source files, ~795
lines:

| File | Mirrors |
|---|---|
| `Geometry.swift` | `angleAt`, `readMetric`, aspect correction |
| `Scoring.swift` | `scoreTarget`, `cueFor` |
| `Filters.swift` | `emaAlpha` — frame-rate independence |
| `RepCounter.swift` | `class Rep` |
| `Evaluator.swift` | `class Evaluator` — the largest, 368 lines |
| `PlanExpansion.swift` | `expandPlanSteps` |
| `ClipResolver.swift` | voice clip lookup |
| `ContentModels.swift` | `Codable` mirrors of the content schemas |
| `Content.swift` | decodes a `ContentPack` from a JSON file |
| `PoseFrame.swift` | the frame/joint structures |

It is *smaller* than the browser engine because it carries no content — that stays in JSON,
decoded at launch — and no drawing.

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

`swift test` runs 15 conformance tests against **the same `conformance-vectors.json`** the
browser harness uses. Green means the Swift engine is behaviourally identical, not merely
plausible.

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

### When the port starts

Not yet, and deliberately. The gate is in `swift-port.md`: it needs two beginner test
sessions first, because porting an unvalidated product means building the same wrong thing
twice, in two languages, with a conformance suite guaranteeing they stay equally wrong.

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
