# Profile, weekly goals and optional Duo

23 September 2026. Product direction and the first implementation slice.
This is not a claim that remote Duo, accounts or mobile apps have shipped.

## Direction

Keep the workout coach local and usable without an account. Participation is not
form quality or a fitness diagnosis. An optional weekly shared goal is a better
initial fit than a daily punitive streak: each person chooses a commitment,
the pair agrees a combined target, and either may contribute toward that target.
For example, two plus three routine-days gives a five-credit shared week. These
numbers are user commitments, not medically recommended exercise frequencies.

Keep three concepts separate:

- Participation: completed routine-days and later clearly authored milestones.
- Consistency: only periods actually recorded; missing history is unknown.
- Workout difficulty: the existing learning/building/strong choice. Neither a
  participation count nor average form score changes it automatically.

Launch remains iOS-first; Android is deferred, not ruled out. No operator-run
backend, paid API, cloud AI, account connection or automatic upload is introduced
by this work. Optional future sync necessarily sends a minimal participation
record to the chosen provider; it cannot be described as entirely on-device.
Video, landmarks, diagnostics and form scores remain outside that record.

## Implemented now: local profile and weekly goals

The browser picker opens **Profile & weekly goals**. A separate, default-off
consent enables future completed-routine records. This does not enable or copy
the existing coach history, preferences, diagnostics or microphone. A nickname
is optional and local; it is not an authenticated identity. No avatar upload.

`ProfileGoals`, `profileCompletion`, `profileCalendar` and `profileEmailDraft`
live in the HTML, before the shell boundary. The shell consumes existing finish
effects without changing SessionCore, CalibrationCore, scoring or vectors.

Current contribution policy:

1. Finish a whole authored routine without skipped or ended sets. Skips, empty
   routines, calibration and early End cannot earn a routine-day. Observed work
   before those interruptions still appears in the ordinary summary/history.
2. A completed assessed routine counts regardless of form score. No minimum
   quality score, inferred fatigue or ability threshold is added.
3. At most one credit on each civil day. Additional qualifying routines remain
   recorded but do not increase that day's weekly credit. Session UUIDs prevent
   duplicate finish effects from creating extra records.
4. Guided (timer-based) and Follow Along (manual Finish) completions are
   unassessed. **Also count completed unassessed routines** is a separate explicit
   profile choice, off initially. Accepted records retain that label permanently;
   changing the setting does not retract past participation or backfill old
   sessions. This local choice is not yet a negotiated Duo policy.
5. The first target is selected before opt-in; later edits take effect next
   Monday. Re-editing replaces the pending target, never the current/past week.
6. The IANA timezone captured at first opt-in remains fixed through travel and
   re-enabling. Weeks begin Monday in that zone, using calendar dates rather
   than adding 24 hours across daylight-saving changes.
7. Saving off means unknown activity, not failed weeks. This slice shows recorded
   counts and current goal achievement, **not a streak length, fitness level,
   missed-week verdict or complete lifetime total**. No backfill/import yet.

Local schema `profile-goals/1`, key `formcoach.profile-goals.v1`, contains only:
consent, optional nickname, fixed timezone, setup/current-enable/update times,
unassessed-counting preference, week/target schedule, and completion records
`{sessionId, planId, finishedAt, basis}`. `basis` is observed/unassessed; it is not
a quality judgement. There are no scores, body measurements, transcripts or
provider tokens. Timestamps are device-reported, not tamper-proof server time.

Limits: 4,000 completions, 1,024 goal changes and 1 MiB serialized feature-store
budget. Saving stops visibly rather than silently dropping old progress.
Malformed reads and failed/stale writes lock saving; explicit export and
confirmed scoped erase are available. Consent revocation stops this window even
when persistence fails, with an explicit warning that the old setting may return
after reload. LocalStorage detects sequential stale writers, not simultaneous
cross-tab transactions. Multi-device transactions are not claimed.

Exports are personal, unencrypted JSON. Import/restore is not implemented yet;
the UI says so. Browser storage can be cleared and is not a backup. Clearing
this profile never deletes separate coaching history or diagnostic data.

## Implemented now: user-approved email sharing

