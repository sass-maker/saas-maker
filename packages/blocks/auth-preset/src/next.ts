/**
 * Next.js App Router route handler glue.
 *
 * Usage:
 * ```ts
 * // app/api/auth/[...all]/route.ts
 * import { createAuth } from '@saas-maker/auth-preset';
 * import { toNextHandler } from '@saas-maker/auth-preset/next';
 * import * as schema from '@/lib/auth-schema';
 *
 * const auth = createAuth({ d1: env.DB, schema });
 * export const { GET, POST } = toNextHandler(auth);
 * ```
 */

import type { FoundryAuth } from './index.js';

type WebHandler = (req: Request) => Promise<Response> | Response;

export function toNextHandler(auth: FoundryAuth): { GET: WebHandler; POST: WebHandler } {
  // better-auth exposes a `handler` Web-fetch-style function.
  const handler: WebHandler = (req: Request) => auth.handler(req);
  return { GET: handler, POST: handler };
}
