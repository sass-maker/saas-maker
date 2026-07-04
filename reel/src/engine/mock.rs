//! Mock render engine — port of `src/adapters/mock-renderer.js`.
//!
//! Writes a placeholder mp4 + manifest under the artifact dir and reports a
//! completed render. Used for fast no-dependency end-to-end tests and dry runs.

use std::path::PathBuf;

use anyhow::{Context, Result};

use crate::brief::VideoBrief;
use crate::engine::{RenderEngine, RenderOptions, RenderResult, RenderStatus};

pub struct MockEngine {
    artifact_dir: PathBuf,
    /// Deterministic suffix override for tests (replaces the JS `Date.now()`).
    task_suffix: Option<String>,
}

impl MockEngine {
    pub fn new(artifact_dir: impl Into<PathBuf>) -> Self {
        Self {
            artifact_dir: artifact_dir.into(),
            task_suffix: None,
        }
    }

    pub fn with_task_suffix(mut self, suffix: impl Into<String>) -> Self {
        self.task_suffix = Some(suffix.into());
        self
    }

    fn task_id(&self, brief_id: &str) -> String {
        let suffix = self
            .task_suffix
            .clone()
            .unwrap_or_else(|| now_millis().to_string());
        format!("mock_{brief_id}_{suffix}")
    }
}

impl RenderEngine for MockEngine {
    fn name(&self) -> &str {
        "mock"
    }

    fn create_video(&self, brief: &VideoBrief, _options: &RenderOptions) -> Result<RenderResult> {
        let task_id = self.task_id(&brief.id);
        let dir = self.artifact_dir.join(&task_id);
        std::fs::create_dir_all(&dir).with_context(|| format!("creating {}", dir.display()))?;
        let video_path = dir.join("draft.mp4");
        std::fs::write(
            &video_path,
            format!("mock mp4 placeholder for {}\n", brief.title),
        )?;
        let manifest = serde_json::json!({
            "taskId": task_id,
            "brief": brief,
            "videoPath": video_path,
            "status": "completed",
        });
        std::fs::write(
            dir.join("manifest.json"),
            serde_json::to_string_pretty(&manifest)?,
        )?;

        let mut result = RenderResult::completed("mock", &task_id);
        result.videos = vec![video_path.to_string_lossy().into_owned()];
        result.status = RenderStatus::Completed;
        Ok(result)
    }

    fn render_reel_by_id(&self, reel_id: &str, options: &RenderOptions) -> Result<RenderResult> {
        // No worker record in mock mode; synthesize a minimal brief-less result.
        let task_id = self.task_id(reel_id);
        let dir = self.artifact_dir.join(&task_id);
        std::fs::create_dir_all(&dir)?;
        let video_path = dir.join("draft.mp4");
        std::fs::write(&video_path, format!("mock mp4 placeholder for {reel_id}\n"))?;
        let mut result = RenderResult::completed("mock", &task_id);
        result.videos = vec![video_path.to_string_lossy().into_owned()];
        if let Some(v) = &options.variant_id {
            result.render_log.push(format!("variant={v}"));
        }
        Ok(result)
    }
}

fn now_millis() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn brief() -> VideoBrief {
        crate::brief::normalize_from_value(&serde_json::json!({
            "id": "b1",
            "project_slug": "x",
            "channel": "blog",
            "title": "Hello",
            "hook": "Hook",
            "body": "body"
        }))
        .unwrap()
    }

    #[test]
    fn mock_writes_placeholder_and_reports_completed() {
        let tmp = tempfile::tempdir().unwrap();
        let engine = MockEngine::new(tmp.path()).with_task_suffix("fixed");
        let result = engine
            .create_video(&brief(), &RenderOptions::default())
            .unwrap();
        assert_eq!(result.status, RenderStatus::Completed);
        assert_eq!(result.external_task_id, "mock_b1_fixed");
        let video = &result.videos[0];
        assert!(std::path::Path::new(video).exists());
        let contents = std::fs::read_to_string(video).unwrap();
        assert!(contents.contains("Hello"));
        assert!(tmp.path().join("mock_b1_fixed/manifest.json").exists());
    }
}
