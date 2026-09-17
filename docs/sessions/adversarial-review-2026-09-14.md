# Adversarial review — 14 September 2026

This first section records the original testing-only checkpoint. The user later
authorized repairs with “fix them now please”; see the follow-up below. Historical
failures and hashes describe the reviewed build, not the repaired working build.

Request: additional reviews and testing to find bugs. After seeing the findings,
the user explicitly chose **review and tests only**. No application, Swift,
root-vector, audio-asset or dependency changes were made. No commit, push,
physical camera/microphone access, private-data upload or model invocation.

Reviewed build: `e639a9b`, `form-coach-v4.11.html`, SHA-256
`21a6f523e98d178c16c0a715580a743446a19b76ab691ba2e93da8aac4d1cc67`.
Line references below refer to that unchanged HTML.

## New coverage

The existing scenario runner remains the entry point. No external fuzzing service,
new dependency or parallel harness was added. `testing/adversarial.test.mjs`
adds **198 tests**:

- **132 seeded control histories**: three seeds at 15/30/60fps for all 44 supported
  exercise/tier pairs, each with 128 control/batched-input choices after initial
  observations. Paused/finished calls cannot credit work; earlier records cannot
  change; skipped/unassessed scores stay null; totals reconcile; finish occurs once.
  Failures print the seed and action history.
- **44 uneven-cadence cases**: changing 15–60fps observations of independent
  four-second cycles. Three cycles remain three reps; holds retain the observed
  interval. These do not reconstruct the four lost historical frame-rate vectors.
- **20 diagnostic histories**, 200 operations each: pause/resume, flags, text,
  clear/restart and serialization round trips with bounded exports.
- **Two accelerated long-session checks**: 45 minutes unassessed plus a 12-minute
  pause, and 45 minutes diagnostic retention with all eight flags. These test
  simulated-time state/retention, not heap use, battery, thermals or device speed.

`testing/adversarial-cases.mjs` adds **eight browser cases** to the existing shell
sweep, including healthy-import and stale-success controls. Real DOM handlers and
local canvas MediaStream tracks run with controlled asynchronous playback,
animation scheduling, wake-lock and file-read completion. No physical lens is used.

```sh
node --test testing/adversarial.test.mjs
node testing/check-shell.mjs form-coach-v4.11.html 'adversarial-*'
```

These also run in `npm test`, watch and the existing CI runner. Reproduced defects
remain failing assertions, not skips or accepted exceptions. Do not remove them
to recover green; application fixes have not been authorized in this turn.

## Confirmed findings, prioritized

### 1. P1 — End can leave the original camera stream live

Case: `adversarial-pending-camera-end`.

Start, switch cameras, hold the replacement video's `play()` promise pending,
then End. The debrief opens and the replacement track ends, but the original
track is still live: **`[live, ended]`**, not `[ended, ended]`. Only settling the
pending playback ends the old track. If it never settles, the stream can remain
retained despite the ended-workout screen.

Cause: the flip handler holds `original` locally (line 5624), then replaces the
video stream (5636). `stopCam` stops only the attached stream (5617). Cleanup of
the old stream is after the pending await (5637–5639), not owned by End.

Future fix: own all acquired/pending streams explicitly and release them on End,
with idempotent late completion. Preserve successful switch/recovery behavior.
The resource leak is reproduced; hardware camera-indicator behavior is not tested.

### 2. P2 — Old animation callbacks can revive after restart

Case: `adversarial-animation-restart`.

Delay an old animation callback across End and a new workout, then deliver it.
Live animation chains become **2, 3, then 4** across three restarts, instead of
one. When all workouts stop, the callbacks stop normally.

Cause: startup schedules another loop (5607); `loop` checks only shared `running`
before rescheduling (5982–5984). A new workout makes that flag true, allowing an
old callback to join it. There is no loop-instance identity or request ownership.

Future fix: bind each chain to a camera/session generation and cancel its owned
callback. This proves duplicate scheduling under delayed callbacks, not extra
reps, doubled inference or measured battery drain. Video-time deduplication remains.

### 3. P2 — Overlapping wake-lock requests orphan a granted lock

Case: `adversarial-wakelock-overlap`.

Keep the startup wake-lock request pending, Pause/Resume, then grant the requests.
Both can return live locks, but End releases only the last. Startup/Resume remain
usable; the failure is resource cleanup rather than an application hang.

Cause: lines 5565–5569 guard an already granted lock, not an in-flight request.
Each completion overwrites `wakeLock`; teardown at 5618 only knows the last one.

