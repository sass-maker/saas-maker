import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Bindings, Variables } from './types';
import { auth } from './routes/auth';
import { projects } from './routes/projects';
import { feedback } from './routes/feedback';
import { upload } from './routes/upload';
import { indexes } from './routes/indexes';
import { waitlist } from './routes/waitlist';
import { analytics } from './routes/analytics';

import { testimonials } from './routes/testimonials';
import { changelog } from './routes/changelog';
import { cliAuth } from './routes/cli-auth';
import { forms } from './routes/forms';
import { aiGateway } from './routes/ai-gateway';
import { roadmap } from './routes/roadmap';
import { requireApiKey } from './middleware/auth';
import { rateLimit } from './middleware/rate-limit';
import { getDb } from './db';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use('*', async (c, next) => {
  const allowed = c.env.CORS_ORIGIN
    ? c.env.CORS_ORIGIN.split(',').map((s: string) => s.trim())
    : [];
  const corsMiddleware = cors({
    origin: (origin) => {
      // Allow same-origin requests (no Origin header)
      if (!origin) return '*';
      // Always allow localhost for development
      if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return origin;
      // Check against configured origins
      if (allowed.length > 0 && allowed.includes(origin)) return origin;
      // Deny if no match
      return '';
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Project-Key', 'Authorization'],
    credentials: true,
  });
  return corsMiddleware(c, next);
});

app.use('*', async (c, next) => {
  c.set('requestId', crypto.randomUUID());
  await next();
});

// Rate limiting (no-op when projectId is not set, i.e. non-API-key routes)
app.use('*', rateLimit);

app.get('/health', (c) => c.json({ status: 'ok' }));

// API-key project readme routes (for SDK access)
app.get('/v1/projects/readme', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const project = await db.getProjectById(projectId);
  if (!project) return c.json({ error: 'Not found' }, 404);
  return c.json({ readme: project.readme || '' });
});

app.put('/v1/projects/readme', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const body = await c.req.json() as { content: string };
  if (typeof body.content !== 'string') return c.json({ error: 'content is required' }, 400);
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  await db.updateProject(projectId, { readme: body.content });
  return c.json({ ok: true });
});

app.route('/v1/auth', auth);
app.route('/v1/projects', projects);
app.route('/v1/feedback', feedback);
app.route('/v1/upload', upload);
app.route('/v1/indexes', indexes);
app.route('/v1/waitlist', waitlist);
app.route('/v1/analytics', analytics);
app.route('/v1/testimonials', testimonials);
app.route('/v1/changelog', changelog);
app.route('/v1/cli', cliAuth);
app.route('/v1/forms', forms);
app.route('/v1/ai', aiGateway);
app.route('/v1/roadmap', roadmap);

export default app;
