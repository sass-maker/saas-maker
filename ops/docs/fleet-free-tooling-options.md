# Fleet free/OSS tooling options (2026 snapshot)

This is a decision-support snapshot for keeping the fleet **cost-conscious,
OSS-first, and lock-in-resistant**. It is not a live pricing sheet, an adoption
inventory, or authorization to introduce a new service. Vendor limits and
licenses change frequently; verify them against the vendor's official source
at decision time.

The enforceable defaults remain `AGENTS.md`, project manifests, and approved
architecture decisions. In particular, the suggested observability products
in this document (including PostHog, Sentry-compatible backends, Axiom, and
Uptime Kuma) are options until the fleet owner explicitly approves a common
stack. This file must not be used to infer that every project is instrumented
or that Cloudflare plus PostHog provides complete fleet visibility.

It covers hosting, databases, auth, email, observability, feature flags, CMS,
secrets, CI/CD, code health, and security scanning. For each category:

- **Adopt** = an existing approved default, or a proposal that still requires
  owner approval before new rollout.
- **Acceptable** = fine to use when the default doesn't fit, with a stated reason.
- **Avoid** = known trap (paid-only, killed free tier, license risk, or lock-in).

Adoption notes are a dated snapshot, not audit evidence. The generated Foundry
catalog and per-project manifests own current integration state.

Companion docs:
- `knip-adoption-standard.md` — dead-code analysis rollout.
- `agent-indexing-standard.md` — AI crawler surface.
- `cloudflare-resilience-standard.md` — Cloudflare-specific ops.
- `LANDING_STANDARD.md` — landing-page conventions.

---

## 1. Hosting / serverless

**Adopt: Cloudflare Workers + Pages** (already fleet-wide).
- Pages Free: unlimited bandwidth, 500 builds/mo, 100 sites, custom domains.
- Workers Free: 100k req/day, 10ms CPU, no cold starts, edge-native.
- Workers Paid ($5/mo) when 100k req/day or 10ms CPU is exceeded.
- Commercial use explicitly allowed on the free tier (unlike Vercel Hobby).
- The entire fleet already uses `wrangler` — see audit below.

**Acceptable: Render** for full-stack services that need a long-running Node
process, Postgres, or background workers. Free web services (512 MB RAM,
spins down after 15 min idle) + free Postgres (90 days). Use only when
Workers cannot host the workload (e.g. a WebSocket server that doesn't fit
Durable Objects).

**Avoid:**
- **Vercel Hobby** for anything commercial — fair-use guidelines ban
  monetization on the free tier. Pro is $20/seat/mo and adds up across the
  fleet. Keep existing Next.js on Cloudflare via OpenNext where possible
  (per AGENTS.md).
- **Fly.io** — free tier reduced to a 2-hour trial for new accounts (2025).
- **Heroku** — free tier removed in 2022.
- **Netlify** — moved to credit-based pricing (300 credits/mo) in Sept 2025;
  fine for hobby but not a fleet default.

**Fleet adoption:** 18/21 in-scope projects use `wrangler`. No project uses
Vercel/Netlify/Render as a primary deploy target.

---

## 2. Database / storage

**Adopt: Cloudflare D1 + R2 + KV + Queues** for Workers-hosted projects.
- D1 Free: 5 GB, 5M row reads/day, 100k writes/day, 10 databases.
- R2: zero egress, $0.015/GB-month storage. S3-compatible.
- KV Free: 100k reads/day, 1k writes/day, 1 GB storage.
- No network hop between Worker and DB. Already the fleet pattern via
  `wrangler` + Drizzle.

**Adopt: Neon** when a project needs real Postgres (pgvector, FTS, RLS,
extensions) outside the Workers runtime.
- Free: 0.5 GB/project, 100 projects, 10 branches/project, scale-to-zero.
- Standard Postgres — no lock-in. Branching is genuinely useful for preview
  environments.

**Adopt: Turso** for edge SQLite with embedded replicas (mobile/edge).
- Free: 5 GB, 500M row reads/mo, 10M writes/mo, 100 databases.
- Use when latency matters more than Postgres features.

**Acceptable: Supabase** when a project wants Postgres + auth + storage +
realtime in one platform. Free: 500 MB Postgres, 50k MAU auth, 1 GB file
storage. Pause-in-place after 7 days of inactivity — not ideal for low-
traffic fleet projects. Prefer Neon + Better Auth for separation.

