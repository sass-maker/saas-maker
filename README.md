# SaaS Maker Foundry

[sassmaker.com](https://sassmaker.com) is the public directory for the product fleet. This repository is also the private Foundry control plane: one monorepo organized around Build, Market, Learn, Visibility, and Control.

The repository is public; production credentials, machine roles, leases, receipts, and private operational state are not. A fresh clone is intentionally inert.

## Surfaces

| Surface | Source | Canonical URL | State |
| --- | --- | --- | --- |
| Public directory | `apps/showcase` | `https://sassmaker.com` | Existing deployment; local catalog-backed build verified |
| Private cockpit | `apps/cockpit` | `https://fleet.sassmaker.com` target | Existing manual host; monorepo parity and cutover not yet verified |
| Current cockpit | `apps/cockpit` | `https://app.sassmaker.com` | Existing Worker domain |
| Package docs | `apps/docs-blume` + public `docs/` subset | `https://packages.sassmaker.com` | Local Blume build verified; production not verified |
| Skills catalog | `apps/skills` + `skills/` | `https://skills.sassmaker.com` | Local static build verified; production not verified |
| API | `workers/api` | `https://api.sassmaker.com` | Existing Worker domain |
| Droid | `workers/droid` | Worker-only | Experimental |

Production releases are explicit manual decisions. Pushes and pull requests build and test; they do not automatically deploy.

## Single source of truth

[`catalog/foundry.json`](catalog/foundry.json) is the only hand-edited catalog for products, components, domains, repositories, packages, skills, automations, ownership, lifecycle, observability contracts, and the five pillars.

These are generated compatibility views and must not be edited by hand:

- `catalog/generated/*`
- `foundry.projects.json`
- `ops/config/projects.json`
- `ops/config/automation-registry.json`

Run `pnpm catalog:check` to regenerate every view and fail on drift. The public projection includes only maintained products; ignored, frozen, retired, and removed records remain attributable internally without appearing in the directory.

## Repository map

```text
apps/cockpit/               private Next.js control surface
apps/showcase/              public Astro directory
apps/docs-blume/            public package documentation
apps/skills/                public indexed skill catalog
catalog/                    canonical catalog + generated projections
workers/                    API and Droid Workers
packages/                   local and publishable packages + @foundry/ui
packages/app-health-go/     dependency-free Go endpoint instrumentation
internal/contracts/         provider-neutral application contracts
ops/                        Fleet operations, schedules, host foundation
skills/                     versioned agent skills
services/drank/             imported Drank history
services/reel-pipeline/     imported Reel Pipeline history
tools/psi-swarm/            imported PSI Swarm history
```

The provenance and rollback boundary for imported histories is recorded in [`docs/operations/foundry-migration-ledger.md`](docs/operations/foundry-migration-ledger.md).

## Local verification

```bash
pnpm install
pnpm components:install
pnpm catalog:validate
pnpm catalog:check
node --test tests/foundry-catalog.test.mjs tests/foundry-observability.test.mjs ops/test/host-foundation.test.mjs
pnpm build:showcase
pnpm build:docs
pnpm build:skills
pnpm build:cockpit
pnpm components:check
pnpm test
```

Useful focused commands:

```bash
pnpm observability:inventory  # sanitized source/evidence snapshot
pnpm host:doctor              # inert without a machine-local role file
pnpm host:test                # lease, receipt, path, and no-execution safety
pnpm check:openapi            # API and CLI contract drift
pnpm check:docs               # Markdown links and required docs
```

Some production checks require external credentials. Never commit environment files, role files, lease files, receipts, or secret values.

## Observability model

Foundry does not require one analytics vendor. PostHog, Cloudflare Workers Observability, Sentry, OpenTelemetry, Foundry Events, and local operational logs can coexist when they have explicit ownership and privacy boundaries.

The private Cockpit distinguishes:

- `source-configured`: an adapter exists in source;
- `fresh-verified`: a successful timestamped receipt proves recent delivery;
- `stale`: the newest valid receipt exceeded its freshness target;
- `unknown`: source or trustworthy evidence was unavailable;
- `not-applicable`: an explicit exception with a reason.

That distinction prevents a configured SDK or Cloudflare toggle from being misreported as complete analytics coverage.

App Health is the focused application view of that evidence: add the key-only
Node.js or Go middleware, then inspect normalized endpoint traffic, latency,
error rate, and last-seen time at `/fleet/app-health`. Installation starts at
[`docs/sdk/app-health.md`](docs/sdk/app-health.md); no raw URL, query value, or
request body is part of the span contract.

## Design and operating rules

- The shared UI foundation is `@foundry/ui`, built on local shadcn/Radix-compatible primitives and Tailwind tokens.
- Public package docs use Blume only. Internal architecture and operations docs remain committed but excluded from that build.
- The other operations machine may become the sole active scheduler only after a machine-local role, healthy central lease, explicit promotion, and parity checks. Clones remain inert.
- No DNS, deploy, migration, credential, deletion, rate-limit, or external-publish action is implicit in source changes.

See [AGENTS.md](AGENTS.md), [PROJECT_STATUS.md](PROJECT_STATUS.md), and [docs/README.md](docs/README.md) for detailed constraints and status.

## License

MIT. See [LICENSE](LICENSE).
