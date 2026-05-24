import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireApiKey } from '../middleware/auth';
import { getDb } from '../db';
import { parseDevice, parseBrowser, isBot, parseOS, extractPathname, computeSessionId } from '../ua';
import type { TrackEventRequest } from '@saas-maker/shared-types';
import { trace } from '@saas-maker/ops';

const analytics = new Hono<{ Bindings: Bindings; Variables: Variables }>();

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
  await trace('db:trackEvent', () => db.createEvent(event), { context: { project: 'saasmaker-api' } });

  return c.json({ ok: true }, 201);
});

export { analytics };
