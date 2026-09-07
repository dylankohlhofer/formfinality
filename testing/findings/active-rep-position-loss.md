# FC-LAB-006 — reps counted after leaving the exercise position

Status: **fixed, 7 September 2026**. The original failing scenarios remain unchanged.

The browser evaluator now invalidates an unfinished cycle on position/view/framing
loss, unreadable driver joints or missing tracking. Completed reps and the observed
baseline survive; recovery must see rest before a fresh cycle can count. Invalid
rep observations emit no score/tint/correction. The shell explains the pause.
The same counter/evaluator changes are mirrored in Swift. Session/Calibration are
not yet ported. The sections below record the pre-fix evidence.

Additional permanent checks in `testing/coach-regressions.test.mjs` cover all six
interruption types, recovery at the peak, subsequent valid counting, and an
imperfect-but-position-valid rep. Swift adds independent interruption checks.

The historical August 3 17.16.33 recording shows an interrupted push-up return
(~02:02–02:04). Independent synthetic probes establish the current failure class;
they do not reconstruct that person's original landmarks. See
`docs/sessions/historical-recording-review-2026-09-07.md` for provenance/limits.

```sh
node testing/run.mjs --build form-coach-v4.11.html --mode engine --scenario pushup-active-position-loss
node testing/run.mjs --build form-coach-v4.11.html --mode browser --scenario pushup-active-position-loss
node testing/run.mjs --build form-coach-v4.11.html --mode engine --scenario pushup-active-framing-loss
node testing/run.mjs --build form-coach-v4.11.html --mode browser --scenario pushup-active-framing-loss
```

Both committed scenarios first arm a Building push-up and require one complete
cycle to count. The next three cycles are either upright elbow bends (torso
vertical) or fully outside the image (x translated by -2 with confidence retained).
Expected count: **1**. Pre-fix count: **4**; post-fix: **1**. The user can still Skip to finish.
Fresh-context reruns retained the pre-fix failures. These scenarios are included in the
normal suite, watcher and prepared CI workflow, not marked expected failures.

Before the fix, the evaluator set `inPosition:false` / `inPose:false` with position/framing
blockers, then nevertheless called `rep.update` because its condition only checked
the counter and `armedAt`. Pre-arm protection and null/low-confidence tracking
loss tests do not cover this active-state case.

Fix considerations: separate position/observability from form quality, explain
rejected attempts, invalidate an interrupted cycle as necessary, and ensure
recovery cannot complete a rep that began in an invalid interval. Do not simply
mute counting or require every quality score to be perfect. Follow the HTML →
deliberate vectors → Swift parity rule for any production change.
