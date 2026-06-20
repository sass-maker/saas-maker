//! Configuration loading — ports `config/project-urls.json` parsing (used by
//! `render-pro.js` / the worker) and `src/config/social-accounts.js`.
//!
//! Project URLs map a project slug to its real deployed product URL (preferring
//! `productUrl`, falling back to `fallbackUrl`). Social accounts resolve
//! per-platform account entries, expanding `*Env` keys from the environment so
//! tokens never live in the JSON. Secret VALUES are read from the environment at
//! runtime — this module only resolves the *shape*, it does not embed secrets.

use std::collections::BTreeMap;
use std::path::Path;

use anyhow::{anyhow, Context, Result};
use serde::Deserialize;

/// Parse `config/project-urls.json` into `slug -> product_url`.
///
/// Mirrors `loadProjectUrls` in `render-pro.js`: `$`-prefixed keys (comments)
/// are skipped; an entry may be a bare URL string or an object with
/// `productUrl` / `fallbackUrl`.
pub fn load_project_urls(path: &Path) -> Result<BTreeMap<String, String>> {
    let raw = std::fs::read_to_string(path)
        .with_context(|| format!("reading project urls {}", path.display()))?;
    parse_project_urls(&raw)
}

pub fn parse_project_urls(raw: &str) -> Result<BTreeMap<String, String>> {
    let value: serde_json::Value = serde_json::from_str(raw).context("parsing project urls json")?;
    let obj = value
        .as_object()
        .ok_or_else(|| anyhow!("project urls must be a JSON object"))?;
    let mut out = BTreeMap::new();
    for (slug, entry) in obj {
        if slug.starts_with('$') {
            continue;
        }
        let url = match entry {
            serde_json::Value::String(s) => Some(s.clone()),
            serde_json::Value::Object(o) => o
                .get("productUrl")
                .and_then(|v| v.as_str())
                .or_else(|| o.get("fallbackUrl").and_then(|v| v.as_str()))
                .map(|s| s.to_string()),
            _ => None,
        };
        if let Some(url) = url.filter(|u| !u.trim().is_empty()) {
            out.insert(slug.clone(), url);
        }
    }
    Ok(out)
}

/// A resolved social account (token values pulled from env via `*Env` keys).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SocialAccount {
    pub slug: String,
    pub projects: Vec<String>,
    pub default: bool,
    /// Non-structural fields (resolved env values + literals).
    pub fields: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SocialAccountsConfig {
    pub youtube: BTreeMap<String, SocialAccount>,
    pub instagram: BTreeMap<String, SocialAccount>,
}

#[derive(Debug, Deserialize)]
struct RawSocialAccounts {
    #[serde(default)]
    youtube: BTreeMap<String, serde_json::Value>,
    #[serde(default)]
    instagram: BTreeMap<String, serde_json::Value>,
}

/// Port of `resolveSocialAccountsConfig`. `env` is a lookup closure so callers
/// (and tests) can supply a map instead of the live process environment.
pub fn resolve_social_accounts<F>(raw: &str, env: F) -> Result<SocialAccountsConfig>
where
    F: Fn(&str) -> Option<String>,
{
    let parsed: RawSocialAccounts = serde_json::from_str(raw).context("parsing social accounts json")?;
    Ok(SocialAccountsConfig {
        youtube: resolve_platform(&parsed.youtube, &env)?,
        instagram: resolve_platform(&parsed.instagram, &env)?,
    })
}

fn resolve_platform<F>(
    entries: &BTreeMap<String, serde_json::Value>,
    env: &F,
) -> Result<BTreeMap<String, SocialAccount>>
where
    F: Fn(&str) -> Option<String>,
{
    let mut out = BTreeMap::new();
    for (slug, entry) in entries {
        out.insert(slug.clone(), resolve_entry(slug, entry, env)?);
    }
    Ok(out)
}

