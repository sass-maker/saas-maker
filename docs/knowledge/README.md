# Knowledge

Durable learnings and failed approaches worth remembering. This directory is
for cross-cutting knowledge that does not belong to a single feature or
runbook. Code shows what; this directory captures why and what we learned.

## Subdirectories

- [`learnings/`](learnings/README.md) — novel primitives, patterns, and gotchas
  powering the stack (e.g., CF Containers, DO + Sandbox patterns, model
  choices). One file per topic.
- [`failed-approaches/`](failed-approaches/README.md) — removed or shelved approaches
  and the reason they did not ship. Read before reopening a closed direction.

## When to add here

- A non-obvious gotcha that took real time to diagnose → `learnings/`.
- A feature or architectural direction that was built, then removed or shelved
  → `failed-approaches/` with the reason and the removing commit.
- A decision record belongs in
  [`../architecture/decisions/`](../architecture/decisions/README.md), not here.
- A runbook belongs in [`../operations/runbooks/`](../operations/runbooks/README.md).
