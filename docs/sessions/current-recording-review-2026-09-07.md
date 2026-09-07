# Current-build user recording — 7 September 2026

## Outcome

The user reported easier-plank prompt intrusion, diagnostic setup obstruction,
plank timing stalls, failed speech, missed leg raises under partial visibility and
side-plank timer jumps. These are not dismissed by the prior synthetic green run.
Three independent new cases now fail in the default loop; two controls pass.
This review diagnoses and retains failures; it does not implement their fixes.

**Subsequent implementation:** [recorder/prompt follow-up](recorder-prompt-fixes-2026-09-07.md)
fixes FC-LAB-007 and the recorder usability/retention issues in FC-LAB-008. The original
five-case suite is now four pass / one fail; partial-view Crunch remains open. The
evidence and baseline counts below describe the recording review, not that later build.

The engineering priority should shift from worker performance to **tolerant movement
recognition, restrained feedback and usable mobile testing**. Preserve on-device
processing and distinguish evidence sufficient to count movement from evidence
sufficient to judge a particular aspect of form.

## Evidence and limits

Source: `Screen Recording 2026-09-07 at 21.05.50.mov` (751.085 seconds,
2940×1912, one audio track) and `formcoach-private-diagnostic.json`, supplied locally.
The source video and JSON were not modified or uploaded. Extracted personal evidence
is ignored under `test-results/current-recording-review-2026-09-07/`.

78 timestamped frames were extracted, including quarter-second samples around both
side-plank six-second transitions. Overview sheets and selected full-size frames
were inspected; local OCR helped read the telemetry. This is sampled visual review
plus event-log analysis, **not complete listening, anatomical ground truth, or a
clean-camera re-inference test**. The screen contains overlays and is not substituted
for original camera inputs. No exact rep total is claimed from sparse images.

Diagnostic module hash matches the reviewed source at `8150d63` exactly:
`ca51cfebcb36953fa6d7d04d5692792926de399f8a3a785a3d2828e5836acd25`.
Whole HTML hash: `c1b75ca9c116802c6eb09d0616c14172e850e875c9e790809f73cafade82571d`.

**Recorder coverage loss:** the 4,178,143-byte export discarded 17,124 entries.
It retains diagnostic time 545.4045–618.3996s: 1,663 frames, all Side Plank,
50 effects, 91 speech events and one flag. The actual retained exercise frames
end at 600.8305s. Earlier Plank, Crunch and Leg Raise landmarks are absent.
Recording-relative timestamps below must not be confused with diagnostic time.

## FC-LAB-007 — easier-plank prompt does not withdraw

The reported pre-recording occurrence is not recoverable from this export.
The code nevertheless reproduces the failure class: a Learning-tier, position-valid
but quality-blocked setup offers Knee Plank after approximately 6.03 seconds.
This timer can run during setup; it is not evidence that the user does not know
the movement. Once good input arrives and the set arms, no `regressHide` effect is
emitted, leaving an obsolete choice for the user to dismiss.

The reproduction controls the body-line reading to isolate quality difficulty;
it is not a reconstructed camera stream. The permanent expectation requires the
offer to appear, the set to recover/arm, and the stale offer to disappear. The
last assertion currently fails.

Proposed change: do not infer ability from getting-into-position time. Offer help
only after sustained relevant difficulty, avoid blocking the body view, and withdraw
the suggestion automatically on recovery/arming. Do not infer “doesn't know plank.”

## FC-LAB-008 — diagnostics interfere with the interface and lose flagged evidence

At 1280×800, opening diagnostics reduces the welcome stage to approximately 359px
high; controls initially lie outside that stage's visible area. Automated scrolling
can reach Start Calibration, so this is **not a reproduced permanent desktop lock**.
It does explain the newly awkward nested scrolling. At 390×844 the diagnostic
summary is covered by the fixed header: a normal click fails because the voice
checkbox intercepts it. The permanent mobile test reproduces that failure without
forced clicks or direct DOM event dispatch.

The rolling limit also discarded earlier user flags along with frames. A “Flag this
moment” button that does not preserve that moment until export is inadequate for
this workflow, despite the original rolloff disclosure.

Proposed change: a mobile-safe diagnostics surface that does not shrink the workout,
usable before starting; separate bounded session/event summaries and pinned flag
windows from the rolling frame buffer. Show retained duration/loss live. Keep opt-in,
explicit erase/export and no automatic upload; do not silently add persistence.

## FC-LAB-009 — visibility is too coarse a veto

**Plank:** at 01:55, 02:00 and 02:05 the clock reads 00:05; the latter two frames
show FORM 100 with all displayed measurement scores at 100. The feet extend beyond
the camera picture. The clock eventually resumes. This is a real contradiction
between reassuring form output and unexplained stopped time.

Source inspection shows that `framing()` can set `inPose=false`, stopping hold time,
while form scoring still runs. The active hold path does not use the rep-paused
explanation branch. A synthetic clipped-head hold independently reproduces stopped
time with a non-null score. Framing is the strong explanation for the filmed pause;
the exact missing original joint stream prevents frame-exact causal attribution.

**Leg Raise:** the recording shows 6/10 at 06:52, 7/10 at 07:05 and continued
movement while still at 7/10 through 08:35. At 07:50 and 08:20 it explicitly reports
top-edge clipping, and at 08:05 bottom-edge clipping. After repositioning it reads
8/10 at 08:40. This confirms clipping-related refusals, not an exact accounting of
each lost rep. In the earlier 6→7 interval, threshold/confidence causes cannot be
isolated without the discarded landmarks.

