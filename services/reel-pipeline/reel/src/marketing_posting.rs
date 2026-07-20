//! Marketing posting gate — port of `src/posting.js` (gate + ready scan).

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use anyhow::{anyhow, Context, Result};
use serde::Serialize;
use serde_json::{json, Value};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

use crate::artifact::{classify_artifact, ArtifactSource};
use crate::brief::is_reel_channel;
use crate::config::{resolve_social_accounts, route_account, SocialAccount, SocialAccountsConfig};
use crate::publishers::instagram::InstagramReelInput;
use crate::publishers::youtube::YouTubeUploadInput;
use crate::publishers::{InstagramPublisher, YouTubePublisher};
use crate::saas_maker::{ListFilters, MarketingClient, MarketingPost, UpdateResult};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PostingGateResult {
    pub ready: bool,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PostedOutcome {
    pub provider: String,
    pub status: String,
    pub channel: String,
    pub asset_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub external_id: Option<String>,
    pub external_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub posted_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prepared_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scheduled_for: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct PostingFailure {
    pub category: String,
    pub retryable: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PostReadyResult {
    pub post_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skipped: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub posted: Option<PostedOutcome>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failure: Option<PostingFailure>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sync: Option<UpdateResult>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PostReadyReport {
    pub scanned: usize,
    pub results: Vec<PostReadyResult>,
}

pub trait MarketingPoster {
    fn post(&self, marketing_post: &MarketingPost) -> Result<PostedOutcome>;
}

#[derive(Debug, Clone)]
pub struct PostingCapabilities {
    pub provider: &'static str,
    pub channels: &'static [&'static str],
    pub requires_rendered_asset: bool,
    pub requires_public_video_url: bool,
    pub requires_local_video: bool,
    pub max_caption_length: Option<usize>,
    pub max_title_length: Option<usize>,
    pub max_tags: Option<usize>,
}

const MANUAL_CAPABILITIES: PostingCapabilities = PostingCapabilities {
    provider: "manual",
    channels: &["tiktok", "instagram_reels", "youtube_shorts"],
    requires_rendered_asset: true,
    requires_public_video_url: false,
    requires_local_video: false,
    max_caption_length: Some(4096),
    max_title_length: None,
    max_tags: None,
};

const YOUTUBE_CAPABILITIES: PostingCapabilities = PostingCapabilities {
    provider: "youtube",
    channels: &["youtube_shorts"],
    requires_rendered_asset: true,
    requires_public_video_url: false,
    requires_local_video: true,
    max_caption_length: Some(5000),
    max_title_length: Some(100),
    max_tags: Some(30),
};

const INSTAGRAM_CAPABILITIES: PostingCapabilities = PostingCapabilities {
    provider: "instagram",
    channels: &["instagram_reels"],
    requires_rendered_asset: true,
    requires_public_video_url: true,
    requires_local_video: false,
    max_caption_length: Some(2200),
    max_title_length: None,
    max_tags: None,
};

pub struct ManualPoster {
    now: OffsetDateTime,
}

impl ManualPoster {
    pub fn new(now: OffsetDateTime) -> Self {
        Self { now }
    }
}

impl MarketingPoster for ManualPoster {
    fn post(&self, marketing_post: &MarketingPost) -> Result<PostedOutcome> {
        validate_posting_preflight(marketing_post, &MANUAL_CAPABILITIES, None)?;
        Ok(PostedOutcome {
            provider: "manual".into(),
            status: "prepared".into(),
            channel: marketing_post.channel.clone(),
            asset_url: marketing_post
                .result_url
                .clone()
                .or_else(|| marketing_post.asset_url.clone()),
            external_id: None,
            external_url: None,
            posted_at: None,
            prepared_at: Some(self.now.format(&Rfc3339).unwrap_or_default()),
            scheduled_for: None,
        })
    }
}

pub struct StubPoster {
    pub outcomes: Vec<PostedOutcome>,
}

impl MarketingPoster for StubPoster {
    fn post(&self, marketing_post: &MarketingPost) -> Result<PostedOutcome> {
        Ok(PostedOutcome {
            provider: "auto".into(),
            status: "posted".into(),
            channel: marketing_post.channel.clone(),
            asset_url: marketing_post.result_url.clone(),
            external_id: Some("posted".into()),
            external_url: Some("https://x/posted".into()),
            posted_at: Some("2026-06-16T12:00:01Z".into()),
            prepared_at: None,
            scheduled_for: None,
        })
    }
}

pub struct FailingPoster;

impl MarketingPoster for FailingPoster {
    fn post(&self, _marketing_post: &MarketingPost) -> Result<PostedOutcome> {
        Err(anyhow!("YT 503"))
    }
}

pub struct ChannelRoutingPoster {
    repo_root: PathBuf,
    youtube: BTreeMap<String, YouTubePublisher>,
    instagram: BTreeMap<String, InstagramPublisher>,
    youtube_accounts: BTreeMap<String, SocialAccount>,
    instagram_accounts: BTreeMap<String, SocialAccount>,
    manual: ManualPoster,
}

impl ChannelRoutingPoster {
    pub fn from_config(repo_root: &Path, now: OffsetDateTime) -> Result<Self> {
        let path = repo_root.join("config/social-accounts.json");
        let raw = std::fs::read_to_string(&path)
            .with_context(|| format!("reading social accounts {}", path.display()))?;
        let cfg = resolve_social_accounts(&raw, |k| std::env::var(k).ok())?;
        Self::from_accounts(repo_root, cfg, now)
    }

    pub fn from_accounts(
        repo_root: &Path,
        cfg: SocialAccountsConfig,
        now: OffsetDateTime,
    ) -> Result<Self> {
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
            repo_root: repo_root.to_path_buf(),
            youtube_accounts: cfg.youtube,
            instagram_accounts: cfg.instagram,
            youtube,
            instagram,
            manual: ManualPoster::new(now),
        })
    }

    fn youtube_for<'a>(
        &'a self,
        post: &MarketingPost,
    ) -> Result<(&'a YouTubePublisher, Option<String>)> {
        let account = route_account(
            &self.youtube_accounts,
            post.account_slug.as_deref(),
            Some(post.project_slug.as_str()),
        )?;
        Ok((
            self.youtube
                .get(&account.slug)
                .ok_or_else(|| anyhow!("no YouTube publisher for account {}", account.slug))?,
            Some(account.slug.clone()),
        ))
    }

    fn instagram_for<'a>(
        &'a self,
        post: &MarketingPost,
    ) -> Result<(&'a InstagramPublisher, Option<String>)> {
        let account = route_account(
            &self.instagram_accounts,
            post.account_slug.as_deref(),
            Some(post.project_slug.as_str()),
        )?;
        Ok((
            self.instagram
                .get(&account.slug)
                .ok_or_else(|| anyhow!("no Instagram publisher for account {}", account.slug))?,
            Some(account.slug.clone()),
        ))
    }
}

