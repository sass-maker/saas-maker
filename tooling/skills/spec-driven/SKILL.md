---
name: spec-driven
description: Opt-in spec workflow for large fleet features. Use only when the owner asks for spec-driven work, a spec, or a tracking issue, or when a feature is genuinely large or cross-repo. Writes the proposal, design, specs, and task checklist; creates a GitHub tracking issue only when the owner wants tracking. Small fixes and ordinary scoped changes skip it.
---

# spec-driven — GitHub Issue spec workflow for new features

Spec-driven development is an opt-in process for large feature work. Process
scales with the task: ordinary scoped work takes the light path (do it, verify
it, report it). This skill adds ceremony only when the owner wants it or the
work is genuinely broad.

When tracking is wanted, all spec content lives in one GitHub Issue: proposal,
design notes, requirements/scenarios, and the task checklist. There is no
local `openspec/` directory, no local spec files, and no `openspec` CLI.

## When to use

Use this workflow only when **one** of these holds:

- The owner asks for it: "spec this", "spec-driven", "write a proposal",
  "open a tracking issue", or similar.
- The feature is genuinely large: a new product surface or capability spanning
  many files and several work sessions, or a cross-repo change (umbrella +
  sub-product, support infra + consumer).

For a large feature the owner did not ask to spec, propose the spec in chat
(or offer to) and continue only with the owner's agreement. Do not block
scoped work on it.

**Skip it for** (just do the work):

- Bug fixes (single-file or clearly scoped regression)
- Cleanup, dead-code removal, dep bumps, lint/format fixes
- Copy edits, typo fixes, doc tweaks
- Single-file polish / styling tweaks
- Test additions for existing behavior
- Config / env / CI workflow adjustments
- Ordinary features with a clear, scoped request ("add X to this page")
- Anything the user explicitly says "just do it" / "quick fix" / "no spec"

When in doubt, skip it and do the scoped work.

## Pre-flight

1. **Check for existing tracking issues**: search the repo's GitHub Issues for
   open issues related to the feature. If one already exists, continue it
   rather than creating a new one.
2. **Read the project's `PROJECT_STATUS.md`** to understand what's shipped and
   what's in flight.

## Workflow

### 1. Explore (optional, for ambiguous features)

If the feature is not yet well-defined, explore the codebase first. Read
relevant files, weigh options, and shape a plan. Skip straight to step 2 if
the user has already scoped the feature.

### 2. Propose

Write the spec below. Share it with the owner in chat first. Create a GitHub
tracking issue (`gh issue create`) only when the owner asked for tracking or
approves creating one; issues may be public, so never create one
automatically. The spec must contain:

```
## Why
<problem, user, evidence>

## What
<scope, in vs out>

## Design
<technical approach, affected surfaces, deploy impact>
<inline Mermaid diagram if it materially clarifies 3+ components>

## Specs
### Requirement: <name>
<SHALL/SHOULD statements>
#### Scenario: <name>
- **WHEN** ...
- **THEN** ...

## Tasks
- [ ] 1. <first task>
- [ ] 2. <second task>
```

When creating the issue, use `gh issue create` with the body as a heredoc or `--body-file`. Add the
`spec` label if the repo has one. Assign the issue to the person requesting
the work.

The proposal must answer:
- **Why** — problem, user, evidence
- **What** — scope, in vs out
- **How** — technical approach, affected surfaces, deploy impact
- **Tasks** — ordered, checkable, with verification steps

Use an inline Mermaid diagram in the Design section when it materially
clarifies three or more components or actors, a multi-step interaction, state
transitions, a data/dependency flow, or a cross-repo boundary. Choose the
smallest useful diagram type (`flowchart`, `sequenceDiagram`,
`stateDiagram-v2`, or `erDiagram`). Do not add a diagram when a short
paragraph is clearer.

For **cross-repo features** (umbrella + sub-product, support infra + consumer),
open one tracking issue in the repo that owns the change. Reference it from
every affected repo's PR body (`Part of #<issue>`).

Review the spec with the owner before moving on.

### 3. Apply (implement)

Work through the spec's task checklist item by item. The agent should:

- If a tracking issue exists, check off tasks in its body as they complete
  (use `gh issue edit <N> --body ...` or the web UI)
- Run the smallest relevant verification after each task (lint, typecheck,
  unit test, build)
- Surface failures, skipped checks, and uncertainty immediately
- Keep diffs reviewable — prefer multiple small commits over one large one
- Use `Closes #<issue>` in the implementing pull request body when an issue exists

### 4. Close (when done)

Once all tasks are complete and verification passes:

1. Ensure the pull request uses `Closes #<issue>` so GitHub closes the
   tracking issue automatically on merge. Close it manually if needed.
2. Update the project's `PROJECT_STATUS.md`:
   - Add the shipped feature to **Features (shipped)**
   - Update **Timeline** with the ship date
3. Commit and push the status update.

## Boundary with existing fleet conventions

The tracking issue does **not** replace these — it sits alongside them:

| Artifact | Purpose | When |
|---|---|---|
| GitHub tracking issue | Feature spec + task checklist + operational state | Created at propose only when the owner wants tracking; checked off during apply; closed at ship |
| `PROJECT_STATUS.md` | Durable product status | Read before broad work; update on ship |
| `docs/plans/` | Rare design artifacts that outlive the feature | Only if the design has lasting reference value |
| `AGENTS.md` | Per-project agent instructions | Stack, commands, conventions |

Rule of thumb: **the tracking issue owns feature design and task state while
the change is active**. **PROJECT_STATUS.md owns durable shipped/current
product truth**. They meet at ship time: merge the linked PR, close the
tracking issue, and record only the shipped outcome in `PROJECT_STATUS.md`.

## Anti-patterns

- **Running this on small or scoped work** — heavy process on a small task
  is a failure, not diligence.
- **Creating a public GitHub issue the owner did not ask for** — tracking is
  opt-in.
- **Maintaining local spec files** — all spec content lives in the tracking
  issue. Do not create `openspec/` directories, `proposal.md`, `tasks.md`,
  `design.md`, or `specs/` folders. The tracking issue is the single source
  of truth.
- **Letting tracking issues stay open after ship** — close promptly on merge.
  Open tracking issues after the work is done are spec debt.
- **Duplicating the proposal into `docs/plans/`** — the tracking issue IS the
  plan. Link to it from elsewhere if needed; don't copy.
- **Ignoring the task checklist during implementation** — check off items in
  the issue body as they complete. The tracking issue is the source of truth
  for implementation progress.

## Quick reference

```bash
# Pre-flight
gh issue list --repo <owner/repo> --state open    # check for existing issues

# Propose
gh issue create --repo <owner/repo> \
  --title "Add dark mode" \
  --body-file spec-body.md \
  --label spec \
  --assignee @me

# Apply (check off tasks)
gh issue edit <N> --repo <owner/repo> --body-file updated-body.md

# Close (automatic via PR)
# PR body: Closes #<N>
```
