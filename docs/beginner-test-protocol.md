# Beginner test — protocol

**Purpose:** the go/no-go gate for the whole plan (business plan §9). Everything designed
since the pivot — tiers, the one-cue budget, regressions, the praise moment — is hypothesis
until a real novice meets it.

**Who:** 2–3 people who genuinely don't exercise. Not gym-goers being generous. The person
who'd say "I wouldn't know where to start" is exactly right.

**How long:** ~25 minutes each. 5 setup, ~10 in the app, ~10 talking afterwards.

---

## 1. Consent first — and be exemplary about it

Privacy is the product's core promise, so the test must model it.

Say, roughly: *"I'd like to record the screen and film the room so I can see where the app
confuses people. The video stays on my devices, I'll only share clips if you say yes
separately, and I'll delete anything you want deleted, any time."* Get a yes out loud, on
the recording. If they hesitate at all, run it without the room camera — the screen
recording alone is still worth having.

If you ever want to use footage for marketing, ask **after** the session, once they've seen
what it looks like. Never as a condition of taking part.

---

## 2. What to record — four artifacts

**A. Screen recording with the microphone ON** *(the single most valuable one)*
iOS Control Centre → hold the record button → Microphone **on**. This captures the camera
view, the skeleton, the telemetry strip, the coach's voice, and **their voice** — all on one
timeline. Start it before you hand the phone over.

**B. TelLog CSV** — the app's own export at the end of the session. This is engine ground
truth: every target value, gate, cue and rep, at 10 Hz.
**Why both A and B matter:** they share the same ⏱ clock (built deliberately in v4.3). So
"she hesitated at 0:47" can be aligned to the exact engine state at 0:47 — what it measured,
what it suppressed, what it was about to say.

**C. A second phone filming the room**, side-on, far enough back to see them *and* the
propped phone. This shows what their body actually did versus what the app claimed. It's
also where the marketing footage lives, if it exists.

**D. Your notes.** Paper, not a screen — you'll be tempted to fiddle with a device.
Only two columns: **time** and **what you saw**. Write down every hesitation over ~5
seconds, every look of confusion, and every word they say out loud, verbatim.

---

## 3. The session

**Before:**
- Set up the room the way a real user would: floor space, phone propped on something.
- **Do not demo it. Do not explain it.** Hand them the unlocked phone with the app open and
  say: *"This is a fitness coach that watches you through the camera. Have a go."* Then stop
  talking.
- Let them do calibration. Don't pre-select a tier — the whole design claim is that it works
  this out by watching one plank. If calibration puts them in Building and that's wrong,
  **that is a finding**, not a setup error to correct.

**During — your only job is silence.**
This is the hardest part and the most important. Every question you answer destroys the data
point you came for. If they ask "what do I do now?", say *"whatever you think"*, and write
down that they asked.

The two exceptions: stop immediately if they're doing something that could hurt them, or if
they're distressed rather than just confused.

**Afterwards — ask these, in this order** (open questions first, so you don't lead them):

1. "Talk me through that. What was that like?"
2. "Was there any point you didn't know what to do?"
3. "Did it ever tell you something that felt wrong?"
4. "Did it feel like it was helping you, or judging you?"
5. *(only if a regression was offered)* "When it offered you the easier version, how did that land?"
6. "Would you use this tomorrow morning?"
7. "What would you expect to pay for it, if anything?"

Write answers verbatim, including the hedges and the "umm"s. *"Yeah it was… fine, I think?"*
is data. Don't clean it up.

---

## 4. Decide the criteria BEFORE you run it

Otherwise you'll rationalise whatever happens. Write your predictions down first, then score:

| Measure | How | Pass looks like |
|---|---|---|
| **Completed unaided** | binary | Finished First Steps without asking you anything |
| **Wrong corrections** | count | **Zero.** This is the killer metric — one confident wrong cue loses a beginner permanently |
| **Missed faults** | count | Obvious sag/pike the coach never mentioned |
| **Confusion events** | count | Hesitations >5 s, or "what do I do?" |
| **Felt taught, not judged** | Q4 | Unprompted warmth, not polite agreement |
| **Would use again** | Q6 | An unhesitating yes |
| **The praise moment landed** | screen rec | They visibly react to "there — that's it" |

The last one is worth watching for specifically. If they smile or adjust and hold it, the
core product thesis is working. If it sails past unnoticed, the thesis needs work.

---

## 5. What to send me

- The **TelLog CSV** per session (unedited)
- The **screen recording** (or the parts around any confusion)
- Your **notes**, with times
- The **verbatim answers** to the seven questions
- Your own one-line verdict per person, written before you look at any of it

I can read frames and CSVs but **not audio** — so anything spoken needs to reach me as text.
For any moment where the coach's voice matters, just type what it said and when.

---

## 6. Things that will tempt you, and shouldn't

- **Don't fix bugs mid-test.** Note them, keep going. A broken run with a real reaction beats
  a clean run with a coached one.
- **Don't test on someone who's seen it before.** First contact is unrepeatable, one per person.
- **Don't run all three on the same evening** if the first surfaces something big — fix it,
  then use the next person as the check.
- **Don't defend the app** in the debrief. When they criticise it, say "tell me more."
- **Don't skip the person who says "I'd feel stupid pointing a camera at myself."** That
  reaction *is* the market research; the business plan calls it out as the existential
  unknown.
