# Form Coach — exercise restructure: a plan, not a build

Five proposals assessed before any code moves. **Two have consequences that aren't
obvious from the outside**, and one has a blocker that needs a decision from you
before anything else can be sequenced.

---

## 1 · Remove the yoga movements — straightforward, with one loss

`cat-cow`, `downward-dog`, `cobra`. Deleting them takes the `mobility` plan with
them (it is built entirely from those three), leaving four plans.

Mechanically this is clean: content-as-data means it's a deletion plus a vector
regeneration. Dead voice clips (`teach.cat-cow`, `teach.cobra`, `teach.downward-dog`,
their tok clips, and any dialogue key they alone used — `longspine`, `backarch`,
`liftchest`, `cobraeasy`) drop out of the render plan automatically, since it's
generated from reachable keys.

**The one real loss: `cat-cow` is the only `guided` movement.** It is the app's
worked example of the founding principle — a movement that makes *no* claims because
per-segment spinal articulation can't be seen from one camera. It's cited in
`CLAUDE.md`, the honesty audit, and the system reference as the standard the rest of
the library is held to.

*That doesn't argue for keeping it.* But `guided` as a **capability** should survive
the deletion, so the next movement that can't be honestly measured has somewhere to
live rather than being forced into a gate it can't support. Keep the kind; drop the
movement.

## 2 · Push / Pull / Legs — **there is no Pull, and this is the blocker**

| Group | Movements today |
|---|---|
| **PUSH** | `wall-push-up`, `knee-push-up`, `push-up` |
| **LEGS** | `glute-bridge`, `sit-to-stand`, `squat`, `wall-sit` |
| **CORE** | 11 movements |
| **PULL** | **none** |

Push and Legs are ready now. Pull requires **new movements**, and pull is the hardest
category in the whole product for three compounding reasons:

**Equipment.** Real bodyweight pulling — rows, pull-ups, chin-ups — needs a bar,
a table edge, or bands. Every other movement in this app needs a floor. The moment a
plan requires equipment, "roll out of bed and press start" stops being true, and that
is a core part of the pitch.

**Visibility.** The realistic no-equipment options are prone: back extension
(superman), reverse snow angels, prone Y-T-W raises. Side-on, a superman is
measurable — spine extension is exactly the kind of thing the engine reads well. Y-T-W
raises are **not**: the arm positions that distinguish them separate in the axis the
camera can't see.

**The irony:** `cobra` — which you're removing as yoga — is the closest thing to a
measurable prone back extension already in the library.

**Three honest options:**

| Option | What it costs |
|---|---|
| **A · Drop Pull.** Ship Push / Legs / Core A / Core B / Custom | Nothing. PPL becomes "Push, Legs, Core", which is an honest description of what a floor-only app can coach |
| **B · Build 2–3 prone pull movements** | New targets, dialogue, video demos, voice clips per persona/tier. Roughly a week. `cobra` returns in fitness clothing as "back extension" |
| **C · Allow one piece of equipment** (a table edge for inverted rows) | Changes the product's promise. I'd want a lot of convincing |

**My read: A now, B later.** Ship the split that the library already supports, and add
Pull as a deliberate content project once the demos and structure have been validated.
A category with one thin exercise in it is worse than an honestly absent one.

## 3 · Visibility per movement — you're right, but not for the reason stated

The joints framing actually demands today:

```
push-up       ankle, elbow, hip, shoulder, wrist
squat         ankle, hip, knee, shoulder          ← no head, already
wall-sit      hip, shoulder
plank         ankle, ear, elbow, hip, shoulder
```

**Squat already doesn't require the head.** So the behaviour you're seeing — "trying
to fit the whole skeleton on half the body" — is **not** the framing gate. It's the
*drawing*: MediaPipe extrapolates landmarks beyond the frame edge and reports them
with low visibility, and the skeleton renderer draws them anyway. You're seeing a
predicted head, not a demanded one.

**That's a contained fix**, and a better one than loosening tolerance: *don't draw
joints below the visibility threshold, and don't let them contribute to the framing
box.* One change, every movement benefits, nothing about scoring moves.

