# Claude Code, Obsidian and agents — a practical setup

Written after the sandbox that held this project's test suites reset and deleted all 17 of
them. That event is the argument, so it's worth starting there.

---

## What just happened, and why it settles the question

Every artifact in this project has lived in one of two places: **delivered files** (which
survived) or **my ephemeral sandbox** (which did not). The build, the docs and the Swift kit
were delivered. The 282 automated checks were not — they existed only as scratch files, and
they're gone.

That is not a Claude limitation you work around with better habits. It's a structural fact
about working through a chat interface: *the work happens somewhere you don't own.*

**Claude Code inverts that.** The work happens in your repo. Nothing is ephemeral, nothing
needs downloading, and the loop closes: it can run `node verify.mjs`, read the failure, fix
the file, and run it again — without you copying output back and forth.

---

## 1 · Claude Code — the actual unlock

### Why it matters specifically for what's next

Your next milestone is the **Swift port**: seven weeks, twelve source files, and a
compile-test-fix loop. Right now that loop looks like: you run `swift test`, paste 40 lines
of output into chat, I guess at a fix, you download a file, you re-run. That's maybe ten
minutes per iteration.

With Claude Code it's one instruction — *"run swift test and fix what fails"* — and the
loop runs at machine speed against the real compiler. For a task that is *definitionally* a
long sequence of small mechanical corrections against a test suite, this is the difference
between weeks and days.

### Setup

```bash
# Native installer — no Node.js, no permissions fiddling, auto-updates
curl -fsSL https://claude.ai/install.sh | bash
claude --version && claude doctor

cd ~/Documents/formfinality
git init && git add -A && git commit -m "Form Coach v4.9"
claude
```

**Not npm.** Claude Code used to ship as an npm package; it's now a native binary and the
installer above is the recommended route. The npm path (`npm install -g
@anthropic-ai/claude-code`) hits an `EACCES` permissions error on a default macOS setup, and
the tempting fix — `sudo` — leaves root-owned files in `/usr/local/lib` that cause worse
problems later. If you ever did install via npm, migrate with `claude install` and then
`npm uninstall -g @anthropic-ai/claude-code` so the old shim doesn't shadow the new binary.

*Homebrew (`brew install --cask claude-code`) also works, but doesn't auto-update.*

**Prerequisite:** a paid Claude account. Your Pro subscription covers it.

Git first, genuinely. Claude Code edits files directly; `git diff` is how you see what
changed, and `git checkout .` is how you undo a bad session. Without version control you're
trusting an agent with no undo.

### The single highest-value file: `CLAUDE.md`

Claude Code reads `CLAUDE.md` automatically at the start of every session. Without it, a
fresh session doesn't know the anti-divergence rule, doesn't know colour means the body,
doesn't know that `arm()` has a contract — and will cheerfully violate all three.

**One is included in `test-recovery-kit.zip`.** Put it at your repo root. It encodes the
non-negotiable rules, the permanent audits, the architecture, and the traps that have
already bitten — including the five that cost real bugs.

Treat it as living: when a session makes a mistake worth not repeating, add a line.

### Suggested repo shape

```
formfinality/
├── CLAUDE.md              ← project rules, read automatically
├── form-coach-v4.9.html   ← the build
├── verify.mjs             ← run before every commit
├── conformance-vectors.json
├── content-v4.8.json
├── swift/                 ← unzip swift-port-kit here
├── voice/                 ← rendered clips + manifest
├── voice-render-kit/
└── docs/                  ← the 15 documents + archive/
```

### What to hand it first

*The old first task — "reconcile the 23 divergences" — is **done**. `verify.mjs` exits 0 on
4,071 checks, and `swift test` runs against the same JSON and passes 15/15 now that Xcode is
licensed. The safety net is restored; what follows extends it.*

1. **"Add the lost behavioural suites."** The vectors cover engine *values*; what was lost
   were scenario tests (cooldown neutrality, plan completion, regression swaps). Rebuilding
   them in the repo means they persist this time.
