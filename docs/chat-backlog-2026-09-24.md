# FormFinder — chat backlog reconciliation

24 September 2026. Reconciles the entire visible conversation with the repository,
dated review notes, current source and local Git history. The companion
[feature inventory](feature-inventory.md) describes what was actually implemented.
This document keeps the remaining requests visible, including ideas discussed
before later UI, AI, Duo and demo work changed the priorities.

Work requiring a human participant, provider identity, device/team choice or an
external credential is identified with its concrete dependency.

Status vocabulary:

- **Implemented:** present in source, with the stated scope; not synonymous with
  public release or human validation.
- **Pending:** implementation, verification or publication has not completed.
- **Open:** an unresolved defect, evidence gap or undelivered request.
- **Deferred:** retained direction/proposal with a later dependency; not cancelled.
- **Superseded/cancelled:** a newer explicit direction replaces the older item.

## 1. Current loose-end closure

| ID | Request / finding | State and evidence | Concrete closure condition |
| --- | --- | --- | --- |
| C01 | Recover when the camera track ends unexpectedly | **Implemented and verified.** Eleven shell cases and four packaged camera flows (19 checks each) pass after explicit pause/restart recovery; the original September 23 failures remain recorded. [Review](sessions/full-e2e-review-2026-09-23.md). | Pause assessment, preserve observed work, release/detach the ended stream, show explicit recovery and prevent frozen-time credit. Retain real camera/model-path regressions, including WebKit and late callbacks. |
| C02 | Fix fresh static release assembly timing out | **Implemented and verified.** Bounded rolling I/O produced a fresh 24 September artifact: all 1,294 clips read in 162.8 seconds, emitted-artifact smoke and 4,127 checks pass. The underlying slow source-file reads remain unexplained. [Review](sessions/full-e2e-review-2026-09-23.md), [builder](../release/web.mjs). | Diagnose asset-read/assembly behavior, retain bounds/path/allowlist/no-overwrite protections, produce a fresh receipt and pass source/output verification and emitted-artifact smoke. Do not certify the old artifact as current. |
| C03 | Audit the whole voice bank without listening manually to 800+ files | **Implemented screening, listening still open.** All 1,294 active clips decoded, zero scan errors, 68 machine candidates; 22 unit/control tests and four actual decoder controls pass. See [audit guide](voice-library-audit.md). [Handover specification](sessions/device-handover-2026-09-16.md). | Verify manifest/script mapping, input hashes, decoding/signal/timing checks, independent bad-audio controls and a ranked local queue. Report the exact screened count. Screening is not transcription or human pronunciation approval; A01 remains open until separately reviewed. |
| C04 | Make the new tests/demos durable | **Committed locally.** `816e43e` preserves the approved Remotion prototype; `09ad337` preserves the camera recovery, reusable camera suite, release repairs and voice audit. | See the closure record for publication status. Licensed model binaries and generated/private evidence stay local; a checkout explains character preparation explicitly. |
| C05 | Push current development to the owner's GitHub | **Blocked by credential permission, confirmed 24 September.** GitHub rejected the non-forced development-branch push because the current Personal Access Token lacks `workflow` scope for `.github/workflows/test-lab.yml`. The verified commits remain local. | The owner must authorize a credential permitted to publish workflows, then push `codex/automated-test-lab` and verify its remote SHA. Never paste a token into chat, remove the workflow to bypass this check, overwrite old `main` or remove `ethan` implicitly. |
| C06 | Make CI automatic and prove it runs | **Configured locally; remote execution blocked/unconfirmed.** [Workflow](../.github/workflows/test-lab.yml) defines push/PR/manual runs, Swift/browser/audio/video/artifact checks and retained reports. The fresh push failed for the permission in C05; `gh` is not installed. | Publish the workflow with the branch and inspect an actual completed remote run/artifacts. Missing `gh` is tooling, not proof that Git push or Actions is impossible. A passing local suite is not a completed Actions run. |
| C07 | Bring the continuation/backlog documentation up to date | **Implemented.** Active next-step, start/continuation, backlog/index/status and rules now link current commands, evidence and boundaries. Stale repo-root serving advice was removed from the active guide. | Keep dated historical facts labelled and reconcile commands/counts against completed verification. The 24 September full run and exact source hashes are recorded in the closure record. |
| C08 | List every implemented feature and reconcile this chat | **Implemented and reviewed:** [feature inventory](feature-inventory.md) and this 77-item reconciliation. | See the [closure record](sessions/loose-ends-2026-09-24.md) for final verification and Git status. |

