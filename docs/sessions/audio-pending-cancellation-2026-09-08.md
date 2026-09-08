# Pending audio cancellation — 8 September 2026

## Discovery and evidence

The movement-evidence final run exited 1 for one audio assertion. Its earlier two
full development runs passed. The failing run is retained, not replaced by its
passing automatic reproduction:

`test-results/2026-09-07T23-26-06-025Z-57814/`

Build SHA-256:
`74bff3f55a1c9cce7e27a9a98f5b973f8894ffab50d3e5ce194bbb243be0b9e9`

In `audio-skip-during-teaching/audio.json`, play request 4 for the opening Plank
teaching clip was made at 8474.4ms. It never emitted a playing event. At 10550.2ms,
after Skip, its promise rejected because `pause()` interrupted pending playback.
The monitor logged that as a generic `clip-error`, failing **No media load,
playback or capture errors**. Old-clip silence, next-exercise teaching and stale
phase checks passed. The automatic reproduction also passed, starting the clip
before Skip and then recording its pause normally.

This exposed a missing distinction in the test monitor: cancellation before a
playing event versus failed playback. It does not establish why the clip took so
long to start. Workspace file reads were also timing out while macOS marked files
`dataless`, but that is not proof of the audio delay's cause.

## Test-monitor change, separate from the application

- Track each pending play request independently, including its immutable ID.
- Record a pause request before invoking the original media element's `pause()`.
- Classify a rejection as `clip-cancelled` only if that same request was paused
  and the rejected error is `AbortError`. Retain the original name, message and
  pause timestamp in the evidence and display cancellation in the review timeline.
- Re-throw the original rejection to production. The monitor does not alter the
  application's completion/cancellation callbacks or make a failed clip succeed.
- Unrequested aborts, non-abort playback errors even after pause, media load/decode
  events, silence, overlap and stale-phase checks remain failures.

Four permanent real-browser tests exercise pending-play cancellation with immediate
element reuse, unrequested abort, paused decode failure, and a new unrequested abort
after an earlier request was paused. The negative cases deliberately mutate only
the served test copy; their playback-error assertions must fail.

No production HTML, conformance vector, Swift source, voice asset or audio-audit
threshold is changed by this monitor repair. Native TTS and physical speakers
remain outside the captured waveform.

## Verification

All 28 audio unit/capture tests pass, including all four new controls, at
`test-results/audio-mutation-4MxVzH/`. The full default run subsequently exits 0:
`test-results/2026-09-07T23-49-22-795Z-63278/` — 64 infrastructure tests and all
13 wall-clock audio cases / 239 assertions, as well as the complete movement,
browser and shell baseline. Deliberately broken capture variants still fail their
independent checks; those failures are expected mutation evidence, not app passes.

The pending-cancellation case was rerun after replacing its accidental same-clock-
sample equality assumption with ordered timestamps and matching request identity:
`test-results/audio-mutation-THtNjA/`, one selected case passed. This final edit is
test-only; application/monitor code and the other negative controls are unchanged.
