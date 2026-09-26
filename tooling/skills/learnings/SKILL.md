---
name: learnings
description: >
  Final pre-commit sweep — review the session and code changes for anything
  worth codifying in AGENTS.md or README.md for the next person or agent
  working in this repo. Use before committing, or when the user says
  "learnings", "codify this", "write down what we learned", "update the agent
  docs", "anything worth documenting from this session".
---

# learnings — codify what cost us time

Did this session produce anything the next person (or agent) will regret not
having written down? The bar is **high** — most sessions produce nothing.
"Nothing worth adding" is a valid, often correct, outcome. Do not invent
findings to justify the sweep.

## Gather

In parallel:

- `git diff` (unstaged) and `git diff --cached` — what actually changed
- `git status` — new/deleted files
- `git log --oneline -20` — commit style and scope
- Read `AGENTS.md`, `CLAUDE.md`, `README.md` if present
- Re-read the session: what did the user correct you on? Where did you
  stumble? What non-obvious thing did you discover about the codebase?

## The bar — codify only if at least one holds

1. **Non-obvious gotcha** — something that cost real time: a flag with a
   surprising default, an ordering dependency, a tool that silently no-ops
   (e.g. fleet rule: never `npx biome` — bare `biome` on npm is a different
   package that exits 0 without checking).
2. **Project-local convention that isn't derivable** — where generated files
   come from, which file is canonical vs. generated, the non-obvious command
   (`pnpm exec biome` after install, not `npx`).
3. **A correction the user made** — they redirected your approach; the reason
   is worth keeping.
4. **Environment/setup reality** — missing tokens, required login shells,
   "this test fails on machines without X".

Not worth codifying: anything readable from the code itself, anything already
in AGENTS.md/README, generic advice, session narrative.

## Where it goes

- `AGENTS.md` (or `CLAUDE.md` where that's the convention) — agent-facing
  rules: commands, gotchas, boundaries.
- `README.md` — human-facing setup/architecture facts.
- Never create a new doc for one learning; append to the existing file in its
  existing style.

## Apply

Propose each candidate as a one-liner diff to the target file, grouped by
file. The user approves; then edit. Report "nothing worth codifying" plainly
when true.
