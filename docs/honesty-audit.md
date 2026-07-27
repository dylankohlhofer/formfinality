# Movement honesty audit

**Question:** which exercises does Form Coach give genuinely valuable guidance on, and which
does it not? Where might it be teaching bad form by staying quiet?

**Method:** computed from the shipped v4.8 content — every target in all 21 movements, its
role (position gate / quality gate / graded), weight, tolerance band per tier, and whether
it has a cue attached. Not asserted from memory.

**Headline:** the scoring geometry is sound. The *communication* is not. **15 of 38 judging
targets penalise the user without ever telling them why.**

> **STATUS — all three recommendations implemented in v4.8.** Silent judging targets are
> down from 15 to 6, and the 6 remaining are the `bodyLine` gates whose sibling `hipAlign`
> already cues sag/pike. Implementation notes and a new bug are in §8.

---

## 1. Good news first: no decorative targets

A worry going in was that low-variance movements — small ranges of motion — couldn't be
scored meaningfully once Learning tier multiplies tolerance by 1.9. If a target's tolerance
band ever exceeded its scoring range, it could never score below 100 and would be pure
decoration.

Checked every target at every tier: **zero cases.** Every graded target can still discriminate
good from bad at Learning tolerances. The tol/range design holds up.

---

## 2. The finding: the silent penalty

A target can affect the user in three ways — dragging the **form score**, freezing the
**hold clock**, or blocking a **rep from counting**. A target with no `above`/`below` cue
does those things *mutely*.

**23 targets speak. 15 do not.** The silent ones split three ways:

### 2a · Covered by a sibling — acceptable (8 targets)

`bodyLine` gates on plank, knee-plank, side-plank, side-plank-knee, push-up, knee-push-up.

These fire alongside `hipAlign`, which measures the same physical fault (a straight body)
and *does* cue sag/pike. When the gate blocks, the sibling is already speaking. Redundant by
design, not silent in practice. **No action — but document it**, because it looks like a gap
in the content and someone will "fix" it later.

### 2b · Genuinely silent gates — the hold clock freezes and nothing is said (2)

| Movement | Target | What happens to the user |
|---|---|---|
| `hollow-tuck` | `hipAngle` (gate, w2) | Knees drift out of the tuck → the timer **stops**. No cue exists. They see a frozen clock and have no idea why. |
| `cobra` | `backExtend` (gate, w2) | Chest not lifted enough → timer stops, silently. |

Both are worse than a wrong correction in one specific way: a wrong correction is at least
*information*. A frozen clock with no explanation reads as **the app being broken**.

### 2c · Genuinely silent graded targets — score drops, nothing said (7)

| Movement | Target | Also the rep driver? |
|---|---|---|
| `squat` | `kneeBend` (depth) | **yes** |
| `sit-to-stand` | `hipHinge` | **yes** |
| `leg-raise` | `hipAngle` | **yes** |
| `leg-raise-bent` | `hipAngle` | **yes** |
| `dead-bug` | `legExtend` | **yes** |
| `crunch` | `trunk` | **yes** |
| `wall-sit` | `backFlat` | no |

Six of seven are **also the rep driver**, which produces the worst experience in the app:

> A beginner does a shallow squat. It's too shallow to cross the rep threshold, so **no rep
> counts**. It's below ideal depth, so **the score drops**. And because `kneeBend` has no
> cue, **the coach says nothing at all.**
>
> They squat again, harder. Still nothing. The app appears broken, and the one thing they
> needed to hear — *"go deeper, all the way down"* — is exactly the thing it can't say.

This is the single most damaging finding in the audit. It sits directly on the metric the
beginner test measures, and it will read as the coach not working.

**Fix:** depth/range cues for all seven. Small content change, three lines of dialogue each.
Note it interacts with the v4.8 `minMs` work: rushed reps now say "slower", but *shallow*
reps still say nothing. Both failure modes need a voice.

---

## 3. Thin judgement: nine movements graded on a single target

`knee-plank`, `side-plank`, `side-plank-knee`, `glute-bridge`, `hollow-hold`,
`leg-raise-bent`, `knee-push-up`, `push-up`, `cobra`.

