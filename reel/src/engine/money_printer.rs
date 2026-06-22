//! MoneyPrinterTurbo HTTP adapter — port of `src/adapters/moneyprinterturbo.js`.

use anyhow::{anyhow, Context, Result};
use serde_json::Value;

use crate::brief::{to_money_printer_request, VideoBrief};
use crate::engine::{RenderEngine, RenderOptions, RenderResult, RenderStatus};

pub struct MoneyPrinterEngine {
    base_url: String,
}

impl MoneyPrinterEngine {
    pub fn from_env() -> Self {
        Self {
            base_url: std::env::var("MONEYPRINTER_API_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:8080".to_string())
                .trim_end_matches('/')
                .to_string(),
        }
    }

    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into().trim_end_matches('/').to_string(),
        }
    }

    fn normalize_status(state: &Value, progress: Option<i64>) -> RenderStatus {
        if progress == Some(100) {
            return RenderStatus::Completed;
        }
        if let Some(n) = state.as_i64() {
            if n == 1 {
                return RenderStatus::Completed;
            }
            if n == -1 {
                return RenderStatus::Failed;
            }
        }
        if state.as_str() == Some("completed") {
            return RenderStatus::Completed;
        }
        if state.as_str() == Some("failed") {
            return RenderStatus::Failed;
        }
        RenderStatus::Running
    }

    fn normalize_urls(urls: &[Value]) -> Vec<String> {
        urls.iter()
            .filter_map(|entry| entry.as_str().map(str::to_string))
            .map(|url| normalize_url(&url))
            .collect()
    }
}

fn normalize_url(url: &str) -> String {
    if url.starts_with("http://")
        || url.starts_with("https://")
        || url.starts_with("file://")
    {
        return url.to_string();
    }
    url.to_string()
}

impl RenderEngine for MoneyPrinterEngine {
    fn name(&self) -> &str {
        "moneyprinterturbo"
    }

    fn create_video(&self, brief: &VideoBrief, _options: &RenderOptions) -> Result<RenderResult> {
        let body = to_money_printer_request(brief);
        let url = format!("{}/api/v1/videos", self.base_url);
        let mut response = ureq::post(&url)
            .header("content-type", "application/json")
            .send_json(&body)
            .map_err(|err| anyhow!("MoneyPrinterTurbo create failed: {err}"))?;
        if response.status() != 200 {
            let text = response.body_mut().read_to_string().unwrap_or_default();
            return Err(anyhow!("MoneyPrinterTurbo create failed {}: {text}", response.status()));
        }
        let body = response.body_mut().read_to_string()?;
        let payload: Value = serde_json::from_str(&body).context("parsing create response")?;
        let external_task_id = payload
            .pointer("/data/task_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("MoneyPrinterTurbo response missing data.task_id"))?;
        Ok(RenderResult {
            provider: "moneyprinterturbo".to_string(),
            external_task_id: external_task_id.to_string(),
            status: RenderStatus::Queued,
            videos: Vec::new(),
            combined_videos: Vec::new(),
            thumbnail: None,
            duration_seconds: None,
            aspect: "9:16".to_string(),
            proof_type: None,
            render_log: Vec::new(),
        })
    }

    fn render_reel_by_id(&self, _reel_id: &str, _options: &RenderOptions) -> Result<RenderResult> {
        Err(anyhow!("moneyprinterturbo does not support render_reel_by_id"))
    }

    fn get_status(&self, external_task_id: &str) -> Result<RenderResult> {
        let url = format!(
            "{}/api/v1/tasks/{}",
            self.base_url,
            urlencoding(external_task_id)
        );
        let mut response = ureq::get(&url)
            .call()
            .map_err(|err| anyhow!("MoneyPrinterTurbo status failed: {err}"))?;
        if response.status() != 200 {
            let text = response.body_mut().read_to_string().unwrap_or_default();
            return Err(anyhow!("MoneyPrinterTurbo status failed {}: {text}", response.status()));
        }
        let body = response.body_mut().read_to_string()?;
        let payload: Value = serde_json::from_str(&body).context("parsing status response")?;
        let data = payload.get("data").cloned().unwrap_or(Value::Null);
        let progress = data.get("progress").and_then(|v| v.as_i64());
        let status = Self::normalize_status(data.get("state").unwrap_or(&Value::Null), progress);
        let videos = data
            .get("videos")
            .and_then(|v| v.as_array())
            .map(|items| Self::normalize_urls(items))
            .unwrap_or_default();
        let combined = data
            .get("combined_videos")
            .and_then(|v| v.as_array())
            .map(|items| Self::normalize_urls(items))
            .unwrap_or_default();
        Ok(RenderResult {
            provider: "moneyprinterturbo".to_string(),
            external_task_id: external_task_id.to_string(),
            status,
            videos,
            combined_videos: combined,
            thumbnail: None,
            duration_seconds: None,
            aspect: "9:16".to_string(),
            proof_type: None,
            render_log: Vec::new(),
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
