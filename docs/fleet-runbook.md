# Fleet Runbook

This is the operating guide for the projects under
`/Users/sarthak/Desktop/fleet`.

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
- **Support:** `high-signal`, `drank`, `research-papers`, `fleet-ops`, `saas-maker`, `free-ai`, `knowledge-base`, `reel-pipeline`
- **Personal use:** `rolepatch`, `karte`, `reader`, `swe-interview-prep`, `significanthobbies`, `looptv`, `anime-list`, `ai-game` (AliveVille)
- **Archive:** `truehire`, `open-historia`, `email-manager`, `everythingrated`, and `materia` are external archived repositories and are no longer checked as fleet projects

Operating rule: any product with a purchased custom domain remains in **Support**
even when it is not a focus bet. Personal-use products receive maintenance only;
when they also have a custom domain, that maintenance includes keeping the public
surface minimally healthy. Known domain-backed surfaces include `alive-ville`,
`karte`, `rolepatch`, `significanthobbies`, and `saas-maker`.

Archived products were transferred from the `sarthak-fleet` GitHub organization to
the personal account `sarthakagrawal927` where GitHub permitted the move. Their
working copies live under `/Users/sarthak/Desktop/fleet-archive-2026-07-10` and
are excluded from fleet health checks and new fleet work.
AliveVille is the `ai-game` checkout and remains organization-owned as a personal-use experiment.
TrueHire's active concept is represented by RolePatch's `/proof` surface.

## Fresh Machine Setup

From the Fleet root:

```bash
cd /Users/sarthak/Desktop/fleet
git status --short --branch
```

From the Foundry/SaaS Maker project:

```bash
cd /Users/sarthak/Desktop/fleet/saas-maker
pnpm install
fnd login
pnpm symphony
```

`fnd login` stores the Foundry session locally. Symphony uses that session and
does not require API keys for normal local task sync.

Cloudflare-backed projects require a working Wrangler login:

```bash
wrangler whoami
```

GitHub-backed checks require a working GitHub CLI login:

```bash
gh auth status
```

## Daily Fleet Checks

Check task state:

```bash
cd /Users/sarthak/Desktop/fleet/saas-maker
pnpm symphony
```

Check child repository cleanliness:

```bash
cd /Users/sarthak/Desktop/fleet
./scripts/git-health.sh --all
```

Check GitHub Actions and Cloudflare deployment health:

```bash
./scripts/deploy-health.sh
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

The active production fleet is listed in
`/Users/sarthak/Desktop/fleet/saas-maker/foundry.projects.json`.

| Project | Purpose | Local run | Verify before push | Deploy |
| --- | --- | --- | --- | --- |
| `anime_list` | MAL Explorer for anime/manga discovery and watchlists | `pnpm dev` | `pnpm lint`, `pnpm test`, `pnpm pages:build` | `pnpm deploy` |
| `CodeVetter` | Desktop-first AI code review platform | see project README | see project README / CI | see project README / CI |
| `email-manager` | Gmail/email triage and automation | `pnpm dev` | `pnpm lint`, `pnpm cf:build` | `pnpm deploy` |
| `everythingrated` | Multi-axis ratings platform | `pnpm dev` | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm cf:build` | `pnpm deploy` |
| `free-ai` | OpenAI-compatible gateway for free LLM providers | `pnpm dev` | `pnpm check`, `pnpm test:e2e` when relevant | `pnpm deploy` |
| `high-signal` | Signal intelligence and collections | `pnpm dev` | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` | project workflows |
| `linkchat` | AI-enhanced public profiles and chat/contact analytics | `pnpm dev` | `pnpm lint`, `pnpm build`, `pnpm cf:build` | `pnpm deploy:cf` |
| `looptv` | Lean-back YouTube station player | `pnpm dev` | `pnpm lint`, `pnpm test`, `pnpm build` | `pnpm deploy` |
| `open-historia` | LLM-adjudicated alternate-history game | `pnpm dev` | `pnpm lint`, `pnpm build`, `pnpm cf:build` | `pnpm deploy` |
| `reader` | Article/PDF reader, annotation, and research workspace | `pnpm dev` | `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm cf:build` | `pnpm deploy` |
| `resume-tailor` | RolePatch resume tailoring and interview prep | `pnpm dev` | `pnpm lint`, `pnpm test`, `pnpm cf:build` | `pnpm deploy` |
| `saas-maker` | Foundry cockpit, API, CLI, widgets, docs, Symphony | package-specific dev commands | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm smoke` after deploy | package/workflow deploys |
| `significanthobbies` | Hobby journeys and discovery | `pnpm dev` | `pnpm lint`, `pnpm test`, `pnpm cf:build` | `pnpm deploy` |
| `starboard` | GitHub stars organization and stack discovery | `pnpm dev` | `pnpm lint`, `pnpm test`, `pnpm cf:build` | `pnpm deploy:cf` |
| `swe-interview-prep` | Interview Coder prep app | `pnpm dev` | `pnpm lint`, `pnpm test`, `pnpm build` | `pnpm deploy` |
| `today-little-log` | Daily scoreboard, journal, and personal patterns | `pnpm dev` | `pnpm lint`, `pnpm build` | `pnpm deploy` |
| `truehire` | Verified candidate profile and recruiter evaluation | `pnpm dev` | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` | project workflows |

## Local-Only Or Non-Fleet Repositories

These may exist under the Fleet folder but are not part of the active
production fleet:

- `ai-game`: local simulator/game experiment. It has no GitHub Actions at the
  time this runbook was written. Useful commands: `pnpm dev`, `pnpm typecheck`,
  `pnpm test`, `pnpm build`.
- `personalsite`: removed from the active fleet. Do not create new Fleet tasks
  for it unless it is explicitly re-added.

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
