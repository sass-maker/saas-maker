import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  probeOnce,
  runSurfaceProbe,
} from '../ops/scripts/lib/api-probe-runner.mjs';
import { buildPsiSwarmReceipt } from '../ops/scripts/lib/psi-swarm-receipt.mjs';
import {
  mapLegacyPerformanceEvent,
  percentileSet,
} from '../ops/scripts/lib/performance-evidence.mjs';

describe('api probe runner', () => {
  it('records timeout and omits fabricated DNS phases', async () => {
    const fetchImpl = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    };
    // Use a tiny timeout via controller in probeOnce
    const sample = await probeOnce('https://example.com/health', {
      timeoutMs: 1,
      fetchImpl: async (_url, init) => {
        await new Promise((_, reject) => {
          init.signal.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        });
      },
    });
    assert.equal(sample.timedOut, true);
    assert.equal(sample.timingsMs.dns, undefined);
    assert.equal(sample.timingsMs.connect, undefined);
  });

  it('refuses mutating methods', async () => {
    await assert.rejects(
      () =>
        runSurfaceProbe({
          id: 'bad',
          projectId: 'x',
          url: 'https://example.com/x',
          method: 'POST',
          expectedStatuses: [200],
        }),
      /unsafe method/
    );
  });

  it('builds cold/warm receipt via fixture fetch', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return new Response('ok', { status: 200 });
    };
    const result = await runSurfaceProbe(
      {
        id: 'saas-maker-health',
        projectId: 'saas-maker',
        url: 'https://api.sassmaker.com/health',
        method: 'GET',
        expectedStatuses: [200],
        timeoutMs: 2000,
      },
      { coldSamples: 2, warmSamples: 3, fetchImpl }
    );
    assert.equal(calls, 5);
    assert.equal(result.receipt.source, 'synthetic-api');
    assert.equal(result.receipt.sample_count, 5);
    assert.equal(result.cold.sampleCount, 2);
    assert.equal(result.warm.sampleCount, 3);
    assert.ok(result.receipt.latency_ms.p50 != null);
  });
});

describe('psi swarm receipt adapter', () => {
  it('maps distributional vitals and keeps diagnostic ref', () => {
    const receipt = buildPsiSwarmReceipt({
      projectId: 'codevetter',
      surfaceId: 'codevetter-web',
      diagnosticRef: 'swarm_01TEST',
      runs: [
        { lcpMs: 1000, inpMs: 80, cls: 0.01, observedAt: '2026-07-20T00:00:00.000Z' },
        { lcpMs: 1200, inpMs: 90, cls: 0.02, observedAt: '2026-07-20T00:01:00.000Z' },
        { lcpMs: 1400, inpMs: 100, cls: 0.02, observedAt: '2026-07-20T00:02:00.000Z' },
      ],
    });
    assert.equal(receipt.kind, 'web');
    assert.equal(receipt.source, 'psi-swarm');
    assert.equal(receipt.sample_count, 3);
    assert.equal(receipt.diagnostic_ref, 'swarm_01TEST');
    assert.ok(receipt.web_vitals.lcp_ms.p75 != null);
  });
});

describe('legacy compatibility mapping', () => {
  it('maps api_call_timing without inventing missing percentiles', () => {
    const mapped = mapLegacyPerformanceEvent(
      {
        event: 'api_call_timing',
        timestamp: '2026-07-20T00:00:00.000Z',
        properties: {
          project_id: 'saas-maker',
          route: '/v1/projects',
          sample_count: 10,
          duration_p50: 40,
          duration_p90: 90,
        },
      },
      { surfaceId: 'saas-maker-api' }
    );
    assert.equal(mapped.source.kind, 'browser-rum');
    assert.equal(mapped.metrics.totalMs.p50, 40);
    assert.equal(mapped.metrics.totalMs.p95, null);
  });
});

describe('percentiles', () => {
  it('computes stable percentile sets', () => {
    const set = percentileSet([10, 20, 30, 40, 50]);
    assert.equal(set.p50, 30);
    assert.ok(set.p95 >= 40);
  });
});
