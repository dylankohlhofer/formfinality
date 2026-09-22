# Form Coach — feature feasibility study

Every outstanding idea, from Max's test-01 feedback and from our own brainstorming,
assessed for cost, dependency and confidence. **July 2026, against v4.9.**

---

## The three things that decide everything below

**1 · Where a feature lives decides what it costs.** The engine ports to Swift for
free — change it once, regenerate vectors, `swift test` names any divergence. The
**shell does not**: every shell feature is built twice, once in HTML and once in
SwiftUI. A day of engine work is a day. A day of shell work is closer to two.

**2 · Six features are actually one feature.** History, streaks, the calendar,
performance-based level drift, long-term plans and progress stories all require a
**persistence layer that does not exist**. Assessing them separately makes six
medium features look tractable; they are one large one with five follow-ons.

**3 · Validated beats invented.** Max asked for some of these. Others are ours.
That difference should outrank effort estimates — a cheap feature nobody wants is
worse value than an expensive one somebody asked for.

---

## Tier 1 · Cheap, validated, buildable now

| Feature | Effort | Notes |
|---|---|---|
| **Warm's "two" re-render** | minutes | One clip. Max heard "coo" |
| **Rest durations** | minutes | One constant — but needs a deliberate number, not a guess |
| **"You've just done one"** after plank calibration | minutes | Copy. Max was surprised the first exercise repeated calibration |
| **Demo canvas square** | one line | Post-#43 the demo fits a square into a 480×340 box, losing ~29%. Only if it reads small on screen |
| **Countdown before arming** | half day | *"Hold it — three, two, one, go."* Every piece exists (`cd` cue, num clips, the dial). Directly answers Max's "GET SET was misunderstood" |
| **Per-exercise debrief** | half day | *"Way too broad, no real feedback the user can use."* The data is **already logged** — cues, scores, rep events, per movement. Pure presentation |

**All six are shell-side**, so each is built twice. Still worth it: together they
answer four of Max's seven complaints for about a day and a half.

## Tier 2 · Real work, clear value

**Demo + synchronised audio** — *1–2 days.* Max's own suggestion, and the fix for
the "teach lines are 12–16 s against a static screen" problem. Currently the teach
line plays and the animation loops independently. Narrating *while* the figure moves
is far more instructive than either alone. Needs a timing model (which label belongs
to which keyframe) and it's shell-side.

**Rep counted at the peak, outright** — *1 day.* v4.9 fires the *acknowledgement* at
the up-crossing but still counts on the return. Counting outright matches intuition
completely. **Moves 120 tempo vectors and needs a Swift mirror** — the anti-divergence
rule makes this a deliberate, sequenced change, not a quick edit.

**Custom workout builder** — *2–3 days.* Requested twice independently. UI, plan
construction, validation, persistence of the custom plan (a small one — but see
Tier 4). Genuinely useful, but it serves people who **already know what they want**,
which is not the beginner you're validating against.

**Circuit sets vs straight sets** — *1 day + a decision.* Modest change to
`expandPlanSteps`. But there's a real coaching tension and no data to settle it:
circuits aid engagement and fatigue management; **straight sets aid learning form**,
because a correction you receive then act on twice more actually lands. A
tier-aware split (straight at Learning, circuits above) fits the architecture, and
that is a decision to make, not a feature to build blind.

## Tier 3 · Engine work, ports free

**Per-movement tier drift** — *2–3 days.* You were right that a plank measures core
endurance and nothing else. Letting tolerance drift per movement based on observed
performance is a much better answer than a 30-second calibration. **Engine-side, so
it ports free**, and it's the most intellectually interesting item on this list.
Needs a design: what evidence is enough, how fast to move, how to avoid feeling
arbitrary. *Blocked on persistence for cross-session drift; within-session is
buildable now.*

**Rebuild the behavioural suites** — *1 day.* Cooldown neutrality, plan completion,
regression swaps. Lost with the sandbox, never recovered.

**Orphaned movements into plans** — *hours + a decision.* `hollow-tuck` and
`hollow-hold` are built, tested, gated and unreachable. `core-strength` fits
`hollow-hold`. Programming judgement, not engineering.

