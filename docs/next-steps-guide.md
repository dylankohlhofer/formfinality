# FormFinder — next steps

Updated 24 September 2026. The browser build is still `form-coach-v4.11.html`.
Use [project status](project-status.md) for the last measured checkpoint,
[feature inventory](feature-inventory.md) for implemented capabilities, and
[chat backlog](chat-backlog-2026-09-24.md) for every retained request and decision.

## 1. Check the current build

```sh
npm ci
npx playwright install chromium firefox webkit
npm test
```

The existing suite covers the engine, browser, shell, interruptions, recorded
audio and deliberate fault controls. Missing human-video fixtures remain gaps.
Run one heavy browser/audio suite at a time; preserve failures even if a repeat
passes. On the supported Mac, `swift test --package-path swift/FormCoachEngine
--jobs 1` checks the native modules. Native session cores and a store app remain
future work.

For an unpublished, self-contained static review directory:

```sh
npm run test:setup-video
npm run test:release
npm run build:web -- --out dist/web-review-next
npm run test:release:smoke -- --dir dist/web-review-next
npm run test:camera -- --dir dist/web-review-next
node verify.mjs dist/web-review-next/index.html
```

Choose a new output directory for each build; existing outputs are protected.
The camera test exercises the real model and app in Chromium, Firefox and WebKit
with generated blank streams, including disconnect/restart/End. It does not test
human recognition or a physical phone. Read [web release](web-release.md) before
sharing an artifact. Never serve, tunnel or publish the repository root, which
contains development material and may contain private local evidence.

## 2. Finish the speech review

Use the [local voice audit](voice-library-audit.md) to screen the library and
prioritise listening. Start with all three voices' numbers 1–20, especially Warm
“two”; compare the original clips with the actual application recordings in the
audio reports. Decoding, measurable signal and intended wording do not prove
pronunciation. Record the exact clip hash for any confirmed issue or approval.
New reports include unchanged source copies, complete-response identity where
available and request/file-read timings. The audio-integrity follow-up repaired
whole-sentence failure handling, static recordings for changing set values and
premature test capture cutoff; it did not approve or regenerate the recordings.

The earlier intermittent loading failures remain a separate investigation; one
successful run cannot identify their cause. Regenerate only clips whose defect
has been established. Review replacement bytes and existing playback tests before
changing the voice manifest. Provider changes, paid generation and voice rights
are explicit product decisions, not part of running the local audit.

## 3. Run beginner test 02 on a real phone

Follow [the beginner protocol](beginner-test-protocol.md). Record the timestamps of
hesitation, refused work, incorrect corrections, awkward prompts and unclear
speech. Ask whether the coach ever corrected something that was not wrong.
Diagnostics are optional and stay local; a screen recording alone is not a
clean-camera replay fixture. Obtain consent for any reusable camera footage.

Include everyday clothing and a range of body shapes. Check foreground/background,
camera switching, a disconnected camera, speaker audio and a complete routine.
Ankle-hidden Leg Raise and missing required Plank geometry remain recognised
limitations: offer the explicit unassessed Follow along option without inventing
reps, hold seconds or a score.

## 4. Use that evidence to choose the next product slice

The Remotion squat is an isolated, approved visual direction with a locally held
character. Technique review, other exercises and an app integration remain open.
Local weekly goals work; Duo transport is only a tested prototype. Real account
consent, partner visibility, cloud quotas/revocation and identity switching must
be proven before offering pairing. See [the Duo contract](profile-duo-contract.md).

The native UI/session port, verified purchases, public domain/free offer, automatic
notifications and cross-platform distribution remain separate releases. Use the
[business model](business-model-2026-09.md) to evaluate them after the core workout
experience is validated. Do not introduce separate judgement implementations or
promise shipped functionality from a prototype.