**Avoid:**
- **PlanetScale** — removed free tier in April 2024, brought back a 1 GB
  Hobby tier in 2026 but with a track record of removing it. Do not build
  fleet dependencies on it.
- **Firebase** — high lock-in (proprietary NoSQL, Google-only), and Storage
  free tier was removed Feb 2026.

**Fleet adoption:** Drizzle ORM is the fleet default (used in 6+ projects:
email-manager, karte, reader, open-historia, significanthobbies,
today-little-log). All Worker-backed projects use D1/KV/R2 via wrangler.

---

## 3. Authentication

**Adopt: Better Auth** (already fleet default).
- MIT-licensed, TypeScript-first, framework-agnostic, self-hostable.
- Plugin architecture: passkey, magic link, organization, admin, OIDC
  provider, 2FA. Free forever — you own the DB and email sending.
- Used in: email-manager, karte, reader, open-historia, significanthobbies,
  rolepatch, today-little-log.

**Acceptable: NextAuth / Auth.js** for Next.js projects that need the
broadest OAuth provider list (80+). Used in starboard. Be aware v5
migration was rocky and the abstraction leaks.

**Acceptable: Supabase Auth** when already using Supabase for the DB.
50k MAU free. Otherwise prefer Better Auth for separation.

**Avoid:**
- **Lucia** — deprecated March 2025. Maintainer recommends it as a learning
  resource, not a production dependency. Migrate to Better Auth.
- **Clerk** for fleet-wide use — 10k MAU free, then $0.02/MAU. Fine for one
  commercial product, expensive across 20+ projects. Managed-only, no
  self-host.
- **Auth0** — 7.5k MAU free, then $23/1k MAU. Enterprise pricing. Use only
  when a customer requires SAML/SSO compliance that Better Auth doesn't
  cover yet.

---

## 4. Transactional email

**Adopt: Cloudflare Email Routing + Email Service** (per AGENTS.md).
- Routing is free, programmable inbound via Workers.
- Email Service (sending) is in beta — wraps the platform you already use.
- See `fleet-ops/docs/CLOUDFLARE_EMAIL_SETUP_NOTE.md` for current setup.

**Adopt: Resend** when Cloudflare Email Service doesn't fit (e.g. React
Email templating, higher volume).
- Free: 3,000 emails/mo, 100/day, no credit card. Best DX in the category.
- $20/mo for 50k emails. Cross-over with SendGrid at ~75-90k emails/mo.

**Acceptable: Brevo** — 300 emails/day forever free. Use when Resend's
100/day cap is too low and you don't want to pay.

**Avoid:**
- **SendGrid** — killed permanent free tier in May 2025. Now a 60-day trial
  then $19.95/mo. Not a fleet default anymore.
- **Mailgun** — 5,000 emails/mo for 3 months, then paid only.
- **Postmark** — only 100 emails/mo free (test only). Best deliverability
  but not a free-tier play.

---

## 5. Product analytics

**Adopt: PostHog** (already fleet-wide — 14+ projects).
- Free: 1M events/mo, 5k session replays, 1M feature flag evaluations,
  experiments, surveys. Most generous free tier in the category.
- MIT-licensed core. Self-hostable (Kubernetes) if data sovereignty matters.
- Bundles analytics + replay + flags + A/B — removes the "stitch six tools
  together" problem.

**Acceptable: Umami** for marketing/content sites that only need pageviews
and want zero cookies / no consent banner.
- MIT-licensed, self-hostable on Vercel + Supabase/Neon for $0/mo.
- Cloud Hobby: 100k events free.
- Use for `*-blume` docs sites and Astro marketing pages where PostHog is
  overkill.

**Acceptable: Plausible** — cleanest pageview UI, <1 KB script, GDPR-
compliant by default. $9/mo cloud or self-host on a $5 VPS. Use when Umami
isn't polished enough for a public marketing surface.

**Avoid: Google Analytics 4** — privacy trade-offs, ad blockers lose 30-50%
of data, vendor lock-in. Not used in the fleet and should stay that way.

**Fleet adoption:** PostHog in ai-game, anime-list, drank, karte, looptv,
reader, rolepatch, significanthobbies, starboard, swe-interview-prep,
today-little-log, and more. No project uses GA4.

---

## 6. Error monitoring / crash reporting

