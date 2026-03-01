---
title: Analytics
description: Track page views, custom events, and visitor metrics with a lightweight script or API.
---

Lightweight, privacy-friendly analytics for your SaaS. Track page views and custom events without cookies. Includes automatic UTM parameter capture, device/browser detection, and country-level geo data.

## How it works

1. Add the analytics script to your site or call the API directly
2. Page views are tracked automatically (including SPA navigation)
3. View dashboards with top pages, referrers, countries, and devices

## Tracking script

Add this script tag to your site for automatic page view tracking:

```html
<script
  defer
  data-project="pk_your_api_key"
  data-api="https://api.sassmaker.com"
  src="https://unpkg.com/@saas-maker/analytics-sdk/dist/index.global.js"
></script>
```

The script automatically:
- Tracks initial page views
- Handles SPA navigation (pushState / replaceState / popstate)
- Captures UTM parameters from the URL
- Respects `Do Not Track` browser setting
- Sends screen width, referrer, and user agent

### Custom events

After the script loads, use the global `sm` function:

```javascript
// Track a custom event
sm('signup_completed');

// Track with properties
sm('plan_upgraded', { plan: 'pro', value: 49 });
```

You can also queue events before the script loads:

```javascript
window.sm = window.sm || { q: [] };
sm.q.push(['button_clicked', { id: 'cta-hero' }]);
```

## API endpoints

### Track an event

```
POST /v1/analytics/events
```

**Auth:** API Key

```bash
curl -X POST https://api.sassmaker.com/v1/analytics/events \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: pk_abc123" \
  -d '{
    "name": "page_view",
    "url": "https://myapp.com/pricing",
    "referrer": "https://google.com",
    "utm_source": "google",
    "utm_medium": "cpc",
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
| `screen_width` | number | No | Viewport width |
| `properties` | object | No | Custom event properties |

### Dashboard overview

```
GET /v1/analytics/overview?project_id=...&period=30d
```

**Auth:** Session Token

Returns page views, unique visitors, top page, and top referrer.

**Period options:** `7d`, `30d` (default), `90d`

### Top pages

```
GET /v1/analytics/pages?project_id=...&period=30d
```

**Auth:** Session Token

### Top referrers

```
GET /v1/analytics/referrers?project_id=...&period=30d
```

**Auth:** Session Token

### Country breakdown

```
GET /v1/analytics/countries?project_id=...&period=30d
```

**Auth:** Session Token

### Device breakdown

```
GET /v1/analytics/devices?project_id=...&period=30d
```

**Auth:** Session Token

### Custom event counts

```
GET /v1/analytics/events?project_id=...&period=30d
```

**Auth:** Session Token
