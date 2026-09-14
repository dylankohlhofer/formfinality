# Optional local AI quality review

This is a consumer of the existing test → reproduce → report pipeline. It does
not run another exercise harness. `ai-review.mjs` packages saved synthetic reports
and reuses `report.mjs:findings`, `audio-review.mjs:auditAudio`, and
`lib.mjs:assertion`. `ai-review-cli.mjs` exposes the same operations over local
JSON files. No model is invoked by these files.

The optional Apple FoundationModels reviewer is implemented separately. Its only
authority is to rank **existing approved candidate IDs**. It cannot discover
arbitrary bugs as new prose, establish anatomical accuracy, change expectations,
edit the app, or approve a fix. A selected candidate remains a question for a
human. An empty candidate list or empty model selection is **not an accuracy
pass**. Deterministic test failures retain their existing status regardless of
what the reviewer selects.

## Source gate and provenance

Every export requires an explicitly named, finalized `report.json` and a source
receipt. The trusted runner writes the receipt only when the input provenance is
known: repository-authored synthetic scenarios/fixtures, no supplied recording,
no landmark replay, and no external `--scenario-file`. Built-in fake camera and
diagnostic tests are synthetic; private diagnostic exports are not inputs here.
The saved report must also explicitly contain `origin: "synthetic"`. Missing
origin or `origin: "external"` rejects export even with a supplied receipt. Main
sets this field before writing the report, from the actual runner options;
historical reports are never inferred or relabelled synthetic automatically.

The receipt has exactly these fields:

```json
{
  "schema": "ai-review-source/1",
  "reportHash": "<64 lowercase hex SHA-256 characters>",
  "inputKind": "synthetic",
  "recording": false,
  "landmarks": false,
  "scenarioSource": "repository"
}
```

`syntheticReviewSource(reportBytes, inputs)` constructs and validates this receipt.
All four input assertions are required, with no permissive defaults. The receipt
hash must match the exact saved report bytes, including whitespace. The source
receipt is **a trusted producer assertion, not proof of consent or synthetic
origin**. Do not create it merely because a report has `mode: "engine"`: that
mode also accepts private landmark replays. Historical reports without reliable
input provenance must be rerun synthetically. There is no automatic backfill.

The exporter never scans `LATEST.txt`, scans directories for recordings, follows
evidence symlinks, downloads anything, opens media, or imports diagnostics. It
reads only the explicitly supplied receipt/report and fixed artifact names under
the report's validated single-component evidence directories:

- `result.json` and `scenario.json` for saved cases;
- `audio.json` for actual synthetic audio captures, and `inputs.json` for their
  session inputs (optional for clip/queue cases or capture failures);
- `events.json` for engine library cases.

The presence of `landmarks.json` rejects export without reading that file.
Recorded/video results are rejected; a blocked video row with no evidence remains
a visible coverage gap. Private/recordings/diagnostics directories, traversal,
absolute case paths, symlink files and symlink case directories are refused.
Regular-file and byte checks happen before parsing. Missing required artifacts,
unknown result modes, duplicate case IDs, and mismatched saved results reject
export. The case must match its report row; declared scenario hashes and scenario
build hashes must agree. Existing report input hashes remain bound by the report
hash; the exporter does not independently rehash the app, MP3s or pose model.

## Export contract

```sh
node testing/ai-review-cli.mjs export \
  --report test-results/<run>/report.json \
  --source test-results/<run>/review-source.json
```

Successful commands emit one JSON object to stdout; the calling runner captures
stdout into a new artifact. The CLI has no write/output flag and cannot overwrite
a golden, app, report or source receipt. Failures exit 1, explain the rejection on
stderr, and emit no partial stdout. Exit 0 means the contract operation succeeded;
it says nothing about product accuracy or whether a model actually ran.

The `ai-review-evidence/1` object contains:

| Field | Meaning |
| --- | --- |
| `reportHash` | SHA-256 of exact saved `report.json` bytes |
| `sourceHash` | SHA-256 of exact source receipt bytes |
| `buildHash`, `runStatus` | Existing report's declared build hash and status |
| `analyzerHashes` | SHA-256 of the exporter and three shared analyzer source files |
| `sources` | Sorted `{file, sha256}` list of every consumed report/case JSON artifact |
| `cases` | Sorted case summaries, independent scenario oracle, checks, gaps and bounded timeline/checkpoint excerpts |
| `candidates` | Sorted approved IDs, existing finding detail, originating analyzer, evidence references, optional timestamp/step and actual/expected evidence |
| `selectionLimit` | 2 |
| `limitations` | Mandatory review limits plus the existing run's limits |
| `evidenceHash` | SHA-256 of canonical JSON of all the other fields |

