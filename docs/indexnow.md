# Fleet IndexNow

Notify **Bing, Yandex, Naver, Seznam, Yep** when fleet URLs are added or updated.

**Google is not on IndexNow.** Use [Google Search Console](https://search.google.com/search-console) + sitemaps for Google.

## Script

```bash
# 1) Create key (once) — public by design, stored in config
node fleet-ops/scripts/indexnow-submit.mjs --init-key

# 2) Write /{key}.txt into each product publicDir
node fleet-ops/scripts/indexnow-submit.mjs --apply-keys

# 3) Deploy products so https://{host}/{key}.txt is live

# 4) Verify keys
node fleet-ops/scripts/indexnow-submit.mjs --check-keys

# 5) Preview URL set from sitemaps
node fleet-ops/scripts/indexnow-submit.mjs --dry-run

# 6) Submit (all registered products)
node fleet-ops/scripts/indexnow-submit.mjs

# Scoped
node fleet-ops/scripts/indexnow-submit.mjs --id rolepatch
node fleet-ops/scripts/indexnow-submit.mjs --host highsignal.app --max 80
node fleet-ops/scripts/indexnow-submit.mjs --url https://codevetter.com/
```

Config: `fleet-ops/config/indexnow.json`  
Products: `fleet-ops/config/agent-surfaces-registry.json`

## How it works

1. Loads IndexNow `key` from config.
2. Per origin: discovers sitemap via `robots.txt` / `/sitemap.xml` / `/sitemap-index.xml`.
3. Skips HTML SPA shells pretending to be sitemaps.
4. Always includes `/`, `/llms.txt`, `/llms-full.txt`, `/index.md`, `/api/ai`.
5. POSTs batches to `https://api.indexnow.org/indexnow`.

## Engines covered

| Engine | Via IndexNow |
|---|---|
| Bing | Yes |
| Yandex | Yes |
| Naver | Yes |
| Seznam | Yes |
| Yep | Yes |
| DuckDuckGo | Indirect (often Bing-backed) |
| **Google** | **No** — GSC only |

## Google (manual / API)

1. Search Console → domain or URL-prefix property.
2. Sitemaps → submit URL from `robots.txt` (`Sitemap: …`).
3. Optional: Search Console API `sitemaps.submit` (service account).
4. Google Indexing API is **not** for general product pages (jobs/livestream only).

## Ops tips

- Re-run IndexNow after marketing deploys or major content ships.
- Don’t spam thousands of junk URLs; prefer real sitemap URLs + agent surfaces.
- Key file must match key body exactly (script writes `{key}\n`).
- Apex subdomains (e.g. `docs.sassmaker.com`) each need their own live `/{key}.txt` if submitted as that host.
