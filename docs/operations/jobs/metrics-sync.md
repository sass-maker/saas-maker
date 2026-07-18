# Metrics Sync

Daily job that backfills YouTube video statistics and Instagram media insights
into SaaS Maker notes for published reels.

## Command

```bash
npm run sync:metrics
# or
cargo run --quiet --manifest-path reel/Cargo.toml -- metrics --execute --repo-root .
```

## Schedule

Daily at 09:30 host time. Templates:

- systemd: `reel-metrics-sync.timer` + `reel-metrics-sync.service` (oneshot) —
  see [`deployment.md`](../deployment.md).
- launchd: `~/Library/LaunchAgents/com.fleet.reel-metrics-sync.plist` — see
  [`deployment.md`](../deployment.md).

## Behavior

- Scans `status=sent` marketing posts by default.
- Skips posts without a supported provider/release ID.
- Fetches YouTube video statistics or Instagram media insights for the
  `external_id` saved during posting.
- Replaces the prior `metric_*` note block so repeated runs do not accumulate
  stale metrics.

Posting must have recorded `posting_provider` and `external_id` notes for the
sync to find a release ID; without those, the post is skipped.