The [closure record](sessions/loose-ends-2026-09-24.md) records exact local evidence,
including original failures and fresh verification. Remote publication and CI
execution require their own confirmed outcome.

## 2. Recognition and real-workout reliability

| ID | Chat request / retained finding | Current disposition | Next evidence/action |
| --- | --- | --- | --- |
| R01 | Count Leg Raises when feet are partly cropped | **Partly addressed, core recognition limit open.** Optional foot hints/quality no longer veto sufficient movement evidence; the actual shoulder–hip–ankle driver still cannot count with missing required ankle evidence. | Obtain consented raw-camera clips/landmarks with independent rep labels. Evaluate any alternative driver against stationary, misleading knee motion, hidden peak, position exit and recovery negatives before changing declarations/vectors/Swift. |
| R02 | Count an appropriate Plank reliably in an ordinary room | **Partly addressed, recognition open.** Required-evidence explanations, stable side choice, unscored missing geometry and continuous-bout calibration fixes exist; missing required geometry still freezes the timer. | Test furniture/occlusion, cropped ankles, clothing and view on actual target phones. Separate body-visible-but-model-missing observations from truly hidden geometry. Do not call no-false-credit checks successful recognition. |
| R03 | Avoid the same cropping bug across other exercises | **Policy implemented; accuracy incomplete.** Required movement vs optional form applies across the library; cropped-neck Crunch is repaired. The partial pack covers four movements/nine tier pairs. | Extend independently labelled human cases by movement/evidence role. Synthetic coverage of 21 movements/44 pairs does not establish population accuracy or observed reps during unknown peaks. |
| R04 | Support larger bodies, different proportions and ordinary clothes | **Policy implemented; human validation open.** Complete-side stability and an explicit unassessed escape hatch exist; no BMI/weight threshold or new model was introduced. | Use varied bodies/clothing/lighting/backgrounds and tally false cues, missed/counting errors and setup burden. Do not infer ability from tracking quality or silently choose a better score. |
| R05 | Plank help prompts too early and blocks the exercise | **Implemented fix.** Five-second setup grace, six-second sustained observed difficulty and immediate withdrawal on recovery/loss; visual until accepted. | Keep setup-prompt/report regressions. Validate whether the prompt now feels unobtrusive with a beginner on a phone. |
| R06 | Side Plank skips numeral 6 / timer jumps | **Underlying target rewrite removed.** Recording review found numeral 6 present; the ring jumped because low score shortened the target. Body-tolerance work removed that rule. | Retest the real movement/voice experience; do not preserve the original “missing 6” explanation as established cause. |
| R07 | Calibration joins separated holds or misses an exit | **Implemented policy fix.** Sustained required-evidence loss pauses after 2.5 seconds; explicit restart/observed result replaces merged-bout continuation. | Validate real-room interruption and user understanding. A single plank remains a starting route, not a complete fitness measurement. |
| R08 | Ghost direction/size mismatch and forearm vs high Plank ambiguity | **Open.** Ghost is now explained as a guide; body registration is not implemented. The September 9 review found straight-arm support can pass a forearm-style demo's declaration. | Deliberately define supported variants and teach them; assess whether to simplify/remove or align the ghost. Do not add an elbow-angle gate or claim anatomical invalidity without the content decision. |
| R09 | Have Astra test instead of repeated live trials | **Automation implemented, substitution not established.** Shared engine/browser/video, shell/audio and optional local review cover software policy and failures. | Use the automated loop for regressions and a small human exception queue. Keep independent beginner, speaker, device and recognition trials as explicit remaining evidence. |
| R10 | Combine the three test modes | **Implemented shared workflow, not a single simultaneous capture.** Engine/browser/video use shared scenarios/reports; real-time MP3 capture is an additional mode. | If needed, add a bounded actual camera-inference-plus-audio contention scenario using the existing runner. Accelerated replay still does not measure real-time speech during model load. |
| R11 | Retain historical and new recording bugs | **Reviewed/retained.** Historical footage, September 7 JSON/video and September 9 screen recording have local reviews and durable synthetic regressions where justified. | Do not require unavailable September 9 exports retrospectively—the user said none were saved. Capture suitable opt-in diagnostics/clean input in future; current screen footage cannot recover lost landmark confidences. |
| R12 | Beginner test 02 | **Open release gate.** Max's original test is documented; later owner recordings do not complete a second independent beginner protocol. | Recruit a new beginner, use the current verified build unaided, record confusion/wrong cues and willingness to return/pay; retain consented evidence. Review the aggregate two-session gate. |
| R13 | Physical phone, accessibility and sustained runtime | **Open.** Narrow desktop Chromium/WebKit/Firefox are not physical phone tests. | Test real camera orientation/lens permissions, interruptions, safe areas, large text, VoiceOver/TalkBack where applicable, thermal/battery behavior, speaker/headphones/Bluetooth and reaching Pause from the floor. |
| R14 | Native camera/audio experiment | **Prerequisites inspected, app not built/deployed.** A paired iPhone was found; no usable signing identity was available at that checkpoint. | User selects their Apple account/team in Xcode; then use the scoped native protocol. Recheck present prerequisites rather than repeating an obsolete Xcode-component diagnosis. No paid membership is assumed necessary for the initial experiment. |

