# Interface review — 14 September 2026

Scope: the current `form-coach-v4.11.html`, feature by feature, using the existing
engine/browser/audio/video lab. This is a usability and implementation review,
not a claim that automated tests establish human intuitiveness or App Store readiness.

## Outcome

The useful next step is a more predictable workout experience, not more fitness
metrics. Added workout previews, current/next movement context, explicit pause and
resume, automatic background interruption, an early-end summary, and in-app help.
Camera startup can be cancelled; failed/late camera switches no longer discard or
reopen a workout. Improved navigation, control labels, focus handling, legibility
and constrained-screen layouts. No new dependency, server, account, upload, paid
service, persistent health history or pose model was introduced.

The initial local browser inspection found the welcome screen waiting behind a
top-level camera-library download: only the header and empty instruments appeared.
The pose import is now lazy; onboarding and Help can initialise without it. The
browser build still downloads fonts, voice assets and the pose runtime/model. This
does **not** turn it into an offline install. Help is temporarily disabled during
camera startup so assessment cannot begin behind that modal; Cancel restores it.
Resume is disabled while a camera switch is pending; End remains available.

## Feature-by-feature disposition

| Feature | Review and change | Evidence / remaining boundary |
|---|---|---|
| Launch / model download | Static opening message; welcome no longer waits for MediaPipe. Permission and model stages have Cancel. Late grants are released. | `ui-startup`, `ui-camera-cancel`, model-failure cleanup; real inference blank-video smoke. Network outages are not offline support. |
| Welcome | Shorter setup copy, optional name has a visible label, no fixed distance/shin-height instruction. | Four viewport welcome screenshots; names remain memory-only. Human first-use comprehension still needs testing. |
| Plank familiarity | Existing Yes / Show me first retained; selections remain independent of coach style. | Existing calibration-demo and beginner-prompt cases. This is a request for instruction, not camera framing self-report. |
| Coach style and preview | Three styles retained; reachable again from Workouts. Preview failures now explain the limitation visually. | Existing voice-privacy, queue and actual clip cases. No new browser-voice catalogue or remote fallback. |
| Voice on/off | Explicit preview still works when automatic Voice is off; automatic speech remains controlled by the checkbox. | Existing privacy/coaching tests and real audio cancellation tests. Physical speaker/native-TTS waveform coverage remains absent. |
| Manual level selection | Clear alternative to the optional plank check; Back to welcome added. Header uses a pressed-button group, not incomplete tab semantics. | All plan-tier selections, `ui-plan-preview`, existing selected-state rules. No tier IDs changed. |
| Plank check | “Try the plank check” / “Finish check” names replace technical calibration/skip wording. Existing mid-hold observed result retained. | Original skip suite; `ui-calibration-interruption`. Background/camera interruptions offer Restart or Use observed result, never Resume a supposedly continuous hold. |
| Calibration verdict | Existing result and Change it flow retained; clears obsolete demo/instructions and focuses the new heading. | Original core vectors/skip tests. Legacy **tracking-loss** bout aggregation is still a recognition/policy limitation; explicit Pause does not solve it. |
| Workout selection | Header says Workouts (it opens choices, not the camera). Removed internal effort/cue-budget jargon. Corrected First Steps' four-versus-five movement copy and unsupported two-minute claim. | All 12 plan-tier paths. Catalogue/yoga removal and programme redesign were not part of this change. |
| Workout preview | New screen lists expanded sets, scaled targets/rest, camera view and Other side. Start workout is explicit; Back preserves level. No invented total workout duration. | `ui-plan-preview`: Strong Core Strength is 11 work sets and 10 rest intervals; four viewport reachability cases. Preview derives from the same plan expansion as the core. |
| Current / next movement | New persistent movement name, local set number, workout set progress and next movement. | `ui-layout-*`, all exercise/plan sweeps. A user no longer has to infer the movement from old speech or debug telemetry. |
| Reps, hold and form | Existing measurement contract retained. Pause freezes counts and scoring; early-end current set receives no form verdict. | 44 supported pair interruption checks, original vectors, movement-evidence/partial-view regressions. No relaxed thresholds or claimed improvement in hidden-joint recognition. |
| Demo | Consistent Show me how / Hide demo state and `aria-expanded`; automatic closure resets the label too. | Existing 88 exercise browser cases, drawing and mutation harnesses, beginner-prompt layout tests. Drawings are not proof of human understanding. |
| Guide outline | Renamed “Ghost”; help explains that the drawing is a guide, not a body-size target. | Existing ghost rendering checks; native/real-body alignment and comprehension remain human tests. |
| Easier movement offer | Existing measured grace, sustained-difficulty and withdrawal policies retained. Larger controls exposed an overlap with the demo, now corrected. | All 120 setup-prompt checks and five reported-session regressions; no timing threshold relaxed. |
| Follow along | Existing explicit per-set unassessed option retained, including manual finish. Pausing also freezes its elapsed timer. | Four existing shell cases, body-tolerance tests, real-clip cancellation and new pause checks. Unobserved work is not counted or graded. |
| Pause / Resume | New core methods, Pause button and P shortcut. Repeated clicks are no-ops; unfinished reps break across pause. Escape cannot accidentally restart assessment. | `interface.test.mjs`, `ui-pause-resume`; actual audio pause case. Progress is in memory only, not recoverable after reload/OS termination. |
| Background / screen lock | Visibility loss pauses the active core; returning requires explicit action. Optional screen wake lock is reacquired when appropriate. | `ui-background` simulates the visibility event. Actual iOS app lifecycle, incoming calls, lock screen and wake-lock support need device tests. |
| End workout | End first pauses and asks; Resume preserves the option to continue. Confirming produces an honest partial summary, not a discarded workout or fake completed future sets. | `ui-pause-resume`, all-pair core tests, rest/completed-set/follow-along end tests. |
| Skip / rest | S and the button retain the same handler. Rest uses “Ready now”; plank check uses “Finish check”. Typing, modifiers, repeat keys and overlays cannot accidentally advance a set. | Original skip suite, existing keyboard/audio cases, new pause-modal guard. |
| Switch camera | Named icon; pause breaks cross-camera partial reps. Acquire/play a replacement before releasing the original. Failure explains recovery and retains the workout; late results after End are released. | Production handlers with fake local tracks: `camera-start-flip-stop`, `ui-camera-flip-failure`, `ui-camera-late-flip`. Devices requiring release of the old lens before acquiring another may still refuse a switch; no physical-lens guarantee. |
| Camera errors | Permission, missing/in-use camera, constraint and model errors keep specific recovery advice and release tracks. | Existing camera/model-failure cases retained. No insecure-origin or platform permission bypass. |
| Help | New local modal explains setup, counting uncertainty, controls, privacy and memory-only progress. Opening it during a workout pauses first; closing it does not silently resume. | `ui-startup` checks modal, Escape and focus return; keyboard/modal behavior inspected. |
| Private diagnostics | Existing opt-in consent, bounded memory, start/pause, quick flags, explicit export/erase and validated replay retained. Shorter header label is Diagnostics; panel remains Private diagnostics. | Existing diagnostic buffer/import/mobile-access cases. No automatic collection or upload added. This is not the camera/video recorder. |
| CSV | Existing export retained in header and debrief; paused/resumed/ended events are logged. | Exercise browser download checks, skip suite and new effect/core checks. Files are personal diagnostic exports, not anonymous analytics. |
| Debrief | Early end named honestly; incomplete current set unscored; future sets absent. Choose another workout is clear. Old instruction footer no longer covers buttons; leaving cancels delayed narration. | All four viewport debrief exits, `ui-finish-speech-navigation`, existing skipped/unassessed/bridge cases. Existing completed-set causal “fatigue/technique” interpretations merit a separate evidence audit; not validated here. |
| Touch / keyboard / visual hierarchy | Core controls have 44 CSS-pixel minimum targets; 16px inputs; stronger muted text; dynamic header/control spacing; visible critical controls while exercising. Progress and choices use iris, not body-feedback green. | 320×640, 390×844, 844×390 and 1280×800 screenshots/hit testing; literal CSS/ID/effect audits. Not a full WCAG, screen-reader, enlarged-text or native-point certification. |
| Internal reference recorder | Reviewed as developer tooling; not exposed as a new consumer feature. Its camera startup shares cancellation and its idle button label is corrected. | It is not reachable in ordinary workout navigation. Saved-reference import quality and authoring UX are not release-certified by this review. |

