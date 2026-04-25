import { FoundryErrors, trace } from '@saas-maker/ops';

export type LibSQLClient = {
  execute: (query: string | { sql: string; args?: unknown[] }) => Promise<unknown>;
  batch?: (queries: unknown[]) => Promise<unknown[]>;
};

export interface FoundryDbConfig {
  project?: string;   // for tracing
  d1?: D1Database;    // Cloudflare D1 binding (passed from env)
  url?: string;       // Turso/libSQL URL (from DATABASE_URL)
  authToken?: string; // Turso auth token
}

let _cachedClient: LibSQLClient | null = null;

/**
 * Get a DB client. Auto-detects D1 vs Turso based on what's provided.
 *
 * In Cloudflare Workers: pass env.DB as `d1`
 * In Node.js/Vite: reads DATABASE_URL + TURSO_AUTH_TOKEN from process.env
 *
 * Usage:
 *   // CF Worker
 *   const db = getDbClient({ d1: env.DB, project: 'linkchat' });
 *
 *   // Node/Vite / Next.js
 *   const db = getDbClient({ project: 'significanthobbies' });
 *   // requires DATABASE_URL (and optionally TURSO_AUTH_TOKEN) in env
 */
export function getDbClient(config: FoundryDbConfig = {}): LibSQLClient {
  // D1 — Cloudflare native (no caching; binding is per-request)
  if (config.d1) {
    return wrapWithTrace(adaptD1(config.d1), config.project);
  }

  // Turso/libSQL — Node.js or Edge (cached singleton)
  if (_cachedClient) return _cachedClient;

  const url =
    config.url ??
    (typeof process !== 'undefined' ? process.env['DATABASE_URL'] : undefined);
  const authToken =
    config.authToken ??
    (typeof process !== 'undefined' ? process.env['TURSO_AUTH_TOKEN'] : undefined);

  if (!url) {
    throw FoundryErrors.db(
      'No database URL provided. Set DATABASE_URL or pass d1 binding.'
    );
  }

  const client = createLibSQLClient(url, authToken);
  _cachedClient = wrapWithTrace(client, config.project);
  return _cachedClient;
}

/** Reset the cached libSQL client (useful in tests). */
export function resetDbClient(): void {
  _cachedClient = null;
}

function adaptD1(d1: D1Database): LibSQLClient {
  return {
    execute: async (query) => {
      const sql = typeof query === 'string' ? query : query.sql;
      const args = typeof query === 'string' ? [] : (query.args ?? []);
      const stmt = d1.prepare(sql);
      return args.length > 0 ? stmt.bind(...args).all() : stmt.all();
    },
  };
}

function createLibSQLClient(url: string, authToken?: string): LibSQLClient {
  // Dynamic require to avoid bundling @libsql/client into CF Workers builds
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('@libsql/client') as {
      createClient: (opts: { url: string; authToken?: string }) => LibSQLClient;
    };
    return createClient({ url, authToken });
  } catch {
    throw FoundryErrors.db(
      '@libsql/client not installed. Run: pnpm add @libsql/client'
    );
  }
}

function wrapWithTrace(client: LibSQLClient, project?: string): LibSQLClient {
  return {
    execute: async (query) => {
      const sql = typeof query === 'string' ? query : query.sql;
      const opName = `db:${extractTableName(sql)}`;
      return trace(opName, () => client.execute(query), { project });
    },
    batch: client.batch
      ? async (queries) =>
          trace('db:batch', () => client.batch!(queries), { project })
      : undefined,
  };
}

function extractTableName(sql: string): string {
  const match = sql.match(/(?:FROM|INTO|UPDATE|DELETE\s+FROM)\s+["'`]?(\w+)/i);
  return match?.[1] ?? 'query';
}
