---
name: astra-orchestrator
description: Orchestrate Codex work with an Astra root and bounded Luna subagents when the user explicitly asks for agents, delegation, parallel work, or independent multi-agent review, or when current project instructions require it. Skip ordinary root-only work and tasks that cannot benefit from independent workstreams.
---

# Astra–Luna orchestrator

Adapted from `donvito/codex-astra-luna-orchestrator` at commit
`f1de1b8729c8ccfb7978321b4764c58bd34c8493`. Fleet changed this file to make
delegation opt-in, capability-aware, context-bounded, and safe in dirty shared
workspaces. See [references/upstream.md](references/upstream.md).

Use Astra as the root planner, decision-maker, integrator, and final verifier.
Use Luna for bounded exploration, implementation, testing, or research when a
separate context will materially improve the result. A reviewer may use Astra
when the risk or ambiguity justifies the extra cost.

User instructions, current system/developer policy, the nearest `AGENTS.md`,
and repository permissions always outrank this skill.

## Delegation gate

Delegate only when at least one of these is true:

- the user explicitly asks for subagents, delegation, parallel agents, Astra,
  or Luna;
- current project instructions explicitly require multi-agent work;
- the skill was explicitly invoked and the task contains two or more genuinely
  independent workstreams;
- a separate read-only review or reproduction pass materially reduces risk.

Do not let automatic skill selection manufacture authorization to delegate.
Keep the work root-only when it is small, sequential, tightly coupled, blocked
on one decision, or cheaper to complete directly. Do not create agents merely
to satisfy a topology diagram.

If delegation is required but the collaboration tools are unavailable, report
that limitation and continue in the root only when higher-priority instructions
permit a fallback. Never claim that delegation occurred when it did not.

## Preflight

Before spawning:

1. Read the nearest repository instructions and inspect the working tree.
2. State a short plan before broad edits.
3. Identify workstreams that are independent now, not merely later.
4. Assign one writer per file or subsystem. Preserve user changes and avoid
   sending writers into the same dirty checkout unless ownership is explicit.
5. Check the collaboration tool's live model, concurrency, fork, and reasoning
   options. Tool documentation is authoritative over this skill.
6. Keep the root slot in the concurrency budget. Spawn no more agents than the
   work can keep useful.

Do not alter `.codex/config.toml`, global Codex settings, agent profiles, or
repository instructions unless the user explicitly asks for configuration
changes. Model topology is a runtime choice, not permission to rewrite config.

## Model and context policy

- Prefer the currently available Luna model for routine bounded subagents.
- Prefer the currently available Astra model for a high-value independent
  reviewer or unusually difficult reasoning task.
- Omit a model override when inheritance is sufficient.
- When the tool requires a bounded context fork for model overrides, use the
  smallest `fork_turns` value that carries the needed context, or `none` with a
  self-contained brief. Do not request an override on a full-history fork when
  the runtime forbids it.
- Never hard-code a model name that is absent from the live tool catalog. Use
  the closest available model and disclose the substitution if it matters.
- Increase reasoning only for a concrete uncertainty or risk. More agents and
  more reasoning both consume time and context.

## Bounded delegation contract

Every spawned task must specify:

- **Objective:** one concrete outcome.
- **Scope:** exact files, subsystem, or question when known.
- **Context:** only the facts needed to start.
- **Constraints:** permissions, files not to touch, and dirty-tree boundaries.
- **Deliverable:** evidence, edits, tests, or review findings.
- **Acceptance:** the observable condition that proves success.

Use descriptive lowercase task names with underscores. Exploration, research,
and review tasks are read-only unless their contract explicitly authorizes an
edit. An implementation agent must stop and report when it encounters an
architecture decision, broader scope, a new dependency, a schema/API change,
security-sensitive behavior, or another writer's files.

## Roles

- **Explorer:** trace files, symbols, data flow, existing patterns, and tests;
  return exact paths and uncertainty without editing.
- **Worker:** implement a decided, bounded change and run focused checks.
- **Tester:** reproduce the original behavior and verify the change
  independently; edit tests only when explicitly included in scope.
- **Researcher:** verify version-specific external facts from primary sources;
  do not edit product code.
- **Reviewer:** inspect the actual final diff for correctness, security,
  regressions, compatibility, and missing high-value tests; report findings
  rather than silently editing.

Roles describe contracts; they do not require named agent-profile files.

## Orchestration

1. Spawn independent read-only workstreams together.
2. Keep architectural decisions and user tradeoffs in the root.
3. Wait for evidence needed by dependent work.
4. Give implementation to one bounded writer per file/subsystem, or implement
   in the root when delegation would add no value.
5. Run the smallest relevant verification first.
6. Add an independent tester or reviewer only when it materially increases
   confidence.
7. Inspect the final diff and integrate findings in the root.

Prefer short evidence summaries over raw files or logs. Include relevant paths,
symbols, commands, results, and blockers so the root can verify claims without
reloading the subagent's full context.

## Failure and cancellation

If an agent fails, inspect the reason and either narrow, reassign, or finish the
bounded work in the root when policy permits. Do not repeat the same failed
approach indefinitely. If the user's request changes, cancel obsolete work and
re-plan ownership before spawning replacements.

Before finalizing, ensure every required agent is completed, failed, cancelled,
or no longer relevant. Resolve conflicting reports against repository or runtime
evidence.

## Completion receipt

Report the user outcome first. When delegation matters, briefly include:

- agents/roles used and their scope;
- files changed and who owned them;
- checks run and exact results;
- material reviewer findings and their resolution;
- unavailable validation or residual risk.

Do not claim a particular model was used unless the successful spawn record
shows that model.
