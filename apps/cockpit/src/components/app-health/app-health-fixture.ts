import type { ApiRouteRollup, RecentRequestSpan, SpeedSnapshot } from '@/lib/speed-data';

const empty = {
  p50: null,
  p75: null,
  p95: null,
  p99: null,
  requestCount: 0,
  errorRate: 0,
  throughputPerMinute: 0,
};

function route(
  input: Pick<ApiRouteRollup, 'id' | 'projectId' | 'method' | 'routeTemplate'> & {
    requests: number;
    p50: number;
    p95: number;
    errorRate: number;
    lastSeen: string;
  }
): ApiRouteRollup {
  const daily = {
    ...empty,
    p50: input.p50,
    p75: Math.round((input.p50 + input.p95) / 2),
    p95: input.p95,
    p99: Math.round(input.p95 * 1.35),
    requestCount: input.requests,
    errorRate: input.errorRate,
    throughputPerMinute: input.requests / 1_440,
  };
  return {
    id: input.id,
    projectId: input.projectId,
    method: input.method,
    routeTemplate: input.routeTemplate,
    source: 'foundry-runtime',
    revision: 'a12c9ef',
    lastSeen: input.lastSeen,
    metrics: { '1h': daily, '24h': daily, '7d': daily },
  };
}

const routes: ApiRouteRollup[] = [
  route({
    id: 'checkout-post',
    projectId: 'storefront',
    method: 'POST',
    routeTemplate: '/v1/checkout',
    requests: 12_842,
    p50: 118,
    p95: 286,
    errorRate: 0.18,
    lastSeen: '2026-07-20T10:33:52.000Z',
  }),
  route({
    id: 'orders-get',
    projectId: 'storefront',
    method: 'GET',
    routeTemplate: '/v1/orders/:id',
    requests: 8_204,
    p50: 92,
    p95: 228,
    errorRate: 0.08,
    lastSeen: '2026-07-20T10:33:49.000Z',
  }),
  route({
    id: 'search-get',
    projectId: 'storefront',
    method: 'GET',
    routeTemplate: '/v1/search',
    requests: 5_982,
    p50: 245,
    p95: 1_284,
    errorRate: 1.42,
    lastSeen: '2026-07-20T10:33:42.000Z',
  }),
  route({
    id: 'webhooks-post',
    projectId: 'billing-api',
    method: 'POST',
    routeTemplate: '/webhooks/stripe',
    requests: 1_476,
    p50: 384,
    p95: 2_840,
    errorRate: 6.3,
    lastSeen: '2026-07-20T10:32:58.000Z',
  }),
  route({
    id: 'health-get',
    projectId: 'billing-api',
    method: 'GET',
    routeTemplate: '/health',
    requests: 12,
    p50: 18,
    p95: 32,
    errorRate: 0,
    lastSeen: '2026-07-20T10:31:20.000Z',
  }),
];

const recentRequests: RecentRequestSpan[] = routes.slice(0, 4).map((item, index) => ({
  traceId: `fixture-${index}`,
  projectId: item.projectId,
  method: item.method,
  routeTemplate: item.routeTemplate,
  statusClass: index === 3 ? '5xx' : index === 2 ? '4xx' : '2xx',
  durationMs: item.metrics['24h'].p95 ?? 0,
  observedAt: item.lastSeen ?? '2026-07-20T10:30:00.000Z',
  source: 'foundry-runtime',
  revision: item.revision,
  operations: [],
}));

export const appHealthScreenshotFixture: SpeedSnapshot = {
  schemaVersion: 'speed.v1',
  generatedAt: '2026-07-20T10:34:00.000Z',
  boundary: {
    mode: 'provider-api',
    providerEnrichment: 'partial',
    message: 'Live key-scoped SDK evidence. Provider enrichments remain separate.',
  },
  retention: { spansDays: 7, rollupsMonths: 13 },
  observation: { startedAt: '2026-07-19T10:34:00.000Z', minimumDays: 14, elapsedDays: 1 },
  surfaces: [],
  routes,
  recentRequests,
  routeDetails: [],
  webDiagnostics: [],
};
