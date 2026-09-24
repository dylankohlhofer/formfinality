# Form Coach — historical July backlog

**Superseded for current planning:** use [the reconciled chat backlog](chat-backlog-2026-09-24.md)
and [implemented feature inventory](feature-inventory.md), updated 24 September.
The entries below preserve the original ideas and reasoning, not current feature
status or launch requirements. The shell now has automated coverage; local history,
weekly goals and bounded local AI selection exist. There is no installable/offline
PWA, connected CloudKit Duo, automatic ability progression or unrestricted AI coach.
Current contracts override historical suggestions about fixed camera distances,
score-derived fitness levels, cloud costs and planned release dates.

Captured from Dylan's notes, July 2026. Triaged, not just listed: each item has a verdict
so future-you doesn't relitigate settled calls at 2am.

**Key:** 🔴 do before launch · 🟡 v1.x · 🟢 later / if it earns it · ⛔ rejected (with reason)

---

## Engine & coaching honesty

🔴 **Movement honesty audit** — which exercises we give real guidance on, which we don't.
*Done: see `honesty-audit.md`. Findings are significant — 15 targets penalise silently.*

🔴 **Tolerance for low-variance movements.** Dylan's instinct: movements with small ranges
of motion may not be picked up. *Audit result: the tolerance geometry is actually sound (no
target is decorative at any tier). The real problem was silence, not sensitivity.*

🔴 **Clothing guidance.** Baggy trousers genuinely degrade pose estimation — loose fabric
moves independently of the joint. Also: contrast against background, bare feet or shoes
consistently. Belongs in the setup screen.

🔴 **Space + camera distance guidance.** "About 2–3 m back, enough floor space to lie down
with arms overhead." Currently the app assumes the user works this out.

🟡 **Calibration validity.** A plank measures core endurance and nothing else — someone can
hold 40 s and squat badly. *Direction: keep the plank as the opening read, then let tier
**drift per movement** based on observed performance. Real design work; before launch.*

🟡 **Strength-building progression.** What actually makes someone stronger over weeks, not
just "harder sets". Needs a considered progression model, not a difficulty multiplier.

---

## From user feedback (July, session testing)

🔴 **Countdown ticks per second** — *fixed.* "Three. Two. One." was one spoken line
arriving all at once; it's now three timed `num` emissions on the actual seconds, using the
already-rendered number clips.

🔴 **Framing must ignore irrelevant limbs** — *fixed.* The framing gate blocked arming if
*any* joint left the frame; a crunch with feet out of shot couldn't start. Now derives the
joints each movement actually measures from its metric specs (same content-as-data trick as
the tint) and only insists on those. A crunch ignores feet; a plank still requires ankles,
because it genuinely grades them. This is "only correct what you can measure" applied to
setup.

🟡 **Circuit-style sets (rounds, not straight sets).** Currently a plan is a linear list and
sets repeat per exercise. The request is: do one round of every exercise, then repeat the
round. *Assessment: a real change to the plan model — `PLANS` gains a round structure and
`expandPlanSteps` changes shape. Moderate engine work (~half a day) plus re-vectoring, and
it changes rest pacing and the debrief's per-phase rows. Worth doing, but it alters the
thing the beginner test measures, so after the gate.*

🟡 **Workout customisation from the start** ("+2 sets of push-ups, +1 crunches, +3 planks").
*Assessment: needs the plan model above to land first — a custom workout is exactly a
user-authored plan. Then it's a builder UI, which is shell work that doesn't port. Best
sequenced: circuit model → persistence → builder.*

🔴 **Workout history on a calendar, feeding back into level assessment.** *Assessment: this
is the most strategically valuable item in the list, and it subsumes two existing entries —
the streak mechanism and the calibration-validity problem.* A durable record of what you
did and how well you did it is exactly the evidence needed to replace the one-plank tier
guess with per-movement tier drift. It also keeps the data on the user's device, which the
privacy promise already demands. **But it's the app's first real persistence layer** — no
user data currently survives a reload — so it carries a schema, a migration story, and an
explicit "delete my data" obligation. Design first, build after the gate.

## Streaks, plans & progression

🔴 **7-day streak → suggest a difficulty increase.** Good. *Amendment: gate on performance
as well as attendance — showing up 7 times doesn't mean you've earned harder. The streak is
the moment to ask; form scores are the evidence.*

