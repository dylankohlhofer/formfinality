# Local voice-library audit

This development tool screens the **active manifest**, currently 1,294 MP3 clips
(360 number recordings). It produces a local listening queue. It does not alter
recordings, invoke a paid service, upload anything, request microphone access or
approve pronunciation. The report of Warm's “two” sounding like “coo” remains a
listening question until its current recording is reviewed.

Run serially, after other browser/audio tests and watchers have stopped:

```sh
node testing/voice-audit.mjs --pilot
node testing/voice-audit.mjs --all
```

The optional pilot selects numbers **1–20 in all three voices**, 60 clips. The
default command selects every manifest entry. Both start with Warm 2, then the
other two 2s and the remaining pilot numbers. Each invocation creates a fresh
`test-results/voice-audit-<time>-<pid>/` containing `index.html`, `report.json`
and exact, unchanged copies of successfully read source clips under `clips/`.
Open the HTML locally; no server is needed. Do not publish this development
report or redistribute the recordings.

To choose a fresh output name:

```sh
node testing/voice-audit.mjs --out test-results/voice-audit-review
```

Only a new direct child of `test-results/` is accepted. Existing outputs are
never overwritten. The pinned Playwright dependency and its installed Chromium
are required; the tool does not install or download anything. Missing dependencies
or browser startup failure produce an incomplete report, not a successful scan.

## What it measures

`readPublicInput` and `validateVoiceManifest` from the existing release tooling
enforce the same relative-path allowlist and symlink rejection. Directory scans,
unlisted MP3s, private diagnostics and user recordings are not accepted as inputs.
The report identifies the manifest, current render plan, analyser and reused
helpers by SHA-256. Every readable clip gets its own byte count and SHA-256;
read failures retain an explicit row with no invented hash. Saved audio is the
same byte buffer that was screened, so editing the library later cannot change
what a report's source link plays.

Chromium's `decodeAudioData` decodes the actual encoded bytes in an offline audio
context. Analysis uses every decoded sample from both channels without mixing
them together. The context produces 48 kHz PCM, so decoded sample rate is **not**
claimed as the original encoded sample rate. No speakers or app playback queue
are used. The JSON contains:

- Decoded duration, frame/channel counts, RMS, dBFS, per-channel RMS and peak.
- Near-full-scale sample count and fraction (possible clipping).
- Leading, trailing and longest internal below-threshold intervals, plus the
  fraction of frames in low-signal windows.
- First/last 5 ms peak levels (possible abrupt cuts).
- MPEG Layer III frame integrity, encoded-frame duration estimate and, when
  present, Xing/Info frame count consistency. A tolerant successful decode does
  not erase a truncated-final-frame finding.

The current `voice-render-kit/render-plan.json` supplies **intended wording**,
never a transcription. Missing, extra or duplicate mappings are reported;
number paths with conflicting intended numbers are candidates. The older
`render-plan.full.json` is not used. Script hashes identify that evidence, not
proof that the recording actually says those words or that the current app
selects that script in every context.

## Policies and interpretation

The complete versioned policy is saved in each report. Current listening
thresholds are 10 ms windows below RMS 0.001 for low signal; overall RMS below
0.0001 for digital silence and below 0.003 for quiet clips; at least 0.1% of
samples at amplitude 0.999 for possible clipping; silence runs over 0.75 s;
clips shorter than 0.12 s; and boundary peaks above 0.03. More than 75% low-signal
windows is also flagged. These are screening policies, not validated measures
of intelligibility. Decoder overshoot, intentional pauses and naturally short
words can produce legitimate candidates.

The queue places Warm 2 first, then the other 2s and remaining 1–20 clips,
followed by other flagged/error clips and the rest of the library. Audio is
loaded only when requested. Intended wording is collapsed initially to make a
first listen less dependent on the expected answer. Listen for a clear number,
especially the opening consonant and ending, then compare the intended text.

Rows are `machine-candidate`, `screened-unreviewed` or `screening-error`.
**Every pronunciation remains unreviewed.** There is deliberately no approval
button, approval import, recognizer, transcript or automatic replacement. No
previous report or matching script can confer approval. Exit 0 means selected
sources were screened and decoder controls succeeded; it never means that all
clips sound correct. Candidates do not fail the command. Execution/mapping errors,
missing sources and exhausted deadlines return exit 1 with an incomplete report.

There are two workers, a 2 MiB per-clip limit, a 100 MiB aggregate input budget,
a 120-second/two-channel decoded limit, 30-second I/O deadlines, 15-second decode
deadlines and a ten-minute run budget. A stalled operation stops new work;
remaining manifest entries retain failure rows instead of disappearing. Browser
cleanup and report writing also have deadlines. A failed report write is a
visible CLI failure; a missing/incomplete report is never a pass. No retries
silently replace earlier evidence.

## Tests and controls

Fast tests run in the existing default/watch/CI regression loop, or directly:

```sh
node --test testing/voice-audit.test.mjs
```

They use synthetic PCM and independently specified MP3 framing, corrupt bytes,
silence, quiet/clipped samples, cuts, misleading script labels, missing files,
symlinks and deadlines. A separate fixture WAV parser checks the control oracle
without launching Chromium. This is a unit test, not an actual browser decode
claim. Deliberately permissive and always-failing decoders must fail the controls.

Each real audit additionally sends four generated controls through Chromium:
a healthy one-second tone, digital silence, corrupt encoded data and a WAV with
its payload cut short. The truncation control must reject or measure duration
loss against its independently known original one second. Controls must succeed
before any library result can be trusted. Production clips are never mutated.

## Remaining gaps and follow-up

Signal and container checks cannot identify wrong words, judge pronunciation,
or detect every loss of a syllable. A wrong-number waveform can look perfectly
healthy. Whole-frame MP3 truncation without useful frame-count metadata can also
escape detection. These are explicit report gaps, not unimplemented checks
pretending to pass.

No on-device transcription integration is included. The historical one-off
Swift recognizer used private input and is not reused or evidence of current
device availability. There is no cloud fallback.

This audit does not yet compare all 60 pilot sources with recordings captured
through the actual Coach queue. The existing `npm run test:audio` captures 1 then
2 across the nine persona/tier combinations with explicit playback deadlines;
its events and intended text are not a transcript. New reports now save exact,
hash-checked source copies beside the app mix and local request/file-read timings
for direct comparison. This uses the existing runner, not a second capture harness.
Source identity and nonzero signal still do not approve pronunciation. Physical
speakers, native speech, mobile timing and real rep/countdown/correction contention
remain separate checks. See [the follow-up](sessions/audio-integrity-2026-09-24.md)
for confirmed sentence-error/set-routing repairs and source listening priorities.

No heavy audit or browser capture is run as part of the focused unit command.
`npm run voice:audit` runs the explicit full-library audit; keep it separate from
other browser/audio work. No clips should be replaced until the specific defect
and proposed fix have been reviewed. See the latest closure record in project
status for the actual full-library result and remaining listening work.
