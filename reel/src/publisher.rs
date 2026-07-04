//! Artifact publishing interface — ports the R2 publish path from
//! `src/artifact-publisher.js` behind a trait.
//!
//! The one production impl shells out to `npx wrangler r2 object put` exactly as
//! the JS does. Publishing is keyed by [`crate::artifact::stable_file_name`] so
//! the object key is deterministic; the returned URL is `<base>/<key>`.

use std::path::Path;

use anyhow::{anyhow, Result};

use crate::artifact::{self, content_type_for, stable_file_name};
use crate::runner::{CommandRunner, CommandSpec};

pub trait ArtifactPublisher {
    /// Publish a list of local video paths/URLs, returning their public URLs.
    /// Non-local / already-remote URLs pass through unchanged.
    fn publish(&self, urls: &[String], cwd: &Path) -> Result<Vec<String>>;
}

/// Pass-through publisher (no R2 configured) — mirrors the JS branch where
/// `publishRenderArtifacts` returns the render result unchanged.
pub struct NoopPublisher;

impl ArtifactPublisher for NoopPublisher {
    fn publish(&self, urls: &[String], _cwd: &Path) -> Result<Vec<String>> {
        Ok(urls.to_vec())
    }
}

/// Uploads via `npx wrangler r2 object put <bucket>/<key> --file <path> --remote
/// --content-type <ct>` and returns `<base_url>/<key>`.
pub struct R2Publisher<R: CommandRunner> {
    runner: R,
    bucket: String,
    base_url: String,
}

impl<R: CommandRunner> R2Publisher<R> {
    pub fn new(runner: R, bucket: impl Into<String>, base_url: impl Into<String>) -> Self {
        Self {
            runner,
            bucket: bucket.into(),
            base_url: base_url.into(),
        }
    }

    /// Build the exact wrangler invocation for a local file + key.
    pub fn put_command(&self, local_path: &Path, key: &str) -> CommandSpec {
        CommandSpec::new(
            "npx",
            [
                "wrangler".to_string(),
                "r2".to_string(),
                "object".to_string(),
                "put".to_string(),
                format!("{}/{}", self.bucket, key),
                "--file".to_string(),
                local_path.to_string_lossy().into_owned(),
                "--remote".to_string(),
                "--content-type".to_string(),
                content_type_for(&local_path.to_string_lossy()).to_string(),
            ],
        )
    }

    fn public_url(&self, key: &str) -> String {
        format!("{}/{}", self.base_url.trim_end_matches('/'), key)
    }
}

impl<R: CommandRunner> ArtifactPublisher for R2Publisher<R> {
    fn publish(&self, urls: &[String], cwd: &Path) -> Result<Vec<String>> {
        let mut published = Vec::with_capacity(urls.len());
        for url in urls {
            match artifact::classify_artifact(url, cwd) {
                Some(artifact::ArtifactSource::Local(path)) => {
                    let key = stable_file_name(&path);
                    let spec = self.put_command(&path, &key);
                    let out = self.runner.run(&spec)?;
                    if !out.ok() {
                        return Err(anyhow!(
                            "wrangler r2 put failed ({}) for {}: {}",
                            out.status,
                            path.display(),
                            out.stderr.trim()
                        ));
                    }
                    published.push(self.public_url(&key));
                }
                // Loopback-http and remote URLs: the JS downloads loopback first;
                // for Phase 1 we pass non-local URLs through (download deferred).
                _ => published.push(url.clone()),
            }
        }
        Ok(published)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runner::testing::RecordingRunner;

    #[test]
    fn noop_passes_through() {
        let out = NoopPublisher
            .publish(&["a.mp4".into()], Path::new("/work"))
            .unwrap();
        assert_eq!(out, vec!["a.mp4".to_string()]);
    }

    #[test]
    fn r2_publisher_builds_wrangler_command() {
        let publisher = R2Publisher::new(
            RecordingRunner::new(),
            "reel-artifacts",
            "https://w.dev/reels",
        );
        let spec = publisher.put_command(Path::new("/tmp/task1/final.mp4"), "task1-final.mp4");
        assert_eq!(spec.program, "npx");
        assert_eq!(
            spec.args,
            vec![
                "wrangler",
                "r2",
                "object",
                "put",
                "reel-artifacts/task1-final.mp4",
                "--file",
                "/tmp/task1/final.mp4",
                "--remote",
                "--content-type",
                "video/mp4",
            ]
        );
    }

    #[test]
    fn r2_publishes_local_and_returns_public_url() {
        let runner = RecordingRunner::new().with_response(0, "");
        let publisher = R2Publisher::new(runner, "reel-artifacts", "https://w.dev/reels/");
        let urls = publisher
            .publish(&["file:///tmp/task1/final.mp4".into()], Path::new("/work"))
            .unwrap();
        assert_eq!(
            urls,
            vec!["https://w.dev/reels/task1-final.mp4".to_string()]
        );
    }

    #[test]
    fn r2_passes_remote_url_through() {
        let runner = RecordingRunner::new();
        let publisher = R2Publisher::new(runner, "b", "https://w.dev/reels");
        let urls = publisher
            .publish(&["https://cdn.example/x.mp4".into()], Path::new("/work"))
            .unwrap();
        assert_eq!(urls, vec!["https://cdn.example/x.mp4".to_string()]);
    }

    #[test]
    fn r2_propagates_failure() {
        let runner = RecordingRunner::new();
        runner
            .responses
            .borrow_mut()
            .push(Ok(crate::runner::CommandOutput {
                status: 1,
                stdout: String::new(),
                stderr: "boom".into(),
            }));
        let publisher = R2Publisher::new(runner, "b", "https://w.dev/reels");
        let err = publisher
            .publish(&["file:///tmp/t/x.mp4".into()], Path::new("/work"))
            .unwrap_err();
        assert!(err.to_string().contains("wrangler r2 put failed"));
    }
}
