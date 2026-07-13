# Cloudflare Domain And SEO Audit

Updated: 2026-07-13

## Executive Summary

Every active public Fleet product now has a stable canonical hostname. Pages and
`workers.dev` addresses remain deployment aliases or backend endpoints where a
separate public API hostname was not requested.

Important domain state:

- `sassmaker.com` is on Cloudflare nameservers and is currently the production
  SaaS Maker domain recorded in Fleet docs.
- `sassmaker.com` is the canonical Fleet domain family for this rollout.
- `saasmaker.com` is a separate AWS Route 53 domain and should not be used for
  this SEO program unless it is later redirected to `sassmaker.com`.
- Wrangler OAuth is authenticated for Cloudflare Pages/Workers operations.
- Audit source is Cloudflare Pages project inventory, `wrangler.toml` /
  `wrangler.jsonc`, and Fleet README project status.

## Canonical Domain Recommendation

Use `*.sassmaker.com` for the long-term product grid. Do not mix
`saasmaker.com` and `sassmaker.com` for SEO unless one is explicitly redirected
to the other.

## Fleet Ops Console

Canonical target: `https://fleet.sassmaker.com`

Current implementation state:

- Local Cloudflare Tunnel ingress includes `fleet.sassmaker.com` and points it
  at `http://127.0.0.1:4329`.
- DNS points to the tunnel target:
  `fceb4f22-db20-4e77-88cf-07c1f290fd42.cfargotunnel.com`
- The public console is live and returns HTTP 200.

## Already Has Own Domain

| Project | Cloudflare config | Domain | Notes |
|---|---:|---|---|
| `rolepatch` | yes | `rolepatch.com`, `www.rolepatch.com` | Own product brand; keep. |
| `significanthobbies` | yes | `significanthobbies.com`, `www.significanthobbies.com` | Own product brand; keep. |
| `karte` | yes | `karte.cc`, `*.karte.cc`, `origin.karte.cc` | Own product brand; keep. |
| `saas-maker` | not in local wrangler audit | `sassmaker.com` | Recorded in Fleet README as SaaS Maker production domain. |
| `high-signal` | not in local wrangler audit | `highsignal.app` | Recorded in Fleet README. |
| `aliveville` | not in local wrangler audit | `aliveville.com` | Recorded in Fleet README. |
| `codevetter` | not in local wrangler audit | `codevetter.com` | Recorded in Fleet README. |
| `pace` | Pages app | `heypace.app` | Focus-zone product. |
| `tinygpt` | Pages app | `posttrainllm.com` | Legacy domain; consider `tinygpt.sassmaker.com` as secondary canonical only if the product is renamed publicly. |

## Assigned Product Subdomains

These non-archived projects use product subdomains under the appropriate Fleet
brand. Every hostname below was live when this audit was updated.

| Priority | Project | Current CF target/config | Proposed canonical | SEO posture |
|---:|---|---|---|---|
| 0 | `fleet-ops` | Cloudflare Tunnel | `fleet.sassmaker.com` | Public read-only Fleet console. |
| 1 | `reader` | Worker custom domain | `read.significanthobbies.com` | Authenticated private reading workspace. |
| 1 | `swe-interview-prep` | Pages custom domain | `learn.significanthobbies.com` | Owner-authenticated Learning OS. |
| 1 | `research-papers` | Pages custom domain | `papers.highsignal.app` | Public research paths and cited answers. |
| 1 | `knowledge-base` | Worker custom domain | `search.sassmaker.com` | Private Agent Search app; indexes remain noindex. |
| 2 | `anime-list` | Pages custom domain | `anime.significanthobbies.com` | Public anime and manga discovery. |
| 2 | `looptv` | Pages custom domain | `tv.significanthobbies.com` | Public curated stations and categories. |
| 2 | `starboard` | Worker custom domain | `starboard.codevetter.com` | CodeVetter umbrella product. |
| 2 | `drank` | Pages custom domain | `domains.sassmaker.com` | Domain-rating support surface. |
| 3 | `email-manager` | Worker custom domain | `mail.sassmaker.com` | Authenticated mail workspace. |
| 3 | `free-ai` | Worker custom domain | `ai-gateway.sassmaker.com` | AI Gateway API, dashboard, and docs. |
| 4 | `reel-pipeline` | Fleet dashboard path | `fleet.sassmaker.com/marketing` | Public aggregate state only; controls remain private. |

Excluded:

- `today-little-log`: Fleet README marks it archived/out-of-fleet.
- `open-historia`: not in the active Foundry catalog; treated as archived/out-of-fleet for this rollout.
- `device-net-test`: scratch network test app, moved out of active Fleet root.
- `saas-maker-ci-fix`: duplicate worktree, moved out of active Fleet root.
- `everythingrated`, `truehire`: not in the active Foundry catalog; moved out of active Fleet root.

## SEO Baseline Per Project

Every assigned domain should ship:

- Canonical homepage URL configured in app metadata and package homepage.
- `robots.txt` allowing public pages and blocking private/auth/internal paths.
- `sitemap.xml` generated at build or runtime.
- Per-route title, description, canonical, OG image, and Twitter card defaults.
- 301 redirect from `workers.dev` / `pages.dev` only where Cloudflare supports
  it, otherwise canonical tags to the custom domain.
- Google Search Console and Bing Webmaster verification.
- Basic schema where useful: `SoftwareApplication`, `WebSite`,
  `BreadcrumbList`, `Article`, `FAQPage`.
- Internal links from `fleet.sassmaker.com` and the SaaS Maker product index.

## Remaining SEO Work

1. Verify `robots.txt`, sitemap, metadata, and structured data as each public
   surface changes.
2. Submit public sitemaps to Google Search Console and Bing Webmaster Tools.
3. Keep private Reader, Learning, Mail, and Agent Search routes out of indexes.
4. Track domain rating and indexing weekly when the deferred domain cron is
   enabled.