fn resolve_entry<F>(slug: &str, entry: &serde_json::Value, env: &F) -> Result<SocialAccount>
where
    F: Fn(&str) -> Option<String>,
{
    let obj = entry
        .as_object()
        .ok_or_else(|| anyhow!("account \"{slug}\" must be an object"))?;
    let projects = obj
        .get("projects")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();
    let default = obj.get("default").and_then(|v| v.as_bool()).unwrap_or(false);

    let mut fields = BTreeMap::new();
    for (key, value) in obj {
        if key == "projects" || key == "default" {
            continue;
        }
        if let (true, serde_json::Value::String(env_name)) = (key.ends_with("Env"), value) {
            let target = &key[..key.len() - 3];
            let env_value = env(env_name).ok_or_else(|| {
                anyhow!("account \"{slug}\": env var {env_name} is not set (for {target})")
            })?;
            fields.insert(target.to_string(), env_value);
        } else if let serde_json::Value::String(s) = value {
            fields.insert(key.clone(), s.clone());
        } else {
            fields.insert(key.clone(), value.to_string());
        }
    }

    Ok(SocialAccount {
        slug: slug.to_string(),
        projects,
        default,
        fields,
    })
}

/// Port of `AccountRouter.route`: explicit slug, then project membership, then
/// the `default` account, then the first account.
pub fn route_account<'a>(
    accounts: &'a BTreeMap<String, SocialAccount>,
    account_slug: Option<&str>,
    project_slug: Option<&str>,
) -> Result<&'a SocialAccount> {
    if accounts.is_empty() {
        return Err(anyhow!("AccountRouter requires at least one account"));
    }
    if let Some(slug) = account_slug {
        return accounts
            .values()
            .find(|a| a.slug == slug)
            .ok_or_else(|| anyhow!("no account configured for slug \"{slug}\""));
    }
    if let Some(project) = project_slug {
        if let Some(by_project) = accounts
            .values()
            .find(|a| a.projects.iter().any(|p| p == project))
        {
            return Ok(by_project);
        }
    }
    Ok(accounts
        .values()
        .find(|a| a.default)
        .unwrap_or_else(|| accounts.values().next().expect("non-empty checked above")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_project_urls_skipping_comments() {
        let raw = r#"{
            "$comment": "ignore me",
            "linkchat": { "productUrl": "https://linkchat.dev", "fallbackUrl": "https://gh/linkchat" },
            "reader": "https://reader.dev",
            "broken": {}
        }"#;
        let map = parse_project_urls(raw).unwrap();
        assert_eq!(map.get("linkchat").unwrap(), "https://linkchat.dev");
        assert_eq!(map.get("reader").unwrap(), "https://reader.dev");
        assert!(!map.contains_key("$comment"));
        assert!(!map.contains_key("broken"));
    }

    #[test]
    fn falls_back_to_fallback_url() {
        let raw = r#"{ "x": { "fallbackUrl": "https://gh/x" } }"#;
        let map = parse_project_urls(raw).unwrap();
        assert_eq!(map.get("x").unwrap(), "https://gh/x");
    }

    #[test]
    fn resolves_social_account_env_keys() {
        let raw = r#"{
            "youtube": {
                "main": { "projects": ["linkchat"], "default": true, "channelId": "UC123", "refreshTokenEnv": "YT_MAIN_TOKEN" }
            }
        }"#;
        let env = |k: &str| match k {
            "YT_MAIN_TOKEN" => Some("secret-token".to_string()),
            _ => None,
        };
        let cfg = resolve_social_accounts(raw, env).unwrap();
        let acct = cfg.youtube.get("main").unwrap();
        assert!(acct.default);
        assert_eq!(acct.projects, vec!["linkchat".to_string()]);
        assert_eq!(acct.fields.get("channelId").unwrap(), "UC123");
        assert_eq!(acct.fields.get("refreshToken").unwrap(), "secret-token");
    }

    #[test]
    fn missing_env_var_errors() {
        let raw = r#"{ "youtube": { "main": { "refreshTokenEnv": "MISSING" } } }"#;
        let err = resolve_social_accounts(raw, |_| None).unwrap_err();
        assert!(err.to_string().contains("MISSING"));
    }

    #[test]
    fn routes_by_explicit_then_project_then_default() {
        let raw = r#"{
            "youtube": {
                "a": { "projects": ["reader"] },
                "b": { "projects": ["linkchat"], "default": true }
            }
        }"#;
        let cfg = resolve_social_accounts(raw, |_| None).unwrap();
        let yt = &cfg.youtube;
        assert_eq!(route_account(yt, Some("a"), None).unwrap().slug, "a");
        assert_eq!(route_account(yt, None, Some("reader")).unwrap().slug, "a");
        assert_eq!(route_account(yt, None, Some("unknown")).unwrap().slug, "b");
        assert!(route_account(yt, Some("nope"), None).is_err());
    }
}
