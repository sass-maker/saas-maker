//! Product-proof reel templates — port of `src/reel-templates.js`.
//!
//! Template definitions, the `selectTemplate`/`templatesForVariants` matching
//! order, hook variant generation and `buildVariantPlan`. This is pure logic:
//! it decides which template + hook each variant of a brief should use, and is
//! consumed by both the variant render planner and the worker mock renderer.

use serde::{Deserialize, Serialize};

use crate::brief::VideoBrief;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Scene {
    pub label: &'static str,
    pub source: &'static str,
    pub caption: &'static str,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Template {
    pub id: &'static str,
    pub label: &'static str,
    pub proof_type: &'static str,
    pub scenes: Vec<Scene>,
}

fn scene(label: &'static str, source: &'static str, caption: &'static str) -> Scene {
    Scene {
        label,
        source,
        caption,
    }
}

/// The ordered template catalog. Order matters: `selectTemplate` returns the
/// first template whose `matches` predicate is true.
pub fn templates() -> Vec<Template> {
    vec![
        Template {
            id: "problem_proof_cta",
            label: "Problem → Product Proof → CTA",
            proof_type: "screenshot",
            scenes: vec![
                scene("Pain", "hook", "hook"),
                scene("Proof", "product_visual", "proof"),
                scene("Action", "cta_card", "cta"),
            ],
        },
        Template {
            id: "before_after",
            label: "Before → After",
            proof_type: "before_after",
            scenes: vec![
                scene("Before", "pain_card", "before"),
                scene("After", "product_visual", "after"),
                scene("Action", "cta_card", "cta"),
            ],
        },
        Template {
            id: "changelog_proof",
            label: "Changelog Proof",
            proof_type: "changelog",
            scenes: vec![
                scene("Shipped", "changelog_card", "changelog"),
                scene("Proof", "product_visual", "proof"),
                scene("Action", "cta_card", "cta"),
            ],
        },
        Template {
            id: "mini_demo",
            label: "Mini Demo",
            proof_type: "recording",
            scenes: vec![
                scene("Open", "demo_step_1", "step1"),
                scene("Do", "demo_step_2", "step2"),
                scene("See", "demo_step_3", "step3"),
            ],
        },
        Template {
            id: "teardown_audit",
            label: "Teardown / Audit",
            proof_type: "product_artifact",
            scenes: vec![
                scene("Claim", "hook", "claim"),
                scene("Evidence", "product_visual", "evidence"),
                scene("Recommendation", "cta_card", "cta"),
            ],
        },
    ]
}

fn matches(template_id: &str, brief: &VideoBrief) -> bool {
    let body = brief.body.to_lowercase();
    let slug = brief.project_slug.to_lowercase();
    match template_id {
        "problem_proof_cta" => {
            brief.product_url.is_some()
                || brief.proof_url.is_some()
                || brief.target_route.is_some()
                || brief.screenshots.as_ref().map_or(false, |s| !s.is_empty())
        }
        "before_after" => body.contains("before") && body.contains("after"),
        "changelog_proof" => brief.changelog_entry_id.is_some(),
        "mini_demo" => brief.demo_steps.as_ref().map_or(false, |s| s.len() >= 2),
        "teardown_audit" => {
            ["audit", "teardown", "signal", "score", "review"]
                .iter()
                .any(|k| body.contains(k))
                || ["signal", "vetter", "audit"]
                    .iter()
                    .any(|k| slug.contains(k))
        }
        _ => false,
    }
}

pub fn get_template(id: &str) -> Option<Template> {
    templates().into_iter().find(|t| t.id == id)
}

/// Port of `selectTemplate`: explicit `brief.template` wins, else first match,
/// else fall back to `problem_proof_cta`.
pub fn select_template(brief: &VideoBrief) -> Template {
    if let Some(explicit) = &brief.template {
        if let Some(t) = get_template(explicit) {
            return t;
        }
    }
    let all = templates();
    for t in &all {
        if matches(t.id, brief) {
            return t.clone();
        }
    }
    get_template("problem_proof_cta").expect("default template exists")
}

