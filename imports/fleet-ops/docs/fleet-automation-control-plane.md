# Fleet automation control plane

The Fleet automation layer exists to make the 25 maintained entries observable
and safely operable without turning the 12 Ignored or Removed entries back into
obligations. It does not auto-deploy or broaden an agent's authority.

## Canonical inputs

- `fleet-ops/config/automation-registry.json` is the current executable source
  for attention scope, runtime contracts, evidence requirements, action policy,
  alert policy, and accepted exceptions.
- `fleet-ops/config/projects.json` remains the legacy deploy/domain inventory
  until the Foundry consolidation moves both concerns into one final catalog.
- `fleet-ops/automation/job-policies.json` records the bounds and safety contract
  for every versioned recurring Foundry job.

The final Foundry structure must have one catalog. Any compatibility file left
for old consumers must be generated and validated from that catalog, never
edited as an independent source of truth.

## Commands

Validate the complete 37-entry scope:

```sh
node fleet-ops/scripts/validate-automation-registry.mjs
```

Generate a local JSON and Markdown coverage report:

```sh
node fleet-ops/scripts/fleet-automation-coverage.mjs
node fleet-ops/scripts/fleet-automation-health.mjs
```

By default, evidence inboxes, last-known-good snapshots, and reports stay under
`~/Library/Application Support/Fleet Ops/automation-evidence/`. A host can use
`FLEET_AUTOMATION_EVIDENCE_DIR` and `FLEET_AUTOMATION_STATE_DIR` to place that
machine-local state elsewhere. The command exits non-zero when an unaccepted
contract is failed, stale, or blocked.

Evidence adapters emit one or more records shaped like:

```json
{
  "projectId": "high-signal",
  "contract": "jobs",
  "source": "job-receipts",
  "observedAt": "2026-07-19T12:00:00.000Z",
  "status": "pass",
  "summary": "Ingestion completed within its freshness window",
  "reference": "receipt:2026-07-19"
}
```

Allowed states are `pass`, `fail`, `stale`, `blocked`,
`accepted-exception`, and `not-applicable`. Reports sanitize credential-shaped
values and omit private bodies, prompts, email content, and unpublished content.
Unavailable providers preserve last-known-good evidence with its original time;
freshness evaluation prevents old success from remaining green indefinitely.

## Action boundary

`fleet-automation-action.mjs` is a policy and receipt gate for callers that
create tasks or PRs, retry safe work, refresh snapshots/indexing, or execute an
already approved experiment. It does not perform the external action itself.

```sh
node fleet-ops/scripts/fleet-automation-action.mjs \
  --project high-signal --action refresh-snapshot --write-receipt
```

Deploys, migrations, DNS, credentials, deletion, rate-limit changes, new public
claims, external publishing, unknown actions, and experiments without an
approval reference fail closed. A successful decision is still not a successful
action: callers must attach post-action verification to the durable receipt.

## Portable host setup

Cron registries use `@fleet`, resolved by the installer from its own checkout.
No username or checkout path is committed. On another machine:

```sh
fleet-ops/scripts/agent-bin/install-codex-cron --check
fleet-ops/scripts/agent-bin/install-codex-cron --print
```

Only after reviewing the rendered block should the operator install it. Runtime
credentials, notification targets, logs, locks, receipts, and device pairings
remain machine-local and are never copied into git.
