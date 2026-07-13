# Domain Marketing Plan

Generated: 2026-07-11

This is the human-facing narrative for Fleet domains. The versioned machine
source of truth for project identity, operating mode, focus state, content-base
adapters, channel routes, cadence, and CTA is
`fleet-ops/config/marketing-program.json`; validate it with
`node fleet-ops/scripts/validate-marketing-program.mjs` before automation runs.
The three registry focus projects are `pace`, `codevetter`, and `tinygpt`.
Domain-backed non-focus projects remain evergreen or infrastructure programs as
declared in the registry; a historical plan being finished does not make an
unregistered project eligible for queue generation.

Before any queue-generation run, inspect the current authenticated backlog with
the aggregate-only command below. It emits no post content or identifiers and
guarantees `queueWrites: 0`:

```bash
fleet-ops/scripts/agent-bin/marketing-dry-run
```

If global or focus review debt exceeds the registry ceiling, or a focus project
already has open work/recent activity, stop at the reported review/recovery
action. The durable OpenClaw version uses the same command and records terminal
task plus Telegram completion/failure evidence.

## Domain-backed Projects

| Project | Domain | Registry mode | Marketing state | Primary CTA |
| --- | --- | --- | --- | --- |
| `pace` | `heypace.app` | Focus | Active | Download the Mac app / join release list |
| `codevetter` | `codevetter.com` | Focus | Active | Download desktop reviewer |
| `tinygpt` | `posttrainllm.com` | Focus | Active | Train or run a tiny local model |
| `saas-maker` | `sassmaker.com` | Infrastructure | Finished | Explore the fleet / use `fnd` |
| `aliveville` | `aliveville.com` | Evergreen | Finished | Play the Rival slice |
| `rolepatch` | `rolepatch.com` | Evergreen | Finished | Tailor a resume or browse jobs |
| `high-signal` | `highsignal.app` | Evergreen, source-backed | Active channel program | Read the daily brief |
| `karte` | `karte.cc` | Evergreen | Finished | Create an AI profile |
| `significanthobbies` | `significanthobbies.com` | Evergreen, source-backed | Active channel program | Pick a meaningful hobby path |

## Finished Non-focus Plans

### SaaS Maker

- **Positioning:** Cloudflare-first foundry for one-person SaaS fleets: task
  system, cockpit, widgets, docs, and fleet operations in one hub.
- **Audience:** solo builders running multiple products, agents maintaining a
  portfolio, and internal operators who need one source of truth.
- **Channels:** fleet case studies, Cloudflare/devtool posts, short demos of
  `fnd`, and internal links from every fleet product footer.
- **SEO:** `sassmaker.com`, `docs.sassmaker.com`, and `app.sassmaker.com`.
  Target "Cloudflare SaaS starter", "AI product cockpit", "feedback widget for
  SaaS", and "one person SaaS operations".
- **Content backlog:** fleet performance case study, task workflow walkthrough,
  feedback widget integration guide, marketing queue walkthrough.
- **Measurement:** docs click-through to app, widget installs, CLI auths,
  marketing queue ideas accepted.

### AliveVille

- **Positioning:** a browser-playable AI town where NPCs pursue goals, collide,
  and tell stories inside a small 3D world.
- **Audience:** AI game builders, simulation/gameplay researchers, players who
  enjoy emergent sandbox demos.
- **Channels:** short gameplay clips, "Rival slice" devlogs, WebGPU/agentic NPC
  writeups, itch/Reddit/Hacker News only after the playtest verdict is positive.
- **SEO:** `aliveville.com`, `/game`, `/privacy`, `/terms`. Target "AI NPC game",
  "browser AI world simulator", and "emergent NPC sandbox".
- **Content backlog:** 60-second Rival playthrough, Director Console explainer,
  postmortem on what makes NPCs feel alive.
- **Measurement:** landing-to-game click rate, first 60s retention, Rival slice
  completion, playtest fun verdict.

### RolePatch

- **Positioning:** AI job-search workbench that turns a role into a tailored
  resume, cover letter, company research, prep packet, and reviewed apply queue.
- **Audience:** job seekers who want quality over spray-and-pray applications.
- **Channels:** SEO job-search pages, short resume-tailoring demos, before/after
  resume clips, practical interview-prep posts.
- **SEO:** `rolepatch.com` plus `/jobs`, `/pricing`, `/proof`, `/blog`. Target
  "tailor resume to job", "AI cover letter", "resume role fit score", and
  "STAR interview prep".
- **Content backlog:** one resume before/after, one proof preview, one apply
  queue walkthrough, weekly "role fit teardown" examples.
- **Measurement:** guest tailor starts, job saves, proof previews, checkout
  starts, successful apply packets.

### High Signal

- **Positioning:** daily synthesized intelligence from noisy public markets,
  startups, security, finance, domains, and product signals.
- **Audience:** founders, investors, product operators, and builders who need
  concise signal rather than feeds.
- **Channels:** daily brief excerpts, case studies, methodology pages, domains
  lens backlinks from Drank.
- **SEO:** `highsignal.app`, `/brief`, `/signals`, `/evidence`,
  `/methodology`, `/domains`. Target "daily intelligence brief", "startup trend
  signals", "brand perception monitoring", and "domain rating tracker".
