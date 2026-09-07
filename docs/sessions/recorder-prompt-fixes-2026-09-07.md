# Recorder and optional-help follow-up — 7 September 2026

## Outcome and scope

Implements the first phase of the [current recording review](current-recording-review-2026-09-07.md):
FC-LAB-007 (intrusive/stale easier-plank offer) and FC-LAB-008 (recorder usability and
flag retention). The two original reproductions now pass without forced clicks or
inverting their expectations. The partial-view Crunch reproduction remains a genuine
failure. This work does not claim to fix exercise visibility, native speech startup,
leg-raise inference or side-plank target shortening.

## Optional help, not an ability judgement

SessionCore now owns a separate optional-help clock. Setup gets five seconds of grace,
then requires six continuous seconds of visible, relevant quality-gate difficulty.
The earliest setup offer is approximately 11 seconds. Active holds need six fresh
seconds after arming; setup difficulty cannot carry across. This is an explicit UX
policy, not a validated measure of a beginner's ability.

Tracking loss, unknown/limited/wrong view, clipping, absent position readings and
low-confidence joints reset the clock. Every declared position target must actually
be observed and pass; an omitted reading is not evidence of a correct position.
Only a visible failed quality gate supports an offer. The evaluator's measurements,
thresholds, out-of-pose clock, scores, rep counting and hold accumulation are unchanged.

Recovery withdraws the choice immediately, before the normal 1.8-second arming window.
An observation gap also withdraws it. Each movement can offer once, including after
Keep going, recovery and arming. A new movement resets eligibility. Acceptance still
teaches the declared easier exercise; an unaccepted suggestion stays visual and does
not announce a change the person has not chosen.

The compact offer no longer sits in the centre of the body view. Demo and choice
have an explicit stacking/layout policy, including side-by-side phone-landscape
presentation. Normal pointer actions—not forced clicks—protect their accessibility.

## Recorder interface

Private diagnostics is a native disclosure in the header. Its fixed, scrollable
drawer does not shrink the stage. Start/Resume closes it and returns focus; Close,
Escape and native keyboard toggling also work. A quick flag button remains available
while recording. Opening, closing, flagging, pausing and revoking consent leave
workout progress alone. Tests cover desktop 1280×800, portrait 390×844 and landscape
844×390; these are browser viewports, not physical phones.

## Retention and privacy

Capture remains opt-in, memory-only and bounded to a 4 MiB serialized export and
4,000 retained entries. This is not a measured 4 MiB JavaScript heap claim. No camera
pixels, microphone recording, automatic persistence or upload is added.

- The protected session timeline retains control/coaching events and lightweight
  summaries approximately once per second or on relevant state changes. Summaries
  contain phase/movement, tier/target, reps, held time, score and blockers, not joints.
- A rolling allocation keeps recent full-rate frames. Only unprotected frames roll
  off; their discarded count and current retained time range are shown live.
- Up to eight flags pin available frames from ten seconds before and after the flag,
  sampled at up to 5Hz. Overlapping windows share frame records. This is not full-rate
  replay; pre-roll may already be incomplete and actual retained bounds are exported.
- Pause ends an unfinished flag window explicitly. Resume preserves earlier evidence
  without pretending the paused interval was captured. Clear, consent revocation
  and reload erase both ordinary and protected data.
- If protected records fill the budget, capture pauses visibly while the workout
  continues. The failing append is transactional: existing flags and frames stay
  intact. Export and Clear are required before starting a fresh capture.

Schema 2 exports include retention boundaries and closure reasons. Schema 1 exports
remain readable and are labelled as legacy rolling evidence; their missing flags
cannot be recovered. Import validation checks byte/count/complexity limits, finite
values, chronological order, frame shapes, flag-window relationships and correspondence
between claimed bounds and retained records. Imported text remains inert.

Replay never invents intermediate joints. It clears the skeleton when the playback
clock moves beyond 250ms from a saved frame, including while waiting through a pause
or omitted interval, and does not carry a different movement's skeleton forward.

## Independent checks and deliberate changes

Two agents authored/reviewed focused prompt and UI checks while the main agent
implemented the production code and retention tests. Review exposed missing-position
and unknown-view prompt gaps, simultaneous demo overlap, stale replay through a pause,
and inconsistent imported closure metadata; these received fixes and retained checks.

`testing/setup-prompt.test.mjs` exercises 15/30/60fps timing, recovery, missing evidence,
phase reset, acceptance, dismissal and actual browser interactions. Most quality
cases override only a metric reading to isolate difficulty; a separate bent-hip
fixture uses synthetic geometry. Neither is recovered human camera data.

The existing prompt tests deliberately extend their difficulty input from 7/8 seconds
to 12 seconds, preserving the offer → recovery → dismissal expectations. Two old
buffer tests deliberately change policy: flags and speech no longer roll off like
ordinary frames. Their replacements enforce protected retention and visible capacity
pause, retaining the original byte/count and null-measurement guarantees.

No conformance vector, movement content or Swift source was changed. SessionCore and
CalibrationCore are still absent from the Swift package, so there is no corresponding
session implementation to mirror. The original four harnesses remain required.

## Verification

`npm test` exits **1 solely for the retained partial-view Crunch failure** in
`reported-session` (four cases pass, one fails). All other suites pass:

- 60 infrastructure tests, 18 historical coaching tests, 120 prompt tests,
  17 diagnostic-buffer tests and 13 worker-queue tests.
- 48 engine cases / 1,207 checks; 96 browser cases / 694 checks;
  61 shell cases / 628 checks; 13 audio cases / 238 checks.
- Original harnesses: 4,127 conformance checks, eight mutations caught,
  250 drawing checks and 26 skip checks, all passing.

Evidence: `test-results/2026-09-07T22-38-12-040Z-47950/` (local/ignored).
HTML: 262,138 bytes; SHA-256
`f365e12ee932964a963a66a8021ff249013764b5a29c74708f8d3b84280345d4`.
Running module SHA-256:
`75aae274879425deefa847f05f83878de525811369405afa6503f70ad7c825ea`.
The saved run build matches the current artifact exactly. Static audits found no
missing literal DOM IDs, undefined CSS variables, duplicate named functions or
unmatched effect handlers. Runtime classes/selected states remain styled and the
global `[hidden] !important` rule is intact. `git diff --check` is clean.

Five video coverage gaps and two uncaptured native-TTS fallbacks remain. No synthetic
speech review candidates appeared, which is not listening or physical-device sign-off.
Swift source is unchanged from the earlier 18/18 run; it was not rerun in this phase.
An earlier integration run was stopped after review found additional prompt cases;
its evidence remains in `test-results/2026-09-07T22-23-59-331Z-45672/`, but it is not
the final verification verdict.

## Next phase

Separate movement evidence from form evidence, beginning with the retained cropped
Crunch failure and plank/leg-raise cases. Preserve entirely off-screen, upright and
aborted-cycle negative controls; missing form measurements must stay unscored. Then
address stable hold/adaptation policy and consistent bundled voice packaging.
Physical-phone checks and beginner test 02 remain necessary.
