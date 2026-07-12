# Fleet Agent Ownership Standard

Agents working anywhere under this fleet are codebase stewards, not drive-by code generators.

Act like an owner of the product in front of you:
- Understand the existing system before making broad changes.
- Protect production stability, user trust, data, credentials, and deploy paths.
- Prefer small, reviewable diffs that match local conventions.
- Verify behavior with the smallest relevant checks before declaring success.
- Record durable follow-up work when a task is incomplete, blocked, risky, or too large for the current pass.
- Surface failed checks, skipped validation, uncertainty, cost, and residual risk clearly.
- Keep task comments and handoffs concise, factual, and useful to the next agent.

Fleet quality bar:
- Prefer less code. Remove dead, duplicated, shelved, or unused paths before adding new abstractions.
- Ship good code, not more code. Keep changes simple, typed, tested, readable, and aligned with the repo's current stack.
- Keep projects green and functioning. Do not leave broken builds, failing checks, broken primary flows, or known production regressions without a tracked blocker.
- Keep docs, code, tests, and plans in sync. If behavior, architecture, commands, deploy targets, auth, or storage changes, update the matching README/docs/tests/plans in the same pass.
- Treat current docs as agent navigation, not marketing. README/AGENTS/AUDIT/REVIEW files must not mislead future agents about stack, auth, deploy, data, tests, or active scope.
- Each project should maintain a single `PROJECT_STATUS.md` at the project root — the **only** status doc agents need. Read it before broad work; update it when scope, ships, or backlog change. Shipped PRD/plan outcomes belong here (not in `docs/archive/` pointers). Archives are optional history and may be deleted.
- **Required `PROJECT_STATUS.md` sections (in order):**
  1. **Why / What** — problem, thesis, users, in-scope vs out-of-scope
  2. **Dependencies** — external (APIs, vendors, OAuth, paid services) and internal (fleet repos, bindings, shared workers)
  3. **Timeline** — reverse-chron or chronological build milestones (dates + what shipped)
  4. **Products** — deploy surfaces, URLs, packages, sub-products (what exists in prod/dev)
  5. **Features (shipped)** — exhaustive done inventory by subsystem
  6. **Todo / Planned / Deferred / Blocked** — numbered planned next; deferred with why; blocked with owner/dependency
- When a PR or PR-sized branch is completed, merged, superseded, or abandoned, close the loop in the project tracker: mark the corresponding work item complete if the change landed, or deleted/parked if the work is no longer relevant. Then update the project root `PROJECT_STATUS.md` as the durable status record. Do not create extra completion notes, handoff docs, or status ledgers for ordinary PR closure.
- Each fleet product may also maintain `docs/PROJECT_RECOMMENDATION_CONTEXT.md` as the Starboard-facing companion to `PROJECT_STATUS.md`. Read it before recommendation, stack, dependency, or product-context work, and update it when product scope, major runtime surfaces, entrypoints, dependencies, testing signals, or recommendation guidance changes. Do not churn it for tiny edits that do not affect how Starboard should understand or recommend repositories for the project.
- Do not normalize tech debt. Any intentional shortcut must be named, justified, scoped, and mirrored into a durable SaaS Maker task with the smallest next action.
- Treat repeated issues as fleet standards work. If the same drift appears across multiple projects, add or update a reusable check, template, or standard instead of fixing only one repo.
- Be conservative with rate limiters. Do not add, re-enable, or make rate limits stricter without explicit approval and endpoint-specific evidence; stale or unused rate-limit config should usually be removed as cleanup.
- Prioritize cleanup that reduces surface area: unused packages, dead code, generated artifacts, stale feature paths, and docs that no longer match current code.

Fleet landing/marketing standard:
- Landing pages, hero copy, OG images, and positioning follow [`LANDING_STANDARD.md`](../../LANDING_STANDARD.md). Walk its audit checklist before shipping a marketing surface; cross-product drift on its rules is fleet-standards work, not one-repo work.