Current leg-raise counting uses shoulder–hip–**ankle** angle, while framing also
includes knee. Clipping a toe alone is already tolerated: position-only foot points
are excluded from the judging set, and the positive control passes. Therefore
“ignore toes” is not the fix. Losing the ankle can remove the current driver itself.

The systemic issue is independently reproducible on Crunch: three full synthetic
torso cycles count as three; changing only the neck-related ear landmark to lie
outside the frame makes them count as zero. The hip/shoulder/knee driver is unchanged.
One framing veto currently combines rep evidence with optional form measurements.

Proposed counting model:

- Use visible movement-specific evidence to count a complete cycle; suppress only
  the form claims whose joints/view are unavailable.
- For leg raises, evaluate a separately validated thigh/hip movement signal when
  the ankle is briefly hidden; do not pretend its threshold or meaning is identical
  to the ankle-based signal, and do not claim unseen knee straightness.
- Permit bounded continuity through brief uncertainty only when surrounding evidence
  establishes the movement. Do not invent a hidden peak or extrapolate indefinitely.
- Retain the false-rep guards: getting up, moving completely off-screen, changing
  exercise position and stopping mid-cycle cannot become completed reps.
- Test progressive crops, one-side loss, brief/long gaps, camera movement and actual
  interruptions across all movement-tier pairs, plus real-device video expectations.

These policy changes need named, independent expectations before thresholds or
vectors change, then matching evaluator/counter updates in Swift.

## FC-LAB-010 — speech never starts in the retained interval

The recording is opened as a direct local `file:` page. At 00:30 the welcome screen
shows the browser fallback voice “Daniel”, rather than the recorded bank. A speech
timeout notice is already visible in the initial segment and persists later.

The retained log contains 12 `play-request` events, zero `tts-started`, zero completed
speech and no recorded-clip start events. Teaching, “go” and numbers repeatedly
time out; pending numbers expire or are replaced. This confirms unsuccessful
speech delivery, not merely a conservative coaching cooldown. The log does not
identify the exact browser/OS synthesis failure or record acoustic output.

There are two distinct problems. `AudioBank.init()` fetches `voice/manifest.json`
and silently falls back on failure. Loading as `file:` is a strong explanation for
missing bank access: browsers apply origin restrictions to local-file fetches.
A fresh local Chromium probe confirms that this page's manifest fetch fails with
the unsupported `file` scheme; its evidence is `file-bank.json` in the ignored review
directory. This is not the original Brave network trace or a reproduction of the
native speech timeout. See [MDN's local-file CORS explanation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS/Errors/CORSRequestNotHttp).
The separate local synthesizer then does not deliver callbacks. A local-only
eligibility check prevents remote speech; it does not establish playback health.

Recommendation for the mobile product: **one consistent, bundled coach voice**,
with authored instructions and numbers rendered/recorded once, checked for required
coverage and played locally. The intelligent part is deciding when/what to say,
not generating unlimited wording or asking users to select an OS voice. Use a
platform audio-session/playback layer with interruption handling and a startup
playback check. [Apple's AVAudioPlayer](https://developer.apple.com/documentation/avfaudio/avaudioplayer)
supports local-file playback. No per-workout synthesis service is required by this
design; voice production/licensing remains an authoring cost. Do not mix arbitrary
browser voices into missing phrases or require a voice-pack download at workout time.

Native high-quality TTS can be benchmarked later for genuinely necessary dynamic
content, but should not be the default product voice or a reason to keep the picker.
No paid rendering or new voice provider was commissioned during this review.

## FC-LAB-011 — ring/target jump, not a reproduced missing numeral

The numeral 6 is visible in both sets: **10:30.50** and **11:07.75** in the video.
Diagnostic held time traverses the whole six-second interval in each set, with
no large forward held-time jump. The confirmed change is the progress target:
after held time exceeds six seconds, **one** smoothed score below 55 triggers
`target = round(held + 5)`. The announced 25-second targets become 12 and 11 seconds;
the ring advances immediately because its denominator shrinks. Both debrief rows
are labelled stopped early.

“Form's fading” is requested but its native speech does not complete. “Halfway”
then follows the new target, which makes the change harder to interpret. The first
set's score recovers quickly afterwards, but the shortened target remains.
Camera-side selection changes eight and sixteen times respectively in the retained
active sets; that is a measurement-stability concern, not proof every low score was
an artefact. No anatomical correctness verdict is claimed from these projections.

Proposed change: stable displayed time/progress and a clearly separate suggestion
to rest. Do not silently shorten a set from a transient or uncertain form estimate,
especially when explanatory speech has failed. Exact policy needs regression tests.

## Retained tests and next order

`testing/reported-session.test.mjs` runs in the default test/watch/CI loop. Its
five expectations are **2 pass / 3 fail** against the reviewed build: stale prompt,
Crunch partial-visibility refusal and mobile recorder access fail. Toe-only clipping
and wholly off-screen negative controls pass. No source-video/private landmark data
is committed. No existing expected outputs were changed to obtain these results.

The previous complete baseline passed all original harnesses and 50 shell cases;
these new cases expose coverage it did not have. The expanded suite must remain red
until the application is fixed, not claim a new fully green engineering gate.

Expanded full-run evidence: `test-results/2026-09-07T21-45-21-132Z-37995/`.
It exits 1 solely for `reported-session` (three failing tests). All 48 engine cases,
96 browser cases, 50 existing shell cases and 13 audio cases still pass, alongside
the four original harnesses and existing unit suites. Report cards now link suite
logs so individual failures can be inspected rather than showing only an exit code.

Recommended implementation order: recorder usability/flag retention and nonintrusive
prompt recovery; then split movement evidence from form evidence with partial-view
regressions; then stabilize hold/adaptation policy and ship the single recorded-voice
path. Defer production worker adoption until those behaviours work on target phones.
