# Local coaching interactions

This extends the existing HTML engine/thin shell, authored plans, recorded coach
audio and shared test runner. It does not replace pose estimation, add a server,
upload recordings or make a new medical/ability judgement.

## Available in the browser

**Ask coach** pauses the active workout and explains the latest observed counting
condition or recent rejected attempt. The cache stores one compact reading and
one recent event, without joints or diagnostic recording. It resets on evaluator,
set, movement, tier and assessed/unassessed changes. Missing optional form is not
a rep veto. A silent or unobserved event returns uncertainty, not an invented
reason. Explanation cards are approved content, not generated prose.

The dialog reuses the existing animated demonstration and recorded teaching.
Resume is explicit; closing help leaves the workout paused. Asking during a plank
check preserves its observations but requires restart or finishing the check,
never a fabricated continuous hold across the interruption.

**Typed and optional spoken controls** route to the existing Pause, Resume, Skip,
Finish and End handlers. Exact supported phrases are defined by
`parseCoachCommand` and shared in `testing/coach-command-vectors.json`.
Spoken commands require “coach” first. Stop means Pause. Only Pause can act on an
interim speech result; other actions need a final result. Skip, Finish and End
require a matching explicit confirmation within ten seconds, bound to the same
session/phase. Generic “yes”, negated phrases and compound commands do nothing.
Manual Finish never completes a camera-assessed set; it is for Follow along or
ending the calibration check with its actual observations.

Browser listening requires explicit opt-in per workout and an installed local
English pack. Both `SpeechRecognition.available({processLocally:true})` and a
real `processLocally` property must establish local support before capture.
No prefixed/cloud fallback, automatic model installation or microphone request
occurs on unsupported browsers. Recognition transcripts are not saved. Input is
aborted while coach audio plays and resumes only after 750 ms of quiet. Thus
spoken commands are unavailable during coach playback; touch Pause remains usable.
Navigation, backgrounding, finishing or disabling releases input and invalidates
late callbacks. Returning from background does not re-enable listening.
Availability/permission timeouts and bounded retries fail visibly. These are
software contracts, not a certification of recognition in a noisy room.

**Find a workout in your own words**, under the workout picker, accepts a bounded
English request: plan names, minutes, standing only, no floor, quiet and no
equipment. Every substantive clause must be understood; unsupported or medical
requests ask for clarification. All required constraints are checked against
authored movement metadata after tier resolution and set expansion. No exercises,
plans, targets or difficulty levels are invented. No match means no selection,
not a quietly relaxed constraint. The current catalog has no whole standing-only
or floor-free workout; those requests therefore correctly return no match.

Duration is explicitly a planning estimate: 3–6 seconds per rep, authored hold/
guided targets, scaled rests and 20–60 seconds setup per set. These assumptions
are not measured performance or a promised finish time. Hard deadlines require
clarification. A candidate only opens the existing preview; Start is separate.
Candidates with unsupported resolved movement/tier pairs are excluded, even
where a legacy plan declares that tier. This does not change the old picker.

**Your coach & history** has independent opt-ins for saved preferences and future
finished workout records. Standard coaching/on-request demos remain the defaults.
Less encouragement removes only optional praise and breathing reminders; counting,
rejected-attempt explanations, readiness and form cues remain. Preference changes
can apply for this visit without being saved. There is no camera-inferred fatigue
or automatic level change.

History stores at most 100 compact entries, with a 128 KiB feature-store cap.
Only allowlisted plan/tier/status/time and observed-work counts are saved—no name,
scores, video, joints, cue transcript, free-text reason or diagnostic trace.
Session UUIDs prevent duplicate finishes. Observed work before Skip/End is retained
once; unassessed elapsed time is not held time. Statuses keep skips, early ends and
Follow along identifiable. Same-plan/tier counts do not prove fitness improvement.
Saving stops visibly when full. Turning saving off retains existing records;
explicit export and confirmed Erase are available. Erase opts out and removes
only this feature's key, never demonstration recordings or diagnostics.

Storage is this browser profile's localStorage, not app-level encryption or backup.
Malformed data, quota failures and stale-window writes are reported rather than
silently overwriting records. LocalStorage is not a cross-tab transaction, and a
failed write cannot promise durable consent changes after reload. Workouts cannot
be resumed from this compact history after reloading.

## Optional native AI

`coach-choice/1` is the HTML-first boundary for explanation, plan and test-review
selection. It contains a request ID, purpose, bounded query, at most 24 approved
options and deterministic default IDs. Native `FormCoachInteraction` can use
`SystemLanguageModel.default` to choose one or two exact IDs. The model cannot
write coaching prose, create facts, relax plan constraints or execute controls.
The browser labels its own choices as templates/deterministic; it does not claim
to run this native model.

The native coordinator shows defaults immediately, waits only after an explicit
request, checks availability and bounds work to ten seconds. Cancellation and
request identity protect both delayed starts and late results. Extra output,
duplicate keys/IDs, unknown IDs or invalid context reject the whole selection.
No cloud provider, private-cloud fallback, feedback upload or transcript store
is part of this component. Native microphone permission must also be explicit,
with local recognition required; the mobile host owns its visible controls.

SessionCore, CalibrationCore and the native workout UI remain unported. Native
speech/AI modules are integration components, not evidence that the current HTML
app became an installed iPhone app. Deterministic Swift tests and explicit local
model smoke tests have different evidence value.

## AI-assisted testing

Finalized repository-synthetic runs produce an evidence package using the existing
audio and assertion analyzers. Private recording/landmark/external-scenario runs
are excluded. Optional local AI prioritises existing candidate IDs; it cannot
invent an expected result, automatically fix code, approve itself or resolve a
coverage gap. Every import rechecks source hashes. See
[the review workflow](../testing/ai-review.md) and run:

```sh
npm run test:review -- --run test-results/<exact-run>
```

Default tests, watch and CI prepare evidence but do not invoke a model or request
a microphone. Synthetic speech adapters are not real microphone recognition,
and AI review is not a replacement for beginner/body/clothing/device trials.

## Sources

[Browser local recognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally),
[installed-pack availability](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/available_static),
[Apple local recognition requirement](https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/requiresondevicerecognition),
[Apple Foundation Models](https://developer.apple.com/documentation/foundationmodels/systemlanguagemodel).
