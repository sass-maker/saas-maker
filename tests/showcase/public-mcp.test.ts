import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from '../../apps/showcase/functions/_middleware';

function call(request: Request) {
  return onRequest({
    request,
    next: () => {
      throw new Error('MCP must bypass the page handler');
    },
  } as unknown as Parameters<typeof onRequest>[0]);
}

afterEach(() => vi.unstubAllGlobals());

describe('SaaS Maker public MCP', () => {
  it('relays MCP to the fixed catalog route with protocol headers only', async () => {
    const message = { jsonrpc: '2.0', id: 7, method: 'tools/list' };
    const result = { jsonrpc: '2.0', id: 7, result: { tools: [] } };
    const gateway = vi.fn(async (_url: string, init: RequestInit) => {
      expect(await new Response(init.body).json()).toEqual(message);
      return Response.json(result, {
        headers: { 'set-cookie': 'gateway-only=1', 'x-internal': 'gateway-only' },
      });
    });
    vi.stubGlobal('fetch', gateway);

    const response = await call(
      new Request('https://sassmaker.com/mcp?target=ignored', {
        method: 'POST',
        headers: {
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json',
          'mcp-protocol-version': '2025-11-25',
          origin: 'https://chatgpt.com',
          cookie: 'first-party=1',
          'x-app-health-workspace': 'fixture',
        },
        body: JSON.stringify(message),
      })
    );

    expect(gateway).toHaveBeenCalledExactlyOnceWith(
      'https://fleet-chatgpt-connections.sarthakagrawal927.workers.dev/saas-maker/mcp',
      expect.objectContaining({ method: 'POST', redirect: 'manual' })
    );
    const headers = gateway.mock.calls[0]?.[1].headers as Headers;
    expect(Object.fromEntries(headers)).toEqual({
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      'mcp-protocol-version': '2025-11-25',
      origin: 'https://chatgpt.com',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.has('set-cookie')).toBe(false);
    expect(response.headers.has('x-internal')).toBe(false);
    expect(await response.json()).toEqual(result);
  });

  it('rejects credentials and unsupported methods without contacting the gateway', async () => {
    const gateway = vi.fn();
    vi.stubGlobal('fetch', gateway);
    const url = 'https://sassmaker.com/mcp';
    expect((await call(new Request(url))).status).toBe(405);
    expect(
      (
        await call(
          new Request(url, {
            method: 'POST',
            headers: { authorization: 'Bearer fixture-only' },
          })
        )
      ).status
    ).toBe(400);
    expect(gateway).not.toHaveBeenCalled();
  });

  it('preserves a credential-free preflight without introducing a body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(null, {
            status: 204,
            headers: { 'access-control-allow-origin': 'https://chatgpt.com', vary: 'Origin' },
          })
      )
    );
    const response = await call(
      new Request('https://sassmaker.com/mcp', {
        method: 'OPTIONS',
        headers: { origin: 'https://chatgpt.com' },
      })
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://chatgpt.com');
    expect(response.body).toBeNull();
  });

  it('rejects redirects without exposing the upstream Location', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(null, {
            status: 302,
            headers: { location: 'https://example.invalid/other-mcp' },
          })
      )
    );
    const response = await call(new Request('https://sassmaker.com/mcp', { method: 'POST' }));
    expect(response.status).toBe(502);
    expect(response.headers.has('location')).toBe(false);
  });

  it('returns a bounded failure without returning upstream transport details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('upstream details');
      })
    );
    const response = await call(new Request('https://sassmaker.com/mcp', { method: 'POST' }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: 'The SaaS Maker MCP service is temporarily unavailable.',
    });
  });
});
