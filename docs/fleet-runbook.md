# Fleet Runbook

This is the operating guide for the projects in the Fleet workspace.

The Fleet root is a lightweight documentation and policy repository. Each child
directory is its own project repository with its own Git history, deploy flow,
and verification commands.

## Operating Model

Use this order when working on the Fleet:

1. Check Symphony for the task.
2. Enter the project directory.
3. Read the Fleet `AGENTS.md` and the project `AGENTS.md` or `agents.md`.
4. Run the smallest relevant local verification before editing.
5. Make the change.
6. Run the project verification commands.
7. Commit and push the child project repository.
8. Mark the Symphony task done with evidence.

Symphony is the task source of truth. GitHub is the code source of truth.
Cloudflare, Vercel, and other hosts are deployment targets, not task stores.

## Portfolio Buckets (2026-07-10)

The fleet is managed in four buckets:

- **Focus:** `pace`, `codevetter`, `posttrainllm`
- **Support:** `high-signal`, `drank`, `research-papers`, `fleet-ops`, `saas-maker`, `free-ai`, `knowledge-base`, `reel-pipeline`, `aliveville`
- **Personal use:** `rolepatch`, `karte`, `reader`, `swe-interview-prep`, `significanthobbies`, `looptv`, `anime-list`, `email-manager`

Operating rule: any product with a purchased custom domain remains in **Support**
even when it is not a focus bet. Personal-use products receive maintenance only;
when they also have a custom domain, that maintenance includes keeping the public
surface minimally healthy. Known domain-backed surfaces include `aliveville`,
`karte`, `rolepatch`, `significanthobbies`, and `saas-maker`.

Email Manager is retained in the fleet workspace as a personal-use maintenance
project.
TrueHire is retired from the active Fleet; RolePatch owns the resume/proof surface.

Local checkout aliases:

| Canonical project | Local checkout |
| --- | --- |

## Owned Domain Map

The ten owned root domains are:

| Domain | Project |
| --- | --- |
| `sassmaker.com` | SaaS Maker |
| `posttrainllm.com` | PostTrainLLM |
| `heypace.app` | Pace |
| `codevetter.com` | codevetter |
| `aliveville.com` | aliveville |
| `rolepatch.com` | RolePatch |
| `highsignal.app` | High Signal |
| `karte.cc` | Karte |
| `significanthobbies.com` | Significant Hobbies |
| `sarthakagrawal.dev` | Portfolio |

Nine root domains map to active Fleet products. `sarthakagrawal.dev` is the
portfolio domain and is included in the ownership count, but not the product
count.

Subdomains such as `api.sassmaker.com`, `docs.sassmaker.com`, and
`www.*` variants belong to the same parent project and are not separate fleet
products.

## Fresh Machine Setup

Prerequisites: Git, GitHub CLI, Node 22, pnpm, and Wrangler. Authenticate once,
then clone the Fleet root and its active child repositories:

```bash
gh auth status
wrangler whoami
gh repo clone sarthakagrawal927/fleet fleet
cd fleet

while read -r repo directory; do
  test -d "$directory/.git" || gh repo clone "$repo" "$directory"
done <<'REPOS'
sarthakagrawal927/aliveville aliveville
Significant-Hobbies/anime-list anime-list
Significant-Hobbies/chess chess
Codevetter/codevetter codevetter
High-Signal-App/drank drank
sarthakagrawal927/email-manager email-manager
High-Signal-App/everythingrated everythingrated
sass-maker/free-ai free-ai
High-Signal-App/high-signal high-signal
sarthakagrawal927/karte karte
sass-maker/knowledge-base knowledge-base
Significant-Hobbies/looptv looptv
Significant-Hobbies/materia materia
sass-maker/mobile-dev-cockpit mobile-dev-cockpit
HeyPace/pace pace
PostTrainLLM/posttrainllm posttrainllm
Significant-Hobbies/protein-index protein-index
Significant-Hobbies/reader reader
sass-maker/reel-pipeline reel-pipeline
High-Signal-App/research-papers research-papers
sarthakagrawal927/rolepatch rolepatch
sarthakagrawal927/web-playables web-playables
sass-maker/saas-maker saas-maker
Significant-Hobbies/significanthobbies significanthobbies
Codevetter/starboard starboard
Significant-Hobbies/swe-interview-prep swe-interview-prep
REPOS

./fleet-ops/scripts/agent-stack.sh install-skills
git status --short --branch
cd saas-maker
pnpm install
fnd login
pnpm symphony
```

