# Build Spec: Fleet Events Hub (system-of-record)

**Date:** 2026-06-19
**Status:** Spec / ready to build
**Companion to:** [2026-06-19-fleet-hub-and-spoke-eval.md](./2026-06-19-fleet-hub-and-spoke-eval.md) — read that for *why*. This is the *how*.

**Scope:** this spec is the **return path** — the append-only sink where results, fire-and-forget callbacks, and telemetry land, and which Cockpit reads. It is **one half** of the hub. The **outbound** half — saas-maker *calling* drank/psi-swarm/taste, *dispatching* to reel-pipeline, *pulling* high-signal — follows the typed interaction styles in the eval doc's §3 and is sketched in §8 below. The events sink is **not** how the hub invokes a capability; it's where capability *results* come to rest.

The discipline still holds: saas-maker is the append-only **system-of-record**; spokes **read down** the registry; **no spoke reads another spoke**; single-writer per store; spokes that report up do so via a local **outbox** so they never block on the hub.

## 1. The write surface — `POST /v1/events`

### 1a. D1 table (new migration, next number in `workers/api/migrations/`)

```sql
CREATE TABLE fleet_events (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id),
  product         TEXT NOT NULL,                 -- slug, denormalized for fast filter
  type            TEXT NOT NULL,                 -- e.g. 'reel.rendered', 'audit.completed'
  payload         TEXT NOT NULL,                 -- opaque JSON envelope
  schema_version  INTEGER NOT NULL DEFAULT 1,
  occurred_at     TEXT NOT NULL,                 -- client event time
  received_at     TEXT NOT NULL DEFAULT (datetime('now')),
  idempotency_key TEXT NOT NULL,
  UNIQUE(project_id, idempotency_key)            -- makes outbox retries safe
);
CREATE INDEX idx_fleet_events_product_type ON fleet_events(product, type, received_at);
```

Mirror this in `workers/api/src/schema.ts` (same style as the `projects` table; `UNIQUE(project_id, idempotency_key)` mirrors the existing `UNIQUE(owner_id, slug)` on `fleet_metadata`).

### 1b. Route — `workers/api/src/routes/events.ts`

Mirror `routes/marketing.ts` (sub-app) and `routes/fleet-metadata.ts` (registration). Auth via the existing `requireApiKey` middleware — `X-Project-Key` header, read `c.get('projectId')`.

```typescript
const events = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// WRITE — project-scoped, append-only, idempotent. Accepts one or a batch.
events.post('/', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const body = await c.req.json();
  const items = Array.isArray(body) ? body : [body];
  // validate envelope: { type, payload, idempotency_key, occurred_at }
  // INSERT ... ON CONFLICT(project_id, idempotency_key) DO NOTHING   ← retry-safe
  return c.json({ accepted, deduped });
});

// READ — for Cockpit/analytics only. Session/admin auth, never a spoke.
events.get('/', requireSession, async (c) => {
  // filters: ?product= &type= &since= &limit=  (use idx_fleet_events_product_type)
});
```

Register in `workers/api/src/index.ts` (~line 152, beside the other `app.route(...)` calls):

```typescript
app.route('/v1/events', events);
```

**Why this is enough on the server:** the idempotent `ON CONFLICT DO NOTHING` insert means a spoke can retry the same event forever with no duplicates — so the API stays a dumb, durable sink and **all retry/buffering lives at the edge** (the outbox). No Queues/Cron/DO needed on the API for Phase 0 (none exist today, per wrangler.toml).

## 2. The outbox — what buys async / no-SPOF

Add an `events` service to the SDK (`packages/blocks/sdk/src/`; there is no separate analytics-sdk — this is new). Public API:

```typescript
client.events.emit({ type, payload, idempotencyKey?, occurredAt? })
// generates idempotencyKey (uuid) + occurredAt if omitted,
// appends to a local buffer, flushes with retry+backoff, never blocks the caller
```

The **buffer backing differs by host** — same SDK surface, different durability substrate:

| Spoke | Outbox backing | Flush trigger |
| :--- | :--- | :--- |
| high-signal, taste, reel-pipeline (CF Workers) | row in their **own D1** `outbox` table | `ctx.waitUntil(flush())` after request; drain on next request |
| drank (Vercel / browser) | **no per-user upload.** The existing GitHub Action that publishes the global DR snapshot also POSTs that snapshot | on each scheduled refresh |
| CodeVetter (desktop, local SQLite) | local `outbox` table | flush opportunistically when online (emits review telemetry) |
| psi-swarm (CLI, local SQLite) | local `outbox` table | POST after a run; drain stale rows on next invocation |

Local-first is preserved everywhere: the product writes its own store, returns to the user, and the outbox flushes upward best-effort. If saas-maker is down, nothing blocks; rows drain later.

## 3. The read-down surface (already exists)

Spokes that need central truth read it through the existing read-only contracts — **no new work, no raw-table access**:

- `GET /v1/fleet/metadata` — project registry
- `GET /v1/standards/:type` — shared config/standards
- `GET /v1/secrets` — scoped secrets

Consume via the SDK (`SaaSMakerClient`). These are the "other services can read this project's data" half — keep them read-only.

## 4. Cockpit — make the data visible

A "Fleet Activity" view in `apps/cockpit` reads `GET /v1/events` and renders a cross-product timeline + per-product rollups. This is what realizes the central-data/analytics goal the user actually asked for — the moment one screen shows every product's events, the hub exists.

## 5. Per-service onboarding (maps to the eval's verdict table)

1. **reel-pipeline** — on render complete, `events.emit({ type: 'reel.rendered', payload })`. Already pushes up via marketing-queue PATCH; this adds it to the system-of-record. *(Phase 1 proof.)*
2. **high-signal** — emit `signal.published` / `brief.composed`. Already a `@saas-maker/*` consumer, so the SDK is in place. *(Phase 1 proof.)*
3. **taste** — emit `study.completed` / `arena.vote` from Pages Functions.
4. **psi-swarm** — emit `audit.completed` with p75/p99 after a run.
5. **CodeVetter** — emit `review.completed` telemetry (it already has Roadmap/telemetry).
6. **drank** — GitHub Action emits `dr.snapshot`; replaces the drank→high-signal GitHub-JSON hop later.

## 6. Phasing

