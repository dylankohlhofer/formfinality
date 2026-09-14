# Local coaching interactions — 14 September 2026

## Delivered scope

The requested five additions use the existing engine, browser shell and test loop:

1. Exact typed and optional local spoken controls, with immediate Pause and
   explicit, expiring Skip/Finish/End confirmation. No language model routes an
   action. Spoken commands require “coach”.
2. Ask coach pauses and explains recent observed counting conditions. Show me
   reuses the existing animation; Repeat teaching uses the recorded coach. Missing
   or stale evidence is uncertainty, not an invented reason for an uncounted rep.
3. Bounded plain-English selection of existing authored workouts. All hard
   constraints survive tier resolution; unsupported requests ask for clarification.
   No compatible workout means no selection. Start remains separate from preview.
4. Independent opt-ins for local coaching preferences and future finished-workout
   history, with explicit export and scoped erase. History stores bounded counts
   and statuses, not scores, video, joints, inferred improvement or raw dialogue.
5. Optional AI prioritisation of existing test findings. The default runner emits
   synthetic evidence; an explicitly requested local model chooses approved IDs.
   Fresh evidence hashes, hard limits and human review remain authoritative.

The browser is deterministic. Native `FormCoachInteraction` adds local speech
transport/command routing and bounded Foundation Models selection for explanation,
plan and review options. The `formcoach-review` executable is used by the same
repository's review workflow. Native SessionCore, CalibrationCore and workout UI
are still unported; these components do not constitute a shipped iPhone app.

See [the product contract](../local-coach-contract.md),
[native integration](../../swift/FormCoachEngine/INTERACTION.md) and
[review evidence contract](../../testing/ai-review.md).

## Defects caught while integrating

- Rapid pause→resume originally left a recognition callback valid before the
  listener's poll. Synchronous control-context invalidation now includes paused
  state, with a shell regression replaying the abandoned callback.
- The header's Mic off was inert inside a modal. The in-dialog listening button
  now also turns the microphone off; its real click is tested.
- Editing a workout request left stale candidate details visible. Editing now
  clears results; selection also rechecks the current request and tier.
- History now identifies guided time separately from observed holds and labels
  follow-along/guided work as unassessed. Storage errors block export visibly.
- Calibration explanations now offer restart/finish-check, never the session-only
  Follow along control. Unknown hold explanations describe holds rather than reps.
- The previous summary mutation targeted the first matching fallback statement,
  which the new choice selector also contains. The mutation is now anchored to
  `selectSummaryCards`; its expected rejection and unchanged vector remain.
- The new exporter initially assumed every saved effects timeline was an array.
  Existing browser results also use `{sampling,total,events}`. Both declared forms
  are now validated, including omission counts; unknown forms are rejected.
- Review timeout, stale-current-output and concurrent-attempt handling were
  hardened. Model failure cannot leave an earlier selection labelled current.
- A full-run audio check exposed an early action timestamp: Playwright waited
  approximately 381 ms before dispatching Resume, then the clip ended about 2 ms
  after the handler began. The automatic reproduction passed. The action marker
  now records actual DOM click dispatch before the app handler; the unchanged
  250 ms cancellation bound excludes automation scroll/actionability delay.
  Two unit checks protect this boundary and unknown-action rejection.

The first completed full run is retained at
`test-results/2026-09-14T14-28-56-509Z-45607/`. Its application cases passed, but
the misplaced summary mutation and new exporter's shape error made the run fail.
It was not rewritten or relabelled as passing. Explicit export after the repair
retained 308 cases and 27 candidates, including that original failed test.

An earlier incomplete-build run at `2026-09-14T14-17-57-850Z-42038` captured a
missing `closeCoachPanel` during integration and was stopped rather than left
timing out repeatedly; its evidence remains. The run at
`2026-09-14T15-05-32-403Z-51494` was stopped to include the final hold/calibration
copy checks. Neither interrupted run is claimed as a verification pass.
The completed run at `2026-09-14T15-09-22-722Z-52313` is retained with its original
audio timing failure, not rewritten as a pass; all other cases passed there.

## Verification

Final `npm test` exits 0 at `test-results/2026-09-14T15-22-34-852Z-54396/`:
67 infrastructure tests, 1,202 targeted checks in 16 suites, all four original
harnesses, 55 engine cases / 1,307 assertions, 110 browser / 942, 96 shell / 935,
and 16 actual-audio / 338. All 26 existing coverage gaps remain visible. Its HTML
and all recorded JS test-source hashes match the final files; documentation alone
was updated afterwards. Tested HTML SHA-256:
`2c36d8972395c71829a8c2e540b5b7b072d32c900f79440b6df5b448c1efdfcc`.
The working-tree checkpoint is based on `519dbae`.

- Focused final interaction shell: eight cases pass at
  `test-results/shell-focused-T0tXmq/`, including the callback race, modal Off and
  calibration-specific help.
- Actual Ask → Repeat → Resume audio passes at
  `test-results/2026-09-14T15-20-17-731Z-54078/` and in the final full run:
  measured old-correction cancellation,
  recorded teaching while paused, no held-time credit, cancellation on Resume and
  fresh observed holds afterwards. No microphone or physical speakers are tested.
- Swift: 104 deterministic tests pass, including 57 new interaction tests;
  three opt-in model smokes are skipped in the default 107-test run. Shared data:
  22 choice vectors, 39 command vectors, plus the existing conformance, movement
  evidence and 22 summary-selection cases. No root vectors changed.
- Explicit actual-model choice smokes both pass on this Mac: explanation selected
  `demo` in 7.316 seconds; synthetic plan selected `preset-b` in 0.724 seconds.
  Both are real on-device selections, not stub or fallback passes. Templates are
  immediate; each selection has a ten-second maximum.
- Real-inference blank-video wiring smoke passes 14/14 at
  `test-results/2026-09-14T15-32-39-212Z-56068/` against the final build. It is not
  exercise accuracy evidence.
- Explicit native review of the final full report passes at its
  `ai-review-g1NNFD/`: all four batches and final selection used the actual local
  model. One existing uncaptured native-TTS waveform gap was selected; all 25
  other candidates remain. Import revalidated the sources, and the report was
  not changed. `accuracyVerdict` remains `not-assessed`; this does not validate
  ranking quality or resolve any finding. An earlier run at
  `2026-09-14T15-09-22-722Z-52313/ai-review-Uh04lu/` also passed transport/import,
  preserving that report's failed-test status.

## Remaining release checks

No local speech pack was installed and no real microphone was requested during
verification. Signed-phone permissions, accents, room noise, coach speaker echo,
audio routes, battery/thermal cost and background interruptions need device work.
Speech is deliberately unavailable during coach playback; visible Pause remains.

Native AI is optional and device/model-availability dependent. A successful ID
selection does not establish semantic quality, ranking correctness or phone
latency. AI never generates form facts, relaxes movement evidence, edits test
expectations or approves itself. All existing partial-view Leg Raise/Plank limits
and beginner/body/clothing validation gaps remain open.

Next: physically check the new control flow, then run beginner test 02 using the
existing protocol and explicitly consented diagnostics if helpful. No new backend,
subscription, cloud API dependency or continuous uploading is introduced.
