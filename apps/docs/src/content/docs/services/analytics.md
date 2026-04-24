---
title: Analytics
description: Track page views, custom events, and visitor metrics with a lightweight script or API.
---

Lightweight, privacy-friendly analytics for your SaaS. Track page views and custom events without cookies. Includes automatic UTM parameter capture, device/browser detection, and country-level geo data.

## Quick Start

Add the tracking script to your site:

```html
<script
  defer
  data-project="pk_your_api_key"
  data-api="https://api.sassmaker.com"
  src="https://unpkg.com/@foundry/analytics-sdk/dist/index.global.js"
></script>
```

Or track events via the API:

```bash
curl -X POST https://api.sassmaker.com/v1/analytics/events \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_your_api_key" \
  -d '{
    "name": "page_view",
    "url": "https://myapp.com/pricing"
  }'
```

## Tracking Script

The script automatically:
- Tracks initial page views
- Handles SPA navigation (pushState / replaceState / popstate)
- Captures UTM parameters from the URL
- Respects `Do Not Track` browser setting
- Sends screen width, referrer, and user agent

### Custom Events

After the script loads, use the global `sm` function:

```javascript
// Track a custom event
sm('signup_completed');

// Track with properties
sm('plan_upgraded', { plan: 'pro', value: 49 });
```

Queue events before the script loads:

```javascript
window.sm = window.sm || { q: [] };
sm.q.push(['button_clicked', { id: 'cta-hero' }]);
```

## API Endpoints

### Track an event

```
POST /v1/analytics/events
```

**Auth:** API Key

```bash
curl -X POST https://api.sassmaker.com/v1/analytics/events \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_your_api_key" \
  -d '{
    "name": "page_view",
    "url": "https://myapp.com/pricing",
    "referrer": "https://google.com",
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "spring-sale",
    "screen_width": 1440,
    "properties": { "variant": "B" }
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | Event name (defaults to `page_view`) |
| `url` | string | No | Page URL |
| `referrer` | string | No | Referrer URL |
| `utm_source` | string | No | UTM source |
| `utm_medium` | string | No | UTM medium |
| `utm_campaign` | string | No | UTM campaign |
| `screen_width` | number | No | Viewport width in pixels |
| `properties` | object | No | Arbitrary key-value properties |

**Response (201):** `{ "ok": true }`

Country, device, and browser are detected automatically from request headers — you don't need to send them.

### Dashboard overview

```
GET /v1/analytics/overview?project_id=PROJECT_ID&period=30d
```

**Auth:** Session Token

```bash
curl "https://api.sassmaker.com/v1/analytics/overview?project_id=proj_123&period=30d" \
  -H "Authorization: Bearer SESSION_TOKEN"
```

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `project_id` | string | — | Required. Project ID |
| `period` | string | `30d` | `7d`, `30d`, or `90d` |

**Response (200):**

```json
{
  "page_views": 1250,
  "unique_visitors": 430,
  "top_page": "/pricing",
  "top_referrer": "https://google.com"
}
```

**Errors:**

| Status | Message | Cause |
|--------|---------|-------|
| `400` | `"project_id is required"` | Missing project_id |
| `403` | `"Forbidden"` | Not the project owner |

### Top pages

```
GET /v1/analytics/pages?project_id=PROJECT_ID&period=30d
```

**Auth:** Session Token

**Response (200):**

```json
{
  "data": [
    { "url": "/pricing", "views": 340 },
    { "url": "/features", "views": 210 }
  ]
}
```

### Top referrers

```
GET /v1/analytics/referrers?project_id=PROJECT_ID&period=30d
```

**Auth:** Session Token

**Response (200):**

```json
{
  "data": [
    { "referrer": "https://google.com", "count": 150 },
    { "referrer": "https://twitter.com", "count": 80 }
  ]
}
```

### Country breakdown

```
GET /v1/analytics/countries?project_id=PROJECT_ID&period=30d
```

**Auth:** Session Token

**Response (200):**

```json
{
  "data": [
    { "country": "US", "count": 500 },
    { "country": "GB", "count": 120 }
  ]
}
```

### Device breakdown

```
GET /v1/analytics/devices?project_id=PROJECT_ID&period=30d
```

**Auth:** Session Token

**Response (200):**

```json
{
  "data": [
    { "device": "desktop", "count": 800 },
    { "device": "mobile", "count": 350 }
  ]
}
```

### Custom event counts

```
GET /v1/analytics/events?project_id=PROJECT_ID&period=30d
```

**Auth:** Session Token

Returns counts for all non-`page_view` events.

**Response (200):**

```json
{
  "data": [
    { "name": "signup_completed", "count": 45 },
    { "name": "plan_upgraded", "count": 12 }
  ]
}
```

### Full dashboard

```
GET /v1/analytics/dashboard?period=30d
```

**Auth:** API Key or Session Token

Returns all analytics data in a single call — summary stats, timeseries, and top-10 breakdowns for pages, referrers, countries, devices, browsers, OS, custom events, and bots.

```bash
curl "https://api.sassmaker.com/v1/analytics/dashboard?period=30d" \
  -H "X-Project-Key: pk_your_api_key"
