//! Marketing autopilot — port of `src/autopilot.js`.

use std::path::Path;

use anyhow::{Context, Result};
use serde::Serialize;
use time::{format_description::well_known::Rfc3339, Duration, OffsetDateTime};

use crate::engine::factory::create_renderer;
use crate::marketing::{render_accepted_marketing_posts, RenderAcceptedOptions, RenderAcceptedReport};
use crate::marketing_posting::{post_ready_marketing_videos, MarketingPoster, PostReadyOptions, PostReadyReport};
use crate::runner::ProcessRunner;
use crate::saas_maker::{ListFilters, MarketingClient, MarketingPost, UpdateResult};

pub const DEFAULT_HOLD_WINDOW_MS: u64 = 30 * 60_000;
pub const DEFAULT_INTAKE_STATUS: &str = "pending";
pub const DEFAULT_CREATED_AT_FIELD: &str = "created_at";

#[derive(Debug, Clone, Serialize)]
pub struct AcceptedEntry {
    pub post_id: String,
    pub sync: UpdateResult,
}

#[derive(Debug, Clone, Serialize)]
pub struct AutopilotTickReport {
    pub accepted: Vec<AcceptedEntry>,
    pub rendered: RenderAcceptedReport,
    pub posted: PostReadyReport,
}

#[derive(Debug, Clone)]
pub struct AutopilotConfig {
    pub hold_window_ms: u64,
    pub intake_status: String,
    pub created_at_field: String,
    pub limit: usize,
    pub render_mode: String,
    pub poll_limit: u32,
    pub poll_interval_ms: u64,
    pub include_unscheduled: bool,
    pub posting_provider: String,
}

impl Default for AutopilotConfig {
    fn default() -> Self {
        Self {
            hold_window_ms: DEFAULT_HOLD_WINDOW_MS,
            intake_status: DEFAULT_INTAKE_STATUS.into(),
            created_at_field: DEFAULT_CREATED_AT_FIELD.into(),
            limit: 10,
            render_mode: "mock".into(),
            poll_limit: 60,
            poll_interval_ms: 2000,
            include_unscheduled: true,
            posting_provider: "auto".into(),
        }
    }
}

pub fn auto_accept_intake<C>(
    client: &C,
    now: OffsetDateTime,
    config: &AutopilotConfig,
    log: &mut dyn FnMut(&str),
) -> Result<Vec<AcceptedEntry>>
where
    C: MarketingClient,
{
    let posts = client.list_marketing_posts(&ListFilters {
        status: Some(config.intake_status.clone()),
        limit: Some(config.limit),
        ..Default::default()
    })?;
    let cutoff = now - Duration::milliseconds(config.hold_window_ms as i64);
    let ready: Vec<_> = posts
        .iter()
        .filter(|post| created_at_past_hold(post, &config.created_at_field, cutoff))
        .collect();
    log(&format!(
        "▸ intake: {}/{} past hold window ({}m)",
        ready.len(),
        posts.len(),
        config.hold_window_ms / 60_000
    ));
    let mut accepted = Vec::new();
    for post in ready {
        let patch = serde_json::json!({
            "status": "accepted",
            "notes": append_intake_note(post.notes.as_deref(), config.hold_window_ms),
        });
        let sync = client.update_marketing_post(&post.id, &patch)?;
        accepted.push(AcceptedEntry {
            post_id: post.id.clone(),
            sync,
        });
    }
    Ok(accepted)
}

fn created_at_past_hold(
    post: &MarketingPost,
    field: &str,
    cutoff: OffsetDateTime,
) -> bool {
    let Some(raw) = post_field(post, field) else {
        return false;
    };
    let Ok(created_at) = OffsetDateTime::parse(raw, &Rfc3339) else {
        return false;
    };
    created_at <= cutoff
}

fn post_field<'a>(post: &'a MarketingPost, field: &str) -> Option<&'a str> {
    match field {
        "created_at" => post.created_at.as_deref(),
        "inserted_at" => post.inserted_at.as_deref(),
        other => {
            let _ = other;
            post.created_at.as_deref()
        }
    }
}

fn append_intake_note(existing: Option<&str>, hold_window_ms: u64) -> String {
    let mut lines = vec![existing.map(str::to_string)];
    lines.push(Some(format!(
        "Auto-accepted by autopilot after {}m hold window.",
        hold_window_ms / 60_000
    )));
    lines.into_iter().flatten().collect::<Vec<_>>().join("\n")
}

pub fn run_autopilot_tick<C, P>(
    client: &C,
    repo_root: &Path,
    poster: &P,
    now: OffsetDateTime,
    config: &AutopilotConfig,
    log: &mut dyn FnMut(&str),
) -> Result<AutopilotTickReport>
where
    C: MarketingClient,
    P: MarketingPoster,
{
    let accepted = auto_accept_intake(client, now, config, log)?;
    log("▸ render: scanning accepted marketing posts");
    let engine = create_renderer(&config.render_mode, repo_root, ProcessRunner)?;
    let publisher = crate::marketing::resolve_artifact_publisher(repo_root, ProcessRunner);
    let rendered = render_accepted_marketing_posts(
        client,
        &engine,
        &publisher,
        repo_root,
        &RenderAcceptedOptions {
            limit: config.limit,
            poll_limit: config.poll_limit,
            poll_interval_ms: config.poll_interval_ms,
            ..Default::default()
        },
    )?;
    log(&format!(
        "✓ render: scanned={} eligible={} results={}",
        rendered.scanned,
        rendered.eligible,
        rendered.results.len()
    ));
    log("▸ post: posting ready marketing videos");
    let posted = post_ready_marketing_videos(
        client,
        poster,
        now,
        &PostReadyOptions {
            limit: config.limit,
            include_unscheduled: config.include_unscheduled,
            confirm_post: true,
            ..Default::default()
        },
    )?;
    log(&format!(
        "✓ post: scanned={} results={}",
        posted.scanned,
        posted.results.len()
    ));
    Ok(AutopilotTickReport {
        accepted,
        rendered,
        posted,
    })
}

