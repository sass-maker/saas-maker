# Fleet GEO/SEO audit report — 2026-07-17

Independent 7-agent audit of the GEO / SEO / IndexNow / deploy session.
Read-only; live evidence preferred over git claims. Companion to
`audit-prompt-geo-seo-session.md` and `session-handoff-geo-seo.md`.

## Executive verdict

The mechanical work is real: 24/24 hosts serve valid llms.txt / api/ai /
index.md, IndexNow keys are 23/23 live (better than the handoff's 22/23), and
the tooling is production-ready. But the outcome layer is broken in three ways
the session never noticed: **13 of 24 hosts block the very AI crawlers GEO
targets** (Cloudflare managed robots.txt on the sassmaker.com and
significanthobbies.com zones), **three repos are one deploy away from silently
deleting their live surfaces** (codevetter unpushed; pace + posttrainllm
stranded on feature branches), and **canonical-tag bugs de-index ~13.9k URLs**
(highsignal's whole corpus + rolepatch's /tools). The fleet's own audit tool
scored all of this S-tier — it needs fixing too.

## Live matrix (summary)

All 24 hosts: llms.txt = real text/plain starting `#`; api/ai = identical
10-key JSON schema; index.md = markdown; IndexNow keyfile = exact match
(truehire's prior HTML-SPA keyfile is fixed).

| Grade | Hosts |
|---|---|
| A | codevetter.com, rolepatch.com, highsignal.app, karte.cc, starboard.codevetter.com, ratings.highsignal.app, truehire.rolepatch.com, papers.highsignal.app, posttrainllm.com |
| B (AI-crawler robots block or canonical split) | significanthobbies.com, materia.significanthobbies.com, sassmaker.com, heypace.app (pages.dev split), domains.sassmaker.com, tv/anime/chess.significanthobbies.com, mail.sassmaker.com, ai-gateway.sassmaker.com, performance.sassmaker.com |
| C (broken required surface) | docs.sassmaker.com (llms-full.txt 404 while advertised in api/ai), read.significanthobbies.com (sitemap = SPA HTML + workers.dev host leak, no robots Sitemap line), learn.significanthobbies.com (robots advertises sitemap that returns SPA HTML) |

## Failures / gaps

**P0 — AI crawlers blocked on 13 hosts.** Every host on the sassmaker.com and
significanthobbies.com zones serves Cloudflare "managed content" robots.txt:
`Disallow: /` for ClaudeBot, GPTBot, CCBot, Google-Extended, Amazonbot,
Applebot-Extended, Bytespider, meta-externalagent (+ `Content-Signal:
ai-train=no`). This defeats the purpose of every agent surface on those zones.
Fix: turn off the zone-level "block AI bots" setting (or explicitly accept
degraded GEO there).

**P0 — Deployed-but-not-in-main surfaces (3 repos).**
- codevetter: 3 unpushed local commits (surfaces, worker proxy, key). Push
  blocked by husky false-positive — `.husky/pre-push` greps all tracked files
  and trips on detector *fixtures* in `secret_policy.rs:160,163`. Safe fix:
  exclude that file or scan only the push range.
- pace: GEO commits only on `agent/update-repository-ownership-references`;
  origin/main has no agent files. Site live only via local wrangler deploy.
- posttrainllm: GEO + 286-page Blume docs site only on
  `agent/plan-mac-local-autocorrect-specialist`; 21 files also uncommitted.
A dispatched deploy from main on any of the three silently deletes the live
surfaces.

**P0/P1 — Canonical collapse.**
- highsignal.app: ~13,862 sitemap URLs, and non-homepage pages (briefs, signal
  details) all declare `canonical → https://highsignal.app` — the whole corpus
  self-de-indexed. Also "— High Signal — High Signal" title doubling.
- rolepatch.com: all /tools/* pages canonical → homepage; the free-tool pages
  (best organic magnet) are 100% de-indexed. Also `| RolePatch | RolePatch`.
- posttrainllm.com: canonicals point at `.html` variants that 308-redirect
  back; sitemap disagrees with canonical on every deep page.

**P1 — Audit tool (`agent-ready/scripts/agent-index-audit.mjs`) is misleading.**
Reads target list from `saas-maker/scripts/lib/fleet-health-contracts.mjs`,
not the registry (audits pace at pages.dev; includes 4 non-registry products);
passes robots that block GPTBot/ClaudeBot; passes sitemaps without validating
XML or `<loc>` host (reader scored S with a broken sitemap); never checks
llms-full or keyfiles.

**P1 — Hub link equity never shipped.** `geo-dr-outcomes.md` Workstream B item
3 claims sassmaker.com links out to product roots (dofollow). Live homepage
has zero HTML anchors to any product domain — products exist only in llms.txt
(no link equity).

**P1 — SPA sitemaps (known, still broken):** reader and swe-interview-prep as
above.

**P2:** pace canonical split (registry, llms.txt, api/ai all still say
pace-6xg.pages.dev); SVG og:images on rolepatch/codevetter/sassmaker (social
platforms won't render SVG; codevetter's is a 575-byte placeholder);
heypace og-image.png 1.07MB (WhatsApp cap ~600KB); no favicon at all on
rolepatch + highsignal; www.* serves 200 duplicates with no redirect on 7
apex domains; Astro sitemaps missing lastmod; docs.sassmaker.com llms-full
404; materia doubled cache-control header; seo-audit.sh false positives
(multi-line h1, code-sample "ssr-leak").

## IndexNow readiness

**READY — and the handoff slightly undersold it** (23/23 keys live vs claimed
22/23). Dry-run verified non-submitting; per-host scoping, keyLocation, and
HTML-sitemap detection are spec-correct. Robustness bugs to fix before relying
on it at scale: no try/catch/retry around the submit fetch (one transient
network error aborts all remaining hosts), no fetch timeouts, `--max` with a
missing value silently collects 0 URLs, every run re-submits all ~1057 URLs
(needs a state file for changed-only), pace's heypace.app override is
hardcoded in the script instead of the registry, and always-submitted
`/api/ai` + `/llms-full.txt` 404 on some hosts.

## Directory spray value

**Cannot move DR — and the docs already admit it.** Of 842 product×directory
pairs: 116 `submitted_likely` (heuristic toast detection, all low-authority
moderation queues on ~4 domains), 623 `submitted_unknown` (write these off),
103 blocked/no-form/error. The 23 toolfinder fills are behind a $29 paywall
(void). Likely bug: the Insidr filler puts the URL in the *name* field and
categories in the *email* field — even the 22 "confirmed" Insidr entries may
be rejected. The valuable directories (PH, HN, AlternativeTo, SaaSHub, G2,
DevHunt) are exactly the CAPTCHA/OAuth-walled ones: the automatable set and
the valuable set are disjoint. Zero listings have been verified published;
probe in 1–2 weeks before any resubmission.

## Web discoverability (reality check)

The "strong four" claim (RolePatch/CodeVetter/Foundry/AliveVille) does not
hold. Real state: **CodeVetter is the only A** (own domain ranks, rich
snippets). rolepatch.com doesn't rank for its own brand (sassmaker hub ranks
#2 for it; API docs own the SERP — winnable once indexed). "Foundry" as a term
is unwinnable; market as "sassmaker" (ranks #1). highsignal.app, heypace.app,
posttrainllm.com, karte.cc appear entirely absent from Google's index.
Collisions bad enough to reconsider spend: **karte** (PLAID's KARTE AI +
German generic word — rename or go agent-native), **starboard** (char/starboard,
same niche), **high signal** (highsignal.io newsletter, same audience),
**pace** (withpace.com; even @heypace handles owned by others).

## Residual risks

- 3 repos with deploy-will-delete-surfaces drift (above) — fix before any
  dispatched deploy.
- codevetter stash `wip-before-agent-push` holds large unrelated WIP; two
  unmerged backup branches with no upstream.
- protein-index has 17 modified files + untracked openspec change uncommitted.
- Fleet root: SCORECARD.md row uncommitted (benign — commit it).
- 623 unknown spray submissions with the fleet's real product data on
  low-quality directories (accepted cost; not retrievable).

## Recommended next 7 actions

1. **Unblock AI crawlers**: disable Cloudflare AI-bot blocking / managed
   robots.txt on the sassmaker.com and significanthobbies.com zones; re-verify
   robots.txt on all 13 hosts.
2. **Rescue stranded git**: fix codevetter `.husky/pre-push` exclusion, push
   main; merge pace + posttrainllm agent branches into main (commit/stash
   posttrainllm's 21 dirty files first); commit fleet SCORECARD.md.
3. **Fix canonical templates**: highsignal per-page self-canonicals (+title
   suffix bug), rolepatch /tools self-canonicals (+title doubling),
   posttrainllm extensionless canonicals. Unlocks ~13.9k URLs.
4. **GSC onboarding**: 7 DNS TXT domain properties via Cloudflare + sitemap
   submits (`sitemaps.submit` API for repeatability). Prereq for pace:
   consolidate canonical to heypace.app in registry + regenerate surfaces +
   301 pages.dev.
5. **Ship the hub links**: sassmaker.com fleet-directory section with real
   HTML anchors to all product roots (the strategy doc claims this exists).
6. **Fix the measurement tools**: agent-index-audit.mjs → read the registry,
   validate sitemap XML + host, fail robots blocking GPTBot/ClaudeBot, check
   advertised llms-full + keyfile; seo-audit.sh multi-line h1 + code-sample
   false positives; IndexNow retry/timeout/state-file.
7. **Fix social/link previews**: replace SVG og:images with 1200×630 PNG
   (rolepatch, codevetter, sassmaker), compress heypace og-image <300KB, add
   favicons to rolepatch + highsignal, og:image on rolepatch blog posts.

## What the previous agent overstated

- "sassmaker.com expanded as fleet citation hub" — no HTML product links
  shipped; the doc marks its own unfinished step as done.
- "23/23 live" GEO — surfaces yes, but 13 hosts simultaneously block the
  target crawlers; S-tier grades came from a tool that can't see the block.
- "Strong four" discoverability — only CodeVetter holds up; AliveVille was
  untestable (no public domain in the registry).
- Directory spray numbers drift across docs (3 vs 5 confirmed directories,
  46 vs 113 listings; status.json is the truth).

## What the previous agent understated / did well

- IndexNow: 23/23 keys live (claimed 22/23); dry-run genuinely safe; spec
  handling correct. truehire keyfile fixed.
- api/ai schema: zero drift across 24 hosts.
- karte worker multi-line-import fix held; all 19 patched .mjs files pass
  `node --check`; no uncommitted agent files anywhere (drift is branch-level
  only).
- geo-dr-outcomes.md's honesty about spray ≠ DR was correct and useful.
- Docs are within fleet length/DRY standards.

## Missed opportunities (cross-project) — top 10

Full per-project detail in the session transcript; ranked fleet-wide:

1. **codevetter**: publish the 27-case AI-code-review benchmark as a public
   page + downloadable dataset + Show HN (the fleet's best link-earning
   story, sitting unpublished). (M)
2. **sassmaker.com**: crawlable dofollow product links + thin per-product
   pages (= action 5 above). (S)
3. **Fleet-wide GitHub layer**: all 21 public repos across 6 orgs have zero
   topics; org READMEs thin; add topics + product-domain links in one
   scripted pass. (S)
4. **rolepatch**: standalone landing pages + FAQPage/SoftwareApplication
   JSON-LD for the 6 free /tools; unhide the orphaned blog. (S–M)
5. **pace**: real pricing + FAQ pages (tiers exist, commerce path is a
   mailto); canonical consolidation to heypace.app. (S)
6. **posttrainllm**: publish specialist models to Hugging Face with model
   cards linking back; real sitemap + JSON-LD; leaderboard JSON/CSV export. (M)
7. **high-signal**: NewsArticle JSON-LD + `rel=alternate` RSS declaration
   (feeds exist, invisible) + permanent brief archive URLs; beef up the
   296-word homepage. (S)
8. **materia**: 553 evidence-graded pages with zero distribution — one
   write-up + HN/reddit for the interaction checker + knowledge-graph JSON
   export. (M)
9. **anime-list**: prerender top ~1k per-anime detail pages (largest raw
   pSEO unlock in the fleet; currently SPA-invisible). (M–L)
10. **karte**: sitemap + ProfilePage schema for 553 public profiles + a
    browsable agent-registry index — or decide the rename first. (M)

Fleet-wide patterns worth turning into standards: JSON-LD via
apply-agent-surfaces (registry already has the data); "no orphaned public
routes" lint (nav/footer + sitemap or explicitly parked); public `/data`
pages for the 7 products sitting on citable datasets; dogfood Foundry's own
changelog service on every domain; registry-driven shared footer for
cross-linking; comparison pages beyond pace (pattern proven, 15 pages);
AI-crawler hits from Cloudflare analytics as the real GEO KPI; Cloudflare
Crawler Hints (free auto-IndexNow); Bing Webmaster Tools import; llms.txt
registries over generic web directories.
