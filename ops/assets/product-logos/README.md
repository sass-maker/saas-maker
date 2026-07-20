# Fleet product logos (finalized set)

Geometric path marks per product. Source of truth for favicons is each product `public/` via
`fleet-ops/scripts/generate-favicons.mjs` (registry products) or the files below.

## Finalized by hand

| Product | Mark |
|---|---|
| **Foundry / sass-maker** | Gold layers (B) |
| **RolePatch** | L-mono parallel lines |

## Registry products (23)

| ID | Name | URL | Archive |
|---|---|---|---|
| `codevetter` | CodeVetter | https://codevetter.com | `codevetter-mark.svg` / `codevetter-1024.png` |
| `rolepatch` | RolePatch | https://rolepatch.com | `rolepatch-mark.svg` / `rolepatch-1024.png` |
| `high-signal` | High Signal | https://highsignal.app | `high-signal-mark.svg` / `high-signal-1024.png` |
| `karte` | Karte | https://karte.cc | `karte-mark.svg` / `karte-1024.png` |
| `significanthobbies` | Significant Hobbies | https://significanthobbies.com | `significanthobbies-mark.svg` / `significanthobbies-1024.png` |
| `materia` | Materia | https://materia.significanthobbies.com | `materia-mark.svg` / `materia-1024.png` |
| `saas-maker-showcase` | Foundry (SaaS Maker) | https://sassmaker.com | `saas-maker-showcase-mark.svg` / `saas-maker-showcase-1024.png` |
| `saas-maker-docs` | SaaS Maker Docs | https://docs.sassmaker.com | `saas-maker-docs-mark.svg` / `saas-maker-docs-1024.png` |
| `starboard` | Starboard | https://starboard.codevetter.com | `starboard-mark.svg` / `starboard-1024.png` |
| `everythingrated` | EverythingRated | https://ratings.highsignal.app | `everythingrated-mark.svg` / `everythingrated-1024.png` |
| `truehire` | TrueHire | https://truehire.rolepatch.com | `truehire-mark.svg` / `truehire-1024.png` |
| `research-papers` | researchPapers | https://papers.highsignal.app | `research-papers-mark.svg` / `research-papers-1024.png` |
| `posttrainllm` | PostTrainLLM | https://posttrainllm.com | `posttrainllm-mark.svg` / `posttrainllm-1024.png` |
| `pace` | Pace | https://heypace.app | `pace-mark.svg` / `pace-1024.png` |
| `drank` | DRank | https://domains.sassmaker.com | `drank-mark.svg` / `drank-1024.png` |
| `looptv` | LoopTV | https://tv.significanthobbies.com | `looptv-mark.svg` / `looptv-1024.png` |
| `anime-list` | MAL Explorer | https://anime.significanthobbies.com | `anime-list-mark.svg` / `anime-list-1024.png` |
| `chess` | Chess Coach | https://chess.significanthobbies.com | `chess-mark.svg` / `chess-1024.png` |
| `reader` | Reader | https://read.significanthobbies.com | `reader-mark.svg` / `reader-1024.png` |
| `email-manager` | Email Manager | https://mail.sassmaker.com | `email-manager-mark.svg` / `email-manager-1024.png` |
| `free-ai` | AI Gateway | https://ai-gateway.sassmaker.com | `free-ai-mark.svg` / `free-ai-1024.png` |
| `swe-interview-prep` | SWE Interview Prep | https://learn.significanthobbies.com | `swe-interview-prep-mark.svg` / `swe-interview-prep-1024.png` |
| `psi-swarm` | psi-swarm | https://performance.sassmaker.com | `psi-swarm-mark.svg` / `psi-swarm-1024.png` |

## Outside registry

| ID | Notes |
|---|---|
| `aliveville` | ai-game landing + web3d |
| `protein-index` | public/ |
| `knowledge-base` | fullstack public |
| `web-playables` | public/ |
| `reel-pipeline` | openshorts dashboard |
| `mobile-dev-cockpit` | Expo assets |

## GitHub orgs (owned, excl. Vault)

Marks in `../github-org-logos/` — upload manually (no API):

- Codevetter, High-Signal-App, Significant-Hobbies, HeyPace, PostTrainLLM, sass-maker
- RolePatch is a **user** repo brand (`rolepatch-mark.svg`), not an org

## Regenerate registry favicons

```bash
node fleet-ops/scripts/generate-favicons.mjs
```