impl MarketingPoster for ChannelRoutingPoster {
    fn post(&self, marketing_post: &MarketingPost) -> Result<PostedOutcome> {
        match marketing_post.channel.as_str() {
            "youtube_shorts" => self.post_youtube(marketing_post),
            "instagram_reels" => self.post_instagram(marketing_post),
            _ => self.manual.post(marketing_post),
        }
    }
}

impl ChannelRoutingPoster {
    fn post_youtube(&self, post: &MarketingPost) -> Result<PostedOutcome> {
        let (publisher, _account_slug) = self.youtube_for(post)?;
        let video_path = resolve_local_video_path(post, &self.repo_root)?;
        validate_posting_preflight(post, &YOUTUBE_CAPABILITIES, Some(video_path.as_path()))?;
        let uploaded = publisher.upload(&YouTubeUploadInput {
            video_path: &video_path,
            title: &post.title,
            description: Some(build_caption(post).as_str()),
            tags: post.tags.as_deref(),
            publish_at: post.scheduled_for.as_deref(),
            privacy_status: None,
            category_id: None,
            made_for_kids: false,
        })?;
        let posted_at = if uploaded.publish_at.is_some() {
            None
        } else {
            Some(
                OffsetDateTime::now_utc()
                    .format(&Rfc3339)
                    .unwrap_or_default(),
            )
        };
        Ok(PostedOutcome {
            provider: "youtube".into(),
            status: if uploaded.publish_at.is_some() {
                "scheduled".into()
            } else {
                "posted".into()
            },
            channel: post.channel.clone(),
            asset_url: post.result_url.clone().or_else(|| post.asset_url.clone()),
            external_id: Some(uploaded.video_id),
            external_url: Some(uploaded.url),
            posted_at,
            prepared_at: None,
            scheduled_for: uploaded.publish_at,
        })
    }

