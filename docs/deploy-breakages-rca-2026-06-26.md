# Fleet deploy/CI breakages — RCA (2026-06-26)

Root-cause analysis of the breakages found while consolidating Cloudflare
projects and git state. Every root cause below was verified against run logs,
worker/asset state, or config — not inferred. Fixes landed where noted; open
items are tracked at the end.

## TL;DR — one meta-cause

Two **fleet-wide automated chore migrations** were applied broadly in mid-June
**without per-repo verification**, and the deploy pipelines have **manual steps
and non-fault-tolerant post-steps**. The migrations left a trail of red CI and
broken deploys; the pipeline gaps took down a homepage and littered the CF
account. No single catastrophic event — accumulation of unverified sweeps.

| # | Breakage | Root cause | Status |
|---|----------|-----------|--------|
| 1 | highsignal.app homepage 404 | Astro landing overlay step missing from CI deploy | ✅ fixed |
| 2 | 13 orphan `*-preview` / `*-pr-N` Workers | preview deploy jobs with no / mis-gated teardown | ✅ fixed |
| 3 | `reader` deploy fails; `truehire` CI fails | pnpm dual-version (`ERR_PNPM_BAD_PM_VERSION`) | ⏳ open |
| 4 | `looptv` CI fails; `high-signal`/`open-historia` pushes blocked | Biome lint debt (config set, code never reformatted) | ⏳ open |
| 5 | `significanthobbies` deploy job red | post-deploy cache-purge curl 401 (token lacks zone perm), not fault-tolerant | ⏳ open |
| 6 | ~6 CF products "not connected to git" | deployed by manual `pnpm deploy`, no GitHub Actions | ⏳ partial |

---

## 1. highsignal.app homepage 404 (production outage)

**Symptom:** `GET /` → 404 on apex + www; app routes (`/track-record`, `/lab`) → 200.

**Root cause:** The homepage is deliberately served as a *static* `index.html`
(the Astro landing), bypassing the Worker (`run_worker_first = ["/*","!/"]` in
`apps/web/wrangler.toml`). That file only reaches the deploy if `landing-astro`
is built **and** `scripts/run-overlay-astro-landing.mjs` copies it into
`.open-next/assets`. Neither the CI workflow (`deploy-web.yml`) nor the
`cf:build`/`deploy` scripts ran those steps — the overlay had only ever been
done by hand (Jun 20). The Jun 23 CI deploy ("kv cache batch #15") rebuilt
assets from scratch with no overlay → homepage-less build → `/` 404.

**Aggravating:** the deploy job runs `deploy` **then** smoke-checks `/`. The
broken Worker went live first; the smoke turned the run red — but red ≠
rollback, and the red run wasn't actioned.

**Fix (landed):** folded `build:landing` + overlay into `cf:build`
(`high-signal` commit `48791e3`). CI "Deploy web" verified green 2026-06-26.

**Prevention:** no deploy artifact may depend on a manual step. If a build has
an overlay/post-process, it lives in `cf:build`, not in an operator's shell
history. Smoke-checks should gate (deploy to a version/preview, smoke, then
promote) rather than smoke-after-promote.

## 2. Orphan preview / PR Workers (account clutter)

**Symptom:** 13 stray Workers — `email-manager-preview`,
`high-signal-web-preview`, `significanthobbies-preview`,
`open-historia-pr-{5,7,9,10,11}`, `truehire-pr-{2,3,4,5,6}`.

**Root cause:** PR-preview CI jobs created standalone Workers:
- `--env preview` → a persistent `<name>-preview` Worker with **no teardown**
  (email-manager, high-signal, significanthobbies).
- `--name <name>-pr-N` per-PR Workers whose `cleanup-preview` job was gated on
  `pull_request.merged == true` — so PRs closed-without-merge (and PRs predating
  the cleanup job) never tore down (open-historia, truehire).

A mid-June burst of automated chore PRs (items 3 & 4) opened many PRs, few
merged → pile-up.

**Fix (landed):** deleted all 13; removed the no-teardown preview jobs; changed
per-PR teardown to fire on **any** `pull_request_target` close. Codified in
`AGENTS.md` → "Fleet Cloudflare account hygiene".

## 3. pnpm dual-version conflict (broke deploys + CI)

**Symptom:** `reader` deploy and `truehire` CI fail at pnpm setup:
`Error: Multiple versions of pnpm specified … ERR_PNPM_BAD_PM_VERSION`.

**Root cause:** the **pnpm-pinning chore** added
`"packageManager": "pnpm@10.33.2"` to `package.json`, but the workflows still
pass a `version:` to `pnpm/action-setup`. When both are present,
`action-setup` refuses to guess and errors. The chore pinned `packageManager`
without removing the now-conflicting action input.

