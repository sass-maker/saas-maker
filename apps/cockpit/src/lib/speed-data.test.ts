import { describe, expect, it } from 'vitest';

import { buildSpeedSnapshot, createUnavailableSpeedSnapshot } from './speed-data';

const NOW = new Date('2026-07-20T12:00:00.000Z');

describe('speed evidence adapter', () => {
  it('never substitutes populated sample data when evidence is unavailable', () => {
    const snapshot = createUnavailableSpeedSnapshot(NOW);
    expect(snapshot.boundary.mode).toBe('unavailable');
    expect(snapshot.routes).toEqual([]);
    expect(snapshot.recentRequests).toEqual([]);
    expect(snapshot.surfaces.length).toBeGreaterThan(20);
    expect(snapshot.surfaces.every((surface) => !surface.api && !surface.web)).toBe(true);
  });

  it('maps live receipts, route windows, and sanitized operations without merging sources', () => {
    const snapshot = buildSpeedSnapshot(
      {
        receipts: [
          {
            project_id: 'sass-maker',
            kind: 'api',
            surface: 'sass-maker-api',
            environment: 'production',
            source: 'synthetic-api',
            window_start: '2026-07-20T10:00:00.000Z',
            window_end: '2026-07-20T11:00:00.000Z',
            sample_count: 20,
            error_count: 0,
            latency_ms: { p50: 40, p75: 60, p95: 120, p99: 180 },
          },
        ],
        routeWindows: {
          '1h': [],
          '24h': [
            {
              project_id: 'sass-maker',
              surface: 'sass-maker-api',
              environment: 'production',
              source: 'server-runtime',
              method: 'GET',
              route_template: '/v1/projects/:id',
              sample_count: 10,
              error_count: 1,
              error_rate: 0.1,
              latency_ms: { p50: 20, p75: 30, p95: 90, p99: 150 },
              last_seen: '2026-07-20T11:30:00.000Z',
            },
          ],
          '7d': [],
        },
        truncatedWindows: ['24h'],
        spans: [
          {
            project_id: 'sass-maker',
            source: 'server-runtime',
            observed_at: '2026-07-20T11:30:00.000Z',
            trace_id: 'tr_abc12345',
            method: 'GET',
            route_template: '/v1/projects/:id',
            status_class: '2xx',
            duration_ms: 88,
          },
        ],
        operationsByTrace: {
          tr_abc12345: [
            {
              kind: 'd1',
              label: 'projects.by-id',
              fingerprint: 'fp_12345678',
              duration_ms: 42,
              success: true,
            },
          ],
        },
      },
      NOW
    );
    expect(snapshot.boundary.mode).toBe('provider-api');
    expect(snapshot.boundary.truncatedWindows).toEqual(['24h']);
    expect(snapshot.boundary.message).toContain('newest query slice');
    expect(snapshot.routes).toHaveLength(1);
    expect(snapshot.routes[0]?.source).toBe('foundry-runtime');
    expect(snapshot.routes[0]?.metrics['24h'].errorRate).toBe(10);
    expect(snapshot.routes[0]?.lastSeen).toBe('2026-07-20T11:30:00.000Z');
    expect(snapshot.recentRequests[0]?.operations[0]).toMatchObject({
      label: 'projects.by-id',
      fingerprint: 'fp_12345678',
    });
    expect(snapshot.surfaces.find((surface) => surface.id === 'sass-maker-api')?.api).toBeTruthy();
  });
});
