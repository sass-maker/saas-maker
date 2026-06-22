//! Marketing posting gate — port of `src/posting.js` (gate + ready scan).

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use anyhow::{anyhow, Context, Result};
use serde::Serialize;
use serde_json::{json, Value};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

use crate::artifact::{classify_artifact, ArtifactSource};
use crate::config::{resolve_social_accounts, route_account, SocialAccount, SocialAccountsConfig};
use crate::publishers::{InstagramPublisher, YouTubePublisher};
use crate::publishers::instagram::InstagramReelInput;
use crate::publishers::youtube::YouTubeUploadInput;
use crate::brief::is_reel_channel;
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
    pub external_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub posted_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prepared_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scheduled_for: Option<String>,
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
        Ok(PostedOutcome {
            provider: "manual".into(),
            status: "prepared".into(),
            channel: marketing_post.channel.clone(),
            asset_url: marketing_post
                .result_url
                .clone()
                .or_else(|| marketing_post.asset_url.clone()),
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

    fn youtube_for<'a>(&'a self, post: &MarketingPost) -> Result<(&'a YouTubePublisher, Option<String>)> {
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
            Some(OffsetDateTime::now_utc().format(&Rfc3339).unwrap_or_default())
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
            external_url: Some(published.url),
            posted_at: Some(OffsetDateTime::now_utc().format(&Rfc3339).unwrap_or_default()),
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

pub fn create_poster(mode: &str, repo_root: &Path, now: OffsetDateTime) -> Result<AnyMarketingPoster> {
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
        _ => Err(anyhow!("no local video path for marketing post {}", post.id)),
    }
}

#[derive(Debug, Clone, Default)]
pub struct PostReadyOptions {
    pub limit: usize,
    pub project_slug: Option<String>,
    pub channel: Option<String>,
    pub include_unscheduled: bool,
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

fn append_posting_notes(existing: Option<&str>, posted: &PostedOutcome) -> String {
    let mut lines = vec![existing.map(str::to_string)];
    lines.push(Some("Posting gate handled by reel-pipeline.".into()));
    lines.push(Some(format!("posting_provider: {}", posted.provider)));
    lines.push(Some(format!("posting_status: {}", posted.status)));
    if let Some(prepared_at) = &posted.prepared_at {
        lines.push(Some(format!("prepared_at: {prepared_at}")));
    }
    if let Some(external_url) = &posted.external_url {
        lines.push(Some(format!("external_url: {external_url}")));
    }
    lines.into_iter().flatten().collect::<Vec<_>>().join("\n")
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
        let gate = posting_gate(post, now, options.include_unscheduled);
        if !gate.ready {
            results.push(PostReadyResult {
                post_id: post.id.clone(),
                skipped: Some(true),
                reason: gate.reason,
                posted: None,
                sync: None,
            });
            continue;
        }
        let posted = poster.post(post)?;
        let patch = patch_for_posting_result(post, &posted);
        let sync = client.update_marketing_post(&post.id, &patch)?;
        results.push(PostReadyResult {
            post_id: post.id.clone(),
            skipped: None,
            reason: None,
            posted: Some(posted),
            sync: Some(sync),
        });
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
    }
}
