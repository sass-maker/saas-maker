import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createRuntimeAdapter,
  normalizeRouteTemplate,
  statusClass,
} from '../internal/performance-runtime/index.ts';

describe('runtime adapter', () => {
  it('normalizes dynamic route segments', () => {
    assert.equal(
      normalizeRouteTemplate('/v1/items/550e8400-e29b-41d4-a716-446655440000?x=1'),
      '/v1/items/:id'
    );
    assert.equal(normalizeRouteTemplate('/v1/items/12345'), '/v1/items/:id');
  });

  it('classifies status classes', () => {
    assert.equal(statusClass(204), '2xx');
    assert.equal(statusClass(404), '4xx');
    assert.equal(statusClass(500), '5xx');
  });

  it('does not fail product path when delivery errors', async () => {
    let called = 0;
    const fetchImpl = async () => {
      called += 1;
      throw new Error('network down');
    };
    const adapter = createRuntimeAdapter({
      projectId: 'sass-maker',
      surface: 'sass-maker-api',
      ingestBaseUrl: 'https://api.sassmaker.com',
      apiKey: 'pk_test',
      successSampleRate: 1,
      random: () => 0,
      fetchImpl,
    });

    const delivery = adapter.recordRequest({
      method: 'GET',
      routeTemplate: '/v1/projects',
      status: 200,
      durationMs: 42,
    });
    assert.ok(delivery);
    await delivery;
    assert.equal(called, 1);
  });

  it('always samples errors and slow requests when configured', async () => {
    let called = 0;
    const fetchImpl = async () => {
      called += 1;
      return new Response('{}', { status: 201 });
    };
    const adapter = createRuntimeAdapter({
      projectId: 'sass-maker',
      surface: 'sass-maker-api',
      ingestBaseUrl: 'https://api.sassmaker.com',
      apiKey: 'pk_test',
      successSampleRate: 0,
      sampleErrors: true,
      slowThresholdMs: 100,
      random: () => 0.5,
      fetchImpl,
    });

    await adapter.recordRequest({
      method: 'GET',
      routeTemplate: '/v1/projects',
      status: 500,
      durationMs: 10,
    });
    await adapter.recordRequest({
      method: 'GET',
      routeTemplate: '/v1/projects',
      status: 200,
      durationMs: 250,
    });
    const skipped = adapter.recordRequest({
      method: 'GET',
      routeTemplate: '/v1/projects',
      status: 200,
      durationMs: 10,
    });
    assert.equal(skipped, null);
    assert.equal(called, 2);
  });

  it('rejects unsanitized downstream fingerprints before delivery', () => {
    const adapter = createRuntimeAdapter({
      projectId: 'sass-maker',
      surface: 'sass-maker-api',
      ingestBaseUrl: 'https://api.sassmaker.com',
      apiKey: 'pk_test',
      successSampleRate: 1,
      random: () => 0,
    });
    assert.throws(
      () =>
        adapter.recordRequest({
          method: 'GET',
          routeTemplate: '/v1/projects',
          status: 200,
          durationMs: 42,
          operations: [
            {
              kind: 'd1',
              label: 'projects.list',
              fingerprint: 'SELECT * FROM projects',
              duration_ms: 10,
              success: true,
            },
          ],
        }),
      /sanitized fp_ hash/
    );
  });
});
