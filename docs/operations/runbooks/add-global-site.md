# Add a global site

The shared global leaderboard is driven by `data/global-sites.json` (the
seed list) and `data/global-dr.json` (the accumulated weekly history). The
weekly cron appends a new DR point per site every Monday.

## Steps

1. Edit `data/global-sites.json` and append the bare domain (e.g.
   `"example.com"`), lowercase, no `www.`, no protocol. Keep the array
   sorted as it is.
2. Optionally also add it to `data/fleet-sites.json` if it is a fleet-owned
   domain (the cron updates both lists in the same run).
3. Commit. The next weekly cron run (Monday ~04:00 UTC) will fetch its DR
   and add the first history point. See
   [the weekly job](../jobs/weekly-global-dr.md).
4. If you want history immediately, run the cron script locally:

   ```bash
   node scripts/update-global-dr.mjs
   # for the fleet list:
   node scripts/update-global-dr.mjs --sites data/fleet-sites.json --data data/fleet-dr.json --label fleet
   ```

   Then commit the updated `data/global-dr.json` (and `data/fleet-dr.json`).

## What to check

- The domain normalizes cleanly: `lib/utils.tsx → normalizeDomain` and
  `functions/api/dr.ts` both strip `www.` and require a `.` in the
  hostname. A domain that fails normalization in the proxy will log a warn
  in the cron run and keep any prior history.
- The site is not already present (the cron dedupes by day, not by site,
  so a duplicate entry would just fetch twice).

## Removing a site

Remove it from `data/global-sites.json`. The cron script preserves
accumulated history for domains that are no longer in the seed list (it
seeds `updatedDomains` from `existing.domains`), so removing a site from
the seed list does not erase its history — it just stops getting new
points. To fully remove history, also delete its entry from
`data/global-dr.json` manually.
