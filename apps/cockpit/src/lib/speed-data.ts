export type SpeedFreshness = 'fresh' | 'stale' | 'unmeasured' | 'failing' | 'partial';
export type SpeedMode = 'observing' | 'alerting' | 'enforcing';
export type SpeedWindow = '1h' | '24h' | '7d';
export type SpeedPercentile = 'p75' | 'p95' | 'p99';
export type SpeedSource =
  | 'foundry-runtime'
  | 'synthetic'
  | 'psi-swarm'
  | 'browser-rum'
  | 'posthog-import';

export interface SpeedProvenance {
  source: SpeedSource;
  environment: 'production' | 'preview';
  observedAt: string;
  window: string;
  sampleCount: number;
  revision?: string;
}

export interface WebVitals {
  lcpP75: number;
  lcpP95: number;
  inpP75: number;
  clsP75: number;
}

export interface ApiPercentiles {
  p50: number;
  p75: number;
  p95: number;
  p99: number;
  requestCount: number;
  errorRate: number;
}

export interface SurfaceRegression {
  metric: string;
  previous: number;
  current: number;
  unit: 'ms' | '%';
  deltaPercent: number;
  baselineRevision: string;
  currentRevision: string;
  sampleCount: number;
}

export interface BudgetSuggestion {
  id: string;
  metric: string;
  threshold: number;
  unit: 'ms' | '%';
  rationale: string;
}

export interface SpeedSurface {
  id: string;
  projectId: string;
  projectName: string;
  label: string;
  state: SpeedFreshness;
  mode: SpeedMode;
  web?: {
    metrics: WebVitals;
    provenance: SpeedProvenance;
  };
  api?: {
    metrics: ApiPercentiles;
    provenance: SpeedProvenance;
  };
  regression?: SurfaceRegression;
  budget?: BudgetSuggestion;
  note?: string;
}

export interface RouteWindowMetrics extends ApiPercentiles {
  throughputPerMinute: number;
}

export interface ApiRouteRollup {
  id: string;
  projectId: string;
  method: 'GET' | 'POST' | 'PATCH';
  routeTemplate: string;
  source: SpeedSource;
  revision?: string;
  metrics: Record<SpeedWindow, RouteWindowMetrics>;
}

export interface DownstreamOperation {
  kind: 'd1' | 'kv' | 'external-http' | 'queue' | 'ai';
  label: string;
  fingerprint: string;
  durationMs: number;
  outcome: 'ok' | 'error';
}

export interface RecentRequestSpan {
  traceId: string;
  projectId: string;
  method: 'GET' | 'POST' | 'PATCH';
  routeTemplate: string;
  statusClass: '2xx' | '4xx' | '5xx';
  durationMs: number;
  observedAt: string;
  source: SpeedSource;
  revision?: string;
  temperature?: 'cold' | 'warm';
  operations: DownstreamOperation[];
}

export interface RouteTrendSeries {
  source: SpeedSource;
  environment: 'production' | 'preview';
  revision?: string;
  sampleCount: number;
  points: Array<{ label: string; p95: number; requests: number; errorRate: number }>;
}

export interface RouteDetail {
  routeId: string;
  trends: RouteTrendSeries[];
  statusClasses: Array<{ label: '2xx' | '4xx' | '5xx'; count: number }>;
  synthetic?: { coldP95: number; warmP95: number; sampleCount: number; observedAt: string };
}

export interface WebDiagnostic {
  id: string;
  projectId: string;
  surfaceLabel: string;
  state: SpeedFreshness;
  current: WebVitals;
  previous?: WebVitals;
  provenance: SpeedProvenance;
  baselineRevision?: string;
  artifactLabel?: string;
  artifactHref?: string;
  finding: string;
}

export interface SpeedSnapshot {
  schemaVersion: 'speed.v1';
  generatedAt: string;
  boundary: {
    mode: 'provider-neutral-fixture' | 'provider-api';
    providerEnrichment: 'available' | 'unavailable' | 'partial';
    message: string;
  };
  retention: { spansDays: number; rollupsMonths: number };
  observation: { startedAt: string; minimumDays: number; elapsedDays: number };
  surfaces: SpeedSurface[];
  routes: ApiRouteRollup[];
  recentRequests: RecentRequestSpan[];
  routeDetails: RouteDetail[];
  webDiagnostics: WebDiagnostic[];
}