**Adopt: Sentry free tier** for projects that already have Sentry wired
(currently saas-maker).
- Free: 5k errors/mo, 50 replays, 1k performance units. Sufficient for
  most fleet projects.

**Adopt (new default): errex** for self-hosted error tracking on fleet
projects that don't already use Sentry.
- MIT-licensed, single 5 MB Rust binary, ~7 MB RAM, SQLite persistence.
- Sentry-SDK compatible — drop in any Sentry SDK, point at errex.
- MCP-ready for AI agent triage.
- Runs on the same $5 VPS as your app. No Postgres/Redis/Kafka stack.
- Best fit for the fleet: minimal ops, OSS, no per-event billing.

**Acceptable: Glitchtip** — Sentry-compatible, Django/Postgres, ~512 MB
RAM. More mature than errex but heavier. Use when you need the broader
Glitchtip ecosystem.

**Acceptable: Crashlens** — MIT, FastAPI/Postgres/Redis, one
`docker compose up`. Use when you want a Python stack and zero
telemetry.

**Avoid: Sentry self-host** — full stack (Postgres + Redis + Kafka + Snuba
+ Clickhouse), ~4 GB RAM, ~10 services. Too heavy for fleet projects.

---

## 7. Uptime monitoring / status pages

**Adopt: Uptime Kuma** (self-hosted).
- MIT-licensed, 89k GitHub stars, single Node process, SQLite.
- HTTP/TCP/ping/DNS/WebSocket/push checks, 90+ notification services.
- 5-second intervals (vs UptimeRobot's 5-min on free).
- Unlimited monitors (vs UptimeRobot's 50 on free).

**Acceptable: Better Stack free tier** when you want managed uptime +
status page without self-hosting.
- Free: 10 monitors, 1 status page, 1 GB logs (3-day retention).
- Good DX, built-in incident management.

**Acceptable: OneUptime** — Apache 2.0, replaces Pingdom + StatusPage.io +
PagerDuty + Sentry in one self-hosted platform. Use when you want the
full on-call + status page + error tracking bundle and are willing to run
the stack.

**Avoid: UptimeRobot free tier** as a fleet default — 50 monitors, 5-min
intervals, 1 status page. Fine for a single project but doesn't scale
across 20+ fleet surfaces. Self-host Kuma instead.

---

## 8. Logging / observability

**Adopt: Axiom free tier** for log/metrics/trace storage.
- Free: 500 GB/mo ingest, 10 GB-hr query compute, 25 GB storage, 30-day
  retention. No credit card. Most generous log free tier in 2026.
- OTel-native, schema-less, 95%+ compression. APL query language.
- Use for Worker logs, API traces, structured events.

**Acceptable: Grafana Cloud free tier** when you want the full Loki +
Prometheus + Tempo bundle.
- Free: 50 GB logs, 50 GB metrics, 50 GB traces, 3 users. Best full-stack
  observability bundle.

**Acceptable: Vector** (Apache 2.0) as a self-hosted log router when you
need to collect/transform/route logs between sources and sinks. Rust,
very low resource usage. Pairs with Axiom as the sink.

**Avoid: Better Stack Logtail** as a primary log store — free tier
shrunk to 1 GB logs with 3-day retention. Better Stack's strength is
uptime + incident management, not log volume. Use Axiom for logs and
Better Stack for uptime if you split tools.

---

## 9. Feature flags

**Adopt: PostHog feature flags** (already bundled with fleet PostHog).
- Free: 1M flag requests/mo. Local evaluation SDKs. A/B + experiments
  included.
- No extra service to run — every project with PostHog already has flags.

**Adopt (when separating flags from analytics): Unleash OSS**.
- Apache 2.0, self-hosted, single environment free. Most mature OSS flag
  platform. Best SDK coverage. Use when you want flags decoupled from
  analytics.

**Acceptable: Flagsmith** — BSD-3, single Docker image, friendliest UI for
  non-engineers. Use when PMs/CSMs will toggle flags.

**Acceptable: GrowthBook** — MIT, strongest experimentation story among
  OSS. Use when A/B testing is the primary use case.

**Avoid: LaunchDarkly** for fleet use — $75/seat/mo with 5-seat minimum
($375/mo floor) on the cloud side. Enterprise-only pricing.

**Fleet adoption:** PostHog is already in 14+ projects, so feature flags
are available everywhere PostHog is. No separate flag service needed.

---

## 10. CMS

**Adopt: Astro Content Collections / Velite / Contentlayer** for
docs/marketing sites where content lives in the repo as markdown/MDX.
- Zero lock-in, zero ops, content is just files in git.
- Already the pattern for `*-blume` docs sites and Astro marketing pages.

**Adopt: Payload 3** when a project needs a real headless CMS with an
admin UI and Postgres/Mongo.
- MIT-licensed, Next.js-native, runs inside your own project (no separate
  server). REST + GraphQL + Local API. No per-seat pricing.

**Acceptable: Strapi 5** — MIT, 72k GitHub stars, the de facto Node.js
headless CMS. Use when you want a standalone CMS server separate from
the app. Self-host on Render/Railway.

**Acceptable: Keystatic / TinaCMS** — git-backed, markdown-centric, visual
editor. Use when non-developers need to edit markdown content in the repo.

**Avoid: Sanity** for fleet use — SaaS-only content lake, no self-host of
data. $15/seat/mo after free tier (20 seats, 10k docs). Fine for one
commercial product, not a fleet default.

**Avoid: Contentful / Hygraph / Storyblok** — SaaS, usage-based pricing,
vendor lock-in. Not fleet-default material.

---

## 11. Secrets management

**Adopt: Infisical** (already in use per AGENTS.md).
- MIT-licensed core, self-hostable or cloud. SDKs for Node/Python/Go/Java.
- Secret versioning, automatic rotation, K8s operator, secret scanning.
- Free tier: unlimited users, 25 secrets (cloud). Self-host = unlimited.

**Acceptable: Doppler** — cloud-only, best DX, 3 users / unlimited
projects free. Use when self-hosting Infisical is not viable and the
project is small.

**Avoid: HashiCorp Vault** for fleet use — moved to BSL (Business Source
License) in August 2023, not OSI open source. Operationally heavy
(unsealing, HA, storage backends). Overkill for fleet-scale secrets.
Keep using Infisical.

---

## 12. CI/CD

**Adopt: GitHub Actions** (already fleet-wide).
- Free: 2,000 min/mo for private repos, **unlimited for public repos**.
- 20 concurrent jobs. 500 MB artifacts, 10 GB cache/repo.
- Self-hosted runners are free (bring your own compute).
- Every fleet repo is on GitHub — no reason to use anything else.

**Acceptable: Buildkite** — unlimited self-hosted agents on the free plan.
Use when you need fast, scalable pipelines and have your own runner
hardware.

**Avoid: GitLab CI** for fleet use — 400 min/mo free is the tightest tier
in the category. Only worth it if you're already on GitLab for code
hosting, which the fleet is not.

**Avoid: CircleCI** — 6,000 credits/mo (~600 Linux min) free. Smaller
than GitHub Actions and adds a separate platform to manage.

---

## 13. Code health / dead code / supply chain

**Adopt: knip** — fleet-standard dead-code analysis. See
`knip-adoption-standard.md` for the full rollout plan and template.
- Finds unused files, exports, types, dependencies, devDependencies.
- Replaces depcheck. Already in today-little-log; rolling out to 20+.

**Adopt: Biome** — fleet-standard lint + format. Already in 24/35
projects. Bring the 11 holdouts onto Biome for one-command consistency.

**Adopt: react-doctor** as a periodic health check on React projects
(quarterly). Wraps knip + oxlint + eslint-plugin-react-hooks + Socket.dev
supply-chain checks. Always `--no-telemetry` in fleet usage. Not a CI
gate — knip-in-CI is the gate.

**Adopt: Socket.dev** (free tier) for supply-chain dependency scanning
on PRs. Free for public repos. Catches malware/typosquat/license issues
in new dependencies.

**Adopt: Dependabot** (GitHub-native, free) for dependency bump PRs.
Already enabled on most fleet repos via GitHub defaults.

**Avoid: depcheck** — superseded by knip (knip covers deps + dead code +
types in one pass).

**Avoid: Snyk** for fleet-wide use — free tier is limited (open-source
only, 30 days for private repos). Use Socket.dev + Dependabot instead.

---

## 14. tsconfig strictness

**Adopt: `strict: true`** in every tsconfig.json. Free type-safety, no
dependency added. 9 fleet projects currently have `strict` missing:
high-signal, anime-list, starboard, reader, truehire, email-manager,
pace, today-little-log, open-historia, chess, materia.

This is a one-line config fix per repo (separate small PR). May surface
real type errors to fix — that's the point.

---

## 15. Bundle size / performance budgets

**Adopt: size-limit** for Vite/React projects. Already in
today-little-log. Prevents bundle bloat in PRs.

**Adopt: Lighthouse CI** for marketing surfaces. Already covered by the
`psi-swarm` skill for distributional audits.

**Adopt: Cloudflare Observatory** (free, built into the dashboard) for
runtime performance monitoring of Workers/Pages.

---

## 16. Status pages

**Adopt: Uptime Kuma status pages** (bundled with the monitoring tool
above). Multiple status pages, custom domains, subscriber notifications.

**Acceptable: Better Stack status page** — 1 free status page on the
free tier. Use when you want a managed status page without self-hosting.

---

## Summary: candidate free fleet stack

| Category | Tool | License | Free tier |
|---|---|---|---|
| Hosting | Cloudflare Workers + Pages | Apache 2.0 (wrangler) | 100k req/day, unlimited bandwidth |
| DB (Workers) | Cloudflare D1 / R2 / KV | Cloudflare ToS | 5 GB D1, zero R2 egress |
| DB (Postgres) | Neon | Apache 2.0 | 0.5 GB, 100 projects, branching |
| DB (edge SQLite) | Turso | MIT | 5 GB, 100 databases |
| ORM | Drizzle | Apache 2.0 | n/a (library) |
| Auth | Better Auth | MIT | Free forever (self-host) |
| Email | Cloudflare Email Routing + Resend | Cloudflare ToS / MIT | Free routing; 3k/mo Resend |
| Analytics | PostHog | MIT | 1M events/mo |
| Error monitoring | Sentry free tier + errex (self-host) | MIT (errex) | 5k errors/mo (Sentry); unlimited (errex) |
| Uptime | Uptime Kuma (self-host) | MIT | Unlimited monitors |
| Logs | Axiom | Proprietary (free tier) | 500 GB/mo ingest |
| Feature flags | PostHog flags | MIT | 1M flag req/mo |
| CMS | Astro Content Collections / Payload | MIT | n/a / self-host |
| Secrets | Infisical | MIT | Unlimited (self-host) |
| CI/CD | GitHub Actions | Proprietary (free tier) | 2k min/mo private, unlimited public |
| Dead code | knip | MIT | n/a (library) |
| Lint/format | Biome | MIT | n/a (library) |
| React health | react-doctor (periodic) | MIT | Free (with --no-telemetry) |
| Supply chain | Socket.dev + Dependabot | Free for OSS | Free for public repos |
| Bundle size | size-limit | MIT | n/a (library) |
| Perf audits | psi-swarm skill + Lighthouse CI | Apache 2.0 | n/a |

The target is a near-zero fixed tooling cost at current scale. Do not rely on
this snapshot for a dollar total; calculate cost from current vendor pricing
and actual usage before approving a rollout.

---

## What to drop / migrate away from

| Tool | Reason | Action |
|---|---|---|
| depcheck | Superseded by knip | Remove when knip is adopted |
| Lucia | Deprecated March 2025 | Migrate to Better Auth |
| SendGrid free tier | Killed May 2025 | Migrate to Resend or Cloudflare Email |
| PlanetScale | Track record of removing free tier | Use Neon or D1 |
| HashiCorp Vault | BSL license, op-heavy | Use Infisical |
| Vercel Hobby (commercial) | Fair-use ban on monetization | Migrate to Cloudflare Pages via OpenNext |
| GA4 | Privacy, ad-block data loss, lock-in | Use PostHog (already fleet-wide) |
| eslint (where Biome is the standard) | Biome is faster and fleet-standard | Migrate to Biome (open-historia is the only eslint holdout) |

---

## Maintenance

This doc is a shortlist of options. Approved decisions belong in `AGENTS.md`
or a relevant architecture decision, while current adoption belongs in the
generated Foundry catalog and project manifests. When a vendor changes its
free tier, update or remove the affected snapshot claim.

Re-audit quarterly against:
1. Free tier changes (PlanetScale and SendGrid are recent cautionary
   tales).
2. License changes (HashiCorp BSL was a 2023 wake-up call).
3. Fleet adoption drift (is a new project using a non-standard tool?).
