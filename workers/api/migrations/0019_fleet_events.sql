-- Fleet events: append-only system-of-record where spokes publish results/telemetry up.
-- Single-writer-per-product by convention; only the hub (Cockpit) reads the union.
-- See docs/plans/2026-06-19-fleet-events-hub-spec.md
CREATE TABLE IF NOT EXISTS fleet_events (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product TEXT NOT NULL,                          -- which spoke emitted it, e.g. 'reel-pipeline'
  project_slug TEXT,                              -- optional fleet-project linkage
  type TEXT NOT NULL,                             -- e.g. 'reel.rendered', 'audit.completed'
  payload TEXT NOT NULL DEFAULT '{}',             -- opaque JSON envelope; never coupled to the table
  schema_version INTEGER NOT NULL DEFAULT 1,
  idempotency_key TEXT NOT NULL,                  -- client-supplied; makes outbox retries safe
  occurred_at TEXT,                              -- client event time (optional)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(owner_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_fleet_events_owner_product_type ON fleet_events(owner_id, product, type, created_at);
CREATE INDEX IF NOT EXISTS idx_fleet_events_owner_created ON fleet_events(owner_id, created_at);
