# Local web release preparation

The source remains `form-coach-v4.11.html`. `release/` assembles an ignored,
**unpublished review artifact**, not another edited engine copy. This is the
first implementation slice of the approved low-cost distribution order.

## Build and check

```sh
npm ci
npm run test:setup-video
npm run test:release
npm run build:web -- --out dist/web-review
npm run test:release:smoke -- --dir dist/web-review
node verify.mjs dist/web-review/index.html
```

The model setup is an explicit download with the existing pinned SHA-256 check.
The builder itself makes no network calls. `--out` must be a new directory;
existing artifacts are never overwritten or automatically deleted. Choose a new
name for the next build. Errors before assembly completes create no output;
a write failure may leave a partial directory, which is not a completed release.
The command has a ten-minute overall deadline and no automatic retry. The initial
three-minute limit expired twice on slow local voice-file reads, including an
unsandboxed attempt; this does not establish the OS/filesystem cause.

To review locally, serve **only the built directory**, bound to loopback, not the
repository. For example `python3 -m http.server 8767 --bind 127.0.0.1 --directory
dist/web-review` (one line). Open `http://127.0.0.1:8767`. This simple server does
not implement `_headers`; the smoke server applies them. No public deployment,
domain purchase or hosting credentials are included in these commands.

## What it includes

- The source HTML with exactly three runtime/model URL substitutions, three
  external Google Font links removed (existing system-font fallbacks), and noindex.
- Pinned MediaPipe 0.10.14 JS plus SIMD/non-SIMD WASM loaders/binaries, the verified
  version-1 lite model, voice manifest and only its allowlisted MP3 paths.
- Host-style security/cache headers, a true 404 page, and a review/licensing notice.
- `release.json`: source/output/model/input hashes, output file hashes/sizes,
  explicit unapproved-launch and not-offline-installable flags. It is provenance,
  not a cryptographic signature or permission to distribute.

Source engine, thresholds, root vectors and Swift are unchanged. Packaging does
not add accounts, ads, analytics, entitlements or a free/paid feature split.
Private recordings, diagnostics, docs, test results, `.git`, secrets, render tools,
source maps and unlisted clips are not recursively copied. Allowed paths reject
symlinks; missing clips, unexpected resource boundaries, changed model hashes and
oversized assets fail. The review budgets are 25 MiB/file and 100 MiB payload total;
the receipt is additional metadata. These are packaging limits, not a
runtime memory or user-bandwidth guarantee.

Bundled does **not** mean installed/offline. The package still needs a local/static
server on each cold load. No service worker has been added: cache/update/eviction,
quota failure and interruption-safe version transitions need their own tests first.
Do not pre-cache every persona's audio onto a phone without a measured design.

`web-release` and `economics` tests run in the existing default/watch/CI loop.
Packaging tests use explicitly fake runtime/model/clip files for failure tests.
The separate `test:release:smoke` checks the actual emitted files: original UI
onboarding/preview, local runtime loading, blank-canvas CPU inference and decoding
Warm “two” with measurable signal. It refuses external browser requests. Signal
is not intelligibility; CPU blank frames are not GPU/real-person validation.
It saves its result, console, requests and screenshot in ignored `test-results/`.
CI builds/smokes after the existing model download/video step, never deploys.

## Before public preview or sale

1. Pass the full existing suite and original harnesses on the source, verify the
   output, and review its exact receipt. Resolve or clearly retain failures; a
   packaging pass cannot erase the intermittent voice or recognition findings.
2. Review and include full MediaPipe/model licences and any required notices;
   verify original generated-voice commercial/redistribution rights and voice
   consent. The local review notice is **not** a licence-compliance sign-off.
3. Test real Safari/Edge/Chromium devices, permission errors, real GPU inference,
   speaker playback and first-session completion. No native wrapper exists yet.
4. Agree the free offer, support contact, appropriate privacy/legal disclosures
   and published limitations. Host HTTP logs see metadata despite on-device video.
5. Choose/authorize a static provider/account and HTTPS origin. Cloudflare Pages
   is the current cost candidate, not an installed dependency. Apply equivalent
   headers and true 404 behaviour on any host; don't upload the repository root.
6. Keep preview indexing off until intentional launch. Noindex is not access
   control: if a private beta is desired, use actual host access restrictions.
7. Design/test PWA storage/update handling, then add installation/offline claims.
   Later paid store builds require verified local entitlements and restore tests.

The GitHub workflow cannot run remotely until the owner credential can push the
existing workflow file (`workflow` scope or equivalent appropriate authorization).
Do not remove tests/workflows to work around that. Account budgets/quotas remain
external settings; same-ref CI cancellation only avoids superseded test work.
