# SaaS Maker Widget Roadmap

Granular widget approach: each widget = own published npm package. Apps install only what they need. No per-repo wrappers — packages self-configure from `NEXT_PUBLIC_SAASMAKER_API_KEY`.

## Existing (published, already integrated across Fleet)

| Package | What |
|---|---|
| `@saas-maker/feedback` | Bottom-corner bug/feature button |
| `@saas-maker/changelog-widget` | Public release timeline |
| `@saas-maker/testimonials` | Testimonial wall |

**TODO:** republish with self-configure (read env, apply theme/position defaults) so per-repo wrapper components can be deleted Fleet-wide.

## Tier 1 — every user-facing app (priority build order)

| Package | What | Backend |
|---|---|---|
| `@saas-maker/newsletter` | Email signup → CF Email Workers / Resend | sassmaker-api + D1 |
| `@saas-maker/cookie-consent` | GDPR banner + preferences | localStorage only |
| `@saas-maker/theme-toggle` | Light/dark + system, persisted | localStorage only |
| `@saas-maker/status-badge` | Live uptime indicator | sassmaker-api (status checks) |

## Tier 2 — most apps benefit

| Package | What | Notes |
|---|---|---|
| `@saas-maker/login-modal` | Drop-in better-auth UI (Google + email) | Pairs with `@saas-maker/auth-preset` |
| `@saas-maker/pricing-table` | Config-driven plans + Stripe checkout link | Stripe price IDs from env |
| `@saas-maker/cmdk` | Cmd+K palette, project-wide search | Optional Fleet-wide search via api |
| `@saas-maker/og-image` | OG image generator via Browser Rendering | $5 paid plan unlock |
| `@saas-maker/account-menu` | User dropdown for better-auth | Pairs with auth-preset |

## Tier 3 — specialty / vertical

| Package | What |
|---|---|
| `@saas-maker/ai-helper` | Workers AI floating chatbot (Llama 3.3) |
| `@saas-maker/nps-prompt` | Periodic in-app NPS survey |
| `@saas-maker/roadmap` | Public feature voting (Canny-style) |
| `@saas-maker/onboarding-tour` | First-run walkthrough |
| `@saas-maker/notif-bell` | In-app notifications (Durable Objects-backed) |
| `@saas-maker/share-card` | Generate shareable image cards |

## Build order (when scheduled)

1. Republish existing 3 with self-configure → enables Fleet-wide wrapper deletion
2. Tier 1 (4 packages) — most universal value
3. Tier 2 (5 packages) — auth + monetization stack
4. Tier 3 — as Fleet projects need them

## Conventions

- Each package: own `src/`, `tsup.config.ts`, `package.json`, README, vitest tests
- Self-configure: read `NEXT_PUBLIC_SAASMAKER_API_KEY`; props override env
- Theme prop: `light | dark | auto` with `auto` reading system preference
- API base: `https://api.sassmaker.com` (override via prop)
- Single-line consumer integration:
  ```tsx
  import { Newsletter } from "@saas-maker/newsletter";
  <Newsletter />
  ```
- No per-repo wrappers ever again

## Decision pending

- **Tier 1 only first OR Tier 1+2?**
- **Cookie consent worth it for non-EU traffic?**
- **Storage backend:** sassmaker-api + D1 reuse (vs new dedicated DBs per widget)
