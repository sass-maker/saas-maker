import { readFile } from 'node:fs/promises';

const DEFAULT_PATH = process.env.SOCIAL_ACCOUNTS_CONFIG ?? 'config/social-accounts.json';

export async function loadSocialAccountsConfig(options = {}) {
  const path = options.path ?? DEFAULT_PATH;
  const env = options.env ?? process.env;
  const raw = options.raw ?? JSON.parse(await readFile(path, 'utf8'));
  return resolveSocialAccountsConfig(raw, env);
}

export function resolveSocialAccountsConfig(raw, env = process.env) {
  const out = { youtube: {}, instagram: {} };
  for (const platform of Object.keys(out)) {
    const entries = raw?.[platform] ?? {};
    for (const [slug, entry] of Object.entries(entries)) {
      out[platform][slug] = resolveEntry(slug, entry, env);
    }
  }
  return out;
}

function resolveEntry(slug, entry, env) {
  const resolved = { slug, projects: entry.projects ?? [], default: Boolean(entry.default) };
  for (const [key, value] of Object.entries(entry)) {
    if (key === 'projects' || key === 'default') continue;
    if (key.endsWith('Env') && typeof value === 'string') {
      const target = key.slice(0, -3);
      const envValue = env[value];
      if (!envValue) throw new Error(`account "${slug}": env var ${value} is not set (for ${target})`);
      resolved[target] = envValue;
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

export class AccountRouter {
  constructor(platformConfig = {}) {
    this.accounts = Object.values(platformConfig);
    if (this.accounts.length === 0) {
      throw new Error('AccountRouter requires at least one account');
    }
  }

  route(marketingPost) {
    if (marketingPost.account_slug) {
      const byExplicit = this.accounts.find((account) => account.slug === marketingPost.account_slug);
      if (byExplicit) return byExplicit;
      throw new Error(`no account configured for slug "${marketingPost.account_slug}"`);
    }
    if (marketingPost.project_slug) {
      const byProject = this.accounts.find((account) => account.projects.includes(marketingPost.project_slug));
      if (byProject) return byProject;
    }
    const fallback = this.accounts.find((account) => account.default) ?? this.accounts[0];
    return fallback;
  }

  list() {
    return [...this.accounts];
  }
}
