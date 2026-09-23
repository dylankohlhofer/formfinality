# Form Coach — Business Plan

> Historical July plan. Read [the September commercial decision](business-model-2026-09.md)
> for current economics and launch sequencing. Claims below of zero marginal cost,
> profitability at ~45 sales, a shipped PWA and retired technology risk are not
> current facts. `project-status.md` controls implementation/verification status.

**July 2026 · Solo founder · Pre-launch**
**Product:** an on-device AI exercise coach for beginners training at home.
**Model:** one-time purchase (~£4.99), zero marginal cost, no subscription.

This plan is grounded in the product as built (browser prototype v4.4), the competitive
research conducted during development, and the strategic decisions already made — including
the ones we deliberately rejected.

---

## 1. Executive summary

Form Coach watches a person exercise through their phone camera and coaches them out loud,
in real time, like a trainer would: it teaches the movement, corrects the single most
important fault, praises the fix at the moment it happens, and offers an easier variant
kindly when someone can't hold the shape. It is built for the largest and least-served
fitness audience — **people who don't know how to exercise** — whose defining, unanswered
question is *"am I doing this right?"* No mirror, video or app currently answers it. Form
Coach answers it in real time.

Everything runs on the device: pose estimation, coaching logic, and (post-render) a human
voice from pre-generated clips. There are no servers and therefore no marginal cost, which
makes a **one-time £4.99 price** economically sound and strategically sharp: the category
leader's defining reputation is subscription-billing resentment. *"Pay once. Nothing to
cancel."* is both the pricing and the positioning.

The technology risk is largely retired — the engine is validated by ~100 automated checks
and several rounds of real-video debugging. The open risks are, in order: **distribution**
(a £4.99 product cannot buy ads), **calibration** (thresholds are untuned on real bodies),
and **first-contact trust** (a coach that is confidently wrong once loses a beginner
forever). The plan below is structured around those three.

---

## 2. The problem and the customer

The customer is an adult who wants to get stronger at home and has never really trained.
They won't go to a gym (cost, intimidation), won't hire a trainer (cost), and follow-along
videos can't see them. Their experience of exercise is a loop of: start → be unsure
whether it's working or safe → feel silly → quit. The specific moment that kills them is
mid-movement doubt: *is my back supposed to feel like this? Is this a plank or am I doing
it wrong?* Nobody and nothing in their life can answer at the moment it's asked.

Two design consequences follow, and they shape the whole product. First, **the most
valuable sentence the coach says is not a correction — it's "that's it, that's exactly
right."** A beginner has no proprioceptive reference; telling them what correct feels like,
while they're feeling it, is the product's core moment. Second, **restraint is a feature**:
the Learning tier limits the coach to one correction per set, never shows a numeric score,
and offers regressions (knee plank, wall push-up) framed as the right step rather than a
failure.

The same engine serves people who already train — the Strong tier grades the identical
movement harder, talks in single words, and runs 1.5× the sets — which widens the market
without diluting the beginner focus.

---

## 3. Product status

A fully working browser prototype (v4.4): 21 movements across core, functional and
mobility work; three expertise tiers with distinct dialogue, strictness and workload; a
calibration plank that *infers* the tier so no one is ever asked "are you a beginner?";
generated demonstration animations validated by the engine itself; per-session insight
that distinguishes fatigue from technique; a CSV telemetry pipeline for calibration; and a
mobile-installable build (PWA) testable on a phone today. The voice architecture supports
pre-rendered neural clips at a one-off cost of roughly £2–6 for the entire script.

Not yet done: threshold tuning on real bodies, beginner user testing, the native iOS port,
onboarding, and the Progress/Fuel/Duo feature set specified in the design docs.

---

## 4. Why the moat is not the algorithm

Pose-estimation form checking is a commodity. Drop-in SDKs advertise adding squat tracking
"in an afternoon," and open-source implementations of the joint-angle/state-machine
approach are plentiful. Anyone can detect a sagging hip.

What is genuinely hard, and where this project has spent its effort, is the **judgment
layer**: knowing which of three simultaneous faults to mention and which two to swallow;
grading the same 168° body line as excellent for a beginner and mediocre for an athlete;
refusing to start the clock while someone is still kneeling down; refusing to claim things
a 2D camera cannot see; offering the knee plank in a way that feels like care rather than
demotion; and speaking *now*, not twelve seconds late. That layer is encoded in tuned
thresholds, a tested cue-selection policy, tiered dialogue (176 line-banks), and a set of
honesty rules — craft and data, not an algorithm a competitor can license. The moat
deepens with every real body the thresholds are tuned on.

