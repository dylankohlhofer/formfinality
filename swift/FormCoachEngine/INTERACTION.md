# Native speech integration

`AppleLocalSpeechCapture` and `SpeechCaptureCoordinator` are native integration
components, not an active browser feature or a port of SessionCore/native UI.
`CoachCommand` ports HTML `parseCoachCommand`; its tests read the same 39 rows in
`testing/coach-command-vectors.json`. `CoachCommandRouter` ports the existing
`routeCoachAction` confirmation policy. `SpeechCommandCoordinator` connects both
to local capture. It needs a native host implementing the visible control actions;
it does not create a second session core or alter counters, scores or observations.

The package owner must provide the `FormCoachInteraction` library/target and
`FormCoachInteractionTests` target. These are now present in the shared manifest;
this component did not edit Package.swift. No new dependency is required.

The Apple adapter supports the package's iOS 16/macOS 13 minimums. It checks
`SFSpeechRecognizer.supportsOnDeviceRecognition` for the explicit locale before
every capture and sets `requiresOnDeviceRecognition = true` on every request.
Unavailable local recognition fails visibly. There is no remote fallback or
asset download. Apple documents that the request flag is honored only when the
recognizer supports it:
[local-only requirement](https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/requiresondevicerecognition),
[recognizer capability](https://developer.apple.com/documentation/speech/sfspeechrecognizer/supportsondevicerecognition).
The installed Apple SDK headers confirm the same requirement.

The application target needs `NSMicrophoneUsageDescription` and
`NSSpeechRecognitionUsageDescription` in Info.plist. Sandboxed macOS hosts need
microphone/audio-input access. A library target cannot supply the app's privacy
descriptions or entitlements. Permission dialogs and real audio must be checked
in the signed native host, not enabled during unit tests.

Create and retain `SpeechCommandCoordinator` on MainActor with an
`AppleLocalSpeechCapture` and a `CoachCommandActionHost`. The command coordinator
uses a 480-byte UTF-8 transport cap, the parser's 120-UTF-16-unit input bound,
55-second capture windows and the browser's 750-ms quiet interval. The transport
accepts bounds of 1...4096 UTF-8 bytes, a finite positive lifetime up to 60 seconds,
and a finite grace from 0...30 seconds; these are defensive adapter bounds, not a
choice of command grammar. Tests also use sample timing to exercise transport.

`CoachCommandActionHost.commandContext` must identify the session, navigation
epoch, step, tier, follow-along mode and paused state. Supply a fresh epoch for
ABA transitions. Set `allowed` false for background, finished work, recorder-only
mode or no session; set `otherDialogOpen` for help/diagnostics/memory ownership.
Set `coachSpeaking` before any coach sound begins. Call the command coordinator's
`synchronize()` synchronously whenever these facts change. Result callbacks check
them again to reject events that race host updates.

Implement `performCommandAction` with the same callbacks used by native visible
controls. Pause is immediate; explain/demo/repeat open the paused help panel.
For session skip/finish, resume synchronously and invoke the existing action
without an observation tick in between, matching HTML. Calibration skip/finish
uses the existing observed-check finish path; end uses the existing end action.
Do not change pose thresholds, inferred held time, score or totals here.

- Bind `speech.onStateChange` to a persistent, accessible listening indicator. The initial
  `state` is disabled. Use monochrome or iris, never form-feedback colors.
- Call `startFromUserAction()` only from explicit opt-in. Construction, state
  inspection and foreground return never request permission or start capture.
- The command coordinator forwards its host's `coachSpeaking` to the transport.
  At the lower-level transport seam, call `setCoachSpeaking(true)` before any coach sound, including confirmation
  prompts. Capture is released while speaking. Call `setCoachSpeaking(false)`
  only when all coach playback has actually stopped. After the supplied grace,
  a fresh recognition request starts; abandoned callbacks cannot issue commands.
- Call `setForeground(false)` on background/interruption, and `disable()` when
  the preference is disabled or the host closes. Call `reset()` before
  leaving the workout. These invalidate outstanding permissions, confirmation and
  callbacks; foreground return needs explicit opt-in again. Within the opted-in
  workout, context transitions use `synchronize()`/`invalidateContext()` to retain
  opt-in while discarding old audio and waiting for a fresh quiet interval.
- The iOS adapter owns an AVAudioEngine input tap and activates a play-and-record
  audio session while capturing. Coordinate this ownership with native playback:
  do not let two components independently activate/deactivate the shared session.
- `onTranscript` receives a bounded transient string and final/partial marker
  synchronously on MainActor. Do not log, persist, display history, send to a cloud
  model or attach it to diagnostics. Oversize input is rejected whole, not cut
  into a potentially valid command. No audio recording file is made.

Final results and 55-second window expiry release capture and renew with a fresh
request identity after 750 ms of continuous quiet. Opt-in stays enabled, allowing
“coach skip” followed by “coach confirm skip” without tapping Start again. Window
expiry is checked in the result callback even if the timer has not run. Local
availability and existing permission are rechecked before every renewal. Errors
disable visibly; there is no automatic retry loop on errors. A failed release
stays visible and permanently blocks reuse of that coordinator.

Permission startup has one 10-second deadline shared by both prompts. Expiry
invalidates callbacks and never opens the microphone after a late approval. The
operating system's already-visible permission dialog cannot be dismissed by this
library; the deadline cancels the app's start intent. Only another explicit Start
may try again. No permission is requested while coach speech/grace is active.

Spoken grammar always requires “coach”. Only exact “coach pause”/“coach stop” may
act on partial results, synchronously and with `bypassLLM == true`. A consumed
request cannot execute twice or execute a revised final command after partial
Pause. Other partials do nothing. Unknown final input is discarded. Coach
suppression drops *all* results, including Pause; the listening indicator must
make that limitation clear, and the visible Pause control remains available.

Share `commands.route` between typed controls, speech and confirmation buttons.
Skip/finish/end first open paused help, then expose `commands.pending` through
`onConfirmationChange`. Confirm the exact corresponding action within 10 seconds
in the same context. Bare “yes” does nothing. Mismatch, expiry, cancel, Pause,
navigation or disabled speech cannot execute the pending destructive action.
Camera-assessed sets reject manual Finish; follow-along and calibration retain
their existing finish semantics. The router supplies fixed result enums for UI
messages, never recognized text or generated action instructions.

Run `swift test --package-path swift/FormCoachEngine --filter 'SpeechCaptureTests|CoachCommandTests'`.
Stub tests cover permission sequencing/denial, local unavailability, background,
reset, stale permission/results, echo grace, resource-release requests, bounded
text, errors, renewal and expiry, plus the shared parser vectors, immediate partial
Pause deduplication, spoken skip→confirmation, context changes and destructive
action checks. They prove lifecycle policy, not microphone recognition
accuracy, audio-route compatibility, permission UI, speaker echo or battery use.
Physical-device/offline validation remains required. No speech permission is
requested by these tests.
