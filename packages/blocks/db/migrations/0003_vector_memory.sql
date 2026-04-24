-- Vector memory service tables

ALTER TABLE projects ADD COLUMN IF NOT EXISTS embedding_model TEXT;

CREATE TABLE IF NOT EXISTS indexes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  index_id TEXT NOT NULL REFERENCES indexes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  index_id TEXT NOT NULL REFERENCES indexes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR NOT NULL,
  chunk_index INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_indexes_project ON indexes(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_index ON documents(index_id);
CREATE INDEX IF NOT EXISTS idx_chunks_index ON chunks(index_id);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
