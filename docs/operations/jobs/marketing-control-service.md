# Marketing Control Service

The supervised one-minute service that runs the durable marketing control
loop: daily source sync → render accepted packages → upload MP4 to
`reel-artifacts` R2 → return a proposed distribution request to the same
SaaS Maker row → claim a SHA-256 idempotency key before posting → bounded
retry on provider failures.

This is the production daemon for the source-backed marketing path (see
[`runbooks/content-package-pipeline.md`](../runbooks/content-package-pipeline.md)).

## Manage

```bash
../fleet-ops/scripts/agent-bin/marketing-control-service status
../fleet-ops/scripts/agent-bin/marketing-control-service restart
```

## Schedules and limits

- Runs every minute.
- Daily intake capped at one package per active brand.
- Pauses at 12 pending reviews (review-debt ceiling).
- Retryable provider failures use bounded exponential backoff (five attempts,
  five minutes through six hours). Permanent failures stop and notify the
  operator through the Fleet notification outbox.
- A platform ID/URL is recorded only after the provider succeeds.
- The public Fleet dashboard receives aggregate queue counts every minute,
  never package copy, source evidence, credentials, or private links.

## Where to run

Long-running daemon. **Do not run it on your active workstation** and never on
two hosts simultaneously (both would race for the same SaaS Maker rows). See
[`deployment.md`](../deployment.md) for the per-host setup (Hetzner CCX23
recommended; M1 16GB viable as a zero-cost fallback). That doc carries the
systemd units, launchd plists, and the migration playbook.

## Related jobs

- [`ig-token-refresh.md`](./ig-token-refresh.md) — daily Instagram token
  refresh.
- [`metrics-sync.md`](./metrics-sync.md) — daily metrics backfill.