Fleet UI standard:
- All fleet projects with a visual interface should move toward a free, beautiful, shadcn-compatible local UI standard when UI work is in scope.
- Prefer Tailwind tokens, local reusable components, lucide-react icons, and accessible Radix UI or React Aria primitives where they fit the repo's existing stack.
- Use free/open component sources only. Aceternity UI free components are preferred for polished sections, cards, backgrounds, empty states, timelines, Bento grids, and high-visibility surfaces when they fit the product. shadcn/ui remains the base reference for durable app controls, with Magic UI and Origin UI as complementary free sources.
- Do not preserve ugly UI by default. Migrate touched surfaces screen-by-screen with small diffs instead of forcing one global package or whole-stack rewrite.
- Operational/admin surfaces should stay dense, scannable, accessible, and fast. Marketing, demo, onboarding, and showcase surfaces can be more expressive, but motion and decorative effects must remain purposeful.
- Do not add paid assets or broad UI dependencies without explicit approval. Explain any new UI dependency with why this, why now, and why existing code is insufficient.
- Verify meaningful visual changes with a browser check or screenshot across relevant desktop/mobile states.

Fleet spec-driven development standard (OpenSpec):
- Any non-trivial new feature in any fleet project starts with the OpenSpec
  workflow BEFORE feature code is written. This is a strong default, not a
  suggestion. Invoke the `spec-driven` skill (symlinked into every agent's
  skill dir) at the moment feature intent is detected.
- **Trigger** when the user says "build X" / "add X" / "implement X" / "let's
  add X", or when work introduces a new surface, route, command, capability,
  or multi-file behavior change. **Skip** for bug fixes, cleanup, dep bumps,
  copy edits, single-file polish, test additions for existing behavior, and
  config/CI tweaks. When in doubt, run the workflow — a 5-minute proposal is
  cheaper than building the wrong thing.
- Workflow: `/opsx:explore` (optional, for ambiguous features) →
  `/opsx:propose <feature>` (mandatory, creates `openspec/changes/<feature>/`
  with proposal/specs/design/tasks) → `/opsx:apply` (implement tasks.md) →
  `/opsx:archive` on ship.
- Cross-repo features (umbrella + sub-product, support infra + consumer) use
  OpenSpec **Stores** — one plan in a store, code lands in multiple repos.
  Do not duplicate the same change into per-repo `openspec/changes/`.
- Boundary with existing fleet docs: OpenSpec owns the **feature lifecycle**
  (propose → apply → archive). `PROJECT_STATUS.md` owns the **product
  lifecycle** (shipped / planned / blocked). They meet at archive time — the
  shipped feature moves from OpenSpec into PROJECT_STATUS.md. Symphony tasks
  remain the operational work queue for bug fixes, cleanup, and follow-ups.
- Pre-flight: `openspec --version` (install `npm install -g
  @fission-ai/openspec@latest` if missing), `openspec init` if the project
  has no `openspec/` dir, `openspec list --specs` to read existing specs.
- Anti-patterns: writing feature code before `proposal.md` exists, skipping
  propose because "it's obvious", letting `openspec/changes/` accumulate
  unarchived, duplicating proposals into `docs/plans/`, per-repo changes for
  cross-repo features.
- See `fleet-ops/skills/spec-driven/SKILL.md` for the full contract.

Ownership has boundaries:
- Do not run destructive commands unless explicitly asked.
- Do not touch secrets, env files, SSH keys, cloud credentials, kube configs, or production configs unless explicitly asked.
- Agents have standing approval to commit and push safe repo changes once they
  understand the scope, have excluded secrets/local scratch files, and are
  confident from the smallest relevant checks. Push promptly instead of leaving
  finished work dirty.
- If checks fail for reasons unrelated to the pushed change, a push is allowed
  only when the failure is clearly named in the handoff. Do not push known
  product/build regressions caused by the change.
- Do not deploy, migrate, release, rotate credentials, touch production config,
  or make irreversible public changes unless explicitly asked for that action.
- Ask before broad rewrites, data migrations, dependency changes, or changes that materially affect production behavior.
- Do not hide blockers or pretend a task is complete when it is not.

Default posture:
- If the next step is obvious and low risk, do it.
- If the work is complete and safe, commit and push it without waiting for a
  separate push request.
