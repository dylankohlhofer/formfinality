# Architecture review and optimisations — 14 September 2026

Request: review the software architecture, identify and implement optimisations.
Baseline is the immediately preceding repaired working build, archived at
`test-results/2026-09-15T02-18-47-243Z-76360/build.html`, SHA-256
`0b6e49759815f582c3f0196e6613c0aa2b4dae7a7b87e360a416e55b2fdb70ab`.
Prior uncommitted lifecycle fixes/tests and the user's four untracked planning
documents are preserved. No commit or push was requested.

## Architectural assessment

Keep the pure judgement core, ordered effect boundary, data-driven content and
shared browser/Swift contracts. They support local operation and testable policy;
there is no evidence here that a framework, server or model replacement would
improve them. Physical file separation alone would not remove the measured work.

The production source is a large single HTML entrypoint with distinct platform
adapters, not a self-contained offline package. Pose runtime/model and fonts still
load externally; voice assets are separate. The browser uses deterministic approved
coaching; optional native selectors cannot generate new judgements or control
execution. Native session/camera/UI adapters are still unported. The isolated
worker prototype is not the production camera path.

The review covered the core/effect seam, camera conversion/scheduling, renderer,
diagnostic retention/imports, voice queue boundary, native package targets, and
test/watch/CI source provenance. The prior architecture guide materially understated
shell coverage, described obsolete fatigue inference, and had stale physical line
ranges and native-test counts. Its map now names current seams and coverage limits.

## Implemented optimisations

1. **One conversion per detected frame.** `loopBody` previously called `buildFrame`
   separately for drawing and the core. It now shares the same current-frame
   conversion. Inference cadence, `dt`, rendering order, stale-tint clearing,
   partial-view rules and paused/follow-along behavior are unchanged.
2. **Idempotent passive UI writes.** Unchanged text, HTML and visibility no longer
   produce repeated mutations. The dial caches its segment nodes per target and
   updates only changed dash attributes. Text writes invalidate cached markup;
   target changes rebuild the dial. Changed blockers and clocks update immediately,
   including sub-second hold arcs. No debounce, dropped effect, score rounding,
   postponed correction, log loss or speech coalescing is introduced.
3. **Incremental diagnostic accounting.** Ordinary appends no longer copy and
   repeatedly reduce/filter the entire retained history. Counts and byte budgets
   are maintained incrementally; retroactive flags and pressure still scan history.
   Speculative pins/eviction remain transactional. Failed protected appends pause
   visibly without changing saved entries, flags or accounting. Schema, retention,
   export limits and privacy consent are unchanged.

No judgement-core code, content, vector, Swift source, threshold, voice asset,
dependency or model changed. The extracted engine remains byte-identical to the
baseline and HEAD. These optimisations live in browser adapters absent from the
native port, so no parallel Swift implementation is needed.

## Measured evidence

| Probe | Before | After |
|---|---:|---:|
| Pose conversions for 90 detected camera frames | 180 | 90 |
| Passive DOM mutations for 30 identical HUD effect batches | 390 | 0 |
| Telemetry subtree replacements for 30 identical readings/clock | 30 | 0 |
| Segment mutations when one of eight reps advances | 8 | 1 |
| Median synthetic recorder workload, five alternating runs | 550.22 ms | 235.37 ms |

The **2.34× recorder speedup** is for 6,000 frames, 2,000 events and three flags
(200 seconds of synthetic input), on Node v24.11.1, darwin/arm64. Both versions
retain exactly 3,497 entries, drop 4,706 frames and retain 1,571,593 accounted bytes;
all ten final snapshot hashes match. It is **not** a 2.34× whole-app FPS claim or a
measurement of mobile battery, thermals, heap usage or model speed.

Primary final-build benchmark: `test-results/architecture-benchmark-8cPC6x/results.json`.
The earlier isolated `architecture-benchmark-WbooJE` measured the first renderer
checkpoint before the text-node edge-case correction below.
An earlier run (`architecture-benchmark-NclBTf`) competed with focused tests and is
retained, but is not the headline measurement. The camera probe runs the original
loop and converter with substituted drawing/inference; browser mutation probes
exercise actual DOM handlers. No person, microphone, private export or AI is used.

Reproduce locally, with no competing test browser or watcher:

```sh
node testing/architecture-benchmark.mjs <baseline.html> form-coach-v4.11.html
```

## Regression coverage

`testing/architecture.test.mjs` adds 11 default checks for conversion count/identity
and aspect, duplicate image timestamps, no-observation/paused/follow-along frames,
append complexity, retained-byte accounting, overlapping flags, and failed
append/retroactive-flag transactions. The existing diagnostic and seeded lifecycle
checks remain. Timings never gate CI; deterministic work/behavior invariants do.

Four `architecture-*` cases join the existing shell runner, protecting passive
write counts, target invalidation, continuous arcs, immediate clock/blocker changes
and text/HTML/restart cache invalidation. They pass at
`test-results/shell-focused-vk6p08/` (**19 checks**). The earlier 17-check run is
retained at `test-results/shell-focused-NkP3xu/`. Against the unchanged archived baseline,
three fail and the restart control passes at `test-results/shell-focused-ahydpp/`.
The pre-optimisation unit run also exposed four-versus-two conversions and a
no-pressure append reading 3,000 retained entries. No oracle was weakened.

