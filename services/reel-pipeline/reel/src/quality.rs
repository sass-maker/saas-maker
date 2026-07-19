//! Reel quality scoring — port of `src/reel-quality.js`.
//!
//! Seven-dimension heuristic scoring + the gate that maps a score to one of
//! `video_ready` / `needs_review` / `video_rejected`. Pure logic: it never
//! touches the filesystem or network, so it ports 1:1 and is unit-tested.

use serde::Serialize;

pub const SCORE_DIMENSIONS: &[&str] = &[
    "valueClarity",
    "productProofStrength",
    "visualTrust",
    "captionReadability",
    "mobileComposition",
    "cringeRisk",
    "postingReadiness",
];

const PLACEHOLDER_PATTERNS: &[&str] = &["lorem", "placeholder", "todo", "xxx", "rainbow"];

/// Inputs to scoring, mirroring the `{ brief, variant, proof, render }` shape
/// the JS `scoreVariant` receives. Kept deliberately small/optional so callers
/// can score partially-built renders.
#[derive(Debug, Default, Clone)]
pub struct ScoreInput {
    pub hook: Option<String>,
    pub cta: Option<String>,
    pub body: Option<String>,
    pub product_url: Option<String>,
    pub proof_url: Option<String>,
    /// Resolved proof type (`proof.proofType ?? proof.type`).
    pub proof_type: Option<String>,
    pub proof_path_count: usize,
    pub aspect: String,
    pub duration_seconds: Option<f64>,
    pub render_failed: bool,
    /// First playable video URL after upload (if any).
    pub video_url: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Gate {
    VideoReady,
    NeedsReview,
    VideoRejected,
}

impl Gate {
    pub fn as_str(&self) -> &'static str {
        match self {
            Gate::VideoReady => "video_ready",
            Gate::NeedsReview => "needs_review",
            Gate::VideoRejected => "video_rejected",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct QualityScore {
    pub scores: std::collections::BTreeMap<String, f64>,
    pub overall: f64,
    pub reasons: Vec<String>,
    pub status: String,
    pub gate: String,
}

fn score_value_clarity(input: &ScoreInput, reasons: &mut Vec<String>) -> f64 {
    let hook = input.hook.clone().unwrap_or_default();
    let hook = hook.trim();
    if hook.is_empty() {
        reasons.push("missing hook — value not clear in first 3 seconds".into());
        return 0.1;
    }
    let words: Vec<&str> = hook.split_whitespace().collect();
    if words.len() < 3 {
        reasons.push("hook too short to communicate value".into());
        return 0.4;
    }
    if words.len() > 16 {
        reasons.push("hook too long for first-frame value clarity".into());
        return 0.5;
    }
    let lower = hook.to_lowercase();
    if PLACEHOLDER_PATTERNS.iter().any(|p| lower.contains(p)) {
        reasons.push("hook still has placeholder text".into());
        return 0.2;
    }
    0.85
}

fn score_proof_strength(input: &ScoreInput, reasons: &mut Vec<String>) -> f64 {
    let ty = input.proof_type.as_deref();
    match ty {
        None | Some("generated_card") => {
            reasons.push("no real product proof attached — only generated card".into());
            0.2
        }
        Some("screenshot") if input.proof_path_count > 0 => {
            if input.proof_url.is_some() || input.product_url.is_some() {
                0.9
            } else {
                0.75
            }
        }
        Some("recording") => 0.95,
        Some("changelog") => 0.7,
        Some("before_after") | Some("product_artifact") => 0.8,
        _ => 0.5,
    }
}

fn score_visual_trust(input: &ScoreInput, reasons: &mut Vec<String>) -> f64 {
    match input.proof_type.as_deref() {
        Some("generated_card") => {
            reasons.push("visuals are abstract cards, not trustworthy product proof".into());
            0.3
        }
        None => 0.4,
        Some("repo_screenshot") => 0.6,
        _ => 0.85,
    }
}

fn score_caption_readability(input: &ScoreInput, reasons: &mut Vec<String>) -> f64 {
    let hook = input.hook.clone().unwrap_or_default();
    let cta = input.cta.clone().unwrap_or_default();
    if hook.is_empty() || cta.is_empty() {
        reasons.push("missing hook or CTA caption".into());
        return 0.3;
    }
    let longest = longest_word(&hook).max(longest_word(&cta));
    if longest > 14 {
        reasons.push("caption has very long words that overflow mobile width".into());
        return 0.5;
    }
    if contains_emoji_spam(&hook) || contains_emoji_spam(&cta) {
        reasons.push("caption has emoji spam".into());
        return 0.4;
    }
    0.85
}

fn score_mobile_composition(input: &ScoreInput, reasons: &mut Vec<String>) -> f64 {
    let aspect = if input.aspect.is_empty() {
        "9:16"
    } else {
        input.aspect.as_str()
    };
    if aspect != "9:16" {
        reasons.push(format!("render aspect {aspect} is not 9:16"));
        return 0.3;
    }
    if let Some(duration) = input.duration_seconds {
        if duration.is_finite() {
            if duration < 8.0 {
                reasons.push(format!("duration {duration}s under 8s minimum"));
                return 0.5;
            }
            if duration > 25.0 {
                reasons.push(format!("duration {duration}s over 25s default cap"));
                return 0.55;
            }
        }
    }
    0.85
}

fn score_cringe_risk(input: &ScoreInput, reasons: &mut Vec<String>) -> f64 {
    let text = format!(
        "{} {} {}",
        input.hook.clone().unwrap_or_default(),
        input.cta.clone().unwrap_or_default(),
        input.body.clone().unwrap_or_default()
    )
    .to_lowercase();
    let markers = [
        "🚀",
        "🔥",
        "game changer",
        "crushing it",
        "unlock your potential",
        "manifest",
        "10x your",
        "mind-blowing",
    ];
    let hits: Vec<&str> = markers
        .iter()
        .filter(|m| text.contains(&m.to_lowercase()))
        .copied()
        .collect();
    if !hits.is_empty() {
        reasons.push(format!("spam/cringe markers present: {}", hits.join(", ")));
        return (0.7 - hits.len() as f64 * 0.15).max(0.2);
    }
    0.85
}

fn score_posting_readiness(
    input: &ScoreInput,
    proof_strength: f64,
    reasons: &mut Vec<String>,
) -> f64 {
    if input.render_failed {
        reasons.push("render did not complete".into());
        return 0.0;
    }
    let url = match &input.video_url {
        Some(u) if !u.trim().is_empty() => u,
        _ => {
            reasons.push("no asset URL after upload".into());
            return 0.1;
        }
    };
    let lower = url.to_lowercase();
    let is_video = lower.ends_with(".mp4")
        || lower.ends_with(".mov")
        || lower.ends_with(".webm")
        || lower.contains(".mp4?")
        || lower.contains(".mov?")
        || lower.contains(".webm?");
    if !is_video {
        reasons.push("asset URL is not a video file".into());
        return 0.4;
    }
    if proof_strength < 0.4 {
        return 0.4;
    }
    0.85
}

fn decide_gate(
    scores: &std::collections::BTreeMap<String, f64>,
    overall: f64,
    reasons: &mut Vec<String>,
) -> (Gate, String) {
    let posting = scores["postingReadiness"];
    let proof = scores["productProofStrength"];
    let caption = scores["captionReadability"];

    let mut fatal = Vec::new();
    if posting < 0.3 {
        fatal.push("not ready to post");
    }
    if proof < 0.3 {
        fatal.push("no real product proof");
    }
    if caption < 0.4 {
        fatal.push("captions unreadable");
    }
    if !fatal.is_empty() {
        let summary = fatal.join("; ");
        reasons.push(format!("fatal quality issues: {summary}"));
        return (Gate::VideoRejected, summary);
    }
    if overall >= 0.7 && proof >= 0.6 {
        return (Gate::VideoReady, "passed quality gate".to_string());
    }
    (Gate::NeedsReview, "manual review required".to_string())
}

/// Port of `scoreVariant`.
pub fn score_variant(input: &ScoreInput) -> QualityScore {
    let mut reasons = Vec::new();
    let mut scores = std::collections::BTreeMap::new();

    let value_clarity = score_value_clarity(input, &mut reasons);
    let proof_strength = score_proof_strength(input, &mut reasons);
    let visual_trust = score_visual_trust(input, &mut reasons);
    let caption_readability = score_caption_readability(input, &mut reasons);
    let mobile = score_mobile_composition(input, &mut reasons);
    let cringe = score_cringe_risk(input, &mut reasons);
    let posting = score_posting_readiness(input, proof_strength, &mut reasons);

    scores.insert("valueClarity".to_string(), value_clarity);
    scores.insert("productProofStrength".to_string(), proof_strength);
    scores.insert("visualTrust".to_string(), visual_trust);
    scores.insert("captionReadability".to_string(), caption_readability);
    scores.insert("mobileComposition".to_string(), mobile);
    scores.insert("cringeRisk".to_string(), cringe);
    scores.insert("postingReadiness".to_string(), posting);

    let overall = average(SCORE_DIMENSIONS.iter().map(|d| scores[*d]));
    let (gate, summary) = decide_gate(&scores, overall, &mut reasons);

    QualityScore {
        scores,
        overall: round(overall),
        reasons,
        status: gate.as_str().to_string(),
        gate: summary,
    }
}

/// Port of `gateForScore`.
pub fn gate_for_score(score: &QualityScore) -> Gate {
    if !score.overall.is_finite() {
        return Gate::VideoRejected;
    }
    if score.overall >= 0.7 && score.scores["productProofStrength"] >= 0.6 {
        return Gate::VideoReady;
    }
    if score.overall >= 0.5 {
        return Gate::NeedsReview;
    }
    Gate::VideoRejected
}

fn average(values: impl Iterator<Item = f64>) -> f64 {
    let list: Vec<f64> = values.filter(|v| v.is_finite()).collect();
    if list.is_empty() {
        return 0.0;
    }
    list.iter().sum::<f64>() / list.len() as f64
}

fn round(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

fn longest_word(text: &str) -> usize {
    text.split_whitespace()
        .map(|w| w.chars().count())
        .max()
        .unwrap_or(0)
}

/// Crude emoji-spam heuristic matching the JS `\p{Extended_Pictographic}` count
/// >= 4. We approximate by counting chars outside the BMP plus common symbol
/// ranges — sufficient for the gating heuristic.
fn contains_emoji_spam(text: &str) -> bool {
    let count = text
        .chars()
        .filter(|c| {
            let u = *c as u32;
            (0x1F000..=0x1FAFF).contains(&u)
                || (0x2600..=0x27BF).contains(&u)
                || (0x2190..=0x21FF).contains(&u)
                || u == 0xFE0F
        })
        .count();
    count >= 4
}

#[cfg(test)]
mod tests {
    use super::*;

    fn strong_proof() -> ScoreInput {
        ScoreInput {
            hook: Some("Stop answering the same DM today".into()),
            cta: Some("Try it once".into()),
            body: Some("real product".into()),
            product_url: Some("https://x.dev".into()),
            proof_type: Some("recording".into()),
            proof_path_count: 1,
            aspect: "9:16".into(),
            duration_seconds: Some(18.0),
            render_failed: false,
            video_url: Some("https://cdn/x.mp4".into()),
            ..Default::default()
        }
    }

    #[test]
    fn strong_render_is_video_ready() {
        let score = score_variant(&strong_proof());
        assert_eq!(score.status, "video_ready");
        assert!(score.overall >= 0.7);
    }

    #[test]
    fn generated_card_only_is_rejected() {
        let mut input = strong_proof();
        input.proof_type = Some("generated_card".into());
        input.proof_path_count = 0;
        let score = score_variant(&input);
        // proofStrength 0.2 < 0.3 → fatal
        assert_eq!(score.status, "video_rejected");
    }

    #[test]
    fn failed_render_is_rejected() {
        let mut input = strong_proof();
        input.render_failed = true;
        input.video_url = None;
        let score = score_variant(&input);
        assert_eq!(score.status, "video_rejected");
        assert_eq!(score.scores["postingReadiness"], 0.0);
    }

    #[test]
    fn wrong_aspect_lowers_mobile_score() {
        let mut input = strong_proof();
        input.aspect = "16:9".into();
        let score = score_variant(&input);
        assert_eq!(score.scores["mobileComposition"], 0.3);
    }

    #[test]
    fn video_url_with_cache_buster_counts_as_video() {
        let mut input = strong_proof();
        input.video_url = Some("https://cdn/x.mp4?v=123".into());
        let score = score_variant(&input);
        assert!(score.scores["postingReadiness"] >= 0.85);
    }

    #[test]
    fn gate_for_score_thresholds() {
        let score = score_variant(&strong_proof());
        assert_eq!(gate_for_score(&score), Gate::VideoReady);
    }
}
