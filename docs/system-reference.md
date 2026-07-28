# Form Coach — system reference

How the system actually works, at v4.9. Replaces `technical-documentation.md`,
`data-model-spec.md` and `ux-spec.md`, which were written before the pivot and for a
different audience. Plain language throughout; if you want the computer-science
foundations underneath, read `concepts-deep-dive.md`.

---

## The product in one paragraph

A camera-based coach for people who don't know how to exercise, at home. The phone watches
you through its own camera, tells you what to fix, and never sends video anywhere. Pose
estimation runs on-device via MediaPipe, so there are no running costs and the app can be a
one-time £4.99 purchase rather than a subscription.

**The founding principle, which everything else follows from:**
*Only correct what you can measure. Teach what you cannot.*

---

## The pipeline, one frame at a time

```
1  CAMERA        getUserMedia → a <video> element
2  FRAME         30–60 per second
3  INFERENCE     BlazePose → 33 landmarks + confidences        (~10 ms)
4  BUILD FRAME   landmarks → {left, right, cam, conf, aspect, sideness}
5  METRICS       readMetric per target — angles, line deviations
6  SMOOTHING     dt-normalised EMA per target
7  SCORING       scoreTarget → 0–100 per target
8  GATES         position gates → arming?   quality gates → clock running?
9  VIEW          sideness → block cues, or suppress depth-dependent ones
10 FRAMING       bounding box → framed / far / clipped
11 REPS          hysteresis + priming + tempo floor + short-range
12 SELECTION     worst offender, under cue budget and cooldown
13 EFFECTS       emit a list of tagged objects
14 SHELL         replay → screen, speech, telemetry
```

**Steps 5–13 are pure and headlessly testable. Steps 1–4 and 14 are the impure edges.**
That line is exactly where the Swift port cuts — not a coincidence, it's why the
architecture is shaped this way.

---

## Content is data, not code

All 21 movements, 5 plans, 3 tiers, 3 personas and 84 dialogue keys are **declarations**.
Adding a movement means adding data; no logic changes. The whole content set exports to JSON,
so the Swift port hand-transcribes nothing.

### A movement

```js
"plank": {
  name: "Plank", kind: "hold", tiers: ["learning","building","strong"],
  regression: "knee-plank",
  targets: [ … ],
  reps: { … }        // only for kind:"reps"
}
```

`kind` is one of:
- **`hold`** — a shape maintained against a clock (plank, side plank, wall sit)
- **`reps`** — a repeated movement with a driver metric (squat, push-up, crunch)
- **`guided`** — makes *no* judgements at all (`cat-cow`). The reference standard for
  intellectual honesty: per-segment spinal articulation can't be seen from one camera, so
  nothing is claimed.

### A target

```js
{ id:"hipAlign", m:{k:"line", of:"hip", from:"shoulder", to:"ankle"},
  ideal:0, tol:0.035, range:0.11, w:2, above:"pike", below:"sag" }
```

**Metric kinds** — three, and each names the joints it reads, which is why the form tint and
the framing check can be *derived* rather than authored:

| Kind | Reads | Measures |
|---|---|---|
| `angle` | vertex `v`, arms `a` and `c` | the angle at a joint |
| `line` | `of` relative to `from`→`to` | signed deviation from a straight line |
| `vert` | `a`→`b` | how far a segment is from vertical |

**Target roles** — a target does exactly one of three jobs:

| Role | Flag | Effect |
|---|---|---|
| Position gate | `pos: true` | Decides whether the set may *arm* |
| Quality gate | `gate: true` | Decides whether the hold clock *runs* |
| Graded | `w: <n>` | Contributes to the form score, weighted |

`w: 0` means "measure but don't grade" — used for rep drivers, where the instantaneous value
is about counting, not quality.

### Scoring

```
err = |value − ideal|
err ≤ tol            → 100        (the dead zone: good enough is good enough)
otherwise            → linear falloff to 0 across `range`
```

Three deliberate choices: a **dead zone** so the score doesn't twitch, **linear falloff** so
the coach never feels arbitrary, and **clamping at zero**. Piecewise linear is trivial to
reason about and predictable at the edges.

### Tiers

The primary axis. One multiplier set, applied consistently across all 21 movements.

| | Learning | Building | Strong |
|---|---|---|---|
| Tolerance × | 1.9 | 1.25 | 1.0 |
| Cue budget (distinct cues per set) | 1 | 2 | ∞ |
| Cue cooldown | 9 s | 6 s | 4 s |
| Effort scale | 0.55 | 1.0 | 1.5 |
| Rest scale | 1.6 | 1.0 | 0.7 |
| Set scale | 1 | 1 | 1.5 |
| Rep tempo floor × | 1 | 1 | 0.6 |
| Score shown | no | yes | yes |
| Regressions offered | yes | no | no |

**The ids (`learning`/`building`/`strong`) are frozen** — they name clip folders, vector
rows, CSV columns and dialogue keys. Labels are editable brand; ids are plumbing.

