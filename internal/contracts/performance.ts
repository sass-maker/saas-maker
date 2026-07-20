/** Versioned, provider-neutral contracts for durable fleet performance evidence. */

export const PERFORMANCE_SCHEMA_VERSION = 1 as const;

export type PerformanceEvidenceKind = 'api' | 'web';
export type PerformanceEnvironment =
  | 'production'
  | 'staging'
  | 'preview'
  | 'development'
  | 'local';
export type PerformanceEvidenceSource =
  | 'synthetic-api'
  | 'psi-swarm'
  | 'browser-rum'
  | 'server-runtime'
  | 'posthog'
  | 'cloudflare'
  | 'crux'
  | 'imported';
export type PerformanceProbeMode = 'cold' | 'warm' | 'mixed';
export type PerformanceFreshnessState = 'fresh' | 'stale' | 'unmeasured' | 'failing';
export type PerformanceBudgetMode = 'observing' | 'alerting' | 'enforcing';

export interface PerformancePercentiles {
  p50: number | null;
  p75: number | null;
  p90?: number | null;
  p95: number | null;
  p99: number | null;
}

export type PerformanceTimingPhase = 'dns' | 'connect' | 'tls' | 'ttfb' | 'total';
export type PerformanceTimingPhases = Partial<
  Record<PerformanceTimingPhase, PerformancePercentiles>
>;

export interface PerformanceWebVitals {
  lcp_ms?: PerformancePercentiles;
  inp_ms?: PerformancePercentiles;
  cls?: PerformancePercentiles;
  fcp_ms?: PerformancePercentiles;
  ttfb_ms?: PerformancePercentiles;
}

export interface PerformanceReceiptInput {
  schema_version: typeof PERFORMANCE_SCHEMA_VERSION;
  idempotency_key: string;
  project_id: string;
  kind: PerformanceEvidenceKind;
  surface: string;
  environment: PerformanceEnvironment;
  source: PerformanceEvidenceSource;
  revision?: string | null;
  window_start: string;
  window_end: string;
  sample_count: number;
  error_count?: number;
  sampling_rate?: number | null;
  probe_mode?: PerformanceProbeMode | null;
  method?: 'GET' | 'HEAD' | null;
  route_template?: string | null;
  latency_ms?: PerformancePercentiles | null;
  phases?: PerformanceTimingPhases | null;
  web_vitals?: PerformanceWebVitals | null;
  diagnostic_ref?: string | null;
}

export interface PerformanceReceiptRecord extends PerformanceReceiptInput {
  id: string;
  owner_id: string;
  error_count: number;
  ingested_at: string;
}

export type PerformanceOperationKind =
  | 'd1'
  | 'sql'
  | 'kv'
  | 'r2'
  | 'external-http'
  | 'ai'
  | 'queue'
  | 'other';

export interface PerformanceOperationInput {
  kind: PerformanceOperationKind;
  label: string;
  fingerprint: string;
  duration_ms: number;
  success: boolean;
}

export interface PerformanceSpanInput {
  schema_version: typeof PERFORMANCE_SCHEMA_VERSION;
  idempotency_key: string;
  project_id: string;
  surface: string;
  environment: PerformanceEnvironment;
  source: PerformanceEvidenceSource;
  revision?: string | null;
  observed_at: string;
  trace_id: string;
  method: string;
  route_template: string;
  status_class: '1xx' | '2xx' | '3xx' | '4xx' | '5xx';
  duration_ms: number;
  ttfb_ms?: number | null;
  probe_mode?: PerformanceProbeMode | null;
  sampling_rate?: number | null;
  operations?: PerformanceOperationInput[];
}

export interface PerformanceSpanRecord extends Omit<PerformanceSpanInput, 'operations'> {
  id: string;
  owner_id: string;
  ingested_at: string;
}

export interface PerformanceOperationRecord extends PerformanceOperationInput {
  id: string;
  owner_id: string;
  project_id: string;
  span_id: string;
  trace_id: string;
  observed_at: string;
  ingested_at: string;
}

export interface PerformanceIngestionResult {
  accepted: number;
  deduped: number;
  received: number;
  ids: string[];
}

export interface PerformanceQueryFilters {
  project_id?: string;
  surface?: string;
  environment?: PerformanceEnvironment;
  source?: PerformanceEvidenceSource;
  since?: string;
  until?: string;
  limit?: number;
}

export interface PerformanceRouteAggregate {
  project_id: string;
  surface: string;
  environment: PerformanceEnvironment;
  source: PerformanceEvidenceSource;
  method: string;
  route_template: string;
  sample_count: number;
  error_count: number;
  error_rate: number;
  sampling_rate: number | null;
  latency_ms: PerformancePercentiles;
}

export interface PerformanceTraceResponse {
  spans: PerformanceSpanRecord[];
  operations: PerformanceOperationRecord[];
}

export interface PerformanceCleanupResult {
  run_id: string;
  span_cutoff: string;
  rollup_cutoff: string;
  spans_deleted: number;
  operations_deleted: number;
  rollups_deleted: number;
  bounded: true;
}

export interface PerformanceVolumeBucket {
  day: string;
  project_id: string;
  source: PerformanceEvidenceSource;
  kind: 'receipt' | 'span' | 'operation';
  records: number;
  approximate_bytes: number;
}

export interface PerformanceVolumeReport {
  retention: {
    spans_days: 7;
    rollups_months: 13;
  };
  days: number;
  buckets: PerformanceVolumeBucket[];
  latest_cleanup: PerformanceCleanupResult | null;
}
