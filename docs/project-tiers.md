# Fleet project tiers (2026-07-18)

Focus marking so effort lands on the right projects. Tiers are set at the
**project/family** level; a family's tier applies to its sub-surfaces unless an
exception is noted. Web surfaces map to
`fleet-ops/config/agent-surfaces-registry.json` (23 products under 8 families).

**Source of truth:** `fleet-ops/config/projects.json` is the machine-readable
manifest (tier + repo + deploy kind + CF project + domains for all 33
projects). This doc is the human narrative; the Cloudflare reconciliation +
hygiene flags are in `cloudflare-inventory-2026-07.md`.

## Tiers

- **Focus** — the active bets. Default target for planning, proof assets,
  deploys, and my/glm time. Everything non-trivial here gets done first.
- **Active** — real products getting maintenance + opportunistic improvement,
  but not the daily focus.
- **Secondary** — live, stable, low-touch. Fix when broken; don't invest.
- **Parked / experimental** — repos not in the public registry; work only when
  explicitly asked.
- **Out-of-fleet** — excluded from all fleet sweeps (AGENTS.md).
- **Scratch** — delete/ignore; not projects.

---

## Focus — the 3 core Mac apps ⭐

The current GEO/SEO + product-infra push. Plan: `geo-seo-plan-2026-07.md`;
tasks: `work-queue-glm-core-2026-07.md`.

| Project | Domain | Repo |
|---|---|---|
| **CodeVetter** | codevetter.com | `codevetter/` |
| **HeyPace** | heypace.app | `pace/` |
| **PostTrainLLM** | posttrainllm.com | `posttrainllm/` |

## Active — real products, maintained

| Project | Domain | Repo | Note |
|---|---|---|---|
| **saas-maker** | sassmaker.com (+ docs, drank, email-manager, free-ai, psi-swarm) | `saas-maker/`, `fleet-ops/psi-swarm/` | The hub + platform surfaces |
| **high-signal** | highsignal.app (+ everythingrated, research-papers) | `high-signal/` | |
| **materia** | materia.significanthobbies.com | `materia/` | Its own bet ("Examine.com of the body"), hosted on the SH domain |
| **knowledge-base** | knowledgebase.sassmaker.com + search.sassmaker.com | `knowledge-base/` | "Private Agent Search" — public landing/app surfaces plus fleet shared RAG service (RAG_SERVICE worker) |

## Secondary — live, low-touch

| Project | Domain | Repo |
|---|---|---|
| **significanthobbies** cluster: significanthobbies.com, looptv, anime-list, chess, reader, swe-interview-prep | *.significanthobbies.com | `significanthobbies/`, `anime-list/`, `chess/`, `looptv/`, `reader/`, `swe-interview-prep/` |
| **rolepatch** | rolepatch.com | `rolepatch/` |
| **karte** | karte.cc | `karte/` |
| **starboard** | starboard.codevetter.com | `starboard/` |

## Parked / experimental — non-registry repos

Work only when explicitly asked.

| Repo | What it is |
|---|---|
| `ai-game/` | Aliveville — world-sim game (parked, but **live**: aliveville.com + idle.aliveville.com) |
| `protein-index/` | experimental |
| `reel-pipeline/` | reel→Rust rewrite (greenlit, not active) |
| `web-playables/` | experimental |
| `mobile-dev-cockpit/` | tooling/experimental |

## Out-of-fleet (AGENTS.md — excluded from sweeps)

`open-historia`, `today-little-log`, `truehire` (also has a registry entry —
excluded regardless), `companion-robot`, `device-net-test`,
`forecast-lab`, `elves-hq`, `saas-maker-ci-fix`.

## Scratch — cleanup candidates (not projects)

`codevetter-rebuild-20260715T044829Z/`, `codevetter-series-20260715T044829Z/` —
timestamped worktree dumps. Safe to delete once confirmed no unmerged work.

---

## How to use

- **Planning / delegation:** default to Focus. Only touch Active/Secondary when
  asked or when a fleet-wide standard requires it.
- **Fleet sweeps** (`git-health.sh`, audits): exclude Out-of-fleet + Scratch.
- **Registry mirror (optional):** a `tier` field can be added per product in
  `agent-surfaces-registry.json` so tooling can filter by tier — not done yet;
  this doc is the source of truth for now.
