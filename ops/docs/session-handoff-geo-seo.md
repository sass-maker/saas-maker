# Session handoff — GEO / SEO / IndexNow (2026-07-17)

Status for the **external audit agent**. Prefer live checks over this file.

## Done

| Area | Status |
|---|---|
| Agent surfaces (llms / api/ai / index.md) | **23/23 live** on production custom domains (pace = heypace.app) |
| Wrangler production deploys | Done across Pages + Workers / OpenNext |
| IndexNow tooling | `fleet-ops/scripts/indexnow-submit.mjs` + docs |
| IndexNow key files | Applied under each `public/`; **22/23 live** on production |
| IndexNow submit | **1057 URLs**, **23/23 batches HTTP 202** to `api.indexnow.org` |
| Audit prompt | `fleet-ops/docs/audit-prompt-geo-seo-session.md` |
| Strategy docs | `geo-dr-outcomes.md`, `indexnow.md`, directory-submissions demoted spam for DR |

## IndexNow key

Public key (by design): see `fleet-ops/config/indexnow.json` → `key`  
Live as `https://{host}/{key}.txt`

**Only gap:** `truehire.rolepatch.com` returns **HTML SPA** for the key file (IndexNow still returned 202 for its batch). Fix: ensure static asset is in OpenNext ASSETS and wins over SPA fallback; redeploy truehire with key in `public/` and verify body equals key.

## Not done / residual

| Item | Notes |
|---|---|
| Google Search Console | Manual / GSC API — not IndexNow |
| codevetter git push | Blocked by husky false-positive on `secret_policy.rs` (local commits exist) |
| SPA sitemaps | reader / swe may still serve HTML for sitemap paths |
| Directory spray | Awareness only; CAPTCHA/OAuth remain human-kick |
| PostHog | Instrumented; not productized into dashboards |
| AliveVille / Protein Index | Public sites outside the 23 agent-surfaces set |

## Commands for auditor

```bash
node fleet-ops/skills/agent-ready/scripts/agent-index-audit.mjs --all
node fleet-ops/scripts/indexnow-submit.mjs --check-keys
node fleet-ops/scripts/indexnow-submit.mjs --dry-run --max 20
bash fleet-ops/skills/seo-audit/scripts/seo-audit.sh https://rolepatch.com/ --site https://rolepatch.com
```

## Submit log

See latest local run: `/tmp/fleet-deploy/indexnow-submit.log` (may not persist across machines).
