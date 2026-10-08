---
name: fleet-init
description: Scaffold a new fleet project — create the GitHub repo, AGENTS.md, PROJECT_STATUS.md, .gitignore, and CI workflow. Use only when the owner explicitly asks to create a new project ("create a new project called X", "scaffold X", "init a new repo for X"). Never propose or start a new project on your own.
---

# fleet-init — new project scaffolding

Creates a new fleet project with the standard structure: GitHub repo,
AGENTS.md, PROJECT_STATUS.md, .gitignore, and CI workflow. The GitHub owner is
required: pass `--owner <org>` or set `FLEET_GITHUB_OWNER`.

The Fleet root (`~/Desktop/fleet`) is not a Git repository and must never
become one. This skill writes only inside the new project's own checkout.

## When to invoke

Only when the owner explicitly asks for a new project, for example:

- "Create a new project called X"
- "Scaffold X" / "Init a new repo for X"

Do not invoke it to house work that belongs in an existing project, and never
suggest or start a new project unprompted. Creating a GitHub repository is an
external action: confirm the details below with the owner first.

For the full new-project gate list (catalog registration, landing, deploy,
SEO/GEO, analytics, launch), follow
[new-project-checklist.md](../../docs/new-project-checklist.md); this skill
covers its scaffold phase.

## What it creates

1. **GitHub repo** — `<owner>/<name>` (private or public per owner request)
2. **Local checkout** — `~/Desktop/fleet/<name>/`
3. **AGENTS.md** — standard fleet agent file with shared standard reference
4. **PROJECT_STATUS.md** — with the 6 required sections (Why/What, Dependencies,
   Timeline, Products, Features, Todo/Planned/Deferred/Blocked)
5. **.gitignore** — standard Node/Cloudflare ignores
6. **CI workflow** — `.github/workflows/ci.yml` with lint + typecheck + test

## How to invoke

Confirm with the user:
- **Project name** (repo name, kebab-case)
- **GitHub owner** (org or account)
- **Category** (support, personal+free-tool, personal+saas, data, research, support+saas)
- **One-line description**
- **Stack** (Astro/Vite/Next.js/Worker/Tauri/etc.)
- **Visibility** (public or private)

Then run the backing script:

```bash
bash ~/Desktop/fleet/saas-maker/tooling/scripts/fleet-init.sh <name> \
  --owner <org> \
  --category <cat> \
  --desc "<one-line description>" \
  --stack "<stack>" \
  [--private]
```

The script:
1. Creates the GitHub repo (`<owner>/<name>`) and clones it
2. Scaffolds AGENTS.md, PROJECT_STATUS.md, .gitignore, CI workflow
3. Commits and pushes the initial scaffold inside the new repo
4. Links Fleet skills into the new checkout (local, uncommitted links)

## Post-creation checklist

- [ ] GitHub repo created and cloned
- [ ] AGENTS.md, PROJECT_STATUS.md, .gitignore committed
- [ ] CI workflow committed and passing (or skeleton)
- [ ] Registered in `saas-maker/catalog/projects.json`, then `pnpm catalog:sync`
      in SaaS Maker (the catalog is the project list; there is no fleet README)
- [ ] If the project uses Cloudflare: wrangler config created
- [ ] If the project uses a DB: schema + first migration created
