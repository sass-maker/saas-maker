import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCacheKey, tryCacheMatch, withCachePut } from '../../workers/api/src/edge-cache';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('authenticated edge cache responses', () => {
  it('keeps the Cache API clone cacheable while marking the client response private', async () => {
    let stored: Response | undefined;
    const cache = {
      match: vi.fn().mockResolvedValue(undefined),
      put: vi.fn(async (_key: string, response: Response) => {
        stored = response;
      }),
    };
    vi.stubGlobal('caches', { default: cache });
    const pending: Promise<unknown>[] = [];
    const context = {
      executionCtx: {
        waitUntil(promise: Promise<unknown>) {
          pending.push(promise);
        },
      },
    } as Parameters<typeof withCachePut>[0];

    const outbound = withCachePut(
      context,
      buildCacheKey('feedback/aggregate', 'user-1:v1'),
      Response.json({ private: true }),
      60
    );
    await Promise.all(pending);

    expect(outbound.headers.get('Cache-Control')).toBe('private, no-store');
    expect(outbound.headers.get('X-Edge-Cache')).toBe('MISS');
    expect(await outbound.json()).toEqual({ private: true });
    expect(stored?.headers.get('Cache-Control')).toBe('public, max-age=0, s-maxage=60');
    expect(await stored?.json()).toEqual({ private: true });
  });

  it('marks Cache API hits private before returning them to the client', async () => {
    const cache = {
      match: vi
        .fn()
        .mockResolvedValue(
          Response.json({ private: true }, { headers: { 'Cache-Control': 'public, s-maxage=60' } })
        ),
      put: vi.fn(),
    };
    vi.stubGlobal('caches', { default: cache });

    const hit = await tryCacheMatch(buildCacheKey('projects/list', 'user-1:dashboard:v1'));

    expect(hit?.headers.get('Cache-Control')).toBe('private, no-store');
    expect(hit?.headers.get('X-Edge-Cache')).toBe('HIT');
    expect(await hit?.json()).toEqual({ private: true });
  });

  it('keeps authenticated users in distinct internal cache keys', () => {
    expect(buildCacheKey('feedback/aggregate', 'user-1:v1')).not.toBe(
      buildCacheKey('feedback/aggregate', 'user-2:v1')
    );
  });
});
