---
name: adversarial-code-review
description: >
  Adversarial review of a diff or PR — surface real bugs the author would
  actually want to fix, with a high bar and no theater. Use for "review this",
  "review the diff/PR/my changes", "any bugs in this?", "tear this apart",
  "code review", or proactively before opening a PR or after substantial
  changes.
---

# adversarial-code-review

Review as if you'll be paged at 3am when it breaks. Two genuine findings beat
twelve performative ones. The author knows what they wrote — find what they
missed.

## Method

1. **Intent first.** Read the PR description, commit messages, linked issue
   before the diff. Build the hypothesis "the author claims this does X" —
   the richest finding is code that doesn't match stated intent (renamed flag
   never flipped, a "fix" covering 2 of 3 cases, a refactor that quietly
   changes behavior). If intent is unrecoverable, say so and review on
   structural grounds only.
2. **Get the full surface.**

   ```bash
   MERGE_BASE=$(git merge-base origin/${TARGET_BRANCH:-main} HEAD)
   git diff $MERGE_BASE HEAD   # committed change
   git diff HEAD               # uncommitted work — review both as one
   ```

   If the target branch is ambiguous, check `git remote show origin` before
   guessing.
3. **Then read every line** — not a scan for obvious issues, the "my
   reputation depends on this" read.

## What counts as a finding — all required

1. Meaningfully impacts correctness, performance, security, or
   maintainability. Not style, not "I'd have written it differently".
2. Discrete and actionable — one thing, one fix.
3. Introduced by this change. Pre-existing bugs are out of scope unless the
   change makes them materially worse.
4. The author would fix it if shown. "Intentional" or "fine for this
   codebase" is not a finding.
5. Provable, not speculative — name the code that's actually affected.
6. Matches the rigor bar of the surrounding codebase.
7. Not merely a design choice you disagree with — read context first.

If nothing clears the bar, the correct output is **"no findings"** — a clean
review is a real outcome.

## Hunt list

Logic edges (off-by-one, inverted conditions, wrong default), async hazards
(unhandled rejection, race, missing await), state consistency (partial writes,
stale reads), boundary inputs (empty/null/unicode/huge), error paths that
swallow or misreport, security introduced by the diff (injection, missing
auth, secret in code), and behavioral regressions vs. the pre-change code.

## Report

Numbered findings: `severity · file:line · what breaks · proof · fix`. Then
one line: what you could not verify. For large diffs, delegate subsystems to a
`run_subagent` Reviewer and reconcile — findings must still meet the bar.
