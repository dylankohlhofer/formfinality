# Camera placement — the real geometry

You asked whether "2–3 metres" is grounded in anything. Honest answer: **it wasn't.** It
was a plausible number repeated across the guide and the app's welcome copy without a
calculation behind it. Here's the actual geometry, and a better answer than a fixed number.

---

## What determines the distance

Three things: the camera's field of view, the person's height, and — the part I'd
missed — **which way their body lies relative to the camera.**

A phone's main camera has a horizontal field of view around **62°** in video (the sensor
is cropped from the ~68° stills figure for stabilisation and the 16:9 frame). Laid in
**landscape**, the *vertical* extent of the frame is the short axis — only about **37°**.
That narrow vertical angle is what forces the camera back.

## The distance the old advice implied

For a person standing straight, filling ~85% of the frame height, landscape:

| Height | Distance |
|---|---|
| Short adult (1.55 m) | 2.7 m |
| Median (1.70 m) | 3.0 m |
| Tall (1.85 m) | 3.2 m |
| Very tall (2.00 m) | 3.5 m |

So "3 metres" was accidentally right — **but only for a standing person photographed
head-to-toe vertically.** And that is almost never what this app is doing.

## The realisation that changes the advice

**Sixteen of your twenty-one movements are performed lying down or on all fours.** In a
plank, side plank, glute bridge, dead bug, push-up, bird dog and the rest, the body's long
axis is **horizontal** — it lies along the *wide* axis of a landscape frame, which spans
the full **62°**, not the narrow 37°.

That collapses the distance:

| Height | Floor workout | Standing workout |
|---|---|---|
| Short 1.55 m | **1.5 m** | 3.1 m |
| Median 1.70 m | **1.7 m** | 3.4 m |
| Tall 1.85 m | **1.8 m** | 3.7 m |

**A floor workout needs about half the distance of a standing one.** Telling everyone "2–3
metres" pushes floor-workout users twice as far back as they need to be — losing
resolution on the pose, and often running out of room in a bedroom. And it *under*-shoots
the standing/mobility plans, where a tall person genuinely needs ~3.7 m that most rooms
don't have.

One number cannot serve both cases. The honest options are: give distance **per workout
type**, or — better — stop asking the user to measure at all (below).

## Phone height off the floor

The camera should point at the middle of the action. Height changes the *tilt*, and tilt
matters because a steep downward angle foreshortens depth — the exact thing the side-on
view exists to preserve.

| Phone height | Floor work (subject mid ≈ 0.4 m) | Standing (hip ≈ 0.95 m) |
|---|---|---|
| On the floor | −11° tilt | −18° tilt |
| 0.3 m | −3° | −12° |
| 0.5 m | +3° | −9° |
| 0.8 m | +11° | −3° |
| 1.0 m | +17° | +1° |

The pattern: **floor work wants the phone low (0.2–0.4 m)** — propped against a water
bottle or a stack of books, roughly shin height. **Standing work wants it higher
(0.7–1.0 m)** — a chair seat or low table. A phone flat on the floor is bad for both: it
throws an 11–18° upward tilt that foreshortens the body.

This connects to something the engine already does: it blocks angle cues when the body is
more than ~65° off side-on. A steep camera tilt is a different axis but has the same
optical effect — so bad height doesn't just look wrong, it actively degrades the
measurements the coaching depends on.

## The real fix: measure, don't ask

Here's the thing — **the app shouldn't be asking the user to estimate metres at all.** It's
pointing a camera at them. It can *see* whether they're framed.

`buildFrame` already carries every joint's normalised x/y and a visibility score. So the
engine already has, for free, everything needed to tell:

- **Too close / out of frame** — any tracked joint at x or y beyond ~0.02 or 0.98, or
  head/foot visibility dropping while the body is detected. → *"I can only see part of
  you — shuffle back a little."*
- **Too far** — the body's bounding box fills less than ~40% of the frame. → *"You've got
  room to come closer — you'll get sharper coaching."*
- **Badly tilted** — the reference poses assume a roughly level camera; a strong vertical
  skew in the standing frames is detectable. → *"Tip the phone back a touch."*

This is strictly better than any instruction, because it adapts to the actual person, the
actual room, the actual movement — and it's the same principle the whole product runs on:
*don't ask, watch.* A framing check during the GET SET phase (when the person is settling
into position anyway) would replace the entire fragile business of estimating distance.

It's also cheap: it's a bounding-box calculation on landmarks the engine already has, one
new cue family, and it slots into the existing setup-bar / GET-SET moment. No new sensing,
no model changes.

## Recommendation

1. **Immediately — fix the copy.** Replace the single "2–3 metres" with honest, split
   guidance: *"Floor exercises: about 1.5–2 m back, phone low (shin height). Standing
   exercises: about 3 m back, phone on a chair."* This costs nothing and stops sending
   floor users to the far wall.
2. ~~Before launch — build the framing check.~~ **Built.** A pure `framing()` function in
   the engine draws a bounding box over the confident joints and returns a verdict —
   `framed` / `far` / `clipped` (with the edge that's cut) / `unsure` — surfaced as a
   GET-SET and calibration cue that names the exact nudge ("step back", "I've lost your
   feet", "come closer"). It adapts to the real person and room, needs no new sensing,
   and ports to Swift with the rest of the engine. Covered by `t55` and 7 conformance
   vectors.
3. **For the Swift port** — the framing check belongs in the engine (it's pure landmark
   geometry), so building it now in the browser means it ports for free with everything
   else.

The 3-metre figure wasn't grounded. The good news is it doesn't need to be a figure at
all — the camera can answer the question itself.


---

## Note for the next voice render

Changing the welcome copy also changed the spoken `start` greeting, which invalidates
**18 clips** (the name-spliced start line, 3 personas × 3 tiers × a/b halves). Because
`render.mjs` skips files that already exist, these will keep their old wording unless
deleted first:

```bash
rm -f voice/*/*/start.a_0.mp3 voice/*/*/start.b_0.mp3
node render.mjs
```

Minor and non-blocking — the old greeting isn't wrong, just no longer matched to the
on-screen text. Fold it into the next render rather than doing a run for it alone.
