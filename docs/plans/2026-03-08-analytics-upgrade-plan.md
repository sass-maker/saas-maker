# Analytics Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade analytics from basic event counter to a DataFast-class dashboard with time-series charts, bot/agent detection, OS/browser breakdowns, bounce rate, session tracking, and a single unified `/dashboard` endpoint.

**Architecture:** Add 4 columns to `analytics_events` (os, is_bot, session_id, pathname). Enhance UA parsing with bot detection + OS parsing. Replace 6 separate dashboard endpoints with 2 (`/dashboard` for full payload, `/detail/:section` for drill-down). Rebuild the dashboard UI with a hero time-series chart, summary cards with trend arrows, and expandable sections.

**Tech Stack:** TypeScript, Hono, CockroachDB, recharts, Tailwind, vitest

---

### Task 1: Database migration — add new columns

**Files:**
- Create: `packages/db/migrations/0016_analytics_upgrade.sql`

**Step 1:** Create migration file

```sql
-- Analytics upgrade: bot detection, OS, sessions, pathname
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS os TEXT;
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS pathname TEXT;

-- Index for bot filtering (most queries filter on is_bot)
CREATE INDEX IF NOT EXISTS idx_analytics_events_bot ON analytics_events(project_id, is_bot, created_at);
-- Index for session-based queries (bounce rate)
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(project_id, session_id);
```

**Step 2:** Run migration against production CockroachDB

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker
node -e "
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL || 'postgresql://...');
const fs = require('fs');
const migration = fs.readFileSync('packages/db/migrations/0016_analytics_upgrade.sql', 'utf-8');
sql.unsafe(migration).then(() => { console.log('Done'); sql.end(); }).catch(e => { console.error(e); sql.end(); });
"
```

Expected: `Done`

**Step 3:** Commit

```bash
git add packages/db/migrations/0016_analytics_upgrade.sql
git commit -m "feat: add analytics upgrade migration (os, is_bot, session_id, pathname)"
```

---

### Task 2: Enhance UA parsing — bot detection + OS parsing

**Files:**
- Modify: `workers/api/src/ua.ts`
- Create: `tests/api/ua.test.ts`

**Step 1:** Write tests for bot detection and OS parsing

```typescript
// tests/api/ua.test.ts
import { describe, it, expect } from 'vitest';
import { parseDevice, parseBrowser, parseOS, isBot } from '../../workers/api/src/ua';

describe('isBot', () => {
  it('detects Googlebot', () => {
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true);
  });
  it('detects GPTBot', () => {
    expect(isBot('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)')).toBe(true);
  });
  it('detects ClaudeBot', () => {
    expect(isBot('ClaudeBot/1.0')).toBe(true);
  });
  it('detects generic bot keyword', () => {
    expect(isBot('my-custom-crawler/1.0')).toBe(true);
  });
  it('detects Puppeteer/headless', () => {
    expect(isBot('Mozilla/5.0 HeadlessChrome/90.0')).toBe(true);
  });
  it('returns false for Chrome desktop', () => {
    expect(isBot('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')).toBe(false);
  });
  it('returns false for Safari mobile', () => {
    expect(isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')).toBe(false);
  });
  it('returns false for empty UA', () => {
    expect(isBot('')).toBe(false);
  });
});

