# Instagram Token Refresh

Daily job that extends every Instagram long-lived token by 60 days. A single
call to `GET /refresh_access_token` per handle keeps them alive as long as the
previous token is not already expired.

## Command

```bash
npm run ig:refresh
```

## Schedule

Daily at 04:00 host time. Templates:

- systemd: `reel-ig-refresh.timer` + `reel-ig-refresh.service` (oneshot) —
  see [`deployment.md`](../deployment.md).
- launchd: `~/Library/LaunchAgents/com.fleet.reel-ig-refresh.plist` — see
  [`deployment.md`](../deployment.md).

## Output

The refresh script prints new tokens to stdout. Set
`IG_REFRESH_OUTPUT=.env.ig-refreshed` for a sourceable fragment if you want
hands-off rotation.

## Failure mode

If a token does expire (no calls for 60 days, refresh job broken), re-run
`npm run ig:bootstrap` for that handle. See
[`instagram-setup.md`](../instagram-setup.md). Token TTL is 60 days; the daily
cron extends another 60 days each run.
