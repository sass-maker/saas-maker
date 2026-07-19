# Knip adoption standard (fleet-wide)

Knip (`https://knip.dev`) is the fleet-standard tool for finding **unused
files, exports, types, dependencies, and devDependencies** in JS/TS projects.
It replaces `depcheck` and ad-hoc dead-code searches with one static-analysis
pass.

This doc defines:
1. The shared `knip.json` template every TS project should adopt.
2. Per-project adoption order based on code size and stack.
3. CI integration pattern (non-blocking first, blocking later).
4. How to triage common false positives in fleet stacks (Next.js server
   actions, Astro content collections, monorepo CLI command dispatchers,
   Drizzle schemas, exported contract types).

`react-doctor` is a separate, periodic health-check wrapper around knip +
oxlint + Socket.dev supply-chain checks. It is **not** a replacement for
knip-in-CI; see the "React Doctor" section below for when to run it.

## Why knip

Dry-run evidence (2026-07-19) on two of the largest fleet projects:

| Project | src files | unused files | unused deps | unused devDeps | unused exports | unused types |
|---|---:|---:|---:|---:|---:|---:|
| saas-maker (monorepo) | 522 | 27 | 7 | 18 | 114 | 54 |
| significanthobbies (Next.js) | 460 | 30 | 6 | 4 | 77 | 16 |

Both projects build and pass tests, yet knip surfaced real dead code and
ghost dependencies on a single read-only pass. The same pattern is
expected across the other ~20 TS projects that currently have no knip
config.

## Shared `knip.json` template

Drop this at project root as `knip.json`. Tune the `ignore` and
`ignoreDependencies` arrays per project; everything else should stay
identical so a fleet-wide `pnpm -r knip` or a future workspace script
works uniformly.

```jsonc
{
  "$schema": "https://unpkg.com/knip@latest/schema.json",
  // Entry points are auto-detected from package.json (main, bin, exports,
  // scripts). Only add explicit `entry` if auto-detection misses something.
  "entry": [],
  "project": ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
  "ignore": [
    "**/dist/**",
    "**/build/**",
    "**/.next/**",
    "**/.astro/**",
    "**/.output/**",
    "**/node_modules/**",
    "**/*.config.{js,ts,mjs,cjs}",
    "scripts/**",          // fleet scripts are often run by name, not imported
    "tests/e2e/**",        // playwright fixtures are wired by config, not imports
    "**/*.test.{ts,tsx,js}",
    "**/*.spec.{ts,tsx,js}",
    "**/__tests__/**"
  ],
  "ignoreDependencies": [
    // Build tools that don't appear in import graphs
    "typescript",
    "@types/*",
    "biome",
    "@biomejs/biome",
    "prettier",
    "prettier-plugin-tailwindcss",
    "husky",
    "lint-staged",
    "vitest",
    "@vitest/*",
    "playwright",
    "@playwright/test",
    "drizzle-kit",
    "wrangler",
    "opennextjs-cloudflare",
    "tailwindcss",
    "@tailwindcss/*",
    "lightningcss",
    "tsx",
    "size-limit",
    "knip"
  ],
  "ignoreBinaries": [
    // Scripts invoked via package.json scripts or CI, not importable
    "next",
    "astro",
    "vite",
    "wrangler",
    "drizzle-kit",
    "tsx",
    "biome",
    "playwright",
    "vitest",
    "knip",
    "eslint",
    "prettier"
  ],
  "ignoreExports": [
    // Next.js server actions are dispatched by string, not imported
    "src/app/api/**/route.ts",
    "src/lib/actions/**",
    // Drizzle schema exports are consumed by the ORM, not imported
    "**/schema.ts",
    "**/db/schema*.ts",
    // CLI command files are dispatched by name
    "**/commands/**"
  ]
}
```

### When to extend the template

- **Astro content collections** — add `src/content/**` to `ignoreExports`
  if collection entries are queried by glob, not imported.
- **OpenNext / Cloudflare** — add `open-next.config.ts`,
  `wrangler.toml`/`wrangler.jsonc` referenced bindings to `entry` if knip
  flags them as unused files.
