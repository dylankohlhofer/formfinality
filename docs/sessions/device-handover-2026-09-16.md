# Device/account handover — 16 September 2026

**22 September resumption:** the owner has cancelled the transfer to Ethan and
will continue on their own account. The September ZIP export was interrupted and
was never certified complete. The saved code and these notes remain useful for
continuation through the `codex/automated-test-lab` Git branch. Export receipts
are generated artifacts, not files expected in a Git clone.

This document carries the current conversation's engineering context to a fresh
local chat. It supersedes older conversational next-step lists, not AGENTS.md.
Use dated verification checkpoints in `docs/project-status.md` for their exact
scope; old sections of that document and `docs/HANDOVER.md` are history.

## Product and working preferences

Workout app with approachable coaching for beginners at home; mobile-first,
on-device inference, no application backend, no automatic video/diagnostic upload.
The proposed commercial model remains £4.99 once, not a subscription. Only correct
what can be measured; teach what cannot. Missing observations are unknown, never
bad scores. A skipped phase is null, not zero. Avoid verbose, repetitive speech
and browser-default voice overload. Yoga removal has been discussed; do not remove
the existing guided cases or content as part of an audio handover.

The owner wants extensive automation, retained regression suites, causal evidence,
and a short exception-review queue. Reuse `testing/`; do not create an unrelated
test platform or require full manual workouts to audit bundled speech. Broad
earlier approvals do not authorize cloud data sharing, spending or relaxing the
measurement contract. Physical-phone and beginner checks still matter.

## Source and architecture

Live build: `form-coach-v4.11.html`; v4.8/v4.9 are historical. The browser is still
a single-file pure judgement engine plus effects-driven shell. Source of truth is
HTML first, then deliberate shared vectors, then Swift parity. Content is data.
`swift/FormCoachEngine` contains engine/summary/interaction packages; native
SessionCore/CalibrationCore and the full mobile UI are not yet ported. The worker
is a prototype, not the live camera path. Browser coaching summaries/choices are
deterministic; optional Apple model selection is bounded and native-only.

## Completed work to retain

1. Session/calibration skip, null/unassessed summaries and explicit interruptions.
2. Shared automated engine/browser/shell/audio scenarios, all 21 exercises / 44
   supported tier pairs, mutation controls and persistent coverage-gap reports.
3. Required movement evidence separated from optional form; stable complete-side
   selection; opt-in follow-along, pause/resume/end, recorder and prompt fixes.
4. Evidence-backed summaries, local coaching interactions and consented memory,
   with bounded native selectors rather than unconstrained generated advice.
5. Review repairs for view eligibility, speech completeness, camera/mic lifecycle,
   and five later adversarial lifecycle/import defects. Their regressions remain.
6. Architecture optimisations: one pose conversion per current frame, idempotent
   passive DOM writes and incremental diagnostic byte accounting. No reduced
   observation cadence or weaker movement criteria.
7. Audio-stall recovery: two-second startup/progress checks, one fresh-element
   retry only before a line starts, original first-start deadlines, stale callback
   invalidation and a visible failure that releases the queue. No replay of a
   partially heard stalled line. The underlying intermittent OS/browser cause is
   unconfirmed. See `audio-stall-recovery-2026-09-14.md` for the exact distinction.

All of the above are in the supplied working snapshot, including files that were
uncommitted at the start of handover. The manifest records the transfer checkpoint.

## Verified checkpoint before handover

The last completed full run before this transfer was
`2026-09-15T03-36-59-711Z-84685` (synthetic input, original Mac): `npm test` exit 0.
82 infrastructure tests; 1,507 targeted tests in 20 suites; four original harnesses.
346 report rows: 334 passed, 12 blocked real-video, zero unexpected failures.
Engine 55/55 (1,307 checks); browser 110/110 (942); shell 129/129 (1,106);
recorded audio 16/16 (388). The deliberately broken audio captures remain failed
evidence inside passing mutation tests. Four lost FPS vectors remain unreplayable.

HTML SHA-256: `cb6e83e77533d22db76f0681128066771fb13feaacc4245ec6f7806106f31bf5`.
The transfer receipt separately records checks performed while packaging; it does
not turn this Mac's results into validation of the receiving machine. The full
private/local `test-results/` tree is not transferred. A selected synthetic-only
receipt and source hashes are included so the checkpoint is not just remembered.
Swift and native real-model smoke tests are separate; do not infer they ran from
a browser `npm test` pass.

## Immediate next task: speech intelligibility audit — NOT IMPLEMENTED

User report: some numbers, especially **2**, sound like **"coo"**. On 22 September,
the preserved `docs/feasibility-study.md` was found to name Warm's "two" in Max's
earlier report. This is a useful lead, not confirmation of the current clip's
pronunciation or the cause. The outgoing agent could inspect
audio metadata and event traces, but its tool context could not directly listen
to the audio. It did not certify pronunciation or repair the source MP3s.