## Verification

The 11 focused architecture checks and all existing focused diagnostic/adversarial
checks pass. `node verify.mjs form-coach-v4.11.html` passes all 4,127 checks without
vector changes. The final blank-video smoke passes **14/14** at
`test-results/2026-09-15T02-54-59-462Z-80424/`; this tests adapter wiring, not human
exercise recognition.

The first full run passed at `test-results/2026-09-15T02-44-48-871Z-78832/`, but final
inspection caught an optimisation edge case: comparing only `textContent` could
leave old element markup in place when a `telText` effect had identical visible
words. A strengthened browser expectation fails at `test-results/shell-focused-vrL0vT/`.
The corrected writer also checks canonical text-node shape; the full focused pack
now passes, including literal markup remaining text. The full suite was rerun
against this final build rather than treating the earlier green report as proof.

**Final `npm test` exits 1**, with six audio failures retained at
`test-results/2026-09-15T02-55-42-639Z-80560/`. All 77 infrastructure tests,
1,495 targeted tests across 19 suites and the four original harnesses pass.

| Mode | Cases passing | Assertions passing / evaluated |
|---|---:|---:|
| Engine | 55/55 | 1,307/1,307 |
| Browser | 110/110 | 942/942 |
| Interface / shell | 128/128 | 1,100/1,100 |
| Recorded-clip audio | 10/16 | 293/307 |

There are 344 report rows: 326 passing, six failed and 12 blocked real-video rows.
The failing cases are `ask-repeat-resume`, `pause-cancels-correction`, `queue-expiry`,
`tracking-loss`, `clips-warm-learning` and `clips-warm-building`. Their event/trace
evidence shows local MP3 requests not completing before playback or cancellation;
some initial teaching hits the existing 25-second watchdog. A case interrupted
during setup is not the expected audible active-set interruption. These are
**unresolved failures, not an all-green architecture change**.

All six automatic reproductions report passing checks, but that does not erase
the first captures or establish a cause. In particular, the number sample checks
queue starts and signal for clips that actually start; a passing retry does not
by itself prove both requested numbers became audible. Per-start audio checks
therefore produce fewer evaluated assertions in this failed run than in the
338-check baseline. The report retains 39 review candidates; they are not 39
distinct bugs, and no AI reviewer was invoked.

The traces distinguish the transport symptom: the failed warm/building MP3 request
has no response recorded; the earlier full passing run has a 206 response and
both clips start. No audio code, assets or harness expectations changed in this
turn. An isolated pre-optimisation comparison could not start: browser-tooling
imports stalled both inside and outside the sandbox. Those diagnostic processes
were stopped; this is **not** a successful baseline reproduction or proof that the
environment caused the audio failures. Preserve the failed run and investigate
local asset delivery/playback with paired archived builds when the tooling is
responsive. Do not lengthen deadlines, weaken audio rules or change production
playback on this evidence alone.

Current optimized HTML SHA-256:
`f8796a4f1cfa83f3ebe2687f810c2dcda0572fd638d4e40eeb9df86cd45cb502`.
The saved final-run HTML and all 62 recorded JavaScript test-source hashes match
the working files. Extraction confirms the engine is byte-identical to both the
pre-optimisation build and HEAD, and AudioBank is identical to the baseline.

Subsequent authorized work adds bounded recorded-audio recovery and stronger
complete-number checks; see [the follow-up](audio-stall-recovery-2026-09-14.md).
The failed architecture checkpoint above is retained, not relabelled as a pass.

## Next architectural work, deliberately deferred

- **Measure the production inference path on target phones.** Synchronous inference
  can compete with interaction/rendering, but this review did not measure its device
  latency. Promote the worker prototype only after CPU/GPU, freshness, interruption
  and physical-device evidence; never trade stale observations for apparent FPS.
- **Native platform shell.** Port session/calibration interruption contracts
  together, then supply owned camera, audio, local speech and screen-lock adapters.
  Keep pure decision contracts identical and compare shared cases.
- **Explicit offline asset packaging.** Runtime/model/font provisioning and native
  voice availability need a cold-start/offline test matrix before an offline claim.
  A service worker alone would not establish first-launch availability.
- **Whole-session memory profiling.** `TelLog.rows` and evaluator score traces still
  grow with session duration. The diagnostic export cap does not bound those
  collections or total heap. Profile long sessions on a phone before designing a
  separately disclosed retention/export policy; silently truncating observed logs
  would not be a behavior-preserving optimisation.
- **Source extraction when it supports the native transition.** Preserve the
  tested standalone artifact and stable source/hash boundaries. Avoid maintaining
  two editable implementations of content or silently regenerating vector oracles.
- **Evidence gaps outrank further micro-optimisation.** Physical iOS/Android
  lifecycle, beginner test 02, consented clean-camera recordings and independent
  rep/hold labels across bodies/clothing remain necessary. Synthetic conformance
  cannot solve hidden required-joint recognition.
