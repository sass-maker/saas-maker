import { Hono } from 'hono';
import { getDb } from '../db';
import { createPing } from '../lib/app-health-ping';
import { tryGetCatalogProjectId } from '../lib/catalog-project-binding';
import { CAPTURE_CONSENT_COPY_V1, CAPTURE_CONSENT_VERSION } from '../lib/capture-consent';
import {
  getCaptureById,
  joinCapture,
  listCapture,
  unsubscribeCapture,
  type CaptureKind,
} from '../lib/capture-store';
import { captureSigningReady, signCaptureToken, verifyCaptureToken } from '../lib/capture-token';
import { apiError } from '../lib/errors';
import { requireApiKey, requireSession } from '../middleware/auth';
import type { Bindings, Variables } from '../types';

export const subscriptions = new Hono<{ Bindings: Bindings; Variables: Variables }>();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCE_RE = /^[a-z][a-z0-9_-]{0,63}$/;

subscriptions.get('/', requireSession, async (c) => {
  if (!captureSigningReady(c.env.CAPTURE_SIGNING_KEY)) {
    return apiError(c, 503, 'unavailable', 'Subscriptions are unavailable');
  }
  const projectHint = c.req.query('project');
  if (!projectHint) return apiError(c, 400, 'invalid_request', 'Project is required');
  const kind = c.req.query('kind');
  if (kind && kind !== 'newsletter' && kind !== 'waitlist') {
    return apiError(c, 400, 'invalid_request', 'Invalid subscription kind');
  }
  const cursor = c.req.query('cursor');
  if (cursor && !/^[0-9a-f-]{36}$/i.test(cursor)) {
    return apiError(c, 400, 'invalid_request', 'Invalid subscription cursor');
  }
  const db = getDb(c.env.DB);
  const project =
    (await db.getProjectById(projectHint)) ?? (await db.getProjectBySlug(projectHint));
  if (!project || project.owner_id !== c.get('userId')) {
    return apiError(c, 404, 'not_found', 'Project not found');
  }
  let result;
  try {
    result = await listCapture(c.env.DB, project.id, kind as CaptureKind | undefined, cursor);
  } catch (error) {
    if (error instanceof RangeError) {
      return apiError(c, 400, 'invalid_request', 'Invalid subscription cursor');
    }
    throw error;
  }
  c.header('Cache-Control', 'no-store');
  return c.json({
    data: await Promise.all(
      result.data.map(async (record) => ({
        ...record,
        unsubscribe_token: await signCaptureToken(
          c.env.CAPTURE_SIGNING_KEY!,
          record.id,
          record.email.trim().toLowerCase()
        ),
      }))
    ),
    next_cursor: result.next_cursor,
  });
});

subscriptions.post('/', requireApiKey, async (c) => {
  if (!captureSigningReady(c.env.CAPTURE_SIGNING_KEY)) {
    return apiError(c, 503, 'unavailable', 'Subscriptions are unavailable');
  }
  let input: unknown;
  try {
    input = await c.req.json();
  } catch {
    return apiError(c, 400, 'invalid_request', 'Request body must be JSON');
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return apiError(c, 400, 'invalid_request', 'Request body must be an object');
  }
  const body = input as Record<string, unknown>;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const kind = body.kind;
  const source = typeof body.source === 'string' ? body.source : 'product';
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return apiError(c, 400, 'invalid_request', 'A valid email is required');
  }
  if (kind !== 'newsletter' && kind !== 'waitlist') {
    return apiError(c, 400, 'invalid_request', 'Invalid subscription kind');
  }
  if (body.consent !== true) {
    return apiError(c, 400, 'invalid_request', 'Explicit consent is required');
  }
  if (!SOURCE_RE.test(source)) {
    return apiError(c, 400, 'invalid_request', 'Invalid source');
  }

  const result = await joinCapture(c.env.DB, {
    id: crypto.randomUUID(),
    projectId: c.get('projectId')!,
    kind: kind as CaptureKind,
    email,
    source,
    consentVersion: CAPTURE_CONSENT_VERSION,
    consentText: CAPTURE_CONSENT_COPY_V1[kind],
    consentedAt: new Date().toISOString(),
  });
  if (result.joined && c.env.APP_HEALTH_INGEST_KEY) {
    const projectId = c.get('projectId')!;
    const catalogProjectId = await tryGetCatalogProjectId(c.env.DB, projectId);
    const deliver = createPing({
      key: c.env.APP_HEALTH_INGEST_KEY,
      environment: c.env.APP_HEALTH_ENVIRONMENT || 'production',
    })(kind === 'waitlist' ? 'waitlist.join' : 'newsletter.subscribe', {
      title: kind === 'waitlist' ? 'Waitlist joined' : 'Newsletter subscribed',
      props: {
        project: catalogProjectId ?? c.get('project')?.slug ?? projectId,
        project_slug: c.get('project')?.slug ?? null,
        project_id: projectId,
        ...(catalogProjectId ? { catalog_project_id: catalogProjectId } : {}),
        kind,
      },
    });
    try {
      c.executionCtx.waitUntil(deliver);
    } catch {
      void deliver;
    }
  }
  // Same response for a new join and a duplicate to avoid email enumeration.
  return c.json({ ok: true }, 202);
});

subscriptions.post('/unsubscribe', async (c) => {
  if (!captureSigningReady(c.env.CAPTURE_SIGNING_KEY)) {
    return apiError(c, 503, 'unavailable', 'Subscriptions are unavailable');
  }
  let input: unknown;
  try {
    input = await c.req.json();
  } catch {
    return apiError(c, 400, 'invalid_request', 'Request body must be JSON');
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return apiError(c, 400, 'invalid_request', 'Request body must be an object');
  }
  const body = input as Record<string, unknown>;
  const id = typeof body.id === 'string' ? body.id : '';
  const token = typeof body.token === 'string' ? body.token : '';
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f]{64}$/.test(token)) {
    return apiError(c, 400, 'invalid_request', 'Invalid unsubscribe link');
  }
  const record = await getCaptureById(c.env.DB, id);
  if (
    record &&
    (await verifyCaptureToken(c.env.CAPTURE_SIGNING_KEY, id, record.email_normalized, token))
  ) {
    await unsubscribeCapture(c.env.DB, id);
  }
  return c.json({ ok: true }, 202);
});
