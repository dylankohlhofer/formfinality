# Form Coach — documentation

**Start here.** Seventeen documents, each with one job. Where any two disagree,
`project-status.md` wins — it's the only one whose numbers are recomputed rather than
remembered.

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
| `form-coach-v4.9.html` | **The build.** Single file, no dependencies but the pose model CDN |
| `swift-port-kit.zip` | Swift package: 12 sources, conformance vectors |
| `conformance-vectors.json` | The executable specification — 1,891 recorded cases |
| `render-plan-v4.8.json` | Voice render plan — 1,351 clips, 210 pending |
| `voice-render-kit.zip` | The ElevenLabs render tooling |
| `test-recovery-kit.zip` | `verify.mjs` + vectors + `CLAUDE.md` — rebuilds the test safety net |

## `archive/`

Nothing here is needed, nothing is lost. Superseded builds (`archive/builds/`), the eight
individual code reviews now merged into `engineering-log.md`
(`archive/code-reviews/`), and pre-pivot specifications written when the product was still
"Ab Form Coach" (`archive/superseded-docs/`).

---

## The one-line status

**Thesis validated by a real beginner. Five defects found and fixed in v4.9. One more
beginner session** stands between here and a justified Swift port.
