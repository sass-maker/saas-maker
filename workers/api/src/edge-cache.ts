import type { AppContext } from './types';

// Shared `caches.default` wrapper for read-heavy GET handlers. Used by
// feedback and project list endpoints where the underlying D1 query is the
// warm-path bottleneck.
//
// Constraints:
// - NEVER cache responses that depend on a per-user session unless the
//   key includes the userId.
// - Cache keys are versioned via the `:v1` suffix in the caller; bump
//   the suffix to invalidate stale entries after shape changes.

const DEFAULT_TTL_SECONDS = 60;

function getEdgeCache(): Cache | undefined {
  if (typeof caches === 'undefined') return undefined;
  return (caches as unknown as { default?: Cache }).default;
}

/**
 * Try `caches.default.match(cacheKey)`. Returns the cached response
 * with `X-Edge-Cache: HIT` set, or `null` on miss / runtime where the
 * Cache API is not available (e.g. test).
 */
export async function tryCacheMatch(cacheKey: string): Promise<Response | null> {
  const edgeCache = getEdgeCache();
  if (!edgeCache) return null;
  try {
    const cached = await edgeCache.match(cacheKey);
    if (!cached) return null;
    const hit = new Response(cached.body, cached);
    hit.headers.set('X-Edge-Cache', 'HIT');
    return hit;
  } catch {
    return null;
  }
}

/**
 * Store `response` in `caches.default` under `cacheKey` with a public
 * `s-maxage`. Uses `ctx.waitUntil` so the put doesn't block the
 * response. Returns a fresh `Response` clone the caller should send
 * back to the client (with `X-Edge-Cache: MISS`).
 */
export function withCachePut(
  c: AppContext,
  cacheKey: string,
  response: Response,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Response {
  const edgeCache = getEdgeCache();
  const cacheable = new Response(response.body, response);
  cacheable.headers.set('Cache-Control', `public, max-age=0, s-maxage=${ttlSeconds}`);
  cacheable.headers.set('X-Edge-Cache', 'MISS');
  if (edgeCache) {
    try {
      c.executionCtx.waitUntil(edgeCache.put(cacheKey, cacheable.clone()));
    } catch {
      // Non-fatal — serving the response without caching.
    }
  }
  return cacheable;
}

/**
 * Build a cache URL safe to use as a key. Includes a scope segment
 * (e.g. project id) plus a stable version suffix the caller controls.
 */
export function buildCacheKey(scope: string, suffix: string): string {
  return `https://saasmaker-cache.internal/${scope}/${suffix}`;
}
