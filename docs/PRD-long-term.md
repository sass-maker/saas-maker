# SaaS Maker — Long-term PRD

_Last updated 2026-06-16._

## TL;DR

SaaS Maker is **the operational substrate and main dashboard for a one-person product factory of ~25 SaaS products**. It is not a product feature catalog; it is the spine that lets a single operator run, observe, and partially automate a portfolio at this scale.

Six purpose-built tooling products each push specific signals into SaaS Maker. SaaS Maker aggregates them, renders the cross-product picture, and serves the cockpit UI the operator uses daily. The other ~13–14 products that don't have purpose-built tooling onboard plug into the same `/v1/*` API for tasks, changelog, feedback, marketing, and analytics so they can be run on weekly check-in cadence.

The success bar is: **the operator runs the fleet from one screen, and adding the 26th product is one integration, not twenty-five.**

---

## Why this exists

### The problem with a portfolio of indie products

Most solo-dev portfolios are ~25 disconnected SaaS apps. Each has its own dashboard, its own billing tab, its own changelog UI, its own task list. The marginal cost of adding the 26th product is roughly the same as adding the 2nd: another login, another inbox, another dashboard to forget to check.

This caps the portfolio at whatever a human can context-switch through in a week, regardless of automation per product. The bottleneck isn't any one product — it's **the operator's bandwidth across products**.

### The thesis

> Build the operational substrate once. Pay the integration cost per product once. Run N products from a single dashboard with one mental model.

SaaS Maker is that substrate. It owns the data and the cockpit. Each product owns its domain logic and integrates by speaking SaaS Maker's `/v1/*` contract.

This is the **AWS / Kafka / data-lake** pattern applied to a personal product portfolio. The novelty isn't the topology — it's applying it at the scale of one operator's portfolio rather than a company.

---

## What SaaS Maker is

### In scope (SaaS Maker owns)

- **Identity** — better-auth (Google OAuth today). `sm_*` CLI tokens for programmatic clients via `/v1/cli/*` flow.
- **Projects** — the canonical product registry. Every fleet product is a row here. Slug is the identity.
- **Tasks** — fleet-wide work items. Created by any client (human in cockpit, CodeVetter from a Review finding, etc.) and visible across projects.
- **Changelog** — per-project release notes, pushable from any client (CodeVetter pushes on release; reel-pipeline pushes on render).
- **Feedback** — incoming user feedback per project, with tagging and triage.
- **Marketing posts** — the queue reel-pipeline reads from.
- **Testimonials** — surfaced for marketing use.
- **Cross-product aggregation** — fleet rollups, weekly digests, AI velocity, billing aggregation, DORA per project. SaaS Maker is the only client that knows about everything.
- **Cockpit UI** — the Next.js dashboard at `app.sassmaker.com`. The daily-driver interface.

### Out of scope (federated to the products)

- **Code review logic** — CodeVetter owns this end-to-end. SaaS Maker only sees the result (findings turned into tasks).
- **Variant evaluation** — taste owns this. SaaS Maker only sees the verdicts.
- **Performance audits** — psi-swarm owns the Lighthouse harness. SaaS Maker only sees the p50/p75/p90/p99 Web Vitals.
- **Demand-signal scraping** — high-signal owns this. SaaS Maker only sees the surfaced signals.
- **AI mention monitoring** — MentionPilot owns this. SaaS Maker only sees the mention deltas.
- **Marketing video rendering + posting** — reel-pipeline owns this. SaaS Maker holds the queue and the result URLs.

SaaS Maker absorbs *what* each tool found. It does not duplicate *how* each tool found it.

---

## Topology

### Hub-and-spoke, not mesh

```
                ┌──────────────────────────────────────┐
                │                                      │
                │           SaaS Maker (hub)           │
                │   D1 ◀▶ /v1/* Worker ◀▶ Cockpit UI   │
                │                                      │
                └──┬──────┬──────┬──────┬──────┬──────┬┘
                   │      │      │      │      │      │
                   ▼      ▼      ▼      ▼      ▼      ▼
                ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐
                │ CV │ │REEL│ │TAS │ │PSI │ │HIG │ │MEN │
                │    │ │PIPE│ │ TE │ │SWAR│ │SIG │ │PILT│
                └────┘ └────┘ └────┘ └────┘ └────┘ └────┘
                       (six tooling clients, no peer edges)
```