    fn post_instagram(&self, post: &MarketingPost) -> Result<PostedOutcome> {
        let (publisher, _account_slug) = self.instagram_for(post)?;
        let video_url = post
            .result_url
            .as_deref()
            .or(post.asset_url.as_deref())
            .ok_or_else(|| anyhow!("no rendered asset URL for marketing post {}", post.id))?;
        validate_posting_preflight(post, &INSTAGRAM_CAPABILITIES, None)?;
        let published = publisher.publish_reel(&InstagramReelInput {
            video_url,
            caption: Some(build_caption(post).as_str()),
            share_to_feed: None,
            thumb_offset_ms: None,
        })?;
        Ok(PostedOutcome {
            provider: "instagram".into(),
            status: "posted".into(),
            channel: post.channel.clone(),
            asset_url: Some(video_url.to_string()),
            external_id: Some(published.media_id),
            external_url: Some(published.url),
            posted_at: Some(
                OffsetDateTime::now_utc()
                    .format(&Rfc3339)
                    .unwrap_or_default(),
            ),
            prepared_at: None,
            scheduled_for: None,
        })
    }
}

pub enum AnyMarketingPoster {
    Manual(ManualPoster),
    Auto(ChannelRoutingPoster),
}

impl MarketingPoster for AnyMarketingPoster {
    fn post(&self, marketing_post: &MarketingPost) -> Result<PostedOutcome> {
        match self {
            AnyMarketingPoster::Manual(p) => p.post(marketing_post),
            AnyMarketingPoster::Auto(p) => p.post(marketing_post),
        }
    }
}

pub fn create_poster(
    mode: &str,
    repo_root: &Path,
    now: OffsetDateTime,
) -> Result<AnyMarketingPoster> {
    match mode {
        "manual" => Ok(AnyMarketingPoster::Manual(ManualPoster::new(now))),
        "auto" => Ok(AnyMarketingPoster::Auto(ChannelRoutingPoster::from_config(
            repo_root, now,
        )?)),
        other => Err(anyhow!("unsupported posting provider: {other}")),
    }
}

pub fn build_caption(post: &MarketingPost) -> String {
    let caption = [post.hook.as_deref(), post.cta.as_deref()]
        .into_iter()
        .flatten()
        .filter(|line| !line.trim().is_empty())
        .collect::<Vec<_>>()
        .join("\n\n");
    if caption.is_empty() {
        post.title.clone()
    } else {
        caption
    }
}

pub fn resolve_local_video_path(post: &MarketingPost, repo_root: &Path) -> Result<PathBuf> {
    if let Some(local_path) = &post.local_path {
        return Ok(PathBuf::from(local_path));
    }
    let url = post
        .result_url
        .as_deref()
        .or(post.asset_url.as_deref())
        .ok_or_else(|| anyhow!("no local video path for marketing post {}", post.id))?;
    match classify_artifact(url, repo_root) {
        Some(ArtifactSource::Local(path)) => Ok(path),
        _ => Err(anyhow!(
            "no local video path for marketing post {}",
            post.id
        )),
    }
}

#[derive(Debug, Clone, Default)]
pub struct PostReadyOptions {
    pub limit: usize,
    pub project_slug: Option<String>,
    pub channel: Option<String>,
    pub include_unscheduled: bool,
    pub missed_only: bool,
    pub confirm_post: bool,
}

pub fn posting_gate(
    post: &MarketingPost,
    now: OffsetDateTime,
    include_unscheduled: bool,
) -> PostingGateResult {
    if !is_reel_channel(&post.channel) {
        return PostingGateResult {
            ready: false,
            reason: Some("not a reel channel".into()),
        };
    }
    if post.status != "accepted" {
        return PostingGateResult {
            ready: false,
            reason: Some("not accepted".into()),
        };
    }
    if post.result_url.is_none() && post.asset_url.is_none() {
        return PostingGateResult {
            ready: false,
            reason: Some("missing rendered asset".into()),
        };
    }
    if post.posted_at.is_some() {
        return PostingGateResult {
            ready: false,
            reason: Some("already posted".into()),
        };
    }
    if !include_unscheduled && post.scheduled_for.is_none() {
        return PostingGateResult {
            ready: false,
            reason: Some("not scheduled".into()),
        };
    }
    if let Some(scheduled_for) = &post.scheduled_for {
        if let Ok(when) = OffsetDateTime::parse(scheduled_for, &Rfc3339) {
            if when > now {
                return PostingGateResult {
                    ready: false,
                    reason: Some("scheduled for later".into()),
                };
            }
        }
    }
    PostingGateResult {
        ready: true,
        reason: None,
    }
}

