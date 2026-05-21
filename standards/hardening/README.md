# Hardening standards

Build-once, reuse-15x assets for moving fleet projects from "runnable" to
"commercial / actively usable". Extracted from the **`resume-tailor` pilot**
(Wave 1-E of `fleet/PLAN.md`).

These are **templates and reference docs**, not a package. Copy what you need
into a project and fill in the placeholders — every project-specific bit is
marked `PLACEHOLDER` in the file. Files carry a `.template` suffix so they
aren't picked up as live code inside `saas-maker`; **strip the suffix when you
copy a file into a project.**

## The three kits

| Kit | Workstream | What it gives you |
|---|---|---|
| [`error-kit/`](./error-kit/README.md) | Error / Observability | Next.js `error.tsx` / `global-error.tsx` / `not-found.tsx` / `loading.tsx` templates, a `<ErrorBoundary>` for Vite SPAs, and a `captureError()` helper. No silent blanks, no leaked stack traces. |
| [`analytics-kit/`](./analytics-kit/README.md) | Owner-facing analytics | A template `analytics.ts` implementing the fixed 4-event taxonomy (`signup`, `activated`, `core_action`, `returned`), each event tagged with `project`, built on `@saas-maker/posthog-client`. |
| [`mobile-kit/`](./mobile-kit/README.md) | Mobile polish | The Playwright mobile-viewport config + a conventions doc (390px target, ≥44px touch targets, Tailwind breakpoint guidance). |

(`mobile-kit/` ships `conventions.md` rather than a README — same role.)

## Applying a kit to a project

1. Read the kit's own README / conventions doc.
2. Copy the template files into the project, dropping the `.template` suffix.
3. Search the copied files for `PLACEHOLDER` / `REPLACE_ME` and fill each in.
4. Wire as the README describes; run the project's lint + typecheck.

## Why these three

Per `fleet/PLAN.md`, the hardening effort has four workstreams — Analytics,
Mobile, Marketing, Error/Observability. Three of them produce reusable code
assets and live here. The fourth, **Marketing** (landing template + OG
share-card generator), is tracked separately in `fleet/PLAN.md` Wave 1-D/E.

Most fleet projects share a stack (Next.js 16 / React 19 / Tailwind v4 /
shadcn), so these templates drop in with minimal edits. `resume-tailor` was
the pilot *and* the source — see its `src/app/` error files,
`src/lib/analytics.ts`, `src/lib/foundry-monitoring.ts`, and
`playwright.config.ts` for the live reference implementation.

## Rollout

- **Wave 2** — apply `error-kit/` across all 16 projects first (universal,
  highest user-trust ROI).
- **Waves 3-4** — apply `analytics-kit/` and `mobile-kit/` per project
  alongside that project's other hardening work.