**Constraint:** products never talk to each other. Every cross-product feature goes through SaaS Maker.

- **N integrations to maintain, not N²** — 25 products = 25 contracts, not 600.
- **A breaking change in product X affects exactly one consumer**: SaaS Maker's ingestion for X. No cascading rebuilds across products.
- **Adding the 26th product is bounded work** — it implements the same Bearer-auth `/v1/*` write contract every other product implements.

This constraint is load-bearing. Violating it (introducing P2P calls between products) breaks the economics that make a 25-product portfolio possible for one operator.

### Auth contract

- All programmatic clients authenticate with a Bearer `sm_*` token minted via the existing CLI auth flow (`POST /v1/cli/code` → user approves at `app.sassmaker.com/cli/auth?code=…` → client polls `/v1/cli/poll`).
- Tokens are stored per-user in the `cli_tokens` table, scoped to a single user, no per-project scoping.
- Browser-side clients (cockpit) use better-auth opaque session tokens. Both forms resolve to the same `userId` via the auth middleware.
- `LOCAL_AUTH_BYPASS=true` exists for local dev only.

### Domain

- API: `api.sassmaker.com` (note: **double-s**, brand).
- Cockpit: `app.sassmaker.com`.
- The single-s typo (`saasmaker.com`) is a known bug in some `.env.example` files across the fleet repos. Production hostnames are always double-s.

---

## The six integrated products

Each of these has a purpose-built integration today or queued. They cover the product lifecycle quality gates that recur across every one of the user's 25 products.

| # | Product | Lifecycle gate | What it pushes to SaaS Maker | What it pulls from SaaS Maker |
|---|---|---|---|---|
| 1 | **CodeVetter** | Build / engineering quality | Tasks (from Review findings), changelog entries (on release), T-Rex sandbox verdicts, DORA metrics per project | Projects list, sm_* identity |
| 2 | **reel-pipeline** | Distribution / marketing | Render artefacts (asset URLs) PATCHed onto marketing posts | Marketing posts (`/v1/marketing/posts?status=accepted`) |
| 3 | **taste** | Validate-the-idea | Variant arena results, prediction scores, win rates per variant | Projects list (for tagging) |
| 4 | **psi-swarm** | Validate-it-works-at-speed | Web Vitals distributions (p50/p75/p90/p99) per project per run | Projects list |
| 5 | **high-signal** | Discover what to build | Surfaced demand signals from scraping/research, tagged to projects | Projects list |
| 6 | **MentionPilot** | Measure AI awareness | Mention deltas across LLM assistants ("does Claude/GPT mention this product when asked about $domain") | Projects list |

