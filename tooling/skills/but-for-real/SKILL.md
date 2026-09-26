---
name: but-for-real
description: >
  Force a skeptical second pass on your own work — because "it should work"
  has never once been true. Use when the user says "but for real", "are you
  sure", "double-check", "prove it", "verify that", or before declaring a
  task done on anything nontrivial.
---

# but-for-real — prove it, don't declare it

Whatever you were about to say — "I've updated the code", "this should work"
— swallow it. You don't get to declare victory. You get to prove it.

## 1. Did you even do what was asked?

Re-read the *actual words* the human typed, not your interpretation:

- Added features nobody asked for? Rip them out.
- "Improved" adjacent code that was fine? Put it back.
- Solved a different, more interesting problem? Fix it.

## 2. Read the diff like your worst enemy wrote it

`git diff` + `git status` — every line, including untracked files. For each
hunk ask: what breaks if this is wrong? Look for the change you *meant* to
make but didn't, and the change you didn't mean to make but did.

## 3. Run it — the real way

- The repo's own check command, not a faster one (`pnpm check`,
  `pnpm typecheck`, the test suite — read AGENTS.md for the actual commands).
- For UI: drive the real flow in a browser (`terminal-browser` skill or the
  project's dev server) — it renders, it behaves, zero console errors.
- For CLI/scripts: run the actual command with real inputs.
- For data/migrations: run against a copy, check the shape after.
- "Tests pass" is necessary, not sufficient — the suite can be green while
  the feature is broken. Exercise the thing the user asked for.

## 4. Check the edges you created

New code paths have edges: empty input, missing config, the first-run case,
the failure path. If you added error handling, trigger the error. If you
added a flag, run it both ways.

## 5. The report

What you verified, **how** (the command/the flow you drove), what you found
and fixed on the second pass, and what you still can't verify. If you find a
problem, fix it and restart the pass — "found it on the second look" is the
point of the skill, not an embarrassment.
