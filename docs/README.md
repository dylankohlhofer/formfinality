# Form Coach — documentation

**Start here.** This index covers the root documents and narrated HTML.
Session handovers live under `sessions/`. Where any two disagree,
`project-status.md` wins — it's the only one whose numbers are recomputed rather than
remembered.

**New to the codebase?** `architecture-guide.md` is the orientation — the whole system, from
nothing, with a map of where everything lives.

**Continuing on another device?** Start with `../START-HERE.md` and
`sessions/device-handover-2026-09-16.md`; the latter records the conversation's
current next task and distinguishes completed fixes from the proposed voice audit.
The owner resumed work on their own account on 22 September; the Ethan transfer
is cancelled. Git clones use the normal test setup, not generated ZIP receipts.

The preserved `HANDOVER.md`, `restructure-plan.md`, `exercise-and-feedback-plan.md`
and `feasibility-study.md` are historical planning documents. Their proposals and
old counts do not override current contracts or imply completed implementation.

---

## If you have five minutes

**`project-status.md`** — where the project stands, what's proven, what isn't, and the one
thing standing between here and the Swift port.

## If you're about to do something

| Document | Use it when |
|---|---|
| `next-steps-guide.md` | You want the phase-by-phase task list, with exact commands |
| `../testing/README.md` | Run the automated scenario loop and review saved evidence, failures and coverage gaps |
| `beginner-test-protocol.md` | You're running the beginner test — **test 02 is the current priority** |
| `swift-port.md` | You're deciding whether to start the port, or doing it |

## If you want to understand the system

| Document | Covers |
|---|---|
| `architecture-guide.md` | **Start here if you're new.** The whole system explained from scratch — the four boxes, a tour of every file, what each group of functions is for, the principles underneath, and what the Swift port changes |
| `system-reference.md` | How it works — pipeline, content model, mechanisms, limits |
| `movement-evidence-contract.md` | Which visible evidence is required for movement, which form targets are optional, and what partial-view results do not prove |
| `workout-summary-contract.md` | Evidence-backed debriefs, optional on-device AI highlight selection and mandatory fallback/claim boundaries |
| `local-coach-contract.md` | On-demand explanations, local speech controls, authored-plan requests, opt-in memory and bounded AI review |
| `profile-duo-contract.md` | Local profiles/weekly goals, user-approved email sharing, storage estimates and the proposed CloudKit/Google Drive/Android Duo routes |
| `interface-principles.md` | The nine UI rules, and why each exists |
| `concepts-deep-dive.md` | The computing and ML fundamentals, from zero |
| `concepts-narrated.html` | The same, read aloud with sentence highlighting (~38 min) |

## If you want the reasoning behind a decision

| Document | Question it answers |
|---|---|
| `honesty-audit.md` | Which exercises do we genuinely coach, and where are we blind? |
| `sessions/code-review-fixes-2026-09-14.md` | Two review passes: view/hold reliability, camera and microphone lifecycle, complete speech, demo animation, supported plans and test provenance |
| `sessions/adversarial-review-2026-09-14.md` | Seeded controls, long sessions, five reproduced lifecycle/import defects and their authorized repair follow-up |
| `sessions/architecture-optimisations-2026-09-14.md` | Architecture assessment, measured conversion/DOM/diagnostic optimisations, regression evidence and deferred platform work |
| `sessions/audio-stall-recovery-2026-09-14.md` | Bounded local-clip recovery, original speech deadlines, real failed-request controls and stricter complete-audio checks |
| `sessions/local-coaching-2026-09-14.md` | Local speech controls, explanations, authored-plan search, opt-in memory and AI review with verification and limits |
| `sessions/workout-summaries-2026-09-14.md` | Evidence-backed debriefs, optional native AI selection, actual local-model smoke and remaining limits |
| `sessions/interface-review-2026-09-14.md` | Feature-by-feature UI audit, implemented workout controls, mobile contracts and remaining human/device checks |
| `sessions/body-clothing-tolerance-2026-09-14.md` | Larger bodies and everyday clothing: implemented evidence selection, unassessed fallback, tests and real-person validation still needed |
| `camera-placement-analysis.md` | How far back, how high — and why "3 metres" was wrong |
| `voice-kit-audit.md` | Every dialogue key, clip and splice, verified both directions |
| `engineering-log.md` | Every bug found — eight code reviews plus test 01 — and what each taught |
| `test-01-max.md` | The first blind user test: what it validated, what it broke, what changed |
| `tooling-guide.md` | Claude Code, Obsidian and agents — setup, and what's worth skipping |

## Commercial

| Document | Covers |
|---|---|
| `business-plan.md` | The £4.99 one-time model, positioning, launch |
| `competitive-landscape.md` | Who else is in this space, and the niche |
| `backlog.md` | Every idea triaged, including the ones rejected and why |

---

## The artifacts

| File | What it is |
|---|---|
| `form-coach-v4.11.html` | **The build.** Single HTML file; runtime/model and fonts still load externally, so it is not yet an offline package |
| `swift-port-kit.zip` | Swift package: 12 sources, conformance vectors |
| `conformance-vectors.json` | The executable specification — 1,896 recorded cases |

`test-recovery-kit.zip` is **gone**. Every file it carried — `verify.mjs`,
`conformance-vectors.json`, `content-v4.8.json`, `README-verify.md` and `AGENTS.md` (it
predated the rename and called it `CLAUDE.md`) — is now tracked at the repo root, so git
history is the recovery vehicle and the kit was a second copy of files that already had
one. It had drifted from all five: 1,891 vectors against 1,896, missing the `repDispatch`
section entirely, and a `verify.mjs` less than half the size of the tracked one.

Worse than stale, it was **quietly wrong**. Its `verify.mjs` still had
`process.argv[2] || "form-coach-v4.8.html"` — the default-build fallback removed from the
tracked harness precisely because a bare `node verify.mjs` graded v4.9-recorded vectors
against the v4.8 build and passed, proving nothing about the build anyone was editing.
Its `CLAUDE.md` then told you to run exactly that bare command. Restoring the kit would
have handed someone a green run and a reason to trust it, which is the one thing a
recovery kit must never do.

---

## The one-line status

**Thesis validated by a real beginner. Five defects found and fixed in v4.9. One more
beginner session** stands between here and a justified Swift port.
