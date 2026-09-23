# Continue Form Coach on another device

**23 September feature update:** the local Profile & Weekly Goals and explicit
email drafts are documented in `docs/profile-duo-contract.md`. Read the newest
`docs/project-status.md` entry for verification. Cloud pairing/accounts and mobile
integrations are not implemented. The voice intelligibility audit remains open;
the older device handover is historical, not the only current task.

**22 September update:** work is continuing on the owner's account. The planned
transfer to Ethan is cancelled. For a GitHub checkout, use the
`codex/automated-test-lab` branch, read `AGENTS.md`, and follow the dependency and
test commands below. The snapshot verifier and generated receipt files apply only
to a completed export ZIP; a normal checkout does not contain those receipts.
The interrupted September export was never verified as a finished handover.

This is a working-source handover, not an account or chat-history export. Start a
new Codex chat with this folder attached as its local project. Use the account
holder's own login; no credentials, cookies or account configuration are included.

## Three steps

1. Clone the current branch, or extract a completed export ZIP into a **new folder**:

   ```sh
   git clone --branch codex/automated-test-lab https://github.com/dylankohlhofer/formfinality.git
   ```
2. Open that extracted `formfinality` folder as the local project in Codex.
3. Paste the contents of [CONTINUE-PROMPT.md](CONTINUE-PROMPT.md) into a new chat.

The agent can do the setup below for you, subject to device permissions. You do
not need to upload the entire folder into an ordinary web chat. The new chat uses
the written handover; it does not inherit this conversation's hidden state,
permissions, account history, running terminals or installed tools.

## Setup and verification

Install Node.js 22 (the CI major version) and Git if absent. In a terminal opened
inside a folder extracted from a completed export ZIP, first run:

```sh
node handover/verify-snapshot.mjs
```

This checks the packaged files against `handover/SNAPSHOT.json`. It is an
integrity check, not a digital signature or an application test. Run it **before
editing**. Missing/mismatched files must be investigated, not re-baselined.

Then install the pinned test dependencies and Chromium:

```sh
npm ci
npx playwright install chromium
npm test
```

Installation needs internet access. On Linux, Chromium may also need system
dependencies (`npx playwright install --with-deps chromium`, with approval for
system changes). Do not run competing test/watch processes. These commands need
no API key and must not upload private recordings. The current browser app still
uses external runtime/model/font assets: on-device inference is not the same as
a fully offline installation.

The four fast, original harnesses can run before dependency installation:

```sh
node verify.mjs form-coach-v4.11.html
node verify-mutations.mjs form-coach-v4.11.html
node verify-draw.mjs form-coach-v4.11.html
node verify-skip.mjs form-coach-v4.11.html
```

For subsequent work, `npm run test:watch` is the existing foreground watcher;
Ctrl+C stops it. On a supported Mac with the appropriate Swift SDK, native tests
are `swift test --package-path swift/FormCoachEngine`. Mac-only native speech and
Apple model work cannot be claimed tested on Windows/Linux. Real model smoke
tests are opt-in and are not needed for ordinary setup.

## What is preserved

- Current HTML, root conformance vectors, test sources, Swift sources, bundled
  coach audio and render tooling, including work previously uncommitted.
- The project rules in `AGENTS.md`, with `CLAUDE.md` pointing to that file.
- A current [continuation brief](docs/sessions/device-handover-2026-09-16.md).
- Original planning documents, kept unchanged; they contain historical proposals,
  not evidence that those proposals were implemented.
- A selected, synthetic-only test receipt in `handover/BASELINE.json`, plus
  `handover/TRANSFER-CHECKS.json` describing this transfer's checks.

No raw human recordings, diagnostic exports, test-result media, credentials,
`node_modules`, downloaded models, local app configuration or Git history are
included. Written source documentation still contains historical user-test notes
and references to files on the original device. Those paths are context, not
files available on this device. The obsolete `swift-port-kit.zip` is deliberately
omitted; use the current `swift/` source instead.

## Saving work and Git

The ZIP is a source snapshot, **not a Git clone**. `handover/SNAPSHOT.json` names
the original branch/commit and any working-tree changes. Keep the original ZIP
and its separately supplied SHA-256 file. GitHub alone may be older than the ZIP.

If Git history is not needed, initialize a new local repository immediately after
verifying and before changing files (`git init -b codex/device-continuation`), then
review and commit the extracted source as a baseline. Configure your own Git name
and email if Git asks. Do not force-push this unrelated history to the original
repository. Return reviewed changes as a patch or a new source snapshot, or ask
the project owner to reconcile them onto the original branch.

On macOS, the included packaging helper can make another local handover after
committing tracked changes: `node handover/package-snapshot.mjs test-results/<completed-full-run>`.
It reads committed assets from Git, checks the test checkpoint and explicitly
allowlists additional untracked documents. New untracked files require review
before export. It does not push or upload the ZIP. The integrity verifier itself
is platform-independent; the packager currently uses macOS ZIP tools.

For shared Git history, the owner must separately grant your GitHub account
access to `dylankohlhofer/formfinality` and publish the checkpoint. Do not assume
this preparation invited anyone or pushed anything. Never copy `.codex/auth.json`,
SSH keys, browser cookies or API keys between people.

If your ZIP extractor materializes `CLAUDE.md` incorrectly, read `AGENTS.md`
directly and repair the alias to that file. The verifier accepts a real symlink
or an identical full-text copy, not a file containing only `AGENTS.md`.

Official guidance: [local projects and durable instructions](https://learn.chatgpt.com/docs/projects),
[account authentication and credential protection](https://learn.chatgpt.com/docs/auth).
