import { afterEach, describe, expect, it, vi } from 'vitest';

import { onRequestPost } from './advisor';

const body = {
  domain: 'example.com',
  currentDr: 42,
  trend: { direction: 'up', delta: 2, periodDays: 7 },
};

function request(payload: unknown = body) {
  return new Request('https://drank.example/api/advisor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

const validAdvice = {
  schemaVersion: 1,
  why: 'The observed DR and upward trend suggest authority is improving, but the cause is unknown.',
  evidenceLimit: 'Only DR and trend were observed; backlinks and site content were not inspected.',
  actions: [
    {
      priority: 1,
      title: 'Publish original research',
      reason: 'Useful original data gives relevant publishers a reason to cite the domain.',
    },
    {
      priority: 2,
      title: 'Reclaim relevant mentions',
      reason: 'Legitimate unlinked mentions may become editorial citations with focused outreach.',
    },
    {
      priority: 3,
      title: 'Strengthen useful resources',
      reason: 'Durable reference pages are more likely to earn relevant links over time.',
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/advisor', () => {
  it('returns validated advice from the configured gateway', async () => {
    const gatewayFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify(validAdvice) } }] }),
          { status: 200 }
        )
      );
    vi.stubGlobal('fetch', gatewayFetch);

    const response = await onRequestPost({
      request: request(),
      env: { FREE_AI_GATEWAY_API_KEY: 'test-key', FREE_AI_BASE_URL: 'https://gateway.test/' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ advice: validAdvice });
    expect(gatewayFetch).toHaveBeenCalledWith(
      'https://gateway.test/v1/chat/completions',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('fails closed when gateway configuration is missing', async () => {
    const gatewayFetch = vi.fn();
    vi.stubGlobal('fetch', gatewayFetch);
    const response = await onRequestPost({ request: request(), env: {} });
    expect(response.status).toBe(503);
    expect(gatewayFetch).not.toHaveBeenCalled();
  });

  it('rejects invalid input before calling the provider', async () => {
    const gatewayFetch = vi.fn();
    vi.stubGlobal('fetch', gatewayFetch);
    const response = await onRequestPost({
      request: request({ ...body, currentDr: -1 }),
      env: { GATEWAY_API_KEY: 'test-key' },
    });
    expect(response.status).toBe(400);
    expect(gatewayFetch).not.toHaveBeenCalled();
  });

  it('preserves a retryable failure when the provider is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', { status: 500 })));
    const response = await onRequestPost({
      request: request(),
      env: { GATEWAY_API_KEY: 'test-key' },
    });
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ retryable: true });
  });

  it('rejects invalid provider JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: '{"why":"no"}' } }] }), {
          status: 200,
        })
      )
    );
    const response = await onRequestPost({
      request: request(),
      env: { GATEWAY_API_KEY: 'test-key' },
    });
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ retryable: true });
  });
});
