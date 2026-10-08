# PRD — Launchdesk distribution, Codex handoff

**Status:** ready for implementation
**Date:** 2026-10-02
**Owner handoff from:** Devin (fleet workspace session)
**Implements:** new-project-checklist launch step — directory/launch-site
submissions for every catalog project

## 1. Context

The Fleet catalog (`catalog/projects.json`, ~76 projects) needs its products
distributed across the launch-destination catalog
(`apps/showcase/src/data/launchdesk.json`, 1,163 destinations). Owner
direction: **submit every catalog project that has a resolving public URL —
completeness, shareability, and public-catalog inclusion are NOT gates.**

Devin has already completed the tractable free-form surface:

- **307 provider-acknowledged submissions + 1 verified live listing + 1
  queued**, across 31 destinations, for the 15 projects that were uncovered
  when this effort began (reader, ai-game, motion, open-historia, meme-lab,
  nutrition-formula-engine, contextdaddy, mentionpilot, daddyrad,
  chatgpt-connections, ios-landings, ph-catalog, field-track, war-chest,
  unified-portfolio).
- Wave-1 (2026-09-22) had separately covered ~36 earlier-catalog projects.
- Ledger: `tooling/config/directory-submissions/submissions.json` —
  **gitignored, owner-local; never commit it.**

## 2. What's already done (do not redo)

- All proven free-form destinations are saturated for the 15 projects:
  active-search-results, quality-internet-directory,
  directory-web-promotion, siteswebdirectory.com, startup-collections,
  startup-sea, lachief, curated-design, indiehustles.com, startfa.st,
  findthatsoftware.com, startupstash.com, ai-navhub, ai-tools-pin,
  spiff-store, rankmyai, insidr, dynamite, aitools.inc, saasaitools.com,
  theaigeneration.com, aitoolsdirectory.com, library.phygital.plus, ainav.cn,
  waildworld.com, devpages, aisotools.com, alphadigits.com.
- GitHub surface audited: all 15 repos already carry accurate topics;
  ContextDaddy is inside open PR jaywcjlove/awesome-mac#3041 and listed on
  awesome-swift-macos-apps; mentionpilot + chatgpt-connections are inside
  open PR mahseema/awesome-ai-tools#2250; new PR opened
  dkhamsing/open-source-ios-apps#2396 (Motion).
- First verified `live`: https://aisotools.com/tool/aliveville
  (auto-generated claimable page).

## 3. Objective

Move the remaining truthful, achievable distribution: account-gated
destinations the owner can unlock, email-confirmation queues, GitHub list
PRs that fit, transient retries, and live-verification of pending reviews.

## 4. Requirements

### Must

1. Append rows to `submissions.json` for every attempted pair with
   `projectId`, `destinationId`, `state`, `outcome`, `evidence`,
   `recordedAt`, `campaignId` (use `launchdesk-wave3-<date>`).
2. State semantics — **never blur these**:
   - `submitted`: provider acknowledged (confirmation text/JSON/receipt id).
   - `queued`: accepted pending email confirmation or later processing.
   - `live`: a resolving public listing URL was fetched and inspected —
     provider acknowledgement is NOT live.
   - `skipped`/`blocked`/`indeterminate` with a specific reason.
3. Use only truthful catalog copy (`wave4_projects.json`-style fields from
   `catalog/projects.json`); match destination categories to real fit;
   AI-only destinations only take AI projects (flag `ai: true` set).
4. Free routes only unless the owner explicitly approves payment.
5. Regenerate `apps/showcase/src/data/launch-coverage.json` via
   `node tooling/launchkit/scripts/sync-coverage.mjs` — never hand-edit it.
   Note: it intentionally withholds non-public-catalog projects; ledger is
   the source of truth.

### Must NOT

- No CAPTCHA/Turnstile bypass, no login workarounds, no paid lanes without
  approval, no reciprocal-backlink routes without approval.
- No fabricated claims, metrics, categories, or dates.
- Do not modify `catalog/projects.json` classification or generated outputs.
- Do not touch secrets/env/prod config; preserve unrelated dirty work
  (currently dirty: `tooling/config/app-health-native-applicability.json`,
  `capture-projects.json`, `clarity-journeys.json`, `clarity-projects.json`,
  `scripts/clarity-audit.mjs`, `scripts/geo-observatory-record.mjs`).

## 5. Work items (priority order)

### P0 — Owner-account unlocks (need owner decision/credentials)

