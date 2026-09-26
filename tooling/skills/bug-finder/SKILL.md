---
name: bug-finder
description: >
  Sweep a whole repo — or just recent changes — for real, proven bugs and
  security vulnerabilities, then open one GitHub issue per bug with context,
  reproduction or logical proof, introducing commit, and a recommended fix.
  Ranks hard, dedupes against existing issues, caps output so the tracker gets
  a short high-signal list. Use for "find bugs", "scan the repo for bugs",
  "what's broken", "security scan", "audit the last week of commits", "review
  everything that merged since the release". Repo-scoped, not diff-scoped.
---

# bug-finder

Finding bugs is easy. Picking the ones that matter is hard. The output is a
short list — every item real, proven, and worth a maintainer's time.

Three rules:

1. **Run the code.** An unreproduced bug is a guess; guesses don't become
   issues. A tight logical proof from the code counts as proof.
2. **Select hard.** Aim for the top one percent. Ten strong issues beat fifty
   plausible ones.
3. **Never file twice.** `gh issue list` / `gh issue list --search` before
   writing; include a fingerprint line in each issue so future runs dedupe.

## Setup

- Infer the repo from `git remote get-url origin`; confirm `gh auth status`
  before doing work you can't publish.
- Read `AGENTS.md`/`CLAUDE.md`/README + manifest. Install deps, run the test
  suite once, record the baseline. Note what executes: unit tests, REPL, dev
  server, CLI. If nothing runs, say so and lower the confidence bar — file
  fewer issues.
- Build two aids while the suite runs:
  - **Spec inventory** — stated rules from `docs/`, file headers naming an
    invariant, tests pinning contracts, closed issues. A documented rule with
    no implementation is the most reliable bug shape there is.
  - **Churn ranking** — `gh pr list --state merged --limit 100 --json
    number,title,additions,deletions,mergedAt` sorted by size; a third of real
    bugs live in the two or three largest merges.

## Hunt

Highest-yield shapes: stated-rule violations, error paths that corrupt or
misreport, async races and unhandled rejections, boundary inputs (empty,
unicode, huge, concurrent), security mistakes (injection, missing authz on
object access, secrets), lifecycle leaks (listeners, timers, subscriptions),
and recently-merged large PRs.

Use `run_subagent` (Debugger profile) to hunt independent areas in parallel
when the repo is large; each returns candidates with reproduction notes.

## Verify before filing

For each candidate: reproduce it (a failing test, a script run, an exercised
endpoint) or write the tight logical proof. `git log -p -S` / `git blame` to
name the introducing commit and author. Drop anything you can't prove.

## File

One `gh issue create` per proven bug, assigned to the requester, on the owning
repo:

- **Title**: what breaks, not where.
- **Body**: context → actual vs expected → impact → the code with the bug
  marked → reproduction/proof → `introduced by <sha> (<author>)` →
  recommended fix → fingerprint line `bug-finder:<stable-hash>`.
- Cap ordinary bugs at ~10 per run; verified security findings always file.
- `--dry-run` writes the report without opening issues. Confirm before filing
  on an interactive run; skip the gate only for explicitly scheduled runs.

## Report

One summary: hunted scope, candidates found, candidates proven, issues filed
(links), and what couldn't be verified.
