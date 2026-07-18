# Magic Form — Product Block Design Brief

**Date:** 2026-06-04  
**Status:** Shelved 2026-06-20 — prototype removed with `packages/blocks/ops/` deletion; no production routes/migrations  
**Source:** [saas-ideas](https://github.com/sarthakagrawal927/saas-ideas) at `aba1a83`, triaged in [`docs/product/saas-ideas-consolidation-2026-06-03.md`](../../product/saas-ideas-consolidation-2026-06-03.md)  
**Symphony task:** `58d18a53-e2a6-4f23-b898-5a33cd9f445f`

## Prototype Command

This plan now has a deterministic local prototype in
`packages/blocks/ops/src/magic-form.ts`.

Run it with:

```bash
pnpm --dir packages/blocks/ops test -- --run src/__tests__/magic-form.test.ts
```

The prototype can generate a schema from a product use case, validate allowed
fields, capture a versioned mocked response with analytics metadata, and emit a
widget-style embed example.

## Summary

**Magic Form** is a Foundry product block: project-scoped, embeddable forms whose **field layout is JSON schema** (authored manually, from a small template library, or generated once via AI). Submissions are stored as versioned response blobs. Owners manage responses in Cockpit, receive email + optional webhooks, and can reply to submitters (two-way). This pass defines the block boundary and the **smallest** API/D1 surface for one embedded form — not a drag-and-drop builder or public template marketplace.

## Product Thesis

Fleet apps repeatedly need the same primitives:

| Need | Today in SaaS Maker | Magic Form role |
|------|---------------------|-----------------|
| Email capture | Waitlist widget (`email`, `name`) | Generalize to N fields + custom labels |
| Structured intake | Feedback (`type`, `title`, `description`, image) | Configurable schema, not fixed columns |
| Social proof intake | Testimonials (fixed author/rating/content) | Same embed pattern, different schema |
| Owner notification | Email via `@saas-maker/email` on submit | Reuse on `form.response.created` |
| Product analytics | PostHog `capture()` on widget events | `form_viewed`, `form_submitted`, field-level optional |
| Automation | Tasks, Symphony, digest (planned) | Webhook payload → n8n/Zapier/fleet scripts |

Magic Form is the **schema-driven layer** above single-purpose widgets. Existing widgets stay; Magic Form absorbs net-new form shapes without new tables per use case.

## Non-Goals (This Task / v1)

- No visual form builder (drag-drop, conditional logic editor, multi-page designer).
- No public template marketplace or community sharing.
- No replacement of Feedback/Testimonial/Waitlist widgets in v1 (optional “migrate to Magic Form” later).
- No new global rate limits; reuse existing API-key + project patterns.
- No production cron/AI schedules until a follow-up task approves cost guardrails (mirror [AI Feedback Digest plan](./2026-06-04-ai-feedback-digest-module.md)).

---

## Product Brief

### 1. Templates

**v1:** A fixed, repo-shipped catalog of **starter schemas** (JSON), not user-published templates.

| Template ID | Use case | Core fields |
|-------------|----------|-------------|
| `contact` | General contact | name, email, message |
| `lead` | Pre-launch / sales | email, company, role, note |
| `survey_nps` | Quick pulse | email (optional), score 0–10, comment |
| `application` | Hiring/beta | name, email, link, long text |
| `custom` | Empty shell | owner fills schema manually |

Templates are copied into `magic_forms.schema_json` at create time. Cockpit shows name + description + preview; selecting a template does not call AI.

### 2. AI-generated schema

**Purpose:** Turn a one-line product intent into a draft JSON Schema the owner can edit before publish.

**Flow (dashboard, session auth):**

1. Owner enters prompt: e.g. “Beta signup for mobile app: email, platform iOS/Android, use case, optional Twitter handle.”
2. `POST /v1/forms/:id/generate-schema` calls existing **project AI Gateway** (`/v1/ai/chat/completions` proxy) with a strict JSON output contract.
3. API validates schema (field types whitelist, max fields, max label length) and returns draft; owner saves → increments `schema_version`.

**Guardrails:**

- Max 20 fields; allowed types: `text`, `email`, `url`, `number`, `select`, `multiselect`, `textarea`, `rating`, `boolean`, `file` (file uses existing `/v1/upload`).
- Prefer **free-ai** / project gateway defaults; log via `ai_requests` with `endpoint: forms/generate-schema`.
- AI is **off the public embed path**; embed only reads frozen schema.

### 3. Embedded form SDK

**Package (planned):** `@saas-maker/magic-form` (widget) + SDK service `client.forms`.

**Embed contract (mirrors feedback/waitlist):**

```tsx
<MagicForm
  formId="mf_..."           // or public slug
  projectId="pk_..."      // API key
  apiBaseUrl="https://api.sassmaker.com"
  theme="auto"
  accentColor="#1464ff"
  prefill={{ email: user.email }}
  onSuccess={(response) => ...}
/>
```

**Runtime behavior:**

1. `GET /v1/forms/:formId/schema` (API key) → `{ schema_version, schema, settings }`.
2. Render fields from schema (shared renderer in widget; headless JSON for non-React consumers later).
3. `POST /v1/forms/:formId/responses` with `{ answers, submitter_email?, submitter_name?, metadata? }`.
4. Client-side validation from schema; server re-validates required fields and types.

**Reuse:** Widget CSS variables (`--smw-accent`), theme classes, `createApiClient` pattern from [`packages/widgets/feedback-widget/src/api.ts`](../../../packages/widgets/feedback-widget/src/api.ts), `X-Project-Key` auth from [`workers/api/src/middleware/auth.ts`](../../../workers/api/src/middleware/auth.ts).

### 4. Response versioning

**Problem:** Owners edit forms after submissions exist; column-based tables break.

**Model:**

- Each form has monotonic `schema_version` (integer, starts at 1).
- Each response stores `schema_version` at submit time + `answers` as JSON object keyed by field `id`.
- Schema edits create a new version; old responses remain interpretable via stored version.
- Cockpit renders historical responses using `schema_version` snapshot logic: prefer embedded `schema_snapshot` on the form row at publish time (optional denormalized copy in `magic_forms` history table in phase 2; v1 can store last schema only and warn if field ids disappeared).

**v1 rule:** Field `id` is stable across edits; changing `id` retires the field (hidden on new submits, still shown on old responses from labels in answers keys).

### 5. Analytics

**Layers:**

| Layer | v1 | Later |
|-------|----|-------|
| Product telemetry | PostHog via `capture()` — `form_schema_loaded`, `form_submitted`, `form_field_error` | Dashboard funnels |
| Owner-facing stats | Cockpit cards: submissions / 7d, completion rate (started vs submitted if tracked) | Per-field drop-off |
| D1 `analytics_events` | **Do not** revive deprecated `/v1/analytics/events` for this block in v1 | Optional merge if analytics API returns |

Align event properties with feedback/waitlist: `project_id`, `form_id`, `schema_version`.

### 6. Webhooks

**v1:** Per-form webhook URL + optional signing secret in `settings_json` (or `foundry_secrets` if secret rotation needed later).

On `POST .../responses` success:

- `waitUntil` POST to owner URL with payload:

```json
{
  "event": "form.response.created",
  "form_id": "...",
  "response_id": "...",
  "schema_version": 2,
  "answers": { "email": "a@b.com", "message": "..." },
  "submitter_email": "a@b.com",
  "created_at": "2026-06-04T12:00:00Z"
}
```

- HMAC-SHA256 header `X-SaaSMaker-Signature` when secret configured.
- Retries: 3 attempts, exponential backoff (Worker background); failures logged, no user-facing retry UI in v1.

**Note:** SaaS Maker has **no** generic webhook system today; Magic Form introduces the first narrow dispatcher — keep implementation inside the forms route module.

### 7. Two-way communication

**v1 scope:** Threaded **owner → submitter** email replies tied to a response (not a full chat product).

- Submitter provides `email` (required for two-way; optional field in schema templates).
- Owner posts `POST /v1/forms/:formId/responses/:responseId/messages` (session) with `body`.
- API sends email to submitter via `@saas-maker/email`; stores `magic_form_messages` rows (`author: owner|submitter`, `body`, `created_at`).
- Submitter reply via **magic link** token in email (`POST /v1/forms/responses/reply/:token`) — no account required.

**Reuse:** Email templates and fire-and-forget pattern from [`workers/api/src/routes/feedback.ts`](../../../workers/api/src/routes/feedback.ts) and waitlist owner notify in [`workers/api/src/routes/waitlist.ts`](../../../workers/api/src/routes/waitlist.ts).

**Non-goal v1:** In-app chat widget, SMS, or assignee workflows (→ tasks module if conversion needed).

---

## Overlap With Existing Widgets

| Existing block | Overlap with Magic Form | Reuse in implementation | Keep separate because |
|----------------|-------------------------|---------------------------|------------------------|
| **Waitlist** | Email + optional name capture | API key POST, duplicate email handling pattern, widget theming, owner email notify, PostHog `waitlist_signup` | Waitlist is one row per project email with **position** semantics; Magic Form is multi-field JSON |
| **Testimonials** | Public embed, approval metaphor | Paginated dashboard list, slug-based public page pattern (`/t/[slug]`) if we add `/f/[slug]` | Testimonials need **moderation** (pending/approved) and star rating display wall |
| **Feedback** | Rich submission, image upload, inbox | `/v1/upload`, status workflow UI in cockpit, upvote/browse (not needed for generic forms) | Feedback is **typed** (bug/feature), roadmap-linked, voter identity |
| **AI Gateway** | NL → structure | `/v1/ai/*` proxy, `ai_requests` logging, project `ai_model` config | Schema generation is one prompt template |
| **SDK** (`@saas-maker/sdk`) | HTTP client services | `HttpClient`, service class layout | Add `FormsService` alongside feedback/waitlist |
| **shared-types** | Widget props + request types | Export `MagicFormSchema`, `SubmitFormResponseRequest` | — |
| **ops `capture`** | Submission events | Same `capture({ event, properties })` | — |
| **Feedback Digest** (planned) | Signals from user text | Future: ingest `form_responses` as `source_type: form_response` | Digest clusters; Magic Form collects |

**Recommendation:** Ship Magic Form as a **new** module; do not refactor waitlist/testimonial/feedback into it in v1. Document “when to use which” in docs: fixed product flows → existing widgets; custom fields → Magic Form.

---

## Smallest API Shape (One Embedded Form)

Assumes one form per project is enough for MVP (`form_id` known at embed time). Multi-form per project is the same routes with different `:formId`.

### Public (API key — `X-Project-Key`)

```
GET  /v1/forms/:formId/schema
POST /v1/forms/:formId/responses
POST /v1/upload                                    # unchanged — file fields
POST /v1/forms/responses/reply/:token              # submitter reply (two-way)
```

### Dashboard (session — Bearer)

```
POST   /v1/forms                                   # create { name, template_id?, schema? }
GET    /v1/forms?project_id=                       # list (v1: 0–n forms)
PATCH  /v1/forms/:formId                           # update schema → bumps schema_version
POST   /v1/forms/:formId/generate-schema           # AI draft { prompt }
GET    /v1/forms/:formId/responses?page=1          # inbox
GET    /v1/forms/:formId/responses/:responseId   # detail + messages
POST   /v1/forms/:formId/responses/:responseId/messages
PATCH  /v1/forms/:formId/settings                  # webhook_url, notify_email, etc.
```

### Example payloads

**Schema (excerpt):**

```json
{
  "version": 2,
  "fields": [
    { "id": "email", "type": "email", "label": "Email", "required": true },
    { "id": "message", "type": "textarea", "label": "Message", "required": true }
  ]
}
```

**Submit response:**

```json
{
  "answers": { "email": "user@example.com", "message": "Hello" },
  "submitter_email": "user@example.com",
  "submitter_name": "Ada",
  "metadata": { "page": "/pricing", "referrer": "..." }
}
```

**Response record (API returns):**

```json
{
  "id": "resp_...",
  "form_id": "form_...",
  "schema_version": 2,
  "answers": { "...": "..." },
  "created_at": "..."
}
```

OpenAPI regeneration applies when routes ship (per AGENTS.md).

---

## Smallest D1 Schema (One Embedded Form)

Three tables cover submit, version, and two-way messages. Webhook config lives in settings JSON to avoid a fourth table in MVP.

```sql
CREATE TABLE magic_forms (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT,                              -- optional public embed slug, unique per project
  schema_json TEXT NOT NULL,              -- JSON: { version, fields[] }
  schema_version INTEGER NOT NULL DEFAULT 1,
  settings_json TEXT NOT NULL DEFAULT '{}', -- { webhook_url, webhook_secret_ref?, notify_owner }
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, slug)
);

CREATE TABLE magic_form_responses (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES magic_forms(id) ON DELETE CASCADE,
  schema_version INTEGER NOT NULL,
  answers_json TEXT NOT NULL,             -- JSON object keyed by field id
  submitter_email TEXT,
  submitter_name TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE magic_form_messages (
  id TEXT PRIMARY KEY,
  response_id TEXT NOT NULL REFERENCES magic_form_responses(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('owner','submitter')),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_magic_form_responses_form_created
  ON magic_form_responses(form_id, created_at DESC);
```

**Optional v1.1 (not required for “one form” MVP):** `magic_form_reply_tokens` for expiring submitter reply links.

Add Drizzle entries in [`workers/api/src/schema.ts`](../../../workers/api/src/schema.ts) when implementing; mirror migration under `workers/api/migrations/` and `packages/blocks/db/migrations/`.

---

## Cockpit Surfaces (Phased)

1. **Project → Forms** — create from template or AI prompt, copy embed snippet (`formId` + `projectId`).
2. **Responses inbox** — table with filters, response detail, reply box (two-way).
3. **Settings** — webhook URL, toggle owner email notify (default on).

Register feature flag in settings form next to feedback/waitlist/testimonials when shipped.

---

## Implementation Phases (Follow-Up Tasks)

| Phase | Scope |
|-------|--------|
| **0** | This design brief (current task) |
| **1** | Migrations + public schema GET + response POST + widget + unit tests |
| **2** | Cockpit inbox + AI generate-schema + email notify |
| **3** | Webhooks + two-way messages + SDK `FormsService` |
| **4** | Digest ingest + export CSV + multi-form ergonomics |

---

## Acceptance Criteria Mapping

| Criterion | Section |
|-----------|---------|
| Product brief: templates, AI schema, embed SDK, response versioning, analytics, webhooks, two-way | § Product Brief (1–7) |
| Overlap with feedback/waitlist/testimonials + reuse | § Overlap With Existing Widgets |
| Smallest API + D1 for one embedded form | § Smallest API Shape; § Smallest D1 Schema |
| Non-goal: no builder / marketplace | § Non-Goals |

---

## Remaining Risk

- **Schema validation complexity** — Server-side validation must match widget renderer; shared Zod/JSON Schema module in `packages/blocks` reduces drift.
- **AI schema quality** — Bad drafts erode trust; v1 should require explicit “Publish version N” in Cockpit.
- **Webhook reliability** — First webhook surface in Foundry; document signing and retry limits; avoid blocking submit path on webhook failure.
- **PII / spam** — Generic forms attract bots; consider honeypot field in schema templates and optional Turnstile follow-up (not in smallest API).
- **Widget proliferation** — Fleet docs must steer builders to existing widgets for standard flows to avoid duplicate UX.
- **GDPR/export** — Response blobs may need delete/export endpoints before EU-facing customers; defer but track.

## References

- [`docs/product/saas-ideas-consolidation-2026-06-03.md`](../../product/saas-ideas-consolidation-2026-06-03.md)
- [`docs/architecture/decisions/2026-02-26-feedback-module-design.md`](2026-02-26-feedback-module-design.md)
- [`docs/architecture/decisions/2026-06-04-ai-feedback-digest-module.md`](2026-06-04-ai-feedback-digest-module.md)
- [`workers/api/migrations/0001_schema.sql`](../../../workers/api/migrations/0001_schema.sql) — waitlist, testimonials, analytics_events
- Widgets: `packages/widgets/{feedback,waitlist,testimonials}-widget`
