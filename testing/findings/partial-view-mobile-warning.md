# Partial-view warning overlaps narrow-screen controls

Status: **fixed in the 14 September layout pass; retained regression checks**.

The warning now has a separate upper shelf. Portrait timer placement and the
landscape tip margin also keep the lower controls clear. The default shell suite's
`follow-along-portrait` / `follow-along-landscape` cases assert warning, dial, tip
and setup controls do not overlap **before** selecting follow-along, then check
unassessed notice/timer/control separation and button reachability afterwards.
This covers the tested Chromium viewports, not physical-device or all text-size
validation. See [the implementation review](../../docs/sessions/body-clothing-tolerance-2026-09-14.md).

## Original evidence (8 September)

The new partial-visibility pack's narrow Plank screenshot shows the framing warning
sharing screen space with **Show me how** and **Ghost**, with the controls drawn
across the warning text. This can make the instruction harder to read precisely
when the app is refusing to credit the hold. It is separate from counting accuracy.

Evidence (local/ignored):

- `test-results/2026-09-08T08-07-23-398Z-79920/partial-plank-browser-390/step-16.png`
- Same directory: `scenario.json`, `result.json`, `trace.zip`, `console.json`.
- Reproduce through the existing runner:
  `node testing/run.mjs --build form-coach-v4.11.html --scenario partial-plank --mode browser`

The source build SHA-256 is
`74bff3f55a1c9cce7e27a9a98f5b973f8894ffab50d3e5ce194bbb243be0b9e9`.
The viewport is 390×844, with synthetic landmarks, substituted camera acquisition
and fallback fonts. The black camera region is expected test input, not evidence
of a failed real camera. This is not physical-iPhone layout validation, and no
claim is made about touch interception or accessibility from this screenshot alone.

The original scenario asserted null form/hidden form bar during missing evidence,
not separation between the warning and controls. Its passing result is therefore
not layout approval. This concern was found by inspecting the retained screenshot,
not an automatic detector or an invented failing assertion.

The subsequent layout checks do not loosen the missing-evidence warning or
remove the counting guard. The original evidence remains available for comparison.
