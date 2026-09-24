# Audio integrity follow-up — 24 September 2026

The next development priority was source-versus-playback investigation of the
reported unclear “two”, confirmed playback defects and intermittent capture
failures. This pass does not approve pronunciation or replace the voice bank.

## Confirmed production defect: disconnected sentence fragments

The existing two-second stall path already failed the whole instruction. Ordinary
`play()` rejection instead advanced to the next fragment, retaining only a final
failure flag. A decode/load error could therefore leave audible trailing words
or a number without the sentence that explained them. Media errors after playback
began also lacked an immediate handler. The low-level bank accepted incomplete
path lists and could play whichever fragments existed.

Seven added deterministic tests failed on the prior implementation; the twelve
existing stall controls passed. The repaired implementation passes all nineteen:

- A missing manifest fragment refuses the complete recording before playback,
  leaving the existing complete local fallback/unavailability path to Coach.
- A rejected play or media error fails the entire line once, clears timers,
  discards the failed element/source and does not play the remaining fragments.
- A partially heard line is not replayed or automatically spoken through TTS.
- The independent next line can still play; Stop and stale ended/error callbacks
  cannot affect newer speech.
- Production startup deadlines, one pre-start stall retry, progress checks and
  the whole-line watchdog are unchanged.

The old `recorded-clip-cancel` shell assertion explicitly expected errors to
advance through the sequence. It was deliberately corrected to require whole-line
failure, no trailing playback and cache eviction. Cancellation and successful
new-sequence assertions remain. This is a policy repair, not a vector refresh.
The judgement engine, content, voice bytes and dependencies are unchanged.
Swift has no runtime playback adapter to mirror; its shared clip resolver was
subsequently updated for the separate routing defect below.

## Confirmed harness defect: stopping capture too early

The number samples allowed each number to start within three seconds of its
request, but stopped recording after four seconds regardless of completion.
Warm “two” can legally begin late enough to finish beyond that cutoff. The
September 23 evidence already showed `capture-end` immediately before `clip-end`.
The repaired sample observes queue/media completion within a bounded capture
tail. It does not extend production expiry or accept a missing/incomplete number.
Ordinary session action/cancellation timelines keep their declared lengths.

## Confirmed routing defect: dynamic set announcements treated as static

The source investigation found twelve `nextset` recordings whose intended scripts
contain `{c}`/`{o}`. The resolver recognized only `{t}`/`{p}`/`{x}`, so it selected
the same whole MP3 for different set numbers. A fixed recording cannot accurately
convey both changing values. This proves a selection defect, not what literal
words exist inside those recordings.

Templates with unsupported or malformed placeholders now decline recorded
resolution. Coach uses its complete, explicitly local speech fallback or visible
unavailability. The optional nickname retains its existing omission behavior.
Eight additive shared clip cases cover changing sets, rounds, values, mixed/
future/malformed placeholders and the optional-name control: seven failed before
the fix; all twenty-five shared cases and eight historical cases pass afterward.
No old expected output or root conformance vector was regenerated. HTML was
changed first, then the Swift resolver was mirrored. A shell case checks changing
set wording, local-only selection and unavailable-voice queue release.

The SwiftPM workflow built and tested the Engine, Summary and Interaction
libraries (and packaged review CLI): **105 deterministic tests passed, three
opt-in real-model tests skipped**. No native UI/playback or physical-device run
is claimed.

## Source comparisons and review priorities

Every new real-audio report now includes hash-addressed, unchanged source copies
beside the captured app mix. The copy helper accepts public manifest entries only,
enforces path/symlink/count/byte/deadline bounds, and reports stale hashes or copy
failures without losing the original capture. A complete matching server response
establishes served-byte identity; partial, missing or intercepted responses remain
explicitly unverified. Nineteen synthetic helper tests cover these boundaries.

The source investigation rechecked all 52 non-number machine candidates and
comparators against their saved audit copies. Warm Building's glute-bridge prefix
contains **3.352 seconds of trailing low signal in a 4.412-second source**; this
pause is in the source, not created by the queue. Its intended prefix is only
“Glute bridges —”, with the rest in separate fragments. Energy Building's squat
prefix also merits listening: 3.855 seconds for intended “Squats —”, including
2.77 seconds of above-threshold windows. Neither was trimmed or replaced.