const isoAgo = (now: Date, milliseconds: number) =>
  new Date(now.getTime() - milliseconds).toISOString();

const windows = (
  oneHour: RouteWindowMetrics,
  day: RouteWindowMetrics,
  week: RouteWindowMetrics
): Record<SpeedWindow, RouteWindowMetrics> => ({ '1h': oneHour, '24h': day, '7d': week });

export function createSpeedFixture(now = new Date()): SpeedSnapshot {
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  return {
    schemaVersion: 'speed.v1',
    generatedAt: now.toISOString(),
    boundary: {
      mode: 'provider-neutral-fixture',
      providerEnrichment: 'partial',
      message:
        'Provider-neutral fallback evidence. Runtime and PSI receipts remain separate; provider enrichment is incomplete.',
    },
    retention: { spansDays: 7, rollupsMonths: 13 },
    observation: {
      startedAt: isoAgo(now, 6 * day),
      minimumDays: 14,
      elapsedDays: 6,
    },
    surfaces: [
      {
        id: 'saas-maker-primary',
        projectId: 'saas-maker',
        projectName: 'SaaS Maker',
        label: 'Cockpit + API',
        state: 'fresh',
        mode: 'observing',
        web: {
          metrics: { lcpP75: 1180, lcpP95: 1890, inpP75: 118, clsP75: 0.03 },
          provenance: {
            source: 'psi-swarm',
            environment: 'production',
            observedAt: isoAgo(now, 3 * hour),
            window: '5 desktop + 5 mobile runs',
            sampleCount: 10,
            revision: '3d91c4a',
          },
        },
        api: {
          metrics: {
            p50: 74,
            p75: 112,
            p95: 286,
            p99: 640,
            requestCount: 18_420,
            errorRate: 0.62,
          },
          provenance: {
            source: 'foundry-runtime',
            environment: 'production',
            observedAt: isoAgo(now, 4 * minute),
            window: '24h',
            sampleCount: 1842,
            revision: '3d91c4a',
          },
        },
        budget: {
          id: 'budget-saas-maker-api-p95',
          metric: 'API p95',
          threshold: 360,
          unit: 'ms',
          rationale: 'Suggested from six observation days and 9,840 sampled requests.',
        },
      },
      {
        id: 'reel-pipeline-api',
        projectId: 'reel-pipeline',
        projectName: 'Reel Pipeline',
        label: 'Queue API',
        state: 'stale',
        mode: 'observing',
        api: {
          metrics: {
            p50: 182,
            p75: 310,
            p95: 980,
            p99: 1840,
            requestCount: 2130,
            errorRate: 1.82,
          },
          provenance: {
            source: 'posthog-import',
            environment: 'production',
            observedAt: isoAgo(now, 53 * hour),
            window: '24h ending 53h ago',
            sampleCount: 426,
            revision: 'b7118de',
          },
        },
        note: 'Newest compatible receipt is outside the 48-hour freshness limit.',
      },
      {
        id: 'psi-swarm-web',
        projectId: 'psi-swarm',
        projectName: 'PSI Swarm',
        label: 'Public web',
        state: 'partial',
        mode: 'alerting',
        web: {
          metrics: { lcpP75: 2020, lcpP95: 3540, inpP75: 156, clsP75: 0.05 },
          provenance: {
            source: 'psi-swarm',
            environment: 'production',
            observedAt: isoAgo(now, 18 * hour),
            window: 'weekly distribution',
            sampleCount: 10,
            revision: 'ea3209f',
          },
        },
        regression: {
          metric: 'LCP p75',
          previous: 1580,
          current: 2020,
          unit: 'ms',
          deltaPercent: 27.8,
          baselineRevision: '7bd21f0',
          currentRevision: 'ea3209f',
          sampleCount: 20,
        },
        note: 'Web evidence is fresh; no runtime API surface is declared.',
      },
      {
        id: 'free-ai-gateway',
        projectId: 'free-ai',
        projectName: 'Free AI',
        label: 'Gateway API',
        state: 'failing',
        mode: 'observing',
        api: {
          metrics: {
            p50: 410,
            p75: 780,
            p95: 2840,
            p99: 5900,
            requestCount: 680,
            errorRate: 12.4,
          },
          provenance: {
            source: 'synthetic',
            environment: 'production',
            observedAt: isoAgo(now, 42 * minute),
            window: '5 cold + 15 warm probes',
            sampleCount: 20,
            revision: 'a04e921',
          },
        },
        regression: {
          metric: 'API error rate',
          previous: 1.4,
          current: 12.4,
          unit: '%',
          deltaPercent: 785.7,
          baselineRevision: '01d297b',
          currentRevision: 'a04e921',
          sampleCount: 40,
        },
        note: 'Three recent anonymous probes returned a 5xx status class.',
      },
      {
        id: 'high-signal-web',
        projectId: 'high-signal',
        projectName: 'High Signal',
        label: 'Reader web',
        state: 'fresh',
        mode: 'observing',
        web: {
          metrics: { lcpP75: 890, lcpP95: 1460, inpP75: 92, clsP75: 0.01 },
          provenance: {
            source: 'browser-rum',
            environment: 'production',
            observedAt: isoAgo(now, 12 * minute),
            window: '24h',
            sampleCount: 1180,
            revision: '4c9bd18',
          },
        },
      },
      {
        id: 'codevetter-desktop',
        projectId: 'codevetter',
        projectName: 'CodeVetter',
        label: 'Desktop app',
        state: 'unmeasured',
        mode: 'observing',
        note: 'No compatible web or API performance surface is declared.',
      },
    ],
    routes: [
      {
        id: 'saas-projects-list',
        projectId: 'saas-maker',
        method: 'GET',
        routeTemplate: '/v1/projects',
        source: 'foundry-runtime',
        revision: '3d91c4a',
        metrics: windows(
          { p50: 64, p75: 92, p95: 218, p99: 380, requestCount: 1180, errorRate: 0.08, throughputPerMinute: 19.7 },
          { p50: 68, p75: 98, p95: 236, p99: 420, requestCount: 8920, errorRate: 0.12, throughputPerMinute: 6.2 },
          { p50: 71, p75: 102, p95: 248, p99: 510, requestCount: 58_430, errorRate: 0.18, throughputPerMinute: 5.8 }
        ),
      },
      {
        id: 'saas-tasks-list',
        projectId: 'saas-maker',
        method: 'GET',
        routeTemplate: '/v1/tasks',
        source: 'foundry-runtime',
        revision: '3d91c4a',
        metrics: windows(
          { p50: 96, p75: 148, p95: 384, p99: 790, requestCount: 510, errorRate: 0.6, throughputPerMinute: 8.5 },
          { p50: 102, p75: 154, p95: 412, p99: 910, requestCount: 6310, errorRate: 0.74, throughputPerMinute: 4.4 },
          { p50: 108, p75: 168, p95: 468, p99: 1040, requestCount: 41_680, errorRate: 0.92, throughputPerMinute: 4.1 }
        ),
      },
      {
        id: 'saas-feedback-create',
        projectId: 'saas-maker',
        method: 'POST',
        routeTemplate: '/v1/feedback',
        source: 'foundry-runtime',
        revision: '3d91c4a',
        metrics: windows(
          { p50: 122, p75: 190, p95: 530, p99: 880, requestCount: 86, errorRate: 2.3, throughputPerMinute: 1.4 },
          { p50: 118, p75: 184, p95: 498, p99: 850, requestCount: 990, errorRate: 1.8, throughputPerMinute: 0.7 },
          { p50: 124, p75: 202, p95: 548, p99: 930, requestCount: 6920, errorRate: 2.1, throughputPerMinute: 0.69 }
        ),
      },
      {
        id: 'reel-queue-list',
        projectId: 'reel-pipeline',
        method: 'GET',
        routeTemplate: '/v1/marketing/queue',
        source: 'posthog-import',
        revision: 'b7118de',
        metrics: windows(
          { p50: 171, p75: 286, p95: 940, p99: 1760, requestCount: 24, errorRate: 0, throughputPerMinute: 0.4 },
          { p50: 182, p75: 310, p95: 980, p99: 1840, requestCount: 2130, errorRate: 1.82, throughputPerMinute: 1.48 },
          { p50: 190, p75: 332, p95: 1040, p99: 2010, requestCount: 13_420, errorRate: 2.14, throughputPerMinute: 1.33 }
        ),
      },
      {
        id: 'free-ai-generate',
        projectId: 'free-ai',
        method: 'POST',
        routeTemplate: '/v1/generate',
        source: 'synthetic',
        revision: 'a04e921',
        metrics: windows(
          { p50: 440, p75: 820, p95: 3110, p99: 5900, requestCount: 20, errorRate: 15, throughputPerMinute: 0.33 },
          { p50: 410, p75: 780, p95: 2840, p99: 5900, requestCount: 20, errorRate: 12.4, throughputPerMinute: 0.01 },
          { p50: 390, p75: 740, p95: 2710, p99: 5800, requestCount: 140, errorRate: 9.3, throughputPerMinute: 0.01 }
        ),
      },
    ],
    recentRequests: [
      {
        traceId: 'tr_01JZ8Q4X8A',
        projectId: 'saas-maker',
        method: 'GET',
        routeTemplate: '/v1/tasks',
        statusClass: '2xx',
        durationMs: 438,
        observedAt: isoAgo(now, 2 * minute),
        source: 'foundry-runtime',
        revision: '3d91c4a',
        temperature: 'warm',
        operations: [
          { kind: 'd1', label: 'tasks.list', fingerprint: 'fp_84cf12a9', durationMs: 286, outcome: 'ok' },
          { kind: 'kv', label: 'project-cache.read', fingerprint: 'fp_260ce91b', durationMs: 18, outcome: 'ok' },
        ],
      },
      {
        traceId: 'tr_01JZ8PZG2D',
        projectId: 'saas-maker',
        method: 'POST',
        routeTemplate: '/v1/feedback',
        statusClass: '5xx',
        durationMs: 812,
        observedAt: isoAgo(now, 8 * minute),
        source: 'foundry-runtime',
        revision: '3d91c4a',
        operations: [
          { kind: 'd1', label: 'feedback.create', fingerprint: 'fp_19b08c73', durationMs: 490, outcome: 'error' },
        ],
      },
      {
        traceId: 'tr_01JZ8P2K9M',
        projectId: 'free-ai',
        method: 'POST',
        routeTemplate: '/v1/generate',
        statusClass: '5xx',
        durationMs: 3860,
        observedAt: isoAgo(now, 38 * minute),
        source: 'synthetic',
        revision: 'a04e921',
        temperature: 'cold',
        operations: [
          { kind: 'ai', label: 'gateway.generate', fingerprint: 'fp_c74a219e', durationMs: 3420, outcome: 'error' },
          { kind: 'queue', label: 'usage.record', fingerprint: 'fp_450dd2a1', durationMs: 42, outcome: 'ok' },
        ],
      },
      {
        traceId: 'tr_01JZ7ZYT5N',
        projectId: 'reel-pipeline',
        method: 'GET',
        routeTemplate: '/v1/marketing/queue',
        statusClass: '2xx',
        durationMs: 946,
        observedAt: isoAgo(now, 26 * hour),
        source: 'posthog-import',
        revision: 'b7118de',
        operations: [],
      },
    ],
    routeDetails: [
      {
        routeId: 'saas-tasks-list',
        trends: [
          {
            source: 'posthog-import',
            environment: 'production',
            revision: '1b2f9d0',
            sampleCount: 840,
            points: [
              { label: 'Jul 14', p95: 328, requests: 740, errorRate: 0.4 },
              { label: 'Jul 15', p95: 352, requests: 780, errorRate: 0.5 },
              { label: 'Jul 16', p95: 340, requests: 760, errorRate: 0.5 },
            ],
          },
          {
            source: 'foundry-runtime',
            environment: 'production',
            revision: '3d91c4a',
            sampleCount: 1842,
            points: [
              { label: 'Jul 18', p95: 366, requests: 820, errorRate: 0.6 },
              { label: 'Jul 19', p95: 398, requests: 900, errorRate: 0.7 },
              { label: 'Jul 20', p95: 412, requests: 940, errorRate: 0.74 },
            ],
          },
        ],
        statusClasses: [
          { label: '2xx', count: 6240 },
          { label: '4xx', count: 43 },
          { label: '5xx', count: 27 },
        ],
        synthetic: { coldP95: 510, warmP95: 278, sampleCount: 20, observedAt: isoAgo(now, 8 * hour) },
      },
      {
        routeId: 'free-ai-generate',
        trends: [
          {
            source: 'synthetic',
            environment: 'production',
            revision: 'a04e921',
            sampleCount: 140,
            points: [
              { label: 'Jul 18', p95: 1780, requests: 20, errorRate: 5 },
              { label: 'Jul 19', p95: 2290, requests: 20, errorRate: 10 },
              { label: 'Jul 20', p95: 2840, requests: 20, errorRate: 15 },
            ],
          },
        ],
        statusClasses: [
          { label: '2xx', count: 17 },
          { label: '4xx', count: 0 },
          { label: '5xx', count: 3 },
        ],
        synthetic: { coldP95: 3110, warmP95: 2420, sampleCount: 20, observedAt: isoAgo(now, 42 * minute) },
      },
    ],
    webDiagnostics: [
      {
        id: 'psi-swarm-regression',
        projectId: 'psi-swarm',
        surfaceLabel: 'Public web',
        state: 'partial',
        current: { lcpP75: 2020, lcpP95: 3540, inpP75: 156, clsP75: 0.05 },
        previous: { lcpP75: 1580, lcpP95: 2610, inpP75: 142, clsP75: 0.04 },
        provenance: {
          source: 'psi-swarm',
          environment: 'production',
          observedAt: isoAgo(now, 18 * hour),
          window: '5 desktop + 5 mobile runs',
          sampleCount: 10,
          revision: 'ea3209f',
        },
        baselineRevision: '7bd21f0',
        artifactLabel: 'swarm_01JZ6QK7',
        artifactHref: 'https://performance.sassmaker.com',
        finding: 'LCP p75 regressed 440 ms across comparable PSI Swarm distributions.',
      },
      {
        id: 'high-signal-rum',
        projectId: 'high-signal',
        surfaceLabel: 'Reader web',
        state: 'fresh',
        current: { lcpP75: 890, lcpP95: 1460, inpP75: 92, clsP75: 0.01 },
        provenance: {
          source: 'browser-rum',
          environment: 'production',
          observedAt: isoAgo(now, 12 * minute),
          window: '24h',
          sampleCount: 1180,
          revision: '4c9bd18',
        },
        finding: 'Stable field distribution; no compatible PSI artifact is attached.',
      },
    ],
  };
}