Evidence: [movement contract](movement-evidence-contract.md),
[partial pack](../testing/partial-visibility.md),
[body/clothing record](sessions/body-clothing-tolerance-2026-09-14.md),
[September 7 review](sessions/current-recording-review-2026-09-07.md),
[September 9 review](sessions/user-test-review-2026-09-09.md),
[beginner protocol](beginner-test-protocol.md),
[native readiness](sessions/native-spike-readiness-2026-09-08.md).

## 3. Speech: distinguish transport, words and coaching quality

| ID | Request | State | Completion condition |
| --- | --- | --- | --- |
| A01 | “2” sounds like “coo”, especially Warm | **Open.** Intended text and nonzero signal do not establish pronunciation; no confirmed re-render is evidenced. C03 provides screening/queue infrastructure only. | Blindly compare the three source “2” clips with actual captured playback, review source beginnings/endings and independently label the defect. Replace confirmed bad assets with rights/cost approval and repeat real playback checks. |
| A02 | Avoid manual work across the complete voice library | **C03 screening implemented**, followed by human sampling. Active manifest count at the recorded checkpoint is 1,294, including 360 persona-specific numbers; older 800/908/210/360-new-clip figures describe different snapshots. | Audit exactly active paths against the current render plan; rank failures/candidates, retain file/script hashes and invalidate approvals on change. Do not trust the older `render-plan.full.json` because of its filename. |
| A03 | Resolve audio stalls completely | **Recovery implemented; intermittent finding still open.** Bounded retry, deadlines and cancellation have causal controls. September 23 failures recur and a later green run does not identify or eliminate the cause. | Correlate request dispatch/server receipt/file read/response/media start/end/capture under controlled cold/warm conditions. Distinguish delivery stalls from sample truncation; retain production deadlines and full-number negative controls. |
| A04 | Fix repetitive or contextually inappropriate feedback | **Policy fixes implemented; listening/comprehension open.** Shared readiness/topic budgets, obsolete-cue cancellation and less-encouragement preference exist. | Review flagged real speech at realistic pace and on physical output; approve wording/density with beginners. Zero analyzer candidates is not human approval. |
| A05 | Replace unserious OS voice choice with a sustainable mobile voice | **Partly implemented.** Local-only fallback and simplified UI exist; default recorded coaching remains. Native bundled playback/audio-session product integration is absent. | Pick a consistent production voice through an audition and ship checked local clips, with complete coverage and native interruption behavior. Keep runtime generation fees out of ordinary workouts. |
| A06 | Consider Fish Audio instead of the original ElevenLabs bank | **Provider evaluation/decision open; no migration.** Existing production tooling is ElevenLabs-based. | Compare a small reviewed script/number sample for pronunciation, tone, rights, consistency and authoring cost before replacing assets. Do not treat a new provider as a cure for queue/transport bugs or activate paid generation implicitly. |
| A07 | Missing recorded readiness/framing wording | **Open content coverage.** Five added keys intentionally use local TTS fallback instead of inaccurate older head/feet clips. | Inventory all current unresolved keys first; render/record only approved scripts, update manifest and test full sentence resolution, fallback/unavailability and actual output. |
| A08 | Actually hear live feedback / validate local TTS and speakers | **Partly covered.** MP3 waveforms/timelines are captured; native/browser TTS waveforms and physical acoustic output are not. | Add appropriate local capture or physical listening evidence where supported. No transcript or audible-pronunciation claim from event callbacks. Include Bluetooth route latency and interruption. |
| A09 | Music ducking, Spotify and localisation | **Deferred historical ideas.** No music service, platform audio mixing or translated bank is implemented. | Consider native audio-session ducking first; only add provider SDKs or languages after demand, translated coaching review and device tests. |

