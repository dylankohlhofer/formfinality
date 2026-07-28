# Form Coach — what to do next, in order

**Updated after beginner test 01.** The phases below assume you're on **v4.9**.

**Where you are:** thesis validated, five defects fixed, one beginner session to go.

---

## Phase A · Render the pending voice (10 min, ~£1–2.50)

210 clips are unrendered — the framing cues, "slower"/"deeper", the calibration verdict and
the revised opening. Mixed recorded/TTS was probably half of Max's "overlapping voices"
complaint, so this matters before test 02.

```bash
cd ~/Documents/formfinality/voice-render-kit
cp ~/Downloads/render-plan-v4.8.json render-plan.json
rm -f voice/*/*/start.a_0.mp3 voice/*/*/start.b_0.mp3   # the opening line changed
read -s ELEVENLABS_API_KEY && export ELEVENLABS_API_KEY
node render.mjs
rm -rf ~/Documents/formfinality/voice && cp -r voice ~/Documents/formfinality/voice
```

Also worth re-rendering: Warm's `num/2` — Max heard "coo".

## Phase B · Smoke-test v4.9 yourself (15 min)

The shell still has no automated coverage. Specifically check the things that changed:

```
[ ] Side plank demo — the hips visibly LIFT (they never moved before)
[ ] Crunch demo — legs inside the frame, arms no longer zigzag
[ ] Praise disappears after a few seconds instead of lingering
[ ] Praise vanishes immediately if a limb goes red
[ ] Side plank clock waits until you're actually in the shape
[ ] Rep pop lands at the TOP of the movement, not on the way down
[ ] Out of position: ONE spoken cue, then a persistent on-screen message
[ ] Console: zero red errors
```

## Phase C · Beginner test 02 — the gate

Full method in `beginner-test-protocol.md`. Changes for this round:

- **Ask the wrong-corrections question explicitly** in the debrief: *"did it ever tell you to
  fix something that wasn't wrong?"* Test 01's notes didn't cover it directly.
- **Write the time down whenever they hesitate** — the CSV aligns to the frame.
- Everything else as before: hand them the phone, one sentence, then silence.

## Phase D · Score the gate

Both sessions against `swift-port.md`. Pass → pay the Apple fee, start Week 1. Fail → fix in
the browser and re-test, which is exactly why the prototype exists.

---

## In parallel, whenever the Mac is idle

**Set up Claude Code** (`tooling-guide.md`) — half an hour, and the Swift port is precisely
what it's best at. The old first task (reconcile the 23 divergences) is **done** — `verify.mjs`
exits 0 on 4,023 checks and `swift test` passes 15/15, and the demo gate check is now a real
section (`refGates`). First task now: rebuild the lost behavioural suites — cooldown
neutrality, plan completion, regression swaps.

Neither gates the beginner test. Run it in parallel, or after.

---

## Phone setup, if you need it again

The camera needs a secure context, so `file://` and LAN `http://` both block it.

```bash
brew install cloudflared
cd ~/Documents/formfinality && python3 -m http.server 8000     # terminal 1
cloudflared tunnel --url http://localhost:8000                 # terminal 2
```

Open the printed `https://…` URL + `/form-coach-v4.9.html` on the phone, and **check the
header says v4.9**. For testing away from your Mac, drag the folder into Netlify for a
permanent URL.

**Distance depends on the workout** (see `camera-placement-analysis.md`): floor exercises
want the phone low, shin height, ~1.5–2 m back; standing exercises higher and ~3 m back. The
app will tell you if it can't see you.