function isSpeedSnapshot(value: unknown): value is SpeedSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SpeedSnapshot>;
  return (
    candidate.schemaVersion === 'speed.v1' &&
    Array.isArray(candidate.surfaces) &&
    Array.isArray(candidate.routes) &&
    Array.isArray(candidate.recentRequests) &&
    Array.isArray(candidate.routeDetails) &&
    Array.isArray(candidate.webDiagnostics)
  );
}

/**
 * Server-only fetch boundary for the provider-neutral performance query API.
 * The browser never receives a provider credential. Until the parallel API branch
 * exposes `speed.v1`, failures resolve to the deterministic sanitized fixture.
 */
export async function getSpeedSnapshot(): Promise<SpeedSnapshot> {
  const apiBase = process.env.SPEED_OBSERVABILITY_API_URL;
  if (!apiBase) return createSpeedFixture();

  try {
    const response = await fetch(new URL('/v1/performance/speed', apiBase), {
      cache: 'no-store',
      headers: process.env.SAASMAKER_API_KEY
        ? { Authorization: `Bearer ${process.env.SAASMAKER_API_KEY}` }
        : undefined,
    });
    if (!response.ok) return createSpeedFixture();

    const payload: unknown = await response.json();
    if (!isSpeedSnapshot(payload)) return createSpeedFixture();
    return payload;
  } catch {
    return createSpeedFixture();
  }
}
