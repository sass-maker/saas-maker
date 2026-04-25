import { sql } from 'drizzle-orm';
import { text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Standard columns every Foundry table should have.
 * Usage: const myTable = sqliteTable('my_table', { ...foundryColumns(), ...myColumns })
 */
export function foundryColumns() {
  return {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
    deletedAt: text('deleted_at'),
    version: integer('version').notNull().default(1), // optimistic locking
  };
}

/**
 * Soft-delete helper — sets deletedAt instead of removing the row.
 */
export function softDelete() {
  return { deletedAt: text('deleted_at') };
}
