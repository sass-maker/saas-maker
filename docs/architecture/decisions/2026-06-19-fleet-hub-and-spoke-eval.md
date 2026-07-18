# Evaluation: saas-maker as the Fleet Hub ("everything goes through saas-maker")

**Date:** 2026-06-19
**Status:** Recommendation
**Driver (confirmed):** Central data / analytics — saas-maker as the **system-of-record** for all products' events, results, and metrics.
**Note:** "codewitter" is read as **CodeVetter** (Tauri desktop code-review app; today metadata-linked only).

## TL;DR

**Qualified yes.** The instinct is good, but there are two very different ways to build it, and only one is right for a solo fleet:

- ❌ **Synchronous gateway / ESB** — spoke → saas-maker → spoke on the live request path. Single point of failure, a latency hop on every call, deploy coupling, and it *destroys* the local-first property of drank / psi-swarm / CodeVetter. Don't build this.
- ✅ **Asynchronous publish-up hub** — spokes **push** events/data/results *up* to saas-maker; saas-maker is the system-of-record and distribution layer; spokes never call each other. This honors the exact goal ("services won't communicate with each other") **and** matches your confirmed driver (central data). It's already how `reel-pipeline ⇄ marketing-queue` works.

So: keep the words, change the mechanism. Hub for **integration events and data**, not for **all runtime traffic**.

## 1. Reality check on the premise

The premise slightly overstates today's coupling. Across 6 services there are **three** real cross-service flows:

| Flow | Mechanism today | Type |
| :--- | :--- | :--- |
| reel-pipeline ⇄ saas-maker marketing queue | HTTP `GET/PATCH /v1/marketing/posts` + bearer token | async pull/patch |
| high-signal → reel-pipeline (reel briefs) | `POST /reels/signal` JSON | async push |
| drank → high-signal (DR leaderboard) | public GitHub JSON sync | async batch |

Everything else (psi-swarm and CodeVetter) is an **island**. The O(N²) point-to-point mess that justifies a runtime hub **does not exist yet** — so the value here is *not* "less integration upkeep." The value is the confirmed driver: **one place that knows everything** (events, results, metrics). That goal is real and worth building toward, incrementally.

Note also: high-signal already consumes `@saas-maker/*` npm packages (ai, ops, db, analytics-sdk, feedback). That is **build-time centralization** — the *good* kind of "going through saas-maker," with zero runtime coupling. It's the model to expand, not replace.

## 2. The recommended shape: publish-up event hub

Add one durable surface to the saas-maker API and have every product report into it.

```
spoke products ──(publish events/results, async)──▶  saas-maker
                                                       ├─ events table (system of record)
                                                       ├─ analytics-sdk (already exists)
                                                       └─ cockpit dashboards / digests
```

- **New:** `POST /v1/events` (or extend `analytics-sdk`) — a generic, append-only event/result sink. `{ product, type, payload, ts }`. This becomes the single fleet data lake.
- **Reuse:** `@saas-maker/analytics-sdk` already exists — likely 80% of the transport. Standardize the schema and point every product at it.
- **Keep:** marketing queue and signal-brief flows as-is; they're proof the broker pattern works. Optionally re-route the high-signal→reel-pipeline brief *through* a saas-maker queue later so it too lands in the system of record.
- **Never:** put a spoke's own internal traffic (a psi-swarm audit run, a CodeVetter review loop) on the saas-maker live path. They run locally; they **report results up** when done.

## 2.1. Who owns what (ownership boundary)

The central question isn't "shared DB or API" — it's **who owns which data and who may write it**. The rule:

- **saas-maker owns the *shared/central* data** — project registry, config/standards, and the cross-product system-of-record. Spokes **read this down** via a read-only contract (`/v1/fleet/metadata`, `/v1/standards`, `/v1/secrets` already do this). ✅ Good centralization.
- **Each spoke owns its *operational* data.** saas-maker does **not** reach into a spoke's raw tables.
- **Exchange via contracts, not raw tables.** When saas-maker needs a spoke's data it **pulls through that spoke's API** (for example, high-signal's brief API), not its DB. When a spoke contributes data it **pushes up**. Either direction is fine; the invariant is **single-writer per store, no shared raw tables**.

Why not let saas-maker pull/write every spoke's DB directly? Two reasons:

**Physics — most of the fleet has no centrally-reachable store:**

| Spoke | Store | saas-maker can pull/write it? |
| :--- | :--- | :--- |
| drank | localStorage (no server DB) | ❌ nothing to reach |
| psi-swarm | local SQLite `~/.psi-swarm` | ❌ on user's machine |
| CodeVetter | local SQLite (desktop Tauri) | ❌ on user's machine |
| reel-pipeline | no DB (state in saas-maker / local JSON) | ⚠️ nothing of its own |
| high-signal | CF D1 | ⚠️ only via binding/HTTP |

For **4 of 6**, "saas-maker writes data into the service" is impossible by design — so it can't be the foundation.

**Coupling — even where possible, raw cross-DB access couples the hub to every spoke's physical schema** (every spoke migration can break the hub) and creates **dual-writers** (spoke + saas-maker writing the same tables → races, no single owner of invariants). That's the integration-DB anti-pattern with the blast radius moved to the hub.

## 2.2. Sync vs async: the outbox is the real decision

"Everything through a shared store" quietly re-introduces synchronous coupling unless guarded. Two senses of "sync":

- **Sync state** (one consistent store, readers see writers) — fine.
- **Sync coupling** (A can't proceed unless the hub is up) — the SPOF property we want to avoid.

A naive shared DB gives the second one: a spoke writing *directly* to the central store now hard-depends on it at write time (kills local-first), and a shared DB *invites* spoke B to read spoke A's rows for live behavior (spoke-to-spoke coupling laundered through a table). 

The property that buys true async is a **local outbox**: the spoke appends to its own buffer and flushes up with retry, never blocking on the hub — works whether the destination is a DB or a thin API. For the central-data goal you only ever need **write-up + hub-reads**; no spoke reads another spoke. So treat the shared store as an implementation detail *behind* the write path, never as the surface spokes integrate against.

## 3. Per-service verdict: typed capabilities (the spine)

These are six *different products with different purposes*, so each gets a *different interaction style* — **not** a uniform "publish up." saas-maker is the **orchestrator**; each spoke is a typed capability.

| Service | Purpose | Style | Direction | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **drank** | domain-rating snapshots | **publish-up only** | spoke → hub (hub never reads it) | pushes via its existing GitHub Action |
| **psi-swarm** | perf-audit results (p50–p99) | **publish-up only** | spoke → hub (hub never reads it) | pushes after each local run |
| **reel-pipeline** | render + distribute reels | **fire-and-forget** | hub → spoke (result drifts back) | already wired (marketing queue) |
| **pinpoint** | UI feedback → tasks | **task producer (push-up)** | spoke → hub (hub never reads it) | local-only; already posts `/v1/tasks` |
| **CodeVetter** | build / review / test / audience validation | **task runner (consumer)** | spoke **pulls** tasks, pushes results | desktop; pulls, so no inbound reach needed |
| **high-signal** | ideas / mentions / does-AI-know-us | **pull / ingest** | hub ← spoke | hosted API; needs a scheduler |

**Task-board pairing.** pinpoint *produces* tasks (UI feedback → `/v1/tasks`) and CodeVetter *consumes* them (build/review/test → status update). They never talk to each other — the Symphony task board is their only meeting point, which is exactly the hub-as-system-of-record pattern. This makes the **runner-routing field load-bearing**: with both producers and consumers on one board, tasks need a type/runner tag so the right consumer picks up the right work (see spec §8).

**Unifying architecture: a polling task-queue where the DB is the coordinator.** The model generalizes — every spoke is a **worker** that, on wake (local run, background daemon, or schedule), claims the pending tasks it can handle, executes, and writes results back to saas-maker's DB. No spoke calls another; no hub reaches into a machine; workers *pull*. The per-style taxonomy above collapses into **two roles on one queue**: *producers* enqueue work (pinpoint, crons), *workers* drain it (CodeVetter, psi-swarm, high-signal). Some are both. The one surviving distinction: **queue = assigned work pulled; events sink = unsolicited telemetry pushed** (drank's DR snapshot is nobody's task → event).

DB-as-queue (D1 + tasks table) is the right choice for intermittent, heterogeneous, low-volume workers — *not* Redis/SQS/CF Queues. But three things become correctness-critical: **(1) atomic claim** (conditional `UPDATE … WHERE status='pending'`, check rows-affected — concurrent wakes race), **(2) lease / visibility timeout** (a worker dies mid-task → stuck `claimed` forever unless `lease_until` makes it reclaimable — the most-overlooked part), **(3) task typing/routing** so the right worker claims the right work. Plus idempotent handlers and recurring-task generation (crons enqueue). Highest-leverage build: a shared **worker SDK** (`claimNext(capabilities) → run → report`) embedded by every service; the only bespoke part per spoke is the handler. See spec §9.

**Alternatives considered (why DB-as-queue).** The deciding constraint is that workers are *intermittent and not inbound-reachable*, which forces *pull* and rules out every push design. A **broker** (CF Queues / SQS / Redis+BullMQ) gives lease/retry/DLQ free, but offline workers can't be push-consumers (they'd poll it anyway), so it only adds a second source of truth + infra to buy machinery we can hand-roll in ~a day on the table we already own. **Durable Objects** = a fancier endpoint workers still poll. **Event-sourcing/Kafka** = overkill, still needs a claim mechanism on top. **Webhooks/push** = needs inbound reachability we don't have. **Git-as-queue** = fine for one-way data sync (drank), bad for concurrent claim/status. Two places something else *does* win: don't force telemetry into the queue (that's the events sink, §1); and multi-step orchestration (the v2 idea→build→review→judge→distribute DAG) wants a **durable workflow engine (CF Workflows / Inngest) layered on top** of the queue, never hand-rolled on it. Simple ordering meanwhile fits a `depends_on` check on the existing `tasks.dependencies` field. Net: queue now, workflow engine later, broker never.

**v1 scope (now): everything is push-up or pull-task; local-only is fine.** A lot of these stay local-only for now, so v1 is the queue + workers polling on wake, plus the events sink for non-task telemetry. saas-maker is a **system-of-record + work queue**, not yet a *driving* orchestrator. Tradeoff to accept knowingly: an observe-only, pull-only hub's data is only as fresh as each spoke's last wake — so don't build anything that *depends* on a spoke's data being current until that spoke runs as a hosted/background worker. All of it is forward-compatible: hosting a worker later (so it polls continuously) is additive, no rework.

This does **not** reverse §2.2's SPOF warning: there the risk was a *local-first product depending on the hub*; here, push-up is fire-and-forget through an outbox, so spokes still work standalone.

**Design tenet: the hub is optional.** Every service must (a) work fully standalone with no saas-maker, and (b) "just work" — auto-drain its queue, publish its results — the moment it's started with a token and can reach the hub. The hub is never a hard dependency. Operationally this means: a service only engages the hub when a token is configured, and the worker loop swallows hub/network errors (the SDK's `client.worker.drain()` ends quietly with `hubUnavailable: true` rather than throwing). Open services → connect → they all just work; unplug the hub → each keeps working alone.

**Reachability invariant (the simplification).** The local-only tools — **psi-swarm** (localhost CLI), **drank** (browser/Vercel), and **pinpoint** (CLI/daemon/extension) — are **push-only: they emit up (events or tasks), and saas-maker never reads or calls them.** This dissolves the old "a cloud Worker can't reach into your laptop" problem — there's nothing to reach into; work flows outward. (Explicitly rejected: having the hub pull pinpoint's local `history.jsonl` off the machine — that would violate this invariant. Instead, whoever *runs* a pinpoint-seeded task updates its status in the hub.) **CodeVetter** is also local (desktop) but *pulls* tasks, so it too needs no inbound reachability. Net: **nothing requires the hub to reach into a local machine.** The hub only ever *calls* hosted spokes (reel-pipeline dispatch and high-signal pull); every local/desktop spoke either pushes up or pulls down. psi-swarm and drank reuse the Phase 0 events sink as-is; pinpoint already posts to the task board — no new infra for any of the three.

