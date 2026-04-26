/**
 * Foundry auth defaults — applied by createAuth() before the user-supplied opts.
 *
 * The actual better-auth instance is constructed in `index.ts` (server) and
 * `client.ts` (browser). This file isolates the defaults so they can be
 * unit-tested without pulling in the full better-auth dependency tree.
 */

declare const process: { env?: Record<string, string | undefined> } | undefined;

export interface FoundryAuthOpts {
  /** D1 binding from the Cloudflare context, e.g. env.DB. */
  d1: unknown;
  /** Drizzle schema for auth tables (user / session / account / verification). */
  schema: Record<string, unknown>;
  /** Optional secret. Reads BETTER_AUTH_SECRET / AUTH_SECRET if omitted. */
  secret?: string;
  /** Public base URL of your auth-bearing app. Reads AUTH_URL if omitted. */
  baseURL?: string;
  /** Google OAuth credentials. Reads GOOGLE_CLIENT_ID / SECRET if omitted. */
  google?: { clientId?: string; clientSecret?: string };
  /** Trusted redirect origins. */
  trustedOrigins?: string[];
  /** Override session cookie name. Defaults to 'foundry.session'. */
  sessionCookieName?: string;
  /** Set to 'production' to force secure cookies. Reads NODE_ENV otherwise. */
  env?: 'development' | 'production' | 'test';
}

export interface ResolvedAuthConfig {
  secret: string;
  baseURL: string;
  socialProviders: {
    google: { clientId: string; clientSecret: string };
  };
  trustedOrigins: string[];
  advanced: {
    cookies: {
      session_token: { name: string; attributes: { secure: boolean; sameSite: 'lax'; httpOnly: true } };
    };
    crossSubDomainCookies: { enabled: false };
    useSecureCookies: boolean;
  };
}

function readEnv(key: string): string | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined;
  return process.env[key];
}

/**
 * Resolves the Foundry auth defaults. Pure function — call this from createAuth()
 * to get the config object, then pass it to betterAuth() with your `database`.
 */
export function resolveAuthConfig(opts: FoundryAuthOpts): ResolvedAuthConfig {
  const secret = opts.secret ?? readEnv('BETTER_AUTH_SECRET') ?? readEnv('AUTH_SECRET');
  if (!secret) {
    throw new Error(
      '[auth-preset] missing secret — set BETTER_AUTH_SECRET or pass `secret` to createAuth()',
    );
  }

  const baseURL =
    opts.baseURL ??
    readEnv('AUTH_URL') ??
    readEnv('NEXTAUTH_URL') ??
    readEnv('BETTER_AUTH_URL');
  if (!baseURL) {
    throw new Error(
      '[auth-preset] missing baseURL — set AUTH_URL or pass `baseURL` to createAuth()',
    );
  }

  const googleId =
    opts.google?.clientId ?? readEnv('GOOGLE_CLIENT_ID') ?? readEnv('AUTH_GOOGLE_ID') ?? '';
  const googleSecret =
    opts.google?.clientSecret ??
    readEnv('GOOGLE_CLIENT_SECRET') ??
    readEnv('AUTH_GOOGLE_SECRET') ??
    '';

  const env = opts.env ?? (readEnv('NODE_ENV') as FoundryAuthOpts['env']) ?? 'development';
  const isProd = env === 'production';

  return {
    secret,
    baseURL,
    socialProviders: {
      google: { clientId: googleId, clientSecret: googleSecret },
    },
    trustedOrigins: opts.trustedOrigins ?? [baseURL],
    advanced: {
      cookies: {
        session_token: {
          name: opts.sessionCookieName ?? 'foundry.session',
          attributes: { secure: isProd, sameSite: 'lax', httpOnly: true },
        },
      },
      crossSubDomainCookies: { enabled: false },
      useSecureCookies: isProd,
    },
  };
}
