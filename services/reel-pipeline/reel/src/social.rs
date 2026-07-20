//! Social posting interface — placeholder for the gated handoff in
//! `src/posting.js` / `src/publishers/{youtube,instagram}.js`.
//!
//! Phase 1 intentionally ships only a [`DryRunPoster`]: it never POSTs to
//! YouTube/Instagram, it only records what *would* be posted. Real provider
//! wiring (YouTube Data API, Instagram Graph API, Upload-Post) is deferred to a
//! later phase behind this same trait. This keeps the safety guarantee that the
//! Rust orchestrator cannot publish anything yet.

use anyhow::Result;

use crate::config::SocialAccount;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PostRequest {
    pub platform: String,
    pub account_slug: String,
    pub project_slug: Option<String>,
    pub video_url: String,
    pub caption: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PostOutcome {
    pub posted: bool,
    pub reason: String,
}

pub trait SocialPoster {
    fn post(&self, request: &PostRequest, account: &SocialAccount) -> Result<PostOutcome>;
}

/// Records intent without performing any network call. Always returns
/// `posted: false` so a post is never marked sent — matching the README's
/// "does not mark a post as sent unless a real provider reports success".
#[derive(Debug, Default)]
pub struct DryRunPoster {
    pub recorded: std::cell::RefCell<Vec<PostRequest>>,
}

impl DryRunPoster {
    pub fn new() -> Self {
        Self::default()
    }
}

impl SocialPoster for DryRunPoster {
    fn post(&self, request: &PostRequest, _account: &SocialAccount) -> Result<PostOutcome> {
        self.recorded.borrow_mut().push(request.clone());
        Ok(PostOutcome {
            posted: false,
            reason: "dry-run: no live posting provider wired (Phase 1)".to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    fn account() -> SocialAccount {
        SocialAccount {
            slug: "main".into(),
            projects: vec!["linkchat".into()],
            default: true,
            fields: BTreeMap::new(),
        }
    }

    #[test]
    fn dry_run_records_but_never_posts() {
        let poster = DryRunPoster::new();
        let req = PostRequest {
            platform: "youtube".into(),
            account_slug: "main".into(),
            project_slug: Some("linkchat".into()),
            video_url: "https://w.dev/reels/x.mp4".into(),
            caption: "hi".into(),
        };
        let outcome = poster.post(&req, &account()).unwrap();
        assert!(!outcome.posted);
        assert_eq!(poster.recorded.borrow().len(), 1);
    }
}