---

## 5. Business model and unit economics

One-time purchase at **£4.99** (price-testable later; £5.99–£7.99 plausible once reviews
exist). Under Apple's Small Business Program (15% commission) and after UK VAT, net
proceeds are approximately **£3.50 per sale**. Marginal cost per user is zero: pose
estimation, coaching logic and voice playback are on-device; there is no backend. The duo
streak, when built, uses the user's own CloudKit quota.

Fixed annual costs are on the order of £150 (Apple developer program, the one-off voice
render, incidentals). The consequence is unusual and worth stating plainly: **the business
is profitable at ~45 sales a year.** Every question that matters is a distribution
question, not a margin question. A subscription would not change that calculus — it would
only import the category's most hated attribute into the one product positioned against it.

Illustrative outcomes at £3.50 net: 1,000 sales → £3.5k; 10,000 → £35k; 50,000 → £175k;
250,000 → £875k. The realistic first-year goal is the 5–15k band, achieved organically.

---

## 6. Competition

| Player | What they are | Their weakness → our wedge |
|---|---|---|
| **BetterMe** | Content + funnel machine: 4,000 workouts, dozens of segmented web quiz funnels, subscription | Reviewers note it isn't ideal for anyone wanting *audible coaching*, and its videos can't see you. Extensive public billing/cancellation complaints. **It claims personalisation; we measure it. It bills monthly; we don't bill again.** |
| **Peloton** | Form feedback via Peloton IQ — after discontinuing the $495 Guide camera | Feedback locked behind $2–3.5k hardware, and delivered visually, not spoken. **We do it on the phone they own, out loud.** The Guide's withdrawal is also a caution: form feedback alone didn't sustain a $495 purchase — coaching relationship must carry it. |
| **Hinge Health / Sword (acquired Kaia)** | The serious computer-vision players, ~$1.3tn MSK market | They sell to **employers and insurers**, not people. Kaia's consumer app priced ~$15/month. The individual is structurally unserved — and beneath their unit economics to pursue. |
| **QuickPose-class SDKs / rep-counter apps** | Commodity pose tech | Rep counting without coaching judgment. They validate the input and leave the product unbuilt. |
| **Follow-along video (YouTube, Apple Fitness+)** | Free, high production value | Cannot see the user. The entire category shares one blind spot, literally. |

The pattern across the table: everyone with eyes sells to enterprises or hardware buyers;
everyone selling to consumers is blind. The consumer who wants to be *watched and talked
to* by something affordable has no option. That's the position.

---

## 7. Positioning

Five pillars, each a sentence a user could repeat:

**It actually watches you.** Not a video you copy — a coach that sees your hips drop.
**It talks to you.** Face-down in a plank, a screen is useless; a voice isn't.
**Pay once. Nothing to cancel.** Direct strike at the category's reputation.
**Your video never leaves your phone.** The precondition for a self-conscious beginner to
point a camera at themselves at all — privacy here is emotional, not legal.
**It starts where you are.** No quiz; it watches one plank and calibrates. The word
"beginner" never appears in the product.

---

## 8. Go-to-market under a zero-CAC constraint

The constraint is absolute: at £3.50 net there is no paid-acquisition math that closes.
Every channel must be free, and the product must supply its own marketing assets.

**Phase 0 — proof (now).** Tune thresholds on 3–5 bodies; run the beginner tests. Film
them (with permission): the single best asset this product can own is footage of a real
novice hitting the *"there — that's it, hold that"* moment. The test session and the
launch trailer are the same hour of work.

**Phase 1 — soft launch.** TestFlight with the test cohort and their friends (the duo
mechanic seeds here naturally — beginners overwhelmingly start in pairs). Iterate the
first session until unsupervised strangers survive it.

