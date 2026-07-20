//! Grok/Imagine local video adapter.
//!
//! This adapter does not call Grok or require credentials. It packages already
//! generated MP4s from a local asset directory into the normal render-result
//! shape so the existing artifact publisher can upload them.

use std::path::{Path, PathBuf};

use anyhow::{anyhow, Context, Result};

use crate::brief::VideoBrief;
use crate::engine::{RenderEngine, RenderOptions, RenderResult};

pub struct GrokVideoEngine {
    asset_dir: Option<PathBuf>,
    artifact_dir: PathBuf,
    task_suffix: Option<String>,
}

impl GrokVideoEngine {
    pub fn from_env(repo_root: &Path) -> Self {
        Self {
            asset_dir: std::env::var("GROK_VIDEO_ASSET_DIR")
                .ok()
                .filter(|s| !s.trim().is_empty())
                .map(PathBuf::from),
            artifact_dir: std::env::var("REEL_GROK_VIDEO_ARTIFACT_DIR")
                .ok()
                .filter(|s| !s.trim().is_empty())
                .map(PathBuf::from)
                .unwrap_or_else(|| repo_root.join(".reel-pipeline/grok-video")),
            task_suffix: None,
        }
    }

    pub fn new(asset_dir: impl Into<PathBuf>, artifact_dir: impl Into<PathBuf>) -> Self {
        Self {
            asset_dir: Some(asset_dir.into()),
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
        format!("grok_{}_{}", stable_slug(brief_id), suffix)
    }

    fn select_source_video(&self, brief: &VideoBrief) -> Result<PathBuf> {
        if let Some(path) = local_video_path(brief.recording_url.as_deref()) {
            return Ok(path);
        }

        let asset_dir = self.asset_dir.as_ref().ok_or_else(|| {
            anyhow!("grok-video renderer requires GROK_VIDEO_ASSET_DIR with at least one .mp4")
        })?;
        let mut videos = Vec::new();
        list_mp4s(asset_dir, &mut videos)?;
        videos.sort();
        if videos.is_empty() {
            return Err(anyhow!(
                "grok-video renderer requires GROK_VIDEO_ASSET_DIR with at least one .mp4"
            ));
        }

        let text = format!(
            "{} {} {} {} {} {}",
            brief.project_slug,
            brief.title,
            brief.hook,
            brief.body,
            brief.cta.as_deref().unwrap_or_default(),
            brief.audience.as_deref().unwrap_or_default()
        );
        let mut scored: Vec<(usize, PathBuf)> = videos
            .iter()
            .cloned()
            .map(|video| {
                let name = video
                    .file_name()
                    .and_then(|v| v.to_str())
                    .unwrap_or_default();
                (match_score(&text, name), video)
            })
            .collect();
        scored.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.cmp(&b.1)));
        if scored[0].0 > 0 {
            return Ok(scored[0].1.clone());
        }

        Ok(videos[stable_index(&brief.id, videos.len())].clone())
    }
}

impl RenderEngine for GrokVideoEngine {
    fn name(&self) -> &str {
        "grok-video"
    }

    fn create_video(&self, brief: &VideoBrief, _options: &RenderOptions) -> Result<RenderResult> {
        let source = self.select_source_video(brief)?;
        let task_id = self.task_id(&brief.id);
        let dir = self.artifact_dir.join(&task_id);
        std::fs::create_dir_all(&dir).with_context(|| format!("creating {}", dir.display()))?;

        let ext = source.extension().and_then(|v| v.to_str()).unwrap_or("mp4");
        let video_path = dir.join(format!(
            "{}-{}.{}",
            stable_slug(&brief.project_slug),
            stable_slug(&brief.id),
            ext
        ));
        std::fs::copy(&source, &video_path)
            .with_context(|| format!("copying {} to {}", source.display(), video_path.display()))?;

        let mut result = RenderResult::completed("grok-video", &task_id);
        result.videos = vec![video_path.to_string_lossy().into_owned()];
        result.proof_type = Some("recording".into());
        if let Ok(meta) = std::fs::metadata(&source) {
            result.render_log.push(format!("bytes={}", meta.len()));
        }
        result.render_log.push(format!(
            "source={}",
            source
                .file_name()
                .and_then(|v| v.to_str())
                .unwrap_or("video.mp4")
        ));
        Ok(result)
    }

    fn render_reel_by_id(&self, reel_id: &str, options: &RenderOptions) -> Result<RenderResult> {
        let brief = VideoBrief {
            id: reel_id.to_string(),
            project_slug: reel_id.to_string(),
            task_id: None,
            marketing_post_id: None,
            channel: "youtube_shorts".into(),
            title: reel_id.to_string(),
            hook: reel_id.to_string(),
            body: "Script: local Grok video. Shot list: imported video. Captions: imported. Asset prompts: Grok Imagine MP4.".into(),
            cta: None,
            audience: None,
            product_url: None,
            proof_url: None,
            target_route: None,
            recording_url: None,
            changelog_entry_id: None,
            brand_tone: None,
            proof_type: Some("recording".into()),
            template: None,
            screenshots: None,
            demo_steps: None,
            render_mode: "grok-video".into(),
            duration_seconds: 20.0,
        };
        self.create_video(&brief, options)
    }

