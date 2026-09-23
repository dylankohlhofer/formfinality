# Interface simplification — 23 September 2026

The request was to review every workflow and reduce clutter, including phone
layouts. This is a shell redesign, not an assessment or recognition change.
The engine extraction is byte-identical to the preceding committed build; root
vectors and Swift are unchanged. No new service, account, UI dependency or
automatic data collection was introduced.

## What changed

| Workflow | New hierarchy |
|---|---|
| Welcome | A short introduction, optional plank check or manual level. Name, persona and voice preview expand under “Make the coach yours”. |
| Level selection | Clear starting-point language, one selected level and Continue. The existing stable tier IDs are unchanged. |
| Workouts | Compact category/name/description/count cards; two columns on desktop, one on phones. Weekly goals and History are separate destinations. Level and coach setup remain editable. |
| Workout search | “Help me choose a workout” reveals the existing authored-plan search, constraints and honest time estimates. No generated routine or AI claim. |
| Preview | Start and Back appear before the full, expandable set/rest/camera-view list. Starting remains explicit and is the camera permission boundary. |
| Exercise | Pause, Skip, Ask coach and End stay directly reachable. Show me how and the unassessed fallback remain near the workout. Current/next movement and the large counter are retained. |
| Occasional tools | More groups spoken coaching, supported level changes, camera switching, guide outline, Help, CSV and diagnostics. Opening it never resizes the camera. Technical telemetry is default-hidden behind its own checkbox. |
| Coach help | Explanations and demonstration/repeat actions precede optional typed commands and microphone controls. Help/coach/history dialogs have sticky titled close controls. |
| Interruptions | Existing pause, background, camera cancellation/switch recovery and calibration restart/observed-result contracts retained. No implicit resume. |
| Diagnostics | Existing consent, capture, flags, export, clear and validated replay remain. Starting capture dismisses both disclosures; an active quick flag stays directly visible. |
| Debrief | Observed totals and highlights first, then next workout and named set results. Save status/failures remain visible; technical CSV expands separately. Eligible email sharing remains an explicit recipient-free draft. |
| Weekly goals | Choose a target before enabling saving. Nickname and the separate unassessed-completion choice expand on demand. Save/erase/storage rules are unchanged. |
| History/preferences | Existing separate opt-ins, bounded local history, coaching settings and scoped erase are retained. Detailed retention information expands separately. |
| Developer references | No new consumer entry point. Import, validation, save/export/retry and scoped reset remain developer tools. |

Near-black/off-white surfaces, iris primary actions, larger readable labels and
consistent spacing replace the dense uppercase instrument-panel style. Form
mint/amber/red semantics remain unchanged. No icon-only replacement hides an
important action. Native details preserve keyboard operation; Escape dismisses
More and restores focus, outside clicks close it, and screen navigation resets it.
Opening a menu never grants storage, diagnostic or microphone consent.

Calculated contrast for the new opaque text/action palette is 17.08:1 for main
text, 10.58:1 for secondary text, 6.99:1 for muted text, 6.98:1 for the primary
button and 6.38:1 for iris panel text. This is not a full accessibility audit or
a claim about contrast against every live camera background.

## Test adaptation and evidence

The existing test loop is reused. `testing/ui-navigation.mjs` opens closed
ancestor disclosures through actual summary clicks before tests operate a moved
control. It never forces clicks, changes hidden/disabled state or bypasses app
handlers. Existing outcome assertions remain; labels and paths intentionally
follow the new navigation. Two additional phone/desktop cases cover default
clutter, keyboard dismissal/focus, consent, goals/history, plan disclosure,
camera sizing, guide access, typed help and summary export.

Initial focused checks found a wrapped 320px header and a disclosure-helper bug
that opened the diagnostic drawer twice. Both were corrected and rerun. Focused
UI, diagnostics and Follow Along checks passed. Screenshots were inspected at
320×640, 390×844, 844×390 and 1280×800, including the optional panels.

The first full run (`test-results/2026-09-23T16-14-09-215Z-29814/`) passed all
actual engine, browser, shell and audio cases, but correctly failed its mutation
self-test: a forced timer position of 150px no longer overlapped the smaller
control shelf. The mutation now uses 100px and still requires both original
overlap assertions to fail; its focused rerun passed. No expected core result or
geometry acceptance threshold was relaxed. This earlier report is not the final
checkpoint: small coach-settings/safe-area refinements followed it.

Final full-suite results are recorded in `../project-status.md` after completion.
Earlier focused runs are iteration evidence, not the final build certification.

Final UI evidence is `test-results/shell-focused-QTE7Ec/`: **15 cases / 152 checks**,
all passed, with screenshots inspected. `node --test testing/interface.test.mjs`
passed **56 tests** on that final HTML, including the deliberate overlap check.
All four original harnesses were also rerun on the final working HTML: **4,127**
conformance checks, **8** mutations caught with a healthy control, **250** drawing
checks and **26** skip checks. No vectors were regenerated.

The last onboarding question/font polish and two extra technical-readout browser
assertions were made after the full-run snapshot. The focused checks above test
those final changes; the full report must not be presented as fresh AI-review
evidence for them. Other application behavior and test sources did not change.

## Still needs human/device review

Synthetic Chromium viewports are not iPhone Safari, Android, VoiceOver/TalkBack,
a physical keyboard opening over the camera, or proof a beginner finds this easy.
Check those on devices, including notches, rotation, browser chrome, large text,
permission sheets, menu dismissal and reaching Pause from a mat. Ask beginner
test 02 to choose a workout, understand a paused count, find the unassessed
fallback, and explain the summary without prompting. Audio intelligibility and
partial-body recognition limits remain separate, unresolved coverage gaps.