**Phase 2 — launch, three organic channels.**
*Search intent:* beginners don't hang out in fitness communities, but they search — "am I
doing a plank right," "core workout for beginners at home." Short-form video (the demo
skeleton catching a sag is inherently watchable) and a small content site target exactly
those queries.
*App Store:* borrow BetterMe's one genuinely good idea — segmentation — legally and
cheaply: multiple creative angles ("learn to exercise at home," "fix your plank," "core
after 40") tested via product-page optimisation rather than multiple apps.
*Press/communities:* the anti-subscription angle is a story journalists already want to
write; "pay-once app takes on BetterMe's billing complaints" pitches itself. Indie-dev and
privacy communities are sympathetic amplifiers.

**Phase 3 — the loop.** The **duo streak** is the only built-in viral mechanic: a shared
streak that only advances when both people's sessions are camera-verified. It was
originally scheduled late; this plan moves it immediately after v1 launch, because it is
the sole channel that compounds.

---

## 9. Roadmap with decision gates

| Milestone | Gate it must pass |
|---|---|
| Threshold tuning (self, then 3–5 bodies) | False-alarm rate near zero on clean form; faults caught within ~1s |
| **Beginner tests (2–3 true novices)** | **The go/no-go gate for the whole plan.** They must feel taught, not judged; the one-cue rule must read as support; at least one unprompted "oh, that's cool" |
| Voice render + first-session polish | A stranger completes First Steps unaided |
| Swift port (engine parity via ported test suites) | All ~100 checks green on-device; Vision orientation verified on hardware |
| TestFlight (20–50 users) | Week-2 return rate among beginners; zero "it told me something wrong" reports |
| v1 App Store launch | — |
| Duo streak (CloudKit) | Invite → install conversion measurable |
| Fuel / Progress / packs | Only after the loop exists |

If the beginner-test gate fails on the coaching feel, the fix is dialogue and pacing —
cheap. If it fails on the concept ("I wouldn't point a camera at myself"), that is
existential information best learned before the Swift port, which is exactly why the port
waits.

---

## 10. Risks

**Distribution (existential).** Named throughout; mitigations are Phase 2's channels, the
duo loop's promotion up the roadmap, and launch assets manufactured from testing. Accepted
honestly: this remains the most likely failure mode.

**Trust — being confidently wrong once.** A beginner corrected for a fault they weren't
making doesn't argue; they delete. Mitigations are structural: the honesty rules (guided
movements make no claims), tier-scaled tolerances, the testing discipline, and tuning
before any stranger touches it.

**App review / health positioning.** The app must remain a fitness coach, not a medical
device: no diagnosis, no treatment or pain-outcome claims, camera-usage strings that
explain on-device processing. The privacy architecture is an asset here.

**Platform risk.** Apple could ship form feedback in Fitness+. Defences are depth in the
beginner niche, speed, and the fact that a £4.99 independent with a kind coach is a
different product from a platform feature. Real, unhedgeable, accepted.

**Solo capacity.** One person builds, tests, markets. Mitigated by the data-driven content
model (new movements are JSON), the test suites (refactoring safety), and this
documentation (bus-factor reduction).

---

## 11. Opportunities beyond v1

**Content packs as pure data.** New movement families (mobility flows, resistance-band
work) are content drops, not engineering. Potential as paid packs — one-time, never
subscription — once the base has an audience.

**Localisation is unusually cheap here.** Dialogue is a JSON cascade and the voice is a
render script: a language is a translation pass plus a ~£5 re-render. The beginner-at-home
problem is not an anglophone problem.

**The duo graph.** If the streak works, the pair is the unit of growth — and later, small
groups ("our household's streak") without any social-network buildout.

**The calisthenics hedge.** A community that is *already* form-obsessed
(r/bodyweightfitness culture), reachable for free, happy to pay once. If beginner
acquisition stalls, the same engine pivots its marketing, not its code.

**A PT-companion channel (distribution, not product).** Human personal trainers assigning
Form Coach for homework between sessions — no clinical claims, no enterprise sales, just a
referral motion. Kept deliberately small unless it pulls.

---

## 12. What was considered and rejected — and why it stays rejected

**Physiotherapy homework.** Scored highest on paper: 70% non-adherence, clinicians as free
distribution, finite-duration use fitting one-time pricing. Rejected because the founder
doesn't want that market — and a solo product in a grinding, regulated, clinician-sales
channel without founder passion fails slowly and expensively. The underlying insight was
kept: verification matters when a judge exists; for our user, the judge is their own doubt.

**Military fitness-test prep (ACFT plank grading).** Uncanny product fit, real stakes,
free distribution — and the wrong identity. This is a coach that builds people up, not a
grader that passes or fails them. The Sergeant persona was deleted for the same reason.

**Subscriptions, servers, enterprise.** Each would trade away the exact properties —
trust pricing, privacy, zero cost base — that make the product defensible for one person
to run.

The through-line of every rejection: the product is *a kind coach for people starting from
nothing, that they buy once and own.* Decisions that serve that sentence stay; decisions
that don't, go.
