import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Bindings, Variables } from './types';
import { configurePostHog, capture, flushPostHog } from './lib/telemetry';
import { auth } from './routes/auth';
import { projects } from './routes/projects';
import { feedback } from './routes/feedback';
import { upload } from './routes/upload';
import { rateLimit } from './middleware/rate-limit';

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
  if (origin.endsWith('.significanthobbies.com')) return true;
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
  // Keep CF Worker alive until PostHog batch flush completes.
  // Skip on /health to avoid unnecessary overhead on liveness probes.
  if (c.env.POSTHOG_API_KEY && c.req.path !== '/health') {
    c.executionCtx.waitUntil(flushPostHog());
  }
});

app.get('/health', (c) => c.json({ status: 'ok' }));

app.use('/v1/*', rateLimit({ limit: 100, period: 60 }));

app.route('/v1/auth', auth);
app.route('/v1/projects', projects);
app.route('/v1/feedback', feedback);
app.route('/v1/upload', upload);

export default app;