### Personas

Tone only, never behaviour: **Steady**, **Warm**, **Energy**. Each has its own wording *and*
its own recorded voice at every tier. (They once shared wording, which made them
indistinguishable in TTS — a real bug, fixed.)

---

## Key mechanisms

**Arming.** A set starts only when the person has held the position for 1.2 s *and* the
coach has stopped speaking. The clock never starts over the app's own voice.

**Rep counting.** Hysteresis (two thresholds with a gap) kills threshold chatter. **Priming**
requires a genuine rest position first, because a plank and a bridge lockout are
geometrically identical. A **tempo floor** (`minMs`, tier-scaled) rejects bounced reps —
and says why. **Short-range detection** catches an attempt that reached 40–99% and came back.
Both failure modes have a voice; a rep that vanishes silently reads as a broken app.

**Cue selection.** Sort failing targets by score, take the worst, respect the tier's cue
budget and cooldown. Silence is a feature — it gives someone time to actually attempt the
correction.

**View awareness.** `sideness` estimates how side-on the body is. Below 25° the coach stops
making claims and asks the person to turn; between 25–50° it suppresses depth-dependent cues
while keeping the ones that survive the angle. Suppressed decisions are *logged*, so the
telemetry shows what would have been said and why it wasn't.

**Framing.** A bounding box over the joints the movement actually *judges* (setup-gate joints
excluded — a crunch doesn't read your ankles). Returns `framed` / `far` / `clipped` with the
edge that's cut. **Clipped blocks arming**; far is a nudge only. This replaced asking users
to estimate metres — the camera can just look.

**Form tint.** Body parts needing work are coloured, derived from the same metric
declarations that drive scoring. Severity in three channels — hue, limb thickness, pulse
rate — because red/amber alone is invisible to roughly 1 in 12 men. Learning tier shows one
part, amber only, mirroring its one-cue budget.

**Frame-rate normalisation.** Every filter is expressed as a time constant and converted per
frame using actual elapsed time. Without this the same movement scored differently at 24 vs
90 fps (measured: 3.74× divergence).

---

## The effect stream

The cores emit a list of tagged objects; a thin shell replays them.

```js
{t:"say", key:"sag", pri:2}
{t:"bigTime", secs:12.4}
{t:"tint", segs:[…]}
```

Why it matters: the core is testable with zero browser, the shell is too thin to hide a bug,
effects are **data** so they can be recorded and asserted on, and the Swift port needs the
core while the shell is platform-specific.

---

## Voice

**Recorded clips, not TTS.** 1,351 clips across 3 personas × 3 tiers, resolved by key and
spliced with number clips (`"You held" + "twenty-three" + "seconds."`). `AudioBank` loads a
manifest, falls back to TTS only when a clip is genuinely missing, and cache-busts against
the manifest's timestamp so a re-render can't be defeated by browser caching.

Permanently TTS by necessity: personal-record lines (fully dynamic value), the session-end
summary (contains the user's name), and the developer recording tool.

---

## What the system deliberately cannot do

Stated because the honesty principle requires it:

- **Squat knee valgus** — the injury that matters most is a front-on measurement, invisible
  side-on. Taught up front instead of corrected.
- **Bird-dog hip rotation** — rotation about the spine's long axis; the limbs are visible,
  the hips are not.
- **Lumbar contact with the floor** (dead bug, hollow holds) — inferred from hip angle.
- **Per-segment spinal articulation** — why `cat-cow` is `guided`.
- **Left/right asymmetry under rotation** — `agg:"worst"` helps only when both sides show.

There is **no persistence**. Name, tier and persona reset on reload. History, streaks and
calendar are designed but unbuilt — see `backlog.md`.

---

## Testing

**4,023 vector checks**, all headless, 0 divergences; `swift test` passes 15/15 against the
same JSON. Unit (one function across every target × tier), property (the same movement scores
identically at 24/30/60/90 fps), integration (whole scenarios), regression (one per fixed bug).

**The honest gap:** the UI shell has zero automated coverage. 4,023 checks prove the core
emits the right effects, not that the screen replays them. That's why the desktop smoke test
is Phase 1 of `next-steps-guide.md`.

**Self-consistency is back, as `refGates` (176 checks).** This section once claimed the
category on the strength of a check inside `gen-refs.mjs` — which was lost, was never carried
into `verify.mjs`, and so credited coverage nothing ran while three demos drifted into
teaching poses the app refuses to start from (bugs #40, #41). It is now a real section:
every REF frame read through `Evaluator.read` at learning tier against the movement's own
gates, plus a folded-limb geometry floor and a rep-driver straddle check, with a small
exception table asserted in both directions so an exception that stops being needed fails as
one to delete. Verified by mutation, not by reading.

**What it still can't judge** is whether a demo *reads* as the movement. `glute-bridge`
frame 1 passed every gate for months while drawn rigidly rotated ~51°, its ramp pointing
downhill. That needs eyes.