- **Monorepo workspaces** — knip auto-detects pnpm/npm workspaces. Run
  `knip` from the workspace root; do not add per-package configs unless a
  package has unusual entry points (CLI packages with command dispatchers
  should add `src/commands/index.ts` to `entry`).

## Per-project adoption plan

Adoption is sized by code surface. Smaller projects first to validate the
template, then the big ones.

### Tier 1 — pilot (validate template, 1 PR each, this week)

Small enough that findings will be easy to triage and the template can be
tuned before rolling out widely.

| Project | src files | stack | notes |
|---|---:|---|---|
| materia | 23 | Astro + React | validates Astro path |
| drank | 61 | Next.js | validates Next.js path |
| open-historia | 75 | Vite + React | already has eslint — keep both |
| protein-index-resilience | 101 | Vite + React | |
| protein-index | 104 | Vite + React | |
| free-ai | 107 | Vite + React | |

### Tier 2 — medium (after Tier 1 template is stable)

| Project | src files | stack |
|---|---:|---|
| today-little-log | 119 | Vite + React (knip already installed, no config) |
| looptv | 129 | Next.js + React |
| pace | 143 | (verify stack) |
| email-manager | 176 | Vite + React |
| swe-interview-prep | 196 | Astro + Vite + React |
| ai-game | 225 | Vite + React |
| truehire | 279 | Next.js |
| reader | 281 | Vite + React |
| starboard | 288 | Next.js + React |
| anime-list | 316 | Vite + React |
| codevetter | 347 | Biome, no React |
| everythingrated | 166 | Next.js + Astro |
| codevetter-harness-audit-20260718 | 302 | Biome |
| rolepatch | 375 | Next.js + React |

### Tier 3 — large (after Tier 2 lessons are folded into the template)

| Project | src files | stack | notes |
|---|---:|---|---|
| karte | 446 | Next.js + React | |
| significanthobbies | 460 | Next.js | dry-run done: 30 files, 6 deps, 77 exports |
| high-signal | 498 | Next.js | `strict` missing in tsconfig — fix in same PR |
| saas-maker | 522 | pnpm monorepo + turbo | dry-run done: 27 files, 7 deps, 18 devDeps, 114 exports |

### Out of fleet (per AGENTS.md)

Skip in any fleet-wide rollout unless explicitly asked: `open-historia`,
`today-little-log`, `truehire`, `companion-robot`, `forecast-lab`,
`elves-hq`. (today-little-log already has knip installed; the others are
listed for completeness.)

### Projects without TypeScript

`companion-robot`, `forecast-lab`, `motion`, `pace`, `posttrainllm`,
`reel-pipeline`, `research-papers`, `saas-ideas`, `knowledge-base`,
`mobile-dev-cockpit`, `web-playables` — knip works on plain JS too, but
the value is lower without type information. Defer until they migrate to
TS or until a specific dead-code concern surfaces.

## CI integration pattern

### Phase 1 — non-blocking reporter (every Tier 1+ project)

Add to `package.json`:

```jsonc
{
  "scripts": {
    "knip": "knip --no-exit-code --reporter symbols",
    "knip:strict": "knip --reporter symbols"
  },
  "devDependencies": {
    "knip": "^6.6.3"
  }
}
```

Add a CI job that runs `pnpm knip` and uploads the report as an artifact,
but **does not fail the build**. This gives every PR author visibility
without breaking in-flight work.

```yaml
# .github/workflows/knip.yml
name: knip
on: { push: { branches: [main] }, pull_request: { branches: [main] } }
jobs:
  knip:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm knip
      - if: always()
        uses: actions/upload-artifact@v4
        with: { name: knip-report, path: knip-report.json }
```

### Phase 2 — blocking (per-project opt-in)

Once a project's `knip` output is clean, switch the CI job to
`pnpm knip:strict` (exit code 1 on findings). New dead code introduced in
a PR will then fail CI. Do not flip this until the project has been clean
for two consecutive main runs.

