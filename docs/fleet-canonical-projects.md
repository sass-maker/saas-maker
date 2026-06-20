# Fleet Canonical Projects

SaaS Maker should present one canonical display name per active fleet project. Keep external names such as GitHub repositories, Cloudflare project names, domains, and legacy folder names stable unless there is a planned migration.

Registry classification uses two separate fields:

- `category`: `product` for user-facing or portfolio products, `helper` for fleet support systems such as Foundry, Free AI, psi-swarm, and Reel Pipeline.
- `priority`: `P0`, `P1`, or `P2` for current attention level. Priority is not the same as commercial intent.

| Slug                 | Canonical display name | Production name/domain note                                              |
| -------------------- | ---------------------- | ------------------------------------------------------------------------ |
| `anime_list`         | MAL Explorer           | Cloudflare Pages project uses the legacy slug.                           |
| `CodeVetter`         | CodeVetter             | GitHub/local folder are still capitalized; do not rename casually.       |
| `drank`              | drank                  | Vercel app (drank-sand.vercel.app); shared DR data via GitHub Action.    |
| `email-manager`      | Email Manager          | Worker-backed product.                                                   |
| `event-forecast`     | Event Forecast         | Local Rust/Rocket forecasting service; no production URL yet.            |
| `everythingrated`    | EverythingRated        | Worker frontend with anonymous multi-axis ratings.                       |
| `free-ai`            | Free AI Gateway        | Gateway/API product, not a frontend.                                     |
| `ai-game`            | AI Game                | Public game domain is Aliveville; repo slug remains `ai-game`.           |
| `high-signal`        | High Signal            | Worker frontend.                                                         |
| `knowledgebase`      | Private Agent Search   | Local FastAPI search layer for private project corpora.                  |
| `linkchat`           | Linkchat               | Worker frontend.                                                         |
| `looptv`             | LoopTV                 | Keep label as LoopTV even if notes mention Loop TV.                      |
| `open-historia`      | Open Historia          | Worker frontend with Google login.                                       |
| `pace`               | Pace                   | Local macOS voice agent; previously discussed as Clicky Local / Space.   |
| `psi-swarm`          | psi-swarm              | Local CLI and browser controller for repeated Lighthouse audits.         |
| `reader`             | Reader                 | Worker frontend with Google login.                                       |
| `rag-service`        | RAG Service            | Standalone Cloudflare Worker RAG service for fleet knowledge search.     |
| `researchPapers`     | Research Papers        | Local academic-paper intelligence platform.                              |
| `reel-pipeline`      | Reel Pipeline          | Artifact Worker and R2-backed video pipeline.                            |
| `resume-tailor`      | RolePatch              | Product/domain name is RolePatch; repo slug remains `resume-tailor`.     |
| `saas-maker`         | SaaS Maker             | Production domain uses `sassmaker.com`; display name remains SaaS Maker. |
| `sarthakagrawal`     | sarthakagrawal.dev     | Personal Astro portfolio and project archive.                            |
| `significanthobbies` | Significant Hobbies    | Domain omits the hyphen.                                                 |
| `starboard`          | Starboard              | Worker frontend.                                                         |
| `swe-interview-prep` | Interview Coder        | Product name is Interview Coder; repo slug remains `swe-interview-prep`. |
| `taste`              | ShipRank               | Package/product name is ShipRank; repo slug remains `taste`.             |
| `tinygpt`            | TinyGPT                | Research/browser model project.                                          |
| `today-little-log`   | Today Little Log       | Pages frontend.                                                          |
| `truehire`           | TrueHire               | Worker frontend with GitHub login.                                       |
| `verified-bases`     | Verified Bases         | Personal verified-software storefront; deploy targets are split web/api. |

Hidden/removed projects should not appear in fleet dashboards or task project pickers: `ludo`, `chess`, `back-propogate`, `reel-maker`, `dev-learning`, `sarthak-blog`, `clash-royale-meta`, `personalsite`, `port-whisperer`, `local-ai`, and `vaulthealth`.

## Adding a Project

When a new active project joins the fleet, update these sources in one commit:

1. Add the project root `PROJECT_STATUS.md`.
2. Add a `foundry.projects.json` entry with the canonical slug, repository URL, tier, category, priority, and maturity.
3. Add the same slug to this document with the canonical display name and any naming/domain caveat future agents need.
4. Add a matching `FLEET_HEALTH_CONTRACTS` entry in `scripts/lib/fleet-health-contracts.mjs`. Use `prodUrl: null` and `smokeCommand: null` for local-only projects until a real production smoke exists.
5. Run `pnpm check:fleet-contracts` before committing.