`fnd login` stores the Foundry session locally. Symphony uses that session and
does not require API keys for normal local task sync.

Cloudflare-backed projects require a working Wrangler login. GitHub Actions
deploys additionally require the repository's Cloudflare secrets; local
Wrangler auth is intentionally not copied between machines:

```bash
wrangler whoami
```

GitHub-backed checks require a working GitHub CLI login:

```bash
gh auth status
```

Return to the Fleet root and validate the installation:

```bash
cd ..
bash fleet-ops/scripts/fleet-health.sh --no-fetch
bash fleet-ops/scripts/deploy-health.sh
```

Cloudflare Pages showing `Git Provider: No` is expected for direct-upload
projects. Do not connect them to GitHub in Cloudflare: the guarded deploy
workflow and its recorded Git commit provide repository provenance without
turning `main` into an automatic production deploy.

## Daily Fleet Checks

Check task state:

```bash
cd saas-maker
pnpm symphony
```

Check child repository cleanliness:

```bash
cd /path/to/fleet
bash fleet-ops/scripts/fleet-health.sh
```

Check GitHub Actions and Cloudflare deployment health:

```bash
bash fleet-ops/scripts/deploy-health.sh
```

The deploy health script is read-only. It checks GitHub Actions for immediate
child repositories and checks Cloudflare deployments listed in
`saas-maker/cloudflare.targets.json`. Pages deployments can usually be compared
to `origin/main` by commit prefix; Workers deployments confirm active
deployment state but do not always expose a Git commit.

Branch/deploy posture:

- `main` is the long-lived stable code line, not an automatic production
  trigger.
- Deploys are manual and should happen only after the project is clean, synced
  to `main`, green in GitHub Actions, and ready to ship as a batch.
- Every fleet project should have GitHub Actions and a repo-local deploy command
  such as `pnpm deploy`, `npm run deploy`, or `bun run deploy`.
- Deploy commands should fail closed if the repo is not on clean/synced `main`
  or if the latest `main` CI signal is not green.

## Running Symphony

From `saas-maker`:

```bash
pnpm symphony
pnpm symphony pick --agent gemini
pnpm symphony pick --agent claude
pnpm symphony dispatch <task-id-prefix> --agent codex
pnpm symphony claim <task-id-prefix>
pnpm symphony done <task-id-prefix>
```

Dashboard-created tasks sync to local on the next `pnpm symphony` run. Local
claim/done/create/delete commands write back to production.

Prefer cheaper agents first for routine tasks. Use stronger paid sessions only
for work that needs deeper reasoning or higher correctness guarantees.

## Active Projects

The active production fleet is listed in `saas-maker/foundry.projects.json`.