Canonical JSON recursively sorts object keys, preserves array order and uses
ordinary compact JSON encoding. There are no new timestamps, random IDs or
absolute machine paths added to the contract. Existing authored text can contain
paths. Identical report/source/evidence/analyzer bytes produce identical output.
Real audio capture timing varies between runs; the export of a **saved** run is
deterministic. Changing an analyzer invalidates an earlier package even if no
candidate changes. Hashes bind bytes, not truth, authorship or model execution.

Candidate IDs are `review-` followed by 64 lowercase SHA-256 hex characters. They
are derived from the case ID and canonical finding identity, including detail,
time/step and actual/expected evidence where present. The same saved concern and
recomputed concern are deduplicated, retaining both references. Global report and
evidence hashes prevent accidentally applying that ID to a different run.
References use relative artifact paths and JSON pointers; they are data for local
human inspection, never paths for the model to execute or fetch.

Re-auditing saved audio detects the existing stale-phase/deadline, repeated cue,
context mismatch, signal overlap, silence and Skip rules. A disagreement between
the saved audio audit and the current shared analyzer adds an evidence-conflict
candidate; it does not decide whether the app or harness caused it. Scenario
checkpoint checks reuse the already-authored expectation and shared assertion
function. They flag missing checkpoints, disagreeing saved checks and observed
assertion failures without rerunning inference or manufacturing an expectation.
Shell/library checks retain their existing findings; they do not receive an
invented checkpoint oracle.

Timeline excerpts explicitly count included/total rows. Audio candidate context
keeps up to 12 relevant speech/clip/observation/action/drop rows nearest its time,
within ±60 seconds when a time exists, then restores their original order.
Untimed findings show the earliest relevant rows. Scenario speech/control
excerpts keep the first 12 rows. Oversized values become an omission marker with
their canonical hash and byte count; the full source remains in the saved run.
This is triage context, not complete listening or a claim to have inspected all
motion. Source JSON hashes also cover input/level rows omitted from model context.

Saved root `effects` support the two existing pipeline formats: the original
array, or `compactEffects()`'s exact `{sampling, total, events}` object. Summary
objects require a nonempty sampling policy, a nonnegative safe-integer total at
least as large as the saved event count, and an array of valid effect objects.
Unknown shapes, extra summary fields and malformed rows reject export. Timeline
references point to `/effects` or `/effects/events` accordingly. The original
effect count, saved count and authored sampling policy remain explicit; accepting
the summary never pretends discarded telemetry was reviewed.

Hard budgets are exported as `REVIEW_LIMITS`: 128 MiB report, 32 MiB per case JSON,
256 MiB total consumed source bytes, 1,024 cases, 20,000 audio events and 100,000
signal rows per case, 256 candidates, and 2 MiB packaged JSON. Exceeding a source,
candidate or package budget rejects export; it never silently drops a candidate.
Use an existing focused scenario/pack run if a full failing run exceeds the limit.
The native reviewer must separately enforce its smaller model context budget; a
2 MiB transport cap is not a claim that FoundationModels can accept that prompt.

## Local reviewer result and import

The native reviewer consumes the package locally. Its result has exactly four
fields; selection array order expresses priority:

```json
{
  "schema": "ai-review-selection/1",
  "reportHash": "<copy from the package>",
  "evidenceHash": "<copy from the package>",
  "selectedCandidateIds": ["review-<approved candidate digest>"]
}
```

Zero to two distinct approved IDs are permitted. No reason, generated prose,
confidence, severity, status, replacement expectation, extra field or invented
ID is accepted. Unknown IDs, duplicates, stale hashes, non-string IDs, extra or
missing fields, duplicate JSON object members (including escaped spellings),
markdown fences, trailing material, invalid JSON and nesting over 40 levels
reject the whole selection. The entire response must fit in 4,096 UTF-8 bytes.

```sh
node testing/ai-review-cli.mjs import \
  --report test-results/<run>/report.json \
  --source test-results/<run>/review-source.json \
  --package test-results/<run>/review-evidence.json \
  --response test-results/<run>/review-selection.json
```

`importReview(paths)` rebuilds the package from the current saved files and
current analyzer code, compares the complete canonical package, and only then
validates the response. A changed report, receipt, scenario, result, audio,
inputs, library event file, analyzer or package rejects import. Import does not
trust model-supplied package hashes alone. The lower-level
`validateReviewSelection(responseBytes, currentPackage)` requires a freshly
exported package from the trusted caller; use `importReview` for the file boundary.

