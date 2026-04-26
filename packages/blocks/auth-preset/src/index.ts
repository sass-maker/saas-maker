/**
 * Server entrypoint — wires better-auth with Foundry defaults + D1 adapter.
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import { resolveAuthConfig, type FoundryAuthOpts } from './config.js';

export type { FoundryAuthOpts, ResolvedAuthConfig } from './config.js';
export { resolveAuthConfig } from './config.js';

/**
 * Create a Foundry-standard better-auth instance.
 *
 * @example
 * ```ts
 * import { createAuth } from '@saas-maker/auth-preset';
 * import * as schema from './auth-schema';
 *
 * const auth = createAuth({ d1: env.DB, schema });
 * ```
 */
export function createAuth(opts: FoundryAuthOpts) {
  const cfg = resolveAuthConfig(opts);
  const db = drizzle(opts.d1 as Parameters<typeof drizzle>[0], { schema: opts.schema });

  return betterAuth({
    database: drizzleAdapter(db, { provider: 'sqlite', schema: opts.schema }),
    secret: cfg.secret,
    baseURL: cfg.baseURL,
    socialProviders: cfg.socialProviders,
    trustedOrigins: cfg.trustedOrigins,
    advanced: cfg.advanced,
  });
}

export type FoundryAuth = ReturnType<typeof createAuth>;