- If the work affects product behavior, deployment, user feedback, or fleet maintenance, mirror durable next steps into SaaS Maker tasks.
- Leave the repo easier to understand, run, and maintain than you found it.

## Fleet web stack standard (VoidZero ecosystem)

New web projects start with the VoidZero / Vite ecosystem unless there is a
specific reason not to. Existing projects migrate when touched and the cost
is low enough not to risk breakage.

Preferred stacks, in order:

1. **Astro** — for content / marketing / docs / landing surfaces. Default
   choice for any page where the LCP element is text or an image and the
   interactivity below the fold is small. Already meeting <500 ms desktop
   LCP on tinygpt and sarthakagrawal.pages.dev with this stack.
2. **Vite + React (SPA)** — for app shells where the interactive surface
   is the whole page. `reader` and `swe-interview-prep` are active references.
3. **Next.js on Cloudflare Workers (OpenNext)** — keep for projects that
   already have it AND need SSR, server actions, or per-route caching that
   Astro can't trivially express. New marketing surfaces should not be
   spun up here.

CSS pipeline, regardless of stack:

- Lightning CSS as the CSS transformer + minifier. Already bundled in
  Vite; just opt in via `css.transformer: "lightningcss"` +
  `build.cssMinify: "lightningcss"`. Faster than the default PostCSS
  pipeline and produces marginally smaller output.
- Tailwind v4 via the official `@tailwindcss/vite` plugin (or
  `@tailwindcss/postcss` on Next.js). Tailwind v4's own engine produces
  the bulk of the CSS; Lightning CSS minimises what Tailwind emits.
- Inline critical CSS on prerender:
  - Astro: `build.inlineStylesheets: "always"` flat-inlines per-page CSS.
  - Next.js: `scripts/inline-critical-css.mjs` (Beasties) runs after
    `next build` and before `opennextjs-cloudflare build --skipNextBuild`,
    paired with `output: "standalone"` and the
    `StaticAssetsIncrementalCache` override so the inlined HTML actually
    reaches the browser.

Known Next.js caveat:
- `experimental.useLightningcss: true` throws when Tailwind v4 is in the
  pipeline. Do not enable it on Next.js projects until upstream removes
  the PostCSS conflict; the Lightning CSS standard only applies to the
  Vite/Astro projects today.

Deployment standard:

- `main` is the long-lived stable code line. Keep it releasable, reviewed, and
  green; do not treat `main` as an automatic production deployment trigger.
- Production deploys are manual. Deploy only after the relevant project is on
  clean/synced `main`, GitHub Actions are green, the Cloudflare target is known,
  and any intentionally batched changes are ready to ship together.
- Every fleet project should have CI/CD on GitHub Actions and a repo-local
  deploy command, usually a single package script such as `pnpm deploy`,
  `npm run deploy`, or `bun run deploy`.
- Deploy scripts must fail closed when the repo is not on clean/synced `main`
  or when the latest `main` CI signal is not green. Prefer explicit guards over
  hidden deploy assumptions.
- Static Astro / Vite → Cloudflare Pages (`pages_build_output_dir: dist`).
- Next.js → Cloudflare Workers via OpenNext, with:
  - `output: "standalone"` in `next.config.ts`
  - `worker.mjs` wrapper around `.open-next/worker.js` that consults
    `caches.default` for GET `/` (with cookie-aware bypass).
  - `cf:build` chain: `next build --webpack && node
    scripts/inline-critical-css.mjs && opennextjs-cloudflare build
    --skipNextBuild && opennextjs-cloudflare populateCache local`.
  - Edge cache `Cache-Control` headers set in `next.config.ts` `headers()`
    for any route that is fully static.

When a Next.js marketing surface is consistently over 1 s LCP and the
content is fully static, that's the signal to port it to Astro instead of
optimising further.

## Fleet Cloudflare account hygiene

The Cloudflare account stays lean: **one Worker (or Pages project) per product surface.**
No persistent preview/PR clones accumulating in the dashboard.

