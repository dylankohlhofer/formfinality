# Automated test and review loop

One scenario describes timed observations, interruptions and independently stated
expectations. Engine replay, browser testing and recorded-video inference use that
same scenario. The application and its original recorded vectors are unchanged.

## Start

Requires Node 20+; Node 22 is used in CI.

```sh
npm ci
npx playwright install chromium
npm test
```

`npm test` runs infrastructure self-tests, all four original verification harnesses,
then engine and desktop/narrow Chromium scenarios. An assertion failure exits 1.
Missing human recordings are explicitly **coverage incomplete**, not a video pass.
Use `--require-video` to make that coverage gap exit 2.

**Regression retained:** First Steps discovered and now protects the fix for the
v4.11 calibration exception. See [FC-LAB-001](findings/calibration-has-demo.md).
Unexpected exceptions must fail; do not turn them into expected failures.

## The loop

```sh
npm run test:watch
```

Runs immediately, then reruns when app/scenario/harness inputs change. Runs are
serialized and debounced; changes during a run cause one follow-up run. Ctrl+C stops
it. This is a foreground watcher, not an installed background service. Each run
keeps its own evidence and failing scenarios repeat once in a fresh context.
GitHub Actions also runs on pushes/PRs once this workflow is pushed, and preserves
reports even when the app fails. No API key, paid model calls or cloud video service.

Open the directory named in `test-results/LATEST.txt`, then `index.html` or `REVIEW.md`.
The report includes expectations, actual results, evidence links and coverage
boundaries. Each case keeps `scenario.json`, `result.json`, and browser screenshots,
console/page errors and `trace.zip`. Use `npx playwright show-trace <trace.zip>` for
an interactive reconstruction. Legacy suite output is in the four `.log` files.

Build, scenario, fixture, dependency-lock and test-bridge hashes identify inputs;
`build.html` is saved per run. The Git commit is recorded too (the working tree may
contain additional changes). Reproduce an archived test without using a changed case:

```sh
node testing/run.mjs --build test-results/<run>/build.html --mode browser \
  --scenario-file test-results/<run>/<case>/scenario.json
```

No automatic retention/deletion runs locally. Evidence may contain personal data when
you explicitly supply recordings; keep it local and delete individual run directories
deliberately when no longer needed. CI generates only non-human synthetic footage.

## Real video and faster replay

```sh
npm run test:setup-video
npm run test:video
```

The setup downloads the app's version-1 lite model and verifies its committed SHA-256.
The video smoke generates four seconds of a blank canvas, sends 90 frames through
real MediaPipe and the app's original rendering loop, and checks no observations
become a score. This proves the adapter works, **not** real-exercise accuracy.
Inference uses CPU for portability, not the shipped GPU delegate.

For a consented recording, author a scenario describing the actual footage and its
independently reviewed expectations. Put the video in ignored `testing/private/`:

```sh
node testing/run.mjs --build form-coach-v4.11.html --mode all \
  --scenario first-steps --recording testing/private/consented-first-steps.mp4 --require-video
```

The scenario must match the clip: `frames` segments consume consecutive video time at
30 samples/second; clicks/skips take no footage time. Use an appropriately edited clip
or a separate scenario; do not relabel arbitrary footage to fit an expected result.
The initial First Steps fixture is synthetic, not ground truth about a recording.
`--scenario-file` accepts another independently authored JSON case.

Video runs save raw detections in `landmarks.json`. Replay without running the model:

```sh
node testing/run.mjs --build form-coach-v4.11.html --mode engine \
  --scenario skip-and-dropout --landmarks test-results/<run>/<case>/landmarks.json
```

Recording validation requires 30fps monotonic timestamps, valid dimensions and exact
scenario frame count. No-detection frames are `null`. Conversion uses the app's own
`buildFrame`; expected scores are never copied from model output.

## Agent operating contract

1. Run the committed suite; read the scenario, oracle and evidence.
2. Distinguish an app defect, harness defect, coverage gap and unconfirmed usability
   concern. Reproduction confirms the failure, not automatically its cause.
3. Save newly discovered cases and independent expectations in Git. Never generate
   expected scores from the implementation being checked.
4. Keep production fixes separate and explain causal evidence. Preserve vectors;
   follow AGENTS.md for deliberate behaviour changes and Swift parity.
5. Rerun the focused scenario and complete baseline. Preserve failures and limitations.

This is an automatic **test → reproduce → report** loop. It does not install an
unattended AI agent that edits code, invents test oracles or spends API credits.
An agent can add scenarios and fix reviewed defects using this evidence in a later
development turn. Human review remains necessary for new movement judgements.

## Boundaries

- Landmark browser mode runs real DOM handlers, effects and debrief. Camera
  acquisition, inference, animation scheduling and audio playback are bypassed.
- Video mode runs inference, geometry conversion and the original rendering loop;
  a video file and controlled clock replace the webcam and wall time.
- Tests use fallback fonts, no external requests, and loopback-only asset serving.
  One exact native `INFO` startup message is classified as informational and still
  saved; unexpected console errors and all uncaught page errors fail the test.
- Viewport checks are not physical-device tests. Voice playback/overlap, permissions,
  camera flipping, real-time performance and movement recognisability need more coverage.
- No human exercise recording has been supplied. Beginner test 02 is not replaced.
