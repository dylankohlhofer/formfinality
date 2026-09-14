# Form Coach — project context

Read this before changing anything. It encodes rules that were learned the hard way; several
were paid for with bugs that shipped.

## What this is

A camera-based form coach for **people who don't know how to exercise, at home**. Not
physio, not medical, not military. On-device pose estimation (MediaPipe), zero server, video
never leaves the device. One-time £4.99, no subscription.

**Founding principle:** *only correct what you can measure; teach what you cannot.*

## Repo layout

```
form-coach-v4.11.html     the entire browser app — engine + shell in one file
                          (v4.8 and v4.9 are kept as historical snapshots only)
verify.mjs                replays conformance vectors against the build
verify-mutations.mjs      breaks demo keyframes on purpose; asserts refGates catches it
verify-skip.mjs           the skip paths — a skipped phase is null, never zero
verify-draw.mjs           records what drawRef draws; asserts authored proportions
testing/                 shared scenario test/reproduce/report loop; see testing/README.md
conformance-vectors.json  1,896 recorded cases: the executable specification
content-v4.8.json         all movements/plans/tiers/dialogue as data
swift/                    the Swift port (FormCoachEngine SPM package)
voice/                    rendered coach audio, indexed by manifest.json
voice-render-kit/         ElevenLabs render tooling
docs/                     see docs/README.md
```

## Non-negotiable rules

**1 · The anti-divergence rule.** Never change behaviour in Swift first. Change the HTML →
regenerate vectors → make Swift pass. Two implementations drifting is the failure mode that
kills ports.

**2 · Fix the build, never the vectors.** A failing vector means the build changed. If the
change was intended, regenerate the vectors deliberately and say so.

