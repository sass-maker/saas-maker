-- AI Mention Check config (one per project)
CREATE TABLE IF NOT EXISTS ai_mention_configs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  brand_aliases TEXT NOT NULL DEFAULT '[]',
  brand_url TEXT,
  competitors TEXT NOT NULL DEFAULT '[]',
  platforms TEXT NOT NULL DEFAULT '["openai","anthropic","google","perplexity"]',
  openai_api_key TEXT,
  anthropic_api_key TEXT,
  google_api_key TEXT,
  perplexity_api_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id)
);

-- Saved prompts (reusable across checks)
CREATE TABLE IF NOT EXISTS ai_mention_prompts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  category TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_ai_mention_prompts_project ON ai_mention_prompts(project_id);

-- Check runs (one per button click)
CREATE TABLE IF NOT EXISTS ai_mention_checks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running',
  total_queries INTEGER NOT NULL DEFAULT 0,
  completed_queries INTEGER NOT NULL DEFAULT 0,
  brand_mention_rate REAL,
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX idx_ai_mention_checks_project ON ai_mention_checks(project_id, created_at DESC);

-- Individual results (one per prompt x platform)
CREATE TABLE IF NOT EXISTS ai_mention_results (
  id TEXT PRIMARY KEY,
  check_id TEXT NOT NULL REFERENCES ai_mention_checks(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  prompt_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  model TEXT NOT NULL,
  response_text TEXT NOT NULL,
  brand_mentioned INTEGER NOT NULL DEFAULT 0,
  brand_sentiment TEXT,
  brand_position INTEGER,
  competitors_mentioned TEXT NOT NULL DEFAULT '[]',
  citations TEXT NOT NULL DEFAULT '[]',
  brand_cited INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_ai_mention_results_check ON ai_mention_results(check_id);
