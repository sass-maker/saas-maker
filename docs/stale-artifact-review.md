# Stale Artifact Review (Category B)

Generated: 2026-04-27

These items were flagged during the Fleet-wide stale artifact sweep but NOT auto-deleted. They require human review before action because they may have legitimate uses (Cloudflare Containers, local dev, etc.) or require code changes beyond simple file deletion.

## Dockerfiles (confirm not used by Cloudflare Containers)

| Repo | File | Notes |
|------|------|-------|
| agentMode | `web/Dockerfile` | Multi-stage Next.js build. Uses `npm ci`, references `package-lock.json`. Likely legacy from pre-Cloudflare deploy. Confirm web is on Pages/Workers and remove. |
| anime_list | (already deleted at root — was simple Node Alpine container running `tsx server.ts`. Originally flagged for review but anime_list now deploys to CF Pages so it was removed in the cleanup commit.) | n/a |

Action: For agentMode, verify `web/` is deployed via wrangler (Workers Static Assets) and delete `web/Dockerfile` if unused.

## README deploy mentions referencing legacy platforms

| Repo | File | What |
|------|------|------|
| starboard | `README.md` | "Live" badge points to `mystarboard.vercel.app`; mentions "Vercel serverless API routes" and "Vercel serverless functions under `api/`". |
| today-little-log | `README.md` | "Vercel serverless API routes", "Vercel serverless functions under `api/`", and footer "Deployed on Vercel. Push to `main` to trigger a production deploy." |

Action: Update READMEs to reflect Cloudflare Pages/Workers deployment, swap badge URL to the live `*.pages.dev` or custom domain, replace "Vercel serverless functions" wording with Cloudflare Workers / Pages Functions.

## Multiple lockfile types

| Repo | Detail |
|------|--------|
| saas-maker | Root uses `pnpm-lock.yaml`. `packages/blocks/email/` has its own `package-lock.json`. Per agent coordination rules, did NOT modify saas-maker packages — defer to P2 (a255a8c8). |

Action: P2 should decide whether `packages/blocks/email/` needs its own npm-managed lockfile or should be hoisted into the pnpm workspace.

## Repos blocked by failing pre-push hooks (commit landed locally, push blocked)

| Repo | Local commit SHA | Blocker |
|------|------------------|---------|
| reader | `e181f6c` (chore: remove stale legacy deploy artifacts (vercel)) | `pnpm run lint` fails. Likely from in-flight changes by other agents (P1 foundry / Shields wrangler). Re-push after their work lands. |
| truehire | `9ba0bc6` (chore: remove stale legacy deploy artifacts (vercel)) | `pnpm --filter @truehire/core test` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`. Pre-existing breakage unrelated to artifact deletion. |

Action: Once the failing test/lint is fixed by the responsible agent, simply `git push` from each repo to land the cleanup commit.

## Items NOT found (clean across the fleet)

- No `netlify.toml`, `_redirects`, or `.netlify/` anywhere.
- No `Procfile`, `railway.{json,toml}`, `render.yaml`, `fly.toml`, `now.json`.
- No tracked `node_modules/`, `dist/`, `build/`, `.next/`, `.open-next/`, `.turbo/`, `.wrangler/`.
- No tracked `.env`, `.env.local`, `.env.production`, `.env.production.local` files (only `.env.example` which is per-spec).
- No tracked `.idea/`, `.yarn/`, `yarn.lock`, `.yarnrc`, `yarn-error.log`.
- No `.bak`, `.orig`, `_old` files.
- No GitHub Actions workflows deploying to Vercel/Netlify/Heroku.
- All `.gitignore` files already include `.DS_Store`.
- No `supabase/` config directories.
- No `next.config.*` with `target: 'serverless'` or Vercel-specific image domains.

## Coordination notes

- P1 (a7fdf33c, foundry fixes): Touching package.json/.husky in many repos. Did not conflict — only deleted standalone `vercel.json` / `.vercelignore`.
- P2 (a255a8c8, saas-maker): Skipped saas-maker packages/root entirely as instructed.
- Shields (afda506c, wrangler configs): No overlap — wrangler files were never deletion targets.