- **Content backlog:** public methodology explainer, "how a signal becomes a
  brief item", weekly top signals roundup.
- **Measurement:** brief opens, saved entities, evidence clicks, email delivery
  opt-ins, tracked-domain referrals.

### Karte

- **Positioning:** AI link-in-bio that turns a profile into a chatty, searchable
  personal page with links, lore, and personality.
- **Audience:** creators, founders, consultants, and public internet people who
  answer repeated questions.
- **Channels:** profile examples, creator onboarding emails, custom-domain proof
  strip, short "ask my profile" demos.
- **SEO:** `karte.cc`, wildcard custom profile hosts, glossary/use-case cluster.
  Target "AI link in bio", "chat with my profile", "creator FAQ page", and
  "personal AI profile".
- **Content backlog:** three example profiles, custom-domain setup page, profile
  activation checklist, onboarding email sequence.
- **Measurement:** profile creations, imported links, first public share, visitor
  questions, email captures.

### Significant Hobbies

- **Positioning:** life planner for finding, choosing, and sustaining meaningful
  hobbies and side quests.
- **Audience:** adults who want healthier leisure, identity exploration, and
  structured hobby experiments.
- **Channels:** SEO content clusters, seasonal hobby pages, mental-health hobby
  pages, Pinterest/search-friendly evergreen pages.
- **SEO:** `significanthobbies.com`, `/hobbies-for-mental-health`,
  `/cheap-hobbies`, hobby category pages, sitemap. Target "meaningful hobbies",
  "hobbies for mental health", "cheap hobbies", and "what hobby should I try".
- **Content backlog:** update keyword clusters, add internal links to public
  hobby paths, publish seasonal hobby pages before quarter turns.
- **Measurement:** organic sessions, quiz/path starts, saved plans, return visits,
  public profile creation.

## Active Focus Plans

### Pace

- **Positioning:** local-first Mac voice agent with sub-second spoken answers,
  screen context, and approved macOS actions.
- **Current marketing job:** prove "fast, private, local" with real Mac demos,
  not generic AI assistant copy.
- **Next assets:** 60-second hotkey demo, model/privacy explainer, comparison
  versus cloud assistants, release/install page.

### CodeVetter

- **Positioning:** local-first desktop workbench for verifying agent-written
  code with evidence-backed review, QA, replay, and history.
- **Current marketing job:** turn recent telemetry and ShipRank work into
  trust-building proof, not broad IDE claims.
- **Next assets:** benchmark page, "review an agent PR" demo, comparison versus
  raw LLM review, downloadable release proof.

### TinyGPT

- **Positioning:** tiny local LLM factory and WebGPU playground for training,
  running, and understanding small models on one machine.
- **Current marketing job:** rename away from legacy PostTrainLLM when ready,
  then show credible measured training/perf claims.
- **Next assets:** browser playground demo, gallery story, performance proof
  page, migration plan for `tinygpt.sassmaker.com` or a purchased root domain.

## Canonical Product Surfaces

| Project | Canonical hostname | Necessary subdomains | Notes |
| --- | --- | --- | --- |
| `fleet-ops` | `fleet.sassmaker.com` | none | Live public read-only control and visibility dashboard. |
| `reader` | `read.significanthobbies.com` | none | Authenticated saved reading; private content remains noindex. |
| `swe-interview-prep` | `learn.significanthobbies.com` | none | Owner-authenticated Learning OS and daily sessions. |
| `research-papers` | `papers.highsignal.app` | none | Public research paths and Research Answer surface. |
| `knowledge-base` | `search.sassmaker.com` | none | Private Agent Search app; RAG API remains an internal Worker endpoint. |
| `anime-list` | `anime.significanthobbies.com` | none | Public anime and manga discovery. |
| `looptv` | `tv.significanthobbies.com` | none | Public curated channels and categories. |
| `starboard` | `starboard.codevetter.com` | none initially | CodeVetter umbrella branding won in the Starboard Worker config. |
| `drank` | `domains.sassmaker.com` | `api.domains.sassmaker.com` | Domain Rating support and High Signal backlinks. |
| `email-manager` | `mail.sassmaker.com` | none initially | Auth-heavy app; marketing/docs indexable, app private/noindex. |
| `free-ai` | `ai-gateway.sassmaker.com` | none | AI Gateway API, dashboard, and documentation. |
| `reel-pipeline` | `fleet.sassmaker.com/marketing` | none | Merged into Fleet; rendering and posting controls stay private. |

All listed canonical hostnames are live. The owning repositories carry these
hosts in runtime defaults, SEO metadata, deployment documentation, or route
configuration; Pages and `workers.dev` hostnames remain deployment aliases, not
product identity.

## Marketing Execution

The source-backed Reel Pipeline handles High Signal, Significant Hobbies, and
SWE Interview Prep directly. Versioned project campaigns now make the finished
non-focus plans for AliveVille, Karte, RolePatch, and SaaS Maker renderable from
their owning repository evidence. Every extracted item remains proposed until
content approval, and every distribution remains blocked until its exact social
account is connected and separately approved.
