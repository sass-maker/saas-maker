---
name: fleet-status
description: Read all 25 PROJECT_STATUS.md files and produce a fleet-wide status summary — what shipped recently, what's planned, what's blocked. Use when the user asks "what's the fleet status?", "what's everyone working on?", "give me a fleet summary", or wants a snapshot of all projects at once.
---

# fleet-status — fleet-wide status sync

Reads every active project's `PROJECT_STATUS.md` and produces a compact
summary of the fleet's current state: recent ships, active work, blockers,
and deferred items.

## When to invoke

- "What's the fleet status?"
- "What's everyone working on?"
- "Give me a fleet summary"
- "What shipped recently?"
- "What's blocked?"

## How to invoke

Read each project's `PROJECT_STATUS.md` (first 40 lines is enough for the
thesis + timeline + scope). The 25 active projects are listed in the fleet
README at `~/Desktop/fleet/README.md`.

For each project, extract:
- **Last updated** date
- **Thesis** (one line)
- **Latest timeline entry** (most recent ship)
- **Active scope** (what's IN scope)
- **Blockers** (if any, from Todo/Planned/Deferred/Blocked section)

## Output format

```
## Fleet Status — YYYY-MM-DD

### Recently shipped (last 7 days)
- project-name: what shipped
- ...

### Active work
- project-name: current focus
- ...

### Blocked / deferred
- project-name: what's blocked and why
- ...

### Stale (PROJECT_STATUS.md not updated in 30+ days)
- project-name: last updated YYYY-MM-DD
```

## Notes

- Don't fabricate status — if a PROJECT_STATUS.md is missing or unreadable,
  report that explicitly
- The "stale" check helps surface projects that may need a status refresh
- This is a read-only skill; it doesn't modify any files
