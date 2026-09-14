# Evidence-backed summaries and optional local AI — 14 September 2026

## Delivered scope

First phase of the agreed recommendation: improve the debrief now and prepare an
optional native, on-device selection component. This is not continuous video
judgement, live generated form corrections or a native app/session-core port.

The browser now shows up to two concise highlights, more recorded observations
when available, all original set rows and an expandable explanation of measurement
limits. It uses deterministic templates and never claims to have run a language
model. No summary is persisted, no remote provider is added, and speech continues
through the existing local-only playback policy.

`SessionCore.finish()` adds an engine-authored `workout-summary/1` envelope.
The model can select approved card IDs, not author advice, numbers or coverage.
The selector receives only the bounded card catalog, never video, landmarks,
identity, arbitrary skip reasons or a private diagnostic export. The original
scoring, movement thresholds, MediaPipe model and root conformance vectors are
unchanged; watched frames still accumulate exactly once.

## Truthfulness fixes

- Correction timing no longer diagnoses fatigue, ability or a setup cause. Logs
  record when coaching fired and are affected by budgets/cooldowns, not fault onset.
- Shorter recorded rep cycles are described numerically, not called rushing or
  evidence that the earlier reps were controlled.
- A quiet correction log does not imply perfect form, improvement or readiness
  for a harder tier. The compatibility field `nothingWrong` remains false.
- Skipped, stopped, guided and follow-along sets produce no assessment highlights.
  Observed work before an interruption remains in the existing totals.
- The all-skipped headline no longer claims nothing was watched if work preceded
  a skip. Skipped phases still have null scores, never zero penalties.
- The best-hold tile excludes guided time, while retaining actual hold seconds
  before Skip, Follow along and End. The historical engine `bestHold` field is
  unchanged; the browser projects only `kind: "hold"` rows for this tile.
- Review caught inherited neck-pulling wording in Crunch: the metric measures
  neck alignment, not hand contact or pulling. The debrief now names alignment.
- The shared sag teaching point no longer sends Push-Up/Knee Push-Up users to a
  Plank demonstration. Real evaluator-to-finish cases protect both wording fixes.

## Native component

`FormCoachSummary` is a separate library product within the existing Swift package.
Its only production provider is `SystemLanguageModel.default`, with availability
checks, default guardrails, no tools and a constrained ID-selection schema. Native
UI/session integration remains future work. See `swift/FormCoachEngine/SUMMARY.md`
and `docs/workout-summary-contract.md` for the contract and integration sequence.

A usable template is synchronous; generation requires an explicit current-debrief
request ID. Timeout, cancellation, unavailable model, invalid output and provider
errors retain the fallback with an explicit status. Leaving the screen or replacing
the request invalidates old work even when cancellation is ignored. A queued caller
cannot opt a newer debrief into AI, whether or not that caller was cancelled.
The platform cannot forcibly terminate an arbitrary uncooperative provider's work;
the guarantee is bounded waiting and no late publication, not a resource-kill API.

Independent review found two native defects before completion: cancellation was
checked after mutating newer state, and Apple's JSONDecoder accepted duplicate
members/trailing commas. The final entry guard and fixed-depth bounded wire grammar
address both; raw-byte and queued-caller tests are retained.

## Verification

Final browser build SHA-256:
`2989c28d498fc6a2f5a21e533d94bc4351a47c92ffe80696dd90d8d92a0d2e3d`.
Working-tree verification based on `bcdfdb0`; final app and JavaScript test hashes
match the saved run. Documentation and the separately tested native component were
finished afterwards.

`npm test` exits **0**, report:
`test-results/2026-09-14T13-36-38-583Z-35989/` (local, ignored).

| Coverage | Result |
|---|---|
| Infrastructure | 65 tests, zero failures |
| Targeted regression suites | 800 checks across 11 suites, zero failures |
| Original conformance | 4,127 checks, zero failures |
| Mutation / drawing / skip | 8 caught mutations plus green control / 250 / 26; zero unexpected failures |
| Engine scenarios | 55 cases / 1,307 assertions |
| Browser scenarios | 110 cases / 942 assertions |
| Shell/interface | 88 cases / 847 assertions |
| Recorded-clip audio | 15 cases / 301 assertions, zero review candidates |

New coverage consists of **50 summary checks**, including **22 shared JS/Swift
selection vectors**, and **10 browser cases / 70 assertions**. The full run retains
26 explicit coverage-gap findings: 12 absent human-video inputs, two native-TTS
waveform gaps and 12 case-level recognition/real-person warnings. No existing
expectation or conformance vector was weakened or regenerated.

`npm run test:video` separately passes **14/14** at
`test-results/2026-09-14T13-41-03-467Z-37556/`: 90 real CPU inference frames on a
blank synthetic recording, not exercise accuracy.

Final `swift test --package-path swift/FormCoachEngine` exits **0**: **47 passed,
one intentionally disabled real-model smoke skipped**, zero failures. This includes
the original 25 engine tests, seven summary contract tests, 15 lifecycle tests,
27 shared movement-evidence rows and 22 shared summary-selection rows. The existing
CI workflow adds a macOS Swift job; remote CI has not been run/pushed in this turn.

The explicit **actual local-model smoke also passed**, separately from the default
suite, using synthetic cards only. The first probe with a 30-second ceiling took
5.032 s and selected `set-1-focus`; this exceeded the proposed three-second UI
budget. The default was therefore changed to ten seconds with an immediate usable
template. The final smoke uses that same production deadline and returned:

```text
availability=available; status=selected; source=on-device; reason=selected
cardIds=["set-1-work"]; elapsed=3.109603125 seconds; synthetic=true; upload=false
```

This proves real on-device wiring and validated selection on this Mac. The differing
valid selections demonstrate why a pass does not certify recommendation usefulness,
repeatability, physical-phone latency, battery behavior or spoken output.

Development evidence is retained. The first focused browser check expected `0:00`
where the existing formatter uses `00:00`; the new test was corrected, not the clock.
A new Crunch fixture initially produced no neck cue; changing visible ear geometry
established the intended evaluator input without injecting a cue or changing an
expected outcome. Earlier full passing run: `2026-09-14T13-27-57-668Z-33364`.

## Next steps

Keep the browser summary available to everyone. Integrate the optional selector
when the native session/debrief shell exists, preserving exact facts and fallback.
Review selection usefulness on consented, representative session summaries and
measure supported-phone latency/thermals before advertising the AI feature broadly.
Between-set AI updates come later; the immediate counting/correction loop remains
deterministic. Hidden-motion recognition and beginner/device validation remain open.
