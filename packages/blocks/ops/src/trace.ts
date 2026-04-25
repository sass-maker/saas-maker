import { FoundryError } from './error.js';
import { shipTrace } from './posthog.js';

export interface TraceOptions {
  project?: string;
  meta?: Record<string, unknown>;
}

/**
 * Wraps any async operation with timing + telemetry.
 * ALWAYS fail-open: if the wrapper itself throws, the error is still propagated
 * but telemetry failures never block the operation.
 *
 * Usage:
 *   const user = await trace('db:getUser', () => db.getUser(id), { project: 'linkchat' });
 */
export async function trace<T>(
  operation: string,
  fn: () => Promise<T>,
  options: TraceOptions = {}
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const durationMs = Date.now() - start;
    shipTrace({ operation, durationMs, outcome: 'ok', project: options.project, ...options.meta });
    return result;
  } catch (err) {
    const durationMs = Date.now() - start;
    const isFoundry = err instanceof FoundryError;
    shipTrace({
      operation,
      durationMs,
      outcome: 'error',
      project: options.project,
      errorCode: isFoundry ? err.code : 'UNKNOWN',
      ...options.meta,
    });
    throw err; // always re-throw — trace never swallows errors
  }
}

/**
 * Synchronous version for non-async operations.
 */
export function traceSync<T>(
  operation: string,
  fn: () => T,
  options: TraceOptions = {}
): T {
  const start = Date.now();
  try {
    const result = fn();
    shipTrace({ operation, durationMs: Date.now() - start, outcome: 'ok', project: options.project });
    return result;
  } catch (err) {
    shipTrace({ operation, durationMs: Date.now() - start, outcome: 'error', project: options.project });
    throw err;
  }
}
