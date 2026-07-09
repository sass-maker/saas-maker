//! CLI surface — replaces the Node `package.json` script entry points that are
//! pure glue. Each subcommand maps to a JS script:
//!   - `render`         → scripts/render-pro.js (one reel id; the production path)
//!   - `watch`          → scripts/auto-render-watcher.js (poll + render approved)
//!   - `plan`           → preview the variant plan + templates for a brief (new)
//!   - `validate-brief` → src/video-brief.js normalization, as a CLI lint
//!   - `score`          → src/reel-quality.js, ad-hoc scoring of a brief
//!   - `config`         → inspect resolved project-urls / social-accounts config
//!   - `autopilot`      → scripts/marketing-autopilot.js (intake → render → post)
//!
//! Network-heavy / live actions (`render`, `watch`) default to `--dry-run`,
//! printing the exact command that would run instead of executing it, so the
//! Rust CLI is safe to invoke without a render environment.

use std::path::PathBuf;

use clap::{Args, Parser, Subcommand};

#[derive(Debug, Parser)]
#[command(
    name = "reel",
    version,
    about = "Rust orchestrator for the reel-pipeline"
)]
pub struct Cli {
    /// Repo root (where scripts/ and config/ live). Defaults to the parent of
    /// the binary's working dir assumption: current dir.
    #[arg(long, global = true, default_value = ".")]
    pub repo_root: PathBuf,

    #[command(subcommand)]
    pub command: Command,
}

#[derive(Debug, Subcommand)]
pub enum Command {
    /// Render one reel id via scripts/render-pro.js (the production path).
    Render(RenderArgs),
    /// Poll the worker for approved-but-unrendered reels and render them.
    Watch(WatchArgs),
    /// Print the variant plan (templates + hooks) for a brief JSON file.
    Plan(BriefArgs),
    /// Validate/normalize a brief JSON file (lint the VideoBrief contract).
    ValidateBrief(BriefArgs),
    /// Score a brief JSON with the quality heuristics.
    Score(BriefArgs),
    /// Inspect resolved configuration (project URLs / social accounts shape).
    Config(ConfigArgs),
    /// Run one marketing autopilot tick (intake → render → post).
    Autopilot(AutopilotArgs),
    /// Render accepted marketing posts from the SaaS Maker queue.
    RenderAccepted(RenderAcceptedArgs),
    /// Post ready marketing videos (gate + YouTube/Instagram).
    Post(PostArgs),
    /// Backfill platform metrics for sent marketing videos.
    Metrics(MetricsArgs),
}

#[derive(Debug, Args)]
pub struct RenderArgs {
    /// Reel id(s) to render.
    #[arg(required = true)]
    pub reel_ids: Vec<String>,
    /// Variants per reel (1-3 for render-pro).
    #[arg(long, default_value_t = 1)]
    pub variant_count: usize,
    /// Print the command instead of running it.
    #[arg(long, default_value_t = true)]
    pub dry_run: bool,
    /// Actually run (overrides --dry-run). Requires a render environment.
    #[arg(long, default_value_t = false)]
    pub execute: bool,
}

#[derive(Debug, Args)]
pub struct WatchArgs {
    /// Worker base URL to poll (`REEL_WORKER_URL`).
    #[arg(long, env = "REEL_WORKER_URL")]
    pub worker_url: Option<String>,
    /// Poll interval in milliseconds (`REEL_WATCH_INTERVAL_MS`, min 5000).
    #[arg(long, env = "REEL_WATCH_INTERVAL_MS", default_value_t = 30_000)]
    pub interval_ms: u64,
    /// Max renders per poll tick (`REEL_WATCH_MAX_PER_TICK`, default 1).
    #[arg(long, env = "REEL_WATCH_MAX_PER_TICK", default_value_t = 1)]
    pub max_per_tick: usize,
    /// Variants per reel passed to render-pro (`REEL_VARIANT_COUNT`).
    #[arg(long, env = "REEL_VARIANT_COUNT", default_value_t = 1)]
    pub variant_count: usize,
    /// One tick then exit.
    #[arg(long, default_value_t = false)]
    pub once: bool,
    /// Print intended actions instead of polling/rendering.
    #[arg(long, default_value_t = true)]
    pub dry_run: bool,
    /// Actually poll the worker and run render-pro (overrides dry-run).
    #[arg(long, default_value_t = false)]
    pub execute: bool,
}

#[derive(Debug, Args)]
pub struct BriefArgs {
    /// Path to a brief JSON file (raw input shape).
    pub brief: PathBuf,
    /// Number of variants to plan/score.
    #[arg(long, default_value_t = 1)]
    pub variant_count: usize,
}

#[derive(Debug, Args)]
pub struct ConfigArgs {
    /// Which config to inspect.
    #[arg(value_enum)]
    pub which: ConfigKind,
    /// Optional explicit path; defaults to repo config/ locations.
    #[arg(long)]
    pub path: Option<PathBuf>,
}