- **Phase 0:** migration + `routes/events.ts` + SDK `events.emit` + Cockpit Fleet Activity skeleton.
- **Phase 1:** wire reel-pipeline + high-signal (the two live flows) → prove end-to-end.
- **Phase 2:** onboard taste, psi-swarm, CodeVetter.
- **Phase 3:** drank snapshot up; collapse the GitHub-JSON hop.
- **Later (only if needed):** add CF Queues to the API for server-side buffering of any *pull-ETL* (saas-maker calling a spoke's API on a schedule); shared SSO/billing.

## 7. Open code-level decisions

- **idempotency_key source** — client-supplied uuid (simple, chosen) vs semantic hash of payload. Start with client uuid.
- **payload validation** — keep the envelope strict (`type`, `idempotency_key`, `occurred_at`) and the `payload` opaque JSON, so the table schema never couples to product internals.
- **retention** — events are append-only; add a rollup/prune job once volume warrants (D1 is fine at fleet scale for now).
- **batch size cap** on `POST /v1/events` to bound a single request.

## 8. The outbound half — saas-maker calls/dispatches/pulls

The sink above is where results land; this is how the hub *invokes* capabilities. saas-maker needs a small **capability layer**: a registry of each spoke's endpoint + a typed client per interaction style. By style (from the eval §3 table):

- **Publish-up only — drank, psi-swarm (local-only tools).** These run standalone and **push their learning up**; saas-maker never reads or calls them. No outbound capability layer, no hosted endpoint, no reachability problem — they reuse the events sink in §1. psi-swarm emits `audit.completed` after each local run (Node CLI holds an `sm_` token, local SQLite outbox for retry); drank's existing GitHub Action also POSTs `dr.snapshot` (per-user browser data stays local; only the aggregate goes up).
- **Fire-and-forget — reel-pipeline.** Already built: saas-maker enqueues in the marketing queue, reel-pipeline pulls + renders + PATCHes the result back. Fold that result into `/v1/events` so it also lands in the system-of-record.
- **Job + result — taste, CodeVetter.** saas-maker creates a job, the spoke runs it, the result returns. taste is hub-callable (create study → poll/callback for verdict). **CodeVetter is a desktop runner that reuses the existing Symphony `tasks` API — no new jobs table.** It mirrors the *Symphony CLI* runner loop (not Droid, which is push-based):
  1. Auth once via CLI device flow (`POST /v1/cli-auth/code` → approve → poll for an `sm_*` token); use `Authorization: Bearer sm_*` thereafter.
  2. `GET /v1/tasks?status=todo` to read work.
  3. Claim, run build/review/test locally.
  4. Report via `POST /v1/tasks/:id/comments` (`author_type:'agent'`, body = findings) + `PATCH /v1/tasks/:id` status → `done` (same as the CLI's `claim`/`done`). Optionally also `events.emit('review.completed', …)` so the outcome lands in the system-of-record.

  **Two server deltas this requires** (both small, both real):
  - **Atomic claim** — the task queue has no lock today (PATCH is unconditional). Harmless with one runner; with CodeVetter as a *second* concurrent runner, two can grab the same `todo`. Fix: conditional `UPDATE tasks SET status='in_progress' WHERE id=? AND status='todo'`, check rows-affected.
  - **Runner routing** — `task_type` is `feature|bug|chore|docs|research|cleanup|other` (no review/build/test), there's no `assignee`/`runner` field, and `GET /v1/tasks` has no `?type=` filter. Add a runner-facing type (e.g. `review`) or a `runner` tag + filter so CodeVetter selects only its tasks.

  **Separation of surfaces:** the *task* is the workflow state (read/do/update); an *event* is the analytics result (optional emit). Same action, two records, each with its own job.
- **Task producer — pinpoint.** Local-only (CLI / daemon / Vite plugin / browser extension); already posts UI-feedback comments as tasks (`POST /v1/tasks`, Bearer `sm_`/session token). The hub never reads it. It *seeds* the same board CodeVetter *drains* — producer → hub task board → consumer, neither talking to the other. Two notes: (1) to be fully hub-centric, consumers should read from `/v1/tasks`, not pinpoint's local `.pinpoint/inbox.jsonl`; (2) pinpoint emits `task_type:'chore'` today, so it needs the runner/type tag (above) to route to the right consumer. Whoever runs the task updates its status — the hub never pulls pinpoint's local `history.jsonl`.
- **Pull / ingest — high-signal.** A scheduled job calls high-signal's API (`/brief/daily`, `/api/mentions`, AI-awareness checks) and writes the results into the system-of-record. The API worker has **no Cron Triggers today** — run the scheduler as a GitHub Action cron, or add `[triggers] crons` to `workers/api/wrangler.toml`.

So the full hub is **three surfaces**: this events sink (results in), a capability/jobs layer (work out), and the existing read-down registry (config down). Phase 0–1 only needs the sink + the two already-live flows; the capability layer grows one spoke at a time.

## 9. Worker protocol & queue primitive (the core pattern)

The fleet runs as a **polling work-queue on the existing Symphony `tasks` table**: every spoke is a worker that, on wake (local run / background daemon / cron), claims pending tasks it can handle, executes, and writes results back. The DB is the only coordinator. This is the single most-reused mechanism — build it once, well.

**Schema deltas to `tasks`** (one migration; generalizes the CodeVetter notes in §8):
- `runner` / `capability` tag (e.g. `review`, `audit`, `judge`, `ideas`) + a `?runner=`/`?capability=` filter on `GET /v1/tasks` — so a worker claims only its kind.
- `claimed_by TEXT`, `lease_until TEXT` — claim ownership + visibility timeout.
- status lifecycle: `pending → claimed → done | failed` (today's `todo/in_progress/done` maps; add `failed`).
- a result home: reuse `task_comments` (`author_type:'agent'`) + final status, or add a `result` column.

**Atomic claim** (the correctness core — concurrent wakes race):
```sql
UPDATE tasks SET status='claimed', claimed_by=?, lease_until=datetime('now','+15 minutes')
WHERE id=? AND (status='pending' OR (status='claimed' AND lease_until < datetime('now')))
RETURNING *;
```
Zero rows back = someone else won; the worker moves on. The `lease_until < now` clause **reclaims tasks abandoned by a worker that died mid-run** — without it the queue silently leaks work. A claim endpoint like `POST /v1/tasks/claim?capability=review` runs this and returns the claimed task (or 204).

**Worker SDK / wake protocol** — the ~50-line client every spoke embeds (the only bespoke part is `handler`):
```
loop on wake:
  task = POST /v1/tasks/claim?capability=<mine>     # atomic claim
  if !task: break
  try { result = await handler(task); report(task, 'done', result) }
  catch (e) { report(task, 'failed', e) }            # PATCH status + comment
  # long handlers periodically extend the lease (heartbeat)
```
Handlers must be **idempotent** — a task can run twice across a lease expiry.

**Implemented (2026-06-19):** migration `0020_task_queue.sql` + `POST /v1/tasks/{claim,:id/complete,:id/fail,:id/heartbeat}` + `capability` on create. The wake-loop is `client.worker.drain({ worker, capability, handler })` in `@saas-maker/sdk` — and it's **graceful by design**: a missing token or unreachable hub ends the drain quietly (`hubUnavailable: true`), never throwing, so a service runs standalone and auto-drains the moment it can reach the hub (the "open services → they just work / unplug hub → still work alone" tenet). Atomic claim is a single race-safe UPDATE that also reclaims expired leases, so no reaper cron is required for correctness (a reaper is optional, only for dead-letter sweeps/metrics).

**Recurring work** — a cron (GitHub Action or CF Cron Trigger; the API has none today) enqueues periodic tasks (`capability:'ideas'` daily), so when high-signal wakes it finds work waiting. Producers like pinpoint enqueue on user action.

This section, not the events sink, is the heart of the architecture: **events = unsolicited telemetry pushed; tasks = assigned work pulled.** Most spokes are workers; drank-style pure telemetry stays on the events sink (§1).

### 9a. Cloudflare building blocks (on the $5 Workers Paid plan)

Limits verified 2026-06-19 for **Workers Paid ($5/mo)** — the plan in use:
- **D1** (25B row-reads/mo, 50M writes/mo, 5GB) — the queue + system-of-record. Effectively unlimited at fleet scale (~9,600 reads/sec sustained) → **poll as often as you want; ignore read budget.**
- **Workers** (10M req/mo, **CPU 30s default / up to 5min configurable**) — hosts the claim/report API + always-on workers. The free-tier 10ms cap is gone, so hosted Workers can do real compute, not just DB ops.
- **Cron Triggers** (250/account on Paid — account-level, not per-Worker; free is 5) — three jobs: (1) enqueue recurring tasks, (2) **lease-reaper** requeuing expired-`lease_until` tasks (makes intermittent workers reliable — a slept-laptop's claim returns to the pool), (3) always-on poller (a cron-triggered Worker is an always-on drainer). Realistic need is ~5–15 against the 250 ceiling.

"Pick up tasks as soon as they start" = startup-poll: a worker calls `claim` on boot and loops until empty — no special primitive, just the API + D1.

**Strategic consequence of Paid:** any spoke whose job fits ≤5min CPU with no special runtime can become an *always-on cron-polled Worker* (taste agent-eval, high-signal, orchestration, the reaper) — shrinking the intermittent set to only those needing a local/desktop runtime: psi-swarm (headless Chrome → Browser Rendering to host), CodeVetter (desktop), pinpoint (local dev). Workers still have no persistent FS + a wall-clock/subrequest ceiling, so Lighthouse/repo-builds stay local or use Containers/Browser Rendering. Still **not** Queues (consumers are push-targets; offline workers can't be pushed to). DO+Alarms (SQLite or KV-backed on Paid) only for sub-minute reactivity; Workflows for the v2 orchestration DAG.
