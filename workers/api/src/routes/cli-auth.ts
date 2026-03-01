import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireSession } from '../middleware/auth';
import { getDb } from '../db';

const cliAuth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Step 1: CLI requests a code (no auth)
cliAuth.post('/code', async (c) => {
  const code = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const db = getDb(c.env.DATABASE_URL);
  await db.createCliAuthCode(code);

  const dashboardUrl = c.env.APP_BASE_URL || 'http://localhost:3000';
  return c.json({
    code,
    url: `${dashboardUrl}/cli/auth?code=${code}`,
    expires_in: 600,
  });
});

// Step 2: Dashboard approves (session auth)
cliAuth.post('/approve', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const { code } = await c.req.json();
  if (!code) return c.json({ error: 'code is required' }, 400);

  const db = getDb(c.env.DATABASE_URL);
  const entry = await db.getCliAuthCode(code);
  if (!entry || entry.status !== 'pending') {
    return c.json({ error: 'Invalid or expired code' }, 400);
  }
  if (new Date(entry.expires_at) < new Date()) {
    return c.json({ error: 'Code expired' }, 400);
  }

  // Generate a long-lived CLI token
  const token = `sm_${crypto.randomUUID().replace(/-/g, '')}`;
  await db.approveCliAuthCode(code, userId, token);
  await db.createCliToken(token, userId);

  return c.json({ ok: true });
});

// Step 3: CLI polls for result (no auth)
cliAuth.get('/poll', async (c) => {
  const code = c.req.query('code');
  if (!code) return c.json({ error: 'code is required' }, 400);

  const db = getDb(c.env.DATABASE_URL);
  const entry = await db.getCliAuthCode(code);
  if (!entry) return c.json({ error: 'Invalid code' }, 404);

  if (new Date(entry.expires_at) < new Date()) {
    return c.json({ status: 'expired' });
  }

  if (entry.status === 'approved' && entry.token) {
    // Clean up the code after successful retrieval
    await db.deleteCliAuthCode(code);
    return c.json({ status: 'approved', token: entry.token });
  }

  return c.json({ status: 'pending' });
});

export { cliAuth };
