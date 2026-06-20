-- Task-queue primitive: turn the Symphony tasks table into a polling work-queue
-- that heterogeneous workers (local or cron-deployed) claim from on wake.
-- See docs/plans/2026-06-19-fleet-events-hub-spec.md §9.
-- Status stays 'todo'/'in_progress'/'done' (no CHECK rebuild): pending = todo + claimed_by IS NULL,
-- claimed = in_progress + claimed_by + lease_until, done = done, dead = dead_letter = 1.
ALTER TABLE tasks ADD COLUMN capability TEXT;            -- which worker type handles it (review/audit/judge/ideas/...)
ALTER TABLE tasks ADD COLUMN claimed_by TEXT;            -- worker id holding the lease
ALTER TABLE tasks ADD COLUMN lease_until TEXT;           -- lease expiry; expired claims are reclaimable
ALTER TABLE tasks ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN last_error TEXT;
ALTER TABLE tasks ADD COLUMN dead_letter INTEGER NOT NULL DEFAULT 0;

-- Claimability lookup: filter by capability + status, skip dead-lettered.
CREATE INDEX IF NOT EXISTS idx_tasks_claimable ON tasks(owner_id, capability, status, dead_letter, lease_until);