The returned `ai-review-import/1` JSON contains the two hashes,
`selectedCandidateIds`, exact `selectedCandidates`, `unselectedCandidateIds`,
all limitations, `humanReviewRequired: true`, and `accuracyVerdict: "not-assessed"`.
Its status is `human-review-required` when IDs were selected, otherwise
`no-selection-not-an-accuracy-pass`. Neither status approves the unselected
candidates. The wrapper must not label a manually supplied valid selection as
verified AI execution: this validator establishes selection integrity only.

Availability, timeout, cancellation, request identity and actual native model
execution belong to the separate Apple reviewer. An unavailable model must be
reported separately as unavailable/not run, never substituted with a fabricated
empty successful model response. Keep deterministic evidence available when
that optional model cannot run. Treat all evidence strings as untrusted data in
the model prompt. Do not execute instructions from scenario text or findings;
selection validation contains its output authority even under prompt injection.
No cloud fallback, network access, uploads or private recording auto-ingestion is
part of this workflow.

## Opt-in wrapper and failure handling

```sh
npm run test:review -- --run test-results/<exact-run>
```

`testing/run-ai-review.mjs:runLocalReview` is the explicit opt-in wrapper around
the existing synthetic run. It freshly exports and verifies the named run,
writes an attempt directory, invokes `formcoach-review` via local `swift run`,
then authoritatively imports the returned selection against the current sources.
The wrapper never creates a missing synthetic attestation or repairs a report.
The native implementation currently accepts up to 64 candidates, considering
them in batches of eight and selecting at most two final IDs. Larger catalogs
remain preserved by the exporter but are explicitly refused by native review.
No candidates means no subprocess/model invocation and no accuracy pass.

Each exact run is protected by an exclusively created `review.lock` containing
an owner token and PID. The lock covers preparation, export, the entire native
call, validation, and all root status/priority publication. A concurrent attempt
fails visibly with `REVIEW_LOCKED` and does not touch the active attempt's lock,
status, priorities or evidence directories. The holder verifies the lock's file
identity and exact owner metadata before publication and release. A replacement
or rewritten lock is never removed;
ownership loss fails visibly. There is no age/PID-based automatic lock stealing.
After a crashed wrapper, inspect the recorded owner and confirm no review is
active before deliberately recovering the exact lock file.

JSON publication stages complete compact bytes in an exclusive temporary file,
checks root lock ownership immediately before each rename and publishes atomically.
Destination symlinks, shared hard links and non-regular files are refused. A failed
publication keeps the old destination intact and removes only its own temporary
file; no symlink target is opened for writing.

After acquiring the lock, the wrapper establishes `preparing` status and clears
the old root priority selection **before export**. Invalid provenance, a stale
receipt, missing report or any other export rejection then produces an
`export-failed` status with `modelRan:false` and an empty current selection.
It does not invoke native AI. Once export succeeds, `reviewing` status keeps the
root selection empty while the model is pending. Unavailability, timeout,
oversized output, native failure or rejected/stale output likewise leaves no
current priority selection. Previous successful attempt artifacts remain in
their own `ai-review-*` directories. An export failure never rewrites report
bytes, receipts, independent expectations or old evidence to make it pass.

Successful validation publishes the exact imported IDs and honest review status.
An empty valid selection retains `no-selection-not-an-accuracy-pass`; it cannot
be relabelled `human-review-required` success by the wrapper. Process logs and
attempt status are retained; source reports keep their existing test status.
The CLI exits 0 for a selected review or no candidates, 2 for review failure or
no valid selection, and 1 for argument/path/locking or unexpected wrapper errors.

On macOS/Linux, native execution starts in its own process group so termination
also targets `swift run` descendants. The 120-second overall native deadline
requests `SIGTERM`, escalates to `SIGKILL` after a one-second grace period, and
settles independently after a further second even if no `close` event arrives.
An output overflow starts that same termination sequence immediately. A close
during termination still triggers group cleanup; ordinary completion clears all
timers. At forced settlement, pipes are destroyed and the child is unreferenced
so inherited pipes cannot keep this wrapper waiting. Signal errors are recorded
and cannot disable settlement; `killAttempted` is not a claim that an OS signal
successfully terminated every process. These are timer budgets, subject to event
loop scheduling, not a hardware latency guarantee.