Warm/Steady/Energy number-two audio attachments were unavailable to the agent's
audio input. No actual listening or transcription occurred. The new paired
source/app report supports that focused review without pretending it was done.
Detailed source hashes/metrics remain in the local evidence note
`test-results/audio-followup-2026-09-24/source-candidates.md`.

## Evidence and remaining boundaries

Audio reports now retain bounded, per-case local transport observations: browser
request timings, server receipt, path/stat/file-open/first-byte/end stages,
response completion/cancellation, transferred-byte count and SHA-256. Partial
range-response hashes identify that range, not the complete MP3. This is local
test instrumentation, not product telemetry or permission to upload recordings.

The original intermittent request delays are not diagnosed by a passing new run.
Trace data distinguishes future delivery stalls from media/capture behavior; it
does not retrospectively prove the OS/browser cause of old failures. Likewise,
nonzero signal and matching source bytes do not establish the words or consonants
a listener hears. Physical speakers, Bluetooth, native TTS and human recognition
remain separate evidence gaps.

## Final verification

Full `npm test` exited **0**. Evidence:
`test-results/2026-09-24T12-46-54-834Z-25039/`.

| Area | Result |
| --- | --- |
| Infrastructure and deliberate failure controls | 96 passed |
| Regression suites | 27 suites / 1,696 tests passed |
| Original harnesses | 4,127 conformance; eight caught mutations and healthy control; 250 drawing; 26 skip checks |
| Engine | 55 cases / 1,307 checks passed |
| Browser | 110 cases / 942 checks passed |
| Shell | 163 cases / 1,448 checks passed |
| Recorded audio | 16 cases / 413 checks passed |
| Missing human video | 12 blocked cases; 26 review/coverage candidates remain overall |

All **89** recorded test/release source hashes and saved HTML match the final
implementation. HTML SHA-256:
`a083a5317dbd00850a55031de454c973829259dc5e5061157b287a87f3fe67f6`.
The extracted slice from `const TIERS` to before `const AudioBank` is byte-
identical to pre-change HEAD, SHA-256
`e13c6ca7a5aa9811c17ce1343d8b0e96ce36db58d6b9ce1e4e5df804ec2b4a68`.
Root vectors, content, voice bytes and dependencies did not change.

The two real corrupt-splice tests also ran against the archived pre-fix build:
**both failed** because the remaining sentence was played. Old-build evidence:
`test-results/audio-mutation-jUCNoZ/`; focused repaired control:
`test-results/audio-mutation-g51e35/`; full infrastructure controls:
`test-results/audio-mutation-RGGjYt/`. The delayed-number control permanently
retains both the failing old four-second cutoff and the passing completion-aware
capture. An intentional mutation's failed capture is expected negative evidence,
not silently promoted to a passing audio case.

All **65 per-case source copies** in the final audio sweep matched their complete
served response bytes, with zero source-copy errors. The Warm Building comparison
is `audio-clips-warm-building/audio-review.html` inside the full run. Its “two”
source SHA-256 is
`2bf5d8cf24f542e2e5cb650da2b81170685aaaadf7c6c08a32dc8ffb5ef61f45`.
Neither those matching bytes nor completed measured signal approves pronunciation.

A fresh, unpublished `dist/web-review-audio-2026-09-24/` package passed the actual
artifact smoke and 4,127 conformance checks. Packaged HTML SHA-256:
`1546b4cea269d1a8cc7aaa9a981a2b8070691a77d8d4c5bfb99093cbdbe21004`.
Smoke evidence: `test-results/web-release-1790254605556-26749/`. This run read
1,294 source clips in 0.2 seconds and wrote 1,305 assets in 0.1 seconds; the earlier
multi-second file reads did not recur, but their cause remains unproven. Existing
three-engine camera tests were not rerun in this audio-only pass. No physical
device, speaker, beginner session, public deployment or voice replacement occurred.

## GitHub publication

The owner added Workflows permission to the existing fine-grained repository
token. The previously blocked non-forced development-branch push then succeeded;
remote `56412b4eefce2d3d3c02b49aa04cf5cfaa6712b7` was verified. GitHub Actions
[started automatically](https://github.com/dylankohlhofer/formfinality/actions/runs/36001701699).
That initial run was not yet complete when checked; verify the latest branch SHA
and Actions result for the subsequent audio-fix commit. No secret was printed or
written to a file. No token regeneration, branch overwrite, merge, collaborator
change or public deployment was performed.