The split between **high-signal** and **MentionPilot** is being decided. Today both live in the `high-signal/` repo; the open question is whether `MentionPilot` is extracted as a separate product (separate `sm_*` integration, separate dashboard surface) or stays as a feature inside high-signal. **Decision deadline: before the next product (#7) joins the spine.** Punting it past that risks one of them never getting first-class fleet treatment.

**Lifecycle coverage rationale:** these six tools were not chosen randomly. Together they answer the questions a portfolio operator has to answer for every product, every week:

- Does anyone want it? → high-signal
- Does the variant we built test better than the alternatives? → taste
- Does the code work and ship? → CodeVetter
- Does it load fast on real devices? → psi-swarm
- Is it being talked about / distributed? → reel-pipeline
- Are AI assistants surfacing it? → MentionPilot

Any product that's missing one of these signals is at risk of failing silently — and silent failure is the killer for the 13–14 "automated, weekly check-in only" products that aren't getting hand-tended attention.

---

## Fleet load model

The operator runs ~25 products. Time allocation:

```
   3–4 products  ◀ daily-driver, hand-tended
  ~6   products  ◀ tooling stack (the integrated six above)
   13–14         ◀ automated, weekly check-in only
   ─────────────
   ~22–24 total
```

The automated tier is only viable if the tooling stack is reliable. The tooling stack is only viable if the spine (this product) absorbs their output and renders it as a dashboard. SaaS Maker is therefore **upstream of the operator's ability to run more than ~4 products at all**.

If SaaS Maker is down, the automated tier becomes the hand-tended tier — which the operator can't sustain. This makes SaaS Maker's reliability the single most load-bearing piece of infrastructure in the portfolio.

---

## Phases

### Phase 0 — SaaS Maker is reliable enough to be load-bearing (state: unstarted)

The spine must clear an operational bar before more clients depend on it. See "Known optimisms" #3.

- Documented RPO / RTO targets.
- Automated D1 export to R2 on at least a daily cron.
- `docs/runbooks/disaster-recovery.md` with concrete restore steps.
- One DR drill per quarter, results logged.

**Phase 0 success criterion:** SaaS Maker can be fully restored from R2 within RTO, validated by a real drill, before Phase 2 onboards the second tooling client.

### Phase 1 — Contract foundation (state: largely shipped)

- ✅ Bearer auth via `sm_*` tokens (`/v1/cli/*` flow live).
- ✅ Projects API stable (`GET/POST/PATCH /v1/projects`).
- ✅ Tasks API stable (`GET/POST/PATCH/DELETE /v1/tasks`, plus `/v1/tasks/:id/comments`).
- ✅ Changelog API live (`POST /v1/changelog/dashboard/:projectId`, `/v1/changelog/fleet/daily`).
- ✅ Marketing posts API live (`/v1/marketing/posts`).
- ⚠️ CORS allowlist enforced (`*.sassmaker.com`, `localhost`, `*.workers.dev`).
- ❌ `git_url` field on `ProjectRecord` — needed so CodeVetter's repo→project auto-detect doesn't fall back to a manual mapping table. Queued PR.

### Phase 2 — All six tooling clients live and reliable (state: 1 of 6)

| Product | Integration state |
|---|---|
| CodeVetter | ✅ Live — sign-in, projects pull, tasks push, PATCH status, changelog push, current user, repo↔project mapping (manual fallback today). Live smoke against `api.sassmaker.com` verified. |
| reel-pipeline | ⚠️ Code exists, but `.env.example` points at single-s `saasmaker.com`. Likely silently broken in production. 1-line fix. |
| taste | ❌ Not started |
| psi-swarm | ❌ Not started |
| high-signal | ❌ Not started |
| MentionPilot | ❌ Doesn't exist as a separate product yet |

**Phase 2 success criterion:** all six products push to SaaS Maker on real events, the cockpit surfaces a unified view across all six per project, and no individual product depends on any other product.

### Phase 3 — Automated tier onboarded (state: 0 of ~14)

Each of the ~13–14 automated products implements the minimum integration:
- Bearer auth as a client.
- Health beacon (idle ping to indicate the product is up).
- Tasks read (so the operator can route attention through the cockpit).
- Optional: changelog push on auto-release.

**Phase 3 success criterion:** the operator's weekly check-in for the 13–14 products fits in a single hour spent in the cockpit.

### Phase 4 — Cockpit becomes the daily-driver UI (state: partial)

The cockpit today has working surfaces for tasks, projects, changelog, marketing posts. To be the daily-driver, it needs to be the place where:
- Cross-product weekly digest renders without the operator opening anything else.
- Each tooling client's signals are surfaced inline (CodeVetter's BLOCK verdicts, psi-swarm's regressions, taste's win-rate moves, etc).
- Billing aggregates across providers (Anthropic, OpenAI, Vercel, Cloudflare).
- Alerts route to one notification channel (Slack/Discord webhook).

**Phase 4 success criterion:** the operator opens the cockpit first thing in the morning, and everything they need to act on is one click deep.

---

## Non-goals

These are deliberately not part of SaaS Maker's scope. Each has a clean rationale.

- **Multi-tenant SaaS for other operators.** This is a one-person factory by design. Multi-tenancy would force compromises (org permissions, cross-org isolation, billing-per-customer) that don't pay off for a portfolio of products with one operator.
- **Enterprise compliance (SOC 2, HIPAA, SCIM).** Same reason. The operator is the only user. SSO already exists via better-auth's Google OAuth, which is sufficient.
- **A marketplace of fleet products for others to install.** Each product is bespoke to the operator's portfolio. There is no plug-in economy.
- **Mesh connectivity between products.** Hub-and-spoke is the constraint. Products do not call each other.
- **Real-time everything.** Webhooks are not a hard requirement. Pull-on-cadence (cron, on-demand) is sufficient for the lifecycle gates the tooling products cover.
- **Replacing each tooling product's UI.** Each product can keep its own dev surface for the operator to use during deep work. The cockpit is for cross-product oversight, not deep-domain UI.

---

## Known optimisms (gaps acknowledged in this PRD)

