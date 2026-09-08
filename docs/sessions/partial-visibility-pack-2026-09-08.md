# Partial-visibility pack — 8 September 2026

The user's approved scope was to reuse the existing testing infrastructure for
Squat, Crunch, Leg Raise and Plank. No parallel platform or native app was built.

## Delivered

- `npm run test:partial` selects a named pack through the existing runner.
- Four declarative scenarios run in engine and desktop/narrow browser modes, with
  normal assertions, screenshots/traces, failure reproduction and missing-video
  handling. Default test/watch/CI discovers them too.
- Thirty companion tests cover nine supported exercise-tier pairs, explicit
  observation changes, exact hold freezes, null scores and false-credit mutations.
- Snapshots expose actual latest telemetry and core state through both adapters.
- Scenario `coverageGaps` survive in JSON, HTML and `REVIEW.md` even when the
  no-false-credit checks pass. Leg Raise/Plank ankle-loss recognition is not solved.
- Existing screen-recording/diagnostic findings are reused as provenance, not
  invented clean-camera replay. The missing earlier landmark stream remains absent.

Guide: `testing/partial-visibility.md`. This includes commands, independent
expectations, what the synthetic inputs establish and the specific human-evidence
pairs still needed. Voice remains in the existing separate audio suite; this pack
does not add acoustic capture to accelerated landmark scenarios.

## Verification

Full `npm test` exited 0:
`test-results/2026-09-08T08-11-50-039Z-80412/`

| Suite | Result |
|---|---|
| Infrastructure | 64/64 |
| Coaching / prompt / diagnostics / worker / reported-session | 18 / 120 / 17 / 13 / 5, all pass |
| Movement evidence / shared cases / partial-visibility pack | 229 / 17 / 30, all pass |
| Conformance / mutation / drawing / skip | 4,127 / 8 / 250 / 26, all pass |
| Engine | 53 cases, 1,291 checks, all pass |
| Browser | 106 cases, 894 checks, all pass |
| Shell | 61 cases, 628 checks, all pass |
| Recorded audio | 13 cases, 238 checks, all pass |

Focused evidence:

- Eight browser cases / 180 checks:
  `test-results/2026-09-08T08-07-23-398Z-79920/`.
- Four engine cases / 77 checks through the npm shortcut:
  `test-results/2026-09-08T08-11-37-322Z-80361/`.
- `--pack partial-visibility --mode video --require-video` correctly exits **2**
  with no supplied recordings:
  `test-results/2026-09-08T08-11-00-983Z-80202/`.

The complete run retains ten video gaps, two uncaptured native-TTS fallback gaps
and six recognition warnings covering two unresolved problems across three modes.
These are not successful human-video tests. Deliberately broken infrastructure
variants fail as required; no application failures were suppressed.

## Artifact and unchanged scope

HTML SHA-256 remains
`74bff3f55a1c9cce7e27a9a98f5b973f8894ffab50d3e5ce194bbb243be0b9e9`.
The complete run's parent commit is `45f1fbc9c90d0cffa79e2a618438b8c57e0bed92`;
saved source/scenario hashes identify this then-uncommitted test-pack work.
Production HTML, content, conformance vectors, model, voice assets and Swift have
no changes. Swift tests were not rerun; the prior 25/25 result is historical.

## New manual review candidate

The narrow Plank screenshot shows the framing warning overlapping Show me how /
Ghost controls. See `testing/findings/partial-view-mobile-warning.md` for the exact
capture and reproduction. This is an observed test-viewport layout concern, not
an automated layout assertion, confirmed touch-interception bug or physical-phone
result. It remains unfixed; passing counter/form-bar checks are not UI approval.

No personal media was added to Git/CI or uploaded. The four pre-existing untracked
user handover/plan documents were left untouched. No tests or historical evidence
were deleted, and no new exercise judgement or fallback driver was introduced.
