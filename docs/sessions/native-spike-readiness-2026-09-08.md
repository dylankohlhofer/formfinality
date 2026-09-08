# Native camera/audio experiment — readiness, 8 September 2026

Status: **prerequisites inspected; no native app built or physical performance
measured**. This is a narrow integration experiment, not approval to port the full
interface or replace beginner test 02. Browser behaviour remains the specification.

## What is actually available

Final read-only inspection found an **iPhone 16 Plus available (paired)** through
CoreDevice. This goes beyond the initial USB-only check, but does not prove a signed
app can deploy or that camera/audio work. No device identifier, device name or
account identity is retained here.

- Selected Xcode: `/Applications/Xcode.app/Contents/Developer`, version 26.6,
  build 17F113; Swift 6.3.3; iOS/iOS Simulator 26.5 SDKs listed.
- The final `xcodebuild -checkFirstLaunchStatus` exits **0**. Reading the devicectl
  wrapper resolved its actual target under `/Library/Developer/PrivateFrameworks/`,
  not inside the Xcode application bundle. Installed CoreDevice **518.33** matches
  the wrapper's expected version, and directly listing devices succeeds. The initial
  preflight's exit 69 and failed component lookup are not current blockers.
- No valid code-signing identity was visible to the inspection. This does not
  establish whether an Apple account could obtain one through Xcode.
- No CocoaPods executable or installed CocoaPods gem/cache was found.
- Existing Swift code is a library, not an iOS camera application. SessionCore and
  CalibrationCore are not ported.
- The local Lite model is 5,777,746 bytes, SHA-256
  `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`.
  Its bytes match `testing/model.json`; the voice manifest's 1,294 entries resolve
  to local files. File availability is not listening approval or bank completeness.

Tooling caveat: the initial devicectl wrapper invocation attempted first-launch
setup and reported failure. The final check read the wrapper, verified the installed
version, and called its actual CoreDevice target directly for read-only enumeration.
Do not infer a missing device component from a guessed path in the Xcode bundle.
No app was installed, no signing was configured and no camera permission requested.

## Smallest useful experiment

One isolated app: preview, neutral landmarks, Start/Stop, camera selection, audio
probes and explicit local export/erase. No session judgement, workout history,
subscription, server or cloud inference.

Start with the same Lite model bytes, explicitly pinned runtime/options, one pose
and VIDEO mode on a serial processing queue. Google's iOS example uses native
MediaPipe; its published Podfile currently pins 0.10.14. The documentation supports
both VIDEO and LIVE_STREAM, but their frame-admission behaviour is different. Record
CPU/GPU delegate explicitly; successful GPU support in the pinned binary must be
verified, not assumed from a matching version label.
[Google iOS guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/ios),
[official sample dependency](https://github.com/google-ai-edge/mediapipe-samples/blob/main/examples/pose_landmarker/ios/Podfile).

Keep original capture timestamps, actual buffer dimensions, normalized landmark
x/y/z, visibility and presence separate. Do not substitute world coordinates or
presence for the browser's visibility field. Record rotation and selfie mirroring
at the boundary. A matched model version does not prove equal preprocessing,
frame selection, numeric kernels or exercise behaviour.

The capture path should report and bound backlog rather than accumulate old frames.
Track processed no-pose results separately from dropped frames, and retain drop
reasons. [Apple's capture-drop guidance](https://developer.apple.com/library/archive/technotes/tn2445/_index.html).

## Evidence required before a decision

| Check | Evidence, not a guessed pass |
|---|---|
| Camera/orientation | Front/rear × supported portrait/landscape orientations; asymmetric pose; actual dimensions, rotation, mirroring and left/right mapping |
| Latency/cadence | Three 60-second moving-person runs; capture-to-result age and processing p50/p95/p99, delivered/processed FPS, drops/replacements/errors |
| Sustained load | Twenty minutes of camera + moving-person inference + periodic audio; minute-by-minute timing, thermal state, camera pressure, battery/charging and low-power mode |
| Recorded speech | Cold/warm start, cancel, immediate replacement, interrupted multipart instruction, background/foreground, lock/unlock, headphones and Bluetooth changes |
| Offline | Cold launch with Wi-Fi/cellular unavailable; bundled model and selected clips operate without asset fetches |
| Physical sound | External timing/audibility check for speaker and Bluetooth; callbacks alone do not prove audible onset |

The proposed durations are test policies, not performance claims. Each export needs
commit/build, device/OS, model hash, runtime/options, camera format and audio route.
Keep aggregate timing at full rate and detailed evidence bounded/opt-in in memory.
Native speech synthesis is a separate experiment: do not label an enumerated voice
as proven offline merely because its identifier exists.

## Blocker and next user action

Device enumeration now works; do not ask the user to repair Xcode on the basis of
the earlier preflight. The remaining deployment prerequisite is development signing:
no valid signing identity was visible. The user needs to select/sign in to the Apple
account/team they want to use in Xcode. Do not choose a team, change their account
or ask them to send credentials into chat. Developer Mode and the actual install
must still be confirmed during deployment.
Apple supports limited device testing with a Personal Team, so this experiment
does not itself require buying a membership.
[Apple account options](https://developer.apple.com/help/account/basics/about-your-developer-account).

After those prerequisites, install the pinned native dependency, build the isolated
app, obtain explicit camera access on the phone and run the protocol. No phone
benchmark, native speech fix or full port completion is claimed by this document.
Keep modularisation as a separate, behaviour-preserving change after this decision.
