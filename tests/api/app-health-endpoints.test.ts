import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import app from '../../workers/api/src/index';
import type { Bindings } from '../../workers/api/src/types';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function dispatch(path: string, key?: string) {
  const pending: Promise<unknown>[] = [];
  const executionCtx = {
    waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;
  const env = {
    APP_BASE_URL: 'https://app.sassmaker.com',
    CORS_ORIGIN: 'https://app.sassmaker.com',
    DB: {
      prepare: () => ({ bind: () => ({ first: async () => null }) }),
    } as unknown as D1Database,
    FEEDBACK_IMAGES: {} as R2Bucket,
    ...(key ? { APP_HEALTH_INGEST_KEY: key } : {}),
  } satisfies Bindings;
  const response = app.fetch(new Request(`https://api.sassmaker.com${path}`), env, executionCtx);
  return { response, pending };
}

describe('SaaS Maker API endpoint health', () => {
  it('records a matched route template and status without request content', async () => {
    const send = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', send);
    const { response, pending } = dispatch(
      '/v1/capture-config/private-project-id?email=private@example.com',
      'synthetic-test-ingest-key'
    );

    expect((await response).status).toBe(404);
    await vi.advanceTimersByTimeAsync(5000);
    await Promise.all(pending);
    expect(send).toHaveBeenCalledTimes(1);
    const [endpoint, options] = send.mock.calls[0] as unknown as [string, RequestInit];
    expect(endpoint).toBe('https://ingest.sassmaker.com/v1/ingest');
    const body = JSON.parse(String(options.body));
    expect(body.runtime).toBe('worker');
    expect(body.environment).toBe('production');
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({
      method: 'GET',
      route: '/v1/capture-config/:catalogId',
      status_code: 404,
    });
    expect(JSON.stringify(body)).not.toContain('private-project-id');
    expect(JSON.stringify(body)).not.toContain('private@example.com');
    expect(JSON.stringify(body)).not.toContain('synthetic-test-ingest-key');
  });

  it('does not send without an ingest binding or for health and OpenAPI reads', async () => {
    const send = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', send);
    const missingKey = dispatch('/v1/projects/private-project-id');
    expect((await missingKey.response).status).toBe(401);
    expect(missingKey.pending).toHaveLength(0);

    for (const path of ['/health', '/openapi.json']) {
      const excluded = dispatch(path, 'synthetic-test-ingest-key');
      expect((await excluded.response).status).toBe(200);
      expect(excluded.pending).toHaveLength(0);
    }
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps API responses independent of ingest delivery failure', async () => {
    let finishDelivery!: (response: Response) => void;
    const send = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finishDelivery = resolve;
        })
    );
    vi.stubGlobal('fetch', send);
    const { response, pending } = dispatch('/v1/projects/private-project-id', 'synthetic-key');
    expect((await response).status).toBe(401);
    expect(pending).toHaveLength(1);
    expect(send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    expect(send).toHaveBeenCalledTimes(1);

    finishDelivery(new Response(null, { status: 403 }));
    await expect(Promise.all(pending)).resolves.toHaveLength(1);
  });
});
