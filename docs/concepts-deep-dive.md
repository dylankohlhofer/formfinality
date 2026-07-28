# Form Coach — the concepts underneath

**What this is:** every computing and machine-learning idea your system is built from,
explained from zero, in the order the data actually flows. No prior knowledge assumed —
Part 1 starts with what a number in space means.

**How to read it:** one part per sitting. Each concept follows the same shape:

> **The idea** → **the maths, only where it earns its place** → **where it lives in your
> code** → **what went wrong when we got it wrong.**

That last one matters most. Every bug this project has hit was a fundamental principle
biting back, and a bug you've personally watched happen is worth ten pages of theory.

---

# Part 1 · Numbers in space

## 1.1 A point is two numbers

Your camera sees a rectangle. To say *where* something is inside that rectangle, you need
two numbers: how far across, and how far down.

```
(0,0) ┌─────────────────┐ (1,0)
      │                 │
      │      • (0.5, 0.3)
      │                 │
(0,1) └─────────────────┘ (1,1)
```

Two conventions worth burning in, because both bite people:

**We use 0→1, not pixels.** A shoulder at `x: 0.5` is halfway across the frame *whatever the
resolution*. This is called **normalising**, and it means the same code works on a 720p
laptop webcam and a 4K phone. Your `Joint` type is exactly this: `{x, y, c}`.

**y increases DOWNWARDS.** Screen coordinates inherit this from how old monitors drew
scanlines — top to bottom. So a hip *lower* in the frame has a *bigger* y. Every time you
read a threshold in the content and it feels upside down, this is why.

## 1.2 A vector is a point used as an arrow

You said you don't know what a vector is. Here it is, and it's genuinely this simple:

**A vector is a list of numbers.** That's the whole definition. `[3, 4]` is a vector.

What makes it *useful* is that we agree to interpret it as **a direction and a distance**
rather than a location. The point `(3, 4)` means *"here"*. The vector `[3, 4]` means
*"3 across and 4 down from wherever you currently are"* — an arrow, not a pin.

**Why the distinction earns its keep:** joint positions are points, but everything you want
to *know* is about relationships between them. "Is the arm straight?" isn't a question about
where the elbow is; it's about the direction from elbow to shoulder versus the direction
from elbow to wrist. Directions are vectors.

**Making a vector from two points — subtract:**

```
vector from A to B = [B.x - A.x, B.y - A.y]
```

Your `angleAt` function does exactly this in its first line:

```js
const v1 = {x: a.x - b.x, y: a.y - b.y};   // from vertex b, toward a
const v2 = {x: c.x - b.x, y: c.y - b.y};   // from vertex b, toward c
```

Two arrows, both starting at the joint you care about.

**Length of a vector — Pythagoras:**

```
length([3, 4]) = √(3² + 4²) = √25 = 5
```

In code that's `Math.hypot(x, y)`. It's Pythagoras' theorem doing its only job.

## 1.3 The dot product, and why it gives you angles

This is the one piece of real maths in your geometry layer, so it's worth understanding
rather than trusting.

**The operation:** multiply matching components, add the results.

```
[a, b] · [c, d] = a×c + b×d
```

**What it means:** the dot product measures **how much two vectors agree**.

- Pointing the same way → large positive number
- At right angles → exactly **zero**
- Pointing opposite ways → large negative number

That zero-at-right-angles property is not a coincidence; it's the definition doing its work,
and it's why the dot product turns up everywhere in graphics and physics.

**Getting the actual angle.** The dot product also equals:

```
v1 · v2 = |v1| × |v2| × cos(θ)
```

where `|v|` is length and `θ` is the angle between them. Rearranged:

```
cos(θ) = (v1 · v2) / (|v1| × |v2|)
θ = arccos( that )
```

Dividing by the lengths is called **normalising** — it strips out "how long are these
arrows" and leaves only "how much do they agree", which is what an angle is. This is why
your angle measurements don't care whether someone is close to the camera or far away.

**Your actual code, now fully readable:**

```js
const dot = v1.x*v2.x + v1.y*v2.y;                    // agreement
const mag = Math.hypot(v1.x,v1.y) * Math.hypot(v2.x,v2.y);   // lengths multiplied
if (mag < 1e-9) return null;                          // degenerate: joints coincide
return Math.acos(clamp(dot/mag, -1, 1)) * 180/Math.PI;
```

Two defensive details worth noticing, because both are real-world lessons:

**The `1e-9` guard.** If two landmarks land on exactly the same spot, a vector has zero
length, and you'd divide by zero — which in JavaScript gives `NaN` ("not a number"), a value
that silently poisons every calculation it touches. Returning `null` instead makes the
failure honest and visible.