Not wrong — a plank variation genuinely is mostly "is the body a straight line". But it means
the form score is a **proxy, not a summary**: a push-up scored 100 has a straight body and
could still have flaring elbows and half depth (`elbowAngle` is `w:0` — it drives reps, it
isn't graded). The score is honest about what it measures; the *user* will read it as a
verdict on the whole movement.

**Fix:** not more targets — better framing. Learning tier already hides the number. For
Building and Strong, label what the score is *of* (e.g. "FORM · body line") rather than
implying it grades everything.

---

## 4. `wall-push-up` makes no form claims whatsoever

Two targets: `uprightTorso` (position gate, w:0) and `elbowAngle` (rep driver, w:0).
**Zero graded targets, zero quality gates, zero cues.** It counts reps and grades nothing.

This is the first movement in the push-up chain — the one an absolute beginner meets first —
and it is silently uncoached. Worse, the w:0-pool fallback means it still *displays* a form
score derived from gates, so the user sees a number that means nothing.

**Fix:** it's a standing movement seen side-on, so body line (ear→hip→ankle) is perfectly
measurable — sagging hips at the wall is the classic fault. Add `hipAlign` with sag/pike
cues, mirroring `knee-push-up`. This is an omission, not a limitation.

---

## 5. What we're honestly blind to

Per the single-2D-camera constraints, and worth stating per movement because these are the
ones where **silence should be replaced by teaching up front**:

| Movement | Blind to | Why it matters |
|---|---|---|
| `squat` | **knee valgus** (knees caving in) | The injury risk that matters most, and a front-on measurement we don't take |
| `squat`, `sit-to-stand` | heel lift | Common, invisible in profile at typical framing |
| `bird-dog` | hip rotation / hip drop | Rotation about the spine's long axis. We check the limb lines and honestly cannot see the hips |
| `side-plank` | shoulder stacking | Depth judgement from the front view |
| `cat-cow` | per-segment spinal articulation | Correctly `guided` — makes no claims. **This is the model to follow.** |
| `dead-bug`, `hollow-*` | lumbar contact with the floor | The actual point of the exercise; we infer it from hip angle |
| all | left/right asymmetry under rotation | `agg:"worst"` helps, but only when both sides are visible |

**Recommendation:** each of these gets one sentence in its teach line, said once, up front.
*"I can't see your knees from the side, so keep them tracking over your toes — that one's on
you."* That converts a blind spot from a hidden risk into a taught cue, which is the
project's founding principle applied properly.

---

## 6. Verdict per movement

**Coach with confidence (10)** — the measured targets genuinely cover what matters:
`plank`, `knee-plank`, `side-plank`, `side-plank-knee`, `glute-bridge`, `bird-dog`*,
`push-up`, `knee-push-up`, `downward-dog`, `hollow-hold`
*\*bird-dog with the hip-rotation caveat taught up front.*

**Coach, but fix the silence first (7):** `squat`, `sit-to-stand`, `leg-raise`,
`leg-raise-bent`, `dead-bug`, `crunch`, `wall-sit` — all need range/depth cues.

**Fix before it ships (3):** `wall-push-up` (add real targets), `hollow-tuck` and `cobra`
(silent gates freeze the clock).

**Correct as-is (1):** `cat-cow` — `guided`, no claims, breath-led. The reference standard.

**Demote or drop: none.** No movement is so unmeasurable that it should be pulled. The
problem throughout was communication, not sensing — which is a much better problem to have.

---

## 7. Recommended order

1. **Depth/range cues for the seven silent graded targets** — biggest user-visible win,
   directly protects the beginner test's zero-wrong-corrections metric.
2. **Cues for the two silent gates** (`hollow-tuck`, `cobra`) — a frozen clock with no
   explanation is the worst failure mode in the app.
3. **`wall-push-up` targets** — the first movement a beginner meets shouldn't be uncoached.
4. **Blind-spot sentences in teach lines** — one line each, cheap, and it's the honesty
   principle actually delivered.
5. **Score labelling** for thin-judgement movements — framing, not engineering.

Items 1–3 are content changes plus a handful of dialogue keys; they'll need a small delta
voice render. Item 4 is dialogue only. None of it touches the engine, so the vectors and the
Swift port are unaffected.


---

## 8 · Implementation (v4.8)

### The fix was not the one this audit recommended

Item 1 said "add depth/range cues to the seven silent graded targets." Checking the actual
thresholds before writing anything showed that would have **made the app worse**. Six of the
seven are rep drivers graded against a *fixed ideal pose*, so they oscillate by design:

| Movement | graded ideal | rep needs | a per-frame cue would fire… |
|---|---|---|---|
| `squat` | 175° (standing) | knee < 110° | at the **bottom of every good rep** |
| `leg-raise` | 115° (legs up) | hip < 115° | **at rest**, between every rep |
| `dead-bug` | 160° (extended) | leg > 150° | **at rest**, between every rep |

**A shortfall is a property of the rep cycle, not of any single frame.** So it's detected the
same way the v4.8 tempo floor is: `Rep` tracks progress toward the threshold, and when
someone leaves rest, gets 40–99% of the way, and returns without crossing, it emits a
short-range event. The Session relays the movement's `shortCue`. Between the two, both ways
a rep can fail to count now have a voice — *"slower — control it"* and *"go a bit deeper —
all the way down."*

Wobbles under 40% of range are ignored, so shifting position isn't nagged at.

### Bug #16 — found while checking, and worse than the silence

`glute-bridge.hipExtend` already carried a per-frame cue: `below: "bridgehigh"` — *"Higher —
squeeze at the top."* Its ideal is 176° (locked out) and rest is below 140°. So the coach
told the user to **lift higher while they were correctly at the bottom of the rep**, once
per cooldown window, every set, in the shipped app.

This is precisely the failure the beginner test's killer metric measures: a confident,
wrong correction. It survived every synthetic suite because no test asserted on what is
*not* said during a correct rep.

**Fixed:** the per-frame cue is removed; the same line moved to the short-rep path, where
it's true. Regression-tested in `t52`.

### Shipped

| Item | Change |
|---|---|
| 1 · silent graded targets | Short-range detection in `Rep`; `shortCue` on all 10 rep movements; 6 new dialogue keys |
| 2 · silent gates | `hollow-tuck.hipAngle` → `kneesin`; `cobra.backExtend` → `liftchest`/`cobraeasy`; `wall-sit.backFlat` → `backwall` |
| 3 · `wall-push-up` | New graded `bodyLine` target (angle, not signed line — a standing body has no horizontal extent, so the line metric's `\|dx\|` guard would return 0) with a `straighten` cue |
| — | Bug #16 fixed |

11 new dialogue keys, all resolving at all three tiers and all three personas.
**`t52` (21 checks)**; 3,789 vector checks, all green. The FK demos still pass their own
exercises against the newly added targets.

**Voice:** 117 new clips, ~£0.52–1.25, next time you render.

**Not yet done:** §5's blind-spot sentences in teach lines (item 4) and §3's score
relabelling (item 5). Both are dialogue-only and don't block the beginner test.
