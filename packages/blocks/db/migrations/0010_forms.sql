-- Forms / surveys module

CREATE TABLE IF NOT EXISTS forms (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  theme JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, slug)
);

CREATE TABLE IF NOT EXISTS form_questions (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  required BOOLEAN NOT NULL DEFAULT false,
  options JSONB DEFAULT '{}',
  order_index INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS form_responses (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS form_answers (
  id TEXT PRIMARY KEY,
  response_id TEXT NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES form_questions(id) ON DELETE CASCADE,
  value TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_forms_project ON forms(project_id);
CREATE INDEX IF NOT EXISTS idx_form_questions_form ON form_questions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_form ON form_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_form_answers_response ON form_answers(response_id);
CREATE INDEX IF NOT EXISTS idx_form_answers_question ON form_answers(question_id);