pub fn is_missed_ready_post(post: &MarketingPost, now: OffsetDateTime) -> bool {
    if !is_reel_channel(&post.channel) {
        return false;
    }
    if post.status != "accepted" {
        return false;
    }
    if post.result_url.is_none() && post.asset_url.is_none() && post.local_path.is_none() {
        return false;
    }
    if post.posted_at.is_some() {
        return false;
    }
    let Some(scheduled_for) = &post.scheduled_for else {
        return false;
    };
    let Ok(when) = OffsetDateTime::parse(scheduled_for, &Rfc3339) else {
        return false;
    };
    when <= now
}

pub fn patch_for_posting_result(post: &MarketingPost, posted: &PostedOutcome) -> Value {
    let mut patch = json!({
        "status": if posted.status == "posted" { "sent" } else { "accepted" },
        "result_url": posted.external_url.as_deref()
            .or(post.result_url.as_deref())
            .or(post.asset_url.as_deref()),
        "notes": append_posting_notes(post.notes.as_deref(), posted),
    });
    if posted.status == "posted" {
        if let Some(posted_at) = &posted.posted_at {
            patch["posted_at"] = json!(posted_at);
        }
    } else if posted.status == "scheduled" {
        if let Some(scheduled_for) = &posted.scheduled_for {
            patch["scheduled_for"] = json!(scheduled_for);
        }
    }
    patch
}

pub fn patch_for_posting_failure(post: &MarketingPost, failure: &PostingFailure) -> Value {
    json!({
        "status": "accepted",
        "result_url": post.result_url.as_deref().or(post.asset_url.as_deref()),
        "notes": append_posting_failure_notes(post.notes.as_deref(), failure),
    })
}

fn append_posting_notes(existing: Option<&str>, posted: &PostedOutcome) -> String {
    let mut lines = vec![existing.map(str::to_string)];
    lines.push(Some("Posting gate handled by reel-pipeline.".into()));
    lines.push(Some(format!("posting_provider: {}", posted.provider)));
    lines.push(Some(format!("posting_status: {}", posted.status)));
    if let Some(prepared_at) = &posted.prepared_at {
        lines.push(Some(format!("prepared_at: {prepared_at}")));
    }
    if let Some(external_id) = &posted.external_id {
        lines.push(Some(format!("external_id: {external_id}")));
    }
    if let Some(external_url) = &posted.external_url {
        lines.push(Some(format!("external_url: {external_url}")));
    }
    lines.into_iter().flatten().collect::<Vec<_>>().join("\n")
}

fn append_posting_failure_notes(existing: Option<&str>, failure: &PostingFailure) -> String {
    let mut lines = vec![existing.map(str::to_string)];
    lines.push(Some("Posting gate handled by reel-pipeline.".into()));
    lines.push(Some("posting_status: error".into()));
    lines.push(Some(format!(
        "posting_error_category: {}",
        failure.category
    )));
    lines.push(Some(format!(
        "posting_error_retryable: {}",
        if failure.retryable { "true" } else { "false" }
    )));
    lines.push(Some(format!("posting_error: {}", failure.message)));
    lines.into_iter().flatten().collect::<Vec<_>>().join("\n")
}

