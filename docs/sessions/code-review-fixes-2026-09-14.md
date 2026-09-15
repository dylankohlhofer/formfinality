# Full-code review fixes — 14 September 2026

Requests: fix all eight findings from the review of `93f8ae3`, then conduct another
full review, fix confirmed issues and commit both passes. Browser build remains
`form-coach-v4.11.html`; no cloud service, model change, new movements or paid
runtime is introduced. Existing untracked planning/handover files are untouched.

Review scope: browser measurement/rep/hold/session logic, camera and modal
lifecycle, speech routing, summaries, local commands/planning/memory/diagnostics;
Swift engine parity and optional speech/AI boundaries; test execution, evidence
packaging, watch mode and CI. This is a code/software-contract review, not a
claim to have validated all real bodies, garments or physical devices.

## Changes and evidence

1. **Unreliable form scores:** apply the existing view thresholds before reading,
   smoothing or scoring a quality target. Oblique Crunch still counts its visible
   torso cycles but cannot score, tint or correct neck form. A required depth gate
   such as Downward Dog's hip angle remains unavailable, with a view explanation.
   Wrong-view holds cannot accumulate form scores or corrective cues.
2. **Calibration continuity:** 2.5s of continuous missing required evidence after
   arming pauses the attempt. The existing dialog offers Restart or Use observed
   result. About six watched seconds, a minute of tracking loss and more planking
   no longer produce Strong. Short flicker excludes unseen time and recovers.
3. **Camera units:** convert x and z consistently from MediaPipe width units.
   Identical normalized geometry now gives the same 45° at landscape, square and
   portrait aspects instead of crossing the app's view-reliability threshold.
4. **Hidden view landmarks:** require finite, confident, in-frame members of each
   shoulder/hip pair. One valid pair suffices; no valid pair marks view unavailable
   and cannot authorize scoring/counting or a guessed direction to turn.
5. **Modal microphone controls:** Pause and Help contain their own reachable
   microphone-off buttons, including visible release-failure instructions. Real
   Chromium clicks at 390px and 1280px exercise substituted local recognizers;
   they are not physical microphone/permission tests.
6. **Demo interpolation:** reflect the continuous timeline before choosing a
   keyframe segment. Return legs interpolate rather than holding the final frame
   and snapping back. All 21 authored demos have symmetry/loop-continuity checks,
   plus an independent three-keyframe reverse-segment example. Static gate and
   drawing checks remain unchanged; recognition as a useful demonstration still
   needs human review.
7. **Plan availability:** picker, search, preview and startup share supported
   movement/tier validation. Three legacy Strong offerings are excluded, not
   silently altered. Nine declared plan/tier combinations remain available.
   Invalid construction fails loudly; incompatible retiering preserves current
   state. Empty internal sessions still finish immediately with no work.
8. **Required video:** incompatible engine/browser/audio/library-only selection
   exits 2. The final gate explicitly requires completed successful video rows;
   zero video rows cannot pass by omitting a blocked entry. Failures still exit 1.
9. **Camera-switch command race:** disabling the touch Resume button did not
   prevent `coach resume` or confirmed Skip from unpausing the core while the new
   camera was pending. A shared readiness guard now owns all Resume routes and
   confirmed set advances. The pending stream must settle before a fresh explicit
   Resume; End remains available.
10. **Failed camera recovery:** if both replacement and original playback fail,
    Resume stays disabled and command routes reject it. The prior code unpaused
    into a dead camera. Post-await request-identity checks also keep delayed old
    recovery failures from disabling a newly started workout.
11. **Unavailable telemetry:** no readings during wrong/unknown view was labelled
    “guided”. It now says observation unavailable/counting paused and retains the
    view blocker. This changes no measurement or score.
12. **Incomplete recorded instructions:** a manifest containing only a target
    number could make “Rest — forty” play as just “forty”. Every word-bearing
    sentence part is now required; incomplete sequences use the whole explicitly
    local utterance, or visual unavailability. Empty/punctuation-only halves are
    still valid. HTML was fixed first, then Swift mirrored it against shared cases.
13. **Build provenance:** the four original harnesses used the working build path
    after the report had already saved its snapshot. A watch-mode edit could put
    another build's results under the saved hash. They now consume that run's
    archived `build.html`, as the regression suites already did.
14. **Mutation harness portability and false-green control:** the full run exposed
    an assumption that `verify.mjs` lived beside the selected build. The harness
    now resolves its verifier from its own script directory, so archived builds
    work too. A healthy control requires exit 0 AND the successful refGates line;
    absent output, launch errors or a nonzero exit cannot pass. All eight original
    mutation bodies and expected failure names are unchanged.

## Durable regression coverage

- `testing/review-regressions.test.mjs`: 70 independently asserted checks,
  including 17 new shared clip-resolution rows and eight historical clip rows.
- `testing/movement-evidence-vectors.json`: eight added cases, 35 total shared
  with Swift. Original 27 rows unchanged. Swift's evaluator mirrors HTML; session
  and calibration cores are still not ported.
- Five additional `interaction-*` shell cases; the 12 declared plan/tier checks
  now distinguish nine available combinations from three exclusions.
- Five required-video infrastructure checks, including real command invocations.
- Five `review-*` shell cases exercise actual command routes, local synthetic
  camera playback, stale callbacks, telemetry and substituted local TTS. The
  harness-provenance test executes the real runner invocation block with a spy;
  all four original suites must receive the archived build, not the working path.
