import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { FLEET_HEALTH_CONTRACTS } from './fleet-health-contracts.mjs';

export const DEFAULT_DEPLOY_SECRETS = {
  cloudflare: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
};

const WORKER_TARGET_RE = /Cloudflare Workers/i;
const PAGES_TARGET_RE = /Cloudflare Pages/i;

const PROJECT_OVERRIDES = {
  'saas-maker': {
    runtimeDir: 'apps/cockpit',
  },
  truehire: {
    runtimeDir: 'apps/web',
  },
};

export function extractRepoFromGitUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  const ssh = trimmed.match(/^git@github\.com:([^/]+\/[^.]+?)(?:\.git)?$/i);
  if (ssh) return ssh[1];
  try {
    const url = new URL(trimmed);
    if (url.hostname !== 'github.com') return null;
    return url.pathname.replace(/^\/+/, '').replace(/\.git$/, '') || null;
  } catch {
    return null;
  }
}

export function loadFleetProjects(root) {
  const manifestPath = path.join(root, 'foundry.projects.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return Object.entries(manifest).map(([slug, entry]) => ({
    slug,
    repo: extractRepoFromGitUrl(entry.url),
    url: entry.url,
    desc: entry.desc ?? '',
    dir: path.resolve(root, '..', slug),
  }));
}

export function parseSecretNames(stdout) {
  const text = String(stdout ?? '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === 'string' ? item : item?.name))
        .filter(Boolean)
        .sort();
    }
  } catch {
    // Fall through to text parsing.
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.match(/^([A-Z][A-Z0-9_]+)\b/)?.[1])
    .filter(Boolean)
    .sort();
}

export function parseWranglerName(source) {
  if (!source) return null;
  const toml = source.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
  if (toml) return toml[1];
  const json = source.match(/["']name["']\s*:\s*["']([^"']+)["']/);
  return json?.[1] ?? null;
}

export function detectCloudflareTarget(projectDir, contract = {}) {
  const configPath = ['wrangler.toml', 'wrangler.jsonc']
    .map((file) => path.join(projectDir, file))
    .find((file) => fs.existsSync(file));
  const source = configPath ? fs.readFileSync(configPath, 'utf8') : '';
  const name = parseWranglerName(source);
  const isPagesConfig = /pages_build_output_dir\s*=/.test(source);
  const target = contract.deployTarget ?? '';

  if (isPagesConfig || PAGES_TARGET_RE.test(target)) return { kind: 'cloudflare-pages', name };
  if (source || WORKER_TARGET_RE.test(target)) return { kind: 'cloudflare-worker', name };
  return { kind: 'none', name: null };
}

export function extractWorkflowSecretRequirements(projectDir, workflowFile) {
  const workflowsDir = path.join(projectDir, '.github', 'workflows');
  const candidates = workflowFile
    ? [path.join(workflowsDir, workflowFile)]
    : fs.existsSync(workflowsDir)
      ? fs.readdirSync(workflowsDir)
        .filter((file) => /\.(ya?ml)$/i.test(file))
        .map((file) => path.join(workflowsDir, file))
      : [];

  const requirements = [];
  const seen = new Set();
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    const expressionRe = /\$\{\{\s*([^}]+?)\s*\}\}/g;
    let match;
    while ((match = expressionRe.exec(source)) !== null) {
      const names = Array.from(match[1].matchAll(/secrets\.([A-Z0-9_]+)/g))
        .map((item) => item[1])
        .filter((name) => name !== 'GITHUB_TOKEN');
      if (names.length === 0) continue;
      const uniqueNames = Array.from(new Set(names));
      const requirement = match[1].includes('||') && uniqueNames.length > 1
        ? uniqueNames.sort()
        : uniqueNames[0];
      const key = Array.isArray(requirement) ? requirement.join('|') : requirement;
      if (seen.has(key)) continue;
      seen.add(key);
      requirements.push(requirement);
    }
  }
  return requirements;
}

export function buildProjectSecretPlan(project, contract = FLEET_HEALTH_CONTRACTS[project.slug]) {
  const requiredEnv = contract?.requiredEnv ?? { build: [], runtime: [] };
  const override = PROJECT_OVERRIDES[project.slug] ?? {};
  const runtimeDir = override.runtimeDir ? path.join(project.dir, override.runtimeDir) : project.dir;
  const cf = detectCloudflareTarget(runtimeDir, contract);
  const githubSecrets = [];
  const addGithubRequirement = (entry) => {
    const key = Array.isArray(entry) ? entry.join('|') : entry;
    if (!githubSecrets.some((existing) => (Array.isArray(existing) ? existing.join('|') : existing) === key)) {
      githubSecrets.push(entry);
    }
  };
  for (const secret of requiredEnv.build ?? []) addGithubRequirement(secret);

  if (contract?.githubWorkflow) {
    for (const secret of extractWorkflowSecretRequirements(project.dir, contract.githubWorkflow)) {
      addGithubRequirement(secret);
    }
  } else if (/Cloudflare/i.test(contract?.deployTarget ?? '')) {
    for (const secret of DEFAULT_DEPLOY_SECRETS.cloudflare) addGithubRequirement(secret);
  }

  let runtimeProvider = 'none';
  if ((requiredEnv.runtime ?? []).length > 0) {
    if (cf.kind === 'cloudflare-worker') runtimeProvider = 'cloudflare-worker';
    else if (cf.kind === 'cloudflare-pages') runtimeProvider = 'cloudflare-pages';
    else if (/Vercel/i.test(contract?.deployTarget ?? '')) runtimeProvider = 'vercel';
    else runtimeProvider = 'unknown';
  }

  return {
    project: project.slug,
    repo: project.repo,
    dir: runtimeDir,
    deployTarget: contract?.deployTarget ?? null,
    github: {
      repo: project.repo,
      required: githubSecrets.sort((a, b) => String(a).localeCompare(String(b))),
    },
    runtime: {
      provider: runtimeProvider,
      name: cf.name,
      required: [...(requiredEnv.runtime ?? [])].sort(),
    },
  };
}

export function compareSecrets(required, present) {
  const presentSet = new Set(present ?? []);
  const missing = (required ?? []).filter((entry) => {
    if (Array.isArray(entry)) return !entry.some((name) => presentSet.has(name));
    return !presentSet.has(entry);
  });
  return {
    required: [...(required ?? [])].sort((a, b) => String(a).localeCompare(String(b))),
    present: [...(present ?? [])].sort(),
    missing: missing.sort((a, b) => String(a).localeCompare(String(b))),
    ok: missing.length === 0,
  };
}

export function formatRequiredSecret(entry) {
  return Array.isArray(entry) ? entry.join(' || ') : entry;
}

export function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env ?? {}) },
  });
  return {
    status: result.status,
    ok: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error?.message,
  };
}

