# Cloudflare Workers CPU RCA: July 2026

## Summary

Cloudflare showed 33.81 million Workers CPU milliseconds, 3.81 million above
the plan's 30 million included CPU milliseconds. That counter measures compute,
not spend. At the published $0.02 per additional million CPU milliseconds, the
3.81 million shown then represented about $0.08 of incremental CPU usage.

The read-only account query at 2026-07-13 23:45 IST showed 36.69 million CPU
milliseconds and 3.10 million requests for July 1 through July 13. The estimated
CPU overage at that point was 6.69 million milliseconds, or about $0.13. Other
Cloudflare billable dimensions are outside that estimate.

## Attribution

| Worker | CPU ms | Share | Requests | p50 | p95 | p99 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `high-signal-web` | 29,355,546 | 80.0% | 1,513,347 | 13.85 ms | 28.79 ms | 146.46 ms |
| `high-signal-api` | 3,543,154 | 9.7% | 1,514,522 | 1.82 ms | 3.45 ms | 8.76 ms |
| `significanthobbies` | 2,322,598 | 6.3% | 24,063 | 12.79 ms | 701.53 ms | 1,067.69 ms |
| `resume-tailor` | 489,205 | 1.3% | - | - | - | - |
| `linkchat` | 488,237 | 1.3% | - | - | - | - |

High Signal's two Workers generated 89.7% of the account's CPU. Significant
Hobbies has a separate tail-latency problem worth profiling, but it did not
cause this overage.

## Root Cause

1. Starting July 3, an automated scanner at `93.123.109.102` requested random
   High Signal page and date combinations over plain HTTP at roughly 166,000
   requests per day.
2. Each request entered the SSR/OpenNext web Worker and generated about two API
   subrequests. Cloudflare attributed 1.43 million of the web requests and 23.88
   million CPU milliseconds to the ATL colo.
3. A verified GPTBot crawler also traversed unbounded `/data/*`, `/daily*`, and
   `/signals/today` history routes. This was smaller than the scanner traffic but
   unnecessarily amplified SSR work.
4. The web Worker averaged about 19.4 CPU milliseconds per request, so cheap
   abusive requests became expensive when they reached the application runtime.

## Timeline And Mitigation

- July 1-2: normal traffic, around one thousand requests per day.
- July 3-11: `high-signal-web` received 137,000-169,000 requests per day and used
  2.4-3.9 million CPU milliseconds per day.
- July 12: the application-level abuse guard blocked the scanner before
  OpenNext, redirected HTTP to HTTPS, and returned cheap 404s for crawler-only
  history routes. Web traffic fell to 36,946 requests.
- July 13: the query observed 733 web and 751 API requests by its cutoff. This
  confirms the mitigation changed the traffic and CPU trajectory.

The shipped controls live in High Signal's `apps/web/abuse-guard.mjs`, with
regression coverage in `scripts/abuse-guard.test.mjs`.

## Follow-Up Controls

- Run `node scripts/report-workers-cpu.mjs` from Fleet Ops during Cloudflare
  billing reviews. Use `--json` for dashboard ingestion.
- Move repeat scanners to Cloudflare WAF custom rules or rate limiting so they
  are rejected before Worker invocation. Preserve the app guard as defense in
  depth.
- Cache public High Signal responses that do not need per-request SSR and keep
  historical crawler routes bounded.
- Alert on a sharp increase in request-to-subrequest ratio or any Worker taking
  more than 50% of monthly CPU.
- Profile Significant Hobbies separately because its p95 and p99 CPU times are
  high even though request volume is low.

## Reproduce The Report

```bash
cd /Users/assistant/Desktop/fleet/fleet-ops
node scripts/report-workers-cpu.mjs
node scripts/report-workers-cpu.mjs --start 2026-07-01 --end 2026-08-01 --json
```

The command uses `CLOUDFLARE_API_TOKEN` when present and otherwise reads the
local Wrangler OAuth credential. It never prints the credential. The Cloudflare
account identifier in the script is not secret and can be overridden with
`CLOUDFLARE_ACCOUNT_ID`.