pub fn validate_posting_preflight(
    post: &MarketingPost,
    capabilities: &PostingCapabilities,
    local_video_path: Option<&Path>,
) -> Result<()> {
    if !capabilities.channels.contains(&post.channel.as_str()) {
        return Err(anyhow!(
            "{} does not support channel {}",
            capabilities.provider,
            post.channel
        ));
    }

    let asset_url = post.result_url.as_deref().or(post.asset_url.as_deref());
    let has_local_video = local_video_path.is_some()
        || post
            .local_path
            .as_ref()
            .is_some_and(|p| !p.trim().is_empty());
    if capabilities.requires_rendered_asset && asset_url.is_none() && !has_local_video {
        return Err(anyhow!("missing rendered asset"));
    }
    if capabilities.requires_public_video_url {
        let Some(asset_url) = asset_url else {
            return Err(anyhow!(
                "{} requires a public http(s) video URL",
                capabilities.provider
            ));
        };
        if !is_http_url(asset_url) {
            return Err(anyhow!(
                "{} requires a public http(s) video URL",
                capabilities.provider
            ));
        }
    }
    if capabilities.requires_local_video && !has_local_video {
        return Err(anyhow!(
            "{} requires a local video path",
            capabilities.provider
        ));
    }

    let caption = build_caption(post);
    if let Some(max) = capabilities.max_caption_length {
        if caption.len() > max {
            return Err(anyhow!(
                "{} caption exceeds {} characters",
                capabilities.provider,
                max
            ));
        }
    }
    if let Some(max) = capabilities.max_title_length {
        if post.title.len() > max {
            return Err(anyhow!(
                "{} title exceeds {} characters",
                capabilities.provider,
                max
            ));
        }
    }
    if let Some(max) = capabilities.max_tags {
        if post.tags.as_ref().is_some_and(|tags| tags.len() > max) {
            return Err(anyhow!(
                "{} allows at most {} tags",
                capabilities.provider,
                max
            ));
        }
    }

    Ok(())
}

pub fn classify_posting_error(error: &anyhow::Error) -> PostingFailure {
    let message = error.to_string();
    let lower = message.to_lowercase();
    if lower.contains("quota") {
        return failure("quota", true, message);
    }
    if lower.contains("token")
        || lower.contains("oauth")
        || lower.contains("401")
        || lower.contains("403")
    {
        return failure("needs_reconnect", false, message);
    }
    if lower.contains("429") || lower.contains("rate limit") {
        return failure("rate_limited", true, message);
    }
    if lower.contains("timeout")
        || lower.contains("timed out")
        || lower.contains("503")
        || lower.contains("502")
        || lower.contains("500")
    {
        return failure("provider_down", true, message);
    }
    if lower.contains("caption") || lower.contains("title") || lower.contains("too long") {
        return failure("bad_caption", false, message);
    }
    if lower.contains("video") || lower.contains("asset") || lower.contains("container") {
        return failure("bad_asset", false, message);
    }
    failure("unknown", true, message)
}

fn failure(category: &str, retryable: bool, message: String) -> PostingFailure {
    PostingFailure {
        category: category.into(),
        retryable,
        message,
    }
}

fn is_http_url(value: &str) -> bool {
    value.starts_with("http://") || value.starts_with("https://")
}

