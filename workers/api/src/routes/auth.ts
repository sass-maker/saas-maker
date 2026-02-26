import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { Google } from 'arctic';
import { Bindings, Variables } from '../types';
import { getDb } from '../db';

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function getGoogleClient(env: Bindings) {
  return new Google(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_OAUTH_REDIRECT_URI);
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

auth.get('/google', async (c) => {
  const google = getGoogleClient(c.env);
  const state = crypto.randomUUID();
  const codeVerifier = crypto.randomUUID();
  const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'email', 'profile']);

  setCookie(c, 'oauth_state', state, { httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 600, path: '/' });
  setCookie(c, 'oauth_verifier', codeVerifier, { httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 600, path: '/' });

  return c.redirect(url.toString());
});

auth.get('/google/callback', async (c) => {
  const google = getGoogleClient(c.env);
  const { code, state } = c.req.query();
  const storedState = getCookie(c, 'oauth_state');
  const storedVerifier = getCookie(c, 'oauth_verifier');

  if (!code || !state || state !== storedState || !storedVerifier) {
    return c.json({ error: 'Invalid OAuth state' }, 400);
  }

  deleteCookie(c, 'oauth_state');
  deleteCookie(c, 'oauth_verifier');

  const tokens = await google.validateAuthorizationCode(code, storedVerifier);
  const accessToken = tokens.accessToken();

  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const googleUser = (await userRes.json()) as { id: string; email: string; name: string; picture: string };

  const db = getDb(c.env.DATABASE_URL);

  // Upsert user
  const user = await db.upsertUser({
    id: crypto.randomUUID(),
    email: googleUser.email,
    name: googleUser.name || null,
    avatar_url: googleUser.picture || null,
  });

  // Create session — store hash in DB, raw token in cookie
  const sessionToken = crypto.randomUUID();
  const tokenHash = await hashToken(sessionToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  await db.createSession({ token_hash: tokenHash, user_id: user.id, expires_at: expiresAt });

  setCookie(c, 'sm_session', sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });

  return c.redirect(c.env.APP_BASE_URL + '/projects');
});

auth.get('/session', async (c) => {
  const session = getCookie(c, 'sm_session');
  if (!session) return c.json({ authenticated: false }, 401);

  const db = getDb(c.env.DATABASE_URL);
  const tokenHash = await hashToken(session);
  const sess = await db.getSessionByTokenHash(tokenHash);
  if (!sess) return c.json({ authenticated: false }, 401);

  const user = await db.getUserById(sess.user_id);
  return c.json({ authenticated: true, user });
});

auth.post('/logout', async (c) => {
  const session = getCookie(c, 'sm_session');
  if (session) {
    const db = getDb(c.env.DATABASE_URL);
    const tokenHash = await hashToken(session);
    await db.deleteSession(tokenHash);
  }
  deleteCookie(c, 'sm_session');
  return c.json({ ok: true });
});

export { auth };
