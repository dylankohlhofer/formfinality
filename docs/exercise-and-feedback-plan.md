# Exercise expansion, framing requirements, and the debrief

Three pieces: what the camera actually needs to see per movement, what exercises are
worth adding, and what to do about the end-of-session feedback.

---

## Part 1 · Critical body parts — the theory tested

Computed from the shipped v4.10 engine, `x` = read by a judging target:

```
movement         ear sho elb wri hip kne ank hee toe
plank              x   x   x   ·   x   ·   x   ·   ·
knee-plank         ·   x   ·   ·   x   x   ·   ·   ·
side-plank         ·   x   ·   ·   x   ·   x   ·   ·
crunch             x   x   ·   ·   x   x   ·   ·   ·
squat              ·   x   ·   ·   x   x   x   ·   ·
wall-sit           ·   x   ·   ·   x   ·   ·   ·   ·
push-up            ·   x   x   x   x   ·   x   ·   ·
knee-push-up       ·   x   x   x   x   x   ·   ·   ·
leg-raise          ·   x   ·   ·   x   x   x   ·   ·
```

**Three results:**

**Only shoulder and hip are universal.** Every movement reads them; nothing else is
read by more than a handful.

**`heel` and `toe` are read by no judging target in the entire library.** They appear
in exactly one *position* gate (`leg-raise.feetUp`) and nowhere else. They are drawn
on every frame of every movement, and they widen the framing box, while contributing
nothing to any score.

**Your squat observation is confirmed and the diagnosis holds.** Squat reads
`ankle, hip, knee, shoulder` — no head, no heel, no toe. So the framing *gate* was
never demanding the head. What you saw was the **renderer**: MediaPipe extrapolates
landmarks past the frame edge and reports them with low visibility, and the skeleton
drew them anyway. A predicted head, not a required one.

### What to do

**Make the requirement explicit rather than derived.** Right now `neededJoints`
infers requirements from which targets read which joints. That's elegant but it
couples two things that should be separate: *what we measure* and *what we must see*.
Add an explicit `requires: [...]` per movement, defaulting to the derived set, so a
movement can say "I need shoulder→ankle visible" independently of its targets.

**Then three changes fall out:**

| Change | Effect |
|---|---|
| Don't draw joints below the visibility threshold | Kills the phantom half-skeleton |
| Exclude undrawn joints from the framing box | Fixes the "fill" reading on cropped bodies |
| Never require `heel`/`toe` for framing | Removes the most-cropped joints from the equation entirely |

**On planks and push-ups specifically:** you asked to stop looking for feet, but
`hipAlign` measures the hip's deviation from the **shoulder→ankle line** — the ankle
is the far end of the measurement, not incidental. Two honest options: fall back to
shoulder→knee when the ankle is unavailable (as `knee-plank` already does), with
wider tolerance to reflect the shorter lever; or state the requirement in the teach
line — *"I need to see from your shoulders to your ankles for this one."*

---

## Part 2 · Exercise expansion candidates

Filtered by what a **single side-on camera can actually judge**. It reads sagittal
angles (knee, hip, elbow, spine) and body-line deviations. It cannot read rotation
about the long axis or anything separating in the frontal plane.

### PUSH — currently 3

| Candidate | Verdict | Notes |
|---|---|---|
| **Incline push-up** (hands on sofa) | ✅ **High priority** | The missing rung between wall and knee push-up. Same metrics, new difficulty |
| **Decline push-up** (feet raised) | ✅ | Same metrics again — nearly free to add |
| **Pike push-up** | ✅ | Hip high, elbow bend, head lowers. Genuine shoulder work, clearly measurable |
| **Plank up-down** | ✅ | Elbow cycling from a plank. Good push/core hybrid |
| **Tricep dip** (chair) | ⚠️ | Very measurable, but needs a chair |
| Diamond / wide push-up | ❌ | Hand spacing is a frontal-plane distinction — invisible side-on |

### LEGS — currently 4

