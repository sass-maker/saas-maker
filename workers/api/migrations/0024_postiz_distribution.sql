-- Provider-neutral Postiz delivery idempotency and normalized evidence.
-- Provider payloads, credentials, comments, DMs, and account identities are never stored here.

CREATE TABLE distribution_delivery_mappings (
  id TEXT PRIMARY KEY,
  distribution_request_id TEXT NOT NULL,
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  integration_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  brief_id TEXT NOT NULL,
  artifact_manifest_id TEXT NOT NULL,
  experiment_id TEXT,
  platform TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'postiz',
  provider_post_id TEXT,
  previous_provider_post_id TEXT,
  state TEXT NOT NULL CHECK (
    state IN ('reserved', 'mapped', 'ambiguous', 'terminal', 'replacement_approved')
  ),
  replacement_count INTEGER NOT NULL DEFAULT 0 CHECK (replacement_count >= 0),
  replacement_approved_by TEXT,
  replacement_approved_at TEXT,
  replacement_evidence_ref TEXT,
  last_reconciled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(distribution_request_id, content_hash, integration_id)
);

CREATE INDEX idx_distribution_mappings_sync
  ON distribution_delivery_mappings(state, updated_at, id);
CREATE UNIQUE INDEX idx_distribution_mappings_provider_post
  ON distribution_delivery_mappings(provider, provider_post_id)
  WHERE provider_post_id IS NOT NULL;

CREATE TABLE distribution_provider_receipts (
  id TEXT PRIMARY KEY,
  distribution_request_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  brief_id TEXT NOT NULL,
  artifact_manifest_id TEXT NOT NULL,
  experiment_id TEXT,
  integration_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  provider_post_id TEXT NOT NULL,
  provider_release_id TEXT,
  release_status TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source = 'postiz'),
  observed_at TEXT NOT NULL,
  freshness TEXT NOT NULL CHECK (freshness IN ('fresh', 'stale', 'failed', 'unmeasured')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_distribution_receipts_post_observed
  ON distribution_provider_receipts(provider_post_id, observed_at DESC);
CREATE INDEX idx_distribution_receipts_attribution
  ON distribution_provider_receipts(project_id, campaign_id, observed_at DESC);

CREATE TABLE distribution_analytics_evidence (
  id TEXT PRIMARY KEY,
  distribution_request_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  brief_id TEXT NOT NULL,
  artifact_manifest_id TEXT NOT NULL,
  experiment_id TEXT,
  integration_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  provider_post_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source = 'postiz'),
  observed_at TEXT NOT NULL,
  freshness TEXT NOT NULL CHECK (freshness IN ('fresh', 'stale', 'failed', 'unmeasured')),
  metrics_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_distribution_evidence_post_observed
  ON distribution_analytics_evidence(provider_post_id, observed_at DESC);
CREATE INDEX idx_distribution_evidence_attribution
  ON distribution_analytics_evidence(project_id, campaign_id, observed_at DESC);

CREATE TABLE distribution_sync_cursors (
  source TEXT PRIMARY KEY CHECK (source = 'postiz'),
  cursor TEXT,
  observed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