**Rebuild `gen-refs.mjs`** — *2–3 days.* The FK rig that authored every demo. Its
absence is why keyframes are hand-authored. `refGates` + `verify-draw` now cover
what it used to assert, so this is *quality-of-life for future demo work*, not a
gap. Only worth it if demos need substantial re-authoring — which test 02 may say.

## Tier 4 · The persistence cluster — one prerequisite, five follow-ons

**Nothing here is buildable without a storage layer**, and that layer is not just
engineering. It is a **promise upgrade**: today "nothing leaves your device and
nothing is kept" is trivially true. Store training history and you must be able to
say exactly what is kept and let people erase it.

```
        ┌─ persistence layer (~2 days browser, Week 4 native) ─┐
        │                                                     │
   history/calendar    streaks    level drift    long plans    progress stories
      (1 day)         (1 day)     (see T3)        (1 day)        (3+ days)
```

**A note on streaks specifically.** They are the most manipulative pattern in
consumer fitness — they work by making people feel bad about breaking one, and the
person most likely to break one is a nervous beginner who missed two days. That is
precisely your user. Kinder shapes keep the compounding without the anxiety:
consistency over a rolling window ("12 of the last 30 days"), grace days, or
celebrating a return rather than punishing absence. Your own instinct already leaned
this way — you noted the difficulty bump should be gated on **performance**, not
attendance.

**Also: persistence is shell/platform work, so it is built twice.** Browser
`localStorage` and SwiftData share a design, not code. This is the strongest
argument for doing it **after** the port rather than before.

## Tier 5 · Post-port by necessity

| Feature | Why it waits |
|---|---|
| **Voice trigger ("Go")** | Browser speech recognition is **cloud-based** — breaks the privacy promise. iOS `SFSpeechRecognizer` supports on-device, so it's feasible natively. Complication: the coach talks constantly and its teach lines contain the word "go", so recognition must gate on `speaking()` plus handle speaker echo |
| **Background music / Spotify** | iOS audio-session ducking is native and easy; the Spotify SDK is a bigger lift than it looks |
| **Localisation** | Fish Audio S2.1 Pro's 83 languages fit a bundled-audio, zero-marginal-cost product well. But **translation is the work**, not TTS — 84 dialogue keys × 3 personas × 3 tiers, and coaching language doesn't translate literally |
| **3D / any-angle** | Needs 3D world landmarks with a hard validation gate (≤4°). Real research, not a feature |

## Tier 6 · Rejected, and why

**Medical data → exercise recommendation.** The physio pivot through a side door.
Changes the product from a kind coach into a clinical tool: App Store medical
scrutiny, real liability, possible MHRA territory. Reading HealthKit *activity* is
fine; reading *conditions* to select exercises is a different company.

**Social sharing / invite-to-streak / progress stories.** Not rejected on merit —
these are the only compounding growth loops in the plan. But all three depend on
persistence *and* on people wanting to be seen doing this, which is precisely the
thing your business plan flags as the existential unknown ("I'd feel stupid pointing
a camera at myself"). Build after you know.

---

## What test 02 could change

Worth naming, because it argues for waiting:

- **If the demos still don't teach**, `gen-refs.mjs` jumps from Tier 3 to urgent and
  the demo+audio work reshapes around it.
- **If the debrief lands as "still too vague"**, per-exercise moves from half a day
  to a redesign.
- **If they never mention timing**, the countdown was enough and the voice trigger
  drops off the list entirely.
- **If someone can't complete a session unaided**, everything here is premature and
  the answer is a different onboarding.

---

## Recommended sequence

**Before test 02** — Tier 1 only, and only the cheap half: the `num/2` re-render,
the rests constant, the calibration copy line, and the **countdown**. Roughly a day.
Each answers something Max actually said, and none changes what the test measures
beyond fixing what he complained about.

**Immediately after test 02** — per-exercise debrief and demo+audio, informed by
whether the second session repeats those complaints.

**Then the port.** Every Tier 3 item ports free; every Tier 1/2/4 item built first
gets built twice. That is the strongest argument for a lean pre-port feature set:
**you are currently paying double for everything shell-side.**

**After the port** — persistence, and the five features that depend on it, designed
once against SwiftData rather than twice.
