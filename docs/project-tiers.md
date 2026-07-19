# Fleet attention model (2026-07-19)

This is the human source of truth for how Sarthak allocates attention across
the fleet. It classifies obligations, not repositories or deploy surfaces.
`fleet-ops/config/projects.json` remains the machine-readable inventory for
repositories, Cloudflare projects, domains, and deployment status.
The cross-repository implementation plan lives in the registered OpenSpec Store
`fleet-automation-closure`; the executable attention and evidence contract is
`fleet-ops/config/automation-registry.json`. Do not duplicate either plan into
individual product repositories.

The daily operating view is intentionally small:

1. **My Work** — commercial products whose direction and product work are led
   by Sarthak.
2. **Toolbox** — finished or mostly finished projects that remain usable and
   receive quiet, automated marketing and bounded experiments.
3. **Foundry + Helpers** — one factory for planning, building, operating, and
   marketing the fleet. Helper surfaces may remain separately deployable while
   converging on one Foundry workstream.
4. **Ignored** — frozen or retired work. Preserve it where convenient, but do
   not create routine maintenance, marketing, or roadmap obligations.
5. **Removed** — attribution-only records. Exclude them from all operations.

## My Work — 4

- CodeVetter
- HeyPace
- PostTrainLLM
- High Signal

Agents may test, monitor, document, research, and report on these products, but
Sarthak owns their direction and decides when product work happens.

## Toolbox — 15

- Personal website
- RolePatch
- Karte
- Significant Hobbies
- Reader
- Anime List
- SWE Interview Prep
- Email Manager
- LoopTV
- Chess
- Motion
- Research Papers
- Starboard
- Free AI
- Knowledge Base

Toolbox projects should remain usable and discoverable without becoming active
commitments. Default automation is limited to lightweight build/availability
checks, basic dependency and domain hygiene, indexing, directory links, and
quiet marketing experiments. Do not create standing feature roadmaps, manual
content schedules, paid-acquisition work, or autonomous product expansion.

If a Toolbox project earns attention through real use, traction, or an explicit
decision, it can move into My Work. Until then, fix it when needed and keep it
quiet.

## Foundry + Helpers — 6

- SaaS Maker / Foundry
- Fleet Dashboard (`fleet.sassmaker.com`)
- PSI Swarm
- Mobile Dev Cockpit
- Drank
- Reel Pipeline

Treat these as one Foundry workstream, not six product bets. Foundry is the
factory for:

- **Planning:** portfolio context, priorities, specs, research, documentation,
  and task routing.
- **Building:** agent workflows, CI and release readiness, deployment
  visibility, and fleet health.
- **Marketing:** domains, landing pages, indexing, performance, content, and
  distribution.

Consolidate ownership, registry data, dashboards, documentation, and workflows
before physically merging repositories. A helper may remain an independently
deployed package, Worker, or app when its runtime boundary is useful.

## Ignored — 9

- AliveVille
- Open Historia
- TrueHire
- Companion Robot
- Materia
- EverythingRated
- Protein Index
- Web Playables
- SaaS Ideas

These are frozen or retired. Do not include them in routine sweeps, maintenance
queues, marketing programs, or planning. Work on one only after an explicit
reactivation decision.

## Removed — 3

- Elves HQ
- Today Little Log
- Forecast Lab

Keep only enough history to preserve attribution and explain what happened.
Removed entries receive no deploy, domain, monitoring, documentation, marketing,
or maintenance work and should not appear in active fleet counts.

## Automation view

| Attention | Treatment |
|---|---|
| My Work | Human-led product direction; automation provides evidence and guardrails |
| Toolbox | Maintain usability and ambient discoverability; run bounded experiments |
| Foundry + Helpers | Improve the shared factory when it reduces work across the fleet |
| Ignored | No routine work; reactivate explicitly |
| Removed | Attribution only; exclude everywhere operational |

The catalog contains 37 named entries: 4 My Work, 15 Toolbox, 6 Foundry +
Helpers, 9 Ignored, and 3 Removed. Repository and deploy counts differ because
some entries are surfaces within a family and some historical entries have no
active deployment.
