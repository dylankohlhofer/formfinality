# Form Coach — documentation

**Start here.** Eighteen documents, each with one job. Where any two disagree,
`project-status.md` wins — it's the only one whose numbers are recomputed rather than
remembered.

**New to the codebase?** `architecture-guide.md` is the orientation — the whole system, from
nothing, with a map of where everything lives.

---

## If you have five minutes

**`project-status.md`** — where the project stands, what's proven, what isn't, and the one
thing standing between here and the Swift port.

## If you're about to do something

| Document | Use it when |
|---|---|
| `next-steps-guide.md` | You want the phase-by-phase task list, with exact commands |
| `beginner-test-protocol.md` | You're running the beginner test — **test 02 is the current priority** |
| `swift-port.md` | You're deciding whether to start the port, or doing it |

## If you want to understand the system

| Document | Covers |
|---|---|
| `architecture-guide.md` | **Start here if you're new.** The whole system explained from scratch — the four boxes, a tour of every file, what each group of functions is for, the principles underneath, and what the Swift port changes |
| `system-reference.md` | How it works — pipeline, content model, mechanisms, limits |
| `interface-principles.md` | The nine UI rules, and why each exists |
| `concepts-deep-dive.md` | The computing and ML fundamentals, from zero |
| `concepts-narrated.html` | The same, read aloud with sentence highlighting (~38 min) |

## If you want the reasoning behind a decision

| Document | Question it answers |
|---|---|
| `honesty-audit.md` | Which exercises do we genuinely coach, and where are we blind? |
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
| `form-coach-v4.11.html` | **The build.** Single file, no dependencies but the pose model CDN |
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