**The clamp to [-1, 1].** `arccos` is only defined on that range. Floating-point arithmetic
can produce `1.0000000000000002`, and `arccos` of that is `NaN`. Clamping costs nothing and
prevents a whole class of mystery bug.

**Radians vs degrees.** Computers do trigonometry in **radians** (a full circle is 2π ≈
6.28). Humans think in degrees (360). `× 180/Math.PI` converts. Your content is written in
degrees because *you* have to read it.

## 1.4 Projection: what a flat image throws away

A camera takes a 3D world and flattens it to 2D. That flattening is called **projection**,
and it is **lossy** — information is destroyed and cannot be recovered.

Specifically: **motion along the camera's viewing direction becomes invisible.**

This isn't a limitation of your code, your model, or your phone. It's geometry. It is the
single most important constraint in your entire product, and it's the reason for the
principle you landed on independently:

> **Only correct what you can measure. Teach what you cannot.**

Concretely, from your honesty audit:
- Side-on, a squat's **depth** is beautifully visible (it happens across the image)
- Side-on, a squat's **knee valgus** — knees caving inward — is nearly invisible (it happens
  along the viewing direction)

Two consequences you've already built:

**`sideness`** estimates how side-on the body is. Below 25° the coach stops making claims and
asks the person to turn; between 25° and 50° it suppresses depth-dependent cues while
keeping the ones that survive the angle. That's the engine reasoning about its own
projection loss.

**`cat-cow` is `guided`** — it makes no judgements at all, because per-segment spinal
articulation cannot be seen from one camera. That movement is the reference standard for
intellectual honesty in the whole system.

## 1.5 Aspect ratio: the bug that geometry made inevitable

Here's where normalised coordinates bite back, and it's worth walking through because it's
subtle and you shipped it.

Normalising x and y **independently** to 0→1 means one unit of x and one unit of y are *not
the same physical distance* unless the frame is square.

On a 1920×1080 frame (16:9), moving 0.1 in x is 192 pixels; moving 0.1 in y is 108 pixels.
So a 45° angle in the real world measures as something else entirely in normalised space.
The image is stretched, and every angle is stretched with it.

**The fix**, in your `readMetric`:

```js
const A = frame.aspect;                 // image width / height
angleAt({x: b.x*A, y: b.y}, {x: a.x*A, y: a.y}, {x: c.x*A, y: c.y})
```

Multiplying x by the aspect ratio restores physical proportions before any angle is
computed. Same shape, same measurement, portrait or landscape.

**The lesson:** normalisation is a convenience, and every convenience quietly encodes an
assumption. This one assumed square pixels in a square frame.

## 1.6 Point-to-line distance: the `line` metric

Your other geometric measure answers "is this joint sitting on the line between these two
other joints?" — which is exactly "is the body straight?"

The method: figure out how far along the shoulder→ankle line the hip sits horizontally
(call that fraction `u`), work out where the hip *would* be at that fraction if the body
were perfectly straight, and subtract.

```js
const u = (o.x - f.x) / (t.x - f.x);          // how far along, 0→1
return o.y - (f.y + u*(t.y - f.y));           // actual y minus expected y
```

The result is **signed**, which is why it can distinguish sag from pike where an angle
cannot — positive one way, negative the other. That's why `hipAlign` can say two different
things and `bodyLine` (an angle) can only say "not straight".

**And the guard that mattered:**

```js
if (Math.abs(dx) < 0.05) return 0;
```

If the two reference joints are vertically stacked — shoulder directly above ankle, i.e. a
standing person — then `dx ≈ 0` and `u` explodes toward infinity. When I added grading to
`wall-push-up` I had to use an **angle** rather than a line for exactly this reason: a
standing body has no horizontal extent, so the line metric would have returned a constant 0
and silently graded everyone perfect.

---

# Part 2 · From light to landmarks

## 2.1 What a video frame actually is

A digital image is a grid of **pixels**, each storing brightness for red, green and blue —
typically 0–255 each, one byte apiece. A 1920×1080 frame is about 2 million pixels, ~6 MB
raw.

**Video is just many of these per second.** 30 fps means a new 6 MB grid every 33
milliseconds. Nothing in the image says "shoulder". It's a wall of numbers, and something
has to find meaning in it.

## 2.2 Why this needs machine learning

Could you write rules? "Skin-coloured pixels near the top are probably a head." People have
tried for decades. It fails immediately on: different skin tones, clothing, lighting,
backgrounds, occlusion, unusual poses, camera angles.

The reason is that the mapping from *pixels* to *"where is the shoulder"* is enormously
complicated and nobody can write it down. That is precisely the situation machine learning
exists for:

> **Instead of writing the rules, show the computer millions of examples and let it find a
> function that fits them.**

## 2.3 Neural networks, honestly

