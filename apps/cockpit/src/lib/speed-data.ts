import performanceCatalog from '@foundry-catalog/performance-surfaces.json';

import { apiFetch, getServerToken } from '@/lib/api';

export type SpeedFreshness =
  | 'fresh'
  | 'stale'
  | 'unmeasured'
  | 'failing'
  | 'partial'
  | 'not-applicable';
export type SpeedMode = 'observing' | 'alerting' | 'enforcing';
export type SpeedWindow = '1h' | '24h' | '7d';
export type SpeedSource =
  | 'foundry-runtime'
  | 'synthetic'
  | 'psi-swarm'
  | 'browser-rum'
  | 'posthog-import'
  | 'cloudflare'
  | 'crux';

export interface SpeedProvenance {
  source: SpeedSource;
  environment: 'production' | 'preview';
  observedAt: string;
  window: string;
  sampleCount: number;
  revision?: string;
}

export interface WebVitals {
  lcpP75: number | null;
  lcpP95: number | null;
  inpP75: number | null;
  clsP75: number | null;
}

export interface ApiPercentiles {
  p50: number | null;
  p75: number | null;
  p95: number | null;
  p99: number | null;
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
  web?: { metrics: WebVitals; provenance: SpeedProvenance };
  api?: { metrics: ApiPercentiles; provenance: SpeedProvenance };
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
  method: string;
  routeTemplate: string;
  source: SpeedSource;
  revision?: string;
  lastSeen?: string;
  metrics: Record<SpeedWindow, RouteWindowMetrics>;
}

export interface DownstreamOperation {
  kind: 'd1' | 'sql' | 'kv' | 'r2' | 'external-http' | 'queue' | 'ai' | 'other';
  label: string;
  fingerprint: string;
  durationMs: number;
  outcome: 'ok' | 'error';
}

export interface RecentRequestSpan {
  traceId: string;
  projectId: string;
  method: string;
  routeTemplate: string;
  statusClass: '1xx' | '2xx' | '3xx' | '4xx' | '5xx';
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
    mode: 'provider-api' | 'unavailable';
    providerEnrichment: 'available' | 'unavailable' | 'partial';
    message: string;
    sampled?: boolean;
    truncatedWindows?: SpeedWindow[];
  };
  retention: { spansDays: number; rollupsMonths: number };
  observation: { startedAt: string; minimumDays: number; elapsedDays: number };
  surfaces: SpeedSurface[];
  routes: ApiRouteRollup[];
  recentRequests: RecentRequestSpan[];
  routeDetails: RouteDetail[];
  webDiagnostics: WebDiagnostic[];
}

interface ReceiptRow {
  project_id: string;
  kind: 'api' | 'web';
  surface: string;
  environment: string;
  source: string;
  revision?: string | null;
  window_start: string;
  window_end: string;
  sample_count: number;
  error_count: number;
  probe_mode?: string | null;
  probe_origin?: string | null;
  latency_ms?: Record<string, number | null> | null;
  web_vitals?: Record<string, Record<string, number | null> | number | null> | null;
  diagnostic_ref?: string | null;
}

interface RouteRow {
  project_id: string;
  surface: string;
  environment: string;
  source: string;
  method: string;
  route_template: string;
  sample_count: number;
  error_count: number;
  error_rate: number;
  latency_ms: Record<string, number | null>;
  last_seen?: string | null;
}

interface SpanRow {
  project_id: string;
  source: string;
  revision?: string | null;
  observed_at: string;
  trace_id: string;
  method: string;
  route_template: string;
  status_class: RecentRequestSpan['statusClass'];
  duration_ms: number;
  probe_mode?: string | null;
}

interface TraceResponse {
  operations: Array<{
    kind: DownstreamOperation['kind'];
    label: string;
    fingerprint: string;
    duration_ms: number;
    success: boolean | number;
  }>;
}

interface SpeedEvidenceInput {
  receipts: ReceiptRow[];
  routeWindows: Record<SpeedWindow, RouteRow[]>;
  truncatedWindows?: SpeedWindow[];
  spans: SpanRow[];
  operationsByTrace?: Record<string, TraceResponse['operations']>;
}

const WINDOW_MINUTES: Record<SpeedWindow, number> = { '1h': 60, '24h': 1_440, '7d': 10_080 };

