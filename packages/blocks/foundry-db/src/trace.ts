import { trace } from '@saas-maker/ops';

/**
 * Convenience wrapper for manually tracing DB operations.
 * Use when getDbClient() auto-tracing isn't sufficient.
 *
 * const results = await dbTrace('users:findByEmail', () => db.select(...), 'linkchat');
 */
export function dbTrace<T>(
  operation: string,
  fn: () => Promise<T>,
  project?: string
): Promise<T> {
  return trace(`db:${operation}`, fn, { project });
}
