# Beginner test 01 — Max

**26 July 2026.** First blind user test. Full session recorded, 4,453 telemetry rows,
screen recordings per exercise. Everything below is either observed or computed from the
log; nothing is inferred from memory.

---

## The verdict

**The core thesis holds.** *"Liked the form corrections in real time"* and *"liked the
visual alerts of red & amber"*, volunteered by someone who had never seen the app. This was
the unproven bet the whole project rested on: that a camera coach could correct form
usefully in the moment, and that it would feel like help rather than judgement.

**Wrong corrections: zero.** The only correction cues that fired all session were `pike` (5),
`sag` (2), `knees` (20) and `sagside` (4). None was wrong.

**But the app still confused him about his own form** — via a stale banner rather than bad
judgement (B1 below). On the strict gate criterion this passes; on the honest one it didn't,
which is why v4.9 exists.

**Also validated:** the interface ("clean"), and the form tint — which was speculative when
built and is now one of two things a first-contact user named unprompted.

---

## What was wrong, and why

### B1 · The banner outlived the form that earned it — **fixed in v4.9**

Max saw *"Lovely. Really nice."* on screen while FORM read 66 and his torso was red.

The praise logic was correct: `goodhold` requires `score > 85` and fired legitimately. **The
banner was the bug** — `clearCue` had zero emitters, so the cue element displayed the last
thing said until something replaced it. Praise earned at second 12 was still on screen at
second 20.

The two channels weren't disagreeing about the present. **One was showing the past.**

*Fixed:* every banner now expires on a timer, praise shortest (3.5 s) because it is the most
misleading when stale, and praise is retracted immediately if a limb goes red.

### B2 · The clock started before he was in the shape — **fixed in v4.9**

```
568.18s  armed        in_position=true
569.95s  active       form=0    blocked=torsoLevel
570.08s  active       form=0    blocked=torsoLevel|bodyLine
```

**13% of all side-plank active frames were flagged not-in-position.**

Cause: `tryArm(inPose, …)` — the parameter was *named* `inPose`, but the call site passed
`r.inPosition`. Quality gates never gated arming, so on a side plank `torsoLevel` (position)
could pass while `bodyLine` (quality) failed.

*Fixed:* position must still be sustained 1.2 s, and quality must hold at the moment of
arming.

### B3 · Four cues competing to say the same thing — **fixed in v4.9**

On leg raises: **318 frames blocked by `framing`**, 388 by `torsoLevel`. That's the "move
back so I can see you" barrage — and it explains the unregistered reps in the same finding,
since he was simultaneously out of frame *and* failing the position gate.

`getin` (6 s), framing cues (6 s), `tooFar` (9 s) and `vis` (7 s) each carried an independent
cooldown and none suppressed the others.

**Max's own prescription was better than the original design** and was adopted directly:
speak on the *transition*, repeat at most every 30 s, and carry the state with a persistent
visual in between.

| Over 60 s persistently out of position | before | after |
|---|---|---|
| spoken cues | a carousel every few seconds | **2** |
| visual guidance | intermittent | **continuous** |

### B4 · The rep landed on the way down — **fixed in v4.9**

Max noticed his final rep didn't register until he lay back down. By design — hysteresis
completes the cycle on the return — but his instinct about how it *feels* was right: the
effort peaks at the top.

*Fixed:* acknowledgement now fires at the up-crossing, **1.3–1.6 s earlier**. The count still
updates on completion, because a rep can still be rejected on tempo during the return and
retracting a number is worse than a half-second delay.

### B5 · The demos — **fixed in v4.9, and worse than reported**

**Side plank: the hip never moved.** All three keyframes had `hip.y = 0.612`. The one thing
a side plank *is* — lifting the hips into line — was never animated. Exactly why Max said it
"just looks like a regular plank".

**Crunch:** the knee sat at `x = 0.90` and clipped the frame ("legs cut off"); the elbow was
further back than both the shoulder and the wrist ("arms inverting"). And testing the pose
against the engine found a third defect nobody had seen:

```
EXISTING crunch frame0 → kneesBent = 12.8 (score 0)  BLOCKED
```

*Figure not reproducible (27 July): replayed against `form-coach-v4.8.html` — the only
pre-fix build that still exists — `crunch` frame 0 reads **9.8°**, and all three frames read
9.8°, not just frame 0. Either 12.8 came from an intermediate build lost with the sandbox,
or it was mistyped. The conclusion is unaffected and if anything understated. Recording the
discrepancy rather than quietly overwriting it, since neither number can now be checked
against the build that produced it.*