## 4. Why this is a good idea (in this form)

- **Honors the goal literally:** spokes stop talking to each other; saas-maker becomes the one that knows everything.
- **No SPOF for the products:** publishing is fire-and-forget/async; if saas-maker is down, the product still works and buffers/retries. A sync gateway would take every product down with it.
- **Matches the confirmed driver:** a single events table *is* the central-data/analytics outcome you asked for.
- **Cheap:** mostly reuses `analytics-sdk` + one endpoint. No service mesh, no queues-everywhere, no per-product rewrite.
- **Incremental & reversible:** each product opts in independently; nothing forces a big-bang migration.

## 5. Why the literal "all communication through saas-maker" would be a bad idea

- **Distributed monolith:** routing live traffic through one service couples every product's deploys to the hub's. A solo dev pays org-scale ESB overhead with no org-scale governance need.
- **Kills local-first:** drank (browser), psi-swarm (local CLI), CodeVetter (offline Tauri) derive their main value from needing *nothing else*. A runtime hub makes them require a network round-trip and an uptime dependency.
- **Latency + failure surface** on every call, for integrations that are inherently batch/async anyway.
- **Solves a problem you don't have:** the integration count is 3, not 30. Hub-for-maintenance is premature.

## 6. Phased plan

1. **Phase 0 — Schema (small):** define the fleet event contract `{ product, type, payload, ts, idempotency_key }`; add `POST /v1/events` + an `events` D1 table; confirm `analytics-sdk` can carry it.
2. **Phase 1 — Prove with the two live flows:** route reel-pipeline render results and high-signal brief emissions into `/v1/events`. Surface them in a Cockpit "Fleet Activity" view. (Validates the system-of-record claim end-to-end.)
3. **Phase 2 — Onboard reporters:** psi-swarm (audit percentiles) and CodeVetter (review and audience-validation telemetry) publish up. Each is a few lines via the SDK.
4. **Phase 3 — Collapse the odd hop:** replace drank→high-signal GitHub-JSON sync with publish-up so drank's snapshot lives in saas-maker too. Optionally re-home the high-signal→reel-pipeline brief through a saas-maker queue.
5. **Phase 4 (only if a real need appears):** shared identity/SSO and a unified paywall — defer until a product actually needs cross-product accounts. Not required for the data goal.

**Explicitly out of scope:** a synchronous request gateway, Durable-Object service mesh, or routing any product's internal traffic through saas-maker.

**Concrete build spec:** see [2026-06-19-fleet-events-hub-spec.md](./2026-06-19-fleet-events-hub-spec.md) for the D1 table, `POST /v1/events` route, the outbox, and per-service onboarding steps.

## 7. Open questions

- Event schema granularity — one generic `events` sink vs. a few typed streams (marketing / signals / audits / reviews)? Start generic, split if query patterns demand.
- Does the `events` store need to be queryable analytics (ClickHouse-ish) or is D1 + periodic rollups enough? D1 is almost certainly enough at fleet scale.
- Backpressure / retry on the publish path so a hub outage never blocks a product.
