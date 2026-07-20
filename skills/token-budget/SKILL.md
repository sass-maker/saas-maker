---
name: token-budget
description: Audit and reduce Codex token/context waste. Use when asked to optimize token usage, inspect prompt bloat, review AGENTS.md/skills/memory/config/plugin cost, set up cost hygiene hooks, or compare local tooling such as RTK, Headroom, ast-grep, semgrep, repomix, and GitHub CLI usage.
---

# Token Budget

Use this skill to measure avoidable Codex context and command-output cost before
making broad changes. Prefer facts from the audit script over manual guessing.

## Quick Start

Run the audit from any workspace:

```bash
bash /Users/assistant/Desktop/fleet/fleet-ops/skills/token-budget/scripts/token-budget.sh
```

Pass a target path when auditing a specific repo:

```bash
bash /Users/assistant/Desktop/fleet/fleet-ops/skills/token-budget/scripts/token-budget.sh /path/to/repo
```

## Workflow

1. Run the script first.
2. Fix the largest always-loaded surfaces before optimizing smaller ones:
   `AGENTS.md`, memory summary, enabled plugins, skill descriptions, then
   command-output habits.
3. Prefer moving long standing instructions to on-demand docs referenced from a
   compact `AGENTS.md`.
4. Prefer scripts over repeated manual shell pipelines when a measurement is
   reused.
5. Do not edit generated memory files directly. If memory bloat is the issue,
   report the exact files and propose a compacting pass or a memory update note.

## Interpreting Results

- `HIGH` means it is likely worth shrinking or splitting before the next run.
- `MED` means review if the file is always loaded or frequently read.
- `OK` means leave it unless there is task-specific evidence.

Use `rtk` for noisy commands. Use `gh --json --jq`, `ast-grep`, and `semgrep`
to return structured, narrow results instead of dumping whole files or logs.
