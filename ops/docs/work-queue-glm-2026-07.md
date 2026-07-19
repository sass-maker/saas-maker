# glm-5.2 work queue — writing + code grunt (2026-07-17)

Self-contained briefs, ordered by ROI. One brief per session; commit per
repo; follow the repo's AGENTS.md, `LANDING_STANDARD.md` for marketing
surfaces, and fleet doc shape rules. **Quality guardrail on ALL content
tasks: every page must be anchored to real data/functionality the product
owns. No generic AI prose — thin content gets the whole domain punished.**

Already assigned: `openspec/changes/fleet-jsonld-emission` (fleet root) and
`anime-list/openspec/changes/prerender-detail-pages` — do those first; they
have full specs. Everything below is queue order after them.

Companion: `work-queue-browser-2026-07.md` (dashboard/launch tasks),
`audit-report-geo-seo-2026-07-17.md` (evidence).

## G1 — codevetter: publish the benchmark · M · feeds Show HN launch

Repo `codevetter/`, landing site `apps/landing-page-astro/`.
- New page `/benchmark` (exists as stub? check sitemap — 5 URLs incl.
  /benchmark): expand into the full story — 27 cases from
  `benchmark/cases/` (real agent-written bugs), catch-rate scoring method,
  per-reviewer results table, honest limitations section.
- Downloadable dataset: `public/benchmark/codevetter-benchmark-v1.json`
  (cases + expected findings + license note) linked from the page.
- Draft `docs/show-hn.md`: title options + first-comment text (plain,
  technical, no marketing voice).
- Accept: page builds, dataset link 200s locally, JSON parses,
  Dataset JSON-LD on the page.

## G2 — rolepatch: tool landing pages + blog surfacing · S-M

Repo `rolepatch/` (Astro or OpenNext — check; canonicals fixed ff914f1).
- Per-tool unique title/H1/meta + 2-3 paragraphs of real how-it-works +
  FAQPage JSON-LD for the 6 tools under `/tools/*` (ats-check, keywords,
  word-count, bullet-check, diff, snippets). Target queries like "free ATS
  resume checker" — say what the tool actually does, no fluff.
- Add Blog to site nav; blog index page; RSS feed (`/blog/rss.xml`) +
  `<link rel="alternate">`; og:image on each post (reuse homepage PNG).
- Accept: each tool page has unique title + self-canonical (already) +
  FAQPage block that parses; feed validates.

## G3 — pace: pricing + FAQ pages · S

Repo `pace/website/` (Astro). Tiers exist in `PROJECT_STATUS.md`
(Try/Pace/Studio) but site commerce path is a mailto.
- `/pricing`: real tier table (features/limits per tier from
  PROJECT_STATUS — do not invent prices; if a price is undecided, "contact"
  for that tier), Product/Offer JSON-LD.
- `/faq`: harvest existing FAQ content from feature pages; FAQPage JSON-LD.
- Both linked in nav + footer; add to sitemap.
- Accept: build passes, both pages in sitemap, JSON-LD parses.

## G4 — posttrainllm: HF cards + exports + rebrand pass · M

Repo `posttrainllm/`.
- Write HF model cards (`docs/hf-cards/<model>.md`) for each specialist in
  `docs/factory/public-artifacts.md`: eval numbers from the leaderboard,
  training recipe summary, limitations, link to posttrainllm.com. Include
  the `huggingface-cli upload` commands per card (human runs them — B7).
- Leaderboard export: `browser/public/data/leaderboard.json` + `.csv`
  generated from the same source the leaderboard page renders; link
  "Download data" on the page; Dataset JSON-LD.
