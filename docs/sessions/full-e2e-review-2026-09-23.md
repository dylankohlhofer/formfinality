# Full end-to-end test review — 23 September 2026

Source under test: `form-coach-v4.11.html`, SHA-256
`d15aa0bb63863b082dd47bd7b0257548776bc3ca5bd11fab44db46bb46071aa1`.
No product source, scoring rule, vector or Swift implementation was edited during
this review. Test inputs and new browser evidence used synthetic camera/video only.

## Results

| Method | Outcome | Evidence / limit |
| --- | --- | --- |
| `npm test` | Exit 0: 25 regression suites, four original harnesses, 55 engine cases / 1,307 checks, 110 browser cases / 942 checks, 151 shell cases / 1,356 checks, 16 actual recorded-audio cases / 388 checks | [Full report](../../test-results/2026-09-23T21-44-13-337Z-6612/index.html). Twelve human-video cases remain blocked; 26 review candidates are retained. Prior intermittent audio failures are not closed by one green run. |
| `npm run test:video` | Exit 0: 14/14 checks in one real MediaPipe CPU replay of generated blank footage | [Video report](../../test-results/2026-09-23T21-55-56-162Z-8409/index.html). Blank footage tests wiring and lack of false observations, not human recognition. |
| `swift test --package-path swift/FormCoachEngine --jobs 1` | Exit 0: 108 discovered, 105 passed and three opt-in real-model tests skipped | A first parallel build failed because an object file changed during linking; the serial rerun passed. No Swift source was changed. |
| `exercise-demos`: `npm run check`; `npm run check:studio` | 30/30 checks and live playback/restart/frame-step pass | [Studio report](../../exercise-demos/out/studio-check-tkiKL0/report.json). Earlier ten cold-load angle renders remain in `exercise-demos/out/asset-render-check-StNsMd/`. This is the separate prototype, not an installed workout demo. |
| New cross-engine real-camera flow | Chromium desktop + phone, Firefox phone, WebKit phone: 15/15 checks each | [Four-browser report](../../test-results/exploratory-e2e-1790201885680-12694/result.json). Current HTML was served on loopback with the release builder's URL substitutions for the local MediaPipe JS/WASM/model. A generated canvas stream went through real `getUserMedia`, model startup, pause, resume, keyboard Skip and End. All requests stayed local; all ended tracks were released. Settled debrief brand/totals fit the viewport. These are desktop browser engines with synthetic frames, not hardware phone cameras. |
| Fresh actual web review artifact | **Failed**: release builder's ten-minute deadline expired while reading 1,294 allowlisted voice clips; last progress line was 604/1,294 | `npm run build:web -- --out dist/web-e2e-2026-09-23` exited 1 without creating the destination. The cross-engine test above did **not** validate an emitted release artifact. |

## Finding 1 — a live camera track can end without a camera-loss recovery state

The new fault-injection run started the real local pose model, stopped the
synthetic camera's `MediaStreamTrack`, then waited 3.5 seconds. In all three
engines the track was `ended` while the app still had the stream attached and
the header still said `End`. The user could manually Pause and End.

- Chromium and Firefox displayed `Tracking unclear — counting paused`, but no
  camera-specific explanation or recovery action. Their browser consoles were
  otherwise clean.
- WebKit displayed `Something went wrong — stop and start the camera again.`
  after its pose detector tried to read a video that had ended. It logged WebGL
  `texImage2D: no video`, MediaPipe zero-sized ROI and `FormFinder loop error`.
  Its visible cue gives a restart action, but the ended stream remains attached.

[Repeated three-engine reproduction](../../test-results/exploratory-e2e-1790201717363-12297/result.json)
and the earlier [Chromium reproduction](../../test-results/exploratory-e2e-1790201606799-11810/result.json)
retain the track state, attached stream, banner/dialog state, console and screenshots.
The source has cleanup for an explicit Stop/End but no listener for a track's
`ended` event. The render loop returns when video time stops; on WebKit it can
instead call the pose model on an invalid frame. The app should recognize
unexpected track loss, suspend assessment, release the stream and offer an
explicit restart. A regression should inject an ended track in the actual
camera/model path, not only in a mock camera handler. Do not count the frozen
interval as observed work.

## Finding 2 — local release assembly can miss its own deadline

The fresh artifact builder exited with `Web build exceeded ten minutes` before
creating `dist/web-e2e-2026-09-23`. Its last printed clip batch was 604/1,294.
Sampling `readPublicInput` afterward took about 1 ms for early clips, 5 seconds
for one later clip and 10 seconds for another. This shows variable local asset
read latency, not a proven OS or code root cause. The current builder reads clips
in batches of four under a fixed ten-minute deadline. Investigate the read
latency and assembly throughput before relying on this packaging gate in CI.
Do not treat the old `dist/web-review-2026-09-23/` as current: its receipt's
`sourceHash` differs from the tested HTML hash.

## False alarms and boundaries

The initial WebKit End check counted calls to an overridden `track.stop()`;
WebKit left that counter at zero even though the actual track was `ended` and
the video element released. Rechecking the track state passed in every engine.
An immediate Firefox debrief screenshot caught text mid-entry animation;
after one second the brand and totals fit and the layout check passed.
Neither observation is recorded as a product defect.

The four-browser normal path validates real acquisition and local GPU-model
startup with generated blank frames. It does not establish recognition accuracy
for Plank, Leg Raise or another exercise, recorded-clip intelligibility, native
TTS sound, performance on phones, or beginner comprehension. Physical-camera
and beginner sessions remain required. The new browser probe is saved as an
ignored, local exploratory script at
`test-results/exploratory-e2e-2026-09-23.mjs`; it is not yet part of default CI.
