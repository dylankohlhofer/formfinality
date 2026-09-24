# Loose-end closure — 24 September 2026

The requested scope was to bring the app up to date, close the current defects,
check the conversation backlog and document every implemented feature. The
[feature inventory](../feature-inventory.md) and [77-item reconciliation](../chat-backlog-2026-09-24.md)
separate working browser features, native modules, prototypes, unresolved bugs,
future proposals and human/provider dependencies. They do not claim those future
products were built during this maintenance pass.

## Camera disconnect repair

Unexpected video-track loss now pauses the existing core, cancels old speech and
local microphone listening, releases all owned streams, detaches the video and
shows a specific Camera disconnected dialog. A frame guard checks track state
before timestamp deduplication and prevents invalid/unready frames reaching
MediaPipe. Natural `ended` events and stopped tracks without an event are covered.

A workout can reconnect its camera without losing observed work, but waits for
explicit Resume. Failed reconnect keeps Retry and End available. End invalidates
late permission/playback callbacks; a switch cannot restore an obsolete stream.
Calibration offers its observed result or a fresh plank check, never joins bouts.
An interrupted reference recording is discarded with a visible explanation.

Eleven permanent `camera-loss-*` cases cover those paths in the existing shell
sweep. Focused evidence: `test-results/shell-focused-SmhQkq/`. All 18 existing
adversarial lifecycle/import cases and five existing review cases passed too.
The architecture probe's video stub now explicitly has valid dimensions/readiness
and idle camera state; all original conversion/observation assertions remain.

The new tracked `testing/camera-e2e.mjs` exercises the packaged, uninstrumented
app and GPU model with generated blank camera streams. Final result:
**19/19 each** in Chromium desktop/phone, Firefox phone and WebKit phone,
`test-results/camera-e2e-1790249665837-20286/result.json`.
CI installs all three engines and invokes this after local artifact creation.

Earlier integration runs retained a WebKit test-substitution failure: the second
acquisition bypassed the per-instance MediaDevices override (only one synthetic
call was recorded while a different live stream was attached). Retaining the
substituted navigator object fixed that boundary. The final assertion requires
exactly two synthetic acquisitions, the original ended, the replacement live and
actually attached. Assertions were strengthened, not removed. Intermediate runs
are retained under `test-results/camera-e2e-1790249218738-19633/`,
`1790249455399-19927/`, `1790249550270-20076/`, and `1790249607317-20183/`.
No WebKit inference error remains in the final run. These desktop-engine checks
do not establish physical-phone camera or human recognition behavior.

## Release assembly

Replaced fixed batches of four reads with eight bounded, immediately refilled
I/O slots. Input/output ordering and hashes stay deterministic. Per-file deadlines
name the path and operation; progress names oldest/slowest work. Parallel writes
complete before `release.json` is written. Path/symlink/model/size/no-overwrite
protections remain, with 24 packaging tests (30 including economics) passing.
The artifact loader verifies every allowlisted byte before serving it.

The fresh `dist/web-review-2026-09-24/` build completed: 1,294 clips read in
**162.8 seconds**, 1,305 assets written in **0.1 seconds**, 65.46 MiB plus receipt.
Individual source reads still took up to 3.9 seconds; the underlying filesystem
delay remains unexplained. The previous ten-minute failure is retained in the
[original review](full-e2e-review-2026-09-23.md). No deadline was extended.

Its emitted-artifact UI/inference/audio-decoding/same-origin smoke passed:
`test-results/web-release-1790249205111-19595/result.json`.
The initial sandbox attempt could not bind loopback (`EPERM`); the permitted
local-browser run passed. Source and packaged HTML both pass all 4,127 conformance
checks. The artifact is unpublished and is not an installable/offline app.

## Whole voice-library screening

Added `npm run voice:audit`, using the active allowlist and exact saved source
bytes. It records clip/script/analyser hashes, actual decoded sample measurements,
MP3 frame structure, independent decoder controls and a prioritised listening
queue. Warm “two”, the other “two” clips and numbers 1–20 come first. Its 22
unit/control tests run in the default/watch/CI regression loop.