| Candidate | Verdict | Notes |
|---|---|---|
| **Reverse lunge** | ✅ **High priority** | The biggest gap in the library. Both knee angles and torso lean read cleanly side-on |
| **Split squat** (static) | ✅ | Easier to judge than a lunge — no travel through the frame |
| **Good morning / hip hinge** | ✅ **High priority** | Teaches the hinge pattern, which nothing currently does. Hip angle with a flat back is exactly what the `line` metric is for |
| **Calf raise** | ✅ | Simple ankle-angle read. Good low-effort filler |
| **Single-leg glute bridge** | ✅ | Natural progression from the bridge you have |
| **Bulgarian split squat** | ⚠️ | Excellent movement, needs a sofa |
| Lateral / curtsy lunge | ❌ | Frontal plane and rotational |

### CORE — currently 11

| Candidate | Verdict | Notes |
|---|---|---|
| **Superman / back extension** | ✅ **High priority** | Posterior chain — the one thing the library has none of. This is `cobra` in fitness clothing, and it recovers most of what dropping Pull costs you |
| **Reverse crunch** | ✅ | Hip angle, knees to chest. Clean read |
| **Side plank hip dip** | ✅ | Natural progression from side plank |
| **Mountain climber** | ⚠️ | Measurable but fast — rep counting at speed needs care |
| Russian twist, bicycle crunch | ❌ | Rotational — needs a front view |

**Recommended first tranche (5):** incline push-up, pike push-up, reverse lunge,
hip hinge, superman. That fills every genuine gap — a push progression rung, shoulder
work, a lunge pattern, a hinge pattern, and posterior chain.

**A note on "targeted muscle groups":** with Pull dropped, be careful the naming
doesn't over-promise. *Push · Legs · Core* is accurate. Adding superman gives you
honest posterior-chain work inside Core without claiming a Pull day you can't
support.

---

## Part 3 · The debrief — and the AI question

**The honest diagnosis first: the debrief is weak because it doesn't use the data
you already have, not because it lacks a language model.** Every session already
logs per-movement scores, cue counts, rep timing, and a score trace at 0.2s
resolution. The debrief currently summarises almost none of it.

### What actually makes a debrief good

A good coach doesn't hand you a report. **They give you one thing to remember.**
Specificity beats completeness: *"your hips dropped in the last ten seconds of every
plank"* is worth more than a table of numbers, because it names a moment and implies
a fix.

### The genuine innovation is already computed

The score trace can distinguish **fatigue from technique breakdown**:

- Form declining *steadily* through a hold → fatigue. *"You held good form for 22
  seconds, then it drifted — that's your endurance, and it's the thing that improves
  fastest."*
- Form dropping *suddenly and staying down* → technique. *"Something changed about
  nine seconds in and didn't come back — worth watching that."*

**Most fitness apps cannot make that distinction at all.** You already can, and
you're not saying it.

### Three options for the summary

| Option | Verdict |
|---|---|
| **A · Rules-based, using logged data** | **Do this first.** One headline finding + per-movement detail. Days of work, no new dependencies, no architectural cost |
| **B · On-device LLM** (Apple Foundation Models, iOS 26+) | **The right ambitious version.** Free, private, no server, no per-use cost — it preserves every architectural promise. iOS-only and post-port |
| **C · Cloud LLM** | **Reject.** Needs a server to hold the key, adds per-session cost to a one-time-purchase product, and sends session data off-device. It trades the product's spine for a nicer paragraph |

**Option B is worth being excited about**, because it dissolves the usual objection:
an on-device model costs nothing per call, works offline, and never sees a network.
Feeding it *"plank 34s, form 71, hips dropped at 22s, 2 corrections; push-ups 8 reps,
3 rejected for tempo"* and asking for two sentences of encouragement is well within a
3B model's range.

**But do A first regardless** — it's the input B would need anyway. A language model
given generic input produces generic output; the work of deciding *what is worth
saying* is the same either way.

### Design sketch for A

Three layers, in the order a person cares about them:

1. **One headline.** The single most useful thing, chosen by rule: the biggest
   fatigue drop, the most-repeated correction, or a genuine improvement.
2. **Per movement, one line each.** *"Plank — 34s, form held to 22s then drifted."*
   Not a stat block; a sentence.
3. **One thing for next time.** Derived from the most frequent cue across the session.

And with persistence later, the highest-value line of all becomes available:
**"compared to last time."** That is the thing that makes a debrief worth reading
twice, and it needs no AI at all.