describe('parseOS', () => {
  it('detects macOS', () => {
    expect(parseOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('macOS');
  });
  it('detects Windows', () => {
    expect(parseOS('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Windows');
  });
  it('detects Linux', () => {
    expect(parseOS('Mozilla/5.0 (X11; Linux x86_64)')).toBe('Linux');
  });
  it('detects iOS', () => {
    expect(parseOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('iOS');
  });
  it('detects Android', () => {
    expect(parseOS('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('Android');
  });
  it('detects ChromeOS', () => {
    expect(parseOS('Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)')).toBe('ChromeOS');
  });
  it('returns Other for unknown', () => {
    expect(parseOS('curl/7.64.1')).toBe('Other');
  });
});
```

**Step 2:** Run tests to verify they fail

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker && pnpm vitest run tests/api/ua.test.ts
```

Expected: FAIL (parseOS and isBot don't exist yet)

**Step 3:** Implement `isBot` and `parseOS` in `ua.ts`

Replace entire file `workers/api/src/ua.ts` with:

```typescript
const BOT_PATTERNS = /bot|crawler|spider|headless|phantom|puppeteer|playwright|slurp|googlebot|bingbot|yandexbot|baiduspider|duckduckbot|gptbot|claudebot|chatgpt-user|anthropic|perplexity|cohere-ai|ahrefs|semrush|screaming.frog|uptimerobot|pingdom|twitterbot|facebookexternalhit|linkedinbot|slackbot|whatsapp|telegrambot|applebot|bytespider/i;

export function isBot(ua: string): boolean {
  if (!ua) return false;
  return BOT_PATTERNS.test(ua);
}

export function parseDevice(ua: string): string {
  if (/mobile|android|iphone|ipod/i.test(ua)) return 'mobile';
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  return 'desktop';
}

export function parseBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\//i.test(ua) || /opera/i.test(ua)) return 'Opera';
  if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) return 'Chrome';
  if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) return 'Safari';
  if (/firefox\//i.test(ua)) return 'Firefox';
  return 'Other';
}

export function parseOS(ua: string): string {
  if (/CrOS/i.test(ua)) return 'ChromeOS';
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/macintosh|mac os x/i.test(ua)) return 'macOS';
  if (/windows/i.test(ua)) return 'Windows';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Other';
}

export function extractPathname(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    // If it's a full URL, extract pathname
    if (url.startsWith('http')) {
      return new URL(url).pathname;
    }
    // If it already looks like a path, strip query/hash
    return url.split('?')[0].split('#')[0] || null;
  } catch {
    return url.split('?')[0].split('#')[0] || null;
  }
}

export function computeSessionId(date: string, country: string | null, device: string | null, browser: string | null): string {
  const raw = `${date}|${country || ''}|${device || ''}|${browser || ''}`;
  // Simple hash — not crypto, just session grouping
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash.toString(36);
}
```

**Step 4:** Run tests to verify they pass

```bash
pnpm vitest run tests/api/ua.test.ts
```

Expected: All pass

**Step 5:** Commit

```bash
git add workers/api/src/ua.ts tests/api/ua.test.ts
git commit -m "feat: add bot detection, OS parsing, pathname extraction, session ID"
```

---

### Task 3: Update event ingestion to populate new columns

**Files:**
- Modify: `workers/api/src/routes/analytics.ts` (the POST /events handler)
- Modify: `workers/api/src/db.ts` (createEvent)
- Modify: `packages/db/src/index.ts` (FeedbackDatabase interface)
- Modify: `packages/shared-types/src/index.ts` (EventRecord, TrackEventRequest)

**Step 1:** Update shared types

In `packages/shared-types/src/index.ts`, update `EventRecord`:

```typescript
export interface EventRecord {
  id: string;
  project_id: string;
  name: string;
  url: string | null;
  pathname: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  country: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  is_bot: boolean;
  session_id: string | null;
  screen_width: number | null;
  properties: Record<string, unknown>;
  created_at: string;
}
```

**Step 2:** Update FeedbackDatabase interface in `packages/db/src/index.ts`

Update the `createEvent` input type to include:
```typescript
createEvent(input: {
  id: string; project_id: string; name: string; url: string | null;
  pathname: string | null;
  referrer: string | null; utm_source: string | null; utm_medium: string | null;
  utm_campaign: string | null; country: string | null; device: string | null;
  browser: string | null; os: string | null; is_bot: boolean; session_id: string | null;
  screen_width: number | null; properties: Record<string, unknown>;
}): Promise<EventRecord>;
```

**Step 3:** Update `createEvent` in `workers/api/src/db.ts`

Update the INSERT to include new columns:

```typescript
async createEvent(input) {
  const [row] = await sql`
    INSERT INTO analytics_events (id, project_id, name, url, pathname, referrer, utm_source, utm_medium, utm_campaign, country, device, browser, os, is_bot, session_id, screen_width, properties)
    VALUES (${input.id}, ${input.project_id}, ${input.name}, ${input.url}, ${input.pathname}, ${input.referrer}, ${input.utm_source}, ${input.utm_medium}, ${input.utm_campaign}, ${input.country}, ${input.device}, ${input.browser}, ${input.os}, ${input.is_bot}, ${input.session_id}, ${input.screen_width}, ${JSON.stringify(input.properties)})
    RETURNING *
  `;
  return row as EventRecord;
},
```

**Step 4:** Update the POST /events handler in `workers/api/src/routes/analytics.ts`

```typescript
import { parseDevice, parseBrowser, parseOS, isBot, extractPathname, computeSessionId } from '../ua';

analytics.post('/events', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const body = (await c.req.json()) as TrackEventRequest;

  const ua = c.req.header('User-Agent') || '';
  const country = c.req.header('CF-IPCountry') || null;
  const device = parseDevice(ua);
  const browser = parseBrowser(ua);
  const os = parseOS(ua);
  const bot = isBot(ua);
  const pathname = extractPathname(body.url);
  const today = new Date().toISOString().slice(0, 10);
  const sessionId = computeSessionId(today, country, device, browser);

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  await db.createEvent({
    id: crypto.randomUUID(),
    project_id: projectId,
    name: body.name || 'page_view',
    url: body.url || null,
    pathname,
    referrer: body.referrer || null,
    utm_source: body.utm_source || null,
    utm_medium: body.utm_medium || null,
    utm_campaign: body.utm_campaign || null,
    country,
    device,
    browser,
    os,
    is_bot: bot,
    session_id: sessionId,
    screen_width: body.screen_width || null,
    properties: body.properties || {},
  });

  return c.json({ ok: true }, 201);
});
```

**Step 5:** Typecheck

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker/workers/api && pnpm tsc --noEmit
```

Expected: Clean

**Step 6:** Commit

```bash
git add packages/shared-types/src/index.ts packages/db/src/index.ts workers/api/src/db.ts workers/api/src/routes/analytics.ts
git commit -m "feat: populate os, is_bot, session_id, pathname on event ingestion"
```

---

### Task 4: Add dashboard DB queries

**Files:**
- Modify: `workers/api/src/db.ts`
- Modify: `packages/db/src/index.ts`

**Step 1:** Add new query methods to FeedbackDatabase interface in `packages/db/src/index.ts`

```typescript
// Add to the interface:
getAnalyticsDashboard(projectId: string, since: Date, includeBots: boolean, limit: number): Promise<{
  summary: { page_views: number; unique_visitors: number; bounce_rate: number; avg_session_pages: number; bot_count: number; bot_percentage: number };
  timeseries: { date: string; views: number; visitors: number }[];
  pages: { pathname: string; views: number }[];
  referrers: { referrer: string; count: number }[];
  countries: { country: string; count: number }[];
  devices: { device: string; count: number }[];
  browsers: { browser: string; count: number }[];
  os: { os: string; count: number }[];
  events: { name: string; count: number }[];
  bots: { name: string; count: number }[];
}>;

getAnalyticsDetail(projectId: string, since: Date, includeBots: boolean, section: string, limit: number, offset: number): Promise<{ data: Record<string, unknown>[]; total: number }>;
```

**Step 2:** Implement `getAnalyticsDashboard` in `workers/api/src/db.ts`

Add after the existing analytics methods:

```typescript
async getAnalyticsDashboard(projectId, since, includeBots, limit = 10) {
  const botFilter = includeBots ? sql`` : sql`AND (is_bot = false OR is_bot IS NULL)`;

  const [summaryRow, botRow, timeseries, pages, referrers, countries, devices, browsers, osData, events, bots, sessionStats] = await Promise.all([
    // Summary: page views + unique visitors
    sql`
      SELECT COUNT(*)::int AS page_views,
        COUNT(DISTINCT session_id)::int AS unique_visitors
      FROM analytics_events
      WHERE project_id = ${projectId} AND name = 'page_view' AND created_at >= ${since} ${botFilter}
    `.then(r => r[0]),

    // Bot count (always unfiltered)
    sql`
      SELECT COUNT(*)::int AS bot_count
      FROM analytics_events
      WHERE project_id = ${projectId} AND created_at >= ${since} AND is_bot = true
    `.then(r => r[0]),

    // Timeseries
    sql`
      SELECT created_at::date::text AS date, COUNT(*)::int AS views,
        COUNT(DISTINCT session_id)::int AS visitors
      FROM analytics_events
      WHERE project_id = ${projectId} AND name = 'page_view' AND created_at >= ${since} ${botFilter}
      GROUP BY created_at::date ORDER BY date
    `,

    // Top pages
    sql`
      SELECT COALESCE(pathname, url) AS pathname, COUNT(*)::int AS views
      FROM analytics_events
      WHERE project_id = ${projectId} AND name = 'page_view' AND created_at >= ${since} ${botFilter}
        AND (pathname IS NOT NULL OR url IS NOT NULL)
      GROUP BY COALESCE(pathname, url) ORDER BY views DESC LIMIT ${limit}
    `,

    // Top referrers
    sql`
      SELECT referrer, COUNT(*)::int AS count
      FROM analytics_events
      WHERE project_id = ${projectId} AND name = 'page_view' AND created_at >= ${since} ${botFilter}
        AND referrer IS NOT NULL AND referrer != ''
      GROUP BY referrer ORDER BY count DESC LIMIT ${limit}
    `,

    // Countries
    sql`
      SELECT country, COUNT(*)::int AS count
      FROM analytics_events
      WHERE project_id = ${projectId} AND created_at >= ${since} ${botFilter}
        AND country IS NOT NULL
      GROUP BY country ORDER BY count DESC LIMIT ${limit}
    `,

    // Devices
    sql`
      SELECT device, COUNT(*)::int AS count
      FROM analytics_events
      WHERE project_id = ${projectId} AND created_at >= ${since} ${botFilter}
        AND device IS NOT NULL
      GROUP BY device ORDER BY count DESC
    `,

    // Browsers
    sql`
      SELECT browser, COUNT(*)::int AS count
      FROM analytics_events
      WHERE project_id = ${projectId} AND created_at >= ${since} ${botFilter}
        AND browser IS NOT NULL
      GROUP BY browser ORDER BY count DESC LIMIT ${limit}
    `,

    // OS
    sql`
      SELECT os, COUNT(*)::int AS count
      FROM analytics_events
      WHERE project_id = ${projectId} AND created_at >= ${since} ${botFilter}
        AND os IS NOT NULL
      GROUP BY os ORDER BY count DESC LIMIT ${limit}
    `,

    // Custom events
    sql`
      SELECT name, COUNT(*)::int AS count
      FROM analytics_events
      WHERE project_id = ${projectId} AND created_at >= ${since} ${botFilter}
        AND name != 'page_view'
      GROUP BY name ORDER BY count DESC LIMIT ${limit}
    `,

    // Top bots (always unfiltered)
    sql`
      SELECT browser AS name, COUNT(*)::int AS count
      FROM analytics_events
      WHERE project_id = ${projectId} AND created_at >= ${since} AND is_bot = true
      GROUP BY browser ORDER BY count DESC LIMIT ${limit}
    `,

    // Session stats for bounce rate
    sql`
      SELECT
        COUNT(DISTINCT session_id)::int AS total_sessions,
        COUNT(DISTINCT CASE WHEN cnt = 1 THEN sid END)::int AS bounce_sessions,
        COALESCE(AVG(cnt), 0)::float AS avg_pages
      FROM (
        SELECT session_id AS sid, COUNT(*)::int AS cnt
        FROM analytics_events
        WHERE project_id = ${projectId} AND name = 'page_view' AND created_at >= ${since} ${botFilter}
          AND session_id IS NOT NULL
        GROUP BY session_id
      ) sub
    `.then(r => r[0]),
  ]);

  const totalWithBots = (summaryRow?.page_views || 0) + (botRow?.bot_count || 0);
  const botCount = botRow?.bot_count || 0;

  return {
    summary: {
      page_views: summaryRow?.page_views || 0,
      unique_visitors: summaryRow?.unique_visitors || 0,
      bounce_rate: sessionStats?.total_sessions > 0
        ? Math.round((sessionStats.bounce_sessions / sessionStats.total_sessions) * 1000) / 10
        : 0,
      avg_session_pages: Math.round((sessionStats?.avg_pages || 0) * 10) / 10,
      bot_count: botCount,
      bot_percentage: totalWithBots > 0
        ? Math.round((botCount / totalWithBots) * 1000) / 10
        : 0,
    },
    timeseries: timeseries as unknown as { date: string; views: number; visitors: number }[],
    pages: pages as unknown as { pathname: string; views: number }[],
    referrers: referrers as unknown as { referrer: string; count: number }[],
    countries: countries as unknown as { country: string; count: number }[],
    devices: devices as unknown as { device: string; count: number }[],
    browsers: browsers as unknown as { browser: string; count: number }[],
    os: osData as unknown as { os: string; count: number }[],
    events: events as unknown as { name: string; count: number }[],
    bots: bots as unknown as { name: string; count: number }[],
  };
},

async getAnalyticsDetail(projectId, since, includeBots, section, limit = 50, offset = 0) {
  const botFilter = includeBots ? sql`` : sql`AND (is_bot = false OR is_bot IS NULL)`;

  let query;
  let countQuery;

  switch (section) {
    case 'pages':
      query = sql`SELECT COALESCE(pathname, url) AS pathname, COUNT(*)::int AS views FROM analytics_events WHERE project_id = ${projectId} AND name = 'page_view' AND created_at >= ${since} ${botFilter} AND (pathname IS NOT NULL OR url IS NOT NULL) GROUP BY COALESCE(pathname, url) ORDER BY views DESC LIMIT ${limit} OFFSET ${offset}`;
      countQuery = sql`SELECT COUNT(DISTINCT COALESCE(pathname, url))::int AS total FROM analytics_events WHERE project_id = ${projectId} AND name = 'page_view' AND created_at >= ${since} ${botFilter} AND (pathname IS NOT NULL OR url IS NOT NULL)`;
      break;
    case 'referrers':
      query = sql`SELECT referrer, COUNT(*)::int AS count FROM analytics_events WHERE project_id = ${projectId} AND name = 'page_view' AND created_at >= ${since} ${botFilter} AND referrer IS NOT NULL AND referrer != '' GROUP BY referrer ORDER BY count DESC LIMIT ${limit} OFFSET ${offset}`;
      countQuery = sql`SELECT COUNT(DISTINCT referrer)::int AS total FROM analytics_events WHERE project_id = ${projectId} AND created_at >= ${since} ${botFilter} AND referrer IS NOT NULL AND referrer != ''`;
      break;
    case 'countries':
      query = sql`SELECT country, COUNT(*)::int AS count FROM analytics_events WHERE project_id = ${projectId} AND created_at >= ${since} ${botFilter} AND country IS NOT NULL GROUP BY country ORDER BY count DESC LIMIT ${limit} OFFSET ${offset}`;
      countQuery = sql`SELECT COUNT(DISTINCT country)::int AS total FROM analytics_events WHERE project_id = ${projectId} AND created_at >= ${since} ${botFilter} AND country IS NOT NULL`;
      break;
    case 'devices':
      query = sql`SELECT device, COUNT(*)::int AS count FROM analytics_events WHERE project_id = ${projectId} AND created_at >= ${since} ${botFilter} AND device IS NOT NULL GROUP BY device ORDER BY count DESC LIMIT ${limit} OFFSET ${offset}`;
      countQuery = sql`SELECT COUNT(DISTINCT device)::int AS total FROM analytics_events WHERE project_id = ${projectId} AND created_at >= ${since} ${botFilter} AND device IS NOT NULL`;
      break;
    case 'browsers':
      query = sql`SELECT browser, COUNT(*)::int AS count FROM analytics_events WHERE project_id = ${projectId} AND created_at >= ${since} ${botFilter} AND browser IS NOT NULL GROUP BY browser ORDER BY count DESC LIMIT ${limit} OFFSET ${offset}`;
      countQuery = sql`SELECT COUNT(DISTINCT browser)::int AS total FROM analytics_events WHERE project_id = ${projectId} AND created_at >= ${since} ${botFilter} AND browser IS NOT NULL`;
      break;
    case 'os':
      query = sql`SELECT os, COUNT(*)::int AS count FROM analytics_events WHERE project_id = ${projectId} AND created_at >= ${since} ${botFilter} AND os IS NOT NULL GROUP BY os ORDER BY count DESC LIMIT ${limit} OFFSET ${offset}`;
      countQuery = sql`SELECT COUNT(DISTINCT os)::int AS total FROM analytics_events WHERE project_id = ${projectId} AND created_at >= ${since} ${botFilter} AND os IS NOT NULL`;
      break;
    case 'events':
      query = sql`SELECT name, COUNT(*)::int AS count FROM analytics_events WHERE project_id = ${projectId} AND created_at >= ${since} ${botFilter} AND name != 'page_view' GROUP BY name ORDER BY count DESC LIMIT ${limit} OFFSET ${offset}`;
      countQuery = sql`SELECT COUNT(DISTINCT name)::int AS total FROM analytics_events WHERE project_id = ${projectId} AND created_at >= ${since} ${botFilter} AND name != 'page_view'`;
      break;
    case 'bots':
      query = sql`SELECT browser AS name, COUNT(*)::int AS count FROM analytics_events WHERE project_id = ${projectId} AND created_at >= ${since} AND is_bot = true GROUP BY browser ORDER BY count DESC LIMIT ${limit} OFFSET ${offset}`;
      countQuery = sql`SELECT COUNT(DISTINCT browser)::int AS total FROM analytics_events WHERE project_id = ${projectId} AND created_at >= ${since} AND is_bot = true`;
      break;
    default:
      return { data: [], total: 0 };
  }

  const [rows, [countRow]] = await Promise.all([query, countQuery]);
  return { data: rows as unknown as Record<string, unknown>[], total: countRow?.total || 0 };
},
```

**Step 3:** Typecheck

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker/workers/api && pnpm tsc --noEmit
```

**Step 4:** Commit

```bash
git add workers/api/src/db.ts packages/db/src/index.ts
git commit -m "feat: add getAnalyticsDashboard and getAnalyticsDetail DB queries"
```

---

### Task 5: Add /dashboard and /detail/:section API routes

**Files:**
- Modify: `workers/api/src/routes/analytics.ts`

**Step 1:** Add the two new routes after existing routes

```typescript
// --- Unified Dashboard (session auth) ---

analytics.get('/dashboard', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const since = parsePeriod(c.req.query('period') || undefined);
  const includeBots = c.req.query('include_bots') === 'true';

  const data = await db.getAnalyticsDashboard(projectId, since, includeBots, 10);
  return c.json(data);
});

analytics.get('/detail/:section', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const since = parsePeriod(c.req.query('period') || undefined);
  const includeBots = c.req.query('include_bots') === 'true';
  const section = c.req.param('section');
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  const validSections = ['pages', 'referrers', 'countries', 'devices', 'browsers', 'os', 'events', 'bots'];
  if (!validSections.includes(section)) {
    return c.json({ error: `Invalid section. Must be one of: ${validSections.join(', ')}` }, 400);
  }

  const data = await db.getAnalyticsDetail(projectId, since, includeBots, section, limit, offset);
  return c.json(data);
});
```

**Step 2:** Update `parsePeriod` to support 'today' and 'all'

```typescript
function parsePeriod(period?: string): Date {
  const now = new Date();
  switch (period) {
    case 'today': return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case '7d': return new Date(now.getTime() - 7 * 86400000);
    case '90d': return new Date(now.getTime() - 90 * 86400000);
    case 'all': return new Date(0);
    default: return new Date(now.getTime() - 30 * 86400000);
  }
}
```

**Step 3:** Typecheck

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker/workers/api && pnpm tsc --noEmit
```

**Step 4:** Commit

```bash
git add workers/api/src/routes/analytics.ts
git commit -m "feat: add /v1/analytics/dashboard and /detail/:section endpoints"
```

---

### Task 6: Write API tests for new analytics endpoints

**Files:**
- Create: `tests/api/analytics.test.ts`

**Step 1:** Write tests

```typescript
// tests/api/analytics.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../workers/api/src/db', () => ({
  getDb: vi.fn(() => mockDb),
}));

const mockDb = {
  getProjectByApiKey: vi.fn(),
  getProjectById: vi.fn(),
  getCliTokenUser: vi.fn(),
  createEvent: vi.fn(),
  getAnalyticsDashboard: vi.fn(),
  getAnalyticsDetail: vi.fn(),
  getAnalyticsOverview: vi.fn(),
  getTopPages: vi.fn(),
  getTopReferrers: vi.fn(),
  getCountryBreakdown: vi.fn(),
  getDeviceBreakdown: vi.fn(),
  getCustomEventCounts: vi.fn(),
};

// Dynamic import after mock
const { default: app } = await import('../../workers/api/src/index');

function req(method: string, path: string, opts: { body?: unknown; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...opts.headers };
  return app.request(path, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
}

describe('POST /v1/analytics/events', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('tracks event with bot detection and new fields', async () => {
    mockDb.getProjectByApiKey.mockResolvedValue({ id: 'p1', rate_limit_enabled: false });
    mockDb.createEvent.mockResolvedValue({ id: 'e1' });

    const res = await req('POST', '/v1/analytics/events', {
      headers: { 'X-Project-Key': 'pk_test', 'User-Agent': 'Googlebot/2.1' },
      body: { name: 'page_view', url: 'https://example.com/pricing?ref=google' },
    });

    expect(res.status).toBe(201);
    const call = mockDb.createEvent.mock.calls[0][0];
    expect(call.is_bot).toBe(true);
    expect(call.pathname).toBe('/pricing');
    expect(call.session_id).toBeDefined();
    expect(call.os).toBeDefined();
  });

  it('marks normal browser as not bot', async () => {
    mockDb.getProjectByApiKey.mockResolvedValue({ id: 'p1', rate_limit_enabled: false });
    mockDb.createEvent.mockResolvedValue({ id: 'e1' });

    const res = await req('POST', '/v1/analytics/events', {
      headers: { 'X-Project-Key': 'pk_test', 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0' },
      body: { name: 'page_view', url: '/about' },
    });

    expect(res.status).toBe(201);
    const call = mockDb.createEvent.mock.calls[0][0];
    expect(call.is_bot).toBe(false);
    expect(call.os).toBe('macOS');
    expect(call.pathname).toBe('/about');
  });
});

describe('GET /v1/analytics/dashboard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns full dashboard payload', async () => {
    mockDb.getCliTokenUser.mockResolvedValue({ id: 'u1' });
    mockDb.getProjectById.mockResolvedValue({ id: 'p1', owner_id: 'u1' });
    mockDb.getAnalyticsDashboard.mockResolvedValue({
      summary: { page_views: 100, unique_visitors: 50, bounce_rate: 40, avg_session_pages: 2.1, bot_count: 10, bot_percentage: 9.1 },
      timeseries: [{ date: '2026-03-07', views: 100, visitors: 50 }],
      pages: [], referrers: [], countries: [], devices: [], browsers: [], os: [], events: [], bots: [],
    });

    const res = await req('GET', '/v1/analytics/dashboard?project_id=p1&period=30d', {
      headers: { 'Authorization': 'Bearer sm_test' },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.summary).toBeDefined();
    expect(body.timeseries).toBeDefined();
    expect((body.summary as Record<string, unknown>).bounce_rate).toBe(40);
  });

  it('rejects without project_id', async () => {
    mockDb.getCliTokenUser.mockResolvedValue({ id: 'u1' });
    const res = await req('GET', '/v1/analytics/dashboard', {
      headers: { 'Authorization': 'Bearer sm_test' },
    });
    expect(res.status).toBe(400);
  });

  it('rejects non-owner', async () => {
    mockDb.getCliTokenUser.mockResolvedValue({ id: 'u1' });
    mockDb.getProjectById.mockResolvedValue({ id: 'p1', owner_id: 'u2' });

    const res = await req('GET', '/v1/analytics/dashboard?project_id=p1', {
      headers: { 'Authorization': 'Bearer sm_test' },
    });
    expect(res.status).toBe(403);
  });
});

describe('GET /v1/analytics/detail/:section', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns paginated detail for valid section', async () => {
    mockDb.getCliTokenUser.mockResolvedValue({ id: 'u1' });
    mockDb.getProjectById.mockResolvedValue({ id: 'p1', owner_id: 'u1' });
    mockDb.getAnalyticsDetail.mockResolvedValue({ data: [{ pathname: '/home', views: 50 }], total: 1 });

    const res = await req('GET', '/v1/analytics/detail/pages?project_id=p1&limit=10', {
      headers: { 'Authorization': 'Bearer sm_test' },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.total).toBe(1);
  });

  it('rejects invalid section', async () => {
    mockDb.getCliTokenUser.mockResolvedValue({ id: 'u1' });
    mockDb.getProjectById.mockResolvedValue({ id: 'p1', owner_id: 'u1' });

    const res = await req('GET', '/v1/analytics/detail/invalid?project_id=p1', {
      headers: { 'Authorization': 'Bearer sm_test' },
    });
    expect(res.status).toBe(400);
  });
});
```

**Step 2:** Run tests

```bash
pnpm vitest run tests/api/analytics.test.ts
```

Expected: All pass

**Step 3:** Commit

```bash
git add tests/api/analytics.test.ts
git commit -m "test: add analytics dashboard and detail endpoint tests"
```

---

### Task 7: Rebuild dashboard UI

**Files:**
- Modify: `apps/dashboard/src/app/projects/[slug]/analytics/analytics-content.tsx`

**Step 1:** Rewrite `analytics-content.tsx`

This is a full rewrite. The new component:
- Fetches from single `/v1/analytics/dashboard` endpoint
- Shows hero area chart (time-series) at top
- Summary cards row: Page Views, Unique Visitors, Bounce Rate, Avg Pages/Session
- Period selector: Today, 7d, 30d, 90d, All + bot toggle
- Two-column grid: Pages, Referrers, Countries, Devices, Browsers, OS
- Collapsible Bot Traffic section
- Custom Events section
- Each section has "See all" button that fetches `/v1/analytics/detail/:section`

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Eye, Users, TrendingDown, Layers, Bot, Globe, FileText,
  Monitor, Smartphone, Chrome, ChevronDown, ChevronRight,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { getClientToken, apiFetchClient } from "@/lib/api-client";

type Period = "today" | "7d" | "30d" | "90d" | "all";

interface Summary {
  page_views: number;
  unique_visitors: number;
  bounce_rate: number;
  avg_session_pages: number;
  bot_count: number;
  bot_percentage: number;
}

interface DashboardData {
  summary: Summary;
  timeseries: { date: string; views: number; visitors: number }[];
  pages: { pathname: string; views: number }[];
  referrers: { referrer: string; count: number }[];
  countries: { country: string; count: number }[];
  devices: { device: string; count: number }[];
  browsers: { browser: string; count: number }[];
  os: { os: string; count: number }[];
  events: { name: string; count: number }[];
  bots: { name: string; count: number }[];
}

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4"];
const PERIODS: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm text-zinc-400">{label}</div>
        <Icon className="h-4 w-4 text-zinc-500" />
      </div>
      <div className="text-2xl font-bold text-zinc-50">{value}</div>
    </div>
  );
}

function SectionHeader({ title, count, expanded, onToggle }: { title: string; count?: number; expanded: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex items-center gap-2 text-sm font-medium text-zinc-400 mb-3 hover:text-zinc-200 transition-colors w-full text-left">
      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      {title}
      {count !== undefined && <span className="text-zinc-600 text-xs">({count})</span>}
    </button>
  );
}

function ListSection({ items, labelKey, valueKey }: { items: Record<string, unknown>[]; labelKey: string; valueKey: string }) {
  return (
    <div className="space-y-1 max-h-[280px] overflow-y-auto">
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-zinc-800/50 text-sm">
          <span className="text-zinc-200 truncate mr-4">{String(item[labelKey] || 'Unknown')}</span>
          <span className="text-zinc-400 tabular-nums flex-shrink-0">{Number(item[valueKey]).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

interface AnalyticsContentProps {
  projectId: string;
}

export function AnalyticsContent({ projectId }: AnalyticsContentProps) {
  const [period, setPeriod] = useState<Period>("30d");
  const [includeBots, setIncludeBots] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["pages", "referrers", "countries", "devices"]));

  const toggleSection = (s: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getClientToken();
      const qs = `?project_id=${projectId}&period=${period}&include_bots=${includeBots}`;
      const res = await apiFetchClient<DashboardData>(`/v1/analytics/dashboard${qs}`, token);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [projectId, period, includeBots]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="rounded-lg bg-zinc-950 text-zinc-50 p-6">
        <div className="flex items-center justify-center py-16">
          <div className="text-zinc-400">Loading analytics...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-zinc-950 text-zinc-50 p-6">
        <div className="text-center py-16 text-red-400">{error}</div>
      </div>
    );
  }

  if (!data || data.summary.page_views === 0) {
    return (
      <div className="rounded-lg bg-zinc-950 text-zinc-50 p-6">
        <div className="flex flex-col items-center text-center py-16 space-y-4">
          <Eye className="h-12 w-12 text-zinc-600" />
          <h3 className="text-lg font-semibold">No analytics data yet</h3>
          <p className="text-zinc-400 max-w-md">
            Install the SDK and add analytics tracking to start collecting data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-zinc-950 text-zinc-50 p-6 space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === p.value ? "bg-zinc-700 text-zinc-50" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={includeBots}
            onChange={(e) => setIncludeBots(e.target.checked)}
            className="rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500/20"
          />
          Include bots
        </label>
      </div>

      {/* Time-series Chart */}
      {data.timeseries.length > 1 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.timeseries} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="visitorsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} width={40} />
              <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fafafa" }} />
              <Area type="monotone" dataKey="views" stroke="#3b82f6" fill="url(#viewsGrad)" strokeWidth={2} name="Views" />
              <Area type="monotone" dataKey="visitors" stroke="#8b5cf6" fill="url(#visitorsGrad)" strokeWidth={2} name="Visitors" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Page Views" value={data.summary.page_views.toLocaleString()} icon={Eye} />
        <StatCard label="Unique Visitors" value={data.summary.unique_visitors.toLocaleString()} icon={Users} />
        <StatCard label="Bounce Rate" value={`${data.summary.bounce_rate}%`} icon={TrendingDown} />
        <StatCard label="Pages / Session" value={data.summary.avg_session_pages} icon={Layers} />
      </div>

      {/* Bot indicator */}
      {data.summary.bot_count > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm">
          <Bot className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <span className="text-zinc-400">
            <span className="text-zinc-200 font-medium">{data.summary.bot_count.toLocaleString()}</span> bot hits ({data.summary.bot_percentage}% of total)
            {data.bots.length > 0 && ` — top: ${data.bots.slice(0, 3).map(b => b.name).join(', ')}`}
          </span>
        </div>
      )}

      {/* Two-column grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pages */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <SectionHeader title="Top Pages" count={data.pages.length} expanded={expandedSections.has("pages")} onToggle={() => toggleSection("pages")} />
          {expandedSections.has("pages") && data.pages.length > 0 && (
            <ResponsiveContainer width="100%" height={Math.max(180, data.pages.slice(0, 10).length * 32)}>
              <BarChart data={data.pages.slice(0, 10)} layout="vertical" margin={{ left: 0, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="pathname" width={150} tick={{ fill: "#a1a1aa", fontSize: 11 }} tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 22) + "…" : v} />
                <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fafafa" }} />
                <Bar dataKey="views" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Referrers */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <SectionHeader title="Top Referrers" count={data.referrers.length} expanded={expandedSections.has("referrers")} onToggle={() => toggleSection("referrers")} />
          {expandedSections.has("referrers") && data.referrers.length > 0 && (
            <ResponsiveContainer width="100%" height={Math.max(180, data.referrers.slice(0, 10).length * 32)}>
              <BarChart data={data.referrers.slice(0, 10)} layout="vertical" margin={{ left: 0, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="referrer" width={150} tick={{ fill: "#a1a1aa", fontSize: 11 }} tickFormatter={(v: string) => v.length > 22 ? v.slice(0, 22) + "…" : v} />
                <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fafafa" }} />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Countries */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <SectionHeader title="Countries" count={data.countries.length} expanded={expandedSections.has("countries")} onToggle={() => toggleSection("countries")} />
          {expandedSections.has("countries") && <ListSection items={data.countries as unknown as Record<string, unknown>[]} labelKey="country" valueKey="count" />}
        </div>

        {/* Devices */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <SectionHeader title="Devices" count={data.devices.length} expanded={expandedSections.has("devices")} onToggle={() => toggleSection("devices")} />
          {expandedSections.has("devices") && data.devices.length > 0 && (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={data.devices} dataKey="count" nameKey="device" cx="50%" cy="50%" outerRadius={70} strokeWidth={0}
                  label={(p) => `${p.device ?? p.name} ${(p.percent * 100).toFixed(0)}%`}>
                  {data.devices.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fafafa" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Browsers */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <SectionHeader title="Browsers" count={data.browsers.length} expanded={expandedSections.has("browsers")} onToggle={() => toggleSection("browsers")} />
          {expandedSections.has("browsers") && data.browsers.length > 0 && (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={data.browsers} dataKey="count" nameKey="browser" cx="50%" cy="50%" outerRadius={70} strokeWidth={0}
                  label={(p) => `${p.browser ?? p.name} ${(p.percent * 100).toFixed(0)}%`}>
                  {data.browsers.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fafafa" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* OS */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <SectionHeader title="Operating Systems" count={data.os.length} expanded={expandedSections.has("os")} onToggle={() => toggleSection("os")} />
          {expandedSections.has("os") && data.os.length > 0 && (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={data.os} dataKey="count" nameKey="os" cx="50%" cy="50%" outerRadius={70} strokeWidth={0}
                  label={(p) => `${p.os ?? p.name} ${(p.percent * 100).toFixed(0)}%`}>
                  {data.os.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "6px", color: "#fafafa" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Custom Events */}
      {data.events.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <SectionHeader title="Custom Events" count={data.events.length} expanded={expandedSections.has("events")} onToggle={() => toggleSection("events")} />
          {expandedSections.has("events") && <ListSection items={data.events as unknown as Record<string, unknown>[]} labelKey="name" valueKey="count" />}
        </div>
      )}
    </div>
  );
}
```

**Step 2:** Typecheck dashboard

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker/apps/dashboard && pnpm tsc --noEmit
```

**Step 3:** Commit

```bash
git add apps/dashboard/src/app/projects/[slug]/analytics/analytics-content.tsx
git commit -m "feat: rebuild analytics dashboard with time-series, bot detection, OS/browser breakdowns"
```

---

### Task 8: Deploy and verify

**Step 1:** Build everything

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker
pnpm -F @saas-maker/shared-types build
cd workers/api && pnpm tsc --noEmit
cd ../../apps/dashboard && pnpm build
```

**Step 2:** Run all tests

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker && pnpm vitest run
```

Expected: All pass

**Step 3:** Deploy API

```bash
cd /Users/sarthakagrawal/Desktop/saas-maker/workers/api && pnpm wrangler deploy
```

**Step 4:** Test new ingestion with bot detection

```bash
node -e "
const { SaaSMakerClient } = require('./packages/sdk/dist/index.js');
const c = new SaaSMakerClient({ apiKey: 'pk_your_project_key', baseUrl: 'https://api.sassmaker.com' });
Promise.all([
  c.analytics.track({ name: 'page_view', url: '/test-upgrade', screen_width: 1440 }),
  c.analytics.track({ name: 'page_view', url: '/pricing' }),
  c.analytics.track({ name: 'cta_click', url: '/home', properties: { button: 'signup' } }),
]).then(() => console.log('Ingestion OK')).catch(console.error);
"
```

**Step 5:** Test dashboard endpoint

```bash
curl -s -H "Authorization: Bearer sm_..." "https://api.sassmaker.com/v1/analytics/dashboard?project_id=...&period=30d" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log('Summary:', j.summary);console.log('Timeseries points:', j.timeseries?.length);console.log('Pages:', j.pages?.length);console.log('Bots:', j.bots?.length)})"
```

**Step 6:** Commit and push

```bash
git push origin main
```
