# SaaS Ideas Consolidation

Source: `https://github.com/sarthakagrawal927/saas-ideas` at commit `aba1a83`.
Date: 2026-06-03.

Purpose: preserve the useful product thinking from `saas-ideas` so that repo can
be retired without losing good directions. Active execution work belongs in
SaaS Maker Symphony tasks; this file is only the triage map.

## Imported Into Existing Fleet Projects

These ideas clearly complement existing projects and should live as product
tasks in those repos, not as standalone idea files.

| Idea cluster                                                                                      | Fleet home                                      | Why it fits                                                                                                                 |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Synthetic user QA, AI step-through debugging, commit/history explanation, VS Code pre-push review | `CodeVetter`                                    | CodeVetter is already the local verification layer for agent-written code.                                                  |
| Recruiter candidate intelligence and JD-to-candidate proof                                        | `truehire`                                      | TrueHire already converts verified GitHub evidence into recruiter-readable scores.                                          |
| Competitor listener, industry report, product-perception report                                   | `high-signal`                                   | High Signal already owns evidence-backed daily intelligence, mentions, and product-improvement ideas.                       |
| AI short video marketing product, trend-to-reel generation, performance-marketing agent ideas     | `reel-pipeline` plus SaaS Maker Marketing Queue | Reel Pipeline already renders accepted SaaS Maker queue ideas into short-form video artifacts.                              |
| LLM experiment/routing hub, benchmark and cost optimizer                                          | `free-ai`                                       | Free AI already routes OpenAI-compatible traffic across cheap/free providers with analytics.                                |
| Browser/content memory, query across captured web pages, blog-to-PDF capture                      | `reader`                                        | Reader already owns content capture, annotation, full-text search, PDFs, and AI chat.                                       |
| Magic Form, form-as-CMS, AI-generated forms, response analytics                                   | `saas-maker`                                    | SaaS Maker already owns reusable product blocks, feedback, waitlist, testimonials, roadmap, analytics, SDK, and widgets.    |
| AI feedback summarizer and app-store/review digest                                                | `saas-maker`                                    | This is a direct extension of feedback widgets, analytics, tasks, and product modules. Plan: [`docs/plans/2026-06-04-ai-feedback-digest-module.md`](../plans/2026-06-04-ai-feedback-digest-module.md). |
| Collaborative directory voting, domain/tool directories, tier lists, rate-anything variants       | `everythingrated`                               | EverythingRated already tests directory-specific multi-axis ratings; moderation must be planned before dynamic submissions. |
| StoryTunes, collaborative branching canon, AI co-authors                                          | `open-historia` or `linkchat`                   | The core loop overlaps with AI narrative/game rooms and real-time social collaboration.                                     |
| Anime personality quiz, cross-media recommendations, shareable identity badges                    | `anime_list`                                    | MAL Explorer already owns anime discovery and watchlist/recommendation behavior.                                            |
| Email memories and personal reporter digests                                                      | `email-manager` or `today-little-log`           | Keep this as personal workflow, not a commercial bet, unless usage proves pull.                                             |

## Prototype Task Map

As of 2026-06-04, the strong-fit ideas have completed Symphony prototype tasks.
These tasks produced visible or fixture-backed prototypes, not just another
brief. Parked/reference-only ideas below are intentionally excluded until there
is a clear build decision.

| Task ID  | Project           | Prototype task                                                            | Status |
| -------- | ----------------- | ------------------------------------------------------------------------- | ------ |
| 9f85ddb5 | `CodeVetter`      | Prototype synthetic QA replay runner                                      | done   |
| 8277934b | `CodeVetter`      | Prototype commit-history intent debugger                                  | done   |
| 9164bd9d | `truehire`        | Prototype JD-to-candidate proof comparison board                          | done   |
| 989f52c0 | `high-signal`     | Prototype competitor perception signal inbox                              | done   |
| b310a08a | `reel-pipeline`   | Prototype signal-to-reel draft generator                                  | done   |
| a931e421 | `free-ai`         | Prototype benchmark cost optimizer dashboard                              | done   |
| 8948f1db | `reader`          | Prototype browser memory search and blog-to-PDF capture                   | done   |
| 921eb03b | `saas-maker`      | Prototype Magic Form reusable product block                               | done   |
| 6bff9f2e | `saas-maker`      | Prototype AI feedback digest task generator                               | done   |
| 17386fdc | `everythingrated` | Prototype moderated dynamic directory submissions                         | done   |
| 14ad2fa6 | `open-historia`   | Prototype AI co-author branch archive for StoryTunes                      | done   |
| c48e7301 | `anime_list`      | Prototype privacy-safe anime identity quiz                                | done   |
| c22b4f2f | `email-manager`   | Prototype private email memories digest                                   | done   |
| 94da56c6 | `event-forecast`  | Prototype event-stream map and action report                              | done   |

## Remaining Worth Doing, Grouped

Do not create a new repo per idea. The hand-written notes contain roughly 250
idea bullets plus a 3,413-row scraped Starter Story reference dataset. The
reasonable consolidation is:

- existing-project extensions: most of the useful ideas
- net-new project candidates: 1 likely next project plus several parked
  candidates
- reference-only or parked: broad marketplaces, regulated ideas, gambling/cash
  games, and the scraped dataset

### Trustworthy AI Workbench

