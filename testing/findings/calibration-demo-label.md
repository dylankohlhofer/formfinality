# FC-LAB-002: calibration demo label dereferences an absent session

Status: fixed in a separate shell-only change; original regression retained.

`drawDemo` correctly resolves the current movement from either the session or
calibration, then incorrectly uses `sess.mv.name` for its label. Calibration has
`sess === null`, so the first rendered demo frame throws. The earlier `hasDemo`
fix allowed execution to reach this second defect; rendering is a separate path.

Reproduction is committed in `testing/shell-sweep.mjs`, `calibration-demo`:
choose **Show me first**, start calibration, render one demo frame. The original
failure is `Cannot read properties of null (reading 'mv')`. The label fix
uses the already-resolved movement id. No engine or vector change is needed.
