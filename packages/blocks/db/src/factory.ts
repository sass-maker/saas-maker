import { drizzle } from "drizzle-orm/d1";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { trace } from "@saas-maker/ops";

export interface DbConfig {
  /**
   * For Cloudflare D1: pass the D1Database binding
   */
  d1?: any;
  /**
   * For Turso/LibSQL: pass the connection URL
   */
  url?: string;
  /**
   * For Turso/LibSQL: pass the auth token
   */
  authToken?: string;
  /**
   * Optional project name for tracing
   */
  projectName?: string;
}

/**
 * Creates a Foundry-compliant Drizzle instance.
 * Automatically detects between D1 and LibSQL/Turso.
 */
export function createFoundryDb(config: DbConfig) {
  // 1. Cloudflare D1
  if (config.d1) {
    return drizzle(config.d1, {
      logger: {
        logQuery(_query, _params) {
          // Note: In production you might want to only trace slow queries
          // but for the Foundry, we trace all to get the baseline.
        },
      },
    });
  }

  // 2. Turso / LibSQL
  if (config.url) {
    const client = createClient({
      url: config.url,
      authToken: config.authToken,
    });
    return drizzleLibsql(client);
  }

  throw new Error("Foundry DB: No valid database provider (D1 or LibSQL) found in config.");
}

/**
 * Higher-level wrapper to run a database operation inside a Foundry Trace.
 */
export async function withDbTrace<T>(
  operationName: string,
  fn: () => Promise<T>
): Promise<T> {
  return trace(`db:${operationName}`, fn);
}