**On "stop looking for feet in push-ups and planks" — careful.** A plank's `hipAlign`
measures the hip's deviation from the **shoulder→ankle line**. The ankle isn't
incidental; it's the far end of the thing being measured. Drop it and a plank can't
be scored at all. The same is true of `push-up`.

Two workable answers, and they're different:

- **Substitute the reference.** `knee-plank` already uses the knee as its far point.
  A full plank could fall back to shoulder→knee when the ankle is unavailable, with
  slightly wider tolerance to reflect the shorter lever. Honest, and it degrades
  rather than fails.
- **Say what's needed, once.** *"I need to see from your shoulders to your ankles for
  this one"* during the teach line — turning a blocked session into a taught setup.
  This is the founding principle applied to framing.

**On looser tolerance for vertical exercises specifically: I'd push back.** Tolerance
is the tier system's lever, and it means "how good does this need to be". Measurement
uncertainty is a different quantity. Conflating them means a Strong-tier squat is
judged loosely for reasons that have nothing to do with the user. Better to make the
*visibility requirements* explicit per movement — which is what you're really
describing — and leave tolerance alone.

## 4 · Circuit format — your call, with one flag

Rotating (`plank → push-up → crunch → plank → push-up → crunch`) rather than straight
sets. This is a modest change to `expandPlanSteps`, moves the plan-expansion vectors,
and ports free because it's engine-side.

**The flag, stated once:** circuits are better for engagement and fatigue management;
**straight sets are better for learning form.** If the coach corrects your plank and
you then do two other exercises before returning, the correction is three minutes
stale — and *learning* is what the Learning tier exists for.

**The compromise that fits the architecture:** straight sets at Learning, circuits at
Building and Strong. One tier property, consistent with how every other difficulty
axis already works. If you'd rather keep it simple, circuits everywhere is a
defensible call — just a deliberate one.

## 5 · Recorded video demos — the biggest simplification available

**This is the right decision**, and it deletes more fragile code than it adds:

- `drawRef`, `refFit`, `refPose`, the capsule renderer
- `refGates` (176 checks) and `verify-draw.mjs` (250) — both exist only to police
  hand-authored keyframes
- The lost `gen-refs.mjs` rig question, permanently
- The ghost, which has never once worked correctly
- An entire bug class: #39, #40, #41, #43 were all keyframe or drawing bugs

**What to decide before recording:**

**Blur at author time, not playback.** Process each clip once, bake the blur in, and
ship only the blurred asset. The unblurred video then never exists in the bundle —
which is both simpler and the honest version of the privacy promise. MediaPipe's face
detector gives you the region.

**Record side-on, at the distance the app expects.** The demo should show what the
camera will see. A demo shot from a flattering angle teaches a view the app can't
verify.

**Size is the real constraint.** ~18 movements × 3–5 s. At sensible compression that's
maybe 15–40 MB — fine for the web prototype, and it matters more for an App Store
bundle. Worth measuring one clip before recording eighteen.

**Format:** H.264 MP4, which is safe in both Safari and iOS natively.

**One thing you lose:** the demo currently animates in the same coordinate space as
the pose engine, so it *could* have been overlaid. Video can't. Given the ghost has
never worked, that's a loss on paper only.

---

## What this does to beginner test 02

Worth naming, because it changes the sequencing.

Max's single biggest criticism was the demos. Testing v4.10's stick figures again
would mostly re-find that complaint. **So the demos should be replaced before test
02, not after** — otherwise you spend a session confirming something you already know.

But the restructure as a whole is weeks. The middle path:

**Record demos for First Steps only (5 movements), keep everything else as-is, and
test that.** It's the plan a beginner meets, it's the one Max used, and it isolates
the change you most need feedback on without waiting for PPL, Pull, or the custom
builder.

## Suggested sequence

1. **Fix the extrapolated-landmark drawing** — small, independent, improves everything
2. **Record and integrate the First Steps demos** — the highest-value change
3. **Beginner test 02** on that
4. **Then** the structural work: remove yoga, split Push/Legs/Core, circuit format,
   custom builder
5. **Pull, later**, as a deliberate content project — or not at all

Steps 1–3 are days. Step 4 is where the vectors and Swift mirror get involved, and
it's much better done once, after the test has told you whether the demo approach
worked.