Evidence: [voice handover](sessions/device-handover-2026-09-16.md),
[intermittent finding](../testing/findings/audio-startup-intermittent-2026-09-23.md),
[audio recovery](sessions/audio-stall-recovery-2026-09-14.md),
[voice testing boundaries](../testing/README.md#recorded-voice-and-coaching-review),
[existing renderer](../voice-render-kit/README.md). No current provider pricing or
licensing was rechecked during this local implementation pass.

## 4. Demonstrations and post-set reflection

| ID | Chat item | State | Next condition |
| --- | --- | --- | --- |
| D01 | Save a screenshot after repeated significant form faults, then review it after the set | **Open feasibility/product request; not implemented.** Diagnostic flags save observations, not pixels, and testing screenshots are not this consumer feature. | Specify opt-in, measured fault recurrence/episode identity, confidence/view eligibility, bounded local image memory, review/delete/export and retention. Repeated frames of one fault must not become three independent mistakes. Then test with independently labelled examples; do not infer hidden posture from a low aggregate score. |
| D02 | High-quality generated/recorded exercise demos | **One isolated Remotion squat prototype implemented.** Not integrated into the workout app. The earlier all-exercise/video ambition remains open. | Qualified full-cycle technique review, beginner readability, accessible replay/pause and measured phone/bundle budgets; then integrate a small pilot through existing demo entry points and tests. |
| D03 | Keep the approved demo page and improve character/timing | **Implemented in prototype.** Full-rep cards; 5.4-second cycles; procedural anatomy iterations; user-supplied Mixamo Alien Soldier; approved dark layout. | Preserve the approved composition during integration. Decide whether the dark armoured character teaches beginners clearly; visual approval is not technique approval. |
| D04 | Show knee spacing from another angle | **Implemented in prototype.** Front-view second rep, standing-only camera transitions, knee-following-foot teaching and corrected inward-knee IK artifact. | Review the complete motion from both views and avoid a universal fixed-width prescription. No new live knee-valgus assessment is implied. |
| D05 | Produce the remaining demos / First Steps pilot | **Open.** No Plank, Leg Raise or First Steps video composition has been delivered. Squat is not part of First Steps and is not a Learning-tier movement. | Choose the next pilot based on the actual beginner plan: Plank/regressed Knee Plank, Glute Bridge, Dead Bug, Knee Push-up and Bird Dog. Assess applicable variants before claiming plan-wide coverage. |
| D06 | Synchronize demo narration with movement | **Deferred, still open from Max's feedback.** Remotion study is silent; live teaching and old animation are not a completed narrated video system. | Author phase/card timing and checked audio together; verify captions, pacing, cancellation and comprehension. Do not reuse fast-changing text from the first prototype. |
| D07 | Export and ship demo media | **Open.** QA stills/Studio exist; no final MP4 or app integration. Source/GLB are ignored local licensed assets. | Deliver approved landscape/portrait media with asset provenance, playback/failure/reduced-motion handling and explicit packaging. Preserve source preparation instructions and review rights before redistribution. |
| D08 | Use/evaluate the three downloaded plugins | **Completed evaluation; selected Remotion used.** Prototype README records Remotion/Product Design/GitHub roles. | Product Design can review the eventual player; GitHub can help CI after authentication. No need to replace Remotion merely to obtain a rig or assume plugin installation supplies workflow permission. |
| D09 | Promo video on About | **Placeholder implemented; media open.** About identifies future video and platform availability honestly. | Produce reviewed promotional media and real platform links once releases exist; do not describe the squat technique study as the completed trailer. |

Evidence: [demo README](../exercise-demos/README.md),
[character record](../exercise-demos/assets/alien-soldier.md),
[FormFinder UI](sessions/formfinder-interface-2026-09-23.md),
[diagnostic contract](../testing/README.md),
[historical restructure proposal](restructure-plan.md).

## 5. Workouts, progression and older content requests

| ID | Item | Disposition | What remains |
| --- | --- | --- | --- |
| W01 | Remove yoga/Cat–Cow | **Deferred, not done.** Current source still includes Cat–Cow, Downward Dog, Cobra and Morning Mobility. The user said these need not remain; that did not implement removal. | Make an explicit content/plan/voice migration after the beginner gate, retain the guided/unassessed capability and its negative tests, and update vectors/Swift deliberately. |
| W02 | Push / Legs / Core organization | **Planned, not implemented.** Current plans remain First Steps, Core Strength, Full Body, Functional Foundations and Morning Mobility. | Reconcile plan/tier coverage and beginner progression before changing the catalogue. Historical “Pull” has no accepted equipment-free measurable library. |
| W03 | Circuit rounds rather than straight sets | **Deferred agreed direction in historical planning.** `expandPlanSteps` still expands straight sets. | Decide Learning-tier learning/repetition trade-off, then change the plan model and shared vectors/Swift. Re-test rest pacing and per-set summaries. |
| W04 | Custom workout builder / add sets of chosen exercises | **Open, not delivered by authored-plan search.** | Build on a deliberately supported plan/circuit model, validation and bounded persistence; preserve observed/unassessed distinctions and explicit Start. |
| W05 | New exercises | **Deferred content project.** Incline/Pike Push-up, Reverse Lunge, Hip Hinge and Superman were recommended first; other candidates were discussed. No library expansion is evidenced in this collaboration. | Validate declarations, real-camera measurability, tiers, technique/demo/script assets and vectors per exercise. The current 21-exercise test sweep is coverage of the existing library. |
| W06 | “Level” based on workouts/month and performance score | **Superseded as automatic ability inference.** Participation/goals are implemented separately; no fitness level is computed. | If gamification is added, define attendance milestones separately from difficulty. A pair's goals are chosen commitments, not inferred safe prescriptions or a combined form-score level. |
| W07 | Per-movement difficulty drift / strength progression | **Deferred, no automatic progression implemented.** Earlier score/attendance-based recommendations conflict with current evidence rules. | Design with sufficient comparable observations, user control and real validation. Poor tracking, number of visits or a plank score alone cannot justify harder exercise. |
| W08 | Longer-term programmes / finite multi-week plans | **Deferred.** Weekly participation targets do not implement a training programme. | Author progression/rest content and validate it before adding a duration picker. |
| W09 | Longer rests and explicit acknowledgement of plank after calibration | **Open historical feedback; no specific approved redesign found.** Current rests remain authored/scaled; new previews make them visible. | Select rest policy based on beginner evidence, and review transition copy. Do not assume the UI redesign solved these content complaints. |
| W10 | Countdown before arming and configurable countdown | **Partly existing, further request open.** Timed countdown emissions predate this collaboration; no new user-configurable readiness countdown is evidenced. | Test current setup clarity in beginner test 02 before changing arming timing. Distinguish pre-existing countdown from a newly implemented feature. |
| W11 | Count a rep at peak outright | **Deferred deliberate engine change.** Existing full-cycle semantics remain. | Review false-credit/tempo implications and independently update HTML/vectors/Swift only if selected; do not conflate peak acknowledgement with completed-rep counting. |
| W12 | Self-reported/unassessed activity should count toward goals | **Bounded version implemented.** Finished guided/Follow Along routines may count only with explicit profile choice; manual arbitrary activity entry is absent. | Keep labels and score independence. Any future manual-entry policy must be explicit and mutually accepted by a Duo pair. |
| W13 | Per-exercise debrief and useful history | **Implemented with narrower honest claims.** Approved observations/tips and compact history exist. | Do not revive old fatigue diagnosis or “compared with last time” fitness claims from recorded counts alone. Richer comparisons need comparable evidence and consent. |

Evidence: [historical content plan](restructure-plan.md),
[exercise/feedback proposals](exercise-and-feedback-plan.md),
[feasibility study](feasibility-study.md), [Max's feedback](test-01-max.md),
[current app declarations](../form-coach-v4.11.html),
[summary contract](workout-summary-contract.md),
[profile contract](profile-duo-contract.md).

## 6. Accounts, Duo, storage and notifications

| ID | Chat item | State | Required next step |
| --- | --- | --- | --- |
| P01 | Shared weekly Duo streak; either friend can contribute | **Local foundation + disconnected prototype.** Weekly goals, completion ledger and simulated two-client reconciliation exist; user-facing synced Duo does not. | Prove one provider with two real consented accounts, pair-policy agreement and explicit invitation acceptance; integrate only after ownership/visibility/revocation tests. |
| P02 | Competitive daily Snapchat-style streak | **Superseded for the first implementation by shared weekly participation.** No daily punishment or competitive mode exists. | Retain as later optional design research, not a silently pending launch requirement. |
| P03 | Apple/Google sign-in, cloud tracking and account-linked name/style | **Account presentation only.** Disabled previews explain the destination. | Implement authenticated identity, sign-out/account switching, separately verified purchase/restore and separately consented cloud access. Never treat a local nickname, email or hidden control as identity/entitlement. |
| P04 | CloudKit storage/sharing and notifications | **Documented, not implemented.** No native container, share flow, subscriptions or sync adapter. | Select this route deliberately if it earns priority; test two Apple accounts, share-owner quota, revocation, offline recovery and physical notification behavior. |
| P05 | Google sign-in plus Drive Duo | **Drive REST adapter prototype only.** Injected tokens and mocked HTTP are not OAuth or real sharing. | Prove narrow `drive.file` partner visibility and safe per-member ownership/read-only access; settle shared-writer integrity before connecting the browser/native UI. Do not silently widen scopes. |
| P06 | Other user-owned cloud providers / iOS storage fallback | **Documented candidates, deferred proliferation.** No automatic provider failover or migration. | Prove one transport first. Connecting Google must be an explicit account/provider choice; Apple-only and Drive-only pairs do not become interoperable automatically. |
| P07 | Android and mixed iOS/Android Duo | **Feasibility documented; no Android app.** Provider-independent envelopes/date policy support future portability. | Use a common tested provider on both clients or explicitly validate a bridge. A shared file protocol does not supply Android camera/audio/UI/push or Apple-account eligibility. |
| P08 | Storage-full notice and small footprint | **Local storage-full handling implemented; cloud quota UX planned.** CloudKit 1–4 KiB/record + fixed overhead is an estimate, not measured service usage. | Measure actual provider records/overhead; identify whose quota is full, retain local work/outbox and show pending sync. Never call free allocation free forever. |
| P09 | Teach users how to maximize their cloud quota | **Guidance documented, no interactive cleanup feature.** Distinguishes device storage from cloud quota and warns against losing synced photos. | Add a brief provider-specific help page when that provider is live; don't promise a 5 GB account can hold 30 GB of photos or make deleting memories a streak requirement. |
| P10 | Notifications by email | **User-approved draft implemented. Automatic mail deferred.** `mailto:` does not confirm delivery or sync. | Keep recipient choice/Send in the mail app. Any automatic Gmail route would require separate send consent, recipient controls, duplicate/offline behavior and provider validation. |
| P11 | Instant partner alerts / scheduled reminders | **Not implemented.** Drive webhooks require a server route; foreground sync and local reminders were the conservative proposal. | Build only a truthful, tested notification route. Push is a hint to reconcile, not proof the shared week is current. Avoid provider notification abuse or shared sender secrets in clients. |
| P12 | Sync/backup and restore saved progress | **Local export implemented; import/restore and multi-device transactions open.** Existing browser stores are bounded, scoped and not cloud backups. | Define schema/migrations, device/account identity, conflict behavior and explicit restore/import consent; test stale data and quota failure. |
| P13 | Fitness/gamification profile with icons and engaging history | **Local presentation implemented, advanced gamification deferred.** Calendar, goals and dated cards exist; no automatic level, streak count, avatar upload or lifetime activity claim. | Validate engagement before adding milestones or social comparison. Missing records remain unknown. |

Evidence and dated provider research: [profile/Duo contract](profile-duo-contract.md),
[sync source](../duo/sync.mjs), [Drive adapter](../duo/drive.mjs),
[account UI record](sessions/formfinder-interface-2026-09-23.md).
External fees/quotas/policies have not been refreshed here; recheck at adoption.

## 7. Platform, business and launch

| ID | Request | Disposition | Next condition |
| --- | --- | --- | --- |
| L01 | Free desktop browser app with a domain | **Static review packaging implemented; public offer/hosting/domain open.** | Complete C02, select the useful free starter offer, validate laptop/phone use, rights/support/privacy information and authorize an HTTPS host. Serve only the emitted artifact, never the repo root. |
| L02 | Ads fund the free browser version | **Deferred recommendation.** No ad SDK/sponsor integration or revenue validation. | Validate users/conversion first. If selected, assess a limited public-guide sponsorship/ad experiment separately from camera/account surfaces and account for policy/privacy/operating costs. |
| L03 | Paid iOS/Mac App Store apps and Windows executable/store | **Planned, not built.** Swift libraries are not native products. | Finish native sessions/calibration and platform camera/audio/UI adapters, parity/device tests, packaging/signing, purchase/restore and store requirements. Windows follows evidence of demand; Android remains deferred, not cancelled. |
| L04 | Separate version/test/branch management for every platform | **Direction refined.** One source repository/shared behavioral contracts, platform adapters/build numbers/release tags; permanent divergent platform branches are not selected. | Define release manifests/CI per actual platform as it is built. Keep HTML-first authority and deliberate shared vector migrations. |
| L05 | Pay once; minimal startup/ongoing costs | **Commercial model documented and calculator implemented.** Baseline remains £4.99; testing £7.99/£9.99 willingness to pay was recommended, not a price change. | Measure contribution, support/refunds and real demand. Do not call store-fee recovery profit or assume hosting/cloud/CI is unlimited forever. |
| L06 | Secure paywall and paid account personalisation | **Not implemented.** Disabled name/style previews are disclosure, not payment security. | Choose paid-up-front native or verified non-consumable unlock/restore; isolate identity and entitlement. Basic safety/privacy/export controls stay usable. |
| L07 | Offline/PWA mobile testing/distribution | **Open.** Review artifact bundles model/runtime/audio; no service worker/install/update/offline lifecycle is implemented. | Test cold starts, storage/eviction, interruption-safe version changes and asset budgets before claiming offline/installability. Old “PWA exists today” backlog wording is superseded. |
| L08 | AI-generated summary / AI watches and coaches live | **Bounded interpretation implemented.** Browser summaries/choices are deterministic; local Swift selectors choose approved IDs. Continuous AI video judgement and free generated coaching prose are not implemented. | Keep measurement outside model authority. Actual native host integration/availability/phone quality remains open; no cloud-model pivot is selected. |
| L09 | Improve the stack: workers, native performance, modularity | **Measured browser optimizations + worker prototype implemented; production adoption deferred.** | Measure real phone cadence/latency/thermals and whole-session memory. Port lifecycle contracts together; extract source only with one editable authority and unchanged behavioral provenance. |
| L10 | About, aims, platform links, legal information and FormFinder name | **About/rename/theme implemented; launch assets/details open.** | Complete operator/support details, appropriate final terms/privacy/licence notices, name availability checks and real store URLs. About's placeholders are intentionally not fabricated links or legal sign-off. |
| L11 | Marketability, promotional footage, store copy, social invites/stories | **Strategy documented; production campaign/assets not delivered.** | After beginner evidence, use separately consented media, reviewed demos and truthful availability. Progress stories/social sharing beyond email remain future products, not outputs of current History. |

Evidence: [commercial decision](business-model-2026-09.md),
[release guide](web-release.md), [native plan](swift-port.md),
[architecture follow-up](sessions/architecture-optimisations-2026-09-14.md),
[summary contract](workout-summary-contract.md),
[local-coach contract](local-coach-contract.md).

## 8. Historical engineering items that must not disappear

These were discussed through the supplied planning documents or remain in their
open-item lists. They are **revalidation candidates**, not permission to rewrite
the engine during a documentation cleanup.

| Item | Current evidence/disposition |
| --- | --- |
| Orphaned `hollow-tuck` / `hollow-hold` and unreachable `leg-raise-bent` | Current authored plans still do not directly schedule these; historical tier/regression reachability issue is retained. Content tests alone do not make them available to a beginner. Deliberately add appropriate routes or retire content. |
| Dead Bug asymmetric reference frame | Historical **won't-fix in the single-sided representation**, not an uncaught test failure. A new full-body/video demo can resolve the teaching limitation without falsifying the old gate. |
| Dead Bug ground line / `backFlat` geometry | Current `drawRef` still anchors ground to ankle/heel/toe/wrist/knee; the historical floating tabletop line and quality-metric concern merit focused review if old demos remain. |
| Hollow Tuck folded leg | Historical rig artifact remains documented in source; no new in-app rig/gate correction is evidenced. Do not claim the separate squat avatar fixes it. |
| Tint solo coupled to `cueBudget === 1` | Still present in current evaluator source. Refactor only if it improves an actual content/behavior requirement; preserve existing outputs. |
| No-`cam` input / pre-arm internal hold accumulation | Historical boundary/invariant observations remain in the engineering log. Revalidate reachability and externally visible consequences before calling them open user bugs or fixed. |
| Explicit frame aspect / phantom off-frame skeleton | Current boundary uses actual video dimensions and observation checks; parts of older plans are superseded. Physical orientation/tilt and a visual rendering audit are still needed before claiming every phantom-joint concern resolved. |
| 2D framing cannot establish camera tilt / any-angle equivalence | Open research. No world-landmark/3D model replacement or any-angle accuracy claim; proposed error gate is not a measured result. |
| Lost behavioral suites and four frame-rate vectors | Extensive new behavioral/FPS tests exist; the missing original generator/four historical vectors have not been recovered. Do not claim all 17 lost suites were reconstructed verbatim. |
| Lost `gen-refs.mjs` FK generator | Deferred; hand-authored gate/drawing checks cover current legacy refs. Remotion has a separate authored rig, not recovery of that historical generator. |
| Long-session memory | Diagnostic export is bounded; `TelLog.rows` and evaluator score traces can still grow. Profile actual sessions before a separately disclosed retention/export policy; diagnostic limits are not a total-heap limit. |
| Root HTML source extraction | Deferred architecture work, not a completed modular app migration. Avoid a second editable content/engine copy or changing vectors just to accept a refactor. |

Evidence: [engineering log](engineering-log.md#known-open-items),
[current app](../form-coach-v4.11.html),
[architecture record](sessions/architecture-optimisations-2026-09-14.md),
[exercise/feedback plan](exercise-and-feedback-plan.md),
[project status](project-status.md).

## 9. Completed, superseded and cancelled requests

| Original chat request | Reconciled outcome |
| --- | --- |
| Session/calibration Skip, keyboard S, honest skipped debrief, version bump and committed smoke suite | Implemented at v4.11; suite is now 26 checks. Session/calibration have no native counterparts yet. Later speech cancellation and interruption contracts are also implemented. |
| Rename CLAUDE.md to AGENTS.md, retain symlink, correct six doc references | Implemented; canonical rules are portable. Historical documents may quote the old filename as history. |
| Audit stale recovery ZIP, nonexistent archive/artifacts and bad figures | Recovery ZIP removed and root tracked files documented; earlier active docs corrected. C07 handles later/current stale guidance rather than deleting historical evidence. |
| Create private formfinality repo, move work toward main, push | Initial repository/early main exist. This is not proof current development was pushed: C05 records the fresh remote gap. |
| Share with Ethan85321 / continue on friend's account | **Cancelled by owner on 22 September.** Handover tooling/notes remain useful; interrupted ZIP is not a verified export. The remote `ethan` branch still exists at `e7251ce`. No access removal or branch deletion is inferred or performed; review collaborator access explicitly if still relevant. |
| Replace all manual testing with Astra; use existing infrastructure | Existing test/reproduce/report loop extended repeatedly; human recognition/usability/sound evidence remains required. No unrelated hosted QA system was adopted. |
| Review software, fix findings, optimize architecture | Dated repairs and retained regressions are catalogued in the inventory. A previous clean review is not proof no new bugs remain; C01/C02 now have repair evidence, while intermittent audio A03 remains open. |
| Make UI modern/simple; rename FormFinder; light mode; Account; engaging goals/history; About | Implemented browser presentation. Account authentication, paid access and promotional media are still future work. |
| Keep all exercise appeal rather than pivot to a tiny coach | Broad workout app remains; assessed vs guided/Follow Along status is explicit. Narrowing measurement claims did not implement new exercises or unrestricted hidden-motion inference. |
| Daily/performance-based streak escalation and automatic difficulty | Replaced in current participation contract by chosen weekly commitments, score-independent credit and separate exercise difficulty. No automatic escalation implemented. |
| Scrap Android entirely | Later conversation explicitly explored Android/cross-platform Duo; current direction is deferred Android, not permanent cancellation. |
| Cloud LLM judgement/medical recommendations | Not selected. Current contracts keep on-device observed judgments and bounded approved-ID assistance; historical medical/physio pivot remains rejected. |

## 10. Sequence after the closure commits

1. Resolve any remaining publication/remote CI dependency recorded in C05–C06.
   Local verification and source hashes are recorded in the closure note; remote
   backup and CI require their own confirmation.
2. Use the new voice queue to review Warm's “two” and the highest-ranked source/
   playback issues. Separately isolate intermittent delivery; one fix may not
   address both problems.
3. Run the focused physical-camera/phone/beginner session with retained local
   diagnostics, independently labelled reps/holds and real listening. Cover
   Plank, Leg Raise, clothing/cropping and the now-visible recovery options.
4. Review/finish the first useful in-app demo pilot and its technique/accessibility
   gates. Keep screenshot reflection as a separate bounded feature design.
5. Expand into native/account/Duo/distribution only against their concrete provider,
   device and release conditions. Keep the content restructure/builder/progression
   items scheduled, not accidentally marked done by adjacent UI changes.

## Evidence limits and maintenance

The most recent completed pre-closure verification is the
[23 September full review](sessions/full-e2e-review-2026-09-23.md): the standard
suite passed, but 12 human-video rows remained blocked, 26 review candidates were
retained, earlier intermittent audio failures remained unresolved, and new camera
disconnect/release-build failures were reproduced. Their 24 September repairs and
new checks are documented in the closure record; older failures remain retained.

Historical `HANDOVER.md`, `backlog.md`, `restructure-plan.md`,
`exercise-and-feedback-plan.md` and `feasibility-study.md` preserve reasoning, not
current implementation authority. Statements such as “nothing is saved”, “no UI
coverage”, “all browser speech is cloud-only”, “PWA already exists”, “CloudKit is
free forever” or “score decline proves fatigue” must not be reused as current
facts. Current contracts and dated source/evidence win.

For updates, keep these IDs, change an item's status only with concrete evidence,
and link the implementation/verification record. A prototype, a documentation
decision and a passing synthetic test are three different deliverables.
