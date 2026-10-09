import { Hono } from 'hono';
import { buildCacheKey, getEdgeCache } from '../edge-cache';
import { getDb } from '../db';
import { getSaasMakerProjectIdByCatalogId } from '../lib/catalog-project-binding';
import { apiError } from '../lib/errors';
import type { Bindings, Variables } from '../types';

// Public, credential-free read endpoint that resolves a Fleet catalog id to
// the bound project's publishable api key and minimal display metadata. It
// never returns owner/user data, private tokens, or unbound projects. Invalid,
// unknown, and unbound ids all share one 404 shape so the response cannot be
// used to enumerate bindings.
export const captureConfig = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const CATALOG_ID_RE = /^[a-z][a-z0-9_-]{0,63}$/;
// Bounded public cache: browsers reuse for 60s, shared edges for 5min. The
// response carries only a publishable browser key, so public caching is safe.
const CACHE_CONTROL = 'public, max-age=60, s-maxage=300';

captureConfig.get('/:catalogId', async (c) => {
  const catalogId = c.req.param('catalogId');
  if (!catalogId || !CATALOG_ID_RE.test(catalogId)) {
    return apiError(c, 404, 'not_found', 'Capture config not found');
  }

  // Cache the public body before D1. CORS is applied by outer middleware;
  // never retain the requesting origin or other request headers in this key.
  const cacheKey = buildCacheKey('capture-config', `${catalogId}:v1`);
  const cache = getEdgeCache();
  if (cache) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) {
        const hit = new Response(cached.body, cached);
        hit.headers.set('Cache-Control', CACHE_CONTROL);
        hit.headers.set('X-Edge-Cache', 'HIT');
        return hit;
      }
    } catch {
      // Cache failure must not prevent signup configuration from resolving.
    }
  }

  const saasMakerProjectId = await getSaasMakerProjectIdByCatalogId(c.env.DB, catalogId);
  if (!saasMakerProjectId) {
    return apiError(c, 404, 'not_found', 'Capture config not found');
  }

  const project = await getDb(c.env.DB).getProjectById(saasMakerProjectId);
  if (!project) {
    return apiError(c, 404, 'not_found', 'Capture config not found');
  }

  c.header('Cache-Control', CACHE_CONTROL);
  const response = c.json({
    api_key: project.api_key,
    name: project.name,
    slug: project.slug,
  });
  response.headers.set('X-Edge-Cache', 'MISS');
  if (cache) {
    try {
      c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()).catch(() => undefined));
    } catch {
      // Non-Worker runtimes can serve without a background cache write.
    }
  }
  return response;
});
