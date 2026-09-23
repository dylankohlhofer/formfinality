# Intermittent number-playback verification failures

Status: unresolved; not automatically approved by a passing repeat.
Found during the local Profile/Weekly Goals verification on 23 September.
No playback implementation, voice assets, audio expectations or deadlines were
changed by that feature. The cause of the local request delays is unconfirmed.

## Preserved evidence

Full run `test-results/2026-09-23T12-42-50-429Z-7846/` exited 1.
Build SHA-256: `3a9804b67a03917d1e1e8175456dbc7ad60c1672791c87d7ba06cbe059b46e8d`.
Its 16 real-clip audio cases include 13 passes and three failures:

- `clips-warm-learning`: zero decoded signal; neither number starts. The first
  load stalls, is retried once around 2,019 ms, then expires around 3,015 ms.
  Both requested numbers fail within the original deadline. The trace records
  no completed MP3 responses before cancellation.
- `clips-warm-building`: first number starts around 1,470 ms and finishes around
  2,304 ms. Second starts around 2,978 ms, just within its 3,000 ms start deadline.
  Capture ends at 4,016.0 ms and `clip-end` arrives at 4,016.2 ms. The complete
  second-number evidence check correctly fails. This is an incomplete capture,
  not proof of a mispronounced word or an inaudible whole clip.
- `clips-energy-learning`: second number expires before playback; its completion
  and recorded-utterance-success checks fail.

The built-in fresh-context repeats passed for all three (`reproduced:false` in
the original results). Those repeats do not rewrite the failed full run.
Warm Building's loopback MP3 response timings include about 1,458 ms and 669 ms
waiting for response; Energy Learning's first MP3 waited about 1,289 ms. These
timings locate delayed delivery, not its cause: server/filesystem, browser
interception and scheduling remain hypotheses, not diagnosed defects.

The `AudioBank` and `Coach` implementation slices were compared with the last
verified build and were byte-identical. One independent Warm Learning control
on that old build passed:
`test-results/2026-09-23T12-53-14-597Z-9565/`.
A passing control does not prove that the new feature caused—or could not
cause—the intermittent failure.

The final feature checkpoint also completed a full `npm test` with all 16 audio
cases passing (388 checks): `test-results/2026-09-23T12-55-37-795Z-9855/`, build
`0044e2f148b693270570682e93b568db7fb269a62a99d9dab1466d92468c2c89`.
Only the new profile summary reference and email wording were polished between
these full runs. No audio code, deadline or expected result changed. This pass
does not close the intermittent finding or replace the earlier failure evidence.

## Follow-up

Use the existing runner; do not loosen the deadline, accept an earlier audible
number as proof of the second, or silently retry until green:

```sh
node testing/run.mjs --build form-coach-v4.11.html --mode audio --scenario clips-warm-learning
node testing/run.mjs --build form-coach-v4.11.html --mode audio --scenario clips-warm-building
node testing/run.mjs --build form-coach-v4.11.html --mode audio --scenario clips-energy-learning
```

Instrument one controlled comparison of request dispatch, local server receipt,
file-read completion, response, media start/end and measured audio capture. Keep
cold/warm cache and original/changed build conditions explicit. Separately
check whether the fixed four-second number sample can contain the complete
allowed-late second clip, including capture finalisation. Any harness correction
must retain deliberate silence, overlap, late-start and incomplete-number controls.
Do not mistake capture duration for permission to relax production start expiry.

This is distinct from the outstanding report that “two” sounds like “coo”. No
transcription or human intelligibility approval was performed here. Physical
speakers and native TTS also remain outside these captured-media tests.
