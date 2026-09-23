# FormFinder — appearance, Account and progress

## User direction

Keep the uncluttered layout and contrasting purple/dark styling, add a light
alternative, rename the app FormFinder, move coach name/style behind future paid
Account access, simplify weekly goals/history and add an About destination after
Workouts and More. The account clarification was **the chosen Apple or Google
linkage, cloud-based tracking and Duo**, not a local nickname masquerading as login.

## Implemented

- Public browser/header/boot/email branding is FormFinder; the static review
  artifact's notice/404 and generated test report use the same name. Historical
  documents, build filenames, voice paths, schemas, exports and saved-data keys
  deliberately retain their existing identifiers. The build remains v4.11.
- More → Appearance offers Dark (default), Light and Match device. Light uses
  ivory surfaces and plum choices/progress. Mint/amber/red remain body feedback.
  The selected appearance is saved only when chosen, under a separate allowlisted
  `formfinder.appearance.v1` key. Read/write failures are explained visibly.
- The camera always retains dark surfaces, including setup before arming. The
  `cameraOn` presentation class follows `showCamChrome`, independently of `live`.
  End returns to the selected appearance. Account/About/appearance controls are
  not competing live-workout actions; Help remains reachable in landscape.
- Account is reachable through More and the workout picker. It describes the
  planned Apple/Google connection, paid personalisation, optional cloud progress
  and Duo without offering nonfunctional sign-in or checkout buttons. Name/style
  previews are disabled. Default recorded speech and strictly local fallback
  preview remain accessible without an account. Onboarding asks only for a
  starting route. Coaching amount and demos remain freely usable in History.
- This week leads with a large saved-days/target count, seven-day calendar,
  today marker and an earned goal-met badge. Empty days are unknown, not failed
  workouts. Settings, detailed counting policy and exports sit behind disclosures;
  opt-in and save failures remain visible. One day remains one credit, including
  when two routines are recorded. There is no invented streak or fitness level.
- History shows dated workout cards, completion status and observed work, with
  expandable set details retaining skipped/ended/unassessed distinctions.
  Preferences and scoped data export/erase remain available without crowding the
  initial view. Goal/history consent and erase scopes remain independent.
- Older local nicknames survive goal edits and exports, but the new UI does not
  edit them or promote them to account identity. There is no automatic migration
  or upload of existing data.
- About explains the mission, measurement limits, privacy and preview status.
  A noninteractive future-video placeholder and honest platform availability
  replace fake play/download links. The page identifies missing final terms,
  operator/support details and release-specific licence notices.
- Icons are small inline SVGs in the choices/progress lane, with decorative
  shapes hidden from assistive technology. Headings fade briefly; reduced-motion
  disables transitions. No new graphics library, service or recurring cost.

## What is deliberately not implemented

No real Apple/Google sign-in, authenticated account/preferences store, purchase or
restore, verified entitlement, cloud permission prompt, live sync or Duo pairing.
Disabled HTML fields are **not a secure paywall**. Default workouts remain usable
without signing in. The next account implementation must keep these distinct:

1. Verified provider identity and explicit account switching/sign-out.
2. Verified paid access, including restore; identity alone is not payment.
3. Optional, provider-scoped cloud access with visible failure/offline handling.
4. Explicit Duo invitation acceptance and sharing permissions, preserving the
   existing prototype's pending-versus-confirmed distinction.

Only then should name/style preferences be scoped and optionally synced to the
paid account. Do not silently link two provider identities or upload pre-existing
local history. See [the profile/Duo contract](../profile-duo-contract.md).

About is a useful separation of product explanation from workout execution, not
a substitute for release preparation. Final media, genuine store URLs, ownership/
support details, name availability and legal/licence review remain launch tasks.

## Verification and fixes found during implementation

Eight new `formfinder-*` cases run in the existing shell/watch/CI infrastructure,
not a parallel demo harness. They cover brand/account truthfulness, four responsive
viewports, light-mode text-token contrast, camera palette, persistence/device
appearance, malformed/read/write storage failures and reduced motion. Existing
profile/history/voice tests now navigate real disclosures/Account and keep their
previous outcome assertions. Profile tests additionally check legacy names and
seven-day deduplicated calendar presentation.

Focused verification exposed and repaired:

- Appearance controls pushing Help below the short landscape menu viewport.
  Idle-only controls are now absent during a workout.
- A rapid profile → manual routine → profile → new routine flow losing button
  hit-testing after full-panel animation. Animation is now limited to headings;
  the unchanged real-click regression passes. The exact Chromium compositor
  cause was not established, so this is not claimed as a browser diagnosis.
- Setup still inheriting light colours because `live` begins only after teaching.
  Camera visibility now owns the palette from startup through End.
- Future-day opacity reducing light-mode label contrast. Future days use the
  already contrast-checked muted text token without opacity reduction.

The extracted engine matches the previous commit after replacing only the three
public `Form Coach` brand strings with `FormFinder` (local-memory disclosure and
email subject/body). Measurement, thresholds, vectors and Swift are unchanged.

Final full-run evidence is recorded in [project status](../project-status.md).
`npm test` exited 0 for the final build in
`test-results/2026-09-23T17-43-04-532Z-36955/`: 82 infrastructure tests,
25 regression suites / 1,625 tests, four original harnesses, 55 engine cases,
110 browser cases, 151 shell cases / 1,356 checks, and 16 audio cases / 388 checks.
The eight FormFinder cases contain 105 checks. Final build hash
`d15aa0bb63863b082dd47bd7b0257548776bc3ca5bd11fab44db46bb46071aa1`
and all 82 recorded source hashes match. Twelve video cases remain blocked;
the report's 26 findings are retained coverage gaps, not new assertion failures.
An initial full run was intentionally stopped for the final calendar contrast
adjustment: `test-results/2026-09-23T17-36-56-517Z-35780/`. Its partial evidence
is not a successful or fresh final report; its saved `running` status predates
the deliberate termination and does not mean that process remains active.
Screenshots and synthetic Chromium viewports do not validate physical phones,
VoiceOver/TalkBack, beginner usability, pronunciation or body/clothing recognition.
Missing clean-camera recordings remain a coverage gap, not a pass.