A neural network is a big mathematical function with adjustable numbers inside, called
**parameters** or **weights**.

**One neuron:** take several inputs, multiply each by a weight, add them up, add a
**bias**, then apply a simple non-linear squash (an **activation function**).

```
output = squash( w₁x₁ + w₂x₂ + … + b )
```

The multiply-and-add part is a **dot product** — the same operation from §1.3, doing a
completely different job. That's not a coincidence: "weighted combination of inputs" is one
of the most reusable ideas in all of computing.

**The squash matters enormously.** Without it, stacking layers achieves nothing —
a chain of linear operations collapses into a single linear operation, and you're back to
drawing straight lines. The non-linearity is what lets networks represent curves, corners
and conditions. The common choice, **ReLU**, is almost insultingly simple: `max(0, x)`.
Negative becomes zero, positive passes through.

**A network** is these neurons in layers: inputs → hidden layers → outputs. "Deep learning"
just means many layers.

**Training** is the interesting part:
1. Show it an image where you know the true joint positions (**labelled training data**)
2. It predicts; you measure how wrong it is (**loss function**)
3. Work out, for every single weight, which direction would reduce the error
   (**backpropagation** — the chain rule from calculus, applied at scale)
4. Nudge all the weights slightly that way (**gradient descent**)
5. Repeat millions of times

The result is a function that generalises to images it's never seen — *provided* they
resemble the training data. Which is exactly why your app should tell people not to wear
baggy trousers: loose fabric moving independently of the leg is unlike the training data,
so the estimate degrades. **That backlog item is an ML constraint wearing a UX costume.**

## 2.4 Convolution: the idea that makes vision work

A crucial detail: you can't just wire every pixel to every neuron. 2 million inputs × a
hidden layer of 1000 = 2 billion weights in the first layer alone. Untrainable and absurd.

**Convolutional Neural Networks (CNNs)** exploit two facts about images:

**Locality** — a shoulder is a *local* arrangement of pixels. You don't need the top-left
corner to identify something in the bottom-right.

**Translation invariance** — a shoulder looks like a shoulder wherever it appears. The same
detector should work everywhere.

So instead of per-pixel weights, you learn a small **kernel** — say 3×3 — and slide it
across the whole image, computing a dot product at every position. That's a
**convolution**. Nine weights, reused across two million pixels.

Stack these, and something remarkable emerges: early layers learn edges, later ones learn
corners and textures, later still learn body parts, and the deepest learn whole
configurations. Nobody programmed that hierarchy — it falls out of training.

## 2.5 How pose models output joint positions

Two approaches, and the distinction explains a real property of your system.

**Heatmap regression.** The network outputs, per joint, a grid where each cell holds "how
likely is this joint here". You take the peak. Accurate, and naturally gives you a
confidence value — but you need a full grid per joint, which is expensive.

**Direct regression.** The network just outputs numbers: x, y for each joint. Much faster,
usually slightly less accurate.

**BlazePose — what MediaPipe uses — is a hybrid**, and cleverly so: it trains *with* a
heatmap branch to get the accuracy benefit, then **throws that branch away for inference**
and keeps only the regression head. You pay the heatmap cost during training, once, and get
the speed at runtime, forever.

It also uses a **two-stage pipeline**:
1. A lightweight **detector** finds the person and a rough crop
2. A **landmark model** runs on that crop and produces the joints

And critically, on subsequent frames it **skips the detector** and reuses the previous
frame's region — because bodies don't teleport. This is called **tracking**, and it's most
of why real-time pose estimation is feasible on a phone at all.

Consequence you can observe: when tracking is lost (you leave the frame), recovery takes
noticeably longer than a normal frame, because the detector has to run again. Your `vis`
cue ("I can't see you") exists for exactly this window.

## 2.6 The 33 landmarks, confidence, and the z-coordinate

BlazePose emits 33 landmarks: face points, shoulders, elbows, wrists, hands, hips, knees,
ankles, heels, toes. Your engine names a subset — `shoulder`, `hip`, `knee`, `ankle`,
`heel`, `toe`, `ear`, `elbow`, `wrist` — because those are the ones your movements need.

**Confidence (`c` in your `Joint`)** is the model's own estimate of reliability, 0→1.
Your engine gates on it:

```js
if (frame.conf < 0.5) { out.ok = false; return out; }
```

This is a small idea with a big payoff: **a model that reports its own uncertainty lets you
decline to answer.** A coach that says "I can't see you properly" is infinitely better than
one that confidently corrects a shape it hasn't actually seen.

**The z-coordinate** deserves scepticism. BlazePose does emit depth, estimated via a
synthetic 3D human model (GHUM) during training. But it's *inferred from a single 2D image*,
not measured, so it's far less reliable than x and y.

