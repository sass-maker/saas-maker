import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireApiKey } from '../middleware/auth';
import { d1RateLimit } from '../middleware/rate-limit.js';
import { getDb } from '../db';
import type { CreateDirectoryListingRequest } from '@saas-maker/shared-types';

const directory = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const PAGE_SIZE = 24;
const URL_RE = /^https?:\/\/.+\..+/;

// Public: list approved listings
directory.get('/', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const tag = c.req.query('tag') || undefined;
  const search = c.req.query('search') || undefined;
  const db = getDb(c.env.DB);
  const result = await db.listDirectoryListings(page, PAGE_SIZE, tag, search);
  return c.json({ data: result.data, total: result.total, page, limit: PAGE_SIZE });
});

// Public: submit a listing (no auth needed)
directory.post('/', d1RateLimit('directory:submit', 3), async (c) => {
  const body = (await c.req.json()) as CreateDirectoryListingRequest & { website?: string };

  // Honeypot: hidden field that bots fill out
  if (body.website) return c.json({ error: 'Submission rejected' }, 400);

  if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400);
  if (!body.tagline?.trim()) return c.json({ error: 'tagline is required' }, 400);
  if (!body.url?.trim()) return c.json({ error: 'url is required' }, 400);
  if (!URL_RE.test(body.url.trim())) return c.json({ error: 'Invalid URL' }, 400);
  if (body.tagline.length > 120) return c.json({ error: 'tagline must be 120 characters or fewer' }, 400);

  const db = getDb(c.env.DB);
  const listing = await db.createDirectoryListing({
    id: crypto.randomUUID(),
    name: body.name.trim(),
    tagline: body.tagline.trim(),
    url: body.url.trim(),
    description: body.description?.trim() || null,
    logo_url: body.logo_url?.trim() || null,
    screenshot_url: body.screenshot_url?.trim() || null,
    twitter_url: body.twitter_url?.trim() || null,
    project_id: null,
    tags: (body.tags || []).slice(0, 5).map((t) => t.toLowerCase().trim()),
  });
  return c.json(listing, 201);
});

// Authenticated: submit a listing linked to a project (badge verification path)
directory.post('/claim', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const body = (await c.req.json()) as CreateDirectoryListingRequest;

  if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400);
  if (!body.tagline?.trim()) return c.json({ error: 'tagline is required' }, 400);
  if (!body.url?.trim()) return c.json({ error: 'url is required' }, 400);
  if (!URL_RE.test(body.url.trim())) return c.json({ error: 'Invalid URL' }, 400);

  const db = getDb(c.env.DB);

  // Check if project already has a listing
  const existing = await db.getDirectoryListingByProjectId(projectId);
  if (existing) return c.json({ error: 'Project already has a directory listing', listing: existing }, 409);

  const listing = await db.createDirectoryListing({
    id: crypto.randomUUID(),
    name: body.name.trim(),
    tagline: body.tagline.trim(),
    url: body.url.trim(),
    description: body.description?.trim() || null,
    logo_url: body.logo_url?.trim() || null,
    screenshot_url: body.screenshot_url?.trim() || null,
    twitter_url: body.twitter_url?.trim() || null,
    project_id: projectId,
    tags: (body.tags || []).slice(0, 5).map((t) => t.toLowerCase().trim()),
  });
  return c.json(listing, 201);
});

// Authenticated: verify badge is present on the project's site
directory.post('/verify-badge', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const db = getDb(c.env.DB);

  const listing = await db.getDirectoryListingByProjectId(projectId);
  if (!listing) return c.json({ error: 'No directory listing found for this project' }, 404);

  try {
    const res = await fetch(listing.url, {
      headers: { 'User-Agent': 'SaasMaker-BadgeVerifier/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text();
    const verified = html.includes('sassmaker.com/made-with') || html.includes('saasmaker.com/made-with');
    await db.updateDirectoryListingBadgeVerified(listing.id, verified);
    return c.json({ verified, listing_id: listing.id });
  } catch {
    return c.json({ error: 'Could not reach the URL' }, 422);
  }
});


export { directory };