2. **Then the Swift port**, Week 0 onward.

*Also done: "make the demo gate check a suite". It is `refGates` in `verify.mjs` — 224 checks
asserting every demo against its own gates, mutation-tested, with its exceptions asserted
both ways so they can't rot.*

None of these gate beginner test 02. Engineering is not on the critical path — see
`project-status.md`.

---

## 2 · Obsidian — good for the thinking, not the code

### Where it genuinely helps

Your docs are already markdown with cross-references. Point Obsidian at `docs/` and it
becomes navigable: backlinks, graph view, instant search across everything.

The bigger win is **the material that doesn't exist yet**. You're about to run beginner
tests, and that produces exactly the kind of knowledge Obsidian is built for — observations,
quotes, half-formed hypotheses that only make sense in aggregate.

```
docs/
├── sessions/
│   ├── 2026-07-28 beginner test — A.md
│   └── 2026-07-29 beginner test — B.md
├── decisions/
│   └── circuit-vs-straight-sets.md
└── (the 15 reference documents)
```

Then link a session note to the backlog item it affects, and the backlog item shows you
every session that touched it. That's real leverage when you're deciding what to build after
the test — it turns "I vaguely remember someone struggled with that" into evidence.

**Add `[[wikilinks]]` opportunistically**, not as a project. A link earns its place when you
actually want to follow it.

### The honest caveat

Obsidian is unusually good at feeling like progress. Building a beautiful vault with graph
views and templates is *precisely* the kind of task that displaces the uncomfortable one —
and the uncomfortable one here is putting the app in front of a stranger.

Given the pattern this project has already shown (many rounds of "one more thing to build"
before the test), I'd suggest: **open the vault, don't design it.** Point Obsidian at the
folder, make session notes as you run the tests, and let structure emerge from use.

---

## 3 · Agents — mostly overkill, with two exceptions

Multi-agent architectures are largely a solution to team-scale problems. You are one person
with one codebase. The honest answer is that most of what's marketed as "agents" would add
coordination overhead to a project that doesn't have a coordination problem.

**Two patterns are genuinely worth it:**

**Subagents for parallel investigation.** When something is broken and you don't know where,
Claude Code can dispatch several searches at once and report back. Useful when the question
is "where does X happen" across a 196 KB file plus a Swift package.

**A review checklist as a slash command.** The permanent audits in `CLAUDE.md` are exactly
the kind of thing to codify — `/review` runs `verify.mjs`, then the static sweeps, then
reports. Same checks every time, no reliance on remembering.

**What I'd avoid:** autonomous agents making unsupervised commits, elaborate orchestration
between specialised roles, or anything that runs while you're not watching. This project's
entire quality story is that changes are checked against a specification. An agent that
commits without running `verify.mjs` erodes precisely what makes the codebase trustworthy.

---

## 4 · What I'd actually do this week

**Today, 30 minutes:** git init, drop `CLAUDE.md` in place, install Claude Code, run
`node verify.mjs` once to see where you stand.

**This week, in this order:**
1. Render the 210 pending voice clips (~£1–2.50)
2. Desktop smoke pass — 15 minutes, the shell's only test. Watch crunch, side plank **and
   glute bridge**: all three demos were re-authored and none has automated coverage
3. **Beginner test 02** — the thing everything else is waiting on
4. *Then* the engineering items above, none of which gate the test

**Then:** Swift port with Claude Code, which is where the tooling pays for itself several
times over.

---

## The honest summary

Claude Code is a genuine change in how this project can work, and the Swift port is exactly
the task it's best at. Obsidian is a modest, real improvement for thinking and session
notes. Agents are mostly not your problem yet.

But none of the three moves the needle on the thing that actually matters, which is that
nobody who didn't build this app has ever used it. Better tooling makes the next phase
faster; it doesn't make the unvalidated concept any more validated.

Set up Claude Code — it takes half an hour and pays back immediately. Then go and run the
test.
