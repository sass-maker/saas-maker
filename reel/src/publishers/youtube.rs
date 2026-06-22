//! YouTube resumable upload — port of `src/publishers/youtube.js`.

use std::cell::RefCell;
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{anyhow, Context, Result};
use serde_json::{json, Value};

const DEFAULT_OAUTH_URL: &str = "https://oauth2.googleapis.com/token";
const DEFAULT_UPLOAD_URL: &str = "https://www.googleapis.com/upload/youtube/v3/videos";
const DEFAULT_CATEGORY_ID: &str = "22";
const TOKEN_SAFETY_WINDOW_MS: u64 = 60_000;

#[derive(Debug, Clone)]
struct TokenCache {
    token: String,
    expires_at_ms: u64,
}

#[derive(Debug, Clone)]
pub struct YouTubeUploadInput<'a> {
    pub video_path: &'a Path,
    pub title: &'a str,
    pub description: Option<&'a str>,
    pub tags: Option<&'a [String]>,
    pub publish_at: Option<&'a str>,
    pub privacy_status: Option<&'a str>,
    pub category_id: Option<&'a str>,
    pub made_for_kids: bool,
}

#[derive(Debug, Clone)]
pub struct YouTubeUploadResult {
    pub video_id: String,
    pub url: String,
    pub privacy_status: String,
    pub publish_at: Option<String>,
    pub raw: Value,
}

pub struct YouTubePublisher {
    client_id: String,
    client_secret: String,
    refresh_token: String,
    oauth_url: String,
    upload_url: String,
    default_privacy: String,
    category_id: String,
    token_cache: RefCell<Option<TokenCache>>,
}

impl YouTubePublisher {
    pub fn from_account_fields(fields: &std::collections::BTreeMap<String, String>) -> Result<Self> {
        Ok(Self {
            client_id: field_or_env(fields, "clientId", "YOUTUBE_OAUTH_CLIENT_ID")?,
            client_secret: field_or_env(fields, "clientSecret", "YOUTUBE_OAUTH_CLIENT_SECRET")?,
            refresh_token: field_or_env(fields, "refreshToken", "YOUTUBE_OAUTH_REFRESH_TOKEN")?,
            oauth_url: fields
                .get("oauthUrl")
                .cloned()
                .unwrap_or_else(|| DEFAULT_OAUTH_URL.to_string()),
            upload_url: fields
                .get("uploadUrl")
                .cloned()
                .unwrap_or_else(|| DEFAULT_UPLOAD_URL.to_string()),
            default_privacy: std::env::var("YOUTUBE_DEFAULT_PRIVACY")
                .ok()
                .or_else(|| fields.get("defaultPrivacy").cloned())
                .unwrap_or_else(|| "private".to_string()),
            category_id: std::env::var("YOUTUBE_CATEGORY_ID")
                .ok()
                .or_else(|| fields.get("categoryId").cloned())
                .unwrap_or_else(|| DEFAULT_CATEGORY_ID.to_string()),
            token_cache: RefCell::new(None),
        })
    }