Your architecture treats it appropriately: z feeds `sideness` — a coarse "how side-on is
this person" judgement — and nothing else. Coarse question, coarse-but-adequate signal. If
you ever tried to measure knee valgus in degrees from z, you'd be building on sand. This is
also the crux of the any-angle question in your backlog, and why that experiment needs a
hard validation gate (≤4°) before anything depends on it.

## 2.7 Why this runs on the phone at all

Three things make on-device inference practical, and they're worth knowing because they're
the technical foundation of your entire business model:

**Small models.** BlazePose Lite is a few megabytes. Compare a large language model at tens
of gigabytes.

**Quantisation.** Weights are stored at reduced precision — 8-bit integers instead of
32-bit floats. Four times smaller, substantially faster, negligible accuracy loss for this
task.

**Hardware acceleration.** Phones have GPUs and dedicated neural accelerators (Apple's
Neural Engine). MediaPipe dispatches to them automatically.

Net result: ~10 ms per frame on a modern phone, well inside a 33 ms budget at 30 fps.

**And this is why "zero running costs, £4.99 once" is possible.** Not a pricing trick — a
direct consequence of the inference happening on hardware the user already owns and paid
for. Your competitors' subscriptions largely fund servers you don't need.

---

# Part 3 · Taming a noisy signal

## 3.1 Every measurement is wrong

Point a pose model at a perfectly still person and the landmarks still jitter — a degree or
two, frame to frame. Sources: sensor noise, compression artefacts, lighting flicker, and
the model itself being a continuous function fed slightly different pixels each frame.

Left raw, this makes a coach unusable: the score flickers, cues fire and unfire, reps
double-count. Cleaning up noisy measurements is **signal processing**, and it's most of what
separates a demo from a product.

## 3.2 The exponential moving average

The workhorse. Each frame, move your stored estimate a fraction of the way toward the new
reading:

```js
estimate = estimate + α × (measurement − estimate)
```

`α` (alpha) between 0 and 1 controls responsiveness:
- `α = 1` → estimate *is* the measurement (no smoothing)
- `α = 0.35` → moves a third of the way each frame (your per-target default)
- `α = 0.1` → slow and stable (your form score)
- `α = 0.02` → glacial (your rep baseline drift)

It's called *exponential* because the influence of any old reading decays exponentially —
each frame multiplies its remaining weight by `(1−α)`. Every past measurement contributes
something, but recent ones dominate. Beautifully, it needs **one stored number** rather than
a history buffer, which is why it's everywhere in embedded and real-time systems.

**The engineering trade-off is unavoidable:** more smoothing = less noise but more lag. Your
score uses `α = 0.1` because a form score should feel stable; your target readings use 0.35
because a cue must arrive while the fault is still happening. *Late coaching is wrong
coaching.*

## 3.3 The frame-rate trap — a fundamental error we shipped

Here's the deepest lesson in this document.

The formula above advances **once per frame**. So the amount of smoothing depends on **how
many frames happen**, not how much *time* passes. At 60 fps you get twice as many updates
per second as at 30 fps — so the same filter converges twice as fast.

Your thresholds were tuned in a browser at a steady 30 fps. On a phone, frame rate varies
with device, thermal state and capture pipeline. Measured on the same physical movement,
the score filter read:

| | 24 fps | 30 fps | 60 fps | 90 fps |
|---|---|---|---|---|
| value 0.5 s into a 100→0 change | 28.2 | 20.6 | 4.2 | 0.9 |

The filter ran **3.74× faster at 90 fps than at 24 fps**. Every constant downstream — the
praise window, the early-stop threshold, cue timing — silently inherited that error.

**The fix — think in time, not frames.** Express the filter as a **time constant** and
convert per frame using the actual elapsed time `dt`:

```js
const REF_DT = 1/30;
emaAlpha(α, dt) = 1 − (1−α)^(dt / REF_DT)
```

Read it as: *"what single step is equivalent to `dt/REF_DT` steps of the old filter?"* At
exactly 30 fps it returns α unchanged — which is why every existing test and vector still
passed, proving it a pure generalisation rather than a behaviour change.

**The principle, and it applies far beyond this project:**

> **Anything that evolves over time should be a function of elapsed time, never of how many
> times your code happened to run.**

Related concept: **`dt` (delta time)** is the interval since the last frame, and it should
appear in every physics-like calculation. Your hold clock (`hold += dt`) was already correct;
the filters weren't.

A second-order version of the same bug appeared minutes later. The score trace sampled every
6 *frames* — twice as dense at 60 fps, skewing the fatigue-vs-technique classifier. Switching
to a clock check then drifted through **floating-point accumulation** (adding 1/30 repeatedly
never lands exactly on 0.2), giving 53 samples at 30 fps versus 58 at 60. The final fix
computes a **bucket index** — `floor(elapsed / 0.2)` — which is exact at any rate. Lesson:
*derive from an absolute quantity rather than accumulating increments.*