Home: `CodeVetter`.

Includes synthetic user QA, AI step-through debugger, commit intent mining,
repo-history explanation, pre-push checks, and agent provenance. The useful
question is whether the agent-built change actually works and whether the proof
is reproducible.

### Signal Studio

Home: `high-signal`, with rendering handoff to `reel-pipeline`.

Includes competitor listener, market mood scanner, community/subreddit digests,
customer-interview digest, trend finder, product-perception report, and idea to
reel conversion. Keep it evidence-backed; do not turn High Signal into broad SEO
content.

### Personal Memory OS

Home: `reader`, `email-manager`, and `today-little-log`.

Includes browser memory, email memories, personal reporter, web history search,
knowledge replay, daily pressure/mana checks, and life audit fragments. Keep
this personal and workflow-led before considering commercialization.

### Product Blocks And Launch Rails

Home: `saas-maker`.

Includes Magic Form, AI feedback summarizer, app-store/side-project marketplace,
mock API generator, pricing experiments, backlinks/partner widgets, common
wallet/credits, product desirability testing, and launch/distribution modules.
Only build blocks that repeat across fleet projects.

### Social Creative Worlds

Home: `open-historia`, `linkchat`, and maybe `ai-game`.

Includes StoryTunes, AI personality rooms, multiplayer story voting, blindfold
conversation, social character bots, collaborative event stories, and game-like
worldbuilding. The first proof should be a small playful loop, not a generic
social network.

### Rating And Directory Network

Home: `everythingrated`, with SaaS Maker support for widgets and metadata.

Includes directory maker, collaborative/vote-modified lists, domain/app
marketplaces, tier lists, professional/place directories, and "rate anything"
variants. Add moderation and trust mechanics before accepting public
submissions.

## Net-New Project Candidates

These are the remaining groups that are coherent enough to become new projects
later. They are not equal priority.

### Spatial And Behavior Analytics

Status: started locally as `event-forecast` on 2026-06-03.

This is the strongest standalone product direction from the remaining notes.
It combines:

- time-series geographical heatmaps
- demand forecasting from location/event streams
- user-flow and CTA analysis
- link-page / short-link super analytics
- pluggable recommendation/event systems
- automated "what changed / what to do next" reports

Why it is coherent: all of these are event streams becoming decision surfaces.
High Signal can consume the outputs, but the core product is an analytics
engine.

First proof: ingest one event stream, render a map or flow graph, and generate
one useful "what changed / what to do next" report.

### Data Glue Studio

Status: demoted to SaaS Maker / infra until there is direct pain.

This was too abstract as a standalone project. The useful pieces are
interoperability/data plumbing, schema mapping, identity resolution, dedupe,
lineage, business-logic glue, DB-to-sheet/Notion sync, mock API generation, and
high-volume table viewers.

Do not start this as a new repo now. Let SaaS Maker absorb the smallest repeated
block first. Revisit only if a real workflow keeps needing schema mapping or
sync/lineage.

## Distinct Parked Social And Identity Candidates

The previous "Identity And Community Graph" bucket merged distinct products.
Keep these separate:

### Profile Graph / About Me API

Personal profile as API: links, CV, accounts, redirects, profile export, and
family/private data sharing controls. Could complement LinkChat, but it is not
the same product as dating or family tree.

First proof: one profile page plus a JSON/profile API that another app can
consume.

### Family Tree / GiftMe

Family graph, birthdays/anniversaries, family posts, reminders, printable tree,
and gift coordination. GiftMe can be a wedge, but the full family graph is a
separate private-data product.

First proof: small family graph plus gift wishlist/contribution flow without
payments.

### Blindfold / Trait-Based Groups

Anonymous or semi-anonymous conversation matching, support groups, interest
groups, and reveal-after-conversation mechanics. This is a social experiment,
not the same as profile APIs or family trees.

First proof: one private matching room with opt-in reveal.

### Friend-Endorsed Dating

DateMyFriends style profile creation and friend-mediated introductions. This is
a separate dating product and should stay parked because trust, safety, and
moderation are the actual product.

First proof: none until there is an explicit decision to take on dating safety.

### Society Of Very Interesting People

High-end private community with interviews and curated member profiles. This is
more service/community than software. It could use LinkChat/Profile Graph tools,
but should not be treated as an app backlog.

## Reference Only Or Parked

- `solopreneur_ideas.json` and `.csv`: large scraped Starter Story reference
  dataset. Do not import wholesale into the fleet. Mine only when a specific
  research task needs market examples.
- Real-money gambling, betting, or cash-game variants: parked.
- Medical/herbal advice and prescription/test-result interpretation: parked
  unless there is a proper clinical, legal, and safety plan.
- Tourism transport, professional marketplaces, dating/matrimonial, adult
  school, local tourism, legal/CA directories, broad marketplaces: not current
  fleet focus.
- Generic games, generic social networks, generic productivity suites: only
  keep the parts that strengthen existing projects above.

## Source Files Scanned

- `README.md`
- `PROJECT-STRATEGY.md`
- `ai-ideas.md`
- `by-ai.md`
- `productivity.md`
- `magic-form.md`
- `ai-knowledge-app.md`
- `family-tree.md`
- `storytunes.md`
- `how-to.md`
- `solopreneur_ideas.json`
- `solopreneur_ideas.csv`
