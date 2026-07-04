---
name: fleet-init
description: Scaffold a new fleet project — create the GitHub repo, AGENTS.md, PROJECT_STATUS.md, wrangler config, CI workflow, and fleet README entry. Use when the user says "create a new project", "scaffold X", "add a new fleet product", or "init a new repo".
---

# fleet-init — new project scaffolding

Creates a new fleet project with the standard structure: GitHub repo under
sarthak-fleet, AGENTS.md, PROJECT_STATUS.md, CI workflow, and a README entry
in the fleet root.

## When to invoke

- "Create a new project called X"
- "Scaffold a new fleet product"
- "Add a new fleet project"
- "Init a new repo for X"

## What it creates

1. **GitHub repo** — `sarthak-fleet/<name>` (private or public per user request)
2. **Local checkout** — `~/Desktop/fleet/<name>/`
3. **AGENTS.md** — standard fleet agent file with shared standard reference
4. **PROJECT_STATUS.md** — with the 6 required sections (Why/What, Dependencies,
   Timeline, Products, Features, Todo/Planned/Deferred/Blocked)
5. **.gitignore** — standard Node/Cloudflare ignores
6. **CI workflow** — `.github/workflows/ci.yml` with lint + typecheck + test
7. **Fleet README entry** — adds the project to the appropriate category

## How to invoke

Confirm with the user:
- **Project name** (repo name, kebab-case)
- **Category** (support, personal, saas, data, research — or multiple)
- **One-line description**
- **Stack** (Astro/Vite/Next.js/Worker/Tauri/etc.)
- **Visibility** (public or private)

Then:

```bash
# 1. Create GitHub repo
gh repo create sarthak-fleet/<name> --<visibility> --clone ~/Desktop/fleet/<name>

# 2. Scaffold files (use templates from fleet-ops/templates/ if available)
# 3. Commit + push initial scaffold
# 4. Add to fleet README under the right category
# 5. Commit + push fleet README update
```

## Post-creation checklist

- [ ] GitHub repo created and cloned
- [ ] AGENTS.md, PROJECT_STATUS.md, .gitignore committed
- [ ] CI workflow committed and passing (or skeleton)
- [ ] Fleet README updated with new project in the right category
- [ ] If the project uses Cloudflare: wrangler config created
- [ ] If the project uses a DB: schema + first migration created