- One real archived-build mutation test (including spaces and a different working
  directory) and three simulated failed-verifier control tests retain that fix.
- Everything runs through the existing default/watch/CI loop. No automatic AI
  invocation, private recording upload, expectation rewrite or new harness.

## Deliberate migration and retained failure

Exactly seven checkpoint fields changed in three root scenarios: `view-blocked`,
`view-limited-depth-suppressed`, `sideplank-wants-front`. Unavailable scores become
null; suppressions name targets rather than unmeasured faults; the unavailable
Downward Dog gate requests a side view. Their blocked position, zero hold and zero
reps remain. All other inputs, expectations, tolerances and content are unchanged.
The manual-only `testing/refresh-review-view.mjs` checks prior values and records
provenance; it does not derive expected results from the implementation.

The second review additionally migrated exactly one historical clip expectation:
`clipResolver/rest` with a missing prefix now expects null (full local fallback),
not a number-only sequence. `testing/refresh-review-speech.mjs --write` asserts
that exact input/prior output before changing it. In total: eight expected fields
and two provenance records; no thresholds, tolerances or input poses changed.

The new camera and telemetry cases failed before their fixes; the retained
reproduction is `test-results/shell-focused-ZNaCNm/`. The camera test demonstrated
both unpausing and a phase advance during replacement. All five final shell cases
pass in `test-results/shell-focused-5tmR2L/`. Five independent incomplete-speech
cases also failed before the resolver fix, then all 25 clip checks passed.

The first second-review full run, `test-results/2026-09-15T00-37-04-037Z-70020/`,
retains the mutation-harness path failure. The selected HTML was correct, but the
verifier could not be found beside the archived build. Running the repaired
mutation harness against that exact archived HTML catches all eight mutations
and keeps a genuinely successful control. The fresh full run is recorded below;
the failed report is not edited or relabelled.

The first full integration run exposed an unintended rejection of empty internal
sessions. The original interface test was retained and the production validator
corrected. Evidence remains in `test-results/2026-09-14T22-52-33-449Z-64595/`; its
snapshot is not the final build. No test was weakened to accept that regression.
That run also retains the old Core Strength/Strong preview expectation, which is
deliberately incompatible with supported-tier validation. Its replacement tests
Strong set/rest/hold scaling on Full Body and second-side instructions on Core
Strength/Building, while explicitly checking the Strong exclusion.

The first-review build's blank-video smoke passed 14/14 checks at
`test-results/2026-09-14T22-59-57-152Z-66194/`. It checks the actual MediaPipe adapter
on synthetic blank footage, not a human workout or a solved recognition limit.

## Earlier validation checkpoint (before the second review)

The first pass's `npm test` exits 0 at
`test-results/2026-09-14T23-02-24-220Z-66545/`: 72 infrastructure tests, 1,255
targeted tests in 17 suites, all four original harnesses, 55 engine cases
(1,307 assertions), 110 browser cases (942), 101 shell cases (957) and 16 audio
cases (338). The report has 303 passing entries, 12 blocked video entries and
no failures. All 26 coverage-gap findings are retained. That checkpoint's Swift passes
104 deterministic tests with three optional real-model tests skipped.

That checkpoint's HTML hash is
`6f4c41fd1841f88a6609c016c89082fe76380b49d1544de6f708f27b790d89b5`.
Saved build, root fixtures and recorded JavaScript test-source hashes matched
that checkpoint. Its changes were still local/uncommitted at the time; the next
review includes them in the requested commit. No push or remote CI is claimed.

## Final validation for the requested commit

The second review's final `npm test` exits **0** at
`test-results/2026-09-15T00-47-17-766Z-71918/` (14 September local time):

- **77 infrastructure tests** and **1,280 targeted tests across 17 suites** pass.
- The four original harnesses pass: **4,127 conformance checks**, **eight caught
  mutations and a healthy control**, **250 drawing checks**, **26 skip checks**.
  Four historical frame-rate vectors remain unreplayable without their generator.
- **55 engine cases / 1,307 assertions**, **110 browser / 942**, **106 shell / 992**
  and **16 recorded-clip audio / 338** pass.
- The report retains **308 passing rows, 12 blocked video rows, zero failures**
  and **26 coverage-gap findings**. No unexpected speech candidates appeared.
- Swift passes **105 deterministic tests**; three optional real-model tests are
  skipped. The new resolver test uses the same 17 cases as JavaScript, alongside
  the 35 shared movement-evidence rows.
- The final-build blank-video smoke passes **14/14** at
  `test-results/2026-09-15T00-46-13-980Z-71677/`.

Final HTML SHA-256:
`21a6f523e98d178c16c0a715580a743446a19b76ab691ba2e93da8aac4d1cc67`.
The archived build, nine recorded build/fixture/lockfile/bridge hashes and all 56
recorded JavaScript test-source hashes match the final files. Documentation was
updated afterwards. Both review passes, permanent regressions and parity changes
are included in the requested local commit; no push or remote CI is claimed.
The four unrelated untracked planning documents remain untouched. `CLAUDE.md`
still resolves to `AGENTS.md`, and both names give v4.11 in all four verify commands.

These fixes establish software behaviour. They do not prove real-person pose
accuracy, hidden-ankle Leg Raise inference, body/clothing tolerance across users,
microphone hardware, native TTS sound or physical-phone performance. The second
independent beginner session remains required. No new actual-model smoke is claimed.