**3 · Colour means the body.** Mint/amber/red are form feedback *only*. Iris (#9D8DF1) is
the user's choices and progress. Everything else is monochrome. If a new element wants
colour, it must name its lane.

**4 · Fail loudly.** Never `try?` or silently swallow in the session tick. A bug hid for
months behind `requestAnimationFrame` surviving its own exceptions.

**5 · Don't ask the user what the camera can see.** Framing, position and readiness are
measured, not requested. "Stand 2 metres back" was replaced by a bounding-box check for
exactly this reason.

**6 · Never say something you can't support.** If a joint isn't visible or the view angle
makes a reading unreliable, suppress the cue and log the suppression. `cat-cow` is `guided`
— it judges nothing — and that is the standard, not an exception.

**7 · A rep that doesn't count must be explained.** Too fast → "slower". Too shallow →
"deeper". Silence reads as a broken counter.

## Before you commit

```bash
node verify.mjs form-coach-v4.11.html   # must exit 0 — naming the build is required
```

If you touched `REF` or the `refGates` section, also run its mutation test — it is the only
thing that proves that suite still bites:

```bash
node verify-mutations.mjs form-coach-v4.11.html   # must exit 0
```

If you touched `drawRef`, `refFit` or the demo/ghost canvases, run the drawing check —
`refGates` reads the keyframe numbers and cannot see the picture:

```bash
node verify-draw.mjs form-coach-v4.11.html        # must exit 0
```

If you touched either core's `skip`, `endPhase`, `finish` or `finishCore`, run the skip
suite — the existing frame-only vectors do not reach a skip. The newer `testing/`
scenarios can represent interruptions explicitly as timed actions:

```bash
node verify-skip.mjs form-coach-v4.11.html        # must exit 0
```

For shell or test-infrastructure changes, also run `npm test`. This includes the four
original harnesses plus shared engine/browser scenarios and infrastructure self-tests.
Read `testing/README.md`: the browser suite protects the calibration `hasDemo` fix
(FC-LAB-001). Do not suppress exceptions to get green. Missing recordings
are a coverage gap, never a successful video test.
The default run also includes all 21 exercises / 44 supported tier pairs, 88 exercise
browser cases, all plan selections and dedicated shell checks. The guided off-screen
start (FC-LAB-003) is fixed; keep its framing invariant at every tier.
Voice changes also require `npm run test:audio` and `npm run test:audio:mutations`.
These are included in `npm test`: actual recorded-clip capture, wall-clock coaching
cases, and deliberate silence/overlap. Audio evidence text is intended wording,
not transcription; native TTS waveforms and physical speakers remain untested.
Repetitive/contextually questionable speech is saved for review, not automatically
approved by a passing check. Read the voice section of `testing/README.md`.
FC-LAB-004 is fixed in the browser playback layer. Keep its stale-audio checks:
Skip must cancel old current/pending speech before new teaching, and stopping a
clip must invalidate delayed callbacks as well as pausing the media element.
FC-LAB-006 is fixed: two default scenarios require one valid push-up to stay at one
after upright elbow bends or off-screen cycles. Never weaken these invariants.
`testing/coach-regressions.test.mjs` also protects interruption/recovery, setup
explanations and the shared 30-second readiness/reminder budget (FC-LAB-005).
It runs against the selected build in the default test/watch/CI loop.
Rep drivers measure cycle range/tempo, not static FORM; exclude them from frame
score/tint. No remaining quality measurement means null (bridge), not zero or 100.
Five new readiness/framing keys use TTS fallback until recorded clips are rendered;
do not reuse old head/feet clips for the new edge-based wording.
Speech fallback and preview now require an explicitly local English voice at each
utterance. Never invoke an unspecified/remote default voice; unavailable speech must
release the queue and explain the limitation visually. Keep the privacy shell cases.
Current coaching facts cancel obsolete form/readiness/praise speech; cooldown is
not evidence that a fault disappeared. Completed topic instructions have a 20-second
continuing-condition budget; resolved/recurrent conditions and failed playback are
handled separately. Do not suppress rep-event explanations or counting controls.
Private diagnostics are opt-in, memory-only, bounded to 4 MiB / 4,000 entries, with
explicit export, pause/resume and erase. Joint/text exports are personal data, not
anonymous; never upload them automatically. Replay displays saved observations,
not re-inference or a new form judgement. Preserve import validation and consent tests.
The byte cap is the serialized export budget, not a measured JavaScript heap limit.
Schema 2 protects the session event/summary timeline and up to eight flagged windows
(available ±10s at up to 5Hz) while unprotected recent frames roll off. Protected-space
exhaustion pauses capture visibly; never replace a saved flag silently. Schema 1 imports
remain readable without claiming their old rolling flags were protected. Drawer opening
must not resize the camera; starting capture closes it and leaves a quick flag control.
`testing/setup-prompt.test.mjs` protects optional easier-movement help: 5s setup grace,
then 6s continuous observed difficulty, known view and visible passing position gates.
Recovery/observation loss withdraws the offer immediately; arming resets difficulty,
not the once-per-movement offer budget. This timing is an explicit UX policy, not a
validated measure of ability. Keep it visual until the user accepts the alternative.
`testing/worker-*` is an isolated prototype, not the live camera path. Its queue
invariants run in the default suite; `npm run test:worker` runs the local CPU
benchmark. Benchmark evidence from blank frames is not exercise/device validation.
The subsequent user recording exposed further failures: `testing/reported-session.test.mjs`
is in the default loop. Prompt recovery, mobile recorder access and the neck-only
partial-view Crunch case are fixed; all five original expectations are retained.
`docs/movement-evidence-contract.md` separates required position/driver/hold evidence
from optional form. Missing optional form must not veto observed reps, create a
score/cue/tint, or remain in smoothing after its source disappears. Required missing
gates cannot silently disappear; only the declared `optionalObservation:true` foot
hint currently permits missing position evidence. A side-source change breaks the
unfinished rep, never completed reps. Reset `targetSources`, `driverSource` and
`scorePool` in `arm()`; loss/recovery must not retain hidden form contributions.
`testing/movement-evidence.test.mjs` and `testing/evidence-parity.test.mjs` run in the
default loop. Swift reads the same `testing/movement-evidence-vectors.json` cases.
The new `crunch-partial-quality` scenario exercises actual browser effects too.
The four `partial-*` scenarios and `testing/partial-visibility.test.mjs` reuse that
same runner: `npm run test:partial` selects the pack without a parallel harness.
Keep its positive cycles, stationary/misleading-motion negatives, hidden-peak
interruption, no-false-credit and recovery checks. Pack tests cover nine supported
tier pairs; browser timelines use Building tier. `coverageGaps` must survive in
reports even when safety checks pass: refusing ankle-hidden work is not a solved
Leg Raise/Plank recognition feature. See `testing/partial-visibility.md`.
Only three historical checkpoint fields were deliberately refreshed (plus provenance)
in `crunch-needs-the-ear`; its straight-legged input still cannot arm or earn reps.
Leg-raise ankle loss and missing required Plank geometry remain unresolved recognition
limits, not permission to invent motion or silently substitute another driver.
See `docs/sessions/current-recording-review-2026-09-07.md` for exact evidence and
the distinction between observed movement, missing form measurements and hidden motion.
Historical screen recordings have now been reviewed, but are not
clean camera inputs or recovered-landmark replay coverage; see the dated review
in `docs/sessions/` and `testing/findings/active-rep-position-loss.md`.
Body/clothing tolerance now selects one complete required-observation camera side
and retains it through confidence flicker. Never select on the higher form score
or stitch incomplete sides; actual driver changes still break unfinished reps.
`evidence.camera` and tint identify the selected side. Reset `cameraSide` in `arm()`.
The low-score automatic target-shortening rule is removed: score is not fatigue.
`SessionCore.followAlong()` is a user-chosen, current-set escape hatch, not relaxed
judging: elapsed time is not held time, Finish this set is manual, score is null,
and no unobserved reps/form/ability claims enter totals or debrief. Previously watched
frames count once. The next movement returns to camera assessment; calibration has
no follow-along verdict. Keep the 235 body-tolerance checks, 27 shared evidence rows,
two new action timelines, four follow-along shell cases and its real-clip audio
cancellation case in the default loop.
These test software policy, not body-size/clothing recognition accuracy; the model
and movement thresholds remain unchanged. See the 14 September session note.

The interface now previews workouts before camera startup. `SessionCore.pause()`,
`resume()` and `stop()` preserve observed work without credit during interruption;
paused unfinished reps cannot finish on return. End yields a partial summary, with
the current phase `stopped:true, score:null` and no records for future sets. Do not
accumulate score again at End. `CalibrationCore.pause()` has no Resume: restart or
finish the observed check. Background return and camera switching require explicit
resume; optional wake lock must not block startup. Cancelled/late camera requests
must release tracks, never reopen a finished screen. Keep `interface.test.mjs`,
the `ui-*` shell cases and `pause-cancels-correction` audio case in default test/CI.
SessionCore/CalibrationCore are not yet in Swift; port their interruption contracts
together. See `docs/sessions/interface-review-2026-09-14.md` for the feature inventory
and physical-device/accessibility checks still needed.

Then the permanent static audits — each exists because a bug got past the previous set:

- every runtime-toggled CSS class is styled
- every `var(--x)` is defined
- every `$()` / `getElementById` resolves to real markup
- no calls to deleted functions; no duplicate function definitions
- every `aria-pressed` toggler has a selected-state rule
- `[hidden]` beats author `display` (a global `!important` rule — do not remove)
- every emitted effect has a handler, and no handler is dead

## Architecture, briefly

Pure engine, thin shell. The engine emits **effects** (`{t:"say"…}`, `{t:"bigTime"…}`) and
`applyFx` replays them onto the DOM. Keep judgement in the engine; keep the shell too thin
to hide a bug. The Swift port takes the engine; the shell is platform-specific.

**Content is data.** Adding a movement means adding a declaration, never logic. Metric specs
name their joints, which is why the form tint and framing scope are *derived* rather than
authored.

**Tier ids (`learning`/`building`/`strong`) are frozen** — they name clip folders, vector
rows, CSV columns and dialogue keys. Labels are editable brand; ids are plumbing.

## Traps that have already bitten

- A per-frame cue on a **rep driver** fires at the bottom of every *correct* rep. Judge reps
  over the cycle, not the frame.
- `arm()` discards setup state. **Any field added later must be added to it.**
- An **empty collection** must mean "no requirement", not "no filter".
- Author `display` silently defeats the `hidden` attribute.
- Demo (`REF`) data is a **single-sided** skeleton; mirroring it can't represent asymmetric
  movements.
- Demos are drawings the engine never evaluates, **but they must still pass the movement's own
  gates** — a demo teaching a pose the app would refuse is the crunch/glute-bridge bug
  (#40, #41). `verify.mjs`'s `refGates` section enforces this through `Evaluator.read` at
  learning tier; its exception table is asserted both ways, so an exception that stops being
  needed fails as an exception to delete. `gen-refs.mjs` is gone; frames are hand-authored.
- A diagnosis that explains the symptom is not therefore the cause (#42). "Asymmetric movements
  can't be drawn single-sided" explained the failing demos perfectly and was wrong — the gate
  reading 4° was a *knee* gate, and asymmetry cannot fold a knee. It also steered a week of
  attention away from the symmetric movement that mattered most.
- **References are isotropic; camera landmarks are not** (#43). `REF` is authored with x and y
  in the same units — a femur is the same number whichever way it points. MediaPipe normalises
  x by width and y by height *separately*, which is the distortion `readMetric`'s `A` undoes.
  Drawing a reference with `x*W, y*H` therefore stretched every demo by the canvas aspect
  (1.41x in the demo box, 1.78x in the ghost) and no gate could see it, because `refGates`
  reads the keyframe numbers and never the picture. Anything crossing that boundary converts
  at the boundary — `camToIso` on the way in, `refFit` on the way out — and `verify-draw.mjs`
  is what holds the line.

## Current state

17 suites of coverage were lost to an ephemeral sandbox; `verify.mjs` reconstructs 4,127
checks from the surviving vectors and exits 0. `swift test` passes 25/25, including the
same root conformance JSON and 27 additional shared movement-evidence cases. `REF` is covered by the `refGates` section — a keyframe edit that breaks a gate now
fails by name — and `verify-draw.mjs` (250 checks) covers `drawRef`, the first coverage the
drawing has ever had. `verify-skip.mjs` (26 checks) covers both cores' `skip` with derived
invariants. `testing/` adds action-timeline engine/browser coverage, a 21-exercise
coverage board, camera-handler tests with fake streams and simulated voice-queue tests.
Reports save screenshots, traces, actual/expected results and explicit coverage gaps.
It discovered calibration defects, guided off-screen arming and active-state false
reps; their regression checks are retained after the fixes.
Dedicated real-time voice cases now capture and measure actual recorded-clip output.
Historical human screen recordings have been sampled and reviewed locally; clean-camera
exercise replay, native-TTS waveforms and automated physical-device coverage remain absent.
A manual smoke pass is still needed, and
between them `refGates` and `verify-draw` prove a demo passes its gates and is drawn in the
proportions it was authored in, but not that it *reads* as the movement.

**The next milestone is not code.** It's two beginner test sessions
(`docs/beginner-test-protocol.md`). See `docs/project-status.md`.

## Documentation

`docs/` is an Obsidian vault — 18 Markdown documents plus a README index and the narrated HTML, wikilinked. Read
`docs/README.md` for the index and `docs/project-status.md` for current state (its figures are
recomputed, not remembered; it wins over any other doc).
Session notes from user testing go in `docs/sessions/`.