- Devlog RSS (`/devlog/rss.xml`) + `<link rel="alternate">`.
- Rebrand pass: ~106 docs-site files still say "TinyGPT" (see PR #61 note)
  → PostTrainLLM, EXCEPT code paths/module names that really are `TinyGPT`
  (native-mac module) — brand text only, not identifiers.
- Accept: builds; exports parse; grep for stray brand-text "TinyGPT" in
  docs-site markdown returns only intentional code references.

## G5 — high-signal: homepage + archive + dataset page · S-M

Repo `high-signal/apps/web/` (Next/OpenNext; canonicals+RSS decl fixed).
- Homepage: ~296 words today. Add sections rendered from real data:
  today's top 3 signals, hit-rate summary (from track-record data),
  methodology digest, FAQ. Target 700+ words of real substance, h2s.
- Permanent archive: briefs currently expire ~28 days — make
  `/brief/<date>` URLs permanent (keep serving old briefs), archive index
  page, sitemap inclusion.
- `/data`: public hit-rate ledger page — downloadable JSON/CSV of
  predictions vs outcomes, Dataset JSON-LD ("AI forecasting accuracy
  dataset" is the citable asset).
- Accept: build passes; old brief URL still 200s; dataset files parse.

## G6 — materia: distribution assets · M

Repo `materia/` (Astro, 553 evidence-graded pages, zero promotion).
- Knowledge-graph export: `public/data/materia-graph.json`
  (remedy→condition→study edges from the content collection) + `/data`
  page with Dataset JSON-LD.
- Write-up `docs/launch-post.md`: "an evidence-graded map of every remedy
  claim" — structure, grading method, what's NOT claimed. For HN/reddit
  (B8-2), factual voice.
- Checker landing: `/checker` gets a real title/meta/HowTo JSON-LD +
  explanation of the interaction data source.
- Accept: graph JSON parses + node/edge counts logged; pages build.

## G7 — Public /data pages sweep · S each

Same pattern as G5/G6 for: **drank** (`data/global-dr.json` → /data page,
weekly DR movers table), **research-papers** (corpus stats page + download;
plus `citation_*` meta tags + ScholarlyArticle JSON-LD on paper pages),
**free-ai** (human-readable status page rendering `/v1/models` +
`/v1/stats/providers`), **looptv** (catalog page + VideoObject schema,
low priority).
- Accept per product: page builds, dataset link 200s locally, JSON-LD parses.

## G8 — everythingrated: rating schema · S

Repo `everythingrated/`. AggregateRating/Product (or Review) JSON-LD on item
pages from real rating data; advertise the existing per-directory JSON/RSS
feeds with `<link rel="alternate">` + a /feeds page.
- Accept: sample item page block validates in Rich Results shape.

## G9 — sassmaker hub: per-product pages + build log · M

Repo `saas-maker/apps/showcase/` (hub directory shipped f1a0ea3).
- Per-product mini pages `/p/<id>` rendered from
  `fleet-ops/config/agent-surfaces-registry.json` (name, summary, links,
  llms.txt pointer) — crawlable HTML, in sitemap, linked from the directory.
- `/build-log`: the fleet story as dated entries (solo builder + agents,
  real milestones from git history) — the linkable narrative asset.
- Expand the 6 GitHub org profile READMEs (Codevetter, HeyPace,
  PostTrainLLM, High-Signal-App, Significant-Hobbies, sass-maker): what the
  org ships, product domain links, hub link.
- Accept: pages build; each org README pushed.

## G10 — fleet-wide small fixes · S

- `fleet-ops/skills/seo-audit/scripts/seo-audit.sh`: fix multi-line-h1
  false "empty h1", code-sample ssr-leak false positive, large-sitemap
  coverage check.
- Meta-description length clamp (70–160 chars) in each site's SEO template:
  highsignal, heypace /compared/*, posttrainllm, codevetter /download.
- significanthobbies: blog index reachable from nav; brand+category title.
- Accept: seo-audit.sh re-run on the 6 flagship sites shows the false
  positives gone and no new FAILs.

## Deferred pending user decisions

- **karte** (rename decision): profiles sitemap + ProfilePage schema +
  registry index page — do not start until the name question is settled.
- **starboard** (same-niche OSS collision): GitHub-native distribution only.
- **chess**: rate-limit the AI proxy before any promotion work.

## G11 — post-review follow-ups (added 2026-07-17 after the review pass)

Small items from the fleet review; all verified-real gaps, none blocking:
1. high-signal: add `/data/hit-rate.json` + `.csv` as DataDownload
   distributions in the Dataset JSON-LD (currently only the old
   track-record.json is declared); remove the now-unneeded
   `biome-ignore lint/complexity/useLiteralKeys` comments (rule is off
   repo-wide since 9933112 — they warn as unused suppressions).
2. research-papers: add `citation_author` meta tags (Google Scholar treats
   them as required); drop the nonstandard `citation_in_corpus_citations`.
3. rolepatch: upgrade the 3 remaining short tool H1s (ats-check,
   word-count, snippets) to keyword-rich variants; apply the brand title
   suffix under the tools/* segment.
4. posttrainllm: devlog RSS entries are a hand-maintained array mirroring
   devlog.astro anchors — derive both from one source before they drift.
5. saas-maker showcase build-log: 8 entries have `sha: '—'` with
   paraphrased messages while the page claims verbatim git provenance —
   either find the real SHAs or soften the page's claim.
6. JSON-LD coverage gap: saas-maker-docs and psi-swarm have neither a
   headFile injection nor an emitted snippet (21/23 covered) — add
   headFile entries or emit + insert snippets.
7. Org profile READMEs: glm's expanded drafts sit in
   saas-maker/docs/org-profiles/ while a different session pushed thinner
   live versions the same day — needs a reconciliation decision from the
   user before pushing either.