### Phase 3 — pre-commit hook (optional)

For projects with `husky` + `lint-staged`, knip is too slow for
per-file pre-commit. Skip; rely on CI.

## Triage playbook (common fleet false positives)

Knip reports are only as good as the entry-point graph. These patterns
show up across the fleet and need template-level handling, not per-PR
`// knip:ignore` comments.

| Pattern | Symptom | Fix |
|---|---|---|
| Next.js server actions | `src/lib/actions/*.ts` flagged as unused file or unused exports | Add `src/lib/actions/**` and `src/app/api/**/route.ts` to `ignoreExports` (template already does this) |
| Drizzle schemas | `schema.ts` exports flagged unused | Add `**/schema.ts` and `**/db/schema*.ts` to `ignoreExports` |
| CLI command dispatchers | `packages/cli/src/commands/*.ts` exports flagged unused | Add `**/commands/**` to `ignoreExports`; if there's a central `commands/index.ts`, add it to `entry` |
| OpenNext / Cloudflare configs | `open-next.config.ts`, `wrangler.toml` flagged as unused file | Add to `entry` |
| Husky / lint-staged configs | `.husky/*`, `lint-staged.config.js` flagged | Add to `ignore` |
| Playwright fixtures | `tests/e2e/fixtures/**` flagged | Add `tests/e2e/**` to `ignore` (template already does this) |
| Storybook stories | `*.stories.tsx` flagged | Add `**/*.stories.{ts,tsx}` to `ignore` |
| Astro content collections | `src/content/**` flagged | Add `src/content/**` to `ignoreExports` |
| Generated OpenAPI / contracts | `internal/contracts/index.ts` types flagged unused | Add `internal/contracts/**` to `ignoreExports`, or add the file to `entry` if downstream packages import it |
| Build-time CSS | `*.css`, `tailwind.css` flagged | Add `**/*.css` to `ignore` |

If a finding is a true positive: delete the file, drop the export, or
remove the dependency. Do not add `// knip:ignore` to silence it.

## React Doctor (separate, periodic)

`react-doctor` (`https://react.doctor`) is a one-off CLI that wraps knip +
oxlint + `eslint-plugin-react-hooks` + Socket.dev supply-chain checks.
Use it as a quarterly health check on React projects, not as a CI gate.

```bash
npx react-doctor@latest --no-telemetry --json --output-dir .react-doctor
```

Caveats:
- Young project (0.5.x as of 2026-07). Pin the version if adding to a
  script.
- Ships Sentry telemetry by default. Always pass `--no-telemetry` in
  fleet usage.
- Does not replace knip-in-CI; it does not support workspace mode well
  and is slower.

Run it on the 5–10 largest React projects (significanthobbies, karte,
rolepatch, anime-list, starboard, reader, ai-game, swe-interview-prep,
email-manager, free-ai) after Tier 2 of knip adoption is complete, so
its knip-derived findings are already resolved and the remaining signal
is the React-specific lint rules.

## Adoption checklist (per project)

- [ ] Add `knip.json` from the shared template.
- [ ] Add `knip` devDep and `knip` / `knip:strict` scripts to
      `package.json`.
- [ ] Run `pnpm knip` locally and triage findings:
  - true positives → delete in the same PR
  - false positives → extend `ignore` / `ignoreExports` /
    `ignoreDependencies` in `knip.json`
- [ ] Add `.github/workflows/knip.yml` (Phase 1, non-blocking).
- [ ] Open PR with title `chore: adopt knip for dead-code analysis`.
- [ ] After two clean main runs, flip to `knip:strict` (Phase 2).
- [ ] Update project `PROJECT_STATUS.md` Todo section: "knip adopted,
      CI non-blocking" or "knip adopted, CI blocking".

## Fleet-wide rollout tracking

Do not create a separate tracker file. The Tier 1/2/3 tables above are
the source of truth; update them in this doc as each project ships. When
all Tier 3 projects are on Phase 2, move this doc's "Adoption plan"
section to `archive/` and leave only the template + triage playbook as
the standing standard.
