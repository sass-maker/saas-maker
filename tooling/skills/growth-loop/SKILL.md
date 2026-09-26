---
name: growth-loop
description: Run the recurring fleet-wide organic growth loop — GitHub discoverability fixes, directory and launch-site submission batches, and star/traffic outcome measurement. Use for "grow stars/views", weekly distribution runs, or checking which projects still need submitting where. One-off launches belong to launch-campaign.
---

# Growth Loop

The recurring counterpart to `launch-campaign`: a weekly pass that keeps every
launchable project discoverable on GitHub, steadily submits projects to the
accredited destination catalog, and measures whether any of it moved stars or
traffic. It is a loop, not a blast — batches stay small enough that each
submission is a real listing, not spam.

## The loop

1. **Baseline.** Read current GitHub outcomes before changing anything:

   ```bash
   node site-health/apps/backend/scripts/github-metrics-collect.mjs --project <id>
   # or read the latest portfolio ledger via the Site Health dashboard:
   #   /v1/outcomes/github  (stars, forks, 14-day views/visitors/clones, referrers)
   ```

   The daily launchd collector (`site-health/scripts/github-metrics-schedule.mjs`)
   keeps this baseline fresh; the loop needs a before-snapshot only when one is
   stale or missing.

2. **Hygiene.** Audit repository discoverability metadata and propose fixes:

   ```bash
   node saas-maker/tooling/scripts/github-repo-audit.mjs                 # report
   node saas-maker/tooling/scripts/github-repo-audit.mjs --apply homepage,description,topics
   ```

   `--apply` writes only catalog-approved values (canonical domain, public
   description, directory technologies as topics). README, license, and social
   preview gaps are reported, never auto-fixed — show the list and let the
   owner pick.

3. **Queue.** Take the next bounded batch of unsent submissions:

   ```bash
   node saas-maker/tooling/scripts/growth-queue.mjs next --limit 8
   node saas-maker/tooling/scripts/growth-queue.mjs coverage
   ```

   `next` splits work into `automatable` (no-CAPTCHA forms) and `human-kick`
   (manual or protected channels: Product Hunt, Hacker News, G2, etc.). Pull at
   most one destination per run per project and at most a handful of projects
   per week — identical simultaneous submissions read as spam and get listings
   rejected.

3b. **Awesome-list PRs.** GitHub-native placement for flagship repos: drafted
   entries live in `tooling/config/directory-submissions/awesome-lists.json`
   (per project: target list, section, fit note, entry text). Each PR is a real
   contribution on the owner's account — approve once per batch, then open them
   with `gh`. `tiennm99/awesome-coding-agents`-style lists with a star floor
   stay excluded until the repo qualifies.

4. **Draft and approve.** Promotion into an executable campaign follows the
   `launch-campaign` skill: build the manifest from the queued pairs using its
   plan-contract lanes, preview the hash, and stop for owner approval. Nothing
   in this loop bypasses that gate.

5. **Execute and record.** Run only the approved items, then write outcomes so
   the queue never requeues them:

   ```bash
   node saas-maker/tooling/scripts/growth-queue.mjs record \
     --project <id> --destination <id> --state submitted --evidence <url>
   ```

6. **Report.** Diff against the baseline from step 1 — stars, forks, 14-day
   traffic, referrers — and record which destinations actually moved numbers.
   Destinations that never produce a referral visit get deprioritized in the
   next queue.

## Hard rules

- No fake engagement. No bought stars, no sock-puppet upvotes, no view
  inflation. The loop earns placement; it does not manufacture it.
- Protected channels stay human-kick. HN, Product Hunt, Reddit, X, and LinkedIn
  require the owner's own account and judgment — drafts are prepared, the
  submit click is human.
- CAPTCHA, OAuth, and anti-bot destinations stay `blocked` until a human clears
  them; automation never works around a gate.
- Every external write rides an approved campaign manifest. `growth-queue.mjs`
  emits a plan; only `launch-campaign` turns it into executable work.
- State files under `tooling/config/directory-submissions/` are the record of
  what went where. Never requeue a submitted pair without a recorded reason.

## What "done" looks like per cycle

- Repo audit clean (or fixes applied) for every public repository.
- One bounded submission batch approved, executed, and recorded.
- Star/traffic snapshot diffed against last cycle's baseline.
- A short note: what shipped, what moved, what is queued next.