Ground truth inspected on 15 September:

- `voice/manifest.json`: 1,294 entries; 120 number files for each of steady, warm,
  energy (360 total). Extra MP3s exist outside the active manifest; do not silently
  treat every directory entry as an active clip.
- `voice-render-kit/render-plan.json`: 1,294 entries; each persona's `num/2.mp3`
  was authored with expected text `2`. This is intended text, not transcription.
- `voice-render-kit/render-plan.full.json` is older (908 entries and a shared
  `voice/num/2.mp3` path). Do not use its name as evidence it is current.
- Number 2 metadata: steady ~0.496 s, warm ~1.254 s, energy ~0.549 s. These are
  container-duration estimates, not proof of missing syllables or wrong words.
- Nine existing persona/tier audio samples exercise **1 then 2**, with explicit
  3,000 ms deadlines. They are not a complete counting or pronunciation audit.
- `audio-review.mjs` checks signal/completion/queue facts. It does not transcribe.
  App-selected text cannot establish what the recording actually says.

Recommended implementation sequence:

1. Validate active manifest paths against expected scripts and build resolution;
   contain paths under the voice library, hash inputs and expose stale/missing
   mappings. Never assume the old render plan is a perfect current oracle.
2. Pilot the three 2s and 1–20 in each voice. Decode source audio and actual captured
   playback; compare beginnings/endings, level and duration. Separate bad source
   recordings from playback interruptions.
3. Use locally available offline recognition to screen actual words. Do not prime
   the recognizer with the expected answer. Numeric normalization must preserve
   different numbers. Missing/local-unavailable recognition stays a gap. Short
   tokens may be misrecognized or correctly guessed despite poor intelligibility.
4. Add independently labelled wrong-number, truncation, silence and volume controls.
   Separate deterministic failures from heuristic listening candidates. No test
   should pass merely because the app labels a clip "2".
5. Batch-screen all active clips and render a ranked review queue in the existing
   reports. Human approval is explicit and bound to the recording/script hashes;
   changed files invalidate approval. Include blind listening/spot checks, not a
   demand that the owner manually review every clip.
6. Test realistic rep/countdown/correction contention with production deadlines;
   retain stale/cancelled speech invariants. Replace only confirmed bad recordings
   after approval; any paid voice regeneration is a separate authorized action.

An earlier one-off Mac transcription experiment exists only in the original
ignored results (`test-results/user-test-review-2026-09-09/transcribe.swift`). It
used Apple's `SFSpeechRecognizer`, `supportsOnDeviceRecognition`,
`requiresOnDeviceRecognition = true`, timed cancellation and machine-labelled
hypotheses. **It is not a maintained batch auditor, not included here, and not
proof this device supports local recognition.** It was hardcoded to a private
human recording and must not be transplanted unchanged. At last inspection no
Whisper/FFmpeg executable was found on the original shell PATH; `afconvert` was
available. Check the receiving device rather than assuming tools or downloads.

## Open limits — never quietly mark solved

- Missing required ankles still constrain Leg Raise and Plank recognition. The
  positive/negative partial-visibility checks are policy evidence, not a solved
  hidden-motion recognition feature. Do not invent reps or silently swap drivers.
- Body/clothing tests are synthetic robustness contracts, not population accuracy.
- Native-TTS waveforms, physical speakers/Bluetooth, phone interruptions, thermal
  behaviour, clean-camera human replay and a second independent beginner session
  remain incomplete. More green synthetic runs do not close them.
- This transfer neither creates a cloud backend nor deploys anything; installing
  development dependencies may need network access and device approval.

## Reading map

Start with `AGENTS.md`, `START-HERE.md`, this note and the current dated checkpoint
in `docs/project-status.md`; then the relevant `testing/README.md` sections.
Use `docs/architecture-guide.md` / `docs/system-reference.md` for code orientation,
the three dated review/optimisation/stall notes for recent changes, and
`testing/audio-{sweep,bridge,review}` plus their tests for audio integration.
Read `testing/ai-review.md` and `docs/local-coach-contract.md` before changing an
AI review boundary. Do not mistake private path references for transferred files.

Original `docs/HANDOVER.md`, `restructure-plan.md`, `exercise-and-feedback-plan.md`
and `feasibility-study.md` are preserved unchanged as historical owner context.
Their old test counts, proposed technologies and next-step ordering are not the
current implementation status and do not authorize a rewrite.

## Fresh verification during transfer

`npm test` exited 0 again at `test-results/2026-09-17T03-20-21-942Z-89339/`
(16 September local time). The same HTML hash passed all 20 regression suites,
four original harnesses, 55 engine, 110 browser, 129 shell and 16 audio cases.
Audio passed 388 checks; 12 real-video rows remain blocked. The separate handover
integrity checker passed nine tests, including corrupt/missing-file controls.
The source packager rechecks test-source hashes and verifies the extracted ZIP;
the included receipts describe the snapshot, not validation of the new device.