Future fix: coalesce requests and release stale grants using request/session
identity. Keep the feature optional and non-blocking. Physical screen-on duration
and battery impact are not measured by this substituted-API test.

### 4. P2 — Malformed diagnostic fields pass validation, then crash replay

Cases: `adversarial-diagnostic-shape-string` and `-object`.

Import a legacy-format diagnostic with a valid first event and a later frame
whose `blocked` is a string or an object with `length:1`. Both files open as valid.
Seeking to that frame emits **`d.blocked.join is not a function`**. The healthy
array-shaped import control passes, including markup-like text staying text.

Cause: timeline validation checks frame/joint structure but not the blocker-list
shape (4186–4195); replay assumes an array (4316). The valid first event delays
the exception until seeking, outside the import error handler.

Future fix: validate the types consumed by replay before opening a file while
retaining valid legacy compatibility. Do not swallow seeking exceptions or weaken
the no-uncaught-errors assertion.

### 5. P2 — A stale import failure hides a newer successful review

Case: `adversarial-diagnostic-stale-reject`.

Start a delayed file read, Clear, import a newer valid file, then reject the old
read. The newer viewer is hidden and its success message becomes the old error.
Its disk file is not erased. The equivalent delayed **successful** old read is
correctly ignored, and that control passes.

Cause: success checks `diagnosticEpoch` (6129), but catch unconditionally clears
the active review and hides its viewer (6132).

Future fix: apply request identity to success, failure and input cleanup. Preserve
Clear/consent revocation and new-import usability.

## Reproduction evidence

Two independent final focused runs reproduce the same six failures/two passes:

- `test-results/shell-focused-PJBoHP/`
- `test-results/shell-focused-H4IoLU/`

Each case retains result JSON, screenshot, console output and Playwright trace.
The camera case also saves `ended-before-play-settles.png`. Its track-state checks,
not the debrief screenshot alone, establish the still-live resource.

The earlier `shell-focused-i4SrpI/` run is retained but includes new-test assumptions
corrected before the final reproductions: await camera startup before counting
callbacks; read collapsed technical details via `textContent`, not `innerText`.
Initial seeded engine assertions also needed to respect the deliberate reset of
setup hold samples at arming. None of these were application defects or production
changes; no golden vector was refreshed to make a test pass.

## Further high-value coverage

After the five defects have approved fixes, priorities within the existing stack:

1. Cross-browser execution of the same contracts. Only Chromium is installed;
   WebKit and Firefox were checked and are absent. No downloads or pretend passes.
   WebKit testing still would not replace physical iOS tests.
2. Physical iPhone/Android interruptions: background/return, screen locking,
   permission revocation, camera switching, audio route changes and local microphone
   availability. Record actual device/OS and capability limitations.
3. Keyboard/screen-reader and phone text-size checks, especially nested dialogs,
   focus return, error recovery and controls with the software keyboard open.
4. Slow/offline/cold-start and storage-quota fault injection in the same runner.
   Separate first asset download from on-device processing; the latter does not
   establish offline first-launch support.
5. Consented clean-camera recordings with independently labelled reps/holds and
   partial visibility across bodies/clothing, using existing video replay. These
   synthetic tests cannot certify hidden-ankle recognition or replace beginner test 02.

## Final full-run verification

`npm test` exits **1**, correctly retaining the new defects, at
`test-results/2026-09-15T02-00-08-396Z-74284/` (14 September local time).

- **77 infrastructure tests** pass.
- **1,478 targeted tests across 18 suites** pass, including all 198 new tests.
- All four original harnesses pass: **4,127 conformance**, **eight caught mutations
  plus healthy control**, **250 drawing**, **26 skip**. Four historical frame-rate
  vectors remain explicitly unreplayable; their generator is still absent.
- **55 engine cases / 1,307 assertions**, **110 browser / 942** and **16
  recorded-clip audio / 338** pass.
- The shell has **108 passing cases and six failing cases**, with **1,014 passing
  assertions and 13 failed assertions**. All six failures automatically reproduce
  in fresh browser contexts with the same failed checks and actual values.
- Total: **329 rows = 311 passing + six failing + 12 blocked video rows**.
  All existing cases retain their previous statuses; failures are confined to the
  new adversarial cases. No additional speech-review candidates appeared.
- The evidence package has **39 candidates: 26 existing coverage gaps and 13
  assertion failures**. Those 13 failures describe five bugs, not 13 distinct bugs.
  No AI reviewer was invoked or allowed to close any finding.

