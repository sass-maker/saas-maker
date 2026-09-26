---
name: recap
description: >
  Give a short product-level summary of what a worktree or branch
  accomplished — the words a customer or co-founder would use — plus the
  exact steps needed to merge and deploy it safely (env vars, migrations,
  one-off tasks, DNS/dashboard setup). Use for "what was done in this
  worktree", "what was this branch about", "remind me what we were working
  on", "summarize this worktree", "recap", "3-sentence summary", "anything I
  need to do to deploy this", or when returning to a stale worktree. Never
  read the diff aloud — answer is customer impact and shipping requirements.
---

# recap — what it gets us + what it takes to ship

The user is standing at the commit with many worktrees open across many
products. They need this one's memory back in ten seconds. Long sessions
leave walls of task lists — throw that away and say what it *means*.

## Gather (read-only — git and file reads only)

```bash
git rev-parse --show-toplevel && git branch --show-current
git status --short
git log --oneline "$BASE"..HEAD
git diff --stat "$(git merge-base HEAD "$BASE")"
```

`$BASE` = `origin/HEAD` if it resolves, else `main`, else `master`. Most work
is **uncommitted** — `git diff` against the merge base covers staged +
unstaged; `git status --short` catches untracked.

Sources of meaning, in order: planning docs/specs/issues that drove the work;
commit messages; the diff itself; code comments naming intent.

## The summary rule

Three sentences max. Every sentence must survive being read aloud to someone
who never saw the code — no file names, functions, classes, tables,
endpoints, libraries, line counts, or the words *refactor*, *implement*,
*wire up*, *migrate*, *scaffold*. Rewrite each as **who can now do what they
couldn't before**.

If the honest answer is "nobody yet" — say so. Plumbing phases are normal;
inventing customer value is the worst failure mode (the user ships off this
summary). Name the foundation, then the customer-visible thing it leads to.

## The ship list

Opposite register — exact and technical, the user copies names verbatim:

- New env vars / secrets (name, where it goes, how to get it)
- Migrations or one-off tasks to run
- Dashboard/DNS/provider setup (Cloudflare routes, Stripe webhook, etc.)
- Deploy order constraints
- What to watch after deploy

## Output

```
**What this gets us** — <3 plain sentences>
**Before it ships** — <exact checklist, or "nothing — merge and deploy">
**Watch** — <the one thing most likely to surprise>
```
