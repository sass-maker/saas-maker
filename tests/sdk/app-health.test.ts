import { describe, expect, it, vi } from 'vitest';
import {
  createAppHealth,
  normalizeAppHealthRoute,
  type ExpressCompatibleMiddleware,
} from '../../packages/blocks/sdk/src/app-health';

describe('App Health Node SDK', () => {
  it('sends key-scoped privacy-safe spans to the canonical endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
    const ids = ['event-1', 'trace-1'];
    const client = createAppHealth({
      apiKey: 'pk_test',
      release: 'abc123',
      fetch: fetchMock,
      now: () => Date.parse('2026-07-20T12:00:00.000Z'),
      randomUUID: () => ids.shift()!,
      disableTimer: true,
    });

    client.record({
      method: 'get',
      route: '/users/01965b0c-7d8f-7abc-8def-1234567890ab?token=secret',
      statusCode: 200,
      durationMs: 42.4,
    });
    await client.flush();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.sassmaker.com/v1/performance/spans');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      'X-Project-Key': 'pk_test',
    });
    expect(init.redirect).toBe('error');
    const body = JSON.parse(String(init.body));
    expect(body.spans[0]).toMatchObject({
      idempotency_key: 'event-1',
      trace_id: 'trace-1',
      method: 'GET',
      route_template: '/users/:id',
      status_class: '2xx',
      duration_ms: 42,
      revision: 'abc123',
    });
    expect(body.spans[0]).not.toHaveProperty('project_id');
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('keeps delivery bounded and exposes failures through diagnostics', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 400 }));
    const client = createAppHealth({
      apiKey: 'pk_test',
      fetch: fetchMock,
      maxQueueSize: 1,
      maxRetries: 3,
      disableTimer: true,
    });
    client.record({ method: 'GET', route: '/one', statusCode: 200, durationMs: 1 });
    client.record({ method: 'GET', route: '/two', statusCode: 200, durationMs: 1 });
    await client.flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(client.diagnostics()).toMatchObject({
      droppedOverflow: 1,
      droppedDelivery: 1,
      failedBatches: 1,
    });
  });

  it('flushes accepted events during close and makes close idempotent', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
    const client = createAppHealth({ apiKey: 'pk_test', fetch: fetchMock, disableTimer: true });
    client.record({ method: 'POST', route: '/jobs/:id', statusCode: 202, durationMs: 10 });

    const first = client.close();
    const second = client.close();
    await Promise.all([first, second]);

    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(client.diagnostics()).toMatchObject({ queued: 0, sent: 1 });
  });

  it('records Express templates after finish without blocking next', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
    const client = createAppHealth({ apiKey: 'pk_test', fetch: fetchMock, disableTimer: true });
    const middleware: ExpressCompatibleMiddleware = client.expressMiddleware();
    let finish: (() => void) | undefined;
    const next = vi.fn();
    middleware(
      { method: 'GET', baseUrl: '/v1', route: { path: '/users/:id' } },
      {
        statusCode: 204,
        on: (_event, listener) => {
          finish = listener;
        },
      },
      next
    );

    expect(next).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
    finish?.();
    await client.flush();

    const body = JSON.parse(String((fetchMock.mock.calls[0]![1] as RequestInit).body));
    expect(body.spans[0]).toMatchObject({
      method: 'GET',
      route_template: '/v1/users/:id',
      status_class: '2xx',
    });
  });

  it('drops unmatched Express requests instead of recording their raw path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
    const client = createAppHealth({ apiKey: 'pk_test', fetch: fetchMock, disableTimer: true });
    const middleware = client.expressMiddleware();
    let finish: (() => void) | undefined;

    middleware(
      {
        method: 'GET',
        path: '/reset/alice@example.com',
        url: '/reset/alice@example.com?token=secret',
      },
      {
        statusCode: 404,
        on: (_event, listener) => {
          finish = listener;
        },
      },
      () => undefined
    );
    finish?.();
    await client.flush();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.diagnostics().droppedInvalid).toBe(1);
  });

  it('normalizes dynamic fallback segments and rejects unbounded routes', () => {
    expect(normalizeAppHealthRoute('/orders/123456?email=a@b.com')).toBe('/orders/:id');
    expect(normalizeAppHealthRoute('/files/abcdef0123456789')).toBe('/files/:id');
    expect(normalizeAppHealthRoute('orders/1')).toBeNull();
    expect(normalizeAppHealthRoute(`/${'x'.repeat(201)}`)).toBeNull();
  });

  it('trims keys and rejects environments the API cannot accept', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
    const client = createAppHealth({
      apiKey: '  pk_test  ',
      fetch: fetchMock,
      disableTimer: true,
    });
    client.record({ method: 'GET', route: '/health', statusCode: 200, durationMs: 1 });
    await client.flush();

    expect((fetchMock.mock.calls[0]![1] as RequestInit).headers).toMatchObject({
      'X-Project-Key': 'pk_test',
    });
    expect(() => createAppHealth({ apiKey: 'pk_test', environment: 'qa' as 'production' })).toThrow(
      /environment is invalid/
    );
    expect(() =>
      createAppHealth({ apiKey: 'pk_test', ingestUrl: 'http://example.com/spans' })
    ).toThrow(/loopback-only/);
  });
});
