# Waitlist + Analytics Services Design

## Overview

Two new multi-tenant services for saas-maker:

1. **Waitlist** — simple email collection with position tracking
2. **Analytics** — privacy-friendly page view + custom event tracking (Datafast-inspired)

Both follow existing patterns: Hono sub-apps, API key + session auth, CockroachDB, shared-types.

---

## Service 1: Waitlist

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS waitlist_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  position INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, email)
);
CREATE INDEX IF NOT EXISTS idx_waitlist_project ON waitlist_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_position ON waitlist_entries(project_id, position);
```

Position is auto-assigned via `SELECT COALESCE(MAX(position), 0) + 1 FROM waitlist_entries WHERE project_id = $1`.

### API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/v1/waitlist` | API key | Sign up (email, name?) — returns position |
| GET | `/v1/waitlist/count` | API key | Public count of signups |
| GET | `/v1/waitlist` | Session | List entries, paginated (dashboard) |
| DELETE | `/v1/waitlist/:id` | Session | Remove entry (dashboard) |

**Signup behavior:**
- Validates email format
- Dedupes by (project_id, email) — returns 409 if exists
- Returns `{ id, email, name, position, created_at }`

### Shared Types

```typescript
export interface WaitlistEntryRecord {
  id: string;
  project_id: string;
  email: string;
  name: string | null;
  position: number;
  created_at: string;
}

export interface WaitlistSignupRequest {
  email: string;
  name?: string;
}
```

---

## Service 2: Analytics

Inspired by [Datafast](https://datafa.st/) — simple, privacy-friendly, no cookies.

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'page_view',
  url TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  country TEXT,
  device TEXT,
  browser TEXT,
  screen_width INT,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id);
CREATE INDEX IF NOT EXISTS idx_events_project_created ON events(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_project_name ON events(project_id, name);
```

Single table for both page views (`name='page_view'`) and custom events.

### API Routes — Ingestion

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/v1/events` | API key | Track event (called by SDK script) |

Server-side enrichment from Cloudflare headers:
- `CF-IPCountry` → country
- `User-Agent` → device type (desktop/mobile/tablet) + browser family
- No cookies, no fingerprinting

### API Routes — Dashboard

All session auth. Accept `?period=7d|30d|90d` (default 30d) and `?project_id=xxx`.

| Method | Path | Returns |
|--------|------|---------|
| GET | `/v1/analytics/overview` | Total views, unique visitors (approx), top page, top referrer |
| GET | `/v1/analytics/pages` | Pages ranked by view count |
| GET | `/v1/analytics/referrers` | Referrer domains ranked by count |
| GET | `/v1/analytics/countries` | Countries ranked by count |
| GET | `/v1/analytics/devices` | Device / browser / screen breakdown |
| GET | `/v1/analytics/events` | Custom event names + counts |

**Unique visitors approximation** (no cookies): `COUNT(DISTINCT date || country || device || browser)` per period — not perfect but reasonable without PII.

### Analytics SDK — `packages/analytics-sdk`

Target: ~4kb minified. Single script tag setup:

```html
<script defer src="https://cdn.sassmaker.com/a.js" data-project="pk_xxx"></script>
```

Optional custom events:
```javascript
sm.track('signup', { plan: 'pro' });
```

**Script behavior:**
1. Reads `data-project` from own `<script>` tag
2. On load: fires `page_view` with URL, referrer, UTM params (from `location.search`), screen width
3. SPA support: patches `history.pushState`/`replaceState` + listens to `popstate` for client-side nav
4. Queue pattern: `window.sm = window.sm || function() { sm.q = sm.q || []; sm.q.push(arguments); }` — calls before load are buffered
5. Sends via `navigator.sendBeacon()` with `fetch()` fallback
6. Respects `Do Not Track` header — skips tracking if `navigator.doNotTrack === '1'`

### Dashboard Feature: Globe View

Country data enables a real-time globe visualization in the dashboard (Datafast-style). Implementation uses `react-globe.gl` or similar Three.js wrapper in `apps/dashboard`. This is a frontend-only feature that reads from `GET /v1/analytics/countries`.

### Shared Types

```typescript
export interface EventRecord {
  id: string;
  project_id: string;
  name: string;
  url: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  country: string | null;
  device: string | null;
  browser: string | null;
  screen_width: number | null;
  properties: Record<string, unknown>;
  created_at: string;
}

export interface TrackEventRequest {
  name?: string;
  url?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  screen_width?: number;
  properties?: Record<string, unknown>;
}

export interface AnalyticsOverview {
  page_views: number;
  unique_visitors: number;
  top_page: string | null;
  top_referrer: string | null;
}
```

---

## Auth Model

Both services use the existing auth patterns:

- **Public endpoints** (signup, track event, count): `requireApiKey` — `X-Project-Key` header
- **Dashboard endpoints** (list, delete, analytics views): `requireSession` — Bearer token, verifies project ownership

---

## File Structure

```
workers/api/src/routes/waitlist.ts    — waitlist routes
workers/api/src/routes/analytics.ts   — analytics routes + UA parsing
packages/analytics-sdk/               — tracking script (tsup → ESM)
packages/analytics-sdk/src/index.ts   — script entry point
packages/db/migrations/0004_waitlist_analytics.sql
```
