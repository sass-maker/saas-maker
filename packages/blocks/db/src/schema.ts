import { integer, text } from "drizzle-orm/sqlite-core";

/**
 * Standard ID column using a generated string (e.g. cuid or uuid)
 */
export const idColumn = {
  id: text("id").primaryKey().notNull(),
};

/**
 * Standard lifecycle timestamps for any table
 */
export const lifecycleColumns = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
};

/**
 * Standard audit columns for tracking which user/system performed an action
 */
export const auditColumns = {
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
};
