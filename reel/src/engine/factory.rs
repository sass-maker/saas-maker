//! Render-engine factory — mirrors `createRenderer` in `src/pipeline.js`.

use std::path::Path;

use anyhow::{anyhow, Result};

use crate::brief::VideoBrief;
use crate::runner::CommandRunner;

use super::ascii_animation::AsciiAnimationEngine;
use super::grok_video::GrokVideoEngine;
use super::html_composition::HtmlCompositionEngine;
use super::mock::MockEngine;
use super::money_printer::MoneyPrinterEngine;
use super::render_pro::RenderProEngine;
use super::{RenderEngine, RenderOptions, RenderResult};

pub enum PipelineEngine<R: CommandRunner> {
    AsciiAnimation(AsciiAnimationEngine<R>),
    Mock(MockEngine),
    GrokVideo(GrokVideoEngine),
    HtmlComposition(HtmlCompositionEngine<R>),
    MoneyPrinter(MoneyPrinterEngine),
    RenderPro(RenderProEngine<R>),
}

impl<R: CommandRunner> RenderEngine for PipelineEngine<R> {
    fn name(&self) -> &str {
        match self {
            PipelineEngine::AsciiAnimation(e) => e.name(),
            PipelineEngine::Mock(e) => e.name(),
            PipelineEngine::GrokVideo(e) => e.name(),
            PipelineEngine::HtmlComposition(e) => e.name(),
            PipelineEngine::MoneyPrinter(e) => e.name(),
            PipelineEngine::RenderPro(e) => e.name(),
        }
    }

    fn create_video(&self, brief: &VideoBrief, options: &RenderOptions) -> Result<RenderResult> {
        match self {
            PipelineEngine::AsciiAnimation(e) => e.create_video(brief, options),
            PipelineEngine::Mock(e) => e.create_video(brief, options),
            PipelineEngine::GrokVideo(e) => e.create_video(brief, options),
            PipelineEngine::HtmlComposition(e) => e.create_video(brief, options),
            PipelineEngine::MoneyPrinter(e) => e.create_video(brief, options),
            PipelineEngine::RenderPro(e) => e.create_video(brief, options),
        }
    }

    fn render_reel_by_id(&self, reel_id: &str, options: &RenderOptions) -> Result<RenderResult> {
        match self {
            PipelineEngine::AsciiAnimation(e) => e.render_reel_by_id(reel_id, options),
            PipelineEngine::Mock(e) => e.render_reel_by_id(reel_id, options),
            PipelineEngine::GrokVideo(e) => e.render_reel_by_id(reel_id, options),
            PipelineEngine::HtmlComposition(e) => e.render_reel_by_id(reel_id, options),
            PipelineEngine::MoneyPrinter(e) => e.render_reel_by_id(reel_id, options),
            PipelineEngine::RenderPro(e) => e.render_reel_by_id(reel_id, options),
        }
    }

    fn get_status(&self, external_task_id: &str) -> Result<RenderResult> {
        match self {
            PipelineEngine::AsciiAnimation(e) => e.get_status(external_task_id),
            PipelineEngine::Mock(e) => e.get_status(external_task_id),
            PipelineEngine::GrokVideo(e) => e.get_status(external_task_id),
            PipelineEngine::HtmlComposition(e) => e.get_status(external_task_id),
            PipelineEngine::MoneyPrinter(e) => e.get_status(external_task_id),
            PipelineEngine::RenderPro(e) => e.get_status(external_task_id),
        }
    }
}

pub fn create_renderer<R: CommandRunner>(
    mode: &str,
    repo_root: &Path,
    runner: R,
) -> Result<PipelineEngine<R>> {
    match mode {
        "mock" => Ok(PipelineEngine::Mock(MockEngine::new(
            repo_root.join(".reel-pipeline/artifacts"),
        ))),
        "stock" | "moneyprinterturbo" => {
            Ok(PipelineEngine::MoneyPrinter(MoneyPrinterEngine::from_env()))
        }
        "grok" | "grok-video" | "grok-videos" => Ok(PipelineEngine::GrokVideo(
            GrokVideoEngine::from_env(repo_root),
        )),
        "ascii" | "ascii-animation" | "ascii-fable" | "askai" => Ok(
            PipelineEngine::AsciiAnimation(AsciiAnimationEngine::new(runner, repo_root)),
        ),
        "html" | "html-composition" | "web-composition" => Ok(PipelineEngine::HtmlComposition(
            HtmlCompositionEngine::new(runner, repo_root),
        )),
        "render-pro" | "renderpro" => Ok(PipelineEngine::RenderPro(RenderProEngine::new(
            runner, repo_root,
        ))),
        other => Err(anyhow!("unsupported render mode: {other}")),
    }
}
