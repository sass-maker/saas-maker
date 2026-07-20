//! Marketing render flow — port of `renderAcceptedMarketingPosts` in `src/pipeline.js`.

use std::path::Path;
use std::thread;
use std::time::Duration;

use anyhow::Result;
use serde::Serialize;

use crate::brief::is_reel_channel;
use crate::engine::{RenderEngine, RenderOptions, RenderStatus};
use crate::publisher::{ArtifactPublisher, NoopPublisher, R2Publisher};
use crate::runner::CommandRunner;
use crate::saas_maker::{
    brief_from_marketing_post, render_patch_for_marketing_post, ListFilters, MarketingClient,
    RenderPatchInput,
};

#[derive(Debug, Clone, Default)]
pub struct RenderAcceptedOptions {
    pub limit: usize,
    pub project_slug: Option<String>,
    pub channel: Option<String>,
    pub poll_limit: u32,
    pub poll_interval_ms: u64,
}

#[derive(Debug, Clone, Default)]
pub struct ArtifactPublisherConfig {
    pub r2_bucket: Option<String>,
    pub public_base_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RenderAcceptedResult {
    pub post_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skipped: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artifact_manifest_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RenderAcceptedReport {
    pub scanned: usize,
    pub eligible: usize,
    pub results: Vec<RenderAcceptedResult>,
}

pub fn resolve_artifact_publisher<R: CommandRunner>(
    repo_root: &Path,
    runner: R,
    config: ArtifactPublisherConfig,
) -> ResolvedPublisher<R> {
    let bucket = config
        .r2_bucket
        .or_else(|| std::env::var("REEL_ARTIFACT_R2_BUCKET").ok());
    let base = config
        .public_base_url
        .or_else(|| std::env::var("REEL_ARTIFACT_PUBLIC_BASE_URL").ok())
        .or_else(|| std::env::var("REEL_WORKER_URL").ok())
        .unwrap_or_default();
    if let Some(bucket) = bucket.filter(|b| !b.trim().is_empty()) {
        if !base.trim().is_empty() {
            return ResolvedPublisher::R2(R2Publisher::new(runner, bucket, base));
        }
    }
    let _ = repo_root;
    ResolvedPublisher::Noop(NoopPublisher)
}

pub enum ResolvedPublisher<R: CommandRunner> {
    Noop(NoopPublisher),
    R2(R2Publisher<R>),
}

impl<R: CommandRunner> ArtifactPublisher for ResolvedPublisher<R> {
    fn publish(&self, urls: &[String], cwd: &Path) -> Result<Vec<String>> {
        match self {
            ResolvedPublisher::Noop(p) => p.publish(urls, cwd),
            ResolvedPublisher::R2(p) => p.publish(urls, cwd),
        }
    }
}

pub fn render_accepted_marketing_posts<C, E, P>(
    client: &C,
    engine: &E,
    publisher: &P,
    repo_root: &Path,
    options: &RenderAcceptedOptions,
) -> Result<RenderAcceptedReport>
where
    C: MarketingClient,
    E: RenderEngine,
    P: ArtifactPublisher,
{
    let limit = options.limit.max(1);
    let posts = client.list_marketing_posts(&ListFilters {
        status: Some("accepted".into()),
        project_slug: options.project_slug.clone(),
        channel: options.channel.clone(),
        limit: Some(limit),
    })?;
    let reel_posts: Vec<_> = posts
        .iter()
        .filter(|post| is_reel_channel(&post.channel))
        .take(limit)
        .collect();
    let eligible = reel_posts.len();
    let mut results = Vec::new();

    for post in reel_posts {
        if post.asset_url.is_some() || post.result_url.is_some() {
            results.push(RenderAcceptedResult {
                post_id: post.id.clone(),
                skipped: Some(true),
                reason: Some("already has render artifact".into()),
                provider: None,
                status: None,
                artifact_manifest_path: None,
            });
            continue;
        }

        let brief = match brief_from_marketing_post(post) {
            Ok(brief) => brief,
            Err(err) => {
                results.push(RenderAcceptedResult {
                    post_id: post.id.clone(),
                    skipped: Some(true),
                    reason: Some(err.to_string()),
                    provider: None,
                    status: None,
                    artifact_manifest_path: None,
                });
                continue;
            }
        };

        let mut render = engine.create_video(&brief, &RenderOptions::default())?;
        render = poll_until_complete(engine, render, options.poll_limit, options.poll_interval_ms)?;
        if render.status == RenderStatus::Completed {
            crate::content_factory::attach_manifest(&brief, &mut render, repo_root)?;
        }

        if render.status == RenderStatus::Failed {
            results.push(RenderAcceptedResult {
                post_id: post.id.clone(),
                skipped: Some(true),
                reason: Some("render failed".into()),
                provider: Some(render.provider.clone()),
                status: Some(render.status.as_str().into()),
                artifact_manifest_path: render
                    .artifact_manifest_path
                    .as_ref()
                    .map(|path| path.to_string_lossy().into_owned()),
            });
            continue;
        }

        let published = publisher.publish(&render.videos, repo_root)?;
        let combined = publisher.publish(&render.combined_videos, repo_root)?;
        let mut published_render = render.clone();
        published_render.videos = published;
        published_render.combined_videos = combined;

        let patch = render_patch_for_marketing_post(&RenderPatchInput {
            provider: published_render.provider.clone(),
            external_task_id: published_render.external_task_id.clone(),
            status: published_render.status.as_str().into(),
            videos: published_render.videos.clone(),
            combined_videos: published_render.combined_videos.clone(),
            video_url: None,
        });
        client.update_marketing_post(&post.id, &patch)?;

        results.push(RenderAcceptedResult {
            post_id: post.id.clone(),
            skipped: None,
            reason: None,
            provider: Some(published_render.provider),
            status: Some(published_render.status.as_str().into()),
            artifact_manifest_path: published_render
                .artifact_manifest_path
                .as_ref()
                .map(|path| path.to_string_lossy().into_owned()),
        });
    }

    Ok(RenderAcceptedReport {
        scanned: posts.len(),
        eligible,
        results,
    })
}

fn poll_until_complete<E: RenderEngine>(
    engine: &E,
    initial: crate::engine::RenderResult,
    poll_limit: u32,
    poll_interval_ms: u64,
) -> Result<crate::engine::RenderResult> {
    let mut current = initial;
    if matches!(
        current.status,
        RenderStatus::Completed | RenderStatus::Failed
    ) {
        return Ok(current);
    }
    for _ in 0..poll_limit {
        thread::sleep(Duration::from_millis(poll_interval_ms.max(250)));
        current = engine.get_status(&current.external_task_id)?;
        if matches!(
            current.status,
            RenderStatus::Completed | RenderStatus::Failed
        ) {
            return Ok(current);
        }
    }
    Ok(current)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::mock::MockEngine;
    use crate::saas_maker::stub::StubMarketingClient;
    use crate::saas_maker::MarketingPost;
    use tempfile::TempDir;

    fn reel_post(id: &str, status: &str) -> MarketingPost {
        MarketingPost {
            id: id.into(),
            project_slug: "demo".into(),
            channel: "youtube_shorts".into(),
            status: status.into(),
            title: "Title".into(),
            hook: Some("Hook".into()),
            body: "Script: open. Shot list: x. Captions: y. Asset prompts: z.".into(),
            cta: None,
            task_id: None,
            asset_url: None,
            result_url: None,
            scheduled_for: None,
            posted_at: None,
            notes: None,
            created_at: None,
            inserted_at: None,
            tags: None,
            account_slug: None,
            local_path: None,
        }
    }

    #[test]
    fn renders_accepted_posts_without_existing_artifacts() {
        let tmp = TempDir::new().unwrap();
        let client = StubMarketingClient::new(vec![reel_post("p1", "accepted")]);
        let engine = MockEngine::new(tmp.path()).with_task_suffix("test");
        let report = render_accepted_marketing_posts(
            &client,
            &engine,
            &NoopPublisher,
            tmp.path(),
            &RenderAcceptedOptions {
                limit: 5,
                poll_limit: 1,
                poll_interval_ms: 1,
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(report.scanned, 1);
        assert_eq!(report.eligible, 1);
        assert_eq!(report.results.len(), 1);
        assert!(report.results[0].status.as_deref() == Some("completed"));
        assert_eq!(client.patches.borrow().len(), 1);
        let post = &client.posts.borrow()[0];
        assert!(post.asset_url.is_some());
    }

    #[test]
    fn skips_posts_that_already_have_assets() {
        let tmp = TempDir::new().unwrap();
        let mut post = reel_post("p1", "accepted");
        post.asset_url = Some("https://cdn.example/a.mp4".into());
        let client = StubMarketingClient::new(vec![post]);
        let engine = MockEngine::new(tmp.path());
        let report = render_accepted_marketing_posts(
            &client,
            &engine,
            &NoopPublisher,
            tmp.path(),
            &RenderAcceptedOptions::default(),
        )
        .unwrap();
        assert_eq!(
            report.results[0].reason.as_deref(),
            Some("already has render artifact")
        );
        assert!(client.patches.borrow().is_empty());
    }
}
