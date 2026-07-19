# Cloudflare resource accounting (2026-06-26)

Every Cloudflare resource mapped to an owning repo. Source of truth: `wrangler
pages project list` + Workers API, cross-referenced against repo wrangler
configs / workflows. After this pass: **19 Pages + 23 Workers, zero unaccounted.**

## Pages (19)

| Project | Owner repo |
|---|---|
| aliveville | ai-game (`deploy-aliveville.yml`) |
| anime-list | anime-list |
| codevetter | codevetter |
| drank | drank *(project created 2026-06-26)* |
| knowledgebase-landing | knowledge-base |
| looptv | looptv |
| materia | materia *(CI-connected 2026-06-26)* |
| pace | pace *(CI-connected 2026-06-26)* |
| research-papers | research-papers *(CI-connected 2026-06-26)* |
| shiprank | taste *(CI-connected 2026-06-26)* |
| swe-interview-prep | swe-interview-prep |
| tinygpt | tinygpt |
| today-little-log | today-little-log |
| verified-bases-web | verified-bases (native git-connected) |
| saas-maker-home, saas-maker-docs | saas-maker |
| psi-swarm-web | psi-swarm *(external repo)* |
| saas-ideas | saas-ideas *(external personal ideas repo — markdown, stale one-off deploy)* |
| sarthakagrawal | personal portfolio site *(external repo)* |

## Workers (23)

| Worker | Owner repo |
|---|---|
| email-manager | email-manager |
| everythingrated | everythingrated |
| high-signal-web, high-signal-api, high-signal-annotation | high-signal |
| knowledgebase, knowledgebase-app | knowledge-base |
| linkchat | karte |
| mal-api | anime-list |
| open-historia | open-historia |
| reader | reader |
| reel-pipeline-artifacts | reel-pipeline |
| resume-tailor | rolepatch (serves rolepatch.com) |
| saasmaker-api, saasmaker-dashboard, saasmaker-droid | saas-maker |
| significanthobbies | significanthobbies |
| starboard | starboard |
| truehire | truehire |
| verified-bases-api | verified-bases *(CI-connected 2026-06-26)* |
| codevetter-landing-proxy | codevetter |
| aliveville | ai-game |
| free-ai-gateway | free-ai *(hands-off)* |

## Cleaned up this pass

- **13 orphan preview/PR Workers** deleted (`*-preview`, `open-historia-pr-*`, `truehire-pr-*`).
- **rag-service, rag-service-bench** deleted — orphans from the retired
  rag-service project (archived `fleet-ops/rag-service-retired-2026-06-21.tgz`),
  no consumer, no domain. (Superseded by the `knowledgebase` workers.)

## Repos with no Cloudflare surface (expected)

- `companion-robot` — local-only scaffold, never pushed (no remote).
- `forecast-lab` — no CF deploy (data/research project).

## Hands-off (not modified this pass)

- `free-ai` / `free-ai-gateway` — another product owns it; read-only.
- `knowledge-base` — another agent's active WIP (diverged working tree).
