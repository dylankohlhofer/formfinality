# Recorded-audio stall recovery — 14 September 2026

Request: resolve the audio stalls found during final architecture verification.
All previous uncommitted architecture/lifecycle work and the user's planning
documents are preserved. No commit, push, new dependency or paid service is involved.

## Diagnosis: what is established

The original failed run remains at
`test-results/2026-09-15T02-55-42-639Z-80560/`. Six cases failed; several local MP3
requests had no recorded response, and initial teaching reached the 25-second
speech watchdog. Its automatic repeats were not sufficient proof of recovery:
the old number sample could pass after just one number became audible.

During this investigation, an independently sampled Node import was blocked in
`ReadFileUtf8 → uv_fs_read → read`; the sample is retained at
`test-results/audio-stall-node-sample.txt`. This establishes a local I/O stall
during tooling startup, **not the OS/browser cause of the earlier MP3 stalls**.
The archived pre-optimisation number sample later passed at
`test-results/2026-09-15T03-21-15-011Z-83276/`. Instrumented HTTP/file-read observation
also ran the unmodified architecture build: all 16 audio cases passed at
`test-results/2026-09-15T03-23-21-864Z-83590/`, with completed stream reads of at most
54 ms in `test-results/audio-transport-Uvxr1n/transport.jsonl`. This is diagnostic
evidence, not final-source verification or proof that the environment is fixed.

Two application weaknesses are independently reproducible by withholding an MP3
response: the player has no short startup/progress recovery, and pausing leaves
the unresolved element cached. A failed initial instruction can therefore block
the coaching gate until the whole-utterance watchdog. The fix addresses these
failure modes regardless of why a particular browser/file request stalled.

## Implemented behavior

- `AudioBank` checks startup/progress on a two-second budget. This is an explicit
  recovery policy, not a measured mobile latency guarantee. Progress checks can
  take a further interval to recognize a stall that began between samples.
- Before any recorded segment has started, a stalled load gets **one fresh-element
  retry**. The old source is removed/reloaded and evicted from the cache, aborting
  its pending load. Its promise, playing and ended continuations lose ownership.
- Once a line has started, a stalled splice/playback fails the remaining line;
  it does not replay heard words or advance past the stalled words into a number.
  Existing ordinary load-error behavior is otherwise unchanged.
- The original finite speech deadline bounds first audible startup, including the
  retry. Counts/corrections cannot gain extra time by retrying. A timely started
  sentence may still finish its later splices; long progressing clips are not
  stopped at two seconds. The existing 25-second whole-line watchdog remains.
- Failure releases the coach queue and uses the existing visible recorded-speech
  explanation. No automatic TTS/cloud fallback is introduced. Actual calibration
  can then accrue fresh observed hold without a manual coach reset.
- Stop/Pause/Skip clear the new timers and invalidate old continuations with the
  existing epoch. No retry may reopen abandoned speech.

The judgement core, content, root vectors, drawing, voice assets and dependencies
are unchanged. `AudioBank` lies before `const VERSION`, so the entire historical
extraction slice is no longer byte-identical, but the judgement/drawing portion
before `const AudioBank` is. Swift has no playback adapter to mirror; its clip
resolver and shared cases are unchanged. No scoring or recognition claim is added.

## Stronger permanent evidence

`testing/audio-stalls.test.mjs` adds 12 deterministic cases to the existing default/
watch/CI runner: startup retry/exhaustion, stale callbacks, partial-line stalls,
progressing long audio, cancellation before/during retry, original deadlines and
an asset becoming unavailable. Ten fail on the archived pre-fix build; the two
healthy playback controls pass. All 12 pass after the fix.

`coaching-stalled-calibration` joins the existing shell sweep. It proves actual
teaching owns the queue, fails visibly after the bounded retry, and lets observed
calibration hold accrue without clearing speech in the test. The pre-fix build
times out at the independent six-second check
(`test-results/shell-focused-kdsBIG/`); the fixed case passes
(`test-results/shell-focused-gmPrCG/`).

Two actual-media tests join `audio-capture.test.mjs`:

1. Withhold the first request only: its fresh retry must play both complete numbers
   with measured signal within the original deadlines; old callbacks stay silent.
2. Withhold the second number permanently: the sample must **fail**, despite the
   first audible number, and the player must release that failed item before its
original deadline expires plus scheduling tolerance. No native speech is used.

Both tests fail on the archived build at `test-results/audio-mutation-08wyyI/`.
The fixed real-playback mutation suite passes; expected red captures for deliberate
silence, overlap, unrequested errors and missing number two remain red.

Audio auditing now rejects whole-line watchdog timeouts and failed recorded
utterances hidden behind other audio. Every declared number sample requires both
numbers to start, end naturally and carry independent measured signal. Three new
audit unit cases protect this distinction. `clip-stalled` events/retries are saved
in the audio timeline and local diagnostic exports. No old expectation is weakened;
native TTS waveform gaps remain gaps.
Re-auditing the original Warm Learning and Warm Building `reproduction/audio.json`
files rejects both for missing completion/signal for number two; their old passing
result files are retained unchanged.

## Verification checkpoint

**Full `npm test` exits 0** at `test-results/2026-09-15T03-36-59-711Z-84685/`.
All **82 infrastructure tests**, **1,507 targeted tests across 20 suites** and the
four original harnesses pass. Actual-media controls/mutations are retained at
`test-results/audio-mutation-4OUVyI/` (10 tests passing, with deliberately broken
captures still marked failed as required).

| Mode | Passing cases | Passing assertions |
|---|---:|---:|
| Engine | 55/55 | 1,307 |
| Browser | 110/110 | 942 |
| Interface / shell | 129/129 | 1,106 |
| Recorded-clip audio | 16/16 | 388 |

There are **346 report rows: 334 passing, 12 blocked real-video, zero unexpected
failures**. All six previously failing audio cases pass the stronger rules.
The 26 review candidates are retained coverage gaps, not new failures or solved
recognition limits. No AI reviewer was invoked.

The original harness totals remain 4,127 conformance checks, eight caught demo
mutations plus the healthy control, 250 drawing checks and 26 skip checks. Four
historical frame-rate vectors remain explicitly unreplayable. This turn did not
rerun the separate blank-video smoke or Swift; neither adapter/port changed.

Final HTML SHA-256:
`cb6e83e77533d22db76f0681128066771fb13feaacc4245ec6f7806106f31bf5`.
The archived HTML and all 63 recorded JavaScript test-source hashes match the
working files. `git diff --check` is clean. Changes remain uncommitted/unpushed.

These checks do not establish physical speaker quality, native-TTS waveforms,
mobile cold-start speed or repair the underlying OS I/O event. An unavailable asset
is handled visibly; it is never relabelled as successful audible coaching.
