Continue development of the Form Coach project in this local folder. This is a
device handover from a previous Codex conversation, not a new product project.

First read AGENTS.md, START-HERE.md and
docs/sessions/device-handover-2026-09-16.md. Check handover/SNAPSHOT.json,
handover/BASELINE.json and handover/TRANSFER-CHECKS.json. Verify the snapshot with
node handover/verify-snapshot.mjs before editing. Then read the relevant current
sections of docs/project-status.md and testing/README.md. Older proposal documents
are historical context, not automatically authorized changes.

Help set up the dependencies and run the baseline on this device. Explain any
missing permissions or platform capabilities; don't claim device tests passed
because they passed on the previous Mac. Preserve all received work, scoring
honesty and coverage gaps. Never change expected vectors just to get green.

The next development task is a LOCAL, DEVELOPMENT-ONLY voice-library audit using
the existing testing/report infrastructure. It has been discussed but NOT built.
The user reports that the spoken number 2 can sound like "coo". This is unconfirmed
pronunciation, not a diagnosed decoder fault. Current tests prove playback and
signal, not the spoken words. There are 1,294 manifest entries and 360 number
recordings. Pilot all three voices' 2 and numbers 1–20; compare original clips
with actual app playback, use independent wrong-number/truncation controls, then
batch-screen the library and generate a prioritised listening queue. Assess the
availability of on-device transcription; no cloud fallback or automatic upload.
Report transcription as machine evidence, never human pronunciation approval.
Persist any genuine listening approvals against file hashes. Retain unverified
clips as gaps. Do not regenerate voices or incur API costs without permission.

Keep the shipped app unchanged until there is evidence of a specific defect and
an explained fix. Existing audio-stall handling is implemented and tested; do not
repeat or undo it. Do not start a framework rewrite, Swift session port, hosting
deployment or unrelated feature work. Ask before externally sharing data, making
paid calls or replacing recordings. Save new tests and implementation durably in
Git and explain the tests run, remaining gaps and next action at each handoff.
