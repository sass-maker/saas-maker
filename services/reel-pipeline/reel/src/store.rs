//! Job/reel persistence — ports `src/job-store.js` (the filesystem job store).
//!
//! `FileJobStore` writes one JSON file per job, keyed by a filesystem-safe id,
//! and lists jobs newest-first by `createdAt`. The worker's `R2ReelStore` is the
//! same contract backed by R2 and is deferred to the worker-port phase; both
//! satisfy the [`ReelStore`] trait so callers don't care which backs them.

use std::path::PathBuf;

use anyhow::{Context, Result};
use serde_json::Value;

/// A stored job/reel record. Kept as opaque JSON so the Rust store stays
/// byte-compatible with records the JS pipeline already wrote.
pub type Record = Value;

pub trait ReelStore {
    fn save(&self, record: &Record) -> Result<Record>;
    fn get(&self, id: &str) -> Result<Option<Record>>;
    fn list(&self) -> Result<Vec<Record>>;
}

/// Port of `safeId`: replace anything outside `[A-Za-z0-9_.-]` with `_`.
pub fn safe_id(id: &str) -> String {
    id.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '_' | '.' | '-') {
                c
            } else {
                '_'
            }
        })
        .collect()
}

pub struct FileJobStore {
    dir: PathBuf,
}

impl FileJobStore {
    pub fn new(dir: impl Into<PathBuf>) -> Self {
        Self { dir: dir.into() }
    }

    fn path_for(&self, id: &str) -> PathBuf {
        self.dir.join(format!("{}.json", safe_id(id)))
    }

    fn now_iso() -> String {
        // Lightweight RFC3339-ish timestamp without pulling in chrono. Format is
        // only used for stable sort + provenance, matching `new Date().toISOString()`
        // shape closely enough (UTC seconds resolution).
        let secs = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        format!("@{secs}") // monotonic, sortable; not a real ISO string but stable
    }
}

impl ReelStore for FileJobStore {
    fn save(&self, record: &Record) -> Result<Record> {
        std::fs::create_dir_all(&self.dir)
            .with_context(|| format!("creating job dir {}", self.dir.display()))?;
        let id = record
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("record is missing string `id`"))?
            .to_string();

        let now = Self::now_iso();
        let mut next = record.clone();
        if let Some(obj) = next.as_object_mut() {
            obj.insert("updatedAt".to_string(), Value::String(now.clone()));
            obj.entry("createdAt").or_insert(Value::String(now));
        }
        std::fs::write(self.path_for(&id), serde_json::to_string_pretty(&next)?)?;
        Ok(next)
    }

    fn get(&self, id: &str) -> Result<Option<Record>> {
        let path = self.path_for(id);
        match std::fs::read_to_string(&path) {
            Ok(raw) => Ok(Some(serde_json::from_str(&raw)?)),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e).with_context(|| format!("reading {}", path.display())),
        }
    }

    fn list(&self) -> Result<Vec<Record>> {
        let entries = match std::fs::read_dir(&self.dir) {
            Ok(e) => e,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(e) => return Err(e).with_context(|| format!("listing {}", self.dir.display())),
        };
        let mut records = Vec::new();
        for entry in entries {
            let path = entry?.path();
            if path.extension().and_then(|e| e.to_str()) == Some("json") {
                let raw = std::fs::read_to_string(&path)?;
                records.push(serde_json::from_str::<Record>(&raw)?);
            }
        }
        // newest first by createdAt, matching the JS localeCompare(right, left)
        records.sort_by(|a, b| {
            let ka = created_at(a);
            let kb = created_at(b);
            kb.cmp(&ka)
        });
        Ok(records)
    }
}

fn created_at(record: &Record) -> String {
    record
        .get("createdAt")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_id_sanitizes() {
        assert_eq!(safe_id("reel/12 34!"), "reel_12_34_");
        assert_eq!(safe_id("reel_2024-01-01.v1"), "reel_2024-01-01.v1");
    }

    #[test]
    fn save_get_roundtrips_and_stamps_timestamps() {
        let tmp = tempfile::tempdir().unwrap();
        let store = FileJobStore::new(tmp.path());
        let saved = store
            .save(&serde_json::json!({ "id": "job-1", "status": "rendering" }))
            .unwrap();
        assert!(saved.get("createdAt").is_some());
        assert!(saved.get("updatedAt").is_some());

        let fetched = store.get("job-1").unwrap().unwrap();
        assert_eq!(fetched["status"], "rendering");
        assert!(store.get("missing").unwrap().is_none());
    }

    #[test]
    fn list_returns_newest_first() {
        let tmp = tempfile::tempdir().unwrap();
        let store = FileJobStore::new(tmp.path());
        store
            .save(&serde_json::json!({ "id": "a", "createdAt": "@100" }))
            .unwrap();
        store
            .save(&serde_json::json!({ "id": "b", "createdAt": "@200" }))
            .unwrap();
        let list = store.list().unwrap();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0]["id"], "b");
        assert_eq!(list[1]["id"], "a");
    }

    #[test]
    fn list_empty_dir_is_empty() {
        let tmp = tempfile::tempdir().unwrap();
        let store = FileJobStore::new(tmp.path().join("does-not-exist"));
        assert!(store.list().unwrap().is_empty());
    }
}