## Contracts for the mobile port

`SessionCore.pause(reason)`, `resume()` and `stop()` own the workout decisions;
`pauseState` is a shell effect. `CalibrationCore.pause()` deliberately has no Resume
counterpart: choose a fresh check or finish the observed attempt. Native scene
interruption should invoke the same policy, not merely stop drawing camera frames.

Pause does not award reps, observed hold, score samples, rest progress or follow-along
time. Both sides of the pause interrupt an unfinished rep; completed reps remain.
End records the current set as `stopped:true, score:null`, retains completed sets,
and does not manufacture records for future sets. Session averages still use the
existing per-frame accumulation **once**, not another sum at finish. Stopped sets
do not generate ability/technique insights.

The Swift package does not yet contain these two core classes; there is no second
implementation to modify now. Evaluator/math/content thresholds and the root/shared
conformance JSON were not changed. Port the methods and these interruption cases
together when the session layer is introduced.

Apple's native guidance recommends 44×44-point controls; this browser pass uses
44 CSS pixels, **not an assertion those are identical units**. W3C reflow uses a
320-CSS-pixel reference width, and its minimum-target criterion is separate from
our chosen larger controls. These informed the viewport/target checks, not a
certification. [Apple UI tips](https://developer.apple.com/design/tips/),
[W3C reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html),
[W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
Visibility and wake-lock behavior use existing platform capabilities, not a new
background service. [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API),
[Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).

## Durable verification and deliberate test migrations

New coverage stays in the existing default test/watch/CI loop:

- `testing/interface.test.mjs`: 56 checks, including all 44 supported exercise/tier
  pairs, unfinished-rep recovery, rest/follow-along pauses, partial summaries,
  calibration interruption and literal structural audits.
  A deliberate portrait-overlap mutation proves the rendered-layout checks still bite.
- `testing/interface-cases.mjs`: 13 browser cases for navigation, preview, four
  viewport layouts, pause/background/calibration, stale narration and camera races.
- `pause-cancels-correction`: a fifteenth real-time audio case. It requires an
  **audibly active** correction before Pause, silence within 250ms, frozen hold
  time, no paused speech starts and recovery without restarting the stale correction.
- The existing video bridge records explicit `disabled-paused` ticks. Its invariant
  test still rejects missing/double inference outside intentional suspension.

Existing test paths were deliberately updated to click Start workout after selecting
a plan, and End workout in the confirmation dialog after End. The camera-switch
case now explicitly resumes after switching. Original measurement, privacy, audio
and drawing assertions were retained, not replaced with new expected scores.

Failures retained during development: increased control sizes exposed timer/setup
overlap (`shell-focused-9MQ8zV`), beginner demo/offer overlap, and the old exercise
footer covering small/landscape debrief exits (`shell-focused-8mMF41`). The real layout
defects were fixed. Two new wording assertions were corrected to read `textContent`
instead of CSS-uppercase `innerText`; that was a test-oracle error, not an app fix.
Earlier passing runs and these failures remain in ignored local evidence.

The full run at `2026-09-14T05-41-57-906Z-27043` remains a failed run: its first
portrait geometry assertion failed and its automatic reproduction passed. The
trace records `--controls-height:0px` at the assertion (294388ms), followed by the
ResizeObserver update to `96px` before capture (294391ms); the captured layout has
no overlap. Accelerating 90 pose ticks does not advance the paint clock. Geometry
checks now wait two animation frames for rendering, then run the **same** overlap
assertion once. No retry-to-green or failure suppression was added. A deliberate
`#hud{bottom:150px!important}` mutation must still fail both portrait overlap checks,
without browser exceptions. That negative control is in the default regression suite.

Final full-run counts and provenance are recorded in `docs/project-status.md`.
Reports remain local under `test-results/`; no recordings or private user files
are committed. Do not interpret a missing-video entry as a successful exercise test.

## Next human/device pass

Ask two beginners to choose a workout from the preview, start without assistance,
pause mid-set, open Help, switch apps, return, skip rest, use the unassessed option
and end early. Watch where they hesitate before explaining the controls. Include
ordinary clothing and different body proportions; preserve recognition failures as
recognition failures rather than hiding them under UI improvements.

On the target phone, also test portrait/landscape rotation, enlarged system text,
VoiceOver, safe areas, denied/changed camera permission, lens switching, incoming
calls, screen lock, local voice availability, speaker audibility and weak-network
startup. Check whether the now-visible live header feels busy across the room.
This is a focused release gate, not a reason to add more infrastructure first.
