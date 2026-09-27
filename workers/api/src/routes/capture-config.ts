import { Hono } from 'hono';
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

  const saasMakerProjectId = await getSaasMakerProjectIdByCatalogId(c.env.DB, catalogId);
  if (!saasMakerProjectId) {
    return apiError(c, 404, 'not_found', 'Capture config not found');
  }

  const project = await getDb(c.env.DB).getProjectById(saasMakerProjectId);
  if (!project) {
    return apiError(c, 404, 'not_found', 'Capture config not found');
  }

  c.header('Cache-Control', CACHE_CONTROL);
  return c.json({
    api_key: project.api_key,
    name: project.name,
    slug: project.slug,
  });
});
