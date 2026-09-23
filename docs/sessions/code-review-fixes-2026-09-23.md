# Code review repairs — 23 September 2026

The user authorized repairs to the five findings from the full review.
The judgement engine, root vectors, authored demo keyframes, scoring and Swift
port are unchanged. Duo remains a disconnected development prototype.

## Repairs

1. **Duo confirmation.** A local queued completion no longer confirms a weekly
   goal. Cached totals expose acknowledged and additional pending routine-days
   separately. `confirmedMet` is null until a successful complete reconciliation,
   and during pending work, refresh, conflict or failure. Successful true/false
   values are explicitly as of `lastSyncAt`. A rejected account refresh now
   updates the stored status instead of leaving an earlier success current.
2. **Reference imports.** The entire collection is parsed and validated before
   one storage write. Unknown movement IDs, empty/malformed/nonfinite joint
   frames, invalid timing/labels/props and oversized input are rejected without
   partially changing existing demos. Corrupt saved collections fall back to
   authored demos and remain untouched until an explicit scoped reset.
3. **Upload privacy boundary.** Drive snapshots and validates the exact minimal
   completion envelope before making a request. Extra personal fields and
   malformed identities, dates, versions or completion labels are rejected.
   Pair/timezone/consent validation remains the ledger's additional responsibility.
4. **Recorder save failures.** The UI says “Recording not saved” on failure,
   keeps the previous demo and retains a bounded draft for explicit export or
   retry. Zero-observation recordings cannot replace a working demo. Reset
   removes only `fc_refs`; other stores and any unsaved draft remain. Failed
   resets report failure. Finished recording controls and instructions close.
5. **Drive incomplete scans.** The partial-response field mask now requests
   `incompleteSearch`, allowing the existing rejection to see a real provider
   warning. Its regression mock filters that flag by the requested fields.

Reference limits are format/storage policies: 1 MiB per input and saved store,
at most 600 frames per movement, positive FPS up to 120, finite two-coordinate
joints within ±8 before and after legacy conversion, and bounded metadata.
These do not certify a captured movement's form or recognisability. Legacy
camera coordinates still convert once to isotropic references. A final review
added an explicit converted-coordinate check so accepted references remain
readable after save/reload.

Reference file reads also check request identity and whether their input still
belongs to the current screen. Navigating away, resetting or completing a newer
import prevents an older success/error from changing data or reopening the UI.

## Verification

Focused tests pass: **55** Duo/reference checks (32 newly added) and **five
new browser cases / 30 checks**. The browser cases exercise actual import, reset, export and retry
controls, corrupted startup data, missing observations and late file reads.
The recording-save failure screen was inspected at 390px width.
All run in the existing default/watch/CI loop; no parallel harness was added.

The first full run (`2026-09-23T15-30-42-559Z-25715`) was deliberately stopped
to include the converted-coordinate bound. Its browser-close errors resulted
from that interruption; it is not a complete passing result. Final `npm test`
exited 0 in `2026-09-23T15-35-19-891Z-26714`: 82 infrastructure tests, 25
regression suites / 1,625 tests, all four original harnesses, 55 engine / 110
browser / 141 shell / 16 audio cases. The saved HTML and all 80 recorded source
hashes match the final files. Exact counts are in `../project-status.md`.

No real account access, user footage or physical device was used. The existing
missing-video, voice-intelligibility, intermittent-audio and beginner/device
validation gaps remain open.