The factory thesis above holds only if these gaps get closed. Listing them here so they can't quietly become assumptions.

### 1. The "13–14 fully automated" tier assumes more product stability than real products have

Even with the six tooling clients running, products fail in ways those gates don't catch: payment processor changes, vendor pricing shifts, domain registration lapses, certificate expiry, OAuth provider deprecations, security disclosures, dependency vulns. Weekly check-in is sustainable only if these failures surface automatically.

**Implication:** there is an unbuilt **7th tooling client** — call it `sentinel` — that watches uptime, error rates, certificate expiry, dependency vulns, and a few canary requests per product. Without it, the "weekly check-in" tier silently degrades into the "daily firefighting" tier.

**Status:** unstarted. Should ship before the automated tier exceeds ~5 products.

### 2. Workflow orchestration above the API layer is unaddressed

Products don't call each other. But workflows imply coupling: "CodeVetter ships a release → reel-pipeline renders an announcement → taste arena-tests the new landing-page copy" is a triangular workflow where no product calls another but the *operator* expects them to fire in sequence.

The PRD doesn't say where this orchestration logic lives. Options:

- Inside SaaS Maker as a `workflows` table + cron Worker (probably the right answer).
- A separate orchestrator product (a 7th-or-8th tooling client whose only job is wiring).
- Hand-rolled scripts per workflow (does not scale past ~3 workflows).

**Implication:** by the time 3 cross-product workflows are wired, the choice is locked in by inertia. **Decide before workflow #2 ships.**

### 3. SaaS Maker's own operational rigor lags its load-bearing status

This PRD says SaaS Maker is "the single most load-bearing piece of infrastructure in the portfolio." Today there is no documented RPO / RTO, no D1 backup-and-restore playbook, no multi-region story, no DR drill cadence. If D1 eats itself, the cockpit disappears and every integrated product loses its dashboard simultaneously.

**Implication:** there should be a **Phase 0** in the roadmap — "SaaS Maker is reliable enough to be load-bearing" — that ships *before* Phase 2 onboards the second tooling client. Specifically:

- Document RPO / RTO targets.
- Automated D1 export to R2 on a cron (at least daily).
- A `docs/runbooks/disaster-recovery.md` with the exact steps to restore from R2.
- One DR drill per quarter.

**Status:** unstarted.

### 4. There is no sunset / kill-switch model

The portfolio strategy lives or dies on shutting down weak products faster than starting new ones. The current tooling stack is entirely "make products work better." Nothing in it answers "is this product worth keeping?"

- `high-signal` could feed this ("nobody needs this anymore") but isn't framed that way.
- `MentionPilot` could feed this ("AI assistants stopped mentioning it") but isn't framed that way.
- `psi-swarm` regression alerts could feed this ("the product is now too slow to fix") but isn't framed that way.

**Implication:** add an explicit **Sunset** lifecycle event with concrete criteria — e.g. "zero `high-signal` demand + zero `MentionPilot` mentions + zero CodeVetter activity for 90 days → propose-for-sunset surfaces in the cockpit." Without this, the portfolio accretes dead products and the load model breaks.

**Status:** undecided. See Open decisions #6.

### 5. Customer ops is an unacknowledged 7th lifecycle gate

The PRD lists six lifecycle gates (discover / validate idea / build / validate speed / distribute / measure awareness). It silently elides a 7th: **respond to users**. The feedback API exists; triage is hand-time.

For a 25-product portfolio, support inbound is the silent killer. Either:

- Triage gets a tooling client (LLM that drafts replies, tags severity, routes to project queues), or
- The PRD explicitly caps user-facing surface area such that support volume stays sub-linear, or
- The operator accepts that customer ops is hand-tended and counts it against the daily-driver bucket.

**Implication:** pick one. Silence here means support inbound quietly eats the 13–14 automated tier's "30 minutes per week" budget.

**Status:** undecided. See Open decisions #7.

---

## Operating constraints (for future PRD revisions)

When adding new SaaS Maker capability, these constraints govern:

1. **Bearer `sm_*` + better-auth session are the only auth modalities.** No new auth contract without a strong reason.
2. **`/v1/*` is the contract surface.** Resource shapes are JSON. Backward-compat on response shapes is mandatory — fleet products lag in updating their clients.
3. **Cross-product features always go through SaaS Maker.** If a new feature requires data that lives in a product, the path is: product pushes to SaaS Maker → SaaS Maker stores → other consumer reads from SaaS Maker. Never product-to-product.
4. **Cockpit is the only UI for SaaS Maker's own surfaces.** No second UI app. If something needs a different UI, it's a new product, not a new SaaS Maker surface.
5. **The user is one person.** Don't add organization concepts, role hierarchies, or per-seat anything.

