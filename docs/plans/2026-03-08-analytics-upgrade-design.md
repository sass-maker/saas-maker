# Analytics Upgrade Design

## Goal

Transform the basic event counter into a DataFast-class analytics dashboard — time-series charts, bot/agent detection, browser/OS breakdowns, bounce rate, session tracking, and a polished UI. All privacy-friendly (no cookies, no PII).

## Architecture

### Data Model

Add 4 columns to `analytics_events`:
- `os` (TEXT) — parsed from User-Agent (Windows, macOS, Linux, iOS, Android, ChromeOS)
- `is_bot` (BOOLEAN DEFAULT false) — detected from UA patterns
- `session_id` (TEXT) — hash of `(date + country + device + browser)` for approximate session grouping
- `pathname` (TEXT) — extracted from url (cleaner grouping, strips query params)

No new tables. Session tracking is cookieless — computed server-side at ingestion.

### Bot/Agent Detection

Regex-based detection in `ua.ts` at ingestion time. Categories:
- **Search crawlers:** Googlebot, Bingbot, YandexBot, Baiduspider, DuckDuckBot
- **AI agents:** GPTBot, ClaudeBot, ChatGPT-User, Anthropic, Perplexity, cohere-ai
- **SEO/monitoring:** Ahrefs, Semrush, UptimeRobot, Pingdom
- **Social previews:** Twitterbot, facebookexternalhit, LinkedInBot, Slackbot
- **Generic patterns:** bot, crawler, spider, headless, PhantomJS, Playwright, Puppeteer

Dashboard defaults to excluding bots. Toggle to include.

### API Design

**Two dashboard endpoints replace the current 6:**

#### `GET /v1/analytics/dashboard`
Single request returns full dashboard. Params: `project_id`, `period` (today/7d/30d/90d/all), `include_bots` (default false).

Response:
```json
{
  "summary": {
    "page_views": 1432,
    "unique_visitors": 891,
    "bounce_rate": 42.3,
    "avg_session_pages": 2.1,
    "bot_count": 203,
    "bot_percentage": 12.4
  },
  "timeseries": [
    { "date": "2026-03-07", "views": 142, "visitors": 89 }
  ],
  "pages": [{ "pathname": "/pricing", "views": 312 }],
  "referrers": [{ "referrer": "google.com", "count": 201 }],
  "countries": [{ "country": "US", "count": 445 }],
  "devices": [{ "device": "desktop", "count": 890 }],
  "browsers": [{ "browser": "Chrome", "count": 654 }],
  "os": [{ "os": "macOS", "count": 412 }],
  "events": [{ "name": "cta_click", "count": 89 }],
  "bots": [{ "name": "Googlebot", "count": 102 }]
}
```

Top 10 per section. Timeseries: daily buckets (hourly for "today").

#### `GET /v1/analytics/detail/:section`
Paginated drill-down for expandable sections. Params: `project_id`, `period`, `include_bots`, `limit` (default 50), `offset`.

Sections: `pages`, `referrers`, `countries`, `devices`, `browsers`, `os`, `events`, `bots`.

Old granular endpoints (`/overview`, `/pages`, etc.) remain for backward compat / SDK consumers.

### Ingestion Changes

`POST /v1/analytics/events` enhanced:
- Parse `os` from UA (new `parseOS` function in `ua.ts`)
- Detect `is_bot` from UA (new `isBot` function in `ua.ts`)
- Compute `session_id` as hash of `date + country + device + browser`
- Extract `pathname` from url (strip query params, hash)

### Dashboard UI

Built on existing recharts + zinc dark theme:

1. **Hero area chart** — full-width time-series showing views + visitors lines
2. **Summary row** — 4 stat cards: Page Views, Unique Visitors, Bounce Rate, Avg Pages/Session
3. **Period selector bar** — Today, 7d, 30d, 90d, All — plus "Include bots" toggle
4. **Two-column expandable grid:**
   - Top Pages (horizontal bar)
   - Top Referrers (horizontal bar)
   - Countries (list with flag emojis)
   - Devices (pie)
   - Browsers (pie)
   - Operating Systems (pie)
5. **Bot Traffic section** — collapsible, shows count + % + top bot names
6. **Custom Events section** — list with counts
7. Each section has "See all" that lazy-loads via `/detail/:section`

### Not in scope (future)
- Real-time live visitor view (websocket)
- Revenue attribution / payment integration
- Funnel analysis
- Data export
- Cross-domain tracking

## Tech Stack
- CockroachDB (existing), Hono routes, recharts, Tailwind
