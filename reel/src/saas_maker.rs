//! SaaS Maker marketing API client — port of `src/saas-maker-client.js`.

use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::artifact::first_video_url;
use crate::brief::{normalize_from_value, BriefError, VideoBrief};

pub const DEFAULT_API_URL: &str = "https://api.sassmaker.com";

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct MarketingPost {
    pub id: String,
    pub project_slug: String,
    pub channel: String,
    pub status: String,
    pub title: String,
    #[serde(default)]
    pub hook: Option<String>,
    pub body: String,
    #[serde(default)]
    pub cta: Option<String>,
    #[serde(default)]
    pub task_id: Option<String>,
    #[serde(default)]
    pub asset_url: Option<String>,
    #[serde(default)]
    pub result_url: Option<String>,
    #[serde(default)]
    pub scheduled_for: Option<String>,
    #[serde(default)]
    pub posted_at: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub inserted_at: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub account_slug: Option<String>,
    #[serde(default)]
    pub local_path: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct ListFilters {
    pub status: Option<String>,
    pub project_slug: Option<String>,
    pub channel: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct UpdateResult {
    pub skipped: bool,
    pub reason: Option<String>,
}

pub trait MarketingClient {
    fn list_marketing_posts(&self, filters: &ListFilters) -> Result<Vec<MarketingPost>>;
    fn update_marketing_post(&self, id: &str, patch: &Value) -> Result<UpdateResult>;
}

pub struct SaaSMakerClient {
    base_url: String,
    session_token: Option<String>,
}

impl SaaSMakerClient {
    pub fn from_env() -> Self {
        Self {
            base_url: std::env::var("SAASMAKER_API_URL")
                .unwrap_or_else(|_| DEFAULT_API_URL.to_string())
                .trim_end_matches('/')
                .to_string(),
            session_token: std::env::var("SAASMAKER_SESSION_TOKEN").ok(),
        }
    }

    pub fn with_token(mut self, token: impl Into<String>) -> Self {
        self.session_token = Some(token.into());
        self
    }
}

impl MarketingClient for SaaSMakerClient {
    fn list_marketing_posts(&self, filters: &ListFilters) -> Result<Vec<MarketingPost>> {
        let token = self
            .session_token
            .as_deref()
            .ok_or_else(|| anyhow!("missing SAASMAKER_SESSION_TOKEN"))?;
        let mut url = format!("{}/v1/marketing/posts", self.base_url);
        let mut query = Vec::new();
        if let Some(status) = &filters.status {
            query.push(format!("status={}", urlencoding(status)));
        }
        if let Some(slug) = &filters.project_slug {
            query.push(format!("project_slug={}", urlencoding(slug)));
        }
        if let Some(channel) = &filters.channel {
            query.push(format!("channel={}", urlencoding(channel)));
        }
        if let Some(limit) = filters.limit {
            query.push(format!("limit={limit}"));
        }
        if !query.is_empty() {
            url.push('?');
            url.push_str(&query.join("&"));
        }

        let mut response = ureq::get(&url)
            .header("authorization", &format!("Bearer {token}"))
            .call()
            .map_err(|err| anyhow!("SaaS Maker marketing list failed: {err}"))?;
        if response.status() != 200 {
            let body = response.body_mut().read_to_string().unwrap_or_default();
            return Err(anyhow!(
                "SaaS Maker marketing list failed {}: {body}",
                response.status()
            ));
        }
        let body = response.body_mut().read_to_string()?;
        let payload: Value = serde_json::from_str(&body).context("parsing marketing list json")?;
        let data = payload
            .get("data")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        data.into_iter()
            .map(|entry| serde_json::from_value(entry).context("parsing marketing post"))
            .collect()
    }

    fn update_marketing_post(&self, id: &str, patch: &Value) -> Result<UpdateResult> {
        let Some(token) = self.session_token.as_deref() else {
            return Ok(UpdateResult {
                skipped: true,
                reason: Some("missing SAASMAKER_SESSION_TOKEN".into()),
            });
        };
        let url = format!("{}/v1/marketing/posts/{}", self.base_url, urlencoding(id));
        let mut response = ureq::patch(&url)
            .header("authorization", &format!("Bearer {token}"))
            .header("content-type", "application/json")
            .send_json(patch)
            .map_err(|err| anyhow!("SaaS Maker marketing sync failed: {err}"))?;
        if response.status() != 200 {
            let body = response.body_mut().read_to_string().unwrap_or_default();
            return Err(anyhow!(
                "SaaS Maker marketing sync failed {}: {body}",
                response.status()
            ));
        }
        Ok(UpdateResult {
            skipped: false,
            reason: None,
        })
    }
}

fn urlencoding(input: &str) -> String {
    input
        .chars()
        .map(|c| match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' => c.to_string(),
            _ => format!("%{:02X}", c as u8),
        })
        .collect()
}

/// Port of `briefFromMarketingPost`.
pub fn brief_from_marketing_post(post: &MarketingPost) -> Result<VideoBrief, BriefError> {
    normalize_from_value(&json!({
        "id": format!("brief_{}", post.id),
        "project_slug": post.project_slug,
        "task_id": post.task_id,
        "marketing_post_id": post.id,
        "channel": post.channel,
        "title": post.title,
        "hook": post.hook.as_deref().unwrap_or(&post.title),
        "body": post.body,
        "cta": post.cta,
        "render_mode": "stock",
    }))
}

/// Port of `renderPatchForMarketingPost`.
pub fn render_patch_for_marketing_post(render: &RenderPatchInput) -> Value {
    let video_url = first_video_url(
        &render.videos,
        &render.combined_videos,
        render.video_url.as_deref(),
    );
    let notes = format!(
        "Reel draft generated by reel-pipeline.\nprovider: {}\nexternal_task_id: {}\nstatus: {}",
        render.provider, render.external_task_id, render.status
    );
    json!({
        "asset_url": video_url,
        "result_url": video_url,
        "notes": notes,
    })
}

#[derive(Debug, Clone)]
pub struct RenderPatchInput {
    pub provider: String,
    pub external_task_id: String,
    pub status: String,
    pub videos: Vec<String>,
    pub combined_videos: Vec<String>,
    pub video_url: Option<String>,
}

pub mod stub {
    use super::*;
    use std::cell::RefCell;

    pub struct StubMarketingClient {
        pub posts: RefCell<Vec<MarketingPost>>,
        pub patches: RefCell<Vec<(String, Value)>>,
    }

    impl StubMarketingClient {
        pub fn new(posts: Vec<MarketingPost>) -> Self {
            Self {
                posts: RefCell::new(posts),
                patches: RefCell::new(Vec::new()),
            }
        }
    }

    impl MarketingClient for StubMarketingClient {
        fn list_marketing_posts(&self, filters: &ListFilters) -> Result<Vec<MarketingPost>> {
            Ok(self
                .posts
                .borrow()
                .iter()
                .filter(|post| {
                    filters
                        .status
                        .as_ref()
                        .is_none_or(|status| &post.status == status)
                })
                .cloned()
                .collect())
        }

        fn update_marketing_post(&self, id: &str, patch: &Value) -> Result<UpdateResult> {
            self.patches
                .borrow_mut()
                .push((id.to_string(), patch.clone()));
            if let Some(post) = self.posts.borrow_mut().iter_mut().find(|p| p.id == id) {
                merge_patch(post, patch);
            }
            Ok(UpdateResult {
                skipped: false,
                reason: None,
            })
        }
    }

    fn merge_patch(post: &mut MarketingPost, patch: &Value) {
        if let Some(status) = patch.get("status").and_then(|v| v.as_str()) {
            post.status = status.to_string();
        }
        if let Some(asset_url) = patch.get("asset_url").and_then(|v| v.as_str()) {
            post.asset_url = Some(asset_url.to_string());
        }
        if let Some(result_url) = patch.get("result_url").and_then(|v| v.as_str()) {
            post.result_url = Some(result_url.to_string());
        }
        if let Some(notes) = patch.get("notes").and_then(|v| v.as_str()) {
            post.notes = Some(notes.to_string());
        }
        if let Some(posted_at) = patch.get("posted_at").and_then(|v| v.as_str()) {
            post.posted_at = Some(posted_at.to_string());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn brief_from_marketing_post_sets_stock_mode() {
        let post = MarketingPost {
            id: "mp1".into(),
            project_slug: "linkchat".into(),
            channel: "blog".into(),
            status: "accepted".into(),
            title: "Title".into(),
            hook: None,
            body: "plain body".into(),
            cta: Some("Try it".into()),
            task_id: Some("task_1".into()),
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
        let brief = brief_from_marketing_post(&post).unwrap();
        assert_eq!(brief.id, "brief_mp1");
        assert_eq!(brief.render_mode, "stock");
        assert_eq!(brief.marketing_post_id.as_deref(), Some("mp1"));
        assert_eq!(brief.hook, "Title");
    }

    #[test]
    fn render_patch_uses_first_video_url() {
        let patch = render_patch_for_marketing_post(&RenderPatchInput {
            provider: "mock".into(),
            external_task_id: "mock_1".into(),
            status: "completed".into(),
            videos: vec!["file:///tmp/a.mp4".into()],
            combined_videos: vec![],
            video_url: None,
        });
        assert_eq!(patch["asset_url"], "file:///tmp/a.mp4");
        assert!(patch["notes"].as_str().unwrap().contains("provider: mock"));
    }
}
