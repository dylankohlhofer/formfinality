# Competitive Landscape & Niche Analysis

**Research notes, July 2026.** Companion to the BetterMe teardown.

---

## The uncomfortable finding, first

**Pose-estimation form checking is a commodity.** There is now a drop-in SDK (QuickPose)
whose pitch is literally that a team *"added QuickPose squat tracking to our app in an
afternoon"* — with 95%+ rep accuracy, colour-coded skeleton overlay, and knee-tracking
form analysis. Alongside it: dozens of published papers and open-source repos doing
MediaPipe + joint-angle + state-machine rep counting. That's our exact architecture.

**So the thing we thought was the moat is a weekend integration for anyone who wants it.**

That doesn't make the work wasted — but it does mean the defensible asset has to be
something *other* than "we can see your hips sag." Hold that thought.

---

## Notes on the field

### Peloton — form feedback is real, and it's behind a wall of hardware
- The **Guide** was a $495 camera dongle offering form feedback. It is **no longer on
  sale**; the CPO's line was that the company *"learned a lot from that product"* and that
  users wanted the tools integrated more deeply into the equipment.
- Form feedback now lives in **Peloton IQ**, available only on Bike+/Tread+/Row+ —
  i.e. $2,000–$3,500 machines with a movement-tracking camera.
- On the Guide, feedback was a coloured circle + an audio tone; **no spoken correction**
   — you had to look at the TV to find out what was wrong.
- Context: Peloton is down ~90% from its peak, posting losses, subscribers falling, doing
  repeated layoffs. Not a company executing from strength.

**Read:** the incumbents believe form feedback needs hardware. They also can't do the one
thing that matters when you're face-down on a mat — *talk to you*. Our voice-first,
phone-only approach is genuinely differentiated. But the Guide's withdrawal is a warning:
**form feedback alone did not sustain a $495 consumer purchase.**

### BetterMe — content + funnel machine, no eyes
- 4,000+ workouts, meal plans, 1-on-1 human coaching as a paid add-on.
- Growth engine is dozens of segmented web quiz funnels, one per persona.
- Reviewers explicitly note it *isn't ideal for those who want audible coaching*, and
  that its AI-led videos *may not present an exercise in a way that's natural for your
  body to move*. Nobody is watching the user.
- Reputation liability: extensive billing/cancellation complaints (see the earlier teardown).

### Hinge Health / Sword Health / Kaia — the serious players, and they're not in our lane
- MSK (musculoskeletal) conditions are a **~$1.3 trillion annual burden in the US**.
- **Hinge Health**: ~18–20M contracted lives, decacorn, partnerships with all five major
  national health plans. Sensors + computer vision + human clinicians.
- **Sword Health**: ~$3B valuation, ~22% of the employer-sponsored digital PT market.
- **Kaia Health**: smartphone camera CV, *no wearables* — the closest technical analogue
  to us. Priced around **$14.99/month** direct.
- **Sword acquired Kaia** (announced ~Jan 2026), consolidating the space.
- **Crucially: they all sell to employers and health plans, not to patients.** Kaia's
  lower-friction app was valued by Sword mainly as a cheaper *acquisition funnel* into
  enterprise contracts.

**Read:** the money in "watching someone exercise" is real and enormous — but it's been
routed entirely through enterprise benefits departments. **The individual patient is not
being served.**

---

## The gap: nobody is verifying the exercises your physio actually gave you

The adherence literature is damning, and consistent:

- Non-adherence to prescribed physiotherapy exercise runs **as high as 70%**, and is
  *particularly poor for unsupervised home exercise programmes*.
- **65% of patients abandon their programme within the first month**; only ~35% fully adhere.
- One systematic review pooled patient adherence to prescribed exercise at **21%**.
- And the line that should make us sit up: **"Self-reported adherence is notoriously
  unreliable."**
- Also: **fewer exercises = better adherence.** Patients prescribed 2 exercises outperform
  those prescribed 8; 4+ exercises measurably reduces compliance.

Now re-read our own architecture. We built:

- `VerificationLevel.cameraVerified` — machine proof a specific movement happened to a
  measured standard
- a duo streak that only advances on **verified** sessions ("a streak you can't fake")
- a coach that *talks*, so it works when the user is face-down and can't see a screen
- a tiny exercise library (a liability in the fitness market — an **asset** in rehab)
- zero server cost, video never leaving the device

**We didn't build a form-checking app. We accidentally built the only consumer-grade
solution to the verified-adherence problem.** That's the asset — not the pose estimation.

---

## Niche scorecard