Rules:
- **Never create standalone preview/PR Workers** (`<name>-preview`, `<name>-pr-<n>`).
  A `deploy-preview` CI job that runs `wrangler deploy --env preview` or
  `wrangler deploy --name <name>-pr-$PR` creates a *separate* Worker script that is
  never torn down when the PR closes. This is what produced the fleet's orphan
  clutter (`email-manager-preview`, `high-signal-web-preview`,
  `significanthobbies-preview`, `open-historia-pr-*`, `truehire-pr-*`).
- **For PR previews, use ephemeral, self-cleaning mechanisms instead:**
  - `wrangler versions upload` → a preview URL on the **same** Worker (no new script), or
  - Cloudflare Pages preview deployments (auto-expire), or
  - if a per-PR Worker is truly unavoidable, pair it with a teardown step
    (`wrangler delete --name <name>-pr-$PR`) in an
    `on: pull_request: types: [closed]` job so nothing persists.
- **Deploy each product from one wrangler config to one name.** Don't suffix names
  per branch/env unless the env is a real, permanent, separately-routed surface.
- **When auditing the account,** orphan `-preview`/`-pr-N` Workers with no custom
  domain or route are cleanup targets — delete them *and* remove the workflow job
  that recreates them, or they come straight back on the next PR.
- **Pages "Git Provider: No" is expected** for fleet products: they deploy via
  `wrangler pages deploy` (direct upload) per the deployment standard above, not
  Cloudflare's GitHub integration. Do not "reconnect" them to Git to chase a green
  checkmark — the CLI/CI deploy is the source of truth.

## Fleet tooling architecture (fleet-ops/)

All fleet tooling — skills, scripts, docs, templates, teammates, and the
psi-swarm tool — lives under `fleet-ops/` in this repo. It is the single
version-controlled home. Agents discover skills via symlinks from their
profile skill dirs into `fleet-ops/`; edit skills in the repo, never in
the symlink targets.

### Structure

```
fleet-ops/
├── skills/              ← fleet operational skills
│   ├── fleet-ops/       ← parent: routes to fleet-audit, fleet-init, fleet-deploy-guard, fleet-workspace
│   ├── fleet-audit/     ← subskill: fleet health / status / full audit (3 modes)
│   ├── fleet-init/      ← subskill: scaffold new fleet projects
│   ├── fleet-deploy-guard/ ← subskill: deploy readiness gate
│   ├── fleet-workspace/ ← subskill: cross-project workspace decisions
│   ├── name-domains/    ← standalone: domain name generation
│   ├── spec-driven/     ← standalone: OpenSpec spec-driven dev workflow for new features
│   ├── agent-ready/     ← standalone: AI crawler readiness scan
│   ├── seo-audit/       ← standalone: on-page SEO audit
│   └── token-budget/    ← standalone: Codex context/token audit
├── teammates/skills/    ← delegation skills
│   ├── call-teammate/   ← parent: routes to 5 call-* subskills
│   ├── call-claude-code/ ← subskill
│   ├── call-codex/      ← subskill
│   ├── call-cursor/     ← subskill
│   ├── call-devin/      ← subskill
│   └── call-grok/       ← subskill
├── psi-swarm/           ← standalone: Lighthouse perf audits (skill + CLI tool)
├── scripts/             ← fleet scripts (health checks, perf sweeps, bench-launch, link/unlink)
├── docs/                ← living docs (runbook, agent-layering, perf-monitoring, audits)
│   └── archive/         ← dated snapshots (not living reference)
├── templates/           ← shared code templates (api-timing.ts)
└── teammates/           ← ROSTER.md, SCORECARD.md (delegation routing + outcomes)
```

### Skill discovery (progressive disclosure)

Only 10 fleet skills are exposed to each agent — 2 parents + 8 standalones:

