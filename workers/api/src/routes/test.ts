/**
 * Test-only routes for e2e session minting.
 *
 * Gated behind the FOUNDRY_E2E_SECRET env var. If the secret is unset, every
 * request returns 404 — the route is invisible. With the secret set, callers
 * must present a matching `X-Foundry-Test-Secret` header AND request a user
 * email matching `^e2e-[a-z0-9-]+@e2e\.foundry\.test$` so production users
 * can never be impersonated.
 */
import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { getDb } from '../db';

const test = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const TEST_EMAIL_RE = /^e2e-[a-z0-9-]+@e2e\.foundry\.test$/;

function gate(secretFromHeader: string | undefined, secretFromEnv: string | undefined) {
  if (!secretFromEnv) return { allowed: false, status: 404 as const };
  if (secretFromHeader !== secretFromEnv) return { allowed: false, status: 401 as const };
  return { allowed: true } as const;
}

test.post('/mint-session', async (c) => {
  const gateResult = gate(c.req.header('X-Foundry-Test-Secret'), c.env.FOUNDRY_E2E_SECRET);
  if (!gateResult.allowed) return c.json({ error: 'Not found' }, gateResult.status);

  const body = (await c.req.json().catch(() => null)) as { email?: string } | null;
  if (!body?.email || !TEST_EMAIL_RE.test(body.email)) {
    return c.json({ error: 'email must match e2e-*@e2e.foundry.test' }, 400);
  }

  const userId = `e2e_${crypto.randomUUID()}`;
  const sessionId = `e2e_session_${crypto.randomUUID()}`;
  const token = `bat_${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 3600;

  // 1. Upsert into the better-auth `user` table
  await c.env.DB.prepare(
    `INSERT INTO user (id, name, email, emailVerified, image, createdAt, updatedAt)
     VALUES (?, ?, ?, 1, NULL, ?, ?)
     ON CONFLICT (email) DO UPDATE SET updatedAt = excluded.updatedAt`
  )
    .bind(userId, 'E2E Test User', body.email, now, now)
    .run();

  const userRow = await c.env.DB.prepare(`SELECT id FROM user WHERE email = ?`)
    .bind(body.email)
    .first<{ id: string }>();
  const resolvedUserId = userRow?.id ?? userId;

  // 2. Insert better-auth session row keyed by opaque token
  await c.env.DB.prepare(
    `INSERT INTO session (id, expiresAt, token, createdAt, updatedAt, ipAddress, userAgent, userId)
     VALUES (?, ?, ?, ?, ?, NULL, 'foundry-e2e', ?)`
  )
    .bind(sessionId, expiresAt, token, now, now, resolvedUserId)
    .run();

  // 3. Mirror into legacy users table so the rest of the API works
  const db = getDb(c.env.DB);
  await db.upsertUser({
    id: resolvedUserId,
    email: body.email,
    name: 'E2E Test User',
    avatar_url: null,
  });

  return c.json({ token, userId: resolvedUserId, expiresAt });
});

test.delete('/cleanup', async (c) => {
  const gateResult = gate(c.req.header('X-Foundry-Test-Secret'), c.env.FOUNDRY_E2E_SECRET);
  if (!gateResult.allowed) return c.json({ error: 'Not found' }, gateResult.status);

  // Cascade: delete sessions for any user matching the e2e email pattern
  await c.env.DB.prepare(
    `DELETE FROM session WHERE userId IN (SELECT id FROM user WHERE email LIKE 'e2e-%@e2e.foundry.test')`
  ).run();
  await c.env.DB.prepare(`DELETE FROM user WHERE email LIKE 'e2e-%@e2e.foundry.test'`).run();
  await c.env.DB.prepare(`DELETE FROM users WHERE email LIKE 'e2e-%@e2e.foundry.test'`).run();
  return c.json({ ok: true });
});

export { test };
