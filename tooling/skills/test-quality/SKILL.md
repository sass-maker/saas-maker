---
name: test-quality
description: Identify high-value regression tests, review assertion quality, diagnose flaky or low-signal suites, and design replayable adversarial workloads. Use for concrete test-quality work, not general code cleanup, startup readiness, or release approval.
---

# Test quality

Fleet adaptation of [workersio/skills WIO](https://github.com/workersio/skills/tree/0e3950fc7b284db4f6b317e48bcb99edd2c1e3bb/plugins/wio/skills/wio).
See [upstream license](LICENSE). This compact adaptation retains behavior-first
test selection and review, without installing upstream plugins, hooks, scripts,
or custom agents. Repository-owned tests and commands remain authoritative.

## Choose the requested mode

| Mode | Outcome | Mutation boundary |
| --- | --- | --- |
| scan | Ranked test gaps and the best next investment. | Read-only. |
| test | Focused tests for the requested behavior or regression. | Test edits authorized by the request; production fixes require their own scope. |
| workload | Bounded, replayable scenarios with correctness checks. | Design-only unless implementation is requested. |
| review | KEEP, REDO, or REMOVE recommendation with evidence. | Read-only unless changes were requested; REMOVE is not permission to delete. |
| doctor | Evidence-backed suite-health findings. | Do not quarantine, disable, delete, or rewrite tests during diagnosis. |

Infer the mode from the request; ask only if the target or edit authority is
materially unclear. A review request does not authorize implementing its advice.

## Inspect, then choose

Read the nearest AGENTS.md, target behavior and implementation, relevant tests,
fixtures, runner config, and CI commands. Preserve dirty work. Bound exploration
to the requested subsystem before considering suite-wide changes.

For each candidate, state the user/operator failure, plausible fault mechanism,
existing coverage gap, and assertion that would detect it. Prioritize impact,
likelihood, uncertainty, and maintenance cost, not uncovered lines alone.
Useful boundaries include permission/tenant isolation, serialization, state
transitions, persistence, time/concurrency, retries, idempotency, stale caches,
partial failures, and workflow joins.

Choose the smallest test level that preserves the failure mechanism:

- Deterministic logic: focused unit tests; properties or metamorphic relations
  when broader inputs have a trustworthy oracle.
- Storage, permissions, serialization, or provider contracts: integration or
  contract tests with representative boundaries and disposable state.
- User-visible workflow joins: component tests or selective browser/API journeys.
- Ordering, replay, recovery, or concurrent actors: stateful scenarios with
  explicit invariants, controlled clocks, and recorded schedules/seeds.
- Weak assertions: consider bounded mutation testing only after the baseline is
  trustworthy; do not mutate the user's working copy to prove a point.

Use existing frameworks and fixtures. Do not install a new testing stack or
change production architecture merely to follow this skill. Mock unrelated
costly dependencies when useful, but not the boundary whose behavior is at risk.

## Write and falsify

Before editing, name the behavior, fault, expected failure assertion, setup,
and smallest validation command. Implement only the requested scope. Validate
the baseline and changed tests; distinguish an observed failure from a reasoned
prediction. When safely practical, show red-before/green-after on an isolated
fixture or authorized temporary worktree. Record if that demonstration was not
run. Do not equate execution coverage or a green exit with a useful oracle.

Review with one verdict:

- **KEEP:** meaningful behavior, representative setup, discriminating assertion,
  and proportionate maintenance cost.
- **REDO:** valuable target but weak oracle, unrealistic setup, nondeterminism,
  or an inappropriate test layer. Specify the correction.
- **REMOVE recommendation:** redundant or misleading test with no justified
  contract. Explain lost coverage and a replacement if needed; never delete a
  pre-existing test without authorization.

Existence checks, HTTP 200, mock call counts, and snapshots can protect real
contracts, but must be justified as that contract—not substitutes for checking
the requested behavior. Never weaken an assertion merely to turn CI green.

## Workload design

Inventory existing scenarios first. Specify actor, goal, starting state,
operations, correctness invariants, and what coverage the new scenario adds.
A seed sweep or wrapper is a runner, not new behavioral coverage by itself.

Choose relevant adversarial classes: duplicate actions, stale state, invalid
transitions, boundary sizes, interrupted operations, reordered responses,
permission edges, dependency errors, or recovery. Record bounded inputs,
seed/schedule, versions, expected outcomes, failure artifacts, and replay command.
Check invariants during meaningful transitions and at completion, not merely
whether the workload finished. Minimize a failing sequence when feasible.

Run against local/disposable test targets by default. Load tests, fault injection,
live writes, provider costs, and production monitoring require explicit scope,
limits, and authorization. A workload request does not authorize production load.

## Suite diagnosis and handoff

For doctor mode, inspect evidence of flakes, retries, shared state, timing races,
skips, broad snapshots, over-mocking, slow feedback, and CI omissions. Separate
confirmed defects from hypotheses and unavailable CI evidence. Do not hide flakes
with sleeps or retries; identify the nondeterministic input or shared resource.

Report scope, inspected evidence, selected behavior/fault, strategy, commands and
results, review verdict, and residual risk. Include replay details for workloads.
Passing tests are evidence about covered conditions, not release approval or proof
of whole-product correctness. No automatic delegation, commits, pushes, or deploys.