The saved build, nine recorded build/fixture/lockfile/bridge hashes and all 58
JavaScript test-source hashes match the final files. Documentation was updated
after the run. The app, root vectors, Swift, voice assets and dependency files
have no diff from `e639a9b`. No new physical-device, real-model or blank-video smoke
is claimed by this pass.

Tests and notes remain **uncommitted local changes**, as stated to the user.
The four pre-existing untracked planning documents remain untouched. A later
authorized fix/commit should preserve these regression cases and failed evidence.

## Authorized repair follow-up — 14 September 2026

The user subsequently requested fixes to all five findings. Production changes are
confined to the browser shell and diagnostic import validation:

1. A shell-owned stream set tracks both original and replacement cameras during
   playback. End stops all owned tracks immediately, before pending playback
   resolves or rejects. Cleanup is idempotent; late callbacks cannot touch a newer
   workout's stream or restore the old camera.
2. Animation requests carry their camera generation. End cancels the owned request;
   an already-delivered callback from an obsolete workout cannot reschedule or tick.
3. In-flight wake-lock requests are coalesced. Each grant belongs to its original
   camera generation and request; End invalidates pending ownership. Stale grants
   release themselves without overwriting a newer lock. Optional request/release
   failures cannot prevent workout controls or camera cleanup.
4. Import validation now checks frame/summary blocker lists before replay opens:
   lists contain strings, while absent/null fields remain compatible with legacy
   exports. No seeking exception was hidden to obtain a pass.
5. Each selected import has its own request identity, in addition to Clear's epoch.
   Success, failure and input cleanup all check it, including when a newer import
   starts without Clear and while that newer file is still loading.

No judgement, counting, scoring, thresholds, model, voice assets, dependencies,
root vectors or Swift behavior changed. The extracted engine is byte-identical to
`e639a9b`; SessionCore/CalibrationCore and browser platform lifecycle handling are
not yet part of the native port. No port change is required for these shell fixes.

All eight original shell cases passed immediately after the repair at
`test-results/shell-focused-UADA9c/`. The expanded **18 cases / 89 checks** pass at
`test-results/shell-focused-R56pW2/`, retaining the original expectations and adding
late playback success/failure after restart, both wake-lock grant orders, optional
failure/retry, newer imports without Clear and input-selection ownership during
overlapping reads. **221 targeted tests** pass (198 adversarial plus 23 diagnostic,
including six new schema/field-shape tests).

The identical expanded browser suite was also run against the archived pre-fix
build (`test-results/2026-09-15T02-00-08-396Z-74284/build.html`): **14 cases fail and
four healthy controls pass**, at `test-results/shell-focused-GqIji2/`. This deliberate
negative control confirms the new guards have observable regression coverage;
it is not a failure of the repaired build or permission to change expectations.

`npm run test:video` also passes **14/14 checks** at
`test-results/2026-09-15T02-18-02-794Z-76218/`. It uses a synthetic blank video and
real local pose inference; it is not exercise/body-recognition or physical-device
validation. No human recording or microphone was accessed.

Full `npm test` now exits **0** at
`test-results/2026-09-15T02-18-47-243Z-76360/`:

- **77 infrastructure tests** and **1,484 targeted tests in 18 suites** pass.
- All four original harnesses pass unchanged: **4,127 conformance**, **eight caught
  mutations plus healthy control**, **250 drawing**, **26 skip**. Four historical
  frame-rate vectors remain explicitly unreplayable.
- **55 engine cases / 1,307 assertions**, **110 browser / 942**, **124 shell /
  1,081**, and **16 recorded-clip audio / 338** pass.
- **339 rows: 327 passing, zero failing, 12 blocked real-video rows**. The six
  original adversarial failures now pass; all other previous rows retain their
  statuses. No additional speech concerns appeared.
- The **26 review candidates are existing coverage gaps**. No AI reviewer was
  invoked, no private recording was imported, and no recognition/device gap was
  relabelled solved.

Repaired HTML SHA-256:
`0b6e49759815f582c3f0196e6613c0aa2b4dae7a7b87e360a416e55b2fdb70ab`.
The archived build, nine build/fixture/lockfile/bridge hashes and all 58 JavaScript
test-source hashes match the final files. `git diff --check` passes. Swift was not
rerun for these shell-only fixes; its last deterministic result remains the prior
review's checkpoint, not new native-camera evidence.
Repairs, tests and notes remain local/uncommitted; no commit or push was requested.
