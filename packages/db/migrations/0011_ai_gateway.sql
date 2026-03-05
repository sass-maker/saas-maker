-- AI Gateway: provider config on projects + request logging

ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_base_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_api_key TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_model TEXT;

CREATE TABLE IF NOT EXISTS ai_requests (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout')),
  latency_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_requests_project_date ON ai_requests(project_id, created_at DESC);
