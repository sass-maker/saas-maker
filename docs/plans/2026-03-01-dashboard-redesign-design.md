# Dashboard Redesign + Short URL Service Design

## Overview

Three interconnected changes:

1. **Dashboard Redesign** — Replace top-nav layout with sidebar, restyle all pages with shadcn/ui, add dark analytics view with Recharts
2. **Reusable Patterns** — Extract shared API client, hooks, and components so AI agents can scaffold new pages instantly
3. **Short URL Service** — New backend service + dashboard page for link shortening with click tracking

---

## 1. Dashboard Redesign

### Layout: Sidebar

Replace the current top-nav (`projects/layout.tsx`) with a collapsible sidebar layout.

**Sidebar structure:**
- Logo + app name at top
- Project selector dropdown (switch between projects)
- Navigation items per project:
  - Inbox (feedback)
  - Waitlist
  - Analytics
  - Short Links
  - Vector Memory
  - Settings
- User avatar + sign out at bottom

**Responsive:** Sidebar collapses to hamburger on mobile via shadcn `Sheet`.

### Pages

**Projects list** (`/projects`):
- Grid of project cards (name, slug, created date, API key copy)
- "+ New Project" card/button opens existing `CreateProjectDialog`

**Feedback Inbox** (`/projects/[slug]`):
- Existing table stays, restyle with shadcn `Table` + `Badge` for status/type
- Keep existing `FilterBar` and `FeedbackDetail` sheet

**Waitlist** (`/projects/[slug]/waitlist`) — NEW:
- StatCards: total signups, today's signups
- Table: position, email, name, date, delete action
- Quick setup card with SDK snippet

**Analytics** (`/projects/[slug]/analytics`) — NEW:
- Dark theme variant (Datafast-inspired)
- Period selector: 7d / 30d / 90d tabs
- Overview cards: page views, unique visitors, top page, top referrer
- Charts (Recharts): page views over time (area chart), top pages (bar), referrers (bar), devices (pie), browsers (pie)
- Country breakdown table (globe visualization deferred to v2)

**Short Links** (`/projects/[slug]/links`) — NEW:
- Table: short URL, destination (truncated), title, clicks, created, expires, actions (copy/edit/delete)
- Create Link dialog: destination URL, custom slug (optional), title, expiration date
- Click on row opens stats sheet: clicks over time sparkline, top countries, devices, referrers

**Settings** (`/projects/[slug]/settings`):
- Existing settings form, restyleed with shadcn form components

### New Dependencies

- `recharts` — chart library
- `@saasmaker/shared-types` — wire up workspace dependency (delete `feedback-types.ts`)

### New shadcn Components to Install

- `sidebar` — collapsible sidebar layout
- `chart` — Recharts wrapper
- `separator` — dividers
- `skeleton` — loading states
- `tooltip` — hover info

---

## 2. Reusable Patterns for AI Agents

### API Client (`src/lib/api-client.ts`)

Extract typed fetch helpers so AI agents don't reinvent auth:

```typescript
// Server-side (RSC) — auto-attaches session token
export async function apiFetchAuthed<T>(path: string, init?: RequestInit): Promise<T>

// Client-side — requires token passed explicitly
export async function apiFetchClient<T>(path: string, token: string, init?: RequestInit): Promise<T>

// Public — API key auth (X-Project-Key header)
export async function apiFetchPublic<T>(path: string, apiKey: string, init?: RequestInit): Promise<T>
```

### Shared Components

| Component | Purpose |
|-----------|---------|
| `PageHeader` | Title + description + optional action button — every page uses this |
| `StatCard` | Single metric card (label, value, optional trend) |
| `EmptyState` | Icon + title + description + CTA for empty lists |
| `TableSkeleton` | Loading skeleton matching table layout |
| `DataTable` | Reusable table wrapper with pagination |

### Standard Page Template

Every new service page follows this pattern:

```
PageHeader (title, description, action button)
StatCards row (2-4 metrics)
DataTable or custom content
```

An AI agent creating a new service page only needs:
1. The API endpoint path
2. The shared type for the record
3. Which stat metrics to show

### Wire Up Shared Types

Add `"@saasmaker/shared-types": "workspace:*"` to dashboard `package.json`. Delete `src/components/feedback-types.ts` and replace all imports with `@saasmaker/shared-types`.