    fn get_status(&self, external_task_id: &str) -> Result<RenderResult> {
        let dir = self.artifact_dir.join(external_task_id);
        let videos = std::fs::read_dir(&dir)
            .with_context(|| format!("reading {}", dir.display()))?
            .filter_map(|entry| entry.ok().map(|e| e.path()))
            .filter(|path| {
                path.extension()
                    .and_then(|v| v.to_str())
                    .map(|e| e.eq_ignore_ascii_case("mp4"))
                    .unwrap_or(false)
            })
            .map(|path| path.to_string_lossy().into_owned())
            .collect();
        let mut result = RenderResult::completed("grok-video", external_task_id);
        result.videos = videos;
        result.proof_type = Some("recording".into());
        Ok(result)
    }
}

fn local_video_path(value: Option<&str>) -> Option<PathBuf> {
    let value = value?.trim();
    if value.is_empty() {
        return None;
    }
    let path = value.strip_prefix("file://").unwrap_or(value);
    let path = PathBuf::from(path);
    if path.is_absolute()
        && path
            .extension()
            .and_then(|v| v.to_str())
            .map(|e| matches!(e.to_ascii_lowercase().as_str(), "mp4" | "mov" | "webm"))
            .unwrap_or(false)
    {
        Some(path)
    } else {
        None
    }
}

fn list_mp4s(root: &Path, out: &mut Vec<PathBuf>) -> Result<()> {
    for entry in std::fs::read_dir(root).with_context(|| format!("reading {}", root.display()))? {
        let path = entry?.path();
        if path.is_dir() {
            list_mp4s(&path, out)?;
        } else if path
            .extension()
            .and_then(|v| v.to_str())
            .map(|e| e.eq_ignore_ascii_case("mp4"))
            .unwrap_or(false)
        {
            out.push(path);
        }
    }
    Ok(())
}

fn match_score(text: &str, file_name: &str) -> usize {
    let haystack = tokens(text);
    tokens(file_name)
        .into_iter()
        .filter(|token| haystack.contains(token))
        .map(|token| token.len())
        .sum()
}

fn tokens(value: &str) -> Vec<String> {
    value
        .to_ascii_lowercase()
        .split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|token| token.len() > 2)
        .map(str::to_string)
        .collect()
}

fn stable_index(value: &str, length: usize) -> usize {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in value.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    (hash as usize) % length
}

fn stable_slug(value: &str) -> String {
    let mut slug = String::new();
    let mut last_dash = false;
    for ch in value.to_ascii_lowercase().chars() {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch);
            last_dash = false;
        } else if !last_dash && !slug.is_empty() {
            slug.push('-');
            last_dash = true;
        }
        if slug.len() >= 80 {
            break;
        }
    }
    while slug.ends_with('-') {
        slug.pop();
    }
    if slug.is_empty() {
        "video".into()
    } else {
        slug
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
            "id": "space-brief",
            "project_slug": "science",
            "channel": "tiktok",
            "title": "Cosmic scale",
            "hook": "Space is huge",
            "body": "Script: open. Shot list: space. Captions: scale. Asset prompts: cosmic space video.",
            "renderMode": "grok-video"
        }))
        .unwrap()
    }

    #[test]
    fn grok_video_copies_asset_and_reports_completed_status() {
        let assets = tempfile::tempdir().unwrap();
        let artifacts = tempfile::tempdir().unwrap();
        std::fs::write(assets.path().join("space-grok-imagine.mp4"), b"fake mp4").unwrap();
        std::fs::write(assets.path().join("atom-grok-imagine.mp4"), b"other mp4").unwrap();

        let engine =
            GrokVideoEngine::new(assets.path(), artifacts.path()).with_task_suffix("fixed");
        let result = engine
            .create_video(&brief(), &RenderOptions::default())
            .unwrap();

        assert_eq!(result.provider, "grok-video");
        assert_eq!(result.external_task_id, "grok_space-brief_fixed");
        assert!(result.videos[0].ends_with(".mp4"));
        assert!(std::path::Path::new(&result.videos[0]).exists());
        assert!(result
            .render_log
            .iter()
            .any(|line| line.contains("space-grok-imagine.mp4")));

        let status = engine.get_status(&result.external_task_id).unwrap();
        assert_eq!(status.provider, "grok-video");
        assert_eq!(status.videos.len(), 1);
    }
}