#[derive(Debug, Clone, clap::ValueEnum)]
pub enum ConfigKind {
    ProjectUrls,
    SocialAccounts,
}

#[derive(Debug, Args)]
pub struct AutopilotArgs {
    /// Worker poll interval when running as a daemon (`AUTOPILOT_INTERVAL_MS`).
    #[arg(long, env = "AUTOPILOT_INTERVAL_MS", default_value_t = 60_000)]
    pub interval_ms: u64,
    /// Hold window before auto-accepting intake posts (`AUTOPILOT_HOLD_WINDOW_MS`).
    #[arg(long, env = "AUTOPILOT_HOLD_WINDOW_MS", default_value_t = 30 * 60_000)]
    pub hold_window_ms: u64,
    #[arg(long, env = "AUTOPILOT_INTAKE_STATUS", default_value = "pending")]
    pub intake_status: String,
    #[arg(long, env = "AUTOPILOT_CREATED_AT_FIELD", default_value = "created_at")]
    pub created_at_field: String,
    #[arg(long, env = "AUTOPILOT_LIMIT", default_value_t = 10)]
    pub limit: usize,
    #[arg(long, env = "REEL_RENDER_MODE", default_value = "mock")]
    pub render_mode: String,
    /// One tick then exit.
    #[arg(long, default_value_t = false)]
    pub once: bool,
    /// Print actions without calling SaaS Maker / render / post backends.
    #[arg(long, default_value_t = true)]
    pub dry_run: bool,
    /// Actually run intake, render, and post phases.
    #[arg(long, default_value_t = false)]
    pub execute: bool,
    /// Fixture JSON path (local stub client; no live SaaS Maker calls).
    #[arg(long)]
    pub fixture: Option<PathBuf>,
    /// Posting backend: `manual` (prepared only) or `auto` (YouTube/Instagram from config).
    #[arg(long, env = "REEL_POST_PROVIDER", default_value = "auto")]
    pub posting_provider: String,
}

#[derive(Debug, Args)]
pub struct PostArgs {
    #[arg(long, env = "REEL_POST_LIMIT", default_value_t = 5)]
    pub limit: usize,
    #[arg(long)]
    pub project_slug: Option<String>,
    #[arg(long)]
    pub channel: Option<String>,
    #[arg(long, default_value_t = true)]
    pub include_unscheduled: bool,
    /// Only post accepted rendered items whose scheduled time is already past.
    #[arg(long, default_value_t = false)]
    pub missed_only: bool,
    #[arg(long, default_value_t = true)]
    pub dry_run: bool,
    #[arg(long, default_value_t = false)]
    pub execute: bool,
    /// Backward-compatible alias used by older npm examples. `npm run post:ready`
    /// already includes `--execute`, so this flag is accepted for CLI stability.
    #[arg(long, default_value_t = false)]
    pub confirm_post: bool,
    #[arg(long, env = "REEL_POST_PROVIDER", default_value = "auto")]
    pub posting_provider: String,
    #[arg(long)]
    pub fixture: Option<PathBuf>,
}

#[derive(Debug, Args)]
pub struct MetricsArgs {
    #[arg(long, env = "REEL_METRICS_LIMIT", default_value_t = 20)]
    pub limit: usize,
    #[arg(long)]
    pub project_slug: Option<String>,
    #[arg(long)]
    pub channel: Option<String>,
    #[arg(long, env = "REEL_METRICS_STATUS", default_value = "sent")]
    pub status: String,
    #[arg(long, default_value_t = true)]
    pub dry_run: bool,
    #[arg(long, default_value_t = false)]
    pub execute: bool,
    #[arg(long)]
    pub fixture: Option<PathBuf>,
}

#[derive(Debug, Args)]
pub struct RenderAcceptedArgs {
    #[arg(
        long,
        visible_alias = "mode",
        env = "REEL_RENDER_MODE",
        default_value = "mock"
    )]
    pub render_mode: String,
    #[arg(long, env = "REEL_RENDER_LIMIT", default_value_t = 5)]
    pub limit: usize,
    #[arg(long)]
    pub project_slug: Option<String>,
    #[arg(long)]
    pub channel: Option<String>,
    #[arg(long, default_value_t = 60)]
    pub poll_limit: u32,
    #[arg(long, default_value_t = 2000)]
    pub poll_interval_ms: u64,
    #[arg(long, default_value_t = true)]
    pub dry_run: bool,
    #[arg(long, default_value_t = false)]
    pub execute: bool,
    #[arg(long)]
    pub fixture: Option<PathBuf>,
    /// R2 bucket for publishing local render artifacts.
    #[arg(long, env = "REEL_ARTIFACT_R2_BUCKET")]
    pub artifact_r2_bucket: Option<String>,
    /// Public base URL that serves artifacts from the bucket.
    #[arg(
        long,
        env = "REEL_ARTIFACT_PUBLIC_BASE_URL",
        visible_alias = "artifact_base_url"
    )]
    pub artifact_base_url: Option<String>,
}
