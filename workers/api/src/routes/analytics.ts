import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireApiKey, requireApiKeyOrSession, requireSession } from '../middleware/auth';
import { getDb } from '../db';
import { parseDevice, parseBrowser, isBot, parseOS, extractPathname, computeSessionId } from '../ua';
import type { TrackEventRequest } from '@saas-maker/shared-types';
import { trace } from '@saas-maker/ops';

const analytics = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const DEFAULT_LIMIT = 10;

const VALID_DETAIL_SECTIONS = ['pages', 'referrers', 'countries', 'devices', 'browsers', 'os', 'events', 'bots'] as const;
type DetailSection = (typeof VALID_DETAIL_SECTIONS)[number];

function parsePeriod(period?: string): Date {
  const now = new Date();
  switch (period) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case '7d': return new Date(now.getTime() - 7 * 86400000);
    case '90d': return new Date(now.getTime() - 90 * 86400000);
    case 'all': return new Date('2020-01-01T00:00:00Z');
    default: return new Date(now.getTime() - 30 * 86400000);
  }
}

// --- Ingestion (API key auth) ---

analytics.post('/events', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const body = (await c.req.json()) as TrackEventRequest;

  const ua = c.req.header('User-Agent') || '';
  const country = c.req.header('CF-IPCountry') || null;
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || null;
  const device = parseDevice(ua);
  const browser = parseBrowser(ua);

  // Privacy-preserving IP hash for session differentiation (not stored raw)
  let ipHash: string | null = null;
  if (ip) {
    let h = 0;
    for (let i = 0; i < ip.length; i++) {
      h = ((h << 5) - h) + ip.charCodeAt(i);
      h |= 0;
    }
    ipHash = h.toString(36);
  }

  const db = getDb(c.env.DB);
  const event = {
    id: crypto.randomUUID(),
    project_id: projectId,
    name: body.name || 'page_view',
    url: body.url || null,
    referrer: body.referrer || null,
    utm_source: body.utm_source || null,
    utm_medium: body.utm_medium || null,
    utm_campaign: body.utm_campaign || null,
    country,
    device,
    browser,
    screen_width: body.screen_width || null,
    properties: body.properties || {},
    os: parseOS(ua),
    is_bot: isBot(ua),
    pathname: extractPathname(body.url),
    session_id: computeSessionId(new Date().toISOString().slice(0, 10), country, device, browser, ipHash),
  };
  await trace('db:trackEvent', () => db.createEvent(event), { project: 'saasmaker-api' });

  return c.json({ ok: true }, 201);
});

// --- Dashboard (session auth) ---

analytics.get('/overview', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const since = parsePeriod(c.req.query('period') || undefined);
  const overview = await db.getAnalyticsOverview(projectId, since);
  return c.json(overview);
});

analytics.get('/pages', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const since = parsePeriod(c.req.query('period') || undefined);
  const data = await db.getTopPages(projectId, since, DEFAULT_LIMIT);
  return c.json({ data });
});

analytics.get('/referrers', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const since = parsePeriod(c.req.query('period') || undefined);
  const data = await db.getTopReferrers(projectId, since, DEFAULT_LIMIT);
  return c.json({ data });
});

analytics.get('/countries', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const since = parsePeriod(c.req.query('period') || undefined);
  const data = await db.getCountryBreakdown(projectId, since, DEFAULT_LIMIT);
  return c.json({ data });
});

analytics.get('/devices', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const since = parsePeriod(c.req.query('period') || undefined);
  const data = await db.getDeviceBreakdown(projectId, since);
  return c.json({ data });
});

analytics.get('/events', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const since = parsePeriod(c.req.query('period') || undefined);
  const data = await db.getCustomEventCounts(projectId, since, DEFAULT_LIMIT);
  return c.json({ data });
});

// --- New dashboard & detail routes ---

analytics.get('/dashboard', requireApiKeyOrSession, async (c) => {
  const db = getDb(c.env.DB);
  let projectId = c.get('projectId');

  if (!projectId) {
    // Session path — require project_id query param + ownership check
    const userId = c.get('userId')!;
    projectId = c.req.query('project_id');
    if (!projectId) return c.json({ error: 'project_id is required' }, 400);

    const project = await db.getProjectById(projectId);
    if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);
  }

  const period = c.req.query('period') || '30d';
  const since = parsePeriod(period);
  const includeBots = c.req.query('include_bots') === 'true';
  const isToday = period === 'today';

  const dashboard = await db.getAnalyticsDashboard(projectId, since, includeBots, isToday);
  return c.json(dashboard);
});

analytics.get('/recent', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100);
  const data = await db.getRecentEvents(projectId, limit);
  return c.json({ data });
});

analytics.get('/detail/:section', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id is required' }, 400);

  const section = c.req.param('section') as DetailSection;
  if (!VALID_DETAIL_SECTIONS.includes(section)) {
    return c.json({ error: `Invalid section. Must be one of: ${VALID_DETAIL_SECTIONS.join(', ')}` }, 400);
  }

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const since = parsePeriod(c.req.query('period') || undefined);
  const includeBots = c.req.query('include_bots') === 'true';
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  const result = await db.getAnalyticsDetail(projectId, since, includeBots, section, limit, offset);
  return c.json(result);
});

export { analytics };
