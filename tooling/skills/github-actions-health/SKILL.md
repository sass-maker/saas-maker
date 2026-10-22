---
name: github-actions-health
description: Audit GitHub Actions across Fleet or selected repositories when asked to check all workflows, CI failures, stuck runs, or scheduled automation health. Reports current failures separately from old runs, PR failures, and coverage gaps.
---

# GitHub Actions health

Use live GitHub evidence. A repo's newest run alone cannot establish health:
another workflow, schedule, or PR may be failing. This is a read-only audit;
an audit request does not authorize reruns, dispatches, fixes, or releases.

## Collect

Use the authenticated GitHub plugin if it supports unfiltered, paginated
workflow and run inventory. Its commit-workflow wrapper may return only PR
runs and only one page; in that case use installed `gh` through the
[collector](scripts/collect.mjs). No token handling or new credentials.

From the Fleet root, with `SKILL` pointing at this directory:

```bash
rtk proxy node "$SKILL/scripts/collect.mjs" \
  --catalog "$PWD/saas-maker/catalog/projects.json"
```

Default Fleet scope is canonical projects whose `lifecycle.status` is `primary`
or `active`. Count projects and unique repositories separately: several products
can share one repo. Never label an account-wide historical inventory as the active
Fleet. Local folders alone do not establish active membership.

Only broaden scope when requested. Add `--include-inactive` for inactive catalog
projects and `--include-reviewed` for retained repository identities. Report these
groups separately from active projects. The catalog's `repositoryReview` can include unrelated
workspaces: explicitly exclude those with repeatable `--exclude-repo OWNER/NAME`
(for example `sarthakagrawal927/polaris-v2` belongs to Vault Wealth).
For selected repositories, use repeatable `--repo OWNER/NAME` instead of a catalog.
The catalog is private input, never an artifact to commit or upload.
Check immediate child Git remotes for uncatalogued repos when the request says
all Fleet; report these as membership questions, without adding them to the active
count or silently expanding the audit. Deduplicate
repository aliases using live `full_name` before reporting totals.

The collector needs Node 20+ and `gh`. It uses four repository workers,
paginated workflow/PR/job lists, remote files at the observed default-branch
SHA, latest runs per workflow, latest default-branch push runs, latest schedules,
open PR head runs, all queued/in-progress/waiting runs (including older runs),
and failed job/step summaries. It prints compact JSON to
stdout and progress to stderr. Exit 2 means incomplete evidence or unregistered
workflow files; inspect `errors` and `unregistered`. Exit 0 means collection
succeeded, **not** that CI passed. Never turn 403/404/rate limits into green.
If retaining output, keep it local outside Git; do not publish provider output.

Configuration extraction is conservative, not a YAML interpreter. When
`configUnknown` is true, schedules are empty despite a schedule trigger, or
filters/anchors matter, read the remote YAML before deciding. Dynamic workflows
have no source file and still count: inspect their run/job results.

## Judge each workflow

- **Current failure:** failed run at current default-branch SHA. Report the
  failed job and exact step; a successful workflow elsewhere does not erase it.
- **History/watch:** latest failure only at an older SHA, a closed PR, or an
  obsolete PR head. Inspect newer relevant runs and changed code before calling
  it a current failure. `latest` can come from any branch. Match both event and SHA.
- **Missing coverage:** no run at HEAD is not a failure by itself. Check `on`,
  branch/tag/path filters, workflow changes, skip directives and reusable callers.
  Compare changed paths before deciding whether a new run was expected. A
  path-filtered successful older run may be correct; it does not prove HEAD passed.
- **Schedule:** inspect `schedule` separately from `latest`. Compare its age with
  actual cron cadence, activation date and repository state. A newer successful
  manual run may show recovery from that failure, but cannot prove the scheduler
  is healthy. A weeks-old daily schedule still needs attention. Treat disabled
  schedules and never-run automatic workflows explicitly, using owner policy.
  Archived repos do not execute schedules: their old cron declarations and queued
  records are dormant history, not evidence that the scheduler is broken.
- **Queued/running/waiting:** report age and runner/environment evidence. A run
  taking over a day merits investigation, not automatic cancellation; runner
  availability and environment approval can be the reason. Do not call it failed
  merely because dependency installation is slow.
- **Manual/reusable:** a workflow with only `workflow_dispatch` or `workflow_call`
  may legitimately have no direct run. A failed manual release is release-pipeline
  history until a current release is attempted; report it separately from app CI.
- **Disabled/deleted:** only workflows still present on remote default branch,
  plus GitHub-generated workflows, count toward current inventory. `removed`
  entries are historical API records. Local unpublished edits do not alter remote
  health. Disabled current workflows need explanation, not automatic re-enabling.
- **PRs:** evaluate open PRs at their current head SHA; don't flag closed PRs or
  superseded heads as current. The collector queries `pull_request` runs; if a PR
  has none or uses `pull_request_target`, merge queues or required external checks,
  use `rtk proxy gh pr checks NUMBER --repo OWNER/NAME` and inspect check SHAs.
  No returned runs is unknown coverage, not success.

Keep product CI, deployment, scheduled data refresh and maintenance/bot workflows
distinct. Consult project owner policy/dossier before assigning operational
severity; retired/local-only products do not automatically need CI. Do not infer
live product availability or deployment parity from Actions success.

## Review schedule value

Health includes whether a schedule should exist. Read its jobs, consuming code
and owner policy before recommending a cadence. Check for duplicate provider crons,
event triggers already covering the same work, repeated no-op runs, superseded
repositories, and rebuilds of unchanged inputs. Distinguish publication/ingestion,
production monitoring, and housekeeping; frequency alone does not prove waste.

Recommend **stop**, **reduce**, or **keep**, with the concrete consumer or missing
value. A backup tick that only skips is a stop candidate; a freshness canary with
an explicit consumer needs that contract reviewed before removal. Prefer event
triggers for work caused by source changes and bounded fallback schedules when
they serve a real recovery need. Check recent run logs and durations. Declared
cron frequency is not actual execution count or billed spend. Do not suggest
restoring high-frequency runs merely to satisfy a freshness score.

## Investigate and report

For each current or unresolved relevant failure, open the failing step:

```bash
rtk proxy gh run view RUN_ID --repo OWNER/NAME --json jobs
rtk proxy gh run view RUN_ID --repo OWNER/NAME --log-failed
```

Inspect logs privately; quote only the short error needed to explain the cause,
never credentials or full logs. If jobs never started, inspect run annotations
and workflow syntax. State a cause as confirmed only when the evidence supports it.
Recheck failures and running runs before the final answer if the scan was long.

Lead with scope, UTC observation time, verified totals and whether evidence was
complete. List actionable failures with repository, workflow, failed step,
short cause and run link. Separate historical/watch items, schedule gaps,
PR blockers, normal in-progress runs, and unknowns. Recompute all totals from
unique repositories and workflow paths; categories must reconcile. Fixes,
reruns, issue creation and public releases require their own requested scope.

The [collector tests](scripts/collect.test.mjs) exercise remote inventory,
pagination, schedules, generated failures, missing evidence and PR head handling:
`rtk proxy node --test "$SKILL/scripts/collect.test.mjs"`.
