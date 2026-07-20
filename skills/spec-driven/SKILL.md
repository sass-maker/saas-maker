---
name: spec-driven
description: Spec-driven development for any new fleet feature. Use when starting non-trivial feature work (multi-file, new surface, behavior change, cross-repo) in any fleet project. Runs OpenSpec workflow — explore → propose → apply → archive — so human and agent agree on what to build before code is written. Trigger automatically at the start of feature work; do not wait for the user to ask.
---

# spec-driven — OpenSpec workflow for new features

OpenSpec is the fleet standard for spec-driven development. When an agent
starts non-trivial feature work in any fleet project, it must run the OpenSpec
workflow **before writing feature code**. This skill is the canonical entry
point — invoke it the moment feature intent is detected.

## When to trigger (strong default)

Trigger automatically when the user's request matches **any** of:

- "build X" / "add a feature" / "implement X" / "let's add X"
- A new product surface, page, route, command, or capability
- Multi-file change that introduces new behavior (not just refactors existing)
- Cross-repo change (umbrella + sub-product, support infra + consumer)
- Anything that would warrant a `docs/plans/` entry under the old convention

**Do NOT trigger for** (skip spec, just do the work, mention the skip in handoff):

- Bug fixes (single-file or clearly scoped regression)
- Cleanup, dead-code removal, dep bumps, lint/format fixes
- Copy edits, typo fixes, doc tweaks
- Single-file polish / styling tweaks
- Test additions for existing behavior
- Config / env / CI workflow adjustments
- Anything the user explicitly says "just do it" / "quick fix" / "no spec"

When in doubt, default to running the workflow. The cost of a 5-minute
proposal is far lower than the cost of building the wrong thing.

## Pre-flight

1. **Verify OpenSpec is installed**: `openspec --version`. If missing, install
   with `npm install -g @fission-ai/openspec@latest`.
2. **Verify the project is initialized**: check for an `openspec/` directory at
   the project root. If absent, run `openspec init` and follow prompts (default
   profile is fine for most projects; expanded profile for umbrella/cross-repo
   work). Commit the `openspec/` scaffold before proceeding.
3. **Read existing specs**: `openspec list --specs` and `openspec list`. If a
   related change already exists, continue it rather than creating a new one.

## Workflow

### 1. Explore (optional, for ambiguous features)

If the feature is not yet well-defined, run `/opsx:explore` first. This is a
no-stakes thinking partner that reads the code, weighs options, and shapes a
plan. Skip straight to step 2 if the user has already scoped the feature.

### 2. Propose (mandatory)

Run `/opsx:propose <feature-name>` (kebab-case, e.g. `add-dark-mode`,
`fleet-monitor-project-filter`). This creates:

```
openspec/changes/<feature-name>/
├── proposal.md   — why we're doing this, what's changing
├── specs/        — requirements and scenarios
├── design.md     — technical approach
└── tasks.md      — implementation checklist
```

Review each artifact with the user before moving on. The proposal must answer:
- **Why** — problem, user, evidence
- **What** — scope, in vs out
- **How** — technical approach, affected surfaces, deploy impact
- **Tasks** — ordered, checkable, with verification steps

For **cross-repo features** (umbrella + sub-product, support infra + consumer),
use OpenSpec **Stores** instead of per-repo `openspec/changes/`. See
`openspec store --help` and the Stores User Guide. One store, one plan, code
lands in multiple repos.

### 3. Apply (implement)

Run `/opsx:apply` to work through `tasks.md` item by item. The agent should:

- Check off tasks in `tasks.md` as they complete
- Run the smallest relevant verification after each task (lint, typecheck,
  unit test, build)
- Surface failures, skipped checks, and uncertainty immediately
- Keep diffs reviewable — prefer multiple small commits over one large one

### 4. Archive (when done)

Once all tasks are complete and verification passes:

1. Run `/opsx:archive <feature-name>` — moves the change to
   `openspec/changes/archive/<date>-<feature-name>/` and updates main specs.
2. Update the project's `PROJECT_STATUS.md`:
   - Add the shipped feature to **Features (shipped)**
   - Move the corresponding entry from **Todo/Planned** to done
   - Update **Timeline** with the ship date
3. Close the corresponding SaaS Maker task if one exists.
4. Commit and push the archive + status update together.

## Boundary with existing fleet conventions

OpenSpec does **not** replace these — it sits alongside them:

| Artifact | Purpose | When |
|---|---|---|
| `openspec/changes/<feature>/` | Per-feature spec/design/tasks | Before + during feature work |
| `PROJECT_STATUS.md` | Durable product status | Read before broad work; update on ship |
| `docs/plans/` | Rare design artifacts that outlive the feature | Only if the design has lasting reference value |
| Symphony tasks | Operational work queue | Bug fixes, cleanup, follow-ups, deferred work |
| `AGENTS.md` | Per-project agent instructions | Stack, commands, conventions |

Rule of thumb: **OpenSpec owns the feature lifecycle** (propose → apply →
archive). **PROJECT_STATUS.md owns the product lifecycle** (what's shipped,
what's planned, what's blocked). They meet at archive time — the shipped
feature moves from OpenSpec into PROJECT_STATUS.md.

## Anti-patterns

- **Skipping propose because "it's obvious"** — if it's obvious, the proposal
  takes 5 minutes and confirms alignment. Skip only for the explicit
  exemptions above.
- **Writing feature code before `proposal.md` exists** — the proposal is the
  gate. No proposal, no feature code.
- **Letting `openspec/changes/` accumulate unarchived** — archive promptly on
  ship. Stale unarchived changes are spec debt.
- **Duplicating the proposal into `docs/plans/`** — the OpenSpec change IS the
  plan. Link to it from elsewhere if needed; don't copy.
- **Per-repo `openspec/changes/` for cross-repo features** — use Stores, or
  the two repos will drift on shared assumptions.
- **Ignoring `tasks.md` during implementation** — check off items as they
  complete. The tasks file is the source of truth for implementation progress.

## Cross-repo features (Stores)

For features that span multiple repos (e.g. aliveville + open-historia, rolepatch
+ truehire, high-signal + drank + free-ai):

1. Create or attach to a Store: `openspec store create <name>` or
   `openspec store attach <path>`.
2. Author the change in the Store, not in each repo's `openspec/changes/`.
3. Each affected repo's `openspec/` references the Store read-only.
4. Apply per-repo, but the proposal/design/tasks live once in the Store.

See `openspec store --help` and the Stores User Guide in OpenSpec docs.

## Quick reference

```bash
# Pre-flight
openspec --version                              # verify install
openspec init                                   # first time in a project
openspec list --specs                           # existing specs
openspec list                                   # existing changes

# Workflow
/opsx:explore                                   # optional, for ambiguous features
/opsx:propose <feature-name>                    # mandatory, creates change folder
/opsx:apply                                     # implement tasks.md
/opsx:archive <feature-name>                    # archive on completion

# Cross-repo
openspec store create <name>                    # one plan, multiple repos
openspec store attach <path>                    # attach existing store

# Diagnostics
openspec doctor                                 # relationship health
openspec context                                # current working context
openspec status <change-name>                   # artifact completion status
```