**The demo taught a position the app would refuse to start from.** Max's inference — *"will
it recognise a real crunch?"* — was literally true.

*Fixed:* both re-authored, every frame passing every gate. Correcting them legitimately
moved 21 `readMetric` vectors, regenerated deliberately for those two movements only.

**Found in passing — and originally misdiagnosed.** This section first recorded that
`dead-bug` and `leg-raise-bent` had "the same defect", explained as asymmetry: a single-sided
skeleton can't show one limb moving while the other stays still, so "a different problem
needing a different fix". **That was wrong, and it hid a worse case for a week.**

The failing gate was `kneesBent` / `kneeTucked` — a *knee* gate, reading 4–10°. Asymmetry
cannot fold a knee to 4°. The rig had laid every supine shin flat back along its thigh, which
is the same defect as the crunch above, and `drawRef` duly painted the two capsules as one
bar. Corrected:

| | gate | before | after |
|---|---|---|---|
| **`glute-bridge`** f0 | `kneesBent` (ideal 100°) | **9.9° · score 0 · BLOCKED** | 95.1° · 100 |
| `glute-bridge` f1 | `kneesBent` | 90.1° · 100 | 104.7° · 100 |
| `dead-bug` f0 | `kneeTucked` (ideal 95°) | **3.9° · score 0 · BLOCKED** | 95.0° · 100 |
| `leg-raise-bent` f0 | `kneesBent` (ideal 100°) | **10.0° · score 0 · BLOCKED** | 99.8° · 100 |
| `leg-raise-bent` f1 | `kneesBent` | **9.9° · score 0 · BLOCKED** | 100.0° · 100 |

**`glute-bridge` was the one that mattered and the one nobody wrote down.** It is in three
plans and is **step 2 of First Steps** — the second thing a beginner is ever asked to do —
and its demo was showing a leg folded shut. It went unmentioned because the asymmetry story
sent everyone looking at asymmetric movements, and a glute bridge is symmetric.

`leg-raise-bent` is not asymmetric either — a bent-knee leg raise lifts **both** legs. It was
fixed with the same edit, but it is the *lowest* priority of the three, not a peer of them:
it is currently **unreachable**. No plan lists it; its only route is regression from
`leg-raise`, which lives solely in `core-strength` (tiers `building`/`strong`), while
regression requires `TIERS[tier].regress` — true only at `learning`. No user can reach this
demo today. (`verify.mjs`'s orphan audit doesn't catch it: it adds every `regression` to the
reachable set without checking whether the tiers line up.)

Only **`dead-bug` frame 1** was ever genuinely unrepresentable, and it still is — see below.

*Fixed:* keyframes hand-authored (the FK rig is unrecoverable) and verified through the
Evaluator's own read path with `agg` applied, at learning tier. 15 `readMetric` vectors
regenerated deliberately, for those three movements only.

---

## Still open

| Item | Nature |
|---|---|
| Demo audio synced to the animation | Max's suggestion; design work, high value |
| Per-exercise debrief | *"Way too broad, no real feedback the user can use."* Data is already logged — presentation only |
| `dead-bug` frame 1 | **Closed as won't-fix.** Genuinely unrepresentable single-sided — the one place the asymmetry story was true. Recorded in the REF header so it isn't re-opened |
| Longer rests between sets | One constant; needs a deliberate number |
| Warm's "two" sounds like "coo" | Re-render one clip |
| Surprised the first exercise was a plank, straight after a plank calibration | Acknowledge it in the copy |
| Customisation — exercises, countdown | Second independent request for this |
| Voice control | Browser speech recognition is cloud-based and would break the privacy promise. iOS `SFSpeechRecognizer` supports on-device, so this is **natively feasible and post-port by necessity** |
| Rep counted at peak outright | Moves 120 tempo vectors; needs a Swift mirror |

---

## What to do differently in test 02

- **Render the pending voice clips first.** Mixed recorded/TTS was probably half of the
  "overlapping voices" complaint.
- **Ask the wrong-corrections question explicitly** during the debrief, not afterwards from
  notes.
- **Note the time whenever he hesitates** — the CSV can then be aligned to the exact frame.
- Run it on **v4.9**, so the session measures the fixes rather than re-finding them.
