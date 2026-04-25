CREATE TABLE IF NOT EXISTS shield_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX idx_shield_key_ts ON shield_requests(key, ts);