export function auditProjectSecretPlan(plan, { root, run = runCommand } = {}) {
  const checks = [];

  if (plan.github.required.length > 0) {
    if (!plan.github.repo) {
      checks.push({
        platform: 'github-actions',
        target: null,
        ...compareSecrets(plan.github.required, []),
        error: 'No GitHub repository URL in foundry.projects.json',
      });
    } else {
      const result = run('gh', ['secret', 'list', '-R', plan.github.repo, '--json', 'name,updatedAt'], { cwd: root });
      const present = result.ok ? parseSecretNames(result.stdout) : [];
      checks.push({
        platform: 'github-actions',
        target: plan.github.repo,
        ...compareSecrets(plan.github.required, present),
        error: result.ok ? null : normalizeCommandError(result),
      });
    }
  }

  if (plan.runtime.required.length > 0) {
    if (plan.runtime.provider === 'cloudflare-worker') {
      const args = ['exec', 'wrangler', 'secret', 'list', '--format', 'json', '--cwd', plan.dir];
      const result = run('pnpm', args, { cwd: root });
      const present = result.ok ? parseSecretNames(result.stdout) : [];
      checks.push({
        platform: 'cloudflare-worker',
        target: plan.runtime.name,
        ...compareSecrets(plan.runtime.required, present),
        error: result.ok ? null : normalizeCommandError(result),
      });
    } else if (plan.runtime.provider === 'cloudflare-pages') {
      const args = ['exec', 'wrangler', 'pages', 'secret', 'list', '--project-name', plan.runtime.name ?? plan.project];
      const result = run('pnpm', args, { cwd: root });
      const present = result.ok ? parseSecretNames(result.stdout) : [];
      checks.push({
        platform: 'cloudflare-pages',
        target: plan.runtime.name ?? plan.project,
        ...compareSecrets(plan.runtime.required, present),
        error: result.ok ? null : normalizeCommandError(result),
      });
    } else if (plan.runtime.provider === 'vercel') {
      checks.push({
        platform: 'vercel',
        target: plan.project,
        ...compareSecrets(plan.runtime.required, []),
        ok: false,
        error: 'Vercel secret listing is not configured in this audit yet',
      });
    } else {
      checks.push({
        platform: 'runtime',
        target: plan.project,
        ...compareSecrets(plan.runtime.required, []),
        ok: false,
        error: `Unsupported runtime secret provider: ${plan.runtime.provider}`,
      });
    }
  }

  return {
    project: plan.project,
    ok: checks.every((check) => check.ok),
    checks,
  };
}

export function buildSecretTaskPayload(failure, generatedAt = new Date().toISOString()) {
  const missingLines = failure.checks
    .filter((check) => check.missing.length > 0 || check.error)
    .map((check) => `- ${check.platform}${check.target ? ` (${check.target})` : ''}: missing ${check.missing.map(formatRequiredSecret).join(', ') || 'unknown'}${check.error ? `; audit error: ${check.error}` : ''}`);

  return {
    title: `[fleet-secrets] ${failure.project}`,
    project_slug: failure.project,
    priority: 'high',
    task_type: 'bug',
    blocked_on_user: true,
    description: [
      `Project: ${failure.project}`,
      `Detected at: ${generatedAt}`,
      '',
      'Missing credential/config blockers:',
      ...missingLines,
      '',
      'Acceptance criteria:',
      '- Required secret names are present in GitHub Actions and/or runtime platform.',
      '- Production deploy no longer fails before application code runs.',
      '- Relevant fleet production smoke passes.',
      '',
      `Copyable verification: pnpm fleet:secret-audit -- --project ${failure.project} --fail-on-missing`,
    ].join('\n'),
  };
}

export function secretFailureKey(failure) {
  return `${failure.project}::fleet-secrets`;
}

function normalizeCommandError(result) {
  return (result.stderr || result.stdout || result.error || `exit ${result.status}`).trim().split(/\r?\n/).slice(-4).join(' ');
}
