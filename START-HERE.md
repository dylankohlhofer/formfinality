# Continue FormFinder

Updated 24 September 2026. Open this folder as the local project and read
[AGENTS.md](AGENTS.md) (also available through the CLAUDE.md symlink).

Start with:

- [Feature inventory](docs/feature-inventory.md): everything implemented during this collaboration.
- [Reconciled chat backlog](docs/chat-backlog-2026-09-24.md): 77 retained requests with actual status and next conditions.
- [Project status](docs/project-status.md): measured checkpoints, failures and current GitHub publication status.
- [Next steps](docs/next-steps-guide.md): current test, release and human-review sequence.
- [Continuation prompt](CONTINUE-PROMPT.md): a ready-to-paste brief for a new coding session.

The local branch is `codex/automated-test-lab`. The owner cancelled the Ethan
transfer and resumed on their own account. A local branch or old GitHub `main`
does not prove current work is backed up: check the latest closure record before
cloning. No credentials or account access should be copied between people.
The 24 September push was rejected because the current Personal Access Token
lacks `workflow` scope. Current development remains local until an appropriately
authorized credential publishes this branch and its remote SHA is confirmed.

## Dependency setup and checks

The root tools use Node 20+; CI uses Node 22. Install the pinned dependencies:

```sh
npm ci
npx playwright install chromium firefox webkit
npm test
```

On Linux, Playwright may also require system dependencies via
`npx playwright install --with-deps chromium firefox webkit`.
Run heavy browser/audio/render suites serially. Test reports and personal
recordings remain in ignored local directories. New devices must establish their
own results; this folder's written report is not proof of phone or speaker behavior.

The four fast original harnesses:

```sh
node verify.mjs form-coach-v4.11.html
node verify-mutations.mjs form-coach-v4.11.html
node verify-draw.mjs form-coach-v4.11.html
node verify-skip.mjs form-coach-v4.11.html
```

`npm run test:watch` runs the existing foreground watcher; Ctrl+C stops it.
`npm run voice:audit` screens the complete active voice library and saves a
prioritised local listening queue. It does not transcribe or approve words.

On a supported Mac with the required Swift SDK:

```sh
swift test --package-path swift/FormCoachEngine --jobs 1
```

The optional Remotion demo package uses Node 24 and a separately held licensed
character asset. Follow [its README](exercise-demos/README.md); missing model
binaries do not count as passed tests. It is not the demo currently used by workouts.

## Reviewing the app

Read [the local release guide](docs/web-release.md). It builds a fresh, allowlisted
directory with pinned runtime/model/audio and a checksummed receipt. Serve only
that directory. Never serve, tunnel or publish the repository root.

The source HTML still downloads runtime/model/fonts; the static review build
bundles those dependencies but is not an installed/offline PWA. A domain, native
store builds, connected accounts/Duo and verified payments are not implemented.

## Older exported handovers

A normal Git clone does not contain generated handover receipts. For a completed
older ZIP only, read its dated [handover record](docs/sessions/device-handover-2026-09-16.md)
and run `node handover/verify-snapshot.mjs` against the original snapshot before
editing. Missing/mismatched receipts require investigation, not re-baselining.
The interrupted Ethan export was never verified as a finished transfer.

A new chat does not inherit hidden conversation state, previous approvals,
running terminals or device test results. The inventory, backlog, rules and
dated evidence are the durable continuation record. Use each person's own login
and provider identity; no keys, cookies or authentication files belong in a handover.
