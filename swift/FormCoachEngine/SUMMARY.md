# Optional native summary component

`FormCoachSummary` is a separate library with no engine dependency. It accepts the
HTML engine's trusted `workout-summary/1` envelope; it does not implement session
accounting, evaluate movement, author advice, render UI or enable AI in the browser.
Only the engine may author envelope text. Validation is not a personal-data filter
or proof that arbitrary imported claims are truthful.

On the main actor, call `show(envelope)` and read `current` to present the template
immediately. On an explicit request, capture `current.requestID` before creating a
Task, then await `requestOnDeviceSelection(for: capturedID)` and read `current`
again. Cancelled or stale callers return before any state mutation, so a delayed
task cannot opt in a newer summary. Call `invalidate()` on debrief exit; `show` and another request
also invalidate pending work. No setting persists opt-in into the next summary.
`current` is the authority; never apply a cached snapshot after navigation.

`selectSummaryCards` retains the exact JS source/reason policy, including null as
`not-requested`. Once a provider is explicitly called, the coordinator maps every
rejected reply (including null) to `invalid-selection` in both status and reason.
`SummaryStatus` adds
native availability, timeout, cancellation and provider failure information without
exposing model prose. `modelAvailability` records a completed check explicitly;
it stays nil if that check never completes. Headline, coverage and original card strings always remain
unchanged; resolve IDs through the envelope or use `current.selectedCards`.

`decodeTrustedEngineJSON` caps input at 64 KiB before decoding. Codable and direct
initializers validate required/unknown fields, schema, distinct IDs, known/default
selections, at most 24 cards and 16 KiB of decoded text. Individual UTF-8 limits:
ID 64 bytes, movement 256, card text/tip 1,024 each, headline 4,096, coverage 2,048.
Empty catalogs require empty defaults; nonempty catalogs require one or two defaults.
Model response parsing is capped at 4 KiB. A fixed-shape wire check rejects duplicate
keys, trailing commas and other invalid JSON before decoding; it never repairs output.

The production adapter checks availability and uses only
`SystemLanguageModel.default` on iOS/macOS/visionOS 26+. Older supported platforms
retain templates. The installed Xcode SDK interface was used to verify the dynamic
schema and session APIs. Generation's schema allows only catalog IDs and one or two
array elements; independent validation still rejects duplicates or extra fields.
Only cards enter the prompt. No tools, networking, cloud fallback, feedback
attachments, transcript exports or automatic persistence are provided.

The coordinator bounds availability plus generation to 10 seconds by default,
clamped to 1 millisecond–30 seconds. Unstructured tasks and a single-resume
continuation allow timeout/cancellation to return while an uncooperative provider
is still running; request identity prevents it publishing later. Cancellation
cannot forcibly stop such a provider's resource use. Normal OS scheduling is needed
to deliver the timeout; no hard realtime guarantee is claimed.

Run deterministic checks from this directory with `swift test`. Tests read
`../../testing/summary-selection-vectors.json` directly, without a copied resource.
They cover envelope/selection rejection, template-first opt-in, all availability
fallbacks, errors, cancellation, timeout, navigation and overlapping requests.

For the nondeterministic local smoke, explicitly run:

```sh
FORM_COACH_LOCAL_MODEL_SMOKE=1 swift test --filter LocalModelSmokeTests
```

It uses the shared synthetic cards and reports availability, status, fallback, IDs
and elapsed time with the same ten-second deadline as production. Model unavailability is an explicit skipped coverage gap;
timeouts, provider errors, cancellation and invalid selections fail the smoke.
Default tests skip this smoke before
any model query. A successful smoke verifies actual local wiring and valid IDs,
not recommendation quality, latency across devices, battery or phone performance.