pub fn post_ready_marketing_videos<C, P>(
    client: &C,
    poster: &P,
    now: OffsetDateTime,
    options: &PostReadyOptions,
) -> Result<PostReadyReport>
where
    C: MarketingClient,
    P: MarketingPoster,
{
    if !options.confirm_post {
        return Err(anyhow!("posting requires confirm_post=true"));
    }
    let posts = client.list_marketing_posts(&ListFilters {
        status: Some("accepted".into()),
        project_slug: options.project_slug.clone(),
        channel: options.channel.clone(),
        limit: Some(options.limit.max(1)),
    })?;
    let mut results = Vec::new();
    for post in &posts {
        if options.missed_only && !is_missed_ready_post(post, now) {
            results.push(PostReadyResult {
                post_id: post.id.clone(),
                skipped: Some(true),
                reason: Some("not missed ready post".into()),
                posted: None,
                failure: None,
                sync: None,
            });
            continue;
        }

        let gate = posting_gate(post, now, options.include_unscheduled);
        if !gate.ready {
            results.push(PostReadyResult {
                post_id: post.id.clone(),
                skipped: Some(true),
                reason: gate.reason,
                posted: None,
                failure: None,
                sync: None,
            });
            continue;
        }
        match poster.post(post) {
            Ok(posted) => {
                let patch = patch_for_posting_result(post, &posted);
                let sync = client.update_marketing_post(&post.id, &patch)?;
                results.push(PostReadyResult {
                    post_id: post.id.clone(),
                    skipped: None,
                    reason: None,
                    posted: Some(posted),
                    failure: None,
                    sync: Some(sync),
                });
            }
            Err(error) => {
                let failure = classify_posting_error(&error);
                let patch = patch_for_posting_failure(post, &failure);
                let sync = client.update_marketing_post(&post.id, &patch)?;
                results.push(PostReadyResult {
                    post_id: post.id.clone(),
                    skipped: Some(true),
                    reason: Some(failure.message.clone()),
                    posted: None,
                    failure: Some(failure),
                    sync: Some(sync),
                });
            }
        }
    }
    Ok(PostReadyReport {
        scanned: posts.len(),
        results,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::saas_maker::stub::StubMarketingClient;
    use crate::saas_maker::MarketingPost;

    fn post(id: &str, channel: &str, status: &str) -> MarketingPost {
        MarketingPost {
            id: id.into(),
            project_slug: "p".into(),
            channel: channel.into(),
            status: status.into(),
            title: "t".into(),
            hook: Some("h".into()),
            body: "b".into(),
            cta: None,
            task_id: None,
            asset_url: Some("https://x/y.mp4".into()),
            result_url: Some("https://x/y.mp4".into()),
            scheduled_for: Some("2026-06-16T11:00:00Z".into()),
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
    fn posting_gate_requires_reel_channel_and_asset() {
        let now = OffsetDateTime::parse("2026-06-16T12:00:00Z", &Rfc3339).unwrap();
        let ready = posting_gate(&post("a", "youtube_shorts", "accepted"), now, true);
        assert!(ready.ready);
        let blog = MarketingPost {
            channel: "blog".into(),
            ..post("b", "blog", "accepted")
        };
        assert!(!posting_gate(&blog, now, true).ready);
    }

    #[test]
    fn missed_ready_post_requires_overdue_schedule_and_render() {
        let now = OffsetDateTime::parse("2026-06-16T12:00:00Z", &Rfc3339).unwrap();
        let ready = post("ready", "youtube_shorts", "accepted");
        assert!(is_missed_ready_post(&ready, now));
        assert!(!is_missed_ready_post(
            &MarketingPost {
                scheduled_for: Some("2026-06-16T13:00:00Z".into()),
                ..ready.clone()
            },
            now
        ));
        assert!(!is_missed_ready_post(
            &MarketingPost {
                scheduled_for: None,
                ..ready.clone()
            },
            now
        ));
        assert!(!is_missed_ready_post(
            &MarketingPost {
                posted_at: Some("2026-06-16T12:30:00Z".into()),
                ..ready
            },
            now
        ));
    }

    #[test]
    fn provider_preflight_catches_platform_asset_requirements() {
        let instagram_local = MarketingPost {
            result_url: Some("file:///tmp/reel.mp4".into()),
            ..post("ig", "instagram_reels", "accepted")
        };
        let err = validate_posting_preflight(&instagram_local, &INSTAGRAM_CAPABILITIES, None)
            .unwrap_err();
        assert!(err.to_string().contains("public http(s) video URL"));

        let youtube_remote = MarketingPost {
            local_path: None,
            result_url: Some("https://assets.example.test/reel.mp4".into()),
            ..post("yt", "youtube_shorts", "accepted")
        };
        let err =
            validate_posting_preflight(&youtube_remote, &YOUTUBE_CAPABILITIES, None).unwrap_err();
        assert!(err.to_string().contains("local video path"));
    }

    #[test]
    fn classify_posting_errors_into_actionable_buckets() {
        assert_eq!(
            classify_posting_error(&anyhow!("OAuth refresh token expired")).category,
            "needs_reconnect"
        );
        assert_eq!(
            classify_posting_error(&anyhow!("YouTube quota exceeded")).category,
            "quota"
        );
        assert!(classify_posting_error(&anyhow!("provider returned 503")).retryable);
        assert_eq!(
            classify_posting_error(&anyhow!("caption is too long")).category,
            "bad_caption"
        );
    }

    #[test]
    fn build_caption_falls_back_to_title() {
        let post = MarketingPost {
            id: "p".into(),
            project_slug: "x".into(),
            channel: "youtube_shorts".into(),
            status: "accepted".into(),
            title: "Title".into(),
            hook: None,
            body: "b".into(),
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
        };
        assert_eq!(build_caption(&post), "Title");
    }

    #[test]
    fn channel_routing_falls_back_to_manual_for_tiktok() {
        let now = OffsetDateTime::parse("2026-06-16T12:00:00Z", &Rfc3339).unwrap();
        let cfg = crate::config::SocialAccountsConfig::default();
        let router = ChannelRoutingPoster::from_accounts(Path::new("."), cfg, now).unwrap();
        let outcome = router
            .post(&MarketingPost {
                id: "t".into(),
                project_slug: "p".into(),
                channel: "tiktok".into(),
                status: "accepted".into(),
                title: "t".into(),
                hook: Some("h".into()),
                body: "b".into(),
                cta: None,
                task_id: None,
                asset_url: Some("https://x/y.mp4".into()),
                result_url: Some("https://x/y.mp4".into()),
                scheduled_for: None,
                posted_at: None,
                notes: None,
                created_at: None,
                inserted_at: None,
                tags: None,
                account_slug: None,
                local_path: None,
            })
            .unwrap();
        assert_eq!(outcome.provider, "manual");
        assert_eq!(outcome.status, "prepared");
    }

    #[test]
    fn post_ready_updates_sent_status() {
        let now = OffsetDateTime::parse("2026-06-16T12:00:00Z", &Rfc3339).unwrap();
        let client = StubMarketingClient::new(vec![post("yt", "youtube_shorts", "accepted")]);
        let report = post_ready_marketing_videos(
            &client,
            &StubPoster { outcomes: vec![] },
            now,
            &PostReadyOptions {
                limit: 5,
                include_unscheduled: true,
                confirm_post: true,
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(report.results.len(), 1);
        assert!(report.results[0].skipped.is_none());
        assert_eq!(client.posts.borrow()[0].status, "sent");
        assert!(client.posts.borrow()[0]
            .notes
            .as_deref()
            .unwrap()
            .contains("external_id: posted"));
    }

    #[test]
    fn post_ready_records_posting_failure_and_continues() {
        let now = OffsetDateTime::parse("2026-06-16T12:00:00Z", &Rfc3339).unwrap();
        let client = StubMarketingClient::new(vec![
            post("bad", "youtube_shorts", "accepted"),
            post("good", "youtube_shorts", "accepted"),
        ]);
        struct SometimesFailingPoster;
        impl MarketingPoster for SometimesFailingPoster {
            fn post(&self, marketing_post: &MarketingPost) -> Result<PostedOutcome> {
                if marketing_post.id == "bad" {
                    return Err(anyhow!("caption is too long"));
                }
                Ok(PostedOutcome {
                    provider: "manual".into(),
                    status: "prepared".into(),
                    channel: marketing_post.channel.clone(),
                    asset_url: marketing_post.result_url.clone(),
                    external_id: None,
                    external_url: None,
                    posted_at: None,
                    prepared_at: Some("2026-06-16T12:00:01Z".into()),
                    scheduled_for: None,
                })
            }
        }

        let report = post_ready_marketing_videos(
            &client,
            &SometimesFailingPoster,
            now,
            &PostReadyOptions {
                limit: 5,
                include_unscheduled: true,
                confirm_post: true,
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(
            report.results[0].failure.as_ref().unwrap().category,
            "bad_caption"
        );
        assert_eq!(
            report.results[1].posted.as_ref().unwrap().status,
            "prepared"
        );
        let posts = client.posts.borrow();
        assert_eq!(posts[0].status, "accepted");
        assert!(posts[0]
            .notes
            .as_deref()
            .unwrap()
            .contains("posting_error_category: bad_caption"));
    }

    #[test]
    fn post_ready_can_run_missed_only_recovery() {
        let now = OffsetDateTime::parse("2026-06-16T12:00:00Z", &Rfc3339).unwrap();
        let client = StubMarketingClient::new(vec![
            post("missed", "youtube_shorts", "accepted"),
            MarketingPost {
                id: "future".into(),
                scheduled_for: Some("2026-06-16T13:00:00Z".into()),
                ..post("future", "youtube_shorts", "accepted")
            },
            MarketingPost {
                id: "unscheduled".into(),
                scheduled_for: None,
                ..post("unscheduled", "youtube_shorts", "accepted")
            },
        ]);

        let report = post_ready_marketing_videos(
            &client,
            &StubPoster { outcomes: vec![] },
            now,
            &PostReadyOptions {
                limit: 5,
                include_unscheduled: true,
                missed_only: true,
                confirm_post: true,
                ..Default::default()
            },
        )
        .unwrap();

        assert_eq!(report.results[0].posted.as_ref().unwrap().status, "posted");
        assert_eq!(
            report.results[1].reason.as_deref(),
            Some("not missed ready post")
        );
        assert_eq!(
            report.results[2].reason.as_deref(),
            Some("not missed ready post")
        );
        assert_eq!(client.posts.borrow()[0].status, "sent");
        assert_eq!(client.posts.borrow()[1].status, "accepted");
        assert_eq!(client.posts.borrow()[2].status, "accepted");
    }
}