/// Port of `templatesForVariants`: primary first, then other matching, then
/// pad with remaining templates, clamped to `variant_count`.
pub fn templates_for_variants(brief: &VideoBrief, variant_count: usize) -> Vec<Template> {
    let primary = select_template(brief);
    let mut ordered = vec![primary.clone()];
    for t in templates() {
        if t.id == primary.id {
            continue;
        }
        if matches(t.id, brief) {
            ordered.push(t);
        }
    }
    if ordered.len() < variant_count {
        for t in templates() {
            if !ordered.iter().any(|o| o.id == t.id) {
                ordered.push(t);
            }
            if ordered.len() >= variant_count {
                break;
            }
        }
    }
    let take = variant_count.max(1);
    ordered.into_iter().take(take).collect()
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HookVariant {
    pub hook: String,
    pub cta: String,
}

/// Port of `hookVariantsForBrief`.
pub fn hook_variants_for_brief(brief: &VideoBrief, count: usize) -> Vec<HookVariant> {
    let base = brief.hook.trim().to_string();
    let base = if base.is_empty() {
        brief.title.trim().to_string()
    } else {
        base
    };
    let project = if brief.project_slug.is_empty() {
        "this product".to_string()
    } else {
        brief.project_slug.clone()
    };
    let cta = brief
        .cta
        .clone()
        .unwrap_or_else(|| "try it once.".to_string());

    let pool = vec![
        base.clone(),
        format!("POV: {base}"),
        format!("Stop doing this — {base}"),
        format!("{base} (real {project} output, no slides)"),
        format!("Three seconds, then you decide: {base}"),
        format!("Watch {project} answer this without you."),
        format!("Before you scroll — {base}"),
    ];

    let mut unique: Vec<String> = Vec::new();
    for entry in pool {
        let trimmed = entry.trim().to_string();
        if !trimmed.is_empty() && !unique.contains(&trimmed) {
            unique.push(trimmed);
        }
        if unique.len() >= count {
            break;
        }
    }
    while unique.len() < count {
        unique.push(format!("{base} · v{}", unique.len() + 1));
    }

    unique
        .into_iter()
        .take(count)
        .map(|hook| HookVariant {
            hook,
            cta: cta.clone(),
        })
        .collect()
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct VariantPlanEntry {
    pub variant_id: String,
    pub template: Template,
    pub hook: String,
    pub cta: Option<String>,
}

/// Port of `buildVariantPlan`. `variant_count` is clamped to 1..=6.
pub fn build_variant_plan(brief: &VideoBrief, variant_count: usize) -> Vec<VariantPlanEntry> {
    let count = variant_count.clamp(1, 6);
    let templates = templates_for_variants(brief, count);
    let hooks = hook_variants_for_brief(brief, count);
    templates
        .into_iter()
        .enumerate()
        .map(|(index, template)| VariantPlanEntry {
            variant_id: format!("{}-v{}", brief.id, index + 1),
            hook: hooks
                .get(index)
                .map(|h| h.hook.clone())
                .unwrap_or_else(|| brief.hook.clone()),
            cta: hooks
                .get(index)
                .map(|h| h.cta.clone())
                .or_else(|| brief.cta.clone()),
            template,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn brief(json: serde_json::Value) -> VideoBrief {
        let base = serde_json::json!({
            "id": "b1",
            "project_slug": "x",
            "channel": "blog",
            "title": "title",
            "hook": "hook here",
            "body": "body"
        });
        let mut map = base.as_object().cloned().unwrap();
        if let Some(extra) = json.as_object() {
            for (k, v) in extra {
                map.insert(k.clone(), v.clone());
            }
        }
        crate::brief::normalize_video_brief(&map).unwrap()
    }

    #[test]
    fn selects_changelog_when_entry_present() {
        let b = brief(serde_json::json!({ "changelog_entry_id": "cl_1" }));
        assert_eq!(select_template(&b).id, "changelog_proof");
    }

    #[test]
    fn selects_mini_demo_with_two_steps() {
        let b = brief(serde_json::json!({
            "demo_steps": [{ "action": "open" }, { "action": "click" }]
        }));
        assert_eq!(select_template(&b).id, "mini_demo");
    }

    #[test]
    fn explicit_template_wins() {
        let b = brief(serde_json::json!({
            "template": "before_after",
            "changelog_entry_id": "cl_1"
        }));
        assert_eq!(select_template(&b).id, "before_after");
    }

    #[test]
    fn defaults_to_problem_proof_cta() {
        let b = brief(serde_json::json!({}));
        assert_eq!(select_template(&b).id, "problem_proof_cta");
    }

    #[test]
    fn teardown_matches_audit_slug() {
        let b = brief(serde_json::json!({ "project_slug": "codevetter" }));
        // "vetter" matches teardown_audit
        assert_eq!(select_template(&b).id, "teardown_audit");
    }

    #[test]
    fn variant_plan_clamps_and_pads_templates() {
        let b = brief(serde_json::json!({}));
        let plan = build_variant_plan(&b, 4);
        assert_eq!(plan.len(), 4);
        // unique templates padded from catalog
        let ids: Vec<_> = plan.iter().map(|p| p.template.id).collect();
        let unique: std::collections::HashSet<_> = ids.iter().collect();
        assert_eq!(unique.len(), 4);
        assert_eq!(plan[0].variant_id, "b1-v1");
        assert_eq!(plan[3].variant_id, "b1-v4");
    }

    #[test]
    fn variant_plan_clamps_above_six() {
        let b = brief(serde_json::json!({}));
        let plan = build_variant_plan(&b, 99);
        assert!(plan.len() <= 6);
    }

    #[test]
    fn hook_variants_are_unique() {
        let b = brief(serde_json::json!({ "hook": "the same DM" }));
        let hooks = hook_variants_for_brief(&b, 5);
        assert_eq!(hooks.len(), 5);
        let texts: std::collections::HashSet<_> = hooks.iter().map(|h| &h.hook).collect();
        assert_eq!(texts.len(), 5);
    }
}