The first full scan completed with **1,294/1,294 decoded, zero execution/mapping
errors and 68 machine candidates**. All four actual decoder controls passed.
Evidence: `test-results/voice-audit-1790249712805-20368/index.html` and `report.json`.
Candidate flags overlap: 60 possible abrupt boundaries, seven long internal
silences, one long trailing silence and one mostly-silent clip. These are review
candidates, not 68 confirmed recording defects.

Warm “two” decoded to 1.2074375 seconds with no structural/signal flag; its SHA-256
is `2bf5d8cf24f542e2e5cb650da2b81170685aaaadf7c6c08a32dc8ffb5ef61f45`.
That does not resolve the reported “coo” pronunciation. Every clip remains
pronunciation-unreviewed. No transcription, automatic approval, cloud call,
replacement recording or paid generation occurred. The audit is source decoding;
existing real-time app audio reports remain a separate comparison.

## Verification and durable handoff

HTML SHA-256:
`16474a35ef2987f1c1bf61ce9c3456f6d7bbee46073a11d1eba1fc11de2ff21e`.
Packaged HTML SHA-256:
`521904071b03e3c413c2cd950936664074662247a4ad883455e834a5cf6bcbdf`.
The extracted judgement engine is byte-identical to pre-change HEAD, SHA-256
`450ba0a053e77a2c955be7c097cd408779b87c2e746329ff89d1e03eb98911cc`.
Root vectors, content, voice bytes and Swift were not changed. Legacy VERSION,
storage/export identifiers and filename remain v4.11.

The complete `npm test` exited **0**, with evidence in
`test-results/2026-09-24T11-36-35-595Z-20614/`:

| Area | Result |
| --- | --- |
| Infrastructure | 82 passed, including deliberate audio/control failures that the tests correctly detect |
| Regression suites | 26 suites / 1,662 tests passed |
| Original harnesses | 4,127 conformance, eight caught mutations plus healthy control, 250 drawing, 26 skip checks |
| Engine | 55 cases / 1,307 checks passed |
| Browser | 110 cases / 942 checks passed |
| Shell | 162 cases / 1,438 checks passed |
| Recorded audio | 16 cases / 388 checks passed |
| Missing human video | 12 blocked cases, retained as coverage gaps |

All **86** recorded JavaScript/release source hashes and the saved HTML hash match
the delivered files. The report retains 26 review/coverage candidates. The
separate blank-video smoke also passed **14/14** checks in
`test-results/2026-09-24T11-46-32-777Z-22378/`; it confirms the replay adapter still
works after the frame guard, not human recognition. Prior intermittent audio
failures remain open despite this passing run.

The unchanged Remotion code retains the 23 September 30-test/Studio/render
verification. Swift is unchanged and was not rerun in this pass; its previous
105 deterministic passes/three optional skips remain explicitly dated evidence.
Git publication status is recorded below.

Active next-step and continuation documents were refreshed. Historical proposals
remain preserved and labelled. The new inventory includes every feature added
since the first visible Skip request; the backlog retains screenshot reflection,
voice intelligibility/intermittency, partial-body recognition, demo integration,
native/account/Duo/distribution and older content requests with concrete next
conditions. Beginner test 02 and real-phone/speaker/body/clothing evidence remain
open; a passing synthetic suite cannot close them.

## Git checkpoints and publication blocker

- `816e43e` — Preserve approved Remotion squat prototype and checks.
- `09ad337` — Recover cameras and harden release and voice verification.
- This closure record, feature inventory, chat reconciliation and refreshed
  continuation documents are preserved in the subsequent documentation commit.

The non-forced command
`git push -u origin HEAD:refs/heads/codex/automated-test-lab` was attempted on
24 September after the implementation commits. GitHub rejected it with:

> refusing to allow a Personal Access Token to create or update workflow
> `.github/workflows/test-lab.yml` without `workflow` scope

The credential owner must authorize workflow publication before retrying the
same branch push. Do not paste tokens into chat or delete the workflow to get
past this protection. Verify the remote SHA after success, then inspect a real
Actions run; local tests do not certify remote CI. No force push, merge, branch
deletion, collaborator-access change or public deployment was performed.

The initial read-only remote check found `main` and `ethan` at `e7251ce`, with no
`codex/automated-test-lab` remote branch. A second `git ls-remote --heads origin`
after the rejection confirmed exactly the same two refs. This rejected push
does not back up the current development work. Licensed character assets and
generated/private evidence remain intentionally outside Git.
