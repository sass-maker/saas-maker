import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { FLEET_HEALTH_CONTRACTS } from './fleet-health-contracts.mjs';

export const DEFAULT_DEPLOY_SECRETS = {
  cloudflare: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
};

const WORKER_TARGET_RE = /Cloudflare Workers/i;
const PAGES_TARGET_RE = /Cloudflare Pages/i;
const CLOUDFLARE_TARGETS_FILE = 'cloudflare.targets.json';

const PROJECT_OVERRIDES = {
  'saas-maker': {
    runtimeDir: 'apps/cockpit',
  },
  truehire: {
    runtimeDir: 'apps/web',
  },
};

const PUBLIC_GITHUB_CONFIG_NAMES = new Set(['CF_ACCOUNT_ID', 'CLOUDFLARE_ACCOUNT_ID']);

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

export function loadCloudflareTargetManifest(root) {
  const manifestPath = path.join(root, CLOUDFLARE_TARGETS_FILE);
  if (!fs.existsSync(manifestPath)) return {};
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function normalizeList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function resolveTargetDir(project, target) {
  if (!target?.dir) return project.dir;
  return path.resolve(project.dir, target.dir);
}

function resolveTargetConfigPath(project, target) {
  const dir = resolveTargetDir(project, target);
  if (target?.config) return path.resolve(dir, target.config);
  return (
    ['wrangler.toml', 'wrangler.jsonc']
      .map((file) => path.join(dir, file))
      .find((file) => fs.existsSync(file)) ?? null
  );
}

function normalizeCloudflareTarget(project, target) {
  const configPath = resolveTargetConfigPath(project, target);
  const dir = configPath ? path.dirname(configPath) : resolveTargetDir(project, target);
  const source = configPath && fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
  const detected = source
    ? detectCloudflareTarget(dir, {
        deployTarget: target.kind === 'pages' ? 'Cloudflare Pages' : 'Cloudflare Workers',
      })
    : { kind: target.kind === 'pages' ? 'cloudflare-pages' : 'cloudflare-worker', name: null };
  const provider =
    target.kind === 'pages' || detected.kind === 'cloudflare-pages'
      ? 'cloudflare-pages'
      : 'cloudflare-worker';
  const requiredSecrets = normalizeList(target.requiredSecrets);
  return {
    id: target.id ?? target.name ?? detected.name ?? project.slug,
    provider,
    name: target.name ?? detected.name ?? project.slug,
    dir,
    configPath,
    requiredSecrets: requiredSecrets.sort((a, b) => String(a).localeCompare(String(b))),
    requiredVars: normalizeList(target.requiredVars).sort(),
    requiredBindings: normalizeList(target.requiredBindings).sort(),
  };
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
    .map((line) => line.match(/^(?:-\s*)?([A-Z][A-Z0-9_]+)\b/)?.[1])
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

export function parseCloudflareConfigState(source) {
  const vars = new Set();
  const bindings = new Set();
  if (!source) return { vars: [], bindings: [] };

  let inTomlVars = false;
  for (const line of source.split(/\r?\n/)) {
    if (/^\s*\[vars\]\s*$/.test(line)) {
      inTomlVars = true;
      continue;
    }
    if (inTomlVars && /^\s*\[/.test(line)) break;
    if (!inTomlVars) continue;
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/);
    if (match) vars.add(match[1]);
  }

  const jsonVars = source.match(/["']vars["']\s*:\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
  for (const match of jsonVars.matchAll(/["']([A-Z][A-Z0-9_]*)["']\s*:/g)) {
    vars.add(match[1]);
  }

  for (const match of source.matchAll(/\bbinding\s*=\s*["']([^"']+)["']/g)) {
    bindings.add(match[1]);
  }
  for (const match of source.matchAll(/\bname\s*=\s*["']([A-Z][A-Za-z0-9_]*)["']/g)) {
    bindings.add(match[1]);
  }
  for (const match of source.matchAll(/["']binding["']\s*:\s*["']([^"']+)["']/g)) {
    bindings.add(match[1]);
  }
  for (const match of source.matchAll(/["']name["']\s*:\s*["']([^"']+)["']/g)) {
    bindings.add(match[1]);
  }

  return {
    vars: Array.from(vars).sort(),
    bindings: Array.from(bindings).sort(),
  };
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
      ? fs
          .readdirSync(workflowsDir)
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
      const requirement =
        match[1].includes('||') && uniqueNames.length > 1 ? uniqueNames.sort() : uniqueNames[0];
      const key = Array.isArray(requirement) ? requirement.join('|') : requirement;
      if (seen.has(key)) continue;
      seen.add(key);
      requirements.push(requirement);
    }
  }
  return requirements;
}

export function buildProjectSecretPlan(
  project,
  contract = FLEET_HEALTH_CONTRACTS[project.slug],
  cloudflareManifest = {}
) {
  const requiredEnv = contract?.requiredEnv ?? { build: [], runtime: [] };
  const override = PROJECT_OVERRIDES[project.slug] ?? {};
  const runtimeDir = override.runtimeDir
    ? path.join(project.dir, override.runtimeDir)
    : project.dir;
  const cf = detectCloudflareTarget(runtimeDir, contract);
  const manifestTargets = normalizeList(cloudflareManifest[project.slug]?.targets).map((target) =>
    normalizeCloudflareTarget(project, target)
  );
  const githubSecrets = [];
  const addGithubRequirement = (entry) => {
    const key = Array.isArray(entry) ? entry.join('|') : entry;
    if (
      !githubSecrets.some(
        (existing) => (Array.isArray(existing) ? existing.join('|') : existing) === key
      )
    ) {
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
  const fallbackRuntime = {
    provider: runtimeProvider,
    name: cf.name,
    dir: runtimeDir,
    configPath:
      ['wrangler.toml', 'wrangler.jsonc']
        .map((file) => path.join(runtimeDir, file))
        .find((file) => fs.existsSync(file)) ?? null,
    requiredSecrets: [...(requiredEnv.runtime ?? [])].sort(),
    requiredVars: [],
    requiredBindings: [],
  };
  const runtimes =
    manifestTargets.length > 0
      ? manifestTargets
      : fallbackRuntime.requiredSecrets.length > 0
        ? [fallbackRuntime]
        : [];

  return {
    project: project.slug,
    repo: project.repo,
    dir: runtimeDir,
    deployTarget: contract?.deployTarget ?? null,
    github: {
      repo: project.repo,
      required: githubSecrets.sort((a, b) => String(a).localeCompare(String(b))),
    },
    runtimes,
    runtime: {
      provider: runtimes[0]?.provider ?? runtimeProvider,
      name: runtimes[0]?.name ?? cf.name,
      required: runtimes[0]?.requiredSecrets ?? [...(requiredEnv.runtime ?? [])].sort(),
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
      const result = run(
        'gh',
        ['secret', 'list', '-R', plan.github.repo, '--json', 'name,updatedAt'],
        { cwd: root }
      );
      const variableResult = run(
        'gh',
        ['variable', 'list', '-R', plan.github.repo, '--json', 'name,updatedAt'],
        { cwd: root }
      );
      const presentSecrets = result.ok ? parseSecretNames(result.stdout) : [];
      const presentVariables = variableResult.ok
        ? parseSecretNames(variableResult.stdout).filter((name) =>
            PUBLIC_GITHUB_CONFIG_NAMES.has(name)
          )
        : [];
      checks.push({
        platform: 'github-actions',
        target: plan.github.repo,
        ...compareSecrets(plan.github.required, [...presentSecrets, ...presentVariables]),
        error: result.ok ? null : normalizeCommandError(result),
      });
    }
  }

  for (const runtime of plan.runtimes ?? []) {
    const requiredSecrets = runtime.requiredSecrets ?? runtime.required ?? [];
    if (requiredSecrets.length > 0 && runtime.provider === 'cloudflare-worker') {
      const args = [
        'exec',
        'wrangler',
        'secret',
        'list',
        '--format',
        'json',
        '--cwd',
        runtime.dir ?? plan.dir,
      ];
      const result = run('pnpm', args, { cwd: root });
      const present = result.ok ? parseSecretNames(result.stdout) : [];
      checks.push({
        platform: 'cloudflare-worker',
        target: runtime.name,
        ...compareSecrets(requiredSecrets, present),
        error: result.ok ? null : normalizeCommandError(result),
      });
    } else if (requiredSecrets.length > 0 && runtime.provider === 'cloudflare-pages') {
      const args = [
        'exec',
        'wrangler',
        'pages',
        'secret',
        'list',
        '--project-name',
        runtime.name ?? plan.project,
      ];
      const result = run('pnpm', args, { cwd: root });
      const present = result.ok ? parseSecretNames(result.stdout) : [];
      checks.push({
        platform: 'cloudflare-pages',
        target: runtime.name ?? plan.project,
        ...compareSecrets(requiredSecrets, present),
        error: result.ok ? null : normalizeCommandError(result),
      });
    } else if (requiredSecrets.length > 0 && runtime.provider === 'vercel') {
      checks.push({
        platform: 'vercel',
        target: plan.project,
        ...compareSecrets(requiredSecrets, []),
        ok: false,
        error: 'Vercel secret listing is not configured in this audit yet',
      });
    } else if (requiredSecrets.length > 0) {
      checks.push({
        platform: 'runtime',
        target: plan.project,
        ...compareSecrets(requiredSecrets, []),
        ok: false,
        error: `Unsupported runtime secret provider: ${runtime.provider}`,
      });
    }

    if ((runtime.requiredVars?.length ?? 0) > 0 || (runtime.requiredBindings?.length ?? 0) > 0) {
      const source =
        runtime.configPath && fs.existsSync(runtime.configPath)
          ? fs.readFileSync(runtime.configPath, 'utf8')
          : '';
      const state = parseCloudflareConfigState(source);
      if ((runtime.requiredVars?.length ?? 0) > 0) {
        checks.push({
          platform: 'cloudflare-vars',
          target: runtime.name,
          ...compareSecrets(runtime.requiredVars, state.vars),
          error: source ? null : `Missing Wrangler config: ${runtime.configPath ?? 'unknown'}`,
        });
      }
      if ((runtime.requiredBindings?.length ?? 0) > 0) {
        checks.push({
          platform: 'cloudflare-bindings',
          target: runtime.name,
          ...compareSecrets(runtime.requiredBindings, state.bindings),
          error: source ? null : `Missing Wrangler config: ${runtime.configPath ?? 'unknown'}`,
        });
      }
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
    .map(
      (check) =>
        `- ${check.platform}${check.target ? ` (${check.target})` : ''}: missing ${check.missing.map(formatRequiredSecret).join(', ') || 'unknown'}${check.error ? `; audit error: ${check.error}` : ''}`
    );

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
  return (result.stderr || result.stdout || result.error || `exit ${result.status}`)
    .trim()
    .split(/\r?\n/)
    .slice(-4)
    .join(' ');
}