| Project | Purpose | Local run | Verify before push | Deploy |
| --- | --- | --- | --- | --- |
| `aliveville` | AliveVille 3D AI world simulator | `pnpm dev` | `pnpm typecheck`, `pnpm test`, `pnpm build` | project workflows |
| `anime-list` | MAL Explorer for anime/manga discovery and watchlists | `pnpm dev` | `pnpm lint`, `pnpm test`, `pnpm pages:build` | `pnpm deploy` |
| `codevetter` | Desktop-first AI code review platform | see project README | see project README / CI | see project README / CI |
| `drank` | Domain rating tracker | see project README | see project README / CI | see project README / CI |
| `email-manager` | Gmail/email triage and automation | `pnpm dev` | `pnpm lint`, `pnpm cf:build` | `pnpm deploy` |
| `everythingrated` | Multi-axis ratings for High Signal directories | `pnpm dev` | see project README / CI | project workflows |
| `free-ai` | OpenAI-compatible gateway for free LLM providers | `pnpm dev` | `pnpm check`, `pnpm test:e2e` when relevant | `pnpm deploy` |
| `high-signal` | Signal intelligence and collections | `pnpm dev` | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` | project workflows |
| `karte` | AI-enhanced public profiles and chat/contact analytics | `pnpm dev` | `pnpm lint`, `pnpm build`, `pnpm cf:build` | `pnpm deploy:cf` |
| `knowledge-base` | Private Agent Search over project corpora | see project README | see project README / CI | see project README / CI |
| `looptv` | Lean-back YouTube station player | `pnpm dev` | `pnpm lint`, `pnpm test`, `pnpm build` | `pnpm deploy` |
| `pace` | Local macOS voice agent | see project README | see project README / CI | see project README / CI |
| `posttrainllm` | Local LLM factory/runtime | see project README | see project README / CI | see project README / CI |
| `reader` | Article/PDF reader, annotation, and research workspace | `pnpm dev` | `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm cf:build` | `pnpm deploy` |
| `reel-pipeline` | AI short-form video generation pipeline | see project README | see project README / CI | see project README / CI |
| `research-papers` | Academic paper platform and search asset | see project README | see project README / CI | see project README / CI |
| `rolepatch` | RolePatch resume tailoring and interview prep | `pnpm dev` | `pnpm lint`, `pnpm test`, `pnpm cf:build` | `pnpm deploy` |
| `saas-maker` | Foundry cockpit, API, CLI, widgets, docs, Symphony | package-specific dev commands | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm smoke` after deploy | package/workflow deploys |
| `significanthobbies` | Hobby journeys and discovery | `pnpm dev` | `pnpm lint`, `pnpm test`, `pnpm cf:build` | `pnpm deploy` |
| `starboard` | GitHub stars organization and stack discovery | `pnpm dev` | `pnpm lint`, `pnpm test`, `pnpm cf:build` | `pnpm deploy:cf` |
| `swe-interview-prep` | Interview Coder prep app | `pnpm dev` | `pnpm lint`, `pnpm test`, `pnpm build` | `pnpm deploy` |

## Local-Only Or Non-Fleet Repositories

These are not part of the active production fleet and should be excluded from
fleet-wide sweeps unless explicitly re-added:

- `open-historia`
- `personalsite`: removed from the active fleet. Do not create new Fleet tasks
  for it unless it is explicitly re-added.
- `today-little-log`
- `truehire`

## Verification Rules

Use the smallest verification that proves the task:

- UI-only change: lint plus build, and browser smoke when practical.
- API/schema change: unit tests plus typecheck/build, and migration review.
- Deploy fix: local build plus GitHub Actions or deploy smoke.
- Fleet-wide change: verify every affected child repo, not just `saas-maker`.

Before claiming completion, check:

```bash
git status --short --branch
git log --oneline -1
```

After pushing, confirm the branch is not ahead:

```bash
git fetch --quiet
git rev-list --left-right --count @{u}...HEAD
```

Expected output is `0 0`.

## Cleanup Rules

After task completion:

- Stop dev servers and preview servers unless the user asked to keep them open.
- Remove generated temporary folders such as `test-results/`, `tmp/`, and local
  preview output when they are not intended to be committed.
- Keep child repositories on `main` unless a working branch is intentionally
  still active.
- Do not leave unpushed commits.

## Documentation Rules

Do not copy this runbook into every project. Project docs should link back to
the Fleet docs and only add project-specific exceptions.

Use:

- Fleet `README.md`: workspace entrypoint.
- Fleet `docs/fleet-runbook.md`: how to operate and verify the fleet.
- Fleet `docs/project-map.md`: how the systems connect.
- Project `README.md`: project-specific setup and usage.
- Project `AGENTS.md` or `agents.md`: project-specific agent instructions.
- Symphony tasks: active/deferred work.