---

## 3. Short URL Service

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS short_links (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  destination TEXT NOT NULL,
  title       TEXT,
  expires_at  TIMESTAMPTZ,
  click_count INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT short_links_slug_unique UNIQUE (slug)
);
CREATE INDEX IF NOT EXISTS idx_short_links_project ON short_links(project_id);
CREATE INDEX IF NOT EXISTS idx_short_links_project_created ON short_links(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_properties ON events USING GIN (properties);
```

`click_count` is denormalized for fast list display. Source of truth is `events` table.

### Click Tracking

Redirects at `GET /r/:slug` fire a `link_click` event into the existing `events` table via `waitUntil()` (non-blocking). Properties store `{ link_id, slug, title }`. This means:
- Clicks appear in analytics custom events automatically
- Per-link stats use `WHERE properties->>'link_id' = $id`
- Country/device/browser breakdowns reuse existing analytics queries

### API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/r/:slug` | None | 302 redirect + analytics event |
| POST | `/v1/links` | API key | Create link |
| GET | `/v1/links` | API key | List links |
| GET | `/v1/links/:id` | API key | Get link |
| PATCH | `/v1/links/:id` | API key | Update link |
| DELETE | `/v1/links/:id` | API key | Delete link |
| GET | `/v1/links/dashboard/:projectId` | Session | Dashboard list |
| GET | `/v1/links/dashboard/:projectId/stats/:id` | Session | Per-link stats |

### Shared Types

```typescript
export interface ShortLinkRecord {
  id: string;
  project_id: string;
  slug: string;
  destination: string;
  title: string | null;
  expires_at: string | null;
  click_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateShortLinkRequest {
  destination: string;
  slug?: string;
  title?: string;
  expires_at?: string;
}

export interface UpdateShortLinkRequest {
  destination?: string;
  title?: string;
  expires_at?: string | null;
}

export interface ShortLinkStats {
  link_id: string;
  slug: string;
  total_clicks: number;
  clicks_by_country: { country: string; count: number }[];
  clicks_by_device: { device: string; count: number }[];
  clicks_by_referrer: { referrer: string; count: number }[];
  clicks_over_time: { date: string; count: number }[];
}
```

### Not Included (v1)

- QR code generation — add later with Canvas API
- Password-protected links — too complex for v1
- Per-link UTM overrides — 10-line addition once base works
- Globe visualization for analytics — deferred to v2

---

## Auth Model

Same patterns as existing services:
- **Public endpoints** (redirect): No auth
- **SDK/API endpoints** (CRUD): `requireApiKey` via `X-Project-Key` header
- **Dashboard endpoints** (lists, stats): `requireSession` via Bearer token

---

## File Structure

```
# Short URL backend
packages/db/migrations/0005_short_links.sql
packages/db/src/schema.ts                    (add short_links)
packages/db/src/index.ts                     (add 8 new methods)
packages/shared-types/src/index.ts           (add short link types)
workers/api/src/db.ts                        (implement 8 methods)
workers/api/src/routes/links.ts              (NEW — routes)
workers/api/src/index.ts                     (mount /r/:slug + /v1/links)
tests/api/links.test.ts                      (NEW — tests)

# Dashboard redesign
apps/dashboard/src/lib/api-client.ts         (NEW — typed fetch helpers)
apps/dashboard/src/components/page-header.tsx (NEW — shared)
apps/dashboard/src/components/stat-card.tsx   (NEW — shared)
apps/dashboard/src/components/empty-state.tsx (NEW — shared)
apps/dashboard/src/components/data-table.tsx  (NEW — shared)
apps/dashboard/src/app/projects/layout.tsx   (REWRITE — sidebar)
apps/dashboard/src/app/projects/page.tsx     (RESTYLE — project cards)
apps/dashboard/src/app/projects/[slug]/page.tsx           (RESTYLE)
apps/dashboard/src/app/projects/[slug]/waitlist/page.tsx  (NEW)
apps/dashboard/src/app/projects/[slug]/analytics/page.tsx (NEW — dark)
apps/dashboard/src/app/projects/[slug]/links/page.tsx     (NEW)
apps/dashboard/src/app/projects/[slug]/settings/page.tsx  (RESTYLE)
```