🟡 **Long-term plans with a user-specified duration.** "Follow this for 6 weeks." Fits the
one-time-purchase model well — a finite arc with an end, not an infinite feed.

---

## Growth & distribution

🟡 **Invite to a streak via social media.** The duo streak is the only compounding loop in
the plan; a share sheet is the cheapest possible version.

🟡 **TikTok-style progress stories.** Auto-generated recap of a plan's arc. Strong fit: the
skeleton overlay is inherently watchable, and it's zero-CAC marketing generated by users.

🔴 **Slogans and marketing before release.** Business plan already has the pillars ("Pay
once. Nothing to cancel." / "A coach that actually watches"). Needs turning into store copy,
screenshots and a trailer.

🟢 **Competitor aesthetic research.** Transitions, polish, onboarding feel. Worth a focused
afternoon — *look at their motion design, not their business model.*

---

## Platform & integrations

🔴 **Bluetooth audio.** Mostly a win: private (nobody else hears you being coached) and the
voice is in your ear. **But** BT adds ~150–200 ms latency and "late coaching is wrong
coaching" is a locked principle. *Measure during the phone tuning pass; if >400 ms, tighten
TTLs when output is BT.*

🟡 **Background music, possibly Spotify.** Must duck under the coach, never compete. iOS
audio-session ducking handles this natively; Spotify SDK is a bigger lift than it looks.

🟢 **Further AI integrations.** Deliberately vague for now — revisit only if something
becomes core, because anything LLM-shaped reopens the server question.

⛔ **Medical data → exercise recommendation.** *Rejected.* This is the physio pivot (business
plan §12) arriving through a side door: it turns a fitness coach into a clinical tool —
App Store medical scrutiny, real liability, possible MHRA territory. Reading HealthKit
*activity* ("you've been consistent this week") is fine and stays open. Reading *conditions*
to select exercises is a different company.

---

## Architecture & strategy

🟡 **Is server-side freedom holding us back?** *Assessment: no, not yet.* Cloud pose
processing would be worse (latency) and would destroy the privacy claim. CloudKit gives duo
streaks free. What zero-server actually costs: cross-platform sync beyond Apple,
server-side A/B testing, and any LLM feature. None are v1. **Treat it as an asset, not a
sacred rule** — reassess if an LLM feature ever becomes core.

🔴 **Multi-angle / camera placement.** Partially answered in v4.5: the engine estimates how
side-on the body is and degrades honestly (coaches the view-invariant subset, suppresses
depth cues, asks the user to turn when it can't read them). *Open: full any-angle parity
needs 3D world landmarks — the P1 experiment with its ≤4° validation gate.*

🔴 **Define the Swift port baseline.** What's ported, what Dylan owns, what the timeline is.
*Done: `swift-port.md` — 7 weeks, gated, with model allocation.*

🔴 **Apple Developer fee — don't pay until ready.** *Adopted, and it corrects my earlier
advice.* Enrolment takes days, not weeks. Pay when the beginner test passes.

🔴 **An intermediate mobile testing route that isn't Swift.** *Exists today: the PWA.* Add
to home screen, full-screen, camera works. Good enough for tuning and beginner tests. The
only thing it can't do is App Store distribution.

---

## Process & documentation

🔴 **Simplify the technical documentation + add a glossary.** *Fair criticism — accepted.*
The current doc was written for a porting engineer, not for you. Needs a plain-language
system overview and a glossary of every term the project has invented (target, gate, tier,
persona, arming, priming, cue budget, sideness, effect stream…).

🔴 **Test individual features.** Currently the suites test the engine exhaustively but
**nothing tests the UI shell** — the Session refactor replaced live DOM code with an
effect-replay layer that has zero coverage. Manual smoke test needed at minimum.

🟡 **Study mobile app development fundamentals.** Worth doing during the Swift port —
learning against a real codebase beats tutorials.

---

## Sequencing view

**Before the beginner test:** clothing + space guidance, UI smoke test.
**Before launch:** honesty-audit fixes, calibration drift, marketing copy, BT latency check,
simplified docs + glossary.
**v1.x:** streak difficulty bump, long plans, share-to-streak, music ducking.
**Later:** progress stories, competitor polish pass, 3D any-angle.
