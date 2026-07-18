# PostHog fleet dashboards — `project_id` filter guide

Fleet apps share one PostHog project. Every insight that breaks down traffic by app must use the **canonical** property `project_id`. Older events may still carry legacy keys (`project_slug`, `project`, `foundry_project_id`); queries must coalesce them until historical data ages out.

## Canonical filter (HogQL / insights)

Use this expression everywhere a dashboard filters or groups by app:

```sql
coalesce(properties.project_id, properties.project_slug, properties.project, properties.foundry_project_id) AS project_id
```

Canonical HogQL coalesce (also in `scripts/fleet-posthog-verify.mjs` as `PROJECT_ID_COALESCE`):

```sql
coalesce(properties.project_id, properties.project_slug, properties.project, properties.foundry_project_id)
```

API routes normalize ingest via `workers/api/src/lib/telemetry.ts` (`withCanonicalProjectId`). Cockpit fleet feeds and `pnpm fleet:posthog-verify` use the same expression.

## Events that must be filterable by `project_id`

| Group | Events | Emitted by |
| --- | --- | --- |
| Product taxonomy | `signup`, `activated`, `core_action`, `returned` | Fleet `analytics.ts` / `analytics-events.ts` wrappers (`project_id: "<slug>"` on every emit) |
| Foundry monitoring | `foundry_error`, `foundry_trace`, `foundry_page_crash`, `foundry_auth_failure`, `foundry_signup_failure` | Fleet `foundry-monitoring.ts`, API `workers/api/src/lib/telemetry.ts`, cockpit server queries |
| SaaS Maker API (cockpit) | `feedback_*`, `waitlist_signup`, `task_*`, `project_*`, … | `workers/api` routes via `capture()` + `withCanonicalProjectId` |

## Stale dashboard fields — update checklist

Replace any insight breakdown or filter that references only:

- `project_slug`
- `project`
- `foundry_project_id`

with the coalesce expression above. **Do not** add new charts on legacy property names.

Suggested PostHog UI steps (manual, one-time):

1. Open each fleet funnel / retention / error insight.
2. Edit breakdown or filter → custom HogQL property → paste the coalesce `AS project_id`.
3. Re-save; confirm multiple apps appear when expected (e.g. `reader`, `linkchat`, `CodeVetter`).
4. Archive duplicate insights that only differ by legacy property name.

## Verification commands

```bash
# Source: fleet repos emit project_id (no legacy keys in analytics modules)
pnpm fleet:monitoring-audit -- --fail-on-missing

# Live: PostHog API coverage for taxonomy + foundry_* (requires credentials)
# Set POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID in apps/cockpit/.env.local
pnpm fleet:posthog-verify
pnpm fleet:posthog-verify -- --json --fail-on-gap --days 30
```

`fleet:posthog-verify` reports per-event counts, canonical vs coalesced coverage, and distinct project count over the window. Exit code 1 with `--fail-on-gap` when any event with traffic lacks coalesced `project_id`.

## Credentials

Personal API key + numeric project ID: `apps/cockpit/.env.local` (see `.env.local.example`). Without them, source audits still pass; live dashboard verification is blocked until keys are filled in.

## Remaining risk

- Historical events before the migration may lack any project key; coalesce cannot invent a slug.
- `foundry_trace` volume depends on apps wiring `trace()` to PostHog (not all paths ship traces yet).
- Events with zero traffic in the verification window show as `no_events` — not a filterability failure.