pub fn load_fixture_posts(path: &Path) -> Result<Vec<MarketingPost>> {
    let raw = std::fs::read_to_string(path)
        .with_context(|| format!("reading fixture {}", path.display()))?;
    let value: serde_json::Value = serde_json::from_str(&raw)?;
    let posts = if let Some(array) = value.as_array() {
        array.clone()
    } else if let Some(data) = value.get("data").and_then(|v| v.as_array()) {
        data.clone()
    } else if let Some(posts) = value.get("posts").and_then(|v| v.as_array()) {
        posts.clone()
    } else {
        Vec::new()
    };
    posts
        .into_iter()
        .map(|entry| serde_json::from_value(entry).context("parsing fixture post"))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::marketing_posting::{FailingPoster, StubPoster};
    use crate::saas_maker::stub::StubMarketingClient;
    use crate::saas_maker::MarketingPost;
    use tempfile::TempDir;

    fn pending(id: &str, created_at: &str) -> MarketingPost {
        MarketingPost {
            id: id.into(),
            project_slug: "p".into(),
            channel: "youtube_shorts".into(),
            status: "pending".into(),
            title: "t".into(),
            hook: Some("h".into()),
            body: "b".into(),
            cta: None,
            task_id: None,
            asset_url: None,
            result_url: None,
            scheduled_for: None,
            posted_at: None,
            notes: None,
            created_at: Some(created_at.into()),
            inserted_at: None,
            tags: None,
            account_slug: None,
            local_path: None,
        }
    }

    #[test]
    fn auto_accept_only_flips_aged_posts() {
        let now = OffsetDateTime::parse("2026-06-16T12:00:00Z", &Rfc3339).unwrap();
        let client = StubMarketingClient::new(vec![
            pending("fresh", "2026-06-16T11:50:00Z"),
            pending("aged", "2026-06-16T11:00:00Z"),
            MarketingPost {
                status: "sent".into(),
                ..pending("unrelated", "2026-06-16T10:00:00Z")
            },
        ]);
        let config = AutopilotConfig {
            hold_window_ms: 30 * 60_000,
            ..Default::default()
        };
        let accepted = auto_accept_intake(&client, now, &config, &mut |_| {}).unwrap();
        assert_eq!(accepted.len(), 1);
        assert_eq!(accepted[0].post_id, "aged");
    }

    #[test]
    fn autopilot_chains_intake_render_post() {
        let tmp = TempDir::new().unwrap();
        let now = OffsetDateTime::parse("2026-06-16T12:00:00Z", &Rfc3339).unwrap();
        let client = StubMarketingClient::new(vec![
            MarketingPost {
                status: "pending".into(),
                result_url: Some("https://cdn.example/aged.mp4".into()),
                asset_url: Some("https://cdn.example/aged.mp4".into()),
                created_at: Some("2026-06-16T10:00:00Z".into()),
                ..pending("aged", "2026-06-16T10:00:00Z")
            },
            MarketingPost {
                status: "accepted".into(),
                result_url: Some("https://cdn.example/r.mp4".into()),
                asset_url: Some("https://cdn.example/r.mp4".into()),
                scheduled_for: Some("2026-06-16T11:00:00Z".into()),
                ..pending("ready", "2026-06-16T09:00:00Z")
            },
        ]);
        let report = run_autopilot_tick(
            &client,
            tmp.path(),
            &StubPoster { outcomes: vec![] },
            now,
            &AutopilotConfig::default(),
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(report.accepted.len(), 1);
        let posts = client.posts.borrow();
        let statuses: Vec<_> = posts
            .iter()
            .map(|p| (p.id.as_str(), p.status.as_str()))
            .collect();
        assert!(statuses.iter().any(|(id, status)| *id == "aged" && *status == "sent"));
        assert!(statuses.iter().any(|(id, status)| *id == "ready" && *status == "sent"));
    }

    #[test]
    fn autopilot_propagates_post_errors_without_corrupting_intake() {
        let tmp = TempDir::new().unwrap();
        let now = OffsetDateTime::parse("2026-06-16T12:00:00Z", &Rfc3339).unwrap();
        let client = StubMarketingClient::new(vec![MarketingPost {
            status: "pending".into(),
            result_url: Some("https://x/y.mp4".into()),
            asset_url: Some("https://x/y.mp4".into()),
            created_at: Some("2020-01-01T00:00:00Z".into()),
            ..pending("aged", "2020-01-01T00:00:00Z")
        }]);
        let err = run_autopilot_tick(
            &client,
            tmp.path(),
            &FailingPoster,
            now,
            &AutopilotConfig::default(),
            &mut |_| {},
        )
        .unwrap_err();
        assert!(err.to_string().contains("YT 503"));
        assert_eq!(client.posts.borrow()[0].status, "accepted");
    }
}
