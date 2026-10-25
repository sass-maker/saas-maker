import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetchClient, getClientToken } from '../../apps/cockpit/src/lib/api-client';
import { getProjectBySlug } from '../../apps/cockpit/src/lib/server-api';
import { API_FALLBACK_BASES } from '../../apps/cockpit/src/lib/api-base';

vi.mock('server-only', () => ({}));

afterEach(() => vi.unstubAllGlobals());

describe('cockpit resource requests', () => {
  it.each([
    400, 401, 403, 404, 429, 500, 503,
  ])('preserves HTTP %i for resource retry policy', async (status) => {
    const fetch = vi.fn().mockResolvedValue(new Response('request failed', { status }));
    vi.stubGlobal('fetch', fetch);
    await expect(apiFetchClient('/v1/projects', 'test-session')).rejects.toMatchObject({ status });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('preserves network errors so useResource can retry them', async () => {
    const error = new TypeError('Failed to fetch');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
    await expect(apiFetchClient('/v1/projects', 'test-session')).rejects.toBe(error);
  });

  it('retains the Cloudflare origin fallback', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('origin unavailable', { status: 530 }))
      .mockResolvedValue(new Response(JSON.stringify({ data: [] })));
    vi.stubGlobal('fetch', fetch);
    await expect(apiFetchClient('/v1/projects', 'test-session')).resolves.toEqual({ data: [] });
    expect(fetch).toHaveBeenCalledTimes(API_FALLBACK_BASES.length);
  });

  it('passes cancellation to token and data requests without retrying an abort', async () => {
    const controller = new AbortController();
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ token: 'test-session' })));
    vi.stubGlobal('fetch', fetch);
    await getClientToken(controller.signal);
    expect(fetch).toHaveBeenCalledWith('/api/token', { signal: controller.signal });
    fetch.mockClear().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    await expect(
      apiFetchClient('/v1/projects', 'test-session', { signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('preserves authentication failures as HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    await expect(getClientToken()).rejects.toMatchObject({ status: 401 });
  });

  it('returns not-found only when the project API explicitly returns 404', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('missing', { status: 404 }));
    vi.stubGlobal('fetch', fetch);
    await expect(getProjectBySlug('missing', 'test-session')).resolves.toBeNull();
    fetch.mockResolvedValue(new Response('unavailable', { status: 503 }));
    await expect(getProjectBySlug('existing', 'test-session')).rejects.toMatchObject({
      status: 503,
    });
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(getProjectBySlug('existing', 'test-session')).rejects.toBeInstanceOf(TypeError);
  });
});