    pub fn access_token(&self) -> Result<String> {
        let now = now_ms();
        if let Some(cache) = self.token_cache.borrow().as_ref() {
            if cache.expires_at_ms.saturating_sub(TOKEN_SAFETY_WINDOW_MS) > now {
                return Ok(cache.token.clone());
            }
        }

        let body = format!(
            "client_id={}&client_secret={}&refresh_token={}&grant_type=refresh_token",
            urlencode(&self.client_id),
            urlencode(&self.client_secret),
            urlencode(&self.refresh_token),
        );
        let mut response = ureq::post(&self.oauth_url)
            .header("content-type", "application/x-www-form-urlencoded")
            .send(body.as_bytes())
            .map_err(|err| anyhow!("YouTube token refresh failed: {err}"))?;
        if response.status() != 200 {
            let text = response.body_mut().read_to_string().unwrap_or_default();
            return Err(anyhow!("YouTube token refresh failed {}: {text}", response.status()));
        }
        let payload: Value = serde_json::from_str(&response.body_mut().read_to_string()?)
            .context("parsing YouTube token response")?;
        let token = payload
            .get("access_token")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("YouTube token refresh missing access_token"))?;
        let expires_in = payload.get("expires_in").and_then(|v| v.as_i64()).unwrap_or(3600);
        *self.token_cache.borrow_mut() = Some(TokenCache {
            token: token.to_string(),
            expires_at_ms: now + (expires_in as u64 * 1000),
        });
        Ok(token.to_string())
    }

    pub fn upload(&self, input: &YouTubeUploadInput<'_>) -> Result<YouTubeUploadResult> {
        if !input.video_path.exists() {
            return Err(anyhow!(
                "upload requires existing videoPath ({})",
                input.video_path.display()
            ));
        }
        let title = trim_to_bytes(input.title, 100);
        let description = append_shorts_tag(input.description.unwrap_or(""));
        let tags = input.tags.map(|t| t.iter().take(30).cloned().collect::<Vec<_>>());
        let category_id = input
            .category_id
            .unwrap_or(self.category_id.as_str());
        let publish_at = input.publish_at.map(normalize_iso);
        let privacy_status = if publish_at.is_some() {
            "private".to_string()
        } else {
            input
                .privacy_status
                .unwrap_or(self.default_privacy.as_str())
                .to_string()
        };

        let mut metadata = json!({
            "snippet": {
                "title": title,
                "description": description,
                "categoryId": category_id,
            },
            "status": {
                "privacyStatus": privacy_status,
                "selfDeclaredMadeForKids": input.made_for_kids,
            }
        });
        if let Some(tags) = tags.filter(|t| !t.is_empty()) {
            metadata["snippet"]["tags"] = json!(tags);
        }
        if let Some(publish_at) = &publish_at {
            metadata["status"]["publishAt"] = json!(publish_at);
        }

        let bytes = fs::read(input.video_path)
            .with_context(|| format!("reading {}", input.video_path.display()))?;
        let access_token = self.access_token()?;
        let init_url = format!(
            "{}?uploadType=resumable&part=snippet,status",
            self.upload_url.trim_end_matches('/')
        );
        let mut init = ureq::post(&init_url)
            .header("authorization", &format!("Bearer {access_token}"))
            .header("content-type", "application/json; charset=UTF-8")
            .header("x-upload-content-type", "video/*")
            .header("x-upload-content-length", &bytes.len().to_string())
            .send_json(&metadata)
            .map_err(|err| anyhow!("YouTube resumable init failed: {err}"))?;
        if init.status() != 200 {
            let text = init.body_mut().read_to_string().unwrap_or_default();
            return Err(anyhow!("YouTube resumable init failed {}: {text}", init.status()));
        }
        let session_url = init
            .headers()
            .get("location")
            .ok_or_else(|| anyhow!("YouTube resumable init missing Location header"))?
            .to_str()
            .context("invalid Location header")?
            .to_string();

        let mut upload = ureq::put(&session_url)
            .header("content-type", "video/*")
            .header("content-length", &bytes.len().to_string())
            .send(&bytes)
            .map_err(|err| anyhow!("YouTube upload failed: {err}"))?;
        if upload.status() != 200 {
            let text = upload.body_mut().read_to_string().unwrap_or_default();
            return Err(anyhow!("YouTube upload failed {}: {text}", upload.status()));
        }
        let payload: Value = serde_json::from_str(&upload.body_mut().read_to_string()?)
            .context("parsing YouTube upload response")?;
        let video_id = payload
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("YouTube upload missing video id"))?;
        Ok(YouTubeUploadResult {
            video_id: video_id.to_string(),
            url: format!("https://youtube.com/shorts/{video_id}"),
            privacy_status: payload
                .pointer("/status/privacyStatus")
                .and_then(|v| v.as_str())
                .unwrap_or(privacy_status.as_str())
                .to_string(),
            publish_at: payload
                .pointer("/status/publishAt")
                .and_then(|v| v.as_str())
                .map(str::to_string)
                .or(publish_at),
            raw: payload,
        })
    }
}

fn field_or_env(
    fields: &std::collections::BTreeMap<String, String>,
    key: &str,
    env_key: &str,
) -> Result<String> {
    fields
        .get(key)
        .cloned()
        .or_else(|| std::env::var(env_key).ok())
        .filter(|v| !v.trim().is_empty())
        .ok_or_else(|| anyhow!("YouTubePublisher requires {key} (or {env_key})"))
}

pub fn append_shorts_tag(description: &str) -> String {
    if description.to_ascii_lowercase().contains("#shorts") {
        return description.to_string();
    }
    if description.is_empty() {
        return "#Shorts".to_string();
    }
    format!("{description}\n\n#Shorts")
}

fn trim_to_bytes(text: &str, max: usize) -> String {
    if text.len() > max {
        text[..max].to_string()
    } else {
        text.to_string()
    }
}

fn normalize_iso(value: &str) -> String {
    value.replace('Z', ".000Z")
}

fn urlencode(input: &str) -> String {
    input
        .chars()
        .map(|c| match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' => c.to_string(),
            _ => format!("%{:02X}", c as u8),
        })
        .collect()
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn append_shorts_tag_adds_hashtag() {
        assert_eq!(append_shorts_tag("hello"), "hello\n\n#Shorts");
        assert_eq!(append_shorts_tag("#Shorts already"), "#Shorts already");
    }

    #[test]
    fn trim_to_bytes_respects_limit() {
        assert_eq!(trim_to_bytes("hello", 3), "hel");
    }
}
