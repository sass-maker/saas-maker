-- D1 (SQLite) schema for SaaS Maker
-- Consolidated from 18 CockroachDB/PostgreSQL migrations

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  api_key TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL REFERENCES users(id),
  embedding_model TEXT,
  ai_base_url TEXT,
  ai_api_key TEXT,
  ai_model TEXT,
  rate_limit_rpm INTEGER NOT NULL DEFAULT 60,
  rate_limit_enabled INTEGER NOT NULL DEFAULT 1,
  readme TEXT,
  source TEXT NOT NULL DEFAULT 'dashboard',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('bug','feature','feedback')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','done','dismissed','planned','shipped','cancelled')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  submitter_email TEXT NOT NULL,
  submitter_name TEXT,
  upvote_count INTEGER NOT NULL DEFAULT 0,
  downvote_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE feedback_votes (
  id TEXT PRIMARY KEY,
  feedback_id TEXT NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  vote INTEGER NOT NULL DEFAULT 1 CHECK (vote IN (1,-1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(feedback_id, user_id)
);

CREATE TABLE knowledge_indexes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  external_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, name)
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  index_id TEXT NOT NULL REFERENCES knowledge_indexes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  index_id TEXT NOT NULL REFERENCES knowledge_indexes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE waitlist_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, email)
);

CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'page_view',
  url TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  country TEXT,
  device TEXT,
  browser TEXT,
  screen_width INTEGER,
  properties TEXT DEFAULT '{}',
  os TEXT,
  is_bot INTEGER NOT NULL DEFAULT 0,
  session_id TEXT,
  pathname TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE testimonials (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  author_avatar_url TEXT,
  author_title TEXT,
  content TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  image_url TEXT,
  tweet_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE cli_auth_codes (
  code TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','expired')),
  token TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE cli_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'cli',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE changelog_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version TEXT,
  type TEXT NOT NULL DEFAULT 'improvement' CHECK (type IN ('feature','improvement','fix','breaking')),
  published INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE forms (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed')),
  theme TEXT DEFAULT '{}',
  settings TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, slug)
);

CREATE TABLE form_questions (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  required INTEGER NOT NULL DEFAULT 0,
  options TEXT DEFAULT '{}',
  order_index INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE form_responses (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT DEFAULT '{}'
);

CREATE TABLE form_answers (
  id TEXT PRIMARY KEY,
  response_id TEXT NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES form_questions(id) ON DELETE CASCADE,
  value TEXT
);

CREATE TABLE ai_requests (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success','error','timeout')),
  latency_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE roadmap_items (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  feedback_id TEXT REFERENCES feedback(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  "column" TEXT NOT NULL DEFAULT 'backlog',
  position INTEGER NOT NULL DEFAULT 0,
  public INTEGER NOT NULL DEFAULT 1,
  upvote_count INTEGER NOT NULL DEFAULT 0,
  downvote_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE roadmap_votes (
  id TEXT PRIMARY KEY,
  roadmap_item_id TEXT NOT NULL REFERENCES roadmap_items(id) ON DELETE CASCADE,
  user_identifier TEXT NOT NULL,
  vote INTEGER NOT NULL CHECK (vote IN (1,-1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(roadmap_item_id, user_identifier)
);

CREATE TABLE directory_listings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  screenshot_url TEXT,
  twitter_url TEXT,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  badge_verified INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- feedback
CREATE INDEX idx_feedback_project ON feedback(project_id);
CREATE INDEX idx_feedback_project_status ON feedback(project_id, status);
CREATE INDEX idx_feedback_project_upvotes ON feedback(project_id, upvote_count DESC);
CREATE INDEX idx_feedback_project_type_status ON feedback(project_id, type, status);

-- feedback_votes
CREATE INDEX idx_feedback_votes_feedback ON feedback_votes(feedback_id);

-- projects
CREATE INDEX idx_projects_owner ON projects(owner_id);

-- sessions
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- knowledge_indexes
CREATE INDEX idx_indexes_project ON knowledge_indexes(project_id);

-- documents
CREATE INDEX idx_documents_index ON documents(index_id);

-- document_chunks
CREATE INDEX idx_chunks_index ON document_chunks(index_id);
CREATE INDEX idx_chunks_document ON document_chunks(document_id);

-- waitlist_entries
CREATE INDEX idx_waitlist_project ON waitlist_entries(project_id);
CREATE INDEX idx_waitlist_position ON waitlist_entries(project_id, position);

-- analytics_events
CREATE INDEX idx_analytics_events_project ON analytics_events(project_id);
CREATE INDEX idx_analytics_events_project_created ON analytics_events(project_id, created_at);
CREATE INDEX idx_analytics_events_project_name ON analytics_events(project_id, name);
CREATE INDEX idx_analytics_events_bot ON analytics_events(project_id, is_bot, created_at);
CREATE INDEX idx_analytics_events_session ON analytics_events(project_id, session_id);

-- testimonials
CREATE INDEX idx_testimonials_project ON testimonials(project_id);
CREATE INDEX idx_testimonials_project_status ON testimonials(project_id, status);

-- cli_tokens
CREATE INDEX idx_cli_tokens_user ON cli_tokens(user_id);

-- changelog_entries
CREATE INDEX idx_changelog_project ON changelog_entries(project_id);
CREATE INDEX idx_changelog_published ON changelog_entries(project_id, published);

-- forms
CREATE INDEX idx_forms_project ON forms(project_id);

-- form_questions
CREATE INDEX idx_form_questions_form ON form_questions(form_id);

-- form_responses
CREATE INDEX idx_form_responses_form ON form_responses(form_id);

-- form_answers
CREATE INDEX idx_form_answers_response ON form_answers(response_id);
CREATE INDEX idx_form_answers_question ON form_answers(question_id);

-- ai_requests
CREATE INDEX idx_ai_requests_project_date ON ai_requests(project_id, created_at DESC);

-- roadmap_items
CREATE INDEX idx_roadmap_items_project ON roadmap_items(project_id);
CREATE INDEX idx_roadmap_items_project_column ON roadmap_items(project_id, "column", position);
CREATE INDEX idx_roadmap_items_feedback ON roadmap_items(feedback_id);

-- roadmap_votes
CREATE INDEX idx_roadmap_votes_item ON roadmap_votes(roadmap_item_id);

-- directory_listings
CREATE INDEX idx_directory_status ON directory_listings(status);
CREATE INDEX idx_directory_project ON directory_listings(project_id);
CREATE INDEX idx_directory_created ON directory_listings(created_at DESC);
