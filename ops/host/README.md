# Designated Operations Host Foundation

This directory provides an inert-by-default, local-file foundation for choosing
one primary Foundry operations host. It does not install cron, launchd, systemd,
or any other service. It does not run scheduled jobs, contact SaaS Maker, invoke
Reel Pipeline, load environment files, or mutate production.

A fresh clone is disabled because no role file is checked in and every path is
required to come from an explicit machine-local role file outside the checkout.
Creating that file still does not activate the host: `promote` or `resume` must
be invoked explicitly.

## Machine-local role file

Create a JSON file outside the checkout with absolute, machine-specific paths:

```json
{
  "schemaVersion": 1,
  "enabled": true,
  "hostId": "foundry-ops-a",
  "role": "primary",
  "checkoutRoot": "/path/to/foundry-checkout",
  "jobsFile": "/path/to/foundry-checkout/ops/automation/codex-cron/jobs.tsv",
  "systemJobsFile": "/path/to/foundry-checkout/ops/automation/codex-cron/system-jobs.tsv",
  "codexRunner": "/path/to/foundry-checkout/ops/scripts/agent-bin/run-codex-cron",
  "systemRunner": "/path/to/foundry-checkout/ops/scripts/agent-bin/run-system-cron",
  "leaseFile": "/machine/local/foundry-host/primary-lease.json",
  "receiptDir": "/machine/local/foundry-host/receipts",
  "scheduleOutput": "/machine/local/foundry-host/rendered.schedule",
  "postizConfigFile": "/machine/local/foundry-host/postiz-readiness.json"
}
```

Unknown fields are rejected so credentials and arbitrary private metadata do
not accidentally enter output or receipts. The role file, lease, receipts, and
rendered schedule are all refused when their paths are inside `checkoutRoot`.
`postizConfigFile` is optional for hosts that do not own Postiz. When present,
`doctor` also requires the Postiz resource, storage, backup, health, API, and
private-reachability checks below to pass.

## Inert Postiz deployment contract

[`postiz/images.json`](postiz/images.json) pins official Postiz `v2.21.10` by
multi-architecture digest and pins every dependency tag. The
[`postiz/compose.yaml`](postiz/compose.yaml) stack is source-only intent: every
service is behind the explicit `postiz-manual` profile, published ports bind to
`127.0.0.1`, state is bind-mounted below a machine-local data root, and required
configuration comes only from external machine-local env files. No env file,
secret value, install action, or activation state is checked in.

A machine-local readiness file contains paths and private probe URLs only:

```json
{
  "schemaVersion": 1,
  "dataRoot": "/machine/local/postiz/data",
  "backupRoot": "/machine/local/postiz/backups",
  "restoreReceiptFile": "/machine/local/postiz/backups/restore-rehearsal-receipt.json",
  "healthUrl": "http://127.0.0.1:4007/",
  "apiCompatibilityUrl": "http://127.0.0.1:4007/api/public/v1/integrations",
  "privateReachabilityUrl": "http://127.0.0.1:4007/"
}
```

The doctor requires two logical CPUs, 2 GiB RAM, 20 GiB free at the data root,
all six persistent directories, a verified `v2.21.10` restore-rehearsal
receipt, a successful health response, a present/auth-gated public API route,
and private reachability. URLs with public hosts or embedded credentials are
rejected before probing. Tests inject resource, filesystem, HTTP, and
reachability probes; they do not contact a network.

The checked-in [`../../config/postiz-schedules.json`](../../config/postiz-schedules.json)
contains disabled evidence-sync and queued-distribution intent only. Neither
entry is installed or rendered by `hostctl`.

## Commands

Set a shell-local convenience variable to the absolute role-file path, then
pass it on every configured operation:

```sh
ROLE_FILE=/machine/local/foundry-host/role.json

node ops/host/hostctl.mjs doctor --role-file "$ROLE_FILE"
node ops/host/hostctl.mjs render --role-file "$ROLE_FILE"
node ops/host/hostctl.mjs dry-run --role-file "$ROLE_FILE"
node ops/host/hostctl.mjs promote --role-file "$ROLE_FILE" --ttl-seconds 900
node ops/host/hostctl.mjs status --role-file "$ROLE_FILE"
node ops/host/hostctl.mjs pause --role-file "$ROLE_FILE"
node ops/host/hostctl.mjs resume --role-file "$ROLE_FILE" --ttl-seconds 900
node ops/host/hostctl.mjs revoke --role-file "$ROLE_FILE"
```

`doctor` and `status` without `--role-file` report `activation: disabled` and do
not write anything. `dry-run` performs the full prerequisite and overlap check
without writing a lease, schedule, lock, or receipt. `render` writes schedule
intent only; an operator must inspect it and use a separately approved install
path if installation is ever desired.

`--now <ISO-8601>` is a deterministic fixture/testing override. Normal operator
commands should use the system clock.

## Performance schedule activation gate

`ops/config/performance-schedules.json` is checked-in intent, not an installed
schedule. Its top-level `schedulesActive` and every schedule's `enabled` field
must remain `false` until a separate owner-approved host cutover. Before any
activation, attach evidence that:

1. the canonical catalog and generated performance surfaces validate;
2. the API migration and API/Cockpit deploy were separately approved, applied,
   and smoke-tested;
3. `doctor`, `render`, and `dry-run` pass for the designated host;
4. the shared lease prevents a second host from running the same schedule;
5. the rendered API lane is five cold plus fifteen warm anonymous GET/HEAD
   probes, and the web lane is five desktop plus five mobile runs;
6. ingestion volume, seven-day span retention, thirteen-month rollup retention,
   rollback, and receipt delivery were reviewed; and
7. a final explicit approval identifies the host and activation timestamp.

Do not copy these definitions into another cron registry. The catalog,
generated projection, inert schedule file, and host receipt are the auditable
chain of custody.

## Lease behavior

- `promote` creates the primary lease only when none exists or the prior lease
  is unhealthy/expired. Repeating it for the same healthy holder is a no-op.
- A different host is rejected while the primary lease is active and healthy.
- `pause` makes the lease unhealthy. `resume` explicitly reacquires it, but is
  rejected if a different healthy primary has taken over.
- An expired lease permits explicit failover by another configured host.
- `revoke` is terminal for that lease record; a later activation requires a new
  explicit `promote`.

Lease writes are atomic and guarded by a local lock directory. Receipts include
only the action, timestamps, generation, lease state, counts, and a one-way host
fingerprint. They never contain configured paths, host IDs, environment values,
job names, prompts, tokens, or credentials.

## Reel Pipeline boundary

The renderer may describe existing Foundry runners, but this foundation never
executes them. In particular, it does not start Reel Pipeline daemons or invoke
render/post/metrics commands. SaaS Maker remains the marketing approval source
of truth, and Reel Pipeline's accepted-item and explicit `--execute` gates remain
unchanged.