| Niche | Size of pain | Fit with what we've built | Can a solo dev reach them? | Risk |
|---|---|---|---|---|
| **Physio homework / rehab adherence** | Enormous (70% non-adherence) | Excellent — verification *is* the product | **Yes** — physios are the distribution | ⚠️ Regulatory framing |
| Calisthenics / skill progression | Moderate (enthusiasts) | Very good — form obsession is the culture | Yes — Reddit/YouTube communities | Low |
| Fall prevention (65+) | Enormous, clinically urgent | Good (Otago is a fixed protocol) | Hard | Camera setup friction is brutal for this group |
| Postnatal core / diastasis recti | Large, underserved | Good | Medium | High clinical risk; user has a newborn and no free hands |
| Desk-worker posture | Broad but shallow | Weak (posture ≠ discrete reps) | Yes | Low willingness to pay |
| General ab/core fitness *(current)* | Crowded, commoditized | Fine | **No — this is the CAC problem** | Low |

---

## Recommendation: reposition as the physio-homework app

**The pitch:** *"Your physio gave you exercises. This makes sure you actually do them —
and do them right."*

Why it's the strongest fit:

1. **It solves our fatal weakness.** A one-time £4.99 purchase can't fund paid ads, so we
   need distribution we don't pay for. **A physiotherapist with 200 patients is a
   distribution channel** — and they have a professional incentive to recommend us, because
   our verified-session log tells them something they have literally never been able to
   see: whether the patient did the work, and whether it looked right.
2. **One-time purchase beats subscription *here*, structurally.** Rehab is finite — 6 to
   12 weeks. Nobody wants a monthly subscription for a temporary problem. Kaia charges
   ~$15/month. "Pay once, £4.99, it's yours" isn't just friendlier; in a finite-duration
   use case it's the *correct* pricing model. That's a genuine edge, not just positioning.
3. **Our small library becomes correct.** In fitness, 7 exercises is embarrassing next to
   BetterMe's 4,000. In rehab, prescribing 2 exercises *beats* prescribing 8. The
   literature is on our side.
4. **The duo streak gets a much better second player.** Not "a friend who also wants abs" —
   your **physio**, or the family member nagging you to do your knee exercises. Sharing a
   verified-session log with your clinician is a vastly more compelling reason to invite
   someone than a shared plank streak.
5. **Privacy stops being a nice-to-have.** "Video never leaves your phone" is pleasant in
   fitness. In health, it's close to a requirement.
6. **The engine doesn't change.** Exercises are JSON. Clamshells, bird dogs, heel slides,
   straight-leg raises, wall squats and glute bridges are the same
   `angleAt(vertex, a, c)` + state machine we already have. **We change a data file and the
   copy, not the architecture.** This is the payoff for having made cue logic data-driven.

### The risks — and these are real

- **⚠️ Regulatory is the one that can kill it.** The instant we claim to *diagnose* or
  *treat*, we're a medical device (FDA / UK MHRA). The app must stay firmly on the
  adherence-and-technique side of the line: *the clinician prescribes; we count, check
  technique, and report.* No diagnosis, no treatment claims, no "your back pain will
  improve." Get a professional opinion before shipping a single word of health copy.
- **Liability of being wrong.** Telling someone post-op their form is fine is a different
  proposition to telling a gym-goer their plank is sloppy. The coach's voice must be
  advisory, deferential to the clinician, and conservative.
- **Clinician sales is a grind.** Physios are busy and sceptical. But the entry point is
  cheap: one local practice, ten patients, a free-forever tier for clinicians.
- **We'd be adjacent to giants.** Hinge and Sword have billions. But they've deliberately
  chosen enterprise; a £4.99 consumer app is beneath their unit economics, and it's beneath
  them to defend. That's exactly the kind of gap a solo dev can live in.

### The hedge, if the regulatory risk feels too heavy

**Calisthenics / bodyweight skill progression** (r/bodyweightfitness territory: push-ups,
dips, pull-ups, pistol squats, L-sits). No regulatory exposure whatsoever, a culture that
is *already obsessed with form*, community-driven distribution, and an audience that
happily pays once for a good tool. Smaller ceiling, near-zero downside.

---

## What to do next

1. **Don't rebuild anything yet.** Tune the thresholds on your own body first — that work
   is identical in every niche.
2. **Talk to two physiotherapists this week.** Show them the browser prototype. Ask one
   question: *"If your patients used this, and you could see which sessions they actually
   completed and how their form scored — would that be worth anything to you?"*
3. Their answer decides the whole strategy. If they light up, you have a distribution
   channel and a real business. If they shrug, take the calisthenics hedge and keep the
   one-time-purchase pitch aimed at people who resent BetterMe's billing.

The engine works either way. That's the point of having built it the way we did.