## 3.4 Hysteresis: two thresholds, not one

Counting reps by asking "is the hip angle above 162°?" fails immediately. When someone hovers
near the threshold, noise flips the answer every frame and you count twenty reps in a second.

**Hysteresis** uses two thresholds with a gap between them, plus a memory of which state
you're in:

```js
upAbove: 162,     // must exceed this to become "up"
downBelow: 140,   // must drop below this to become "down"
```

Between 140 and 162 nothing changes — you stay wherever you were. Noise would have to swing
22° to cause a false count. Your thermostat works the same way, for the same reason.

## 3.5 Debouncing, and the two ways a rep can fail

Hysteresis handles *noise*. It doesn't handle a person genuinely bouncing through
half-repetitions using momentum. That needs a **time** test — a **debounce**:

```js
minMs: 1200    // a rep completed faster than this isn't a controlled rep
```

This was declared in your content since v4 and **never read** until v4.8 — dead
configuration that read as implemented. Now enforced, scaled by tier (Strong 0.6×, because a
trained body legitimately moves faster).

The design decision that matters more than the mechanism: **rejected reps are never
silent.** The coach says *"slower — control it, and I'll count it."* A rep the person
definitely performed vanishing without explanation reads as a broken app.

And its counterpart, added in the same release: **short-range detection.** Progress toward
the threshold is tracked as a fraction (0 at rest, 1 at the threshold); leaving rest,
reaching 40–99%, and returning without crossing means an attempted rep that didn't make it →
*"go a bit deeper."* Below 40% is ignored, so shifting position isn't nagged at.

**Why this couldn't be a per-frame check** — and this is the conceptual heart of it:

A rep driver is graded against a *fixed ideal pose*. `squat.kneeBend` has ideal 175° (legs
straight) but the rep requires going below 110°. A per-frame cue would therefore fire at the
**bottom of every good rep**. Which is precisely the bug we found shipped in
`glute-bridge` — the app said *"Higher — squeeze at the top!"* while the user was correctly
at the bottom of the movement.

> **A shortfall is a property of the whole cycle, not of any single frame.** Choosing the
> right *unit of analysis* — frame, cycle, set, session — is a design decision, and getting
> it wrong produces confident nonsense.

---

# Part 4 · From measurements to judgements

## 4.1 Scoring: continuous, with a forgiving core

Given a measured angle, how good is it? Your `scoreTarget`:

```js
const err = Math.abs(v − t.ideal);
if (err <= tol) return 100;                        // dead zone: perfect
return Math.max(0, 100 × (1 − (err − tol)/(range − tol)));   // linear falloff
```

Three deliberate design choices, each worth naming:

**The dead zone (`tol`).** Inside tolerance, everything scores 100. Without it, the score
would twitch constantly and nobody is *exactly* at 180°. This is the numerical expression of
"good enough is good enough" — and it's why the whole system feels kind rather than pedantic.

**Linear falloff, not a cliff.** Beyond tolerance the score degrades smoothly. Small errors
cost a little, big errors cost a lot. A step function would make the coach feel arbitrary.

**Clamped at zero.** Terrible is terrible; there's no negative.

This shape — **piecewise linear** — is a common and underrated choice. It's trivial to
reason about, trivial to debug, and behaves predictably at the edges, where clever curves
tend to surprise you.

**Tolerance is the tier system's main lever:** the same `tol` is multiplied by 1.9 for
Learning, 1.25 for Building, 1.0 for Strong. One number, applied consistently, expresses
"be gentler with beginners" across all 21 movements without duplicating any content.

## 4.2 Booleans and continuous values are different tools

Your targets do two distinct jobs, and keeping them distinct is what makes the engine
coherent:

**Gates** answer yes/no. `pos: true` decides *is this person even in the position* (should
the set start?). `gate: true` decides *is this good enough to count as holding it* (should
the clock run?).

**Graded targets** answer how-well, feeding the weighted score.

The split matters because they have different failure modes. A gate being slightly wrong
stops the session; a graded target being slightly wrong nudges a number. Conflating them —
"if the score drops below 50, stop the clock" — makes both jobs worse.

## 4.3 Weighted averages, and a nasty edge case

Combining several target scores into one number:

```
score = Σ(scoreᵢ × weightᵢ) / Σ(weightᵢ)
```

Weight expresses *what actually matters for this movement*. In a plank, `hipAlign` carries
`w: 2` while other targets carry 1 — because a plank essentially *is* the straightness of
the body.

