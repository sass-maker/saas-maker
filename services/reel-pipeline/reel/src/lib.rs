//! reel — Rust orchestrator for the reel-pipeline.
//!
//! Rust orchestration for render engines, R2 artifact publishing, and gated
//! social posting. Heavy lifting stays behind traits and adapter-specific
//! engines:
//!   - [`engine::RenderEngine`] → render-pro, MoneyPrinterTurbo, Grok local
//!     MP4s, ASCII animation, HTML composition, reel-maker, and mock engines.
//!   - [`publisher::ArtifactPublisher`] → [`publisher::R2Publisher`]
//!     (shells out to `wrangler r2 object put`).
//!   - [`social::SocialPoster`] → [`social::DryRunPoster`] (never posts yet).
//!
//! The pure logic (brief normalization, template selection, quality scoring,
//! artifact path/key handling, config parsing) is ported in full and unit
//! tested. See ARCHITECTURE.md and PLAN.md at the repo root for the flow map and
//! remaining phases.

pub mod artifact;
pub mod autopilot;
pub mod autopilot_daemon;
pub mod brief;
pub mod config;
pub mod content_factory;
pub mod engine;
pub mod marketing;
pub mod marketing_metrics;
pub mod marketing_posting;
pub mod orchestrator;
pub mod publisher;
pub mod publishers;
pub mod quality;
pub mod runner;
pub mod saas_maker;
pub mod social;
pub mod store;
pub mod templates;
pub mod watcher;
pub mod worker_client;
