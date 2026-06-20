//! Artifact path / key / content-type logic.
//!
//! Ports the pure helpers from `src/artifact-publisher.js` (local path
//! resolution, stable file naming, content type) and the worker's R2 key safety
//! / cache-buster helpers from `src/worker/index.js`. The actual R2 upload (a
//! `wrangler r2 object put` shell-out) lives behind the
//! [`crate::publisher::ArtifactPublisher`] trait — this module is the
//! side-effect-free naming/validation layer those impls rely on.

use std::path::{Path, PathBuf};

/// Where an artifact URL/path points. Mirrors `toLocalPath` branching.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ArtifactSource {
    /// A `file://` URL or absolute/relative local path resolved to an absolute path.
    Local(PathBuf),
    /// A loopback http(s) URL (127.0.0.1 / localhost) that must be downloaded first.
    LocalHttp(String),
    /// A remote http(s) URL that is already publicly addressable — passed through.
    Remote(String),
}

/// Port of `toLocalPath` classification (without performing any IO).
///
/// In JS, `file://` → pathname, loopback http → download, other http → null
/// (left as-is), absolute → itself, relative → resolved against `cwd`.
pub fn classify_artifact(url: &str, cwd: &Path) -> Option<ArtifactSource> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Some(rest) = trimmed.strip_prefix("file://") {
        return Some(ArtifactSource::Local(PathBuf::from(rest)));
    }
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        return Some(if is_loopback_url(trimmed) {
            ArtifactSource::LocalHttp(trimmed.to_string())
        } else {
            ArtifactSource::Remote(trimmed.to_string())
        });
    }
    let path = Path::new(trimmed);
    if path.is_absolute() {
        Some(ArtifactSource::Local(path.to_path_buf()))
    } else {
        Some(ArtifactSource::Local(cwd.join(path)))
    }
}

fn is_loopback_url(url: &str) -> bool {
    // Strip scheme, take host[:port] before the first '/'.
    let after_scheme = url
        .split_once("://")
        .map(|(_, rest)| rest)
        .unwrap_or(url);
    let host_port = after_scheme.split('/').next().unwrap_or("");
    let host = host_port.split(':').next().unwrap_or("");
    host == "127.0.0.1" || host == "localhost"
}

/// Port of `stableFileName`: `<parent-dir>-<file-name>`. Both flows key R2
/// objects by this so the same render maps to a deterministic object key.
pub fn stable_file_name(local_path: &Path) -> String {
    let file = local_path
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();
    let parent = local_path
        .parent()
        .and_then(|p| p.file_name())
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();
    if parent.is_empty() {
        file
    } else {
        format!("{parent}-{file}")
    }
}

/// Port of `contentTypeFor` (shared identically between publisher and worker).
pub fn content_type_for(path_or_key: &str) -> &'static str {
    let lower = path_or_key.to_lowercase();
    if lower.ends_with(".mp4") {
        "video/mp4"
    } else if lower.ends_with(".json") {
        "application/json; charset=utf-8"
    } else if lower.ends_with(".webm") {
        "video/webm"
    } else if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "image/jpeg"
    } else {
        "application/octet-stream"
    }
}

/// Port of `isSafeKey` in the worker: a served artifact key must be a single
/// path segment with no traversal.
pub fn is_safe_key(key: &str) -> bool {
    !key.is_empty()
        && !key.contains("..")
        && !key.contains('/')
        && key
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
}

/// Port of `safeArtifactKey`: replace anything outside `[A-Za-z0-9._-]` with `_`.
pub fn safe_artifact_key(id: &str) -> String {
    id.chars()
        .map(|c| if c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-') { c } else { '_' })
        .collect()
}

/// Build the public artifact URL `render-pro.js` writes back to the reel record,
/// including the cache-buster the immutable worker cache requires.
pub fn public_artifact_url(base: &str, key: &str, cache_buster: u128) -> String {
    let base = base.trim_end_matches('/');
    format!("{base}/reels/{key}?v={cache_buster}")
}

/// Pick the first usable video URL from a render result's candidate fields
/// (`videos[0]` → `combinedVideos[0]` → `videoUrl`). Mirrors `firstVideoUrl`.
pub fn first_video_url(
    videos: &[String],
    combined: &[String],
    video_url: Option<&str>,
) -> Option<String> {
    videos
        .first()
        .cloned()
        .or_else(|| combined.first().cloned())
        .or_else(|| video_url.map(String::from))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn classifies_file_url() {
        let cwd = PathBuf::from("/work");
        assert_eq!(
            classify_artifact("file:///tmp/a.mp4", &cwd),
            Some(ArtifactSource::Local(PathBuf::from("/tmp/a.mp4")))
        );
    }

    #[test]
    fn classifies_loopback_vs_remote_http() {
        let cwd = PathBuf::from("/work");
        assert_eq!(
            classify_artifact("http://127.0.0.1:8080/x/a.mp4", &cwd),
            Some(ArtifactSource::LocalHttp("http://127.0.0.1:8080/x/a.mp4".into()))
        );
        assert_eq!(
            classify_artifact("https://cdn.example/a.mp4", &cwd),
            Some(ArtifactSource::Remote("https://cdn.example/a.mp4".into()))
        );
    }

    #[test]
    fn resolves_relative_path_against_cwd() {
        let cwd = PathBuf::from("/work");
        assert_eq!(
            classify_artifact("out/a.mp4", &cwd),
            Some(ArtifactSource::Local(PathBuf::from("/work/out/a.mp4")))
        );
    }

    #[test]
    fn stable_file_name_joins_parent_and_file() {
        assert_eq!(
            stable_file_name(Path::new("/tmp/task123/draft.mp4")),
            "task123-draft.mp4"
        );
    }

    #[test]
    fn content_types() {
        assert_eq!(content_type_for("a.mp4"), "video/mp4");
        assert_eq!(content_type_for("a.PNG"), "image/png");
        assert_eq!(content_type_for("a.unknown"), "application/octet-stream");
    }

    #[test]
    fn key_safety() {
        assert!(is_safe_key("reel-1-v1.mp4"));
        assert!(!is_safe_key("../etc/passwd"));
        assert!(!is_safe_key("a/b.mp4"));
        assert!(!is_safe_key(""));
        assert_eq!(safe_artifact_key("reel/12 34"), "reel_12_34");
    }

    #[test]
    fn public_url_has_cache_buster() {
        let url = public_artifact_url("https://w.dev/", "reel-1-v1.mp4", 42);
        assert_eq!(url, "https://w.dev/reels/reel-1-v1.mp4?v=42");
    }

    #[test]
    fn first_video_url_priority() {
        assert_eq!(
            first_video_url(&["a.mp4".into()], &["b.mp4".into()], Some("c.mp4")),
            Some("a.mp4".into())
        );
        assert_eq!(
            first_video_url(&[], &["b.mp4".into()], Some("c.mp4")),
            Some("b.mp4".into())
        );
        assert_eq!(first_video_url(&[], &[], Some("c.mp4")), Some("c.mp4".into()));
        assert_eq!(first_video_url(&[], &[], None), None);
    }
}
