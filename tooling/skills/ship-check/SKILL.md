---
name: ship-check
description: >
  The closing-time gauntlet before opening a PR. Runs six passes in order —
  sweep leftover scaffolding, wire loose ends, polish copy, actually run it,
  hunt regressions in the blast radius, then adversarial review — landing safe
  fixes automatically and holding judgment calls for one confirmation at the
  end. Use as the final step before a PR, or when the user says "ship-check",
  "pre-PR", "final pass", "run the gauntlet", or "is this ready to ship". Does
  NOT open the PR or merge.
---

# ship-check — pre-PR gauntlet

After a long session the code works but the branch carries the debris of
getting there: debug probes, half-wired surfaces, AI-flavored copy, quiet
regressions. One run, one report, one confirmation.

## Safety model

- **Snapshot first.** Record `git rev-parse HEAD` and whether the tree was
  clean so the whole run is one undo away.
- **Isolated passes.** Each pass can run as a `run_subagent` (Reviewer /
  Debugger profile) so heavy greps and test runs return only a summary.
- **Auto-land only mechanical, reversible changes** (debug removal, dead
  imports, unambiguous AI tells). Anything with a real decision — deletion,
  behavior change, deliberate-looking rewrite — is held with a ready diff for
  **one confirmation gate at the end**.

## The passes — order matters

1. **sweep** — strip scaffolding first so later passes review real code:
   `console.log`/`debugger`/`TODO-FIXME` added in the diff, commented-out
   blocks, leftover test fixtures, `.only(`/`fit(`, accidental files.
2. **loose-ends** — wire what the feature should touch but didn't: routes
   added but unreachable, flags declared but unread, i18n keys missing,
   catalog/registry entries, the AGENTS.md docs the change implies.
3. **polish** — copy and tone on the final surface: strip AI tells (use the
   `humanizer` skill's tell list), fix placeholder copy, consistent casing.
4. **verify** — actually run it: the repo's own check command (`pnpm check`,
   tests, typecheck) **and a real browser/CLI drive of the exact flow changed**
   for any UI change — zero console/network errors. Proves the *new* thing
   works, not just that the suite is green.
5. **blast-radius** — work outward from the diff: grep consumers of every
   modified export/route/config, check sibling callers, hunt *existing*
   features the change might have broken. Proves the *old* stuff still works.
6. **adversarial review** — final bug pass on the clean verified diff, using
   the `adversarial-code-review` skill's bar: only findings the author would
   actually fix.

Clean → complete → polish → verify-new → protect-old → review. Never review
debug noise; never regression-hunt a diff that later passes would still
change.

## Report

One consolidated report: what auto-landed (with diff refs), what's held for
confirmation (numbered, each with the exact proposed change), pass/fail per
stage, and the single decision needed. Do not open the PR.
