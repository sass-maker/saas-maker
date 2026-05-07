# Views Runtime — Roadmap

Living plan for the `@saas-maker/capability-graph` + `@saas-maker/views-runtime` packages and the surrounding "dynamic interfaces" thesis.

> Each phase is sequenced by what we can verify end-to-end, not by what is most ambitious. Ship narrow, expand only when the prior phase proves itself.

---

## Phase 0 — context

The thesis: software vendors ship typed primitives (entities + capabilities); end users compose their own UIs on top via coding agents. We are building the local-host substrate for that — first as an internal feature in Foundry's cockpit, later as an externalisable runtime.

Three layers we plan to grow into:

1. **Capability graph** — vendor-agnostic typed entity registry (`Email`, `Issue`, `Customer`) with capability-scoped actions.
2. **Views runtime** — JSON spec → mounted React dashboard, bindings resolved through the graph.
3. **Authoring surface** — humans + agents emit/edit specs via prompt; specs are forkable, versionable, shareable.

---

## Phase 1 — runtime + graph (✅ shipped this branch)

Two packages under `packages/blocks/views/`:

- `@saas-maker/capability-graph` — entity/capability factories, `CapabilityGraph` class, scope enforcement, Zod-validated args. 15 unit tests.
- `@saas-maker/views-runtime` — `<ViewRuntime>` component, Zod-validated spec, three default blocks (MetricCard, List, Table) wired to `@saas-maker/ui` shadcn primitives, pluggable block registry, fallback for unknown types. 11 unit tests.

Out of scope intentionally: React grid drag/resize, real-time sync, persistence, sharing, prompt-to-spec.

---

## Phase 2 — proof inside cockpit

**Goal**: prove the runtime can render a real cockpit page without losing fidelity.

**Concrete target**: pick one existing cockpit route. Candidates by ascending coupling:

- `apps/cockpit/src/app/(app)/standards/` — likely simplest; mostly read-only summary cards
- `apps/cockpit/src/app/(app)/projects/` — fleet projects list
- `apps/cockpit/src/app/(app)/fleet/` — most complex; includes live monitoring components

Recommended first target: `standards/`. Smallest surface, easiest A/B, lowest risk.

**Steps**:

1. Build a `FleetEntity` set in the graph: `Project`, `Job`, `Standard`. Backed by existing `workers/api` routes (no new endpoints).
2. Express the chosen page as a `ViewSpec` JSON literal in code (no DB persistence yet).
3. Render `<ViewRuntime spec={spec} graph={fleetGraph} ctx={...}>` behind a feature flag.
4. Visual diff old vs new. Iterate until parity.
5. Promote the runtime route, keep old as fallback for one week.

**Exit criteria**: one cockpit page rendering 100% via runtime, no regressions, no new latency.

**Open decisions before starting**:

- Where does the spec live? Inline TS literal? `views/*.json` file? D1 row?
- Do we serialize layout coordinates, or let CSS Grid auto-flow?
- Should fleet entities ship in `@saas-maker/capability-graph`, or in a new `@saas-maker/blocks/views/fleet-providers` package?

---

## Phase 3 — first external integration

**Goal**: prove the graph routes cleanly across two heterogeneous sources.

**Recommended source**: GitHub. Cockpit already integrates with it via better-auth Google → reuse OAuth pattern; entity shape (`Issue`, `PullRequest`, `Repo`) is well-known and stable.

**Steps**:

1. Add `nango` self-hosted (see https://nango.dev) for OAuth + API plumbing. Pick self-host to control cost and avoid an extra SaaS dependency.
2. New package: `@saas-maker/blocks/views/integrations` (or split per source — `views/integration-github`).
3. Sync layer: poll on demand v1; webhook subscriptions later.
4. Provider registers with `graph.provide({ source: 'github', entity: Issue, fetch, actions })`.
5. Ship one new view: "Cross-repo PR review queue" — joins local fleet's `Project` entity with GitHub `PullRequest`.

**Exit criteria**: a single view spec composes data from two sources (fleet + GitHub) end-to-end, with capability scopes enforced.

**Watch-outs**:

- Token storage: lean on existing better-auth `session` table or a per-source `integration_token` table.
- Rate limits: GitHub REST is 5,000 req/hr authenticated. Cache aggressively; do not paginate full repos on render.
- Webhooks: defer until polling proves insufficient.

---

## Phase 4 — prompt-to-tweak loop

**Goal**: a user types "add churn next to MRR" and the runtime updates without a redeploy.

**Constraint**: the LLM must not emit arbitrary JSON. It calls a fixed tool surface that mutates the spec in narrow, validatable ways.

**Tool surface (proposed)**:

```ts
addBlock({ type, binding?, props?, layout? })
removeBlock({ id })
updateBlockProps({ id, props })
addBinding({ name, entity, source?, filter?, orderBy?, limit? })
removeBinding({ name })
moveBlock({ id, x, y, w?, h? })
setLayout({ layout: 'grid' | 'flex' | 'stack' })
```

Each tool re-validates the resulting spec via `ViewSpecSchema`. Invalid output → reject without applying.

**Implementation sketch**:

1. New package: `@saas-maker/blocks/views/authoring`.
2. Wraps `@saas-maker/ai` (already in repo) with the tool definitions above.
3. Provides a `<SpecTweakComposer>` React component — chat input bound to the active view, applies returned mutations through `setSpec`.
4. Spec history stored in D1 — every mutation = a new row. User can revert.

**Exit criteria**: at least 5 reasonable English prompts mutate the cockpit's primary view correctly without manual edits, and the diff is reversible.

**Watch-outs**:

- LLM cost per tweak. Cache prior context; pass only the spec + entity registry to the model.
- Consistent block id generation — let the tool layer assign ids, not the LLM.
- "Add a chart" requires a Chart block we have not built yet — Phase 4 likely needs Phase 5 to land in parallel.

---

## Phase 5 — block library expansion

We ship three blocks today. We need at least: `Sparkline`, `TimeSeries`, `Kanban`, `ActivityFeed`, `Calendar`, `EntityChip`, `Aggregate` (sum/avg/group), `Filter` (driving multiple blocks).

Decision: build per demand. Every new view should add at most one new block type. If a view requests three new types, the spec is too clever — push back on the requirement first.

Implementation policy:

- Every block must declare its props schema with Zod (currently informal — tighten this).
- Loading/error/empty states are baked in (already enforced in defaults).
- Visual style flows from `@saas-maker/ui` and `@saas-maker/tailwind-preset` — no per-block colour decisions.

---

## Phase 6 — persistence + sharing

**Goal**: specs become first-class artifacts with history, ownership, and forking.

**Schema sketch (D1)**:

```sql
CREATE TABLE view (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  current_version INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE view_version (
  id TEXT PRIMARY KEY,
  view_id TEXT NOT NULL REFERENCES view(id),
  version INTEGER NOT NULL,
  spec TEXT NOT NULL,            -- JSON
  authored_by TEXT NOT NULL,     -- user id or 'agent:<model>'
  created_at INTEGER NOT NULL,
  UNIQUE(view_id, version)
);

CREATE TABLE view_install (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  view_id TEXT NOT NULL,
  forked_from_version_id TEXT,
  created_at INTEGER NOT NULL
);
```

Sharing v1 = a public read-only endpoint that returns the latest spec; the installer forks it client-side. No fancy permissions yet.

**Watch-outs**:

- A shared spec references entities the installer's graph does not have. Runtime must surface "missing entity" errors clearly (currently we only do this for unknown block types).
- Rendering a stranger's spec means executing their layout config — already safe (declarative). It does not mean executing their JS — we never load JS from specs. Re-confirm this every time someone proposes "let blocks have a script field."

---

## Phase 7 — marketplace + protocol

Probably 18 months out. Only worth doing once Phase 6 has 1k+ active users + at least 3 vendors asking for an external spec.

When the time comes, align with rather than reinvent:

- **MCP Apps** (`https://modelcontextprotocol.io/extensions/apps/overview`) — for vendor capability exposure.
- **A2UI** (`https://a2ui.org/`) — for declarative UI specs that render natively in the host.
- **AG-UI** (`https://docs.ag-ui.com/`) — for agent ↔ frontend wire format.

Today's spec format is shaped to be cheap to translate to A2UI later. Do not publish a competing standard until we have the user base to back it.

---

## Cross-cutting concerns

### Security model

The runtime is data-only — specs cannot embed scripts. Capabilities are scoped strings checked on every read and write. As we add sharing, we must still treat any imported spec as untrusted *content*, not untrusted *code*.

### Performance budget

Targets we should hit before Phase 6:

- First paint of a view: <200 ms (excluding network fetches).
- Binding fetch: parallel, no waterfalls. P95 <500 ms for cached, <2 s cold.
- Spec mutation round trip: <300 ms (LLM excluded).

### Testing

- Every new block: a happy-dom render test in `@saas-maker/views-runtime/src/__tests__/`.
- Every new entity provider: a contract test that fetches + invokes through the graph with a faked HTTP layer.
- Every prompt-tweak tool: a property test that the result still passes `ViewSpecSchema`.

### Naming

`packages/blocks/views/*` is our reservation. New view-related packages go there. Keep `apps/cockpit/` free of runtime internals — only the runtime mounts there.

---

## Decision log (so future-us remembers why)

| Date       | Decision                                                                 | Why                                                                                                                                |
| ---------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-28 | Build inside saas-maker, not a new repo                                  | Cockpit shell, auth, D1, UI lib, hooks, OpenAPI machinery already exist. Saves ~3 weeks of bootstrap and dogfoods immediately.     |
| 2026-04-28 | Two packages (graph + runtime), not one                                  | Graph has zero React deps — reusable in workers, CLI, agents. Splitting keeps the substrate light.                                 |
| 2026-04-28 | Spec is JSON, validated by Zod                                           | LLM-emittable, persistable, language-agnostic. Generation cost is JSON-shaped already.                                              |
| 2026-04-28 | Defer marketplace / signing / sandbox to Phase 7                         | These are right answers but cost months of work. Closed-product first; earn the right to standardise once we have users.            |
| 2026-04-28 | Use shadcn (`@saas-maker/ui`) for default block UI; no Tremor in v1       | Already in the repo, already styled by `@saas-maker/tailwind-preset`. Adding Tremor would bring a duplicate styling surface.       |
| 2026-04-28 | Adopt internal protocol shape compatible with MCP / A2UI / AG-UI          | Cheap option value — when one of them wins, we flip a switch instead of rewriting.                                                  |

Append to this table as we go. The "why" is more valuable than the "what."
