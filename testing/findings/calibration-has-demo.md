# FC-LAB-001: calibration references an undefined function

Status: fixed in the browser shell on 5 September 2026; regression retained.

Build: `form-coach-v4.11.html`, `beginCalibration`, line 3593.
Scenario: `testing/scenarios/first-steps.json`; browser widths 1280 and 390.

Starting calibration raises `ReferenceError: hasDemo is not defined` at
`setupBar.classList.toggle("on", hasDemo("plank"))`. There is no standalone
`hasDemo` definition in the module. The available helper is `shellEnv.hasDemo`.

The exception occurs after the calibration core is created, so the core can still
accept frames and produce a verdict. Execution does not reach the following teaching
cue or the automatic demo. This is why engine-only tests stayed green.

Reproduce: `node testing/run.mjs --build form-coach-v4.11.html --mode browser --scenario first-steps`.
Each failing run repeats in a fresh browser context and saves the initial and repeated
results, trace, console log and screenshots. Inspect the page-error assertion in
`result.json`; unhandled JS exceptions are distinct from console output.

The separate minimal fix calls `shellEnv.hasDemo`, the existing helper, rather than
an undefined global. The scenario also asserts that calibration exposes its demo
controls. No exception was whitelisted and no core/vector expectations changed.
