import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from '../../apps/showcase/functions/_middleware';

// Deliberately URL-only: Cloudflare's Cache API does not use Vary: Accept
// as a representation key. A Vary-aware double would hide the original bug.
class UrlCache {
  entries = new Map<string, Response>();
  keys: Request[] = [];
  async match(key: Request) {
    return this.entries.get(key.url)?.clone();
  }
  async put(key: Request, value: Response) {
    this.keys.push(key);
    this.entries.set(key.url, value.clone());
  }
}
const site = 'https://sassmaker.com';
let calls = 0;
let assetRequests: Request[] = [];
function context(
  request: Request,
  generation = 'a'.repeat(64),
  status = 200,
  extra = {},
  markdownFailure: 'missing' | 'throw' | null = null
) {
  const asset = (input: Request) => {
    calls++;
    assetRequests.push(input);
    if (new URL(input.url).pathname === '/public-cache-generation.txt') {
      return Promise.resolve(new Response(generation));
    }
    const markdown = new URL(input.url).pathname.endsWith('.md');
    if (markdown && markdownFailure === 'throw') {
      return Promise.reject(new Error('Markdown asset unavailable'));
    }
    if (markdown && markdownFailure === 'missing') {
      return Promise.resolve(
        new Response('<html>soft 404</html>', { headers: { 'content-type': 'text/html' } })
      );
    }
    return Promise.resolve(
      new Response(markdown ? '# public brief' : '<html>public home</html>', {
        status,
        headers: { 'content-type': markdown ? 'text/markdown' : 'text/html', ...extra },
      })
    );
  };
  return {
    request,
    env: { ASSETS: { fetch: asset } },
    next: (input?: Request) => asset(input || request),
  } as unknown as Parameters<typeof onRequest>[0];
}
async function respond(
  accept = 'text/html',
  options: RequestInit = {},
  path = '/',
  generation = 'a'.repeat(64),
  status = 200,
  extra = {},
  markdownFailure: 'missing' | 'throw' | null = null
) {
  return onRequest(
    context(
      new Request(site + path, { ...options, headers: { accept, ...options.headers } }),
      generation,
      status,
      extra,
      markdownFailure
    )
  );
}
afterEach(() => {
  vi.unstubAllGlobals();
  calls = 0;
  assetRequests = [];
});
describe('public home representation cache', () => {
  it('does not send caller credentials to the public Markdown asset or cache their response', async () => {
    const cache = new UrlCache();
    vi.stubGlobal('caches', { default: cache });
    const response = await respond(
      'text/markdown',
      {
        headers: { authorization: 'Bearer fixture', cookie: 'session=fixture' },
      },
      '/?token=fixture'
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/markdown');
    expect(await response.text()).toContain('# public brief');
    const markdownLookup = assetRequests.find(
      (input) => new URL(input.url).pathname === '/index.md'
    );
    expect(markdownLookup).toBeDefined();
    expect(markdownLookup?.headers.has('authorization')).toBe(false);
    expect(markdownLookup?.headers.has('cookie')).toBe(false);
    expect(new URL(markdownLookup?.url || site).search).toBe('');
    expect(cache.entries.size).toBe(0);
  });
  for (const failure of ['missing', 'throw'] as const) {
    it(`fails closed as uncached Markdown when the root mirror is ${failure}`, async () => {
      const cache = new UrlCache();
      vi.stubGlobal('caches', { default: cache });
      const response = await respond('text/markdown', {}, '/', 'a'.repeat(64), 200, {}, failure);
      expect(response.status).toBe(503);
      expect(response.headers.get('content-type')).toContain('text/markdown');
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(response.headers.get('cdn-cache-control')).toBe('no-store');
      expect(response.headers.get('vary')).toContain('Accept');
      expect(await response.text()).toContain('# Markdown temporarily unavailable');
      expect(cache.entries.size).toBe(0);
    });
  }
  for (const order of [
    ['text/html', 'text/markdown'],
    ['text/markdown', 'text/html'],
  ]) {
    it(`separates cold and warm ${order.join(' then ')} using URL keys`, async () => {
      const cache = new UrlCache();
      vi.stubGlobal('caches', { default: cache });
      for (const [index, accept] of [...order, ...order].entries()) {
        const response = await respond(accept);
        expect(response.status).toBe(200);
        expect(response.headers.get('x-edge-cache')).toBe(index < 2 ? 'MISS' : 'HIT');
        expect(response.headers.get('content-type')).toContain(accept);
        expect(response.headers.get('vary')).toContain('Accept');
        expect(response.headers.get('cache-control')).toContain('no-store');
        expect(response.headers.get('cloudflare-cdn-cache-control')).toBe('no-store');
        expect(await response.text()).toContain(accept === 'text/html' ? '<html>' : '# public');
      }
      expect(cache.entries.size).toBe(2);
      expect(cache.keys.every((key) => !key.headers.has('accept'))).toBe(true);
      // warm requests do not touch the asset server
      expect(calls).toBe(6);
    });
  }
  it('resolves cold HEAD as GET, warms full bodies and strips warm HEAD bodies', async () => {
    const cache = new UrlCache();
    vi.stubGlobal('caches', { default: cache });
    for (const accept of ['text/html', 'text/markdown']) {
      const head = await respond(accept, { method: 'HEAD' });
      expect(head.body).toBeNull();
      const get = await respond(accept);
      expect(get.headers.get('content-type')).toBe(head.headers.get('content-type'));
      expect(await get.text()).not.toBe('');
      const warmHead = await respond(accept, { method: 'HEAD' });
      expect(warmHead.body).toBeNull();
      expect(warmHead.status).toBe(get.status);
    }
    expect(cache.entries.size).toBe(2);
  });
  it('isolates deployment generations and bypasses an absent identity', async () => {
    const cache = new UrlCache();
    vi.stubGlobal('caches', { default: cache });
    await respond();
    await respond('text/html', {}, '/', 'b'.repeat(64));
    expect(cache.entries.size).toBe(2);
    const before = calls;
    await respond('text/html', {}, '/', '');
    await respond('text/html', {}, '/', '');
    expect(calls).toBeGreaterThan(before + 1);
    expect(cache.entries.size).toBe(2);
  });
  for (const headers of [
    { cookie: 'session=local-fixture' },
    { authorization: 'Bearer local-fixture' },
    { 'cf-access-jwt-assertion': 'local-fixture' },
    { range: 'bytes=0-4' },
    { 'if-none-match': 'fixture' },
    { 'cache-control': 'no-cache' },
  ] as Record<string, string>[]) {
    it(`bypasses even a warm cache for ${Object.keys(headers)[0]}`, async () => {
      const cache = new UrlCache();
      vi.stubGlobal('caches', { default: cache });
      await respond();
      const before = calls;
      await respond('text/html', { headers: headers as Record<string, string> });
      const bypass = await respond('text/html', { headers: headers as Record<string, string> });
      expect(bypass.headers.get('x-edge-cache')).toBe('BYPASS');
      expect(calls).toBeGreaterThan(before + 1);
      expect(cache.keys).toHaveLength(1);
    });
  }
  for (const extra of [
    { 'set-cookie': 'session=fixture; HttpOnly' },
    { 'cache-control': 'private' },
    { 'cdn-cache-control': 'no-store' },
    { 'cloudflare-cdn-cache-control': 'private' },
    { 'content-encoding': 'gzip' },
    { 'cache-control': 'no-store' },
    { 'cache-control': 'no-cache' },
    { 'cache-control': 'public, s-maxage=0' },
    { vary: 'Cookie' },
    { vary: '*' },
    { 'content-type': 'application/json' },
  ]) {
    it(`does not store response policy ${JSON.stringify(extra)}`, async () => {
      const cache = new UrlCache();
      vi.stubGlobal('caches', { default: cache });
      await respond('text/html', {}, '/', 'a'.repeat(64), 200, extra);
      expect(cache.entries.size).toBe(0);
    });
  }
  for (const status of [401, 403, 404, 429, 500]) {
    it(`never stores ${status}`, async () => {
      const cache = new UrlCache();
      vi.stubGlobal('caches', { default: cache });
      expect((await respond('text/html', {}, '/', 'a'.repeat(64), status)).status).toBe(status);
      expect(cache.entries.size).toBe(0);
    });
  }
  it('leaves non-root routes, explicit public formats, APIs and mutations outside this cache', async () => {
    const cache = new UrlCache();
    vi.stubGlobal('caches', { default: cache });
    for (const path of [
      '/dashboard',
      '/login',
      '/api/auth/verify',
      '/index.md',
      '/api/ai',
      '/llms.txt',
      '/?preview=1',
    ]) {
      await respond('text/html', {}, path);
      await respond('text/markdown', { method: 'HEAD' }, path);
    }
    await respond('text/html', { method: 'POST' });
    expect(cache.entries.size).toBe(0);
  });
  it('serves normally when Cache API read or write fails', async () => {
    vi.stubGlobal('caches', {
      default: {
        match: () => {
          throw new Error('unavailable');
        },
        put: () => {
          throw new Error('unavailable');
        },
      },
    });
    expect((await respond()).status).toBe(200);
  });
});