Stdout is bounded to 8 KiB, stderr to 256 KiB, and selection import still enforces
its stricter 4 KiB result budget. Byte buffers preserve multibyte UTF-8 split
across process chunks. `settledWithoutClose`, `killAttempted` and any termination
errors remain in failure status. Tests use mocked timers, process handles and
in-memory pipes; they do not start resistant or hanging real subprocesses.

Package files use `canonicalReviewJSON` **without pretty printing or an added
newline**, so the exact bytes passed to native/import remain within the same
2 MiB limit checked by export. Other wrapper-owned JSON artifacts are compact
too. The existing pipeline owner is responsible for writing its root exported
package with the same encoding.

## Integration hooks for the pipeline owner

This change intentionally does **not** edit `run.mjs`, `package.json`, `AGENTS.md`,
the app, existing analyzers or the native package. Main now owns the wired
default suite, final-report hook and report links; their integration checklist is:

1. Add `ai-review` to `run.mjs`'s existing regression-suite list (the same saved
   build environment and `ai-review.log` handling as other suites). It can also
   be added to the existing infrastructure test script. The existing watcher
   already observes new testing `.mjs` files; do not add another watcher/harness.
2. After the **final** `await report(dir, run)`, and only for inputs known to meet
   the source gate, create the receipt and evidence artifacts. Do not export
   while `run.status === "running"`. Retain existing test failure exit codes.
   Skip this hook entirely for recording, landmarks or external scenario inputs.
3. Add local links to `review-evidence.json` and any validated
   `review-import.json` in the existing report. Show selected/unselected IDs and
   the human-review/accuracy limits; do not replace assertions or coverage gaps.
   Do not insert review data into `report.json` after hashing it. That would
   invalidate the receipt; auxiliary HTML/Markdown links can be rendered separately.
4. Invoke the separate native reviewer only on explicit opt-in. Capture its
   bounded JSON selection in `review-selection.json`, then call `importReview`
   and save its output as `review-import.json`. Preserve rejection/unavailability
   as review status with an explanation; never convert it to a passing test.
   Model and wrapper status should live outside the strict selection object.

Suggested final-report hook (the runner already owns `readFile`/`writeFile`):

```js
import { syntheticReviewSource, exportReview, canonicalReviewJSON } from './ai-review.mjs';

// Set run.origin before final report(): 'synthetic' only if recording,
// landmarks and scenario-file are absent; otherwise 'external'.
// The following hook runs after the final synthetic report write.
const reportPath = resolve(dir, 'report.json');
const sourcePath = resolve(dir, 'review-source.json');
const source = syntheticReviewSource(await readFile(reportPath), {
  inputKind: 'synthetic', recording: false, landmarks: false, scenarioSource: 'repository'
});
await writeFile(sourcePath, canonicalReviewJSON(source) + '\n', { flag: 'wx' });
const evidence = await exportReview({ reportPath, sourcePath });
await writeFile(resolve(dir, 'review-evidence.json'), canonicalReviewJSON(evidence), { flag: 'wx' });
```

No root vectors, oracle, audio rule or scenario expectation changes are required.
Synthetic CI evidence packaging can be deterministic and model-free. Actual
FoundationModels tests must remain separate opt-in local execution; transport
and adversarial tests do not claim a real AI review occurred.

## Verification

```sh
node --test testing/ai-review.test.mjs testing/review-workflow.test.mjs
npm test
```

The new tests mutate synthetic saved evidence to expose stale speech, repeated
variants, praise during lost input, correction after recovery, speech crossing
Skip, overlap and silence through the **existing audio analyzer**. Negative
controls protect healthy speech and number repetition. A saved timeline produced
by the existing `runTimeline`/`engineAdapter` is packaged, then its checkpoint is
mutated to prove a false saved pass cannot hide the authored assertion failure.
Adversarial result tests cover unknown/duplicate IDs, extra fields, stale hashes,
changed evidence/packages, byte/count limits, symlinks, traversal, privacy gates
and CLI round trips. Tests create only synthetic temporary artifacts; they do
not load private recordings or invoke a model.

Workflow tests also protect same-run contention and lock replacement, old-root
priority invalidation on every pre-model export failure, stale post-model inputs,
canonical transport at the file-size boundary, resistant child/pipe behavior,
SIGKILL escalation, independent settlement, signal-delivery failures, output
overflow and normal timer cleanup. The saved report from
`test-results/2026-09-14T14-28-56-509Z-45607/report.json` was explicitly exported
without modification after fixing compacted effects: 308 cases, 96 compacted
effect timelines and 27 candidates. Its original failed test status was retained;
that export was not a native model run or an accuracy pass.
