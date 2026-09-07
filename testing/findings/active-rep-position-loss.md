# FC-LAB-006 — reps counted after leaving the exercise position

Status: **open, reproduced in the current engine and browser**. No fix applied.

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
Expected count: **1**. Actual count: **4**. The user can still Skip to finish.
Fresh-context reruns retain the failures. These scenarios are included in the
normal suite, watcher and prepared CI workflow, not marked expected failures.

The evaluator sets `inPosition:false` / `inPose:false` with position/framing
blockers, then nevertheless calls `rep.update` because its condition only checks
the counter and `armedAt`. Pre-arm protection and null/low-confidence tracking
loss tests do not cover this active-state case.

Fix considerations: separate position/observability from form quality, explain
rejected attempts, invalidate an interrupted cycle as necessary, and ensure
recovery cannot complete a rep that began in an invalid interval. Do not simply
mute counting or require every quality score to be perfect. Follow the HTML →
deliberate vectors → Swift parity rule for any production change.
