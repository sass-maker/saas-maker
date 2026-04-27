# Cloudflare Cost/Abuse Shields — State

**Date applied**: 2026-04-27
**Account**: `7d048325699a5acddb44d3be31cf6ba9` (Sarthakagrawal927@gmail.com)
**Plan**: Workers Paid ($5/mo). Spend Notification at $10 already set.

## CF API token scope (provided)

`#worker:edit, #worker:read, #zone:read` — sufficient to enumerate workers/zones, **insufficient** to write zone-level WAF / Bot Fight / Cache Rules / Rate Limit rules. All zone-level shields below require manual dashboard action.

## Per-Worker wrangler config — APPLIED

Added to every Workers-style wrangler config (TOML or JSONC):

```jsonc
"observability": { "enabled": true, "head_sampling_rate": 0.1 }
"limits":        { "cpu_ms": 30000 }
```

Plus, on user-facing workers, the rate-limit binding (not yet wired in code):

```jsonc
"unsafe": {
  "bindings": [{
    "name": "RATE_LIMITER", "type": "ratelimit",
    "namespace_id": "1001",
    "simple": { "limit": 100, "period": 60 }
  }]
}
```

### Files updated (16 wrangler configs)

| Repo / path                                  | Worker name              | Class       | RATE_LIMITER added |
|----------------------------------------------|--------------------------|-------------|--------------------|
| agentMode/cloudflare/backend/wrangler.jsonc  | agentdata-backend-prod   | backend     | no                 |
| agentMode/web/wrangler.toml                  | agentmode-web            | user-facing | yes                |
| clash-royale-meta/wrangler.toml              | clash-royale-meta        | user-facing | yes                |
| email-manager/wrangler.toml                  | email-manager            | backend     | no                 |
| everythingrated/apps/web/wrangler.toml       | everythingrated          | user-facing | yes                |
| free-ai/wrangler.toml                        | free-ai-gateway          | user-facing | yes (already has DO rate-limit) |
| high-signal/workers/api/wrangler.toml        | high-signal-api          | backend     | no                 |
| high-signal/apps/web/wrangler.toml           | high-signal-web          | user-facing | yes                |
| linkchat/wrangler.jsonc                      | linkchat                 | user-facing | yes                |
| looptv/wrangler.toml                         | looptv                   | user-facing | yes                |
| mentionpilot/workers/api/wrangler.toml       | mentionpilot-api         | backend     | no                 |
| mentionpilot/apps/web/wrangler.toml          | mentionpilot-web         | user-facing | yes                |
| open-historia/wrangler.toml                  | open-historia            | user-facing | yes                |
| reader/wrangler.toml                         | reader                   | user-facing | yes                |
| resume-tailor/wrangler.toml                  | resume-tailor            | user-facing | yes                |
| saas-maker/workers/api/wrangler.toml         | saasmaker-api            | backend     | no                 |
| saas-maker/apps/cockpit/wrangler.toml        | saasmaker-dashboard      | user-facing-admin | no (admin-only) |
| significanthobbies/wrangler.toml             | significanthobbies       | user-facing | yes                |
| starboard/wrangler.jsonc                     | starboard                | user-facing | yes                |
| truehire/apps/web/wrangler.jsonc             | truehire                 | user-facing | yes                |

### Pages projects — SKIPPED at wrangler layer

Pages config (`pages_build_output_dir`) does **not** support `[limits]` or `[[unsafe.bindings]]`. These need dashboard-level rate limiting. Affected:

- anime_list (`anime-list-web` Pages project)
- today-little-log (`today-little-log` Pages project)
- swe-interview-prep (Pages, no wrangler)
- saas-maker-docs (Pages)
- codevetter (Pages)
- personalsite (Pages)
- chess (Pages)
- backpropagate (Pages)

Each Pages project gets free-tier Cloudflare DDoS by default. To layer additional rate limiting, attach a custom domain → zone-level WAF rule (see below).

## Zone-level shields — MANUAL (token lacks `Zone.Edit` / `Zone WAF` / `Bot Management Edit`)

All 4 zones discovered:

| Zone ID                          | Domain                  | Plan |
|----------------------------------|-------------------------|------|
| c1e6464302240c22f727ce64262136fe | codevetter.com          | free |
| 8dd12374d7b8604ee7e40f4a842819dc | rolepatch.com           | free |
| a1c3303b087e71fad87eb800b41952e5 | sassmaker.com           | free |
| 51cf42b75781001abd6790bcf8fac379 | significanthobbies.com  | free |

### What user must do per zone (Cloudflare Dashboard)

For each of the 4 zones above:

1. **Bot Fight Mode** → Security → Bots → toggle **Bot Fight Mode = ON**
   (Free tier: basic mode is available; Super Bot Fight Mode requires Pro.)
2. **Rate Limiting Rule** → Security → WAF → Rate limiting rules → Create rule
   - Field: `(http.request.method eq "GET" or http.request.method eq "POST")`
   - Characteristics: IP source address
   - Period: 60s
   - Requests: 100
   - Action: Block
3. **Cache Rule (static/assets)** → Caching → Cache Rules → Create rule
   - When: `(http.request.uri.path matches "^/(_next/static|assets|static|favicon|images|fonts)/")`
   - Then: Cache eligibility = Eligible for cache, Edge TTL = 60s minimum (override origin)
4. **Cache Rule (image transforms)** → Caching → Cache Rules → Create rule (only on zones using `/cdn-cgi/image/*` — currently none of the 4 zones; add when configured)
   - When: `starts_with(http.request.uri.path, "/cdn-cgi/image/")`
   - Then: Cache Level = Cache Everything, Edge TTL = 31536000 (1y)
5. **WAF Managed Ruleset** → Security → WAF → Managed rules → ensure **Cloudflare Managed Ruleset = Deployed** (free tier gets the OWASP Core Ruleset preview)

### Token scope to fix this gap

Re-issue API token with `Zone:Zone WAF:Edit`, `Zone:Bot Management:Edit`, `Zone:Cache Rules:Edit`, `Zone:Zone:Edit` and re-run shields. Until then, items above are manual.

## Image abuse hardening

- No project currently uses `/cdn-cgi/image/*` (Cloudflare Image Transforms / Cloudflare Images) — verified via grep across all repos. No image cache rule needed yet.
- Workers AI image generation: see `image-gen-shield-pattern.md` for the recipe.

## Recursion / runaway audit

See `recursion-audit.md` — 6 `while(true)` findings, all reviewed; 2 are pagination loops in cron-triggered handlers (medium risk worth a hard cap), the rest are stream-reader patterns (browser or controller-bound, low risk).

## Estimated $ impact

| Villain          | Pre-shield risk             | Post-shield (after manual zone steps) |
|------------------|------------------------------|----------------------------------------|
| DDoS / scraping  | Free tier DDoS only; no WAF | + IP rate limit + WAF + Bot Fight ≈ caps abuse to 100 req/min/IP per zone |
| Log explosion    | 100% sampling on ~20 workers | 10% sampled → ~10x cheaper Workers Logs spend |
| Recursion runaway| 30 s default CPU bursts     | 30 s hard cap (matches default but explicit); cron pagination loops still need bounded iteration count (see audit) |
| Image abuse      | No CDN rule on transforms   | n/a — no projects use CF Images; pattern documented for future use |

Realistic spend ceiling with shields: **$5/mo subscription + a few cents in overage**. Without shields, a single recursion or scraper bot could push spend into **$10–$50** within hours; the spend notification at $10 plus rate limits should keep that bounded.

**This is not zero-risk.** The dashboard-level shields are the highest-impact items and remain the user's manual TODO.
