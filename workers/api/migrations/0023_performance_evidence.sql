-- Provider-neutral fleet performance evidence. Collection remains observation-only.
-- Recent sampled spans retain 7 days; aggregate receipts retain 13 months.
-- project_id is the catalog product id (not a projects-table UUID).

CREATE TABLE performance_rollups (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  kind TEXT NOT NULL CHECK (kind IN ('api', 'web')),
  surface TEXT NOT NULL,
  environment TEXT NOT NULL,
  source TEXT NOT NULL,
  revision TEXT,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  sample_count INTEGER NOT NULL CHECK (sample_count > 0),
  error_count INTEGER NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  sampling_rate REAL,
  probe_mode TEXT,
  probe_origin TEXT,
  method TEXT,
  route_template TEXT,
  latency_json TEXT,
  phases_json TEXT,
  web_vitals_json TEXT,
  diagnostic_ref TEXT,
  ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(owner_id, project_id, idempotency_key)
);

CREATE INDEX idx_performance_rollups_owner_window
  ON performance_rollups(owner_id, window_end DESC);
CREATE INDEX idx_performance_rollups_project_surface
  ON performance_rollups(owner_id, project_id, surface, environment, source, window_end DESC);

CREATE TABLE performance_spans (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  surface TEXT NOT NULL,
  environment TEXT NOT NULL,
  source TEXT NOT NULL,
  revision TEXT,
  observed_at TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  method TEXT NOT NULL,
  route_template TEXT NOT NULL,
  status_class TEXT NOT NULL,
  duration_ms REAL NOT NULL CHECK (duration_ms >= 0),
  ttfb_ms REAL,
  probe_mode TEXT,
  sampling_rate REAL,
  ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(owner_id, project_id, idempotency_key)
);

CREATE INDEX idx_performance_spans_owner_observed
  ON performance_spans(owner_id, observed_at DESC);
CREATE INDEX idx_performance_spans_project_route
  ON performance_spans(owner_id, project_id, route_template, source, observed_at DESC);
CREATE INDEX idx_performance_spans_trace
  ON performance_spans(owner_id, trace_id, observed_at DESC);

CREATE TABLE performance_operations (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  span_id TEXT NOT NULL REFERENCES performance_spans(id) ON DELETE CASCADE,
  trace_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  duration_ms REAL NOT NULL CHECK (duration_ms >= 0),
  success INTEGER NOT NULL CHECK (success IN (0, 1)),
  observed_at TEXT NOT NULL,
  ingested_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_performance_operations_trace
  ON performance_operations(owner_id, trace_id, observed_at ASC);
CREATE INDEX idx_performance_operations_span
  ON performance_operations(span_id, observed_at ASC);

CREATE TABLE performance_surface_budgets (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  surface TEXT NOT NULL,
  environment TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'observing'
    CHECK (mode IN ('observing', 'alerting', 'enforcing')),
  latency_p95_ms REAL,
  error_rate REAL,
  approved_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(owner_id, project_id, surface, environment)
);

CREATE TABLE performance_cleanup_runs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  span_cutoff TEXT NOT NULL,
  rollup_cutoff TEXT NOT NULL,
  spans_deleted INTEGER NOT NULL DEFAULT 0,
  operations_deleted INTEGER NOT NULL DEFAULT 0,
  rollups_deleted INTEGER NOT NULL DEFAULT 0,
  bounded INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_performance_cleanup_owner_created
  ON performance_cleanup_runs(owner_id, created_at DESC);