**The edge case:** `w: 0` means "measure this, but don't grade it" — used for rep drivers,
where the driver's instantaneous value is about counting, not quality. But if *every*
target in a movement has `w: 0`, the denominator is zero and you compute `0/0 = NaN` — which
propagates silently through every subsequent calculation and poisons the display.

Your engine handles it with a fallback chain: graded targets → else quality gates → else all
readings. Defensive, and the alternative is a form score reading "NaN" to a beginner.

## 4.4 Choosing what to say: selection under constraints

A beginner receiving four corrections at once will do none of them. This is a real cognitive
constraint, not a UI preference, and your engine encodes it in three layers:

**Worst-offender selection.** Sort the failing targets by score, take the lowest. One cue,
the most important one.

**Cue budget.** Learning tier allows **one distinct cue per set**. Building allows two.
Strong is effectively uncapped. Once the budget is spent, other faults are noted for the
debrief rather than voiced.

**Cooldown.** Even the same cue won't repeat within 9 s (Learning) / 6 s / 4 s. Silence is a
feature — it gives someone time to actually attempt the correction.

A subtle implementation note with a real lesson: JavaScript's `Array.sort` is
**stable** (equal elements keep their original order); Swift's is **not guaranteed** to be.
So the Swift port sorts by `(score, index)` explicitly. Two ties broken differently would
mean the two implementations say different things on the same input — an invisible
divergence that no casual test would catch.

## 4.5 Suppression: knowing when not to speak

When `sideness` says the view is oblique (25–50°), depth-dependent cues are dropped rather
than voiced — they'd be measuring an artefact of the angle, not the body. They're logged as
`view⊘cue` so the telemetry shows *what would have been said and why it wasn't*.

That logging choice is worth stealing generally: **record your suppressed decisions.** A
system that silently declines to act is very hard to debug otherwise.

---

# Part 5 · Time, state and control flow

## 5.1 State machines

A **state machine** is a system that is always in exactly one of a fixed set of states, with
defined rules for moving between them. It's one of the most useful concepts in all of
programming, and your system has three.

**The rep counter:** `down` ⇄ `up`, with hysteresis thresholds as the transition rules, plus
a `primed` flag. That flag exists because a plank and a bridge lockout are *geometrically
identical* — so nothing counts until a genuine resting position has been observed first.
Without it, walking into position counts as a rep.

**The session:** `setup` → `active` → (rest) → next step. The `setup → active` transition
("arming") requires *both* that the person has been in position for 1.2 s *and* that the
coach has stopped talking. That second condition is a product decision — never start the
clock while someone is still listening to the instructions.

**Speech:** idle ⇄ speaking, with a priority queue underneath.

**Why the pattern earns its place:** it makes illegal states unreachable. "Counting reps
before the set started" isn't a bug you have to remember to prevent — it's a transition that
doesn't exist.

## 5.2 The event loop and `requestAnimationFrame`

JavaScript is **single-threaded**: one thing at a time. Long work blocks everything,
including the UI. So the browser runs an **event loop** — a queue of callbacks processed one
after another.

`requestAnimationFrame(loop)` asks the browser to call your function before the next repaint
— typically 60 times a second, and automatically paused when the tab is hidden.

**Your loop had a subtle and instructive structure:**

```js
function loop(t){
  if (!running) return;
  requestAnimationFrame(loop);   // ← scheduled BEFORE the work
  ...work...
}
```

Scheduling first means the loop survives an exception in the work — the next frame is already
queued. That sounds robust. It is also **exactly how bug #14 hid for months**: every
completed hold threw a `TypeError`, killed the rest of that one frame, and the loop sailed
on. No crash, no console noise, no user signal — just a coach quietly doing less than it
should.

**The lesson:** silent resilience is worse than failure. Now the work is wrapped in
`try/catch` that logs every time and shows a banner once per distinct fault. **Fail loudly,
recover gracefully** — a system that hides its own errors cannot be debugged.

## 5.3 Asynchrony: promises and callbacks

Some operations take unknown time — camera permission, loading audio, speech finishing. You
can't block the single thread waiting.

**Promises** represent "a value that will exist later": `await video.play()` suspends *your
function* while letting everything else continue.

**Callbacks** say "call this when X happens": `utterance.onend = …`.

Your `Coach` layers real product logic over these primitives:
- **Priority** — an urgent cue interrupts encouragement, never the reverse
- **TTL (time-to-live)** — a queued line that's no longer true is *discarded* rather than
  spoken late. "Your hips are dropping" arriving four seconds after they were fixed is
  worse than silence.
- **Watchdog** — a timer that force-clears the speaking state, because Chrome's speech
  synthesis sometimes never fires `onend` at all. Defensive programming against a platform
  bug you cannot fix.

## 5.4 Latency budgets

From movement to spoken correction:

```
capture ~16ms → inference ~10ms → engine <1ms → speech start ~100–200ms
                                                → Bluetooth +150–200ms
```