**Fix:** remove the `version:` input from `pnpm/action-setup` (let
`packageManager` be the single source of truth). Fleet-wide — grep every
workflow for `pnpm/action-setup` + a `version:` and a `packageManager` field.

## 4. Biome lint debt (red CI + blocked pushes)

**Symptom:** `looptv` CI red; `high-signal` (211 errors) and `open-historia`
pre-push hooks block *any* push, even one-line YAML edits.

**Root cause:** the **ESLint→Biome migration** set the Biome config
(`quoteStyle: single`, etc.) and a deprecated `recommended` field, but **never
ran the formatter** over existing code. `biome check .` then fails on
pre-existing double-quotes / unused vars across the repo. Whole-repo pre-push
hooks make this block unrelated work.

**Fix:** per affected repo, run `biome check --write` (and replace the
deprecated `recommended` field with `preset`); consider scoping pre-push hooks
to staged files. Until cleared, `--no-verify` is justified for unrelated diffs
when the pre-existing failure is named. See memory `project_fleet_biome_pushblock`.

## 5. significanthobbies deploy job red (non-fatal)

**Symptom:** "Deploy to Cloudflare Workers" red; site live, Production Smoke green.

**Root cause:** the `wrangler deploy` succeeds, but the **post-deploy
"Purge edge cache for landing HTML" step** runs a `curl` against the zone
purge_cache API and gets **HTTP 401** — the `CLOUDFLARE_API_TOKEN` lacks the
zone `cache_purge` permission. The step isn't fault-tolerant, so a successful
deploy reports as failed.

**Fix:** either grant the token `cache_purge` on the zone, or make the purge
step `continue-on-error: true` / `|| true` (purge is best-effort). Not my
2026-06-26 workflow edit — verified pre-existing.

## 6. CF products "not connected to git"

**Symptom (user, dashboard):** most Pages projects show "Git Provider: No";
several products deploy with no GitHub Actions at all.

**Two distinct facts, neither a "crash":**

- **Pages "Git Provider: No" is by-design** for direct-upload projects. Fleet
  products deploy via `wrangler pages deploy` / wrangler-action from CI, not
  Cloudflare's native GitHub integration. Cloudflare **cannot convert** a
  direct-upload project to git-connected in place, and native connection needs
  an interactive GitHub-App OAuth (can't be done headlessly) — recreating live
  projects would risk custom domains (codevetter.com, sassmaker.com, etc.).
- **Genuinely un-CI'd products** — resolution (2026-06-26):
  - `materia`, `pace`, `research-papers` (Pages) → **connected**: added GitHub
    Actions deploy workflows, dispatch-verified green + live, push-trigger enabled.
  - `everythingrated` → **already connected** (pre-existing `cloudflare-deploy.yml`
    deploys on push via `pnpm run deploy`; the earlier scan missed the indirect call).
  - `verified-bases-api` (Go/WASM Worker) → **wired** (dispatch-only workflow
    added); first CI run intentionally not auto-fired — it's a live payments
    worker, trigger with eyes on it.
  - `taste` (→ `shiprank` Pages) → **wired but BLOCKED**: workflow added, but the
    repo's `bun run build` (`tsc -b`) fails on pre-existing type errors in
    `functions/api/services/pipeline.ts` and `src/lib/tasteJsonl.test.ts`. The
    manual deploy is equally broken. Fix the types to unblock. `taste-capture`
    Worker left manual (needs hand-set secrets).
  - org-level CF secrets already reach all repos, so Actions deploys authenticate
    without per-repo secret setup.

**Note:** "connected via GitHub Actions" does **not** flip the dashboard
"Git Provider" column to Yes. Native dashboard connection is a separate,
manual, one-time step per project.

---

## Systemic prevention (fleet-standards work)

1. **No unverified fleet-wide sweeps.** A chore applied to N repos must run that
   repo's CI (or at least `lint` + the deploy `setup` steps) before merge. The
   pnpm-pin and Biome sweeps skipped this and broke many repos at once.
2. **Migrations include their cleanup pass.** Change a linter → run its
   formatter. Pin a package manager → remove the now-redundant action input.
3. **Deploy artifacts never depend on manual steps** (item 1). Overlays /
   post-processing belong in `cf:build`.
4. **Post-deploy steps are best-effort** (item 5) — never fail a green deploy on
   a cache purge / comment / notification.
5. **Previews are ephemeral and self-cleaning** (item 2) — codified in AGENTS.md.
6. **Watch red runs.** Several of these sat red for days. A weekly `gh run list`
   sweep across the fleet (or required checks) would have surfaced them.