A completed routine offers **Share completion by email…**, even if local saving
is off. It opens a `mailto:` draft with fixed text and no recipient. The user
chooses who receives it and presses Send in their mail app. Unassessed routines
are labelled. Skipped/ended routines do not offer a false completion claim.
No name, score, raw data, shared streak total or cloud-sync success is included.
No send permissions, Gmail API, contact lookup, email-address store or automatic
delivery is added. A configured mail app is needed; the browser cannot verify
that it opened or delivered the message. Email is an announcement, not sync.

For native iOS, a later mail composer can preserve this approval boundary;
[Apple documents that delivery is not guaranteed](https://developer.apple.com/documentation/messageui/mfmailcomposeviewcontroller).
Android can use its user-controlled email/share UI. Test cancellation, missing
mail app, accessibility and external-app return on both actual platforms before
claiming mobile support. This browser change is not a native mail integration.

## Implemented prototype: transport-independent Duo reconciliation

`duo/sync.mjs` now contains a **development-only** two-client ledger and
durable local outbox. It consumes only completions already committed by the
opted-in `ProfileGoals` store; it does not inspect workout scores, camera data,
plans, diagnostics or names. The remote completion envelope contains an opaque
pair/member/session ID, completion timestamp, fixed shared civil day/week,
observed/unassessed label and policy version. One credit is allowed per member
per civil day, with no per-member quota. Both local policy objects must match
timezone, target, unassessed inclusion, pair start time and version before a host may establish
a pair. This equality check is **not** proof of real-world consent or identity.
Local completions from before pair opt-in are ineligible for automatic upload;
there is no silent backfill.

`duo/drive.mjs` is an injected-token, foreground Google Drive REST adapter for
ordinary shared-folder JSON files, not `appDataFolder`. It has no Google sign-in,
token storage, folder creation, invitation acceptance, UI or background sync.
The browser app does not import this module or show a connected Duo. Two
**simulated** accounts exercise the adapter and reconciliation in
`testing/duo-sync.test.mjs`; no real Google accounts were accessed or files
uploaded. The adapter checks Drive file ownership metadata against provider
IDs supplied by a future authenticated host, and queries
[Drive's current-user endpoint](https://developers.google.com/workspace/drive/api/reference/rest/v3/about/get)
before each sync to reject a token for the wrong owner. That detects some accidental
cross-member files, but it does not protect against a shared-folder writer
editing another member's file or guarantee that `drive.file` can list files
created by the partner. Both issues must be tested and the integrity design
settled before production.

The outbox is persisted before an upload attempt. A lost upload reply is
resolved by listing before retry; identical duplicate files add no credit,
conflicting UUID payloads are flagged. Offline/quota/sign-in/revocation states
retain pending work. A disappearing previously seen partner file is flagged,
not silently subtracted. Disabling sync prevents a pending read from starting
an upload and invalidates later callbacks, including disable/re-enable races.
An upload already dispatched before opt-out may still reach Drive; remote
deletion is not implemented and must be explained by the future consent UI.
The sync store is scoped by opaque account, pair and
member IDs. It is a prototype localStorage-style store, **not** a proven
multi-device transactional database, secure identity layer or permanent cloud
backup. Weekly counts from cached data are not proof a partner is currently
online or that an unmet week has failed.

### Live two-account gate, still open

Use two consented Google test accounts and platform OAuth clients restricted to
the narrow `drive.file` scope. Explicitly approve and create a private ordinary
folder, grant only the named partner, then verify on both accounts that each can
list/read the other's files, create their own, and see reliable owner metadata.
Before shipping, prefer reciprocal member-owned folders with partner read-only
access if the narrow scope supports them; a shared writer folder gives both
members edit access to inherited child files.
Test simultaneous offline uploads, ambiguous replies, late Sunday completion,
quota denial for each account, revoked access, deleted/edited files, reinstall,
account switching and cross-platform consent screens. Measure actual record
size/permissions. If `drive.file` cannot provide the required partner visibility
and ownership guarantees, do **not** widen scope silently; revisit the transport
or switch to a provider with a sound shared-record contract. No production
pairing, user notifications or remote-success claim is authorized by green
simulated tests alone.

## Duo contract: transport-independent rules

Keep a local completion ledger authoritative for what this device recorded,
and derive the shared week from deduplicated contributions. Proposed envelope:
schema, opaque Duo ID/member ID/session UUID, device completion time, fixed
shared timezone/week key, qualifying completion basis and policy version.
No email address or login token is a completion identity. Authenticate provider
access separately; do not trust a client-supplied member ID alone.

Both members explicitly accept the same timezone, target, unassessed-work policy
and sharing disclosure. Targets stay fixed within a week; both approve changes
for a following week. No daily punishment, score-based target escalation or
mandatory per-person sub-quota. Define planned pauses and retained achievements
before adding any streak-length calculation. Do not finalise a failed week from
incomplete/offline partner data.

Persist local work before upload. The eventual durable outbox needs pending,
syncing, synced, offline, storage-full, sign-in-required and share-revoked states,
bounded retries, cancellation and a last-successful-sync time. Upload receipt
time must not move a late completion into the wrong week. Retries and identical
UUIDs must not create extra credit; conflicting payloads for one UUID must be
flagged rather than merged silently. Logout/account changes isolate ledgers.

The separate prototype above is not connected to a user's account. The current
browser profile event list is **not** itself a working outbox. A native host
still needs durable transactional storage and explicit migration/consent.

## CloudKit route (iOS-first)

Private/shared records are a plausible low-operating-cost route for two Apple
accounts. The share owner stores the shared data in their private database;
participants access shared records through their shared database. Account/quota
problems must not interrupt a workout or erase locally completed work.
Owner quota exhaustion can affect both participants; the UI must identify whose
storage needs attention, rather than incorrectly telling every participant to
free their own storage. See [shared records](https://developer.apple.com/documentation/cloudkit/shared-records)
and [quota exceeded](https://developer.apple.com/documentation/cloudkit/ckerror/quotaexceeded).

CloudKit subscriptions can signal changes, but notifications are hints and may
be coalesced; fetch actual records and reconcile. No promise of instant delivery
or guaranteed background execution. Local reminders must not claim a partner
has failed based on stale data. Native setup, entitlements, signing, sharing UI,
two-account tests and physical devices are still needed.

### Safe storage guidance and an explicit estimate

Offer a short help sheet, not an elaborate storage-cleaning feature:

- Phone storage and cloud storage are different. Optimising iPhone Photos saves
  device space, not iCloud quota.
- Review obsolete backups and unwanted files. Never pressure someone to delete
  memories to keep a streak; verify independent copies before deleting.
- Deleting iCloud Photos propagates to synced devices. Link to current
  [Apple storage guidance](https://support.apple.com/en-gb/108922) and
  [photo optimisation guidance](https://support.apple.com/en-gb/105061).
- A tiny app footprint does not solve an account that is already full. Keep
  local participation working and show pending sync honestly.

Illustrative **Duo-only planning allowance**, not measured CloudKit usage:
1–4 KiB for each completion or weekly aggregate, plus 64 KiB fixed overhead.

| Pair activity | Records | Approximate decimal MB |
|---|---|---|
| Three each per week, one year | 312 completions + 52 weeks | 0.44–1.56 |
| Both daily, one year | 730 completions + 52 weeks | 0.87–3.27 |
| Both daily, five years | 3,650 completions + 260 weeks | 4.07–16.08 |

These are arithmetic budgets, not measured record/index/storage overhead, and
exclude full private histories, backups, photos, recordings, models and audio.
Measure actual native allocations and sharing behaviour before making a storage
promise. Do not advertise any provider's quota/pricing as “free forever”.

## Android and mixed-platform Duo

The participation/date policies can be ported with shared test vectors, and
pose analysis must remain on-device. An Android workout UI, camera/pose/audio
adapters, lifecycle/accessibility tests and parity with the HTML engine are
separate work; a shared streak does not itself deliver an Android app.

| Route | Mixed iOS/Android pair | Main trade-off |
|---|---|---|
| Native CloudKit alone | Not an Android native integration | Best initial Apple integration; Android needs another client route |
| CloudKit Web Services/JS | Plausible, unproven here | Apple sign-in/web sharing eligibility, token lifecycle and Android notification delivery need a spike |
| Google Drive on both platforms | Technically plausible | Both connect Google; shared-file permissions/conflicts and foreground sync need testing |
| Operator-run cross-platform service | Technically possible | Adds infrastructure, abuse/security work and cost exposure; not currently selected |

CloudKit is not categorically Apple-device-only at the API level:
[Web Services](https://developer.apple.com/library/archive/documentation/DataManagement/Conceptual/CloudKitWebServicesReference/SettingUpWebServices.html)
and [JS shared databases](https://developer.apple.com/documentation/cloudkitjs/cloudkit.databasescope/shared)
exist. Test an Android-only user's real Apple-account eligibility, invitations,
revocation and authentication before selecting this route. Never embed a
server-to-server private key in a phone app. Web access does not imply reliable
native Android push or a supported Android SDK.

### Google sign-in and Drive candidate

Authentication is not storage or collaboration. Google API authorization exists
for [iOS](https://developers.google.com/identity/sign-in/ios/api-access) and
[Android](https://developer.android.com/identity/authorization). Both members
would explicitly connect Google to use a Drive-backed Duo, regardless of device.
An Apple-login/iCloud-only person cannot automatically join a Drive Duo; there
is no cross-provider bridge simply because both apps implement sign-in.

Google accounts advertise **up to 15 GB**, shared with Gmail and Photos, not an
app-exclusive allocation: [storage explanation](https://support.google.com/mail/answer/9312312?hl=en-GB).
The hidden [appDataFolder cannot be shared](https://developers.google.com/workspace/drive/api/guides/appdata).
Use ordinary app-created files shared with the named partner, not public links,
and request the narrow [drive.file permission](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).
Recipient authorization to the specific file, account eligibility, invitation
acceptance and OAuth verification must be proven, not assumed from sign-in.

Prefer a prototype with per-member contribution logs to avoid two clients
overwriting one aggregate JSON file. Multiple devices, conflicts, duplicate
requests, deleted/moved files, externally edited data, account changes and
revoked sharing still require explicit tests. Personal My Drive file ownership
and quota differ from a CloudKit shared zone; measure each provider separately.
Do not assume consumer Google accounts have Workspace Shared Drives.

Drive [change notifications target an HTTPS webhook server](https://developers.google.com/workspace/drive/api/guides/push),
not a direct phone push token. With no operator-run server, the conservative
product is sync on opening/foreground refresh plus local reminders and optional
user-approved sharing, not guaranteed instant partner notifications.

As checked 23 September 2026, Google says standard Drive API usage has no extra
charge but plans charges above quota limits later in 2026. See
[the current limits/pricing](https://developers.google.com/workspace/drive/api/guides/limits).
Verify billing enforcement/caps and refresh policy before adopting it; a budget
alert is not a hard spending limit. No Google project, billing account or paid
quota increase was created here.

If Google becomes the primary app login, account for Apple's
[login-service review requirements](https://developer.apple.com/app-store/review/guidelines/#login-services).
Treat an optional “Connect Drive” integration distinctly, but do not assume that
relabeling login automatically earns an App Review exception.

### Automatic email: feasible, not selected

With explicit separate OAuth consent, a foreground client can use
[Gmail's send API](https://developers.google.com/workspace/gmail/api/guides/sending)
to notify a partner from the participant's Gmail account. It requires
[sensitive send-on-your-behalf permission and verification](https://developers.google.com/workspace/gmail/api/auth/scopes),
not merely Google sign-in or Drive access. No mailbox-reading scope is needed.
Consent, recipient opt-out, rate limits, ambiguous-send duplicates, offline
queues and delivery/spam behaviour are additional work. A Google account without
Gmail is not automatically a sender mailbox. Emails would reveal the sender's
address; do not silently substitute the user's mailbox for a branded service.

Drive's [sharing notification email](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/create)
is for invitations, not arbitrary workout events. Do not abuse repeated sharing
or comments as a notification relay. A branded automatic email service needs a
trusted sending service; never put shared sending credentials in the app.
For now use the explicit draft, not these automatic routes.

## Verification and next implementation gate

`testing/profile-goals.test.mjs` and `profile-*` shell cases run in the existing
default/watch/CI loop, against the saved build. They cover opt-in, policy/date
boundaries, score independence, skip/end exclusions, unassessed labelling,
deduplication, target edits, malformed/full/unavailable storage, stale writers,
export/erase, mobile-width controls and intercepted email-link activation.
No email is sent, no provider is authenticated and no physical device is tested.

The Google Drive transport spike and simulated two-account reconciliation are
now in the default test loop. Next: satisfy the real two-account gate above,
especially `drive.file` partner visibility and shared-writer integrity, before
wiring production pairing/notifications. Verify actual storage and consent
screens, not just mock HTTP responses.
Retain the voice intelligibility audit and independent beginner/device trials as
open quality work; participation features do not close those gaps.