| Symlink | Type | Routes to |
|---|---|---|
| `fleet-ops` | parent | fleet-audit, fleet-init, fleet-deploy-guard, fleet-workspace |
| `call-teammate` | parent | call-claude-code, call-codex, call-cursor, call-devin, call-grok |
| `name-domains` | standalone | — |
| `psi-swarm` | standalone | — |
| `spec-driven` | standalone | OpenSpec workflow for new features |
| `agent-ready` | standalone | AI crawler readiness |
| `seo-audit` | standalone | on-page SEO audit |
| `token-budget` | standalone | Codex context/token audit |
| `mobile-task-control` | standalone | durable chat-requested task control |
| `daily-learning` | standalone | private adaptive learning-session links |

Agent skill dirs wired (symlinks point to `fleet-ops/` paths):
- `~/.codex/skills/` (Codex CLI)
- `~/.openclaw/skills/` (OpenClaw Gateway agents)
- `~/.hermes/skills/` (optional Hermes Agent, only when enabled locally)

Agents load the parent skill, read the routing table, then load the relevant
subskill's SKILL.md on demand. Subskills are not symlinked individually —
they're discovered via the parent.

### Adding a new skill

1. Create `fleet-ops/skills/<name>/SKILL.md` (or under `teammates/skills/` for delegation).
2. If it belongs under an existing parent, add a row to the parent's routing table.
3. If standalone, symlink it into each agent skill dir: `~/.claude/skills/`, `~/.codex/skills/`, `~/.cursor/skills/`, `~/.config/devin/skills/`.
4. Commit and push.

## Agent teammate delegation (call-teammate parent skill)

Agents on this machine can delegate scoped work to other agent CLIs as
teammates. The `call-teammate` parent skill (at `fleet-ops/teammates/skills/call-teammate/`)
routes to the right subskill based on which CLI the user names:

- Subskills: `fleet-ops/teammates/skills/call-codex|call-grok|call-claude-code|call-devin|call-cursor`.
  Each defines when-to-call, exact invocation, briefing template, output
  schema, safety bounds, and the review loop.
- Routing: `fleet-ops/teammates/ROSTER.md` — who is strong at what.
- Outcomes: `fleet-ops/teammates/SCORECARD.md` — append one line per delegation;
  skim before delegating similar work.

Non-negotiables regardless of teammate: explicit sandbox/permission flags
(never rely on CLI config defaults), delegate only from a clean checkout into
a worktree, verify diffs and tests yourself, and `< /dev/null` on every
teammate invocation. Devin is ACU-metered — confirm spend first. If a
teammate fails on usage/rate limits, fail over down the chain in
`fleet-ops/teammates/ROSTER.md` and log the switch in the scorecard — don't
retry the exhausted teammate or silently drop the task.

## Fleet agent email + secrets management (AgentMail + Infisical)

Agents have a programmatic email inbox via **AgentMail**, used to receive
verification / key-delivery emails when signing up for free third-party API keys
(EIA, OpenStates, news APIs, etc.) without a human in the loop.

- **Inbox:** `sarthakagrawal@agentmail.to`
- **API:** `https://api.agentmail.to/v0/` — Bearer auth. List mail with
  `GET /v0/inboxes/<inbox_id>/messages`.
- **AgentMail key location:** `~/.config/agentmail/api_key` (user-level,
  `chmod 600`, outside every repo). **Never** commit the key value or paste it
  into a tracked file — reference the path only. Read it at call time:
  `KEY=$(cat ~/.config/agentmail/api_key)`.

**Secrets manager: Infisical** (`infisical` CLI, logged in as the user on
`app.infisical.com`). This is the canonical home for obtained API keys — store
them there, not in repos. The fleet root has a gitignored `.infisical.json`
linking the **Fleet** project (`workspaceId 46e20071-…`), so `infisical`
commands run from anywhere under `~/Desktop/fleet` default to it.

