/**
 * @saas-maker/foundry-db
 *
 * Environment-aware DB factory with golden columns and auto-tracing.
 *
 * ── Cloudflare Worker ──────────────────────────────────────────────────────
 * import { getDbClient } from '@saas-maker/foundry-db';
 *
 * export default {
 *   fetch(req, env) {
 *     const db = getDbClient({ d1: env.DB, project: 'my-app' });
 *     const rows = await db.execute('SELECT * FROM users LIMIT 10');
 *   }
 * }
 *
 * ── Next.js / Node.js ──────────────────────────────────────────────────────
 * // .env: DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=...
 * import { getDbClient, foundryColumns } from '@saas-maker/foundry-db';
 * import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
 * import { drizzle } from 'drizzle-orm/libsql';
 *
 * export const usersTable = sqliteTable('users', {
 *   ...foundryColumns(),
 *   email: text('email').notNull(),
 * });
 *
 * const client = getDbClient({ project: 'my-app' });
 * const db = drizzle(client as any, { schema: { usersTable } });
 * const users = await db.select().from(usersTable).all();
 */

export { getDbClient, resetDbClient } from './client.js';
export type { FoundryDbConfig, LibSQLClient } from './client.js';
export { foundryColumns, softDelete } from './columns.js';
export { dbTrace } from './trace.js';