Roughly 130–430 ms. The engine is a rounding error; **audio dominates**. This is why the
Bluetooth measurement is on your task list — it's the biggest single latency contributor and
it's invisible until measured.

**Generalisable lesson:** optimise what dominates. Making the engine twice as fast would be
imperceptible.

---

# Part 6 · Architecture and testing

## 6.1 Pure functions and side effects

A **pure function**: same inputs → same outputs, always, with no effect on anything outside
itself. `scoreTarget(target, value, tier)` is pure.

A **side effect** is anything else — drawing to the screen, playing audio, writing a file,
reading the clock.

Pure functions are dramatically easier to test (call, compare) and to port (no environment
to reproduce). The strategic move in your architecture:

> **Push side effects to the edges. Keep the middle pure.**

## 6.2 The effect stream

The Session had behaviour and side effects tangled together — it computed *and* touched the
DOM, the coach and the logger. Untestable without a browser.

The refactor: the core now **emits a list of tagged objects** describing what should happen,
and a thin shell replays them.

```js
{t:"say", key:"sag", pri:2}
{t:"bigTime", secs:12.4}
{t:"log", row:{…}}
```

This is a well-known pattern (Elm, Redux, the "functional core / imperative shell") and the
payoff is immediate and large:

- The core is testable with zero browser
- The shell is too thin to contain a bug
- **Effects are data, so they can be recorded, compared and asserted on**
- The Swift port needs the core; the platform-specific part is the shell

It also found two bugs the moment it existed, including one that had hidden behind
`requestAnimationFrame` for months.

## 6.3 Two meanings of "vector" — the overload that confuses everyone

You flagged not knowing what a vector is. Worth being explicit that this project uses the
word in **two unrelated senses**:

**Mathematical vector** (Part 1) — a list of numbers treated as a direction. Lives in the
geometry.

**Test vector / golden vector** (this part) — a recorded input-and-expected-output pair used
to verify an implementation. Nothing to do with arrows. The name comes from cryptography,
where "test vectors" have been published for decades.

Your `conformance-vectors.json` is the second kind: 1,407 scoring rows, 167 metric readings,
14 full scenarios, all recorded from the *running* browser engine. It's how the Swift port
gets verified without me being able to run Swift:

> **The browser engine is the specification. The vectors make the specification executable.**

Fix Swift when a vector fails; never the vector.

## 6.4 Determinism

**Deterministic** means: same input, same output, every single time.

Real-time systems fight this constantly — wall clocks, frame rates, random numbers, hash
ordering. Your engine is deterministic because time enters *only* as the explicit `dt` and
`now` parameters. That's what makes a 12-second session reproducible frame-for-frame in a
test.

The frame-rate fix in Part 3 was, at root, a determinism repair: the same physical movement
was producing different results depending on hardware speed.

## 6.5 Testing strategy

Your 3,847 checks across the vector harness are roughly:

**Unit** — one function (`scoreTarget` across every target × tier).
**Property** — invariants rather than examples ("the same physical movement scores the same
at 24, 30, 60 and 90 fps"). This is how the frame-rate bug is prevented from returning.
**Integration** — whole scenarios through the Evaluator.
**Regression** — a test whose only job is proving a specific fixed bug stays fixed
(bug #16 has one).
~~**Self-consistency** — the generated demo animations must pass the very exercise they
demonstrate. Elegant, because it makes the content check *itself*.~~

> **Correction.** Elegant, and real once — but it lived in `gen-refs.mjs`, which was lost with
> the sandbox, and it was never carried into `verify.mjs`. So this category was being counted
> in the strategy while nothing ran it, and three demos drifted into teaching poses the app
> would refuse to start from (bugs #40, #41). The idea is still right; it is now an authoring
> script (`Evaluator.read` at learning tier, per frame, per gate) rather than a test. **Making
> it a suite again is the cheapest real coverage left on the board.**

**And the two honest gaps:** the UI shell has **zero** automated coverage, and neither does
REF — a keyframe edit that breaks a gate fails nothing. 3,847 checks prove
the core emits the right effects, not that the screen replays them. That's precisely why the
desktop smoke test is Phase 1 of your task list.

## 6.6 Content as data

All 21 movements, 5 plans, tier definitions and dialogue are **declarative data**, not code:

```js
{id:"hipAlign", m:{k:"line", of:"hip", from:"shoulder", to:"ankle"},
 ideal:0, tol:0.035, range:0.11, w:2, above:"pike", below:"sag"}
```

Consequences that compound:
- Adding a movement means adding data, not writing logic
- The whole content set exports to JSON, so **the Swift port hand-transcribes nothing** —
  and transcription is a bug factory
- Content can be audited programmatically. Your honesty audit was a *script* that read the
  data and computed which targets penalise silently. That audit is impossible if the rules
  are scattered through code.

---

# Part 7 · The pipeline, end to end

One frame, all the way through:

```
1. CAMERA          getUserMedia → a video element
2. FRAME           30–60 per second, ~2M pixels each
3. INFERENCE       BlazePose CNN → 33 landmarks + confidences   (~10 ms)
4. FRAME BUILD     landmarks → {left, right, cam, conf, aspect, sideness}
5. METRICS         readMetric per target — angles, line deviations   (§1)
6. SMOOTHING       dt-normalised EMA per target                      (§3)
7. SCORING         scoreTarget → 0–100 per target                    (§4)
8. GATES           pos → arming?   gate → clock running?
9. VIEW            sideness → block, or suppress depth cues
10. REP MACHINE    hysteresis + priming + tempo + range              (§3, §5)
11. SELECTION      worst offender, under budget and cooldown         (§4)
12. EFFECTS        emit tagged effect list                           (§6)
13. SHELL          replay → screen, speech, telemetry
14. SPEECH         priority queue, TTL, interruption                 (§5)
```

Steps 5–12 are pure and headlessly testable. Steps 1–4 and 13–14 are the impure edges. That
line is exactly where the Swift port cuts — which is not a coincidence, it's the whole
reason the architecture is shaped this way.

---

# Glossary

**Activation function** — the non-linear squash in a neuron; without it, layers collapse.
**Aspect ratio** — width ÷ height. Must correct x before measuring angles.
**Backpropagation** — the algorithm computing how each weight affects the error.
**Bucket index** — deriving a sample number from absolute time; immune to drift.
**CNN** — network using sliding shared kernels; the reason vision models are feasible.
**Confidence** — model's self-estimate of reliability; licenses declining to answer.
**Conformance vector** — recorded input/output pair proving two implementations agree.
**Convolution** — sliding a small kernel across an image, dot product at each position.
**Debounce** — rejecting events that happen implausibly fast (your `minMs`).
**Determinism** — same input, same output, every time.
**Dot product** — multiply matching components and sum; measures agreement.
**dt (delta time)** — seconds since the last frame; must appear in every time-based update.
**EMA** — exponential moving average; one-number smoothing filter.
**Effect stream** — describing side effects as data instead of performing them.
**Event loop** — the queue that lets single-threaded JS stay responsive.
**Gate** — a boolean target: position (arming) or quality (clock).
**Gradient descent** — nudging weights downhill along the error surface.
**Hysteresis** — two thresholds plus state memory; kills threshold chatter.
**Inference** — running a trained model (as opposed to training it).
**Landmark / keypoint** — an estimated joint position.
**Latency budget** — the total delay allowance from movement to response.
**Normalisation** — rescaling to a standard range (0→1 coordinates; unit vectors).
**Piecewise linear** — straight-line segments; predictable and debuggable.
**Priming** — requiring a genuine rest position before counting reps.
**Projection** — 3D → 2D flattening; irreversibly loses depth information.
**Pure function** — no side effects, no hidden state, trivially testable.
**Quantisation** — lower-precision weights for size and speed.
**ReLU** — `max(0, x)`; the most common activation.
**Side effect** — anything a function changes outside itself.
**State machine** — fixed states with defined transitions; makes bad states unreachable.
**Time constant** — how fast a filter responds, expressed in seconds not frames.
**Tolerance (`tol`)** — the dead zone scoring 100; the tier system's main lever.
**TTL** — time-to-live; discard a queued line that's no longer true.
**Vector (maths)** — a list of numbers treated as direction and magnitude.
**Weight (network)** — a trainable parameter. **Weight (scoring)** — how much a target counts.

---

# Where to go deeper

**Vectors and geometry** — 3Blue1Brown, *Essence of Linear Algebra* (YouTube). The best
explanation of dot products that exists, and it's visual throughout.

**Neural networks** — 3Blue1Brown's *Neural Networks* series for intuition; then Andrej
Karpathy's *Neural Networks: Zero to Hero* if you want to build one from scratch. Karpathy's
*micrograd* is ~150 lines and teaches backpropagation properly.

**Pose estimation** — the BlazePose paper (Google Research, 2020) is unusually readable, and
you'll recognise most of it from Part 2.

**Signal processing** — search "exponential moving average time constant"; the audio and
control-systems literature treats this far more rigorously than the ML world does.

**Architecture** — Gary Bernhardt's talk *Boundaries* is the clearest statement of the
functional-core/imperative-shell pattern your engine now uses.

**The most valuable exercise, though:** re-read your own `Evaluator.evaluate` now. It's
about 80 lines, and every concept in this document appears in it. You'll find you can read
it line by line — and that's the point.
