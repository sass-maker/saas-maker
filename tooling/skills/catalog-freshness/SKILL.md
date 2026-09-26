---
name: catalog-freshness
description: >
  Report on staleness and drift in the public catalogs — expired funding
  deadlines still marked open, launch destinations not verified recently,
  conflicting source claims, and (opt-in) live liveness probes that catch
  dead, parked, or hijacked domains. Use for "what's gone stale", "which
  deadlines passed", "re-verify the launch catalog", or scheduled refresh
  sweeps before updating launchdesk.json or funding.json.
---

# Catalog Freshness — staleness and drift reporting

The public catalogs (`launchdesk.json`, `funding.json`, playbook corpus) are
snapshots. This skill is the standing check that keeps "not reported" honest
instead of silently stale. It reports; it never mutates the datasets.

## How to invoke

Run from `tooling/` in the saas-maker checkout:

```bash
# Offline report — expired deadlines, stale verifications, claim conflicts
node scripts/catalog-freshness.mjs

# Markdown report for review
node scripts/catalog-freshness.mjs --out /tmp/catalog-freshness.md

# Live probe — fetch destination homepages, flag dead/redirected/parked
node scripts/catalog-freshness.mjs --probe --limit 40        # spot check
node scripts/catalog-freshness.mjs --probe --concurrency 8   # full sweep
```

Options: `--stale-days N` (default 90), `--limit N`, `--concurrency N`,
`--out <path>` for markdown instead of JSON on stdout.

## What it catches

- **Funding**: `Deadline` dates in the past (especially rows still marked
  `Open now`), deadlines inside 30 days, `Last Verified` older than the
  stale threshold.
- **LaunchDesk offline**: destinations whose newest claim or playbook
  `retrieved` date exceeds the threshold; sources disagreeing on pricing or
  link policy (drift candidates).
- **LaunchDesk probe**: DNS failures, 4xx/5xx, timeouts, cross-host
  redirects (rebrand candidates), parked-domain and hijack title heuristics.

## Workflow

1. Run the offline report — cheap, always safe.
2. If anything looks off, run `--probe` on the stale subset (or all).
3. Merge findings into `launchdesk.json` / `funding.json` like research
   agent reports: quarantine with a reason in `flags[]`, re-key redirects
   with a provenance claim, update `Deadline`/`External Status`/`Last
   Verified`. Never delete history — append claims.
4. Rebuild the showcase and re-run the validators.

## Boundaries

- Read-only against the catalog; findings are a report, not a mutation.
- Probe mode is opt-in because it performs real network fetches; keep
  concurrency modest (default 8) and do not hammer a single host.
- Parked/hijack verdicts are heuristics — spot-check before quarantining.
