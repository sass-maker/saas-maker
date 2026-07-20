# Weekly global DR job

A GitHub Action refreshes the shared global (and fleet) DR history every
week and commits the result back to the repo.

## Schedule

- Workflow: `.github/workflows/update-global-dr.yml`
- Cron: `0 4 * * 1` — every Monday at ~04:00 UTC.
- Also runnable manually via `workflow_dispatch`.

## What it does

1. Checks out the repo with `GITHUB_TOKEN`.
2. Runs `node scripts/update-global-dr.mjs` for the global list
   (`data/global-sites.json` → `data/global-dr.json`).
3. Runs the same script again with `--sites data/fleet-sites.json
   --data data/fleet-dr.json --label fleet` for the fleet-owned list.
4. Copies both JSON files into `public/data/` so the deployed `/data`
   download copies stay fresh.
5. Commits `data/{global,fleet}-dr.json` and
   `public/data/{global,fleet}-dr.json` with message
   `chore(dr): weekly update global DR history` and pushes, only if there
   are changes.

## The script

`scripts/update-global-dr.mjs`:

- Reads the seed list, fetches each domain's DR from the Ahrefs free
  public endpoint with a friendly `User-Agent` and a 650 ms delay between
  requests (see [ADR-0006](../../architecture/decisions/0006-request-pacing.md)).
- Appends a new `{ts, dr}` point only if there is not already a point for
  today (same calendar day). If today's point exists and DR changed, it
  updates it in place.
- Preserves history for domains removed from the seed list (seeds from
  `existing.domains`).
- Preserves `communityNominations` if present.
- Writes the JSON back with `JSON.stringify(..., null, 2)` + trailing
  newline.

## Failure modes

- A single domain fetch failure logs `[warn]` and keeps the prior history
  for that domain; the run continues.
- A `429` from Ahrefs logs a warn for that domain and moves on. The 650 ms
  pacing is conservative; sustained `429`s would indicate the free tier is
  overloaded — do not tighten the delay.
- If the commit/push step finds no changes, it prints "No changes to
  commit" and exits cleanly.

## Local run

```bash
node scripts/update-global-dr.mjs
node scripts/update-global-dr.mjs --sites data/fleet-sites.json --data data/fleet-dr.json --label fleet
```

The script writes to the `data/` files in place; you must commit manually
if running locally.

## Where the data goes

- `data/global-dr.json` is bundled into the build (instant first paint)
  and re-fetched at runtime from raw GitHub (fresh without redeploy). See
  [ADR-0005](../../architecture/decisions/0005-dual-data-sources.md).
- `public/data/global-dr.json` and `public/data/fleet-dr.json` are the
  downloadable copies surfaced on the `/data` page.

## Open issue

The workflow lives under this project's `.github/workflows/` rather than
the fleet monorepo root `.github/workflows/`. Moving it is tracked as
planned work in [PROJECT_STATUS.md](../../../PROJECT_STATUS.md).