function sourceName(source: string): SpeedSource {
  if (source === 'server-runtime') return 'foundry-runtime';
  if (source === 'synthetic-api') return 'synthetic';
  if (source === 'psi-swarm') return 'psi-swarm';
  if (source === 'browser-rum') return 'browser-rum';
  if (source === 'cloudflare') return 'cloudflare';
  if (source === 'crux') return 'crux';
  return 'posthog-import';
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function percentile(record: Record<string, number | null> | null | undefined, key: string) {
  return finite(record?.[key]);
}

function emptyMetrics(): RouteWindowMetrics {
  return {
    p50: null,
    p75: null,
    p95: null,
    p99: null,
    requestCount: 0,
    errorRate: 0,
    throughputPerMinute: 0,
  };
}

function catalogSurfaces(now: Date): SpeedSurface[] {
  return performanceCatalog.projects.flatMap((project) => {
    if (project.surfaces.length === 0) {
      return [
        {
          id: `${project.projectId}-not-applicable`,
          projectId: project.projectId,
          projectName: project.name,
          label: 'No declared web/API surface',
          state: project.runtimeStatus === 'not-applicable' ? 'not-applicable' : 'unmeasured',
          mode: 'observing',
          note: 'No trustworthy performance evidence is available.',
        } satisfies SpeedSurface,
      ];
    }
    return project.surfaces.map(
      (surface) =>
        ({
          id: surface.id,
          projectId: project.projectId,
          projectName: project.name,
          label: surface.name,
          state: 'unmeasured',
          mode: 'observing',
          note: `No evidence received as of ${now.toISOString()}.`,
        }) satisfies SpeedSurface
    );
  });
}

export function createUnavailableSpeedSnapshot(
  now = new Date(),
  message = 'The performance evidence API is unavailable. No sample data is substituted.'
): SpeedSnapshot {
  return {
    schemaVersion: 'speed.v1',
    generatedAt: now.toISOString(),
    boundary: { mode: 'unavailable', providerEnrichment: 'unavailable', message },
    retention: { spansDays: 7, rollupsMonths: 13 },
    observation: { startedAt: now.toISOString(), minimumDays: 14, elapsedDays: 0 },
    surfaces: catalogSurfaces(now),
    routes: [],
    recentRequests: [],
    routeDetails: [],
    webDiagnostics: [],
  };
}

function evidenceState(receipt: ReceiptRow, freshnessHours: number, now: Date): SpeedFreshness {
  if (receipt.error_count > 0) return 'failing';
  const age = now.getTime() - Date.parse(receipt.window_end);
  return age > freshnessHours * 3_600_000 ? 'stale' : 'fresh';
}

function vitals(receipt: ReceiptRow): WebVitals {
  const lcp = receipt.web_vitals?.lcp_ms;
  const inp = receipt.web_vitals?.inp_ms;
  const cls = receipt.web_vitals?.cls;
  return {
    lcpP75: typeof lcp === 'object' && lcp ? finite(lcp.p75) : null,
    lcpP95: typeof lcp === 'object' && lcp ? finite(lcp.p95) : null,
    inpP75: typeof inp === 'object' && inp ? finite(inp.p75) : null,
    clsP75: typeof cls === 'object' && cls ? finite(cls.p75) : finite(cls),
  };
}

function provenance(receipt: ReceiptRow): SpeedProvenance {
  return {
    source: sourceName(receipt.source),
    environment: receipt.environment === 'preview' ? 'preview' : 'production',
    observedAt: receipt.window_end,
    window: `${receipt.window_start} to ${receipt.window_end}${receipt.probe_origin ? ` · ${receipt.probe_origin}` : ''}`,
    sampleCount: receipt.sample_count,
    ...(receipt.revision ? { revision: receipt.revision } : {}),
  };
}

function routeKey(route: Pick<RouteRow, 'project_id' | 'method' | 'route_template' | 'source'>) {
  return `${route.project_id}\u0000${route.method}\u0000${route.route_template}\u0000${route.source}`;
}

function routeId(route: Pick<RouteRow, 'project_id' | 'method' | 'route_template' | 'source'>) {
  return `${route.project_id}:${route.method}:${route.route_template}:${route.source}`;
}

export function buildSpeedSnapshot(input: SpeedEvidenceInput, now = new Date()): SpeedSnapshot {
  const latestBySurface = new Map<string, ReceiptRow>();
  for (const receipt of input.receipts) {
    const key = `${receipt.project_id}\u0000${receipt.surface}`;
    const prior = latestBySurface.get(key);
    if (!prior || Date.parse(receipt.window_end) > Date.parse(prior.window_end)) {
      latestBySurface.set(key, receipt);
    }
  }

  const surfaces = catalogSurfaces(now).map((surface) => {
    const declaration = performanceCatalog.projects
      .find((project) => project.projectId === surface.projectId)
      ?.surfaces.find((candidate) => candidate.id === surface.id);
    const receipt = latestBySurface.get(`${surface.projectId}\u0000${surface.id}`);
    if (!receipt || !declaration) return surface;
    const state = evidenceState(receipt, declaration.freshnessHours, now);
    const base = { ...surface, state, note: undefined };
    if (receipt.kind === 'web') {
      return { ...base, web: { metrics: vitals(receipt), provenance: provenance(receipt) } };
    }
    return {
      ...base,
      api: {
        metrics: {
          p50: percentile(receipt.latency_ms, 'p50'),
          p75: percentile(receipt.latency_ms, 'p75'),
          p95: percentile(receipt.latency_ms, 'p95'),
          p99: percentile(receipt.latency_ms, 'p99'),
          requestCount: receipt.sample_count,
          errorRate:
            receipt.sample_count > 0 ? (receipt.error_count / receipt.sample_count) * 100 : 0,
        },
        provenance: provenance(receipt),
      },
    };
  });

  const windows = new Map<SpeedWindow, Map<string, RouteRow>>();
  for (const window of ['1h', '24h', '7d'] as const) {
    windows.set(window, new Map(input.routeWindows[window].map((row) => [routeKey(row), row])));
  }
  const routeKeys = new Set(
    Object.values(input.routeWindows).flatMap((rows) => rows.map((row) => routeKey(row)))
  );
  const routes = [...routeKeys].map((key) => {
    const representative =
      windows.get('24h')?.get(key) ?? windows.get('7d')?.get(key) ?? windows.get('1h')!.get(key)!;
    const metrics = Object.fromEntries(
      (['1h', '24h', '7d'] as const).map((window) => {
        const row = windows.get(window)?.get(key);
        if (!row) return [window, emptyMetrics()];
        return [
          window,
          {
            p50: percentile(row.latency_ms, 'p50'),
            p75: percentile(row.latency_ms, 'p75'),
            p95: percentile(row.latency_ms, 'p95'),
            p99: percentile(row.latency_ms, 'p99'),
            requestCount: row.sample_count,
            errorRate: row.error_rate * 100,
            throughputPerMinute: row.sample_count / WINDOW_MINUTES[window],
          },
        ];
      })
    ) as Record<SpeedWindow, RouteWindowMetrics>;
    return {
      id: routeId(representative),
      projectId: representative.project_id,
      method: representative.method,
      routeTemplate: representative.route_template,
      source: sourceName(representative.source),
      ...(representative.last_seen ? { lastSeen: representative.last_seen } : {}),
      metrics,
    } satisfies ApiRouteRollup;
  });

  const recentRequests = input.spans.map((span) => ({
    traceId: span.trace_id,
    projectId: span.project_id,
    method: span.method,
    routeTemplate: span.route_template,
    statusClass: span.status_class,
    durationMs: span.duration_ms,
    observedAt: span.observed_at,
    source: sourceName(span.source),
    ...(span.revision ? { revision: span.revision } : {}),
    ...(span.probe_mode === 'cold' || span.probe_mode === 'warm'
      ? { temperature: span.probe_mode }
      : {}),
    operations: (input.operationsByTrace?.[span.trace_id] ?? []).map((operation) => ({
      kind: operation.kind,
      label: operation.label,
      fingerprint: operation.fingerprint,
      durationMs: operation.duration_ms,
      outcome: operation.success === true || operation.success === 1 ? 'ok' : 'error',
    })),
  })) satisfies RecentRequestSpan[];

  const routeDetails = routes.map((route) => {
    const related = recentRequests.filter(
      (span) =>
        span.projectId === route.projectId &&
        span.method === route.method &&
        span.routeTemplate === route.routeTemplate &&
        span.source === route.source
    );
    const counts = { '2xx': 0, '4xx': 0, '5xx': 0 };
    for (const span of related) {
      if (span.statusClass in counts) counts[span.statusClass as keyof typeof counts] += 1;
    }
    const daily = route.metrics['24h'];
    return {
      routeId: route.id,
      trends:
        daily.requestCount > 0 && daily.p95 != null
          ? [
              {
                source: route.source,
                environment: 'production' as const,
                sampleCount: daily.requestCount,
                points: [
                  {
                    label: now.toISOString().slice(0, 10),
                    p95: daily.p95,
                    requests: daily.requestCount,
                    errorRate: daily.errorRate,
                  },
                ],
              },
            ]
          : [],
      statusClasses: (['2xx', '4xx', '5xx'] as const).map((label) => ({
        label,
        count: counts[label],
      })),
    } satisfies RouteDetail;
  });

  const webDiagnostics = input.receipts
    .filter((receipt) => receipt.kind === 'web')
    .map((receipt) => {
      const declaration = performanceCatalog.projects
        .find((project) => project.projectId === receipt.project_id)
        ?.surfaces.find((surface) => surface.id === receipt.surface);
      const state = evidenceState(receipt, declaration?.freshnessHours ?? 168, now);
      return {
        id: `${receipt.project_id}:${receipt.surface}:${receipt.window_end}`,
        projectId: receipt.project_id,
        surfaceLabel: declaration?.name ?? receipt.surface,
        state,
        current: vitals(receipt),
        provenance: provenance(receipt),
        ...(receipt.diagnostic_ref && !receipt.diagnostic_ref.includes('?')
          ? { artifactLabel: receipt.diagnostic_ref }
          : {}),
        finding:
          state === 'failing'
            ? `${receipt.error_count} of ${receipt.sample_count} samples failed.`
            : 'Latest controlled web distribution.',
      } satisfies WebDiagnostic;
    });

  const evidenceTimes = [
    ...input.receipts.map((receipt) => Date.parse(receipt.window_start)),
    ...input.spans.map((span) => Date.parse(span.observed_at)),
  ].filter(Number.isFinite);
  const startedAt = evidenceTimes.length > 0 ? Math.min(...evidenceTimes) : now.getTime();

  return {
    schemaVersion: 'speed.v1',
    generatedAt: now.toISOString(),
    boundary: {
      mode: 'provider-api',
      providerEnrichment: 'partial',
      sampled: true,
      ...(input.truncatedWindows?.length ? { truncatedWindows: input.truncatedWindows } : {}),
      message: input.truncatedWindows?.length
        ? `Live bounded span samples. The ${input.truncatedWindows.join(', ')} route windows use the newest query slice.`
        : 'Live bounded span samples. Provider evidence remains separate and may be unavailable.',
    },
    retention: { spansDays: 7, rollupsMonths: 13 },
    observation: {
      startedAt: new Date(startedAt).toISOString(),
      minimumDays: 14,
      elapsedDays: Math.max(0, Math.floor((now.getTime() - startedAt) / 86_400_000)),
    },
    surfaces,
    routes,
    recentRequests,
    routeDetails,
    webDiagnostics,
  };
}

function since(now: Date, milliseconds: number): string {
  return new Date(now.getTime() - milliseconds).toISOString();
}

export async function getSpeedSnapshot(): Promise<SpeedSnapshot> {
  const now = new Date();
  try {
    const token = await getServerToken();
    if (!token) return createUnavailableSpeedSnapshot(now, 'No API session token is available.');
    const [receipts, routes1h, routes24h, routes7d, spans] = await Promise.all([
      apiFetch('/v1/performance/summary?limit=500', { cache: 'no-store' }, token),
      apiFetch(
        `/v1/performance/routes?limit=100&since=${encodeURIComponent(since(now, 3_600_000))}`,
        { cache: 'no-store' },
        token
      ),
      apiFetch(
        `/v1/performance/routes?limit=100&since=${encodeURIComponent(since(now, 86_400_000))}`,
        { cache: 'no-store' },
        token
      ),
      apiFetch(
        `/v1/performance/routes?limit=100&since=${encodeURIComponent(since(now, 7 * 86_400_000))}`,
        { cache: 'no-store' },
        token
      ),
      apiFetch('/v1/performance/spans/recent?limit=50', { cache: 'no-store' }, token),
    ]);
    const spanRows = (spans.data ?? []) as SpanRow[];
    const traceRows = await Promise.all(
      spanRows.slice(0, 20).map(async (span) => {
        const trace = (await apiFetch(
          `/v1/performance/traces/${encodeURIComponent(span.trace_id)}`,
          { cache: 'no-store' },
          token
        )) as TraceResponse;
        return [span.trace_id, trace.operations ?? []] as const;
      })
    );
    return buildSpeedSnapshot(
      {
        receipts: receipts.data ?? [],
        routeWindows: {
          '1h': routes1h.data ?? [],
          '24h': routes24h.data ?? [],
          '7d': routes7d.data ?? [],
        },
        truncatedWindows: (['1h', '24h', '7d'] as const).filter(
          (window) => ({ '1h': routes1h, '24h': routes24h, '7d': routes7d })[window].truncated
        ),
        spans: spanRows,
        operationsByTrace: Object.fromEntries(traceRows),
      },
      now
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    return createUnavailableSpeedSnapshot(now, `Performance evidence unavailable: ${message}`);
  }
}
