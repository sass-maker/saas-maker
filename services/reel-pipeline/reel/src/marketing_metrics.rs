//! Post-publish metrics backfill for SaaS Maker marketing posts.

use std::collections::BTreeMap;
use std::path::Path;

use anyhow::{anyhow, Context, Result};
use serde::Serialize;
use serde_json::{json, Value};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

use crate::config::{resolve_social_accounts, route_account, SocialAccount, SocialAccountsConfig};
use crate::publishers::{InstagramPublisher, YouTubePublisher};
use crate::saas_maker::{ListFilters, MarketingClient, MarketingPost, UpdateResult};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MetricsTarget {
    pub provider: String,
    pub external_id: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct MetricsSnapshot {
    pub provider: String,
    pub external_id: String,
    pub metrics: BTreeMap<String, Option<f64>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MetricsSyncResult {
    pub post_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skipped: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metrics: Option<MetricsSnapshot>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sync: Option<UpdateResult>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MetricsSyncReport {
    pub scanned: usize,
    pub results: Vec<MetricsSyncResult>,
}

#[derive(Debug, Clone)]
pub struct MetricsSyncOptions {
    pub limit: usize,
    pub project_slug: Option<String>,
    pub channel: Option<String>,
    pub status: String,
    pub confirm_sync: bool,
}

impl Default for MetricsSyncOptions {
    fn default() -> Self {
        Self {
            limit: 20,
            project_slug: None,
            channel: None,
            status: "sent".into(),
            confirm_sync: false,
        }
    }
}

pub trait MarketingMetricsFetcher {
    fn fetch_metrics(
        &self,
        marketing_post: &MarketingPost,
        target: &MetricsTarget,
    ) -> Result<MetricsSnapshot>;
}

pub struct ChannelRoutingMetricsFetcher {
    youtube: BTreeMap<String, YouTubePublisher>,
    instagram: BTreeMap<String, InstagramPublisher>,
    youtube_accounts: BTreeMap<String, SocialAccount>,
    instagram_accounts: BTreeMap<String, SocialAccount>,
}

impl ChannelRoutingMetricsFetcher {
    pub fn from_config(repo_root: &Path) -> Result<Self> {
        let path = repo_root.join("config/social-accounts.json");
        let raw = std::fs::read_to_string(&path)
            .with_context(|| format!("reading social accounts {}", path.display()))?;
        let cfg = resolve_social_accounts(&raw, |k| std::env::var(k).ok())?;
        Self::from_accounts(cfg)
    }

    pub fn from_accounts(cfg: SocialAccountsConfig) -> Result<Self> {
        let mut youtube = BTreeMap::new();
        for (slug, account) in &cfg.youtube {
            youtube.insert(
                slug.clone(),
                YouTubePublisher::from_account_fields(&account.fields)?,
            );
        }
        let mut instagram = BTreeMap::new();
        for (slug, account) in &cfg.instagram {
            instagram.insert(
                slug.clone(),
                InstagramPublisher::from_account_fields(&account.fields)?,
            );
        }
        Ok(Self {
            youtube_accounts: cfg.youtube,
            instagram_accounts: cfg.instagram,
            youtube,
            instagram,
        })
    }
}

impl MarketingMetricsFetcher for ChannelRoutingMetricsFetcher {
    fn fetch_metrics(
        &self,
        marketing_post: &MarketingPost,
        target: &MetricsTarget,
    ) -> Result<MetricsSnapshot> {
        match target.provider.as_str() {
            "youtube" => {
                let account = route_account(
                    &self.youtube_accounts,
                    marketing_post.account_slug.as_deref(),
                    Some(marketing_post.project_slug.as_str()),
                )?;
                let publisher = self
                    .youtube
                    .get(&account.slug)
                    .ok_or_else(|| anyhow!("no YouTube publisher for account {}", account.slug))?;
                let analytics = publisher.video_analytics(&target.external_id)?;
                Ok(MetricsSnapshot {
                    provider: "youtube".into(),
                    external_id: target.external_id.clone(),
                    metrics: BTreeMap::from([
                        ("views".into(), analytics.views.map(|v| v as f64)),
                        ("likes".into(), analytics.likes.map(|v| v as f64)),
                        ("comments".into(), analytics.comments.map(|v| v as f64)),
                    ]),
                })
            }
            "instagram" => {
                let account = route_account(
                    &self.instagram_accounts,
                    marketing_post.account_slug.as_deref(),
                    Some(marketing_post.project_slug.as_str()),
                )?;
                let publisher = self.instagram.get(&account.slug).ok_or_else(|| {
                    anyhow!("no Instagram publisher for account {}", account.slug)
                })?;
                let insights = publisher.media_insights(&target.external_id, None)?;
                Ok(MetricsSnapshot {
                    provider: "instagram".into(),
                    external_id: target.external_id.clone(),
                    metrics: insights.metrics,
                })
            }
            provider => Err(anyhow!("unsupported metrics provider {provider}")),
        }
    }
}

pub fn sync_marketing_post_metrics<C, F>(
    client: &C,
    fetcher: &F,
    now: OffsetDateTime,
    options: &MetricsSyncOptions,
) -> Result<MetricsSyncReport>
where
    C: MarketingClient,
    F: MarketingMetricsFetcher,
{
    if !options.confirm_sync {
        return Err(anyhow!("metrics sync requires confirm_sync=true"));
    }

    let posts = client.list_marketing_posts(&ListFilters {
        status: Some(options.status.clone()),
        project_slug: options.project_slug.clone(),
        channel: options.channel.clone(),
        limit: Some(options.limit),
    })?;

    let mut results = Vec::new();
    for post in &posts {
        let target = match metrics_target(post) {
            Ok(target) => target,
            Err(reason) => {
                results.push(MetricsSyncResult {
                    post_id: post.id.clone(),
                    skipped: Some(true),
                    reason: Some(reason),
                    metrics: None,
                    sync: None,
                });
                continue;
            }
        };

        match fetcher.fetch_metrics(post, &target) {
            Ok(metrics) => {
                let patch = patch_for_metrics_result(post, &metrics, now);
                let sync = client.update_marketing_post(&post.id, &patch)?;
                results.push(MetricsSyncResult {
                    post_id: post.id.clone(),
                    skipped: None,
                    reason: None,
                    metrics: Some(metrics),
                    sync: Some(sync),
                });
            }
            Err(error) => {
                results.push(MetricsSyncResult {
                    post_id: post.id.clone(),
                    skipped: Some(true),
                    reason: Some(error.to_string()),
                    metrics: None,
                    sync: None,
                });
            }
        }
    }

    Ok(MetricsSyncReport {
        scanned: posts.len(),
        results,
    })
}

pub fn metrics_target(post: &MarketingPost) -> std::result::Result<MetricsTarget, String> {
    if post.status != "sent" {
        return Err("not sent".into());
    }
    let notes = post.notes.as_deref().unwrap_or_default();
    let provider = note_value(notes, "posting_provider")
        .ok_or_else(|| "missing posting_provider note".to_string())?;
    if !matches!(provider.as_str(), "youtube" | "instagram") {
        return Err(format!("unsupported metrics provider {provider}"));
    }
    let external_id =
        note_value(notes, "external_id").ok_or_else(|| "missing external_id note".to_string())?;
    Ok(MetricsTarget {
        provider,
        external_id,
    })
}

pub fn patch_for_metrics_result(
    post: &MarketingPost,
    metrics: &MetricsSnapshot,
    synced_at: OffsetDateTime,
) -> Value {
    json!({
        "notes": append_metrics_notes(post.notes.as_deref(), metrics, synced_at),
    })
}

fn append_metrics_notes(
    existing: Option<&str>,
    metrics: &MetricsSnapshot,
    synced_at: OffsetDateTime,
) -> String {
    let mut lines: Vec<String> = existing
        .unwrap_or_default()
        .lines()
        .filter(|line| !is_metrics_note_line(line))
        .map(ToOwned::to_owned)
        .collect();
    lines.push("Metrics sync handled by reel-pipeline.".into());
    lines.push(format!("metrics_provider: {}", metrics.provider));
    lines.push(format!("metrics_external_id: {}", metrics.external_id));
    lines.push(format!(
        "metrics_synced_at: {}",
        synced_at.format(&Rfc3339).unwrap_or_default()
    ));
    for (key, value) in &metrics.metrics {
        let rendered = value
            .map(format_metric_value)
            .unwrap_or_else(|| "null".into());
        lines.push(format!("metric_{key}: {rendered}"));
    }
    lines.join("\n")
}

fn is_metrics_note_line(line: &str) -> bool {
    let trimmed = line.trim_start();
    trimmed == "Metrics sync handled by reel-pipeline."
        || trimmed.starts_with("metrics_provider:")
        || trimmed.starts_with("metrics_external_id:")
        || trimmed.starts_with("metrics_synced_at:")
        || trimmed.starts_with("metric_")
}

fn note_value(notes: &str, key: &str) -> Option<String> {
    let prefix = format!("{key}:");
    notes
        .lines()
        .filter_map(|line| line.trim().strip_prefix(&prefix))
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .last()
}

fn format_metric_value(value: f64) -> String {
    if value.fract() == 0.0 {
        format!("{}", value as i64)
    } else {
        value.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::saas_maker::stub::StubMarketingClient;

    fn sent_post(id: &str, notes: &str) -> MarketingPost {
        MarketingPost {
            id: id.into(),
            project_slug: "project".into(),
            channel: "youtube_shorts".into(),
            status: "sent".into(),
            title: "Title".into(),
            hook: None,
            body: "Body".into(),
            cta: None,
            task_id: None,
            asset_url: Some("https://assets.example.test/reel.mp4".into()),
            result_url: Some("https://youtube.com/shorts/video-1".into()),
            scheduled_for: None,
            posted_at: Some("2026-06-16T12:00:00Z".into()),
            notes: Some(notes.into()),
            created_at: None,
            inserted_at: None,
            tags: None,
            account_slug: None,
            local_path: None,
        }
    }

    struct StubMetricsFetcher;

    impl MarketingMetricsFetcher for StubMetricsFetcher {
        fn fetch_metrics(
            &self,
            _marketing_post: &MarketingPost,
            target: &MetricsTarget,
        ) -> Result<MetricsSnapshot> {
            Ok(MetricsSnapshot {
                provider: target.provider.clone(),
                external_id: target.external_id.clone(),
                metrics: BTreeMap::from([
                    ("comments".into(), Some(3.0)),
                    ("likes".into(), Some(12.0)),
                    ("views".into(), Some(100.0)),
                ]),
            })
        }
    }

    #[test]
    fn parses_metrics_target_from_posting_notes() {
        let post = sent_post(
            "p1",
            "Posting gate handled by reel-pipeline.\nposting_provider: youtube\nexternal_id: video-1",
        );
        let target = metrics_target(&post).unwrap();
        assert_eq!(target.provider, "youtube");
        assert_eq!(target.external_id, "video-1");
    }

    #[test]
    fn metrics_target_skips_posts_without_supported_release_id() {
        let post = sent_post(
            "p1",
            "Posting gate handled by reel-pipeline.\nposting_provider: manual",
        );
        assert_eq!(
            metrics_target(&post).unwrap_err(),
            "unsupported metrics provider manual"
        );
    }

    #[test]
    fn patch_for_metrics_result_replaces_prior_metrics_block() {
        let now = OffsetDateTime::parse("2026-06-16T13:00:00Z", &Rfc3339).unwrap();
        let post = sent_post(
            "p1",
            "Existing\nMetrics sync handled by reel-pipeline.\nmetric_views: 1\nposting_provider: youtube\nexternal_id: video-1",
        );
        let patch = patch_for_metrics_result(
            &post,
            &MetricsSnapshot {
                provider: "youtube".into(),
                external_id: "video-1".into(),
                metrics: BTreeMap::from([
                    ("likes".into(), Some(12.0)),
                    ("views".into(), Some(100.0)),
                ]),
            },
            now,
        );
        let notes = patch["notes"].as_str().unwrap();
        assert!(notes.contains("Existing"));
        assert!(notes.contains("metrics_provider: youtube"));
        assert!(notes.contains("metrics_synced_at: 2026-06-16T13:00:00Z"));
        assert!(notes.contains("metric_views: 100"));
        assert!(!notes.lines().any(|line| line == "metric_views: 1"));
    }

    #[test]
    fn sync_metrics_patches_sent_posts_and_skips_missing_targets() {
        let now = OffsetDateTime::parse("2026-06-16T13:00:00Z", &Rfc3339).unwrap();
        let client = StubMarketingClient::new(vec![
            sent_post("with-id", "posting_provider: youtube\nexternal_id: video-1"),
            sent_post("manual", "posting_provider: manual"),
        ]);

        let report = sync_marketing_post_metrics(
            &client,
            &StubMetricsFetcher,
            now,
            &MetricsSyncOptions {
                confirm_sync: true,
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(report.scanned, 2);
        assert_eq!(
            report.results[0].metrics.as_ref().unwrap().metrics["views"],
            Some(100.0)
        );
        assert_eq!(
            report.results[1].reason.as_deref(),
            Some("unsupported metrics provider manual")
        );
        assert!(client.posts.borrow()[0]
            .notes
            .as_deref()
            .unwrap()
            .contains("metric_likes: 12"));
    }
}
