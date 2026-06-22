//! Instagram Graph reel publishing — port of `src/publishers/instagram.js`.

use std::thread;
use std::time::{Duration, Instant};

use anyhow::{anyhow, Context, Result};
use serde_json::Value;

const DEFAULT_GRAPH_URL: &str = "https://graph.instagram.com";
const DEFAULT_API_VERSION: &str = "v22.0";
const DEFAULT_POLL_INTERVAL_MS: u64 = 3_000;
const DEFAULT_POLL_TIMEOUT_MS: u64 = 5 * 60_000;

#[derive(Debug, Clone)]
pub struct InstagramReelInput<'a> {
    pub video_url: &'a str,
    pub caption: Option<&'a str>,
    pub share_to_feed: Option<bool>,
    pub thumb_offset_ms: Option<u64>,
}

#[derive(Debug, Clone)]
pub struct InstagramPublishResult {
    pub media_id: String,
    pub url: String,
    pub raw: Value,
}

pub struct InstagramPublisher {
    user_id: String,
    long_lived_token: String,
    graph_url: String,
    api_version: String,
    poll_interval_ms: u64,
    poll_timeout_ms: u64,
}

impl InstagramPublisher {
    pub fn from_account_fields(fields: &std::collections::BTreeMap<String, String>) -> Result<Self> {
        Ok(Self {
            user_id: fields
                .get("userId")
                .cloned()
                .filter(|v| !v.trim().is_empty())
                .ok_or_else(|| anyhow!("InstagramPublisher requires userId"))?,
            long_lived_token: fields
                .get("longLivedToken")
                .cloned()
                .filter(|v| !v.trim().is_empty())
                .ok_or_else(|| anyhow!("InstagramPublisher requires longLivedToken"))?,
            graph_url: fields
                .get("graphUrl")
                .cloned()
                .unwrap_or_else(|| DEFAULT_GRAPH_URL.to_string())
                .trim_end_matches('/')
                .to_string(),
            api_version: fields
                .get("apiVersion")
                .cloned()
                .unwrap_or_else(|| DEFAULT_API_VERSION.to_string()),
            poll_interval_ms: fields
                .get("pollIntervalMs")
                .and_then(|v| v.parse().ok())
                .unwrap_or(DEFAULT_POLL_INTERVAL_MS),
            poll_timeout_ms: fields
                .get("pollTimeoutMs")
                .and_then(|v| v.parse().ok())
                .unwrap_or(DEFAULT_POLL_TIMEOUT_MS),
        })
    }

    fn api_base(&self) -> String {
        format!("{}/{}", self.graph_url, self.api_version)
    }

    fn user_base(&self) -> String {
        format!("{}/{}", self.api_base(), self.user_id)
    }

    pub fn publish_reel(&self, input: &InstagramReelInput<'_>) -> Result<InstagramPublishResult> {
        if !is_http_url(input.video_url) {
            return Err(anyhow!(
                "InstagramPublisher.video_url must be a public http(s) URL (got {})",
                input.video_url
            ));
        }
        let container_id = self.create_container(input)?;
        let status = self.wait_for_container(&container_id)?;
        if status != "FINISHED" {
            return Err(anyhow!("Instagram container {container_id} ended in {status}"));
        }
        self.publish_container(&container_id)
    }

    fn create_container(&self, input: &InstagramReelInput<'_>) -> Result<String> {
        let mut body = format!(
            "media_type=REELS&video_url={}&caption={}&access_token={}",
            urlencode(input.video_url),
            urlencode(input.caption.unwrap_or("")),
            urlencode(&self.long_lived_token),
        );
        if input.share_to_feed == Some(false) {
            body.push_str("&share_to_feed=false");
        }
        if let Some(offset) = input.thumb_offset_ms {
            body.push_str(&format!("&thumb_offset={offset}"));
        }
        let url = format!("{}/media", self.user_base());
        let mut response = ureq::post(&url)
            .header("content-type", "application/x-www-form-urlencoded")
            .send(body.as_bytes())
            .map_err(|err| anyhow!("Instagram createContainer failed: {err}"))?;
        if response.status() != 200 {
            let text = response.body_mut().read_to_string().unwrap_or_default();
            return Err(anyhow!("Instagram createContainer failed {}: {text}", response.status()));
        }
        let payload: Value = serde_json::from_str(&response.body_mut().read_to_string()?)
            .context("parsing Instagram createContainer response")?;
        payload
            .get("id")
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .ok_or_else(|| anyhow!("Instagram createContainer missing id"))
    }

    fn wait_for_container(&self, container_id: &str) -> Result<String> {
        let deadline = Instant::now() + Duration::from_millis(self.poll_timeout_ms);
        let mut last = "IN_PROGRESS".to_string();
        while Instant::now() < deadline {
            let url = format!(
                "{}/{}?fields=status_code&access_token={}",
                self.api_base(),
                urlencode(container_id),
                urlencode(&self.long_lived_token),
            );
            let mut response = ureq::get(&url)
                .call()
                .map_err(|err| anyhow!("Instagram waitForContainer failed: {err}"))?;
            if response.status() != 200 {
                let text = response.body_mut().read_to_string().unwrap_or_default();
                return Err(anyhow!("Instagram waitForContainer failed {}: {text}", response.status()));
            }
            let payload: Value = serde_json::from_str(&response.body_mut().read_to_string()?)?;
            last = payload
                .get("status_code")
                .and_then(|v| v.as_str())
                .unwrap_or("IN_PROGRESS")
                .to_string();
            if matches!(last.as_str(), "FINISHED" | "ERROR" | "EXPIRED") {
                return Ok(last);
            }
            thread::sleep(Duration::from_millis(self.poll_interval_ms.max(250)));
        }
        Err(anyhow!(
            "Instagram container {container_id} did not finish within {}ms (last={last})",
            self.poll_timeout_ms
        ))
    }

    fn publish_container(&self, container_id: &str) -> Result<InstagramPublishResult> {
        let body = format!(
            "creation_id={}&access_token={}",
            urlencode(container_id),
            urlencode(&self.long_lived_token),
        );
        let url = format!("{}/media_publish", self.user_base());
        let mut response = ureq::post(&url)
            .header("content-type", "application/x-www-form-urlencoded")
            .send(body.as_bytes())
            .map_err(|err| anyhow!("Instagram media_publish failed: {err}"))?;
        if response.status() != 200 {
            let text = response.body_mut().read_to_string().unwrap_or_default();
            return Err(anyhow!("Instagram media_publish failed {}: {text}", response.status()));
        }
        let payload: Value = serde_json::from_str(&response.body_mut().read_to_string()?)?;
        let media_id = payload
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Instagram media_publish missing id"))?;
        Ok(InstagramPublishResult {
            media_id: media_id.to_string(),
            url: format!("https://www.instagram.com/reel/{media_id}/"),
            raw: payload,
        })
    }
}

fn is_http_url(value: &str) -> bool {
    value.starts_with("http://") || value.starts_with("https://")
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_non_http_video_url() {
        let pub_ = InstagramPublisher {
            user_id: "1".into(),
            long_lived_token: "t".into(),
            graph_url: DEFAULT_GRAPH_URL.into(),
            api_version: DEFAULT_API_VERSION.into(),
            poll_interval_ms: 1,
            poll_timeout_ms: 1,
        };
        let err = pub_
            .publish_reel(&InstagramReelInput {
                video_url: "file:///tmp/x.mp4",
                caption: None,
                share_to_feed: None,
                thumb_offset_ms: None,
            })
            .unwrap_err();
        assert!(err.to_string().contains("http(s) URL"));
    }
}