- **Set a secret:** `infisical secrets set NAME="$(cat <path>)" --env=dev`
  (heads-up: `secrets set` echoes the value in its result table — redirect /
  filter the output so the value doesn't land in logs or a transcript).
- **Read into a process:** `infisical run --env=dev -- <cmd>`, or fetch one with
  `infisical secrets get NAME --env=dev --plain`.
- **Already stored:** `AGENTMAIL_API_KEY`, `EIA_API_KEY`, `OPENSTATES_API_KEY` (Fleet project, `dev` env).

**Automating API-key signups (what works, 2026-06-26).** Proven recipe:
**Playwright** (isolated venv: `uv venv … && uv pip install playwright && playwright
install chromium`) to drive the signup form + click the verification link, paired
with the **AgentMail** inbox (poll `GET /v0/inboxes/<inbox>/messages`, fetch the
message, regex the verify-link / key out of the body). This got **EIA** end to
end — form → verification email → activation link → key email → stored in
Infisical — where a plain `curl` POST had failed (the form needs JS).

What it **cannot** do, and why each is a hard wall:
- **OAuth-only signup** (OpenStates → Plural Policy: Google/GitHub only, no
  email/password form) — needs the user's federated login; don't automate.
- **reCAPTCHA / hCaptcha / Turnstile** (Regulations.gov / api.data.gov, The
  Guardian) — Playwright fills the form but cannot solve the challenge; needs a
  paid solver. Skip (and note Guardian/news is already covered keyless via RSS).
- **GOV.UK One Login** (Companies House) — email OTP + authenticator app,
  multi-step + low value; not pursued.

So the rule: no-CAPTCHA email-verified forms → automatable with Playwright +
AgentMail; OAuth-only or CAPTCHA-walled → still manual.

## Learning tracks for fancy-tech projects

Any fleet project using "fancy" / non-standard tech (ML/AI internals, novel runtimes, systems programming, exotic frameworks, research-y stacks) maintains a **short learning track** alongside the code. Skip for plain full-stack work (typical CRUD apps, standard Next.js + Drizzle + Turso glue, standard auth) — it's noise there.

The canonical artifact is **one short file**: `docs/learning/new-things.md`. It is a **study queue**, not an essay. Each entry is 3-5 lines and looks like:

```
## <Topic name>
- What: one-line definition
- Why here: TBD — fill after learning, OR one line if it's truly evident
- Gotcha (from code): one-line surprise from the repo if any
- Source: <authoritative external link>
```

Optional companion files (keep both short — under ~100 lines each):
- `docs/learning/external-references.md` — one-line `what / why / link` entries for authoritative sources cross-linked from new-things.md.
- `docs/retros/<YYYY-MM-DD>-<slug>.md` — only for real, dated phase shifts. Skip if there are none.

Shape rules:
- **The user is the learner**, not a reader of an agent-written essay. Do NOT pre-fill the `Why here:` paragraph with inferred rationale — leave it `TBD`. The point is to surface "topics the user hasn't internalized yet" so they can learn each one locally via LLMs and fill in their own understanding.
- Real content only — `TBD` for unknown rationale, NEVER invent.
- Lean on external sources for anything well-documented (papers, framework docs). Do not re-explain.
- Match the project's existing case/naming.

Older verbose `docs/decisions.md` / `docs/lessons.md` scaffolds from earlier passes should be moved to `docs/archive/` and their topics distilled into `docs/learning/new-things.md` stubs.

When starting work in a fancy-tech project:
1. Check whether `docs/learning/new-things.md` exists.
2. If missing, propose creating it as a short topic stub list (confirm first — it's a structural addition).
3. If present, append a new stub when novel tech enters the code; leave `Why here:` as `TBD` for the user to fill after learning.

The fleet-wide audit and per-project scaffold notes live at `fleet-ops/docs/learning-track-audit.md`.

## Out-of-fleet projects

The following personal, archived, delayed, or parked projects are NOT part of
the fleet product surface. Do not include them in fleet-wide sweeps, perf
audits, or standardisation passes; do not write fleet-wide tasks against them.

- `everythingrated` — retired/out-of-fleet
- `open-historia` — archived/out-of-fleet
- `today-little-log` — archived (merged into significanthobbies)
- `truehire` — retired; RolePatch owns the active resume/proof surface
- `verified-bases` — archived
- `companion-robot` — delayed
- `device-net-test` — scratch network test app
- `forecast-lab` — delayed
- `elves-hq` — parked
- `saas-maker-ci-fix` — duplicate worktree

If a sweep touches all fleet projects, exclude these by name. Active fleet
products are listed in the fleet `README.md`.
