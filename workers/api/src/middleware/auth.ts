import { createMiddleware } from 'hono/factory';
import { jwtDecrypt } from 'jose';
import { Bindings, Variables } from '../types';
import { getDb } from '../db';

async function deriveEncryptionKey(secret: string, salt: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );
  // Auth.js uses A256CBC-HS512 (64 bytes) with salt = cookie name
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode(salt),
      info: encoder.encode(`Auth.js Generated Encryption Key (${salt})`),
    },
    keyMaterial,
    512 // 64 bytes for A256CBC-HS512
  );
  return new Uint8Array(bits);
}

const COOKIE_NAMES = [
  '__Secure-authjs.session-token',  // production (HTTPS)
  'authjs.session-token',            // development (HTTP)
];

export async function decryptAuthJsJwe(
  token: string,
  secret: string
): Promise<{ sub: string; email: string; name?: string; picture?: string } | null> {
  for (const salt of COOKIE_NAMES) {
    try {
      const key = await deriveEncryptionKey(secret, salt);
      const { payload } = await jwtDecrypt(token, key, {
        clockTolerance: 15,
        keyManagementAlgorithms: ['dir'],
        contentEncryptionAlgorithms: ['A256CBC-HS512', 'A256GCM'],
      });
      if (!payload.sub || !payload.email) return null;
      return payload as unknown as { sub: string; email: string; name?: string; picture?: string };
    } catch {
      continue;
    }
  }
  return null;
}

export const requireSession = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.slice(7);
    const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

    // Try CLI token first (sm_ prefix)
    if (token.startsWith('sm_')) {
      const cliToken = await db.getCliTokenUser(token);
      if (!cliToken) return c.json({ error: 'Unauthorized' }, 401);
      c.set('userId', cliToken.user_id);
      return next();
    }

    // Fall back to AuthJS JWE session token
    const payload = await decryptAuthJsJwe(token, c.env.AUTH_SECRET);
    if (!payload) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Upsert user so we always have a local record
    const user = await db.upsertUser({
      id: payload.sub,
      email: payload.email,
      name: payload.name || null,
      avatar_url: payload.picture || null,
    });

    c.set('userId', user.id);
    await next();
  }
);

export const requireApiKey = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const apiKey = c.req.header('X-Project-Key');
    if (!apiKey) return c.json({ error: 'Missing X-Project-Key header' }, 401);

    const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
    const project = await db.getProjectByApiKey(apiKey);
    if (!project) return c.json({ error: 'Invalid API key' }, 401);

    c.set('projectId', project.id);
    await next();
  }
);
