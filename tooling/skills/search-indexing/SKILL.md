---
name: search-indexing
description: >
  Subskill of site-health — indexmysite-style URL indexing for canonical Fleet
  domains: submit URLs for discovery (IndexNow + Search Console sitemaps), then
  track each URL's Google index status via the URL Inspection API until it is
  indexed or day 14 ends. Route here for "index this page", "is X indexed",
  "submit my new pages to Google/Bing", or per-URL indexing status reports.
---

# search-indexing — submit and track URL indexing

Subskill of `site-health`. The engine lives in the Site Health repository
(`site-health/apps/backend/scripts/indexing-requests.mjs`) because Site Health
owns Search Console collection and the shared IndexNow key. Run commands from
the Fleet root via `pnpm --dir site-health indexing <command>`.

## What it does

- **submit** records each URL as an indexing request in the local ledger
  (`~/.fleet/search-indexing-requests/ledger.jsonl`) and notifies IndexNow
  (Bing/Yandex/Naver/Seznam/Yep) for the owning host. Google discovery is NOT
  a per-URL API — it flows through the Search Console sitemaps submitted by
  `search-console-collect.mjs --discovery-cycle`; say this plainly rather than
  claiming a URL was "submitted to Google".
- **check** inspects each open request with the Google URL Inspection API
  (`gcloud` application-default credentials, project-scoped). First check runs
  once the request is ~20h old, rechecks at most every ~20h, and stops when the
  URL reports `indexed` or the request reaches day 14. Each check appends a
  bounded result receipt to `results.jsonl` — verdict and coverage state only,
  never raw provider payloads.
- **status** joins both ledgers into a per-URL report:
  `queued` → `checking` → `indexed` | `not-indexed` (final at day 14), with
  `unavailable` when the inspection could not run.

## Commands

```bash
pnpm --dir site-health indexing submit --project <id> --sitemap   # every sitemap URL
pnpm --dir site-health indexing submit --url <https://…> [--url …]
pnpm --dir site-health indexing submit --project <id> --file urls.txt
pnpm --dir site-health indexing check [--project <id>] [--now] [--max 50]
pnpm --dir site-health indexing status [--project <id>] [--format json]
```

`submit` only accepts https URLs on domains owned by Search Console-eligible
catalog projects; anything else fails closed. `--dry-run` validates without
writing ledgers or calling IndexNow. `--now` bypasses the 20h first-check wait.

## Operating rules

- URL Inspection API quota is limited per verified property per day; keep
  `--max` bounded on manual sweeps and never bulk-recheck terminal URLs.
- A `not-indexed` verdict is a Google decision, not a tooling failure —
  report `coverageState` verbatim as the evidence.
- Resubmitting a URL after a meaningful content change is legitimate; each
  resubmission starts a fresh tracking job once the previous one is terminal.
- Never scrape `site:` SERPs or invent an indexing signal; the Inspection API
  verdict is the only accepted status source.
