# Cloudflare Domain And SEO Audit

Generated: 2026-07-11

## Executive Summary

The Fleet has several Cloudflare-backed projects still running on `workers.dev`,
`pages.dev`, or without a public production domain in local deploy config. For
SEO long game, every non-archived public product should have a stable canonical
domain, a sitemap, robots policy, metadata defaults, and Search Console setup.

Important domain state:

- `sassmaker.com` is on Cloudflare nameservers and is currently the production
  SaaS Maker domain recorded in Fleet docs.
- `saasmaker.com` is on AWS Route 53 nameservers. `fleet.saasmaker.com`
  currently resolves to AWS IPs and returns an IIS login redirect, not the
  Fleet Ops Cloudflare Tunnel.
- Wrangler is installed locally but not authenticated, so Cloudflare API truth
  cannot be enumerated or mutated from this shell yet.
- Local audit source is `wrangler.toml` / `wrangler.jsonc` plus Fleet README
  project status.

## Canonical Domain Recommendation

Use one of these two strategies consistently:

1. **Preferred if the brand is SaaS Maker:** move/delegate `saasmaker.com` DNS
   into Cloudflare, then use `*.saasmaker.com` for the long-term product grid.
2. **Fastest with current DNS:** use `*.sassmaker.com` because that zone is
   already on Cloudflare.

Do not mix `saasmaker.com` and `sassmaker.com` for SEO unless one is explicitly
redirected to the other.

## Fleet Ops Console

Requested target: `https://fleet.saasmaker.com`

Current implementation state:

- Local Cloudflare Tunnel ingress includes `fleet.saasmaker.com` and points it
  at `http://127.0.0.1:4329`.
- DNS is not correct yet because `saasmaker.com` is not controlled by
  Cloudflare in this environment.
- Current public response is not the Fleet console: `fleet.saasmaker.com`
  resolves to AWS IPs and redirects to `/Login.aspx`.
- Required DNS target when DNS access is available:
  `fceb4f22-db20-4e77-88cf-07c1f290fd42.cfargotunnel.com`

## Already Has Own Domain

| Project | Cloudflare config | Domain | Notes |
|---|---:|---|---|
| `resume-tailor` / RolePatch | yes | `rolepatch.com`, `www.rolepatch.com` | Own product brand; keep. |
| `significanthobbies` | yes | `significanthobbies.com`, `www.significanthobbies.com` | Own product brand; keep. |
| `linkchat` / Karte | yes | `karte.cc`, `*.karte.cc`, `origin.karte.cc` | Own product brand; keep. |
| `saas-maker` | not in local wrangler audit | `sassmaker.com` | Recorded in Fleet README as SaaS Maker production domain. |
| `high-signal` | not in local wrangler audit | `highsignal.app` | Recorded in Fleet README. |
| `ai-game` / AliveVille | not in local wrangler audit | `aliveville.com` | Recorded in Fleet README. |
| `CodeVetter` | not checked out locally | `codevetter.com` | Recorded in Fleet README. |

## Needs Domain Assignment

These are non-archived projects with local Cloudflare deployment config and no
custom production domain in that config.

| Priority | Project | Current CF target/config | Proposed canonical | SEO posture |
|---:|---|---|---|---|
| 1 | `reader` | Worker, no routes | `reader.saasmaker.com` | Public research library. Needs crawlable landing, `/sitemap.xml`, article/library index, OG defaults. |
| 1 | `swe-interview-prep` | Pages, no custom domain | `interview.saasmaker.com` | Evergreen learning content. Needs concept pages, problem index, sitemap. |
| 1 | `open-historia` | Worker, no routes | `historia.saasmaker.com` | Public timeline/story content. Needs topic pages and sitemap. |
| 2 | `anime_list` | Pages, no custom domain | `anime.saasmaker.com` | Free tool. Needs canonical metadata and indexable anime/manga routes. |
| 2 | `looptv` | Pages, no custom domain | `tv.saasmaker.com` | Free tool. Needs curated channel/category pages, sitemap. |
| 2 | `starboard` | Worker, no routes | `starboard.saasmaker.com` | SaaS surface. Could also become `stars.codevetter.com` if CodeVetter umbrella wins. |
| 3 | `email-manager` | Worker, no routes | `mail.saasmaker.com` | Likely auth-heavy. Use marketing/docs pages for SEO, keep app noindex if private. |
| 3 | `free-ai` | Worker, `workers_dev = true` | `ai.saasmaker.com` | API gateway/docs. SEO via docs and model/provider pages; API base can be `api.ai.saasmaker.com`. |
| 4 | `reel-pipeline` | Worker/R2 artifacts | `reels.saasmaker.com` | Mostly support infra. SEO only if there is a public gallery/docs surface. |

Excluded:

- `today-little-log`: Fleet README marks it archived/out-of-fleet.

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
- Internal links from `fleet.saasmaker.com` and the SaaS Maker product index.

## Apply Plan

1. Decide canonical spelling: `saasmaker.com` versus `sassmaker.com`.
2. Authenticate Wrangler or provide Cloudflare API token with zone/project edit
   permissions.
3. If using `saasmaker.com`, move/delegate DNS to Cloudflare or update Route 53
   records manually.
4. Add custom domains in Cloudflare:
   - Pages projects: attach custom domain in Pages project settings/API.
   - Workers projects: add routes/custom domains in `wrangler.*` and deploy.
   - Tunnel-hosted Fleet Ops: CNAME `fleet` to the tunnel target.
5. Update each app's public env/canonical metadata.
6. Add or verify `robots.txt`, `sitemap.xml`, and default SEO metadata.
7. Submit sitemaps and track indexing.

## Current Blockers

- `wrangler whoami` reports unauthenticated.
- No AWS CLI / Route 53 access was available from this shell.
- `saasmaker.com` is not on Cloudflare nameservers, while `sassmaker.com` is.
