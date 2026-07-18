# Cloudflare deployment inventory (2026-07-18)

Exhaustive reconciliation of what's **actually deployed** on Cloudflare vs the
registry (`agent-surfaces-registry.json`), the deploy-target map
(`saas-maker/cloudflare.targets.json`), the repos, and the tiers
(`project-tiers.md`). Account: `sarthakagrawal927@gmail.com` (single account
`7d048325…`). Pages list is exhaustive; Worker-backed products confirmed live by
HTTP 200. **Gap:** a definitive list of *all* Workers (to catch orphaned/preview
scripts) needs a scoped API token — see "Open gaps."

## Cloudflare Pages projects (20, all live)

| CF Pages project | Domain(s) | Product | Tier | Flag |
|---|---|---|---|---|
| codevetter | codevetter.com, www | codevetter | **Focus** | ok |
| pace | heypace.app, www | pace | **Focus** | ok |
| **tinygpt** | posttrainllm.com, www, **tinygpt.sarthakagrawal.dev** | posttrainllm | **Focus** | ⚠️ project still named `tinygpt`; stray domain |
| materia | materia.significanthobbies.com | materia | Active | ok |
| saas-maker-home | sassmaker.com, www | saas-maker-showcase | Active | ok |
| saas-maker-docs | docs.sassmaker.com | saas-maker-docs | Active | ok |
| drank | domains.sassmaker.com | drank | Active | ok |
| psi-swarm-web | performance.sassmaker.com | psi-swarm | Active | ok |
| research-papers | papers.highsignal.app | research-papers | Secondary | ok |
| swe-interview-prep | learn.significanthobbies.com | swe-interview-prep | Secondary | ok |
| anime-list | anime.significanthobbies.com | anime-list | Secondary | ok |
| chess-9a0 | chess.significanthobbies.com | chess | Secondary | naming: `-9a0` suffix |
| looptv | tv.significanthobbies.com | looptv | Secondary | ok |
| aliveville | aliveville.com | ai-game | Parked | live despite Parked |
| web-playables | idle.aliveville.com | ai-game | Parked | live despite Parked |
| sarthakagrawal | sarthakagrawal.dev | (personal) | — | personal site, not a product |
| knowledgebase-landing | *.pages.dev only | knowledge-base | Parked | ⚠️ no custom domain (orphan/landing) |
| saas-ideas | *.pages.dev only | (none) | — | ⚠️ orphan — no repo/registry match |
| verified-bases-web | *.pages.dev only | verified-bases | Out-of-fleet | ⚠️ still deployed |
| today-little-log | *.pages.dev only | today-little-log | Out-of-fleet | ⚠️ still deployed |

## Worker-backed products (not Pages; all confirmed live 200)

| Product | Worker(s) (from targets map) | Domain | Tier |
|---|---|---|---|
| high-signal | high-signal-web, -api, -annotation | highsignal.app | Active |
| everythingrated | *(not in targets.json)* | ratings.highsignal.app **+ everythingrated.com** | Secondary |
| rolepatch | resume-tailor | rolepatch.com | Secondary |
| truehire | *(not in targets.json)* | truehire.rolepatch.com | Out-of-fleet |
| karte | linkchat | karte.cc | Secondary |
| starboard | starboard | starboard.codevetter.com | Secondary |
| significanthobbies | significanthobbies | significanthobbies.com | Secondary |
| reader | reader | read.significanthobbies.com | Secondary |
| email-manager | email-manager | mail.sassmaker.com | Active |
| free-ai | free-ai-gateway | ai-gateway.sassmaker.com | Active |
| saas-maker | saasmaker-dashboard, -api, -droid | (platform) | Active |
| reel-pipeline | reel-pipeline-artifacts | *(unverified)* | Parked |

## Hygiene findings (actionable)

1. **`tinygpt` Pages project = PostTrainLLM (Focus).** The CF project is still
   named `tinygpt` and carries a stray `tinygpt.sarthakagrawal.dev` domain.
   Pages projects can't be renamed in place — either create a `posttrainllm`
   project and move the custom domains, or keep the name and just remove the
   stray domain. Ties to the rebrand (PT1/PT8). **Decision needed.**
2. **Orphan Pages with no custom domain:** `saas-ideas` (no repo/registry match
   at all) and `knowledgebase-landing`. Delete or claim.
3. **Out-of-fleet still deployed:** `verified-bases-web`, `today-little-log` —
   live on `*.pages.dev`. Delete candidates.
4. **ai-game is live** (`aliveville.com` + `idle.aliveville.com`, 2 Pages) while
   tiered Parked — the tier is fine, but the surfaces are real; not in registry.
5. **everythingrated has two apexes** (`everythingrated.com` +
   `ratings.highsignal.app`); registry lists only the subdomain — pick the
   canonical and 301 the other.
6. **`cloudflare.targets.json` is incomplete** — it maps only 13 products; the
   Focus apps (codevetter/pace/posttrainllm), materia, drank, chess,
   research-papers, everythingrated, truehire, psi-swarm, and the saas-maker
   sub-sites are absent. It is not a reliable exhaustive deploy manifest.

## Open gaps (need a scoped API token to close)

- **Full Workers enumeration** — to catch orphaned/preview Worker scripts (the
  "avoid persistent preview Workers" hygiene rule), I need `workers (read)` via a
  scoped API token or the account Workers list. The OAuth token wrangler uses is
  stored as a credential; I won't read it without your say-so. Provide a
  read-scoped `CLOUDFLARE_API_TOKEN` (or run `wrangler` against the API yourself)
  and I'll complete the Workers side.
- **Deploy kind for everythingrated + truehire** — live but absent from the
  targets map; confirm whether Worker or Pages.

## "Set this up properly" — proposal

Make one **canonical project manifest** the single source of truth, replacing the
scattered registry/targets/tiers split. Suggested: extend
`agent-surfaces-registry.json` (or a new `fleet-ops/config/projects.json`) with,
per project: `tier`, `repo`, `deployKind` (pages|worker|none), `cfProject`,
`domains[]`, `inRegistry`, `status`. Then `deploy-health.sh`, tier filters, and
audits all read it. This doc + `project-tiers.md` are the inputs to that
manifest.
