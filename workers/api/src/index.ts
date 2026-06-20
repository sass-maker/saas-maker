import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Bindings, Variables } from './types';
import { configurePostHog, capture, flushPostHog } from './lib/telemetry';
import { auth } from './routes/auth';
import { projects } from './routes/projects';
import { feedback } from './routes/feedback';
import { upload } from './routes/upload';
import { waitlist } from './routes/waitlist';
import { ai } from './routes/ai';
import { testimonials } from './routes/testimonials';
import { changelog } from './routes/changelog';
import { cliAuth } from './routes/cli-auth';
import { secrets } from './routes/secrets';
import { jobs } from './routes/jobs';
import { roadmap } from './routes/roadmap';
import { standards } from './routes/standards';
import { fleetMetadata } from './routes/fleet-metadata';
import { tasks } from './routes/tasks';
import { taskWorkflows } from './routes/task-workflows';
import { symphony } from './routes/symphony';
import { knowledge } from './routes/knowledge';
import { marketing } from './routes/marketing';
import { test as testRoutes } from './routes/test';
import { requireApiKey } from './middleware/auth';
import { rateLimit } from './middleware/rate-limit';
import { getDb } from './db';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.onError((err, c) => {
  console.error(`[${c.get('requestId') || 'unknown'}] Unhandled error:`, err.message, err.stack);
  const userId = c.get('userId');
  capture({
    distinctId: userId ?? 'anonymous',
    event: '$exception',
    properties: {
      $exception_message: err.message,
      $exception_type: err.name,
      $exception_stack_trace_raw: err.stack,
      request_path: c.req.path,
      request_method: c.req.method,
      request_id: c.get('requestId'),
    },
  });
  return c.json({ error: 'Internal server error' }, 500);
});

// Structured JSON for unmatched routes (Hono's default is plain text).
app.notFound((c) => c.json({ error: 'Not found' }, 404));

const ALLOWED_ORIGINS = new Set([
  'https://app.sassmaker.com',
  'https://sassmaker.com',
  'http://localhost:3000',
  'http://localhost:3001',
]);

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Allow all sarthakagrawal927 CF Workers and Pages deployments
  if (origin.endsWith('.sarthakagrawal927.workers.dev')) return true;
  if (origin.endsWith('.pages.dev')) return true;
  if (origin.endsWith('.sassmaker.com')) return true;
  return false;
}

app.use('*', async (c, next) => {
  const origin = c.req.header('Origin') || '';
  const allowedOrigin = isAllowedOrigin(origin) ? origin : 'https://app.sassmaker.com';
  const corsMiddleware = cors({
    origin: allowedOrigin,
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Project-Key', 'Authorization'],
    credentials: true,
  });
  return corsMiddleware(c, next);
});

app.use('*', async (c, next) => {
  c.set('requestId', crypto.randomUUID());
  await next();
});

let posthogConfigured = false;
app.use('*', async (c, next) => {
  if (!posthogConfigured && c.env.POSTHOG_API_KEY) {
    configurePostHog(c.env.POSTHOG_API_KEY, 'https://us.i.posthog.com');
    posthogConfigured = true;
  }
  await next();
  // Keep CF Worker alive until PostHog requests complete
  if (c.env.POSTHOG_API_KEY) {
    c.executionCtx.waitUntil(flushPostHog());
  }
});

app.get('/health', (c) => c.json({ status: 'ok' }));

app.use('/v1/*', rateLimit({ limit: 100, period: 60, skipPrefixes: ['/v1/ai'] }));

// API-key project readme routes (for SDK access)
app.get('/v1/projects/readme', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project) return c.json({ error: 'Not found' }, 404);
  return c.json({ readme: project.readme || '' });
});

app.put('/v1/projects/readme', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const body = await c.req.json() as { content: string };
  if (typeof body.content !== 'string') return c.json({ error: 'content is required' }, 400);
  const db = getDb(c.env.DB);
  await db.updateProject(projectId, { readme: body.content });
  return c.json({ ok: true });
});

app.route('/v1/auth', auth);
app.route('/v1/projects', projects);
app.route('/v1/feedback', feedback);
app.route('/v1/upload', upload);
app.route('/v1/waitlist', waitlist);
app.route('/v1/ai', ai);
app.route('/v1/testimonials', testimonials);
app.route('/v1/changelog', changelog);
app.route('/v1/cli', cliAuth);
app.route('/v1/roadmap', roadmap);
app.route('/v1/standards', standards);
app.route('/v1/fleet/metadata', fleetMetadata);
app.route('/v1/secrets', secrets);
app.route('/v1/jobs', jobs);
app.route('/v1/tasks', tasks);
app.route('/v1/task-workflows', taskWorkflows);
app.route('/v1/symphony', symphony);
app.route('/v1/knowledge', knowledge);
app.route('/v1/marketing', marketing);
app.route('/v1/test', testRoutes);

export default app;
