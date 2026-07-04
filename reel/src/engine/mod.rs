//! Render-engine interface.
//!
//! The heavy lifting (actual video render) stays *behind* this trait. Phase 1
//! ships two concrete impls:
//!  - [`render_pro::RenderProEngine`] — the ONE production path, shelling out to
//!    the existing `scripts/render-pro.js` (Chrome CDP scroll-tour + Edge TTS +
//!    ffmpeg + `wrangler r2 object put`). We do NOT reimplement any of that in
//!    Rust; we orchestrate it.
//!  - [`mock::MockEngine`] — writes a placeholder, for tests / dry runs.
//!
//! MoneyPrinterTurbo (HTTP API adapter) and reel-maker (Remotion shell-out) are
//! deferred to later phases (see PLAN.md); their trait shape is identical so
//! they slot in without touching callers.

pub mod ascii_animation;
pub mod factory;
pub mod grok_video;
pub mod html_composition;
pub mod mock;
pub mod money_printer;
pub mod render_pro;

use std::path::PathBuf;

use anyhow::Result;

use crate::brief::VideoBrief;

/// Outcome status of a render, matching the JS render-result `status` field.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RenderStatus {
    Queued,
    Running,
    Completed,
    Failed,
}

impl RenderStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            RenderStatus::Queued => "queued",
            RenderStatus::Running => "running",
            RenderStatus::Completed => "completed",
            RenderStatus::Failed => "failed",
        }
    }
}

/// A normalized render result, the common shape every adapter returns in JS.
#[derive(Debug, Clone)]
pub struct RenderResult {
    pub provider: String,
    pub external_task_id: String,
    pub status: RenderStatus,
    /// Local paths or URLs to produced videos.
    pub videos: Vec<String>,
    pub combined_videos: Vec<String>,
    pub thumbnail: Option<PathBuf>,
    pub duration_seconds: Option<f64>,
    pub aspect: String,
    pub proof_type: Option<String>,
    pub render_log: Vec<String>,
}

impl RenderResult {
    pub fn completed(provider: &str, task_id: &str) -> Self {
        Self {
            provider: provider.to_string(),
            external_task_id: task_id.to_string(),
            status: RenderStatus::Completed,
            videos: Vec::new(),
            combined_videos: Vec::new(),
            thumbnail: None,
            duration_seconds: None,
            aspect: "9:16".to_string(),
            proof_type: None,
            render_log: Vec::new(),
        }
    }
}

/// Options threaded into a single render invocation.
#[derive(Debug, Clone, Default)]
pub struct RenderOptions {
    pub variant_id: Option<String>,
    pub variant_count: usize,
    pub template: Option<String>,
    pub hook: Option<String>,
    pub cta: Option<String>,
}

/// The engine interface. One concrete impl shells out to the real renderer.
pub trait RenderEngine {
    fn name(&self) -> &str;

    /// Render from a normalized brief (the autopilot / marketing flow).
    fn create_video(&self, brief: &VideoBrief, options: &RenderOptions) -> Result<RenderResult>;

    /// Render a worker-stored reel by id (the production render-pro flow). The
    /// renderer fetches/patches the reel record itself, so all we pass is the id.
    fn render_reel_by_id(&self, reel_id: &str, options: &RenderOptions) -> Result<RenderResult>;

    /// Poll an async render task (MoneyPrinterTurbo). Default impl errors.
    fn get_status(&self, external_task_id: &str) -> Result<RenderResult> {
        let _ = external_task_id;
        Err(anyhow::anyhow!(
            "get_status not supported by {}",
            self.name()
        ))
    }
}