```

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `project_id` | string | — | Required when using Session Token auth. Not needed with API Key. |
| `period` | string | `30d` | `today`, `7d`, `30d`, `90d`, or `all` |
| `include_bots` | string | `false` | `true` to include bot traffic |

**Response (200):**

```json
{
  "summary": {
    "page_views": 1250,
    "unique_visitors": 430,
    "bounce_rate": 42,
    "avg_session_pages": 2.3,
    "bot_count": 85,
    "bot_percentage": 6.4
  },
  "timeseries": [
    { "date": "2026-03-01", "views": 45, "visitors": 20 }
  ],
  "pages": [{ "pathname": "/pricing", "views": 340 }],
  "referrers": [{ "referrer": "https://google.com", "count": 150 }],
  "countries": [{ "country": "US", "count": 500 }],
  "devices": [{ "device": "desktop", "count": 800 }],
  "browsers": [{ "browser": "Chrome", "count": 600 }],
  "os": [{ "os": "macOS", "count": 400 }],
  "events": [{ "name": "signup_completed", "count": 45 }],
  "bots": [{ "name": "Googlebot", "count": 30 }]
}
```

When `period` is `today`, timeseries is bucketed hourly. All other periods use daily buckets.

### Detail breakdown (paginated)

```
GET /v1/analytics/detail/:section?project_id=PROJECT_ID&period=30d&limit=50&offset=0
```

**Auth:** Session Token

Returns paginated data for a specific breakdown section.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `section` | string | — | One of: `pages`, `referrers`, `countries`, `devices`, `browsers`, `os`, `events`, `bots` |
| `project_id` | string | — | Required. Project ID |
| `period` | string | `30d` | Time period |
| `include_bots` | string | `false` | Include bot traffic |
| `limit` | number | `50` | Items per page |
| `offset` | number | `0` | Pagination offset |

**Response (200):**

```json
{
  "data": [
    { "pathname": "/pricing", "views": 340 },
    { "pathname": "/features", "views": 210 }
  ],
  "total": 156
}
```

## Embeddable Dashboard

Use the `@foundry/analytics-ui` package to embed a full analytics dashboard in any React app:

```tsx
import { AnalyticsDashboard } from '@foundry/analytics-ui';

<AnalyticsDashboard apiKey="pk_your_api_key" />
```

See the [Analytics Dashboard widget docs](/widgets/analytics/) for installation and configuration.

## SDK Usage

```typescript
import { SaaSMakerClient } from '@foundry/sdk';

const client = new SaaSMakerClient({ apiKey: 'pk_your_api_key' });

// Track a page view
await client.analytics.track({
  name: 'page_view',
  url: 'https://myapp.com/pricing',
});

// Track a custom event with properties
await client.analytics.track({
  name: 'plan_upgraded',
  properties: { plan: 'pro', value: 49 },
});
```