---

## Open decisions

These need to be resolved within the next 1–2 product cycles.

| # | Decision | Why it matters | Deadline anchor |
|---|---|---|---|
| 1 | Does **MentionPilot** ship as a separate product or stay as a feature in `high-signal`? | Affects whether it gets its own `sm_*` integration, project slug, dashboard surface. Pre-decides whether the integrated tooling count is 5 or 6. | Before product #7 joins the spine. |
| 2 | Should `taste` be renamed (the directory says `taste`, the README + package.json say `ShipRank`)? | Public-facing name confusion. Affects cockpit labels and marketing. | Before any external user sees a cockpit reference to this product. |
| 3 | What's the canonical billing API to aggregate from? | Affects whether the cockpit can show fleet-wide LLM + infra spend. Anthropic + OpenAI admin APIs are unstable; Vercel + Cloudflare have their own shapes. | Before the cockpit promises a "fleet $$" widget. |
| 4 | How do products report health to the cockpit? | Affects whether the operator can tell at a glance which of the 13–14 automated products are alive. Options: a beacon endpoint each product pings, a queryable status table in SaaS Maker, or an external uptime service feeding in. | Before Phase 3 starts in earnest. |
| 5 | Where does cross-product workflow orchestration live? | Workflows like "CodeVetter release → reel-pipeline announce → taste arena" need a home that respects hub-and-spoke. Inside SaaS Maker (cron Worker on a `workflows` table) is the leading option. | Before the second cross-product workflow ships. |
| 6 | What are the sunset criteria for a portfolio product? | Without an explicit kill-switch model, the portfolio accretes dead products and the operator's load model breaks. Need concrete signals (likely combining `high-signal`, `MentionPilot`, CodeVetter activity). | Before the portfolio crosses 30 products. |
| 7 | How is customer ops handled — tooling client, surface cap, or hand-tended? | Support inbound is the silent killer for a 25-product portfolio. Either build a triage tooling client, cap user-facing surface, or budget for it in the daily-driver tier. | Before any single product reaches > 100 active users. |

---

## Success criteria (long-term, 12-month)

In priority order:

1. **The operator's daily workflow happens in the cockpit.** Mornings start in `app.sassmaker.com`, not in 25 separate product dashboards.
2. **Adding the 26th product is one integration.** Specifically: bearer auth + project row + opt-in to the tooling clients that matter for it. < 1 day of work.
3. **The 13–14 automated products each receive < 30 minutes of operator time per week** outside of incident response.
4. **The 3–4 daily-driver products receive deep focus**, unconstrained by maintenance load from the other 22.
5. **Any tooling product can be replaced** with a different implementation as long as the `/v1/*` contract holds. The spine outlives any individual product.
6. **A weekly fleet markdown digest** is auto-generated and pushed as a SaaS Maker changelog entry on a "fleet" meta-project. Operator reads one document, not 25.

If we hit these, the factory exists. If we don't, we have 25 products and one tired operator.

---

## Appendix A — Glossary

- **Fleet** — the operator's full portfolio of products.
- **Spine** — SaaS Maker (this product).
- **Tooling client** — one of the six integrated products (CodeVetter, reel-pipeline, taste, psi-swarm, high-signal, MentionPilot) that push purpose-built signals.
- **Lifecycle gate** — a recurring question (does it work, do people want it, is it fast, is it talked about) that every product needs answered, repeatedly.
- **Hub-and-spoke** — the topology where N products each integrate only with the hub (SaaS Maker), never directly with each other.
- **Cockpit** — the SaaS Maker Next.js UI at `app.sassmaker.com`.

---

## Appendix B — What this PRD is not

- Not a feature backlog. Per-feature PRDs live in `docs/plans/` with dates.
- Not a technical architecture doc. See the API definitions in `docs/openapi/openapi.json` and the Worker source in `workers/api/`.
- Not a marketing pitch. Note the deliberate absence of language around "the future of SaaS" or "the AI-native developer platform." This is plumbing. The factory framing is private operator language, not customer-facing positioning.
