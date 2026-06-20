//! CLI surface — replaces the Node `package.json` script entry points that are
//! pure glue. Each subcommand maps to a JS script:
//!   - `render`         → scripts/render-pro.js (one reel id; the production path)
//!   - `watch`          → scripts/auto-render-watcher.js (poll + render approved)
//!   - `plan`           → preview the variant plan + templates for a brief (new)
//!   - `validate-brief` → src/video-brief.js normalization, as a CLI lint
//!   - `score`          → src/reel-quality.js, ad-hoc scoring of a brief
//!   - `config`         → inspect resolved project-urls / social-accounts config
//!
//! Network-heavy / live actions (`render`, `watch`) default to `--dry-run`,
//! printing the exact command that would run instead of executing it, so the
//! Rust CLI is safe to invoke without a render environment.

use std::path::PathBuf;

use clap::{Args, Parser, Subcommand};

#[derive(Debug, Parser)]
#[command(name = "reel", version, about = "Rust orchestrator for the reel-pipeline")]
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
    /// Worker base URL to poll.
    #[arg(long)]
    pub worker_url: Option<String>,
    /// One tick then exit (we never loop without --execute in Phase 1).
    #[arg(long, default_value_t = true)]
    pub once: bool,
    /// Print intended actions instead of polling/rendering.
    #[arg(long, default_value_t = true)]
    pub dry_run: bool,
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
