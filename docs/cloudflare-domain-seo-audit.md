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
- `sassmaker.com` is the canonical Fleet domain family for this rollout.
- `saasmaker.com` is a separate AWS Route 53 domain and should not be used for
  this SEO program unless it is later redirected to `sassmaker.com`.
- Wrangler OAuth is authenticated for Cloudflare Pages/Workers operations.
- The current token can read the `sassmaker.com` zone but does not have DNS
  record edit permission.
- Audit source is Cloudflare Pages project inventory, `wrangler.toml` /
  `wrangler.jsonc`, and Fleet README project status.

## Canonical Domain Recommendation

Use `*.sassmaker.com` for the long-term product grid. Do not mix
`saasmaker.com` and `sassmaker.com` for SEO unless one is explicitly redirected
to the other.

## Fleet Ops Console

Requested target: `https://fleet.sassmaker.com`

Current implementation state:

- Local Cloudflare Tunnel ingress includes `fleet.sassmaker.com` and points it
  at `http://127.0.0.1:4329`.
- Required DNS target when DNS access is available:
  `fceb4f22-db20-4e77-88cf-07c1f290fd42.cfargotunnel.com`
- Current blocker: creating the DNS CNAME needs DNS record edit permission for
  the `sassmaker.com` zone.

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

## Needs Domain Assignment

These are non-archived projects without their own active fleet product domain.
Default to stable `*.sassmaker.com` hostnames unless a separate brand domain is
purchased later.

| Priority | Project | Current CF target/config | Proposed canonical | SEO posture |
|---:|---|---|---|---|
| 0 | `fleet-ops` | Cloudflare Tunnel prepared | `fleet.sassmaker.com` | Operator console. Index the public fleet map; noindex private host diagnostics. |
| 1 | `reader` | Worker, no routes | `reader.sassmaker.com` | Public research library. Needs crawlable landing, `/sitemap.xml`, article/library index, OG defaults. |
| 1 | `swe-interview-prep` | Pages domain attached, initializing | `interview.sassmaker.com` | Evergreen learning content. Needs concept pages, problem index, sitemap. |
| 1 | `research-papers` | Pages demo | `papers.sassmaker.com`, `api.papers.sassmaker.com` | Research search/RAG surface. Needs crawlable paths, cited answer examples, and paper-topic hubs. |
| 1 | `knowledge-base` | private/search infra | `search.sassmaker.com`, `api.search.sassmaker.com` | Private Agent Search. Public SEO should be docs/use-cases only; keep private indexes noindex. |
| 2 | `anime-list` | Pages domain attached, initializing | `anime.sassmaker.com` | Free tool. Needs canonical metadata and indexable anime/manga routes. |
| 2 | `looptv` | Pages domain attached, initializing | `tv.sassmaker.com` | Free tool. Needs curated channel/category pages, sitemap. |
| 2 | `starboard` | Worker route config prepared | `starboard.sassmaker.com` | SaaS surface. Could also become `stars.codevetter.com` if codevetter umbrella wins. |
| 2 | `drank` | support app | `domains.sassmaker.com`, `api.domains.sassmaker.com` | Domain-rating support surface. SEO via DR explainer, tracked-domain examples, and High Signal backlinks. |
| 3 | `email-manager` | Worker route config prepared | `mail.sassmaker.com` | Likely auth-heavy. Use marketing/docs pages for SEO, keep app noindex if private. |
| 3 | `free-ai` | Worker route config prepared | `ai.sassmaker.com` | API gateway/docs. SEO via docs and model/provider pages; API base can be `api.ai.sassmaker.com`. |
| 4 | `reel-pipeline` | Worker route config prepared | `reels.sassmaker.com` | Mostly support infra. SEO only if there is a public gallery/docs surface. |

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

## Apply Plan

1. Add DNS edit permission for `sassmaker.com` or create required DNS records
   manually in the Cloudflare dashboard.
2. Deploy Worker projects after reviewing unrelated dirty local changes:
   `email-manager`, `reader`, `free-ai`, `starboard`, `reel-pipeline`.
3. Update each app's public env/canonical metadata.
4. Add or verify `robots.txt`, `sitemap.xml`, and default SEO metadata.
5. Submit sitemaps and track indexing.

## Current Blockers

- Current Wrangler OAuth lacks DNS record edit permission.
- Several Worker repos have unrelated dirty files, so route config changes are
  prepared but not deployed from this checkout.