| Destination | Why blocked | Unlock |
|---|---|---|
| glama.ai connector listing | required badge for punkpeye/awesome-remote-mcp-servers | owner creates Glama account, lists `https://mcp.highsignal.app/high-signal/mcp` (verified: answers anonymous MCP initialize) |
| producthunt.com launch | account + launch is a one-shot event | owner decision — sequence PH launches per product |
| flowtools, pitchwall, bai.tools, fivetaco, microlaunch, ufind, firsto, ventureradar, submitmatic, confettisaas, webspot, startupbenchmarks, 10words, usefuturestack, code.market, bizoforce, revispy, indiehunt, geekwire etc. | login walls | owner account creation or explicit delegation |
| viesearch.com | email-verification serial gate | check sarthakagrawal@agentmail.to inbox, confirm, then batch remaining projects |
| futuretools, dokeyai, webspot, startup-project, whatisaitools, vantaige, aitooltrek, aitoolzdir, aiheron, starterbest, fazier, twelve.tools, wired.business, stork | reciprocal badge/link precondition | owner approves or declines badge policy |
| Stripe/Atlassian/Pipedrive marketplaces, appexchange | vendor programs | owner decision per product fit |

### P1 — Transient retries

- **aisotools.com**: motion, mentionpilot, chatgpt-connections hit ~30-min
  IP rate limit. Retry spaced; **rename Motion's display name**
  (collides with existing motion.com scheduler listing — use e.g.
  "Motion Body Game" only if the product page supports it; else skip and
  record).
- **ai-hunter.io**: all 7 AI projects indeterminate — site flapped
  503/404 mid-flight; one earlier Motion POST may have landed. Re-attempt
  all 7; dedupe by checking for a prior listing first.
- **aivalley.ai**: CF7 `mail_failed` — backend mail broken; retry later
  or use on-page contact route.

### P2 — GitHub curated lists (PR route, gh authed as sarthakagrawal927)

- punkpeye/awesome-remote-mcp-servers — blocked on Glama badge (see P0).
- Evaluate remaining awesome-list fits honestly; maintainers close weak
  self-promotion (prior Fleet PRs: 2 merged, several silently closed).
  Candidate: motion already PRed; other repos lack obvious list fits —
  do not force.

### P3 — Live-verification sweep

- Periodically re-check submitted destinations for published listings;
  upgrade `submitted` → `live` only with a fetched public listing URL.
- Active Search Results indexes quickly; phpLD queues are manual-review.
- aisotools-style auto-generated claimable pages may exist for other
  projects — claim flows that need email verification count as live
  already (listing exists), claim itself optional.

## 6. Non-goals

- No new destination research beyond `launchdesk.json` unless tagged and
  evidenced; do not invent directories.
- No emailing press contacts (Verge, Mashable et al.) — that's PR outreach,
  separate owner decision.
- No Product Hunt launch execution — it burns the one-shot launch.

## 7. Evidence & receipts

- Campaign dir:
  `~/Library/Application Support/Fleet Ops/growth-campaigns/launchdesk-wave2-2026-10-02/`
  (`receipts/agent{A..G}_results.jsonl`, `agent-batches.jsonl`, wave2/3
  summaries). Create a `launchdesk-wave3-<date>` sibling dir for new work.
- Scratch env: `/tmp/launchwave/` (ephemeral) — playwright-core +
  "Google Chrome for Testing" at
  `~/Library/Caches/ms-playwright/chromium-1243/`.

## 8. Known artifacts / disclosures

- siteswebdirectory review queue has one stray placeholder test row
  (`TestPlaceholderCheckXYZ` / example-nonexistent-xyz.com) — will fail
  review.
- saasaitools queue has one debug probe row — will fail review.
- ainav.cn rows carry sites' own page titles (their auto-fill overwrote
  the name field).
- indiehustles: one test click reached Stripe checkout — **no payment
  made**; all 15 real submissions used the $0 plan.

## 9. Acceptance criteria

- Every new attempt has a ledger row with honest state + evidence.
- `node tooling/launchkit/scripts/sync-coverage.mjs --check` passes.
- PROJECT_STATUS.md gets a wave-3 timeline entry.
- No `live` rows without resolving listing URLs.
- Revisit candidate count: ~30 owner-gated destinations moved, transient
  retries resolved, live rows grow as reviews publish.

## 10. Reference numbers

- Ledger rows: ~2,714 | campaign: 307 submitted, 1 live, 1 queued,
  32 indeterminate, 577 blocked, 1,371 skipped.
- Covered destinations (submitted ≥1): 31 — see §2.
- Coverage projection: 39 public projects, 749 pairs.
