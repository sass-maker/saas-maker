import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Bindings, Variables } from './types';
import { auth } from './routes/auth';
import { projects } from './routes/projects';
import { feedback } from './routes/feedback';
import { upload } from './routes/upload';
import { indexes } from './routes/indexes';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use('*', async (c, next) => {
  const allowed = c.env.CORS_ORIGIN
    ? c.env.CORS_ORIGIN.split(',').map((s: string) => s.trim())
    : [];
  const corsMiddleware = cors({
    origin: (origin) => {
      if (!origin) return '*';
      if (allowed.length === 0) return '*';
      if (allowed.includes(origin)) return origin;
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

app.get('/health', (c) => c.json({ status: 'ok' }));

app.route('/v1/auth', auth);
app.route('/v1/projects', projects);
app.route('/v1/feedback', feedback);
app.route('/v1/upload', upload);
app.route('/v1/indexes', indexes);

export default app;
