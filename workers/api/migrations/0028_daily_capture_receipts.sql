-- PII-free append-only receipts preserve each accepted feedback/capture event.
-- Existing rows are intentionally not backfilled: earlier subscription rejoin
-- history has already been collapsed by the current-row UPSERT.
CREATE TABLE daily_capture_coverage (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cutover_at TEXT NOT NULL
);

INSERT INTO daily_capture_coverage (id, cutover_at)
VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

CREATE TABLE daily_capture_receipts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('feedback', 'newsletter', 'waitlist')),
  occurred_at TEXT NOT NULL,
  india_day TEXT NOT NULL
);

CREATE INDEX idx_daily_capture_receipts_project_day
  ON daily_capture_receipts(project_id, india_day, event_type);

CREATE TRIGGER daily_capture_receipt_feedback_insert
AFTER INSERT ON feedback
BEGIN
  INSERT INTO daily_capture_receipts (id, project_id, event_type, occurred_at, india_day)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.project_id,
    'feedback',
    NEW.created_at,
    date(NEW.created_at, '+5 hours', '+30 minutes')
  );
END;

CREATE TRIGGER daily_capture_receipt_subscription_insert
AFTER INSERT ON capture_subscriptions
BEGIN
  INSERT INTO daily_capture_receipts (id, project_id, event_type, occurred_at, india_day)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.project_id,
    NEW.kind,
    NEW.created_at,
    date(NEW.created_at, '+5 hours', '+30 minutes')
  );
END;

CREATE TRIGGER daily_capture_receipt_subscription_rejoin
AFTER UPDATE OF state ON capture_subscriptions
WHEN OLD.state = 'unsubscribed' AND NEW.state = 'active'
BEGIN
  INSERT INTO daily_capture_receipts (id, project_id, event_type, occurred_at, india_day)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.project_id,
    NEW.kind,
    NEW.created_at,
    date(NEW.created_at, '+5 hours', '+30 minutes')
  );
END;
