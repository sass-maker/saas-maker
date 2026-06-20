//! reel — Rust orchestrator for the reel-pipeline.
//!
//! Phase 1 rewrite of the Node glue that orchestrates the render engines, R2
//! artifact publishing, and (gated) social posting. Heavy lifting stays behind
//! traits with one concrete shell-out impl each:
//!   - [`engine::RenderEngine`] → [`engine::render_pro::RenderProEngine`]
//!     (shells out to `scripts/render-pro.js`).
//!   - [`publisher::ArtifactPublisher`] → [`publisher::R2Publisher`]
//!     (shells out to `wrangler r2 object put`).
//!   - [`social::SocialPoster`] → [`social::DryRunPoster`] (never posts yet).
//!
//! The pure logic (brief normalization, template selection, quality scoring,
//! artifact path/key handling, config parsing) is ported in full and unit
//! tested. See ARCHITECTURE.md and PLAN.md at the repo root for the flow map and
//! remaining phases.

pub mod artifact;
pub mod brief;
pub mod config;
pub mod engine;
pub mod orchestrator;
pub mod publisher;
pub mod quality;
pub mod runner;
pub mod social;
pub mod store;
pub mod templates;
