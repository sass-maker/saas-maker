import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkerHealthBuffer } from '../../workers/api/src/lib/app-health-buffer';
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const options = {
  key: 'synthetic',
  endpoint: 'https://ingest.test/v1/ingest',
  runtime: 'worker' as const,
  disableTimer: true,
  maxBatchSize: 100,
  maxQueueSize: 100,
  maxRetries: 0,
};
const event = {
  method: 'GET',
  route: '/v1/capture-config/:catalogId',
  status_code: 200,
  duration_ms: 2,
};
describe('Worker cross-request telemetry batching', () => {
  it('delivers all 200 events in four batches with their observation timestamps', async () => {
    const bodies: Array<{ events: Array<{ timestamp: number }> }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        bodies.push(JSON.parse(init.body));
        return new Response(null, { status: 202 });
      })
    );
    const buffered = createWorkerHealthBuffer();
    const env = {};
    const pending = [];
    const observedAt = Date.now();
    for (let i = 0; i < 200; i++) {
      const client = buffered(env, options);
      client.record(event);
      pending.push(client.flush());
    }
    await vi.advanceTimersByTimeAsync(5000);
    await Promise.all(pending);
    expect(bodies).toHaveLength(4);
    expect(bodies.flatMap((body) => body.events)).toHaveLength(200);
    expect(bodies.every((body) => body.events.length === 50)).toBe(true);
    expect(bodies.flatMap((body) => body.events).every((row) => row.timestamp === observedAt)).toBe(
      true
    );
  });
  it('flushes a partial batch when traffic stops and isolates separate environments', async () => {
    const send = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', send);
    const buffered = createWorkerHealthBuffer();
    const first = buffered({}, options);
    const second = buffered({}, options);
    first.record(event);
    second.record(event);
    const pending = [first.flush(), second.flush()];
    expect(send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    await Promise.all(pending);
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('schedules arrivals during an in-flight partial drain, with no shared delivery promise', async () => {
    const bodies: unknown[] = [];
    let release: () => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        bodies.push(JSON.parse(init.body));
        if (bodies.length === 1)
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        return new Response(null, { status: 202 });
      })
    );
    const buffered = createWorkerHealthBuffer();
    const env = {};
    const first = buffered(env, options);
    first.record(event);
    const firstDelivery = first.flush();
    await vi.advanceTimersByTimeAsync(5000);
    const second = buffered(env, options);
    second.record(event);
    const secondDelivery = second.flush();
    await vi.advanceTimersByTimeAsync(5000);
    release();
    await Promise.all([firstDelivery, secondDelivery]);
    expect(bodies).toHaveLength(2);
  });
});
