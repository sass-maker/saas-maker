-- Drop short_links, rename tables for clarity

DROP TABLE IF EXISTS short_links;

ALTER TABLE upvotes RENAME TO feedback_votes;
ALTER TABLE events RENAME TO analytics_events;
ALTER TABLE chunks RENAME TO document_chunks;
ALTER TABLE indexes RENAME TO knowledge_indexes;

-- Rename indexes that reference old table names
ALTER INDEX IF EXISTS idx_ai_requests_project_date RENAME TO idx_ai_requests_project_created;
