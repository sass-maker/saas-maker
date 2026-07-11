#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DEFAULT_FLEET_ROOT = path.resolve(ROOT, '..');
const DEFAULT_MANIFEST = path.join(ROOT, 'foundry.projects.json');
const DEFAULT_OUTPUT_DIR = path.join(ROOT, '.symphony', 'fleet-audit');
const DEFAULT_TIMEOUT_MS = 240_000;
const DEFAULT_CLOUDFLARE_ACCOUNT_ID = '7d048325699a5acddb44d3be31cf6ba9';
const DEFAULT_EXPECTED_CLOUDFLARE_BUILD_TOKEN = 'Workers Builds - 2026-05-27 01:49';
const OUT_OF_FLEET_PROJECTS = new Set(['personal-memory', 'port-whisperer', 'local-ai']);
const LOCAL_PATH_OVERRIDES = {
  'alive-ville': 'aliveville',
  'anime-list': 'anime-list',
  CodeVetter: 'codevetter',
  'knowledge-base': 'knowledge-base',
  'research-papers': 'research-papers',
  rolepatch: 'rolepatch',
  karte: 'karte',
  posttrainllm: 'tinygpt',
};

const DOMAIN_MARKETING_PROJECTS = new Set([
  'CodeVetter',
  'alive-ville',
  'high-signal',
  'karte',
  'pace',
  'posttrainllm',
  'rolepatch',
  'saas-maker',
  'significanthobbies',
]);
const DOMAIN_MARKETING_PLAN_ALIASES = {
  CodeVetter: 'codevetter',
  'alive-ville': 'aliveville',
  posttrainllm: 'tinygpt',
};

const FLEET_BUCKETS = {
  core: 'Focus',
  support: 'Support/platform',
  personal: 'Personal use',
};

const MARKETING_ASSETS = [
  {
    id: 'hooks',
    file: 'docs/marketing/hooks.md',
    title: 'write landing-page hook variants',
    why: '3-second value and positioning',
  },
  {
    id: 'demo-script',
    file: 'docs/marketing/demo-60s.md',
    title: 'write 60-second demo script',
    why: 'repeatable video/demo proof',
  },
  {
    id: 'social-posts',
    file: 'docs/marketing/social-posts.md',
    title: 'create reusable social launch ideas',
    why: 'distribution without account access',
  },
  {
    id: 'seo-keywords',
    file: 'docs/marketing/seo-keywords.md',
    title: 'map SEO search intents',
    why: 'durable inbound options',
  },
  {
    id: 'comparison',
    file: 'docs/marketing/comparison-page.md',
    title: 'create comparison page ideas',
    why: 'alternative-aware conversion',
  },
  {
    id: 'event-map',
    file: 'docs/marketing/event-map.md',
    title: 'define marketing event map',
    why: 'measure channel and CTA learning',
  },
];

// Only include workers whose Git-connected Cloudflare Workers Builds record is
// an active deploy health signal. Reader deploys through GitHub Actions, and
// Reel Pipeline artifacts deploy through the repo bootstrap/wrangler path.
const CLOUDFLARE_WORKER_SERVICES = {
  'email-manager': ['email-manager'],
  'free-ai': ['free-ai-gateway'],
  'high-signal': ['high-signal-api', 'high-signal-web'],
  karte: ['linkchat'],
  rolepatch: ['resume-tailor'],
  'saas-maker': ['saasmaker-api', 'saasmaker-dashboard'],
  significanthobbies: ['significanthobbies'],
  starboard: ['starboard'],
};

const PROD_TARGETS = {
  'anime-list': [
    { label: 'web', url: 'https://anime-list-9lk.pages.dev', ok: [200] },
    { label: 'api-root', url: 'https://mal-api.sarthakagrawal927.workers.dev', ok: [404] },
  ],
  CodeVetter: [{ label: 'web', url: 'https://codevetter.com', ok: [200] }],
  'email-manager': [
    { label: 'web', url: 'https://email-manager.sarthakagrawal927.workers.dev', ok: [200] },
  ],
  drank: [{ label: 'web', url: 'https://drank-sand.vercel.app', ok: [200] }],
  'free-ai': [
    { label: 'gateway', url: 'https://free-ai-gateway.sarthakagrawal927.workers.dev', ok: [200] },
  ],
  'alive-ville': [{ label: 'web', url: 'https://aliveville.com', ok: [200] }],
  'high-signal': [
    { label: 'web', url: 'https://highsignal.app', ok: [200] },
    { label: 'api', url: 'https://high-signal-api.sarthakagrawal927.workers.dev', ok: [200] },
  ],
  'knowledge-base': [
    {
      label: 'health',
      url: 'https://knowledgebase.sarthakagrawal927.workers.dev/v1/healthz',
      ok: [200],
    },
  ],
  karte: [{ label: 'web', url: 'https://linkchat.sarthakagrawal927.workers.dev', ok: [200] }],
  looptv: [{ label: 'web', url: 'https://looptv.pages.dev', ok: [200] }],
  reader: [{ label: 'web', url: 'https://reader.sarthakagrawal927.workers.dev', ok: [200] }],
  'reel-pipeline': [
    {
      label: 'health',
      url: 'https://reel-pipeline-artifacts.sarthakagrawal927.workers.dev/health',
      ok: [200],
    },
  ],
  rolepatch: [{ label: 'web', url: 'https://rolepatch.com', ok: [200] }],
  'saas-maker': [
    { label: 'cockpit', url: 'https://app.sassmaker.com', ok: [200] },
    { label: 'api-root', url: 'https://api.sassmaker.com', ok: [404] },
    { label: 'home', url: 'https://sassmaker.com', ok: [200] },
    { label: 'docs', url: 'https://docs.sassmaker.com', ok: [200] },
  ],
  significanthobbies: [{ label: 'web', url: 'https://significanthobbies.com', ok: [200] }],
  starboard: [{ label: 'web', url: 'https://starboard.codevetter.com', ok: [200] }],
  'swe-interview-prep': [{ label: 'web', url: 'https://swe-interview-prep.pages.dev', ok: [200] }],
};

const FRONTEND_TARGETS = {
  'anime-list': [{ label: 'web', url: 'https://anime-list-9lk.pages.dev' }],
  CodeVetter: [{ label: 'web', url: 'https://codevetter.com' }],
  'email-manager': [{ label: 'web', url: 'https://email-manager.sarthakagrawal927.workers.dev' }],
  drank: [{ label: 'web', url: 'https://drank-sand.vercel.app' }],
  'free-ai': [],
  'alive-ville': [{ label: 'web', url: 'https://aliveville.com' }],
  'high-signal': [{ label: 'web', url: 'https://highsignal.app' }],
  'knowledge-base': [
    { label: 'health', url: 'https://knowledgebase.sarthakagrawal927.workers.dev/v1/healthz' },
  ],
  karte: [{ label: 'web', url: 'https://linkchat.sarthakagrawal927.workers.dev' }],
  looptv: [{ label: 'web', url: 'https://looptv.pages.dev' }],
  reader: [{ label: 'web', url: 'https://reader.sarthakagrawal927.workers.dev' }],
  rolepatch: [{ label: 'web', url: 'https://rolepatch.com' }],
  'saas-maker': [
    { label: 'cockpit', url: 'https://app.sassmaker.com' },
    { label: 'home', url: 'https://sassmaker.com' },
    { label: 'docs', url: 'https://docs.sassmaker.com' },
  ],
  significanthobbies: [{ label: 'web', url: 'https://significanthobbies.com' }],
  starboard: [{ label: 'web', url: 'https://starboard.codevetter.com' }],
  'swe-interview-prep': [{ label: 'web', url: 'https://swe-interview-prep.pages.dev' }],
};

const PERFORMANCE_BUDGETS = {
  ttfbMs: 800,
  totalMs: 3_000,
  downloadBytes: 5 * 1024 * 1024,
  lighthousePerformance: 70,
  lighthouseAccessibility: 85,
  lighthouseBestPractices: 85,
  lighthouseSeo: 80,
  lcpMs: 4_000,
  cls: 0.1,
};

const LOCAL_CHECK_OVERRIDES = {
  CodeVetter: [
    ['pnpm', ['--dir', 'apps/desktop', 'run', '--if-present', 'build']],
    ['pnpm', ['--dir', 'apps/landing-page-astro', 'run', '--if-present', 'build']],
  ],
};

const LOCAL_CHECK_ENV_OVERRIDES = {
  'swe-interview-prep': {
    VITE_GOOGLE_CLIENT_ID: 'ci-placeholder.apps.googleusercontent.com',
  },
};

function parseArgs(argv) {
  const args = {
    manifest: DEFAULT_MANIFEST,
    fleetRoot: DEFAULT_FLEET_ROOT,
    outputDir: DEFAULT_OUTPUT_DIR,
    project: null,
    runLocal: true,
    runSmoke: true,
    runGithub: true,
    runDirty: true,
    runCloudflareBuilds: true,
    runPerformance: false,
    runLighthouse: false,
    runMarketing: false,
    autofix: false,
    performanceSamples: 3,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    lighthouseTimeoutMs: 90_000,
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID || DEFAULT_CLOUDFLARE_ACCOUNT_ID,
    expectedCloudflareBuildToken:
      process.env.EXPECTED_CLOUDFLARE_BUILD_TOKEN_NAME || DEFAULT_EXPECTED_CLOUDFLARE_BUILD_TOKEN,
    jsonOnly: false,
    failOnFailure: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--manifest') args.manifest = path.resolve(argv[++i] ?? DEFAULT_MANIFEST);
    else if (arg === '--fleet-root') args.fleetRoot = path.resolve(argv[++i] ?? DEFAULT_FLEET_ROOT);
    else if (arg === '--output-dir') args.outputDir = path.resolve(argv[++i] ?? DEFAULT_OUTPUT_DIR);
    else if (arg === '--project') args.project = argv[++i] ?? null;
    else if (arg === '--skip-local') args.runLocal = false;
    else if (arg === '--skip-smoke') args.runSmoke = false;
    else if (arg === '--skip-github') args.runGithub = false;
    else if (arg === '--skip-dirty') args.runDirty = false;
    else if (arg === '--skip-cloudflare-builds') args.runCloudflareBuilds = false;
    else if (arg === '--cloudflare-account-id')
      args.cloudflareAccountId = argv[++i] ?? args.cloudflareAccountId;
    else if (arg === '--expected-cloudflare-build-token') {
      args.expectedCloudflareBuildToken = argv[++i] ?? args.expectedCloudflareBuildToken;
    } else if (arg === '--performance') args.runPerformance = true;
    else if (arg === '--marketing') args.runMarketing = true;
    else if (arg === '--lighthouse') {
      args.runPerformance = true;
      args.runLighthouse = true;
    } else if (arg === '--autofix') args.autofix = true;
    else if (arg === '--performance-samples') {
      args.performanceSamples = Math.max(
        1,
        Number.parseInt(argv[++i] ?? '', 10) || args.performanceSamples
      );
    } else if (arg === '--timeout-ms')
      args.timeoutMs = Number.parseInt(argv[++i] ?? '', 10) || DEFAULT_TIMEOUT_MS;
    else if (arg === '--lighthouse-timeout-ms') {
      args.lighthouseTimeoutMs = Math.max(10_000, Number.parseInt(argv[++i] ?? '', 10) || 90_000);
    } else if (arg === '--json') args.jsonOnly = true;
    else if (arg === '--fail-on-failure') args.failOnFailure = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Fleet audit

Usage:
  node scripts/fleet-audit.mjs [options]

Options:
  --project SLUG       Audit one project.
  --skip-local         Skip local typecheck/test/build checks.
  --skip-smoke         Skip production URL smoke checks.
  --skip-github        Skip GitHub PR/workflow checks.
  --skip-dirty         Skip local git dirty checks.
  --skip-cloudflare-builds
                       Skip Cloudflare Workers Builds health checks.
  --cloudflare-account-id ID
                       Cloudflare account id for Workers Builds checks.
  --expected-cloudflare-build-token NAME
                       Required Workers Builds API token name.
  --performance        Run frontend curl timing checks.
  --marketing          Audit agent-executable marketing assets and add task suggestions.
  --lighthouse         Run frontend Lighthouse checks (90s default per call + progressive latest.* writes on partials; implies --performance). Safe to rerun.
  --autofix            Attempt safe local remediations (permissions-only) and retry once.
  --performance-samples N
                       Number of curl timing samples per frontend URL.
  --timeout-ms N       Timeout per local script command.
  --lighthouse-timeout-ms N
                       Timeout per Lighthouse run (default 90000).
  --json               Print JSON only.
  --fail-on-failure    Exit 1 when any project is classified as fail.
`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    encoding: 'utf8',
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxBuffer: options.maxBuffer ?? 50 * 1024 * 1024,
    env: {
      ...process.env,
      CI: '1',
      NEXT_TELEMETRY_DISABLED: '1',
      HUSKY: '0',
      ...(options.env ?? {}),
    },
  });
  return {
    command: [command, ...args].join(' '),
    status: result.status,
    ok: result.status === 0 && !result.error,
    timedOut: result.error?.code === 'ETIMEDOUT',
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error?.message ?? null,
  };
}

function networkAudit() {
  const result = run(
    'curl',
    [
      '-L',
      '-s',
      '-o',
      '/dev/null',
      '-w',
      '%{http_code}',
      '--connect-timeout',
      '3',
      '--max-time',
      '5',
      'https://api.github.com',
    ],
    { timeoutMs: 8_000 }
  );
  const status = Number.parseInt(result.stdout.trim(), 10);
  const ok = result.ok && Number.isFinite(status) && status !== 0;
  return {
    ok,
    status: Number.isFinite(status) ? status : null,
    error: ok
      ? null
      : result.stderr ||
        result.error ||
        `curl returned HTTP ${Number.isFinite(status) ? status : 'unknown'}`,
  };
}

function readCloudflareToken() {
  if (process.env.CLOUDFLARE_READ_TOKEN) return process.env.CLOUDFLARE_READ_TOKEN;
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  try {
    return execFileSync(
      'security',
      ['find-generic-password', '-s', 'foundry-fleet-audit', '-a', 'CLOUDFLARE_READ_TOKEN', '-w'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
  } catch {
    return null;
  }
}

async function cloudflareGet(accountId, token, pathSuffix) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}${pathSuffix}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) {
    const message =
      body?.errors?.map((error) => error.message).join('; ') || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return body?.result;
}

async function cloudflareBuildAuditAll(projects, args, network) {
  const wantedServices = new Set(
    projects.flatMap((project) => CLOUDFLARE_WORKER_SERVICES[project.slug] ?? [])
  );
  if (!args.runCloudflareBuilds || wantedServices.size === 0) return new Map();
  if (network && !network.ok) {
    return new Map(
      projects.map((project) => [
        project.slug,
        {
          ok: true,
          skipped: true,
          error: network.error ?? 'No network',
          expectedToken: args.expectedCloudflareBuildToken,
          services: [],
        },
      ])
    );
  }
  const token = readCloudflareToken();
  if (!token) {
    return new Map(
      projects.map((project) => [
        project.slug,
        {
          ok: false,
          skipped: true,
          error:
            'Missing Cloudflare read token in CLOUDFLARE_READ_TOKEN, CLOUDFLARE_API_TOKEN, or macOS keychain item foundry-fleet-audit/CLOUDFLARE_READ_TOKEN',
          expectedToken: args.expectedCloudflareBuildToken,
          services: [],
        },
      ])
    );
  }

  try {
    const serviceList = await cloudflareGet(args.cloudflareAccountId, token, '/workers/services');
    const serviceByName = new Map((serviceList ?? []).map((service) => [service.id, service]));
    const auditByProject = new Map();
    for (const project of projects) {
      const serviceNames = CLOUDFLARE_WORKER_SERVICES[project.slug] ?? [];
      const services = [];
      for (const serviceName of serviceNames) {
        const service = serviceByName.get(serviceName);
        const scriptTag = service?.default_environment?.script_tag;
        if (!service || !scriptTag) {
          services.push({
            name: serviceName,
            ok: false,
            error: 'Cloudflare Worker service or production script tag not found',
          });
          continue;
        }
        const triggers = await cloudflareGet(
          args.cloudflareAccountId,
          token,
          `/builds/workers/${scriptTag}/triggers`
        );
        const trigger = triggers?.[0] ?? null;
        const builds = await cloudflareGet(
          args.cloudflareAccountId,
          token,
          `/builds/workers/${scriptTag}/builds?per_page=1`
        );
        const build = builds?.[0] ?? null;
        const tokenOk = trigger?.build_token_name === args.expectedCloudflareBuildToken;
        const buildStopped = build?.status === 'stopped';
        const buildSucceeded = build?.build_outcome === 'success';
        services.push({
          name: serviceName,
          ok: Boolean(tokenOk && buildStopped && buildSucceeded),
          tokenName: trigger?.build_token_name ?? null,
          expectedToken: args.expectedCloudflareBuildToken,
          status: build?.status ?? null,
          outcome: build?.build_outcome ?? null,
          commit: build?.build_trigger_metadata?.commit_hash?.slice(0, 7) ?? null,
          createdOn: build?.created_on ?? null,
          error: tokenOk
            ? buildStopped && buildSucceeded
              ? null
              : `Latest build is ${build?.status ?? 'missing'} / ${build?.build_outcome ?? 'unknown'}`
            : `Build trigger token is ${trigger?.build_token_name ?? 'missing'}`,
        });
      }
      if (serviceNames.length > 0) {
        auditByProject.set(project.slug, {
          ok: services.every((service) => service.ok),
          skipped: false,
          expectedToken: args.expectedCloudflareBuildToken,
          services,
        });
      }
    }
    return auditByProject;
  } catch (error) {
    return new Map(
      projects.map((project) => [
        project.slug,
        {
          ok: false,
          skipped: true,
          error: error.message,
          expectedToken: args.expectedCloudflareBuildToken,
          services: [],
        },
      ])
    );
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function repoFromUrl(url) {
  const trimmed = String(url ?? '')
    .trim()
    .replace(/\.git$/, '');
  const ssh = trimmed.match(/^git@[^:]+:([^/]+)\/([^/]+)$/);
  if (ssh) return `${ssh[1]}/${ssh[2]}`;
  const https = trimmed.match(/^https?:\/\/[^/]+\/([^/]+)\/([^/]+)$/);
  if (https) return `${https[1]}/${https[2]}`;
  return null;
}

function localProjectPath(args, slug, meta) {
  if (meta?.path) {
    const explicitPath = path.resolve(String(meta.path));
    if (fs.existsSync(explicitPath)) return explicitPath;
  }
  const candidates = [
    LOCAL_PATH_OVERRIDES[slug],
    slug,
    repoFromUrl(meta?.url)?.split('/').pop(),
    repoFromUrl(meta?.url)?.split('/').pop()?.toLowerCase(),
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(path.join(args.fleetRoot, candidate)));
  return path.join(args.fleetRoot, found ?? slug);
}

function loadProjects(args) {
  const manifest = readJson(args.manifest);
  return Object.entries(manifest)
    .map(([slug, meta]) => ({
      slug,
      desc: meta?.desc ?? '',
      url: meta?.url ?? '',
      tier: meta?.tier ?? '',
      category: meta?.category ?? '',
      businessLane: FLEET_BUCKETS[meta?.tier] ?? FLEET_BUCKETS[meta?.category] ?? 'Unbucketed',
      repo: repoFromUrl(meta?.url),
      fleetRoot: args.fleetRoot,
      path: localProjectPath(args, slug, meta),
    }))
    .filter((project) => {
      if (args.project) return project.slug === args.project;
      return !OUT_OF_FLEET_PROJECTS.has(project.slug);
    });
}

function parseGhJson(result, fallback) {
  if (!result.ok) return fallback;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return fallback;
  }
}

function latestByWorkflow(runs) {
  const byName = new Map();
  for (const run of runs) {
    const name = run.workflowName ?? run.name ?? 'workflow';
    const existing = byName.get(name);
    const currentTime = Date.parse(run.createdAt ?? '') || 0;
    const existingTime = Date.parse(existing?.createdAt ?? '') || 0;
    if (!existing || currentTime > existingTime) byName.set(name, run);
  }
  return Array.from(byName.values()).sort((a, b) =>
    String(a.workflowName ?? a.name).localeCompare(String(b.workflowName ?? b.name))
  );
}

function githubAudit(project) {
  if (project.network && !project.network.ok) {
    return {
      ok: true,
      skipped: true,
      error: project.network.error ?? 'No network',
      prs: [],
      workflows: [],
      failedWorkflows: [],
    };
  }
  if (!project.repo) {
    return { ok: false, error: 'No GitHub repo parsed from manifest URL', prs: [], workflows: [] };
  }
  const prsResult = run('gh', [
    'pr',
    'list',
    '--repo',
    project.repo,
    '--state',
    'open',
    '--json',
    'number,title,isDraft,mergeStateStatus,url,updatedAt',
  ]);
  const runsResult = run('gh', [
    'run',
    'list',
    '--repo',
    project.repo,
    '--branch',
    'main',
    '--limit',
    '20',
    '--json',
    'databaseId,workflowName,status,conclusion,createdAt,url,displayTitle',
  ]);
  const prs = parseGhJson(prsResult, []);
  const workflows = latestByWorkflow(parseGhJson(runsResult, []));
  const failedWorkflows = workflows.filter((workflow) =>
    ['failure', 'cancelled', 'timed_out', 'startup_failure'].includes(
      String(workflow.conclusion ?? '')
    )
  );
  return {
    ok: prsResult.ok && runsResult.ok && failedWorkflows.length === 0,
    error:
      prsResult.ok && runsResult.ok
        ? null
        : [prsResult.stderr, runsResult.stderr].filter(Boolean).join('\n'),
    prs,
    workflows,
    failedWorkflows,
  };
}

function dirtyAudit(project) {
  if (!fs.existsSync(path.join(project.path, '.git'))) {
    return { ok: true, skipped: true, error: 'Local checkout missing', entries: [] };
  }
  const result = run('git', ['status', '--short'], { cwd: project.path });
  const entries = result.stdout.split(/\r?\n/).filter(Boolean);
  return {
    ok: result.ok && entries.length === 0,
    error: result.ok ? null : result.stderr,
    entries,
  };
}

function smokeAudit(project) {
  if (project.network && !project.network.ok) {
    return {
      ok: true,
      skipped: true,
      checks: (PROD_TARGETS[project.slug] ?? []).map((target) => ({
        label: target.label,
        url: target.url,
        finalUrl: null,
        status: null,
        expected: target.ok,
        ok: true,
        error: project.network.error ?? 'No network',
      })),
    };
  }
  const targets = PROD_TARGETS[project.slug] ?? [];
  const checks = targets.map((target) => {
    const result = run(
      'curl',
      [
        '-L',
        '-s',
        '-o',
        '/dev/null',
        '-w',
        '%{http_code} %{url_effective}',
        '--connect-timeout',
        '5',
        '--max-time',
        '15',
        target.url,
      ],
      { timeoutMs: 20_000 }
    );
    const [statusText, ...urlParts] = result.stdout.trim().split(/\s+/);
    const status = Number.parseInt(statusText ?? '', 10);
    return {
      label: target.label,
      url: target.url,
      finalUrl: urlParts.join(' ') || null,
      status: Number.isFinite(status) ? status : null,
      expected: target.ok,
      ok: result.ok && target.ok.includes(status),
      error: result.ok ? null : result.stderr || result.error,
    };
  });
  return { ok: checks.every((check) => check.ok), checks };
}

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  return sorted[Math.floor(sorted.length / 2)];
}

function secondsToMs(value) {
  return Number.isFinite(value) ? Math.round(value * 1000) : null;
}

function budgetStatus(metric, value, budget, direction = 'max') {
  if (!Number.isFinite(value)) return null;
  const ok = direction === 'min' ? value >= budget : value <= budget;
  return { metric, value, budget, ok };
}

function curlTiming(target) {
  const format = [
    '{',
    '"httpCode":%{http_code},',
    '"sizeDownload":%{size_download},',
    '"timeNameLookup":%{time_namelookup},',
    '"timeConnect":%{time_connect},',
    '"timeAppConnect":%{time_appconnect},',
    '"timeStartTransfer":%{time_starttransfer},',
    '"timeTotal":%{time_total},',
    '"urlEffective":"%{url_effective}"',
    '}',
  ].join('');
  const result = run(
    'curl',
    [
      '-L',
      '-s',
      '-o',
      '/dev/null',
      '-w',
      format,
      '--connect-timeout',
      '8',
      '--max-time',
      '30',
      target.url,
    ],
    { timeoutMs: 35_000 }
  );
  if (!result.ok) {
    return { ok: false, error: result.stderr || result.error || 'curl failed' };
  }
  try {
    const parsed = JSON.parse(result.stdout);
    return {
      ok: parsed.httpCode >= 200 && parsed.httpCode < 400,
      httpCode: parsed.httpCode,
      finalUrl: parsed.urlEffective,
      sizeDownload: Math.round(parsed.sizeDownload),
      timeNameLookupMs: secondsToMs(parsed.timeNameLookup),
      timeConnectMs: secondsToMs(parsed.timeConnect),
      timeTlsMs: secondsToMs(parsed.timeAppConnect),
      ttfbMs: secondsToMs(parsed.timeStartTransfer),
      totalMs: secondsToMs(parsed.timeTotal),
      error:
        parsed.httpCode >= 200 && parsed.httpCode < 400
          ? null
          : `Unexpected HTTP ${parsed.httpCode}`,
    };
  } catch {
    return { ok: false, error: `Could not parse curl timing output: ${result.stdout}` };
  }
}

// Bounded per-Lighthouse + watchdog logging + partial writes (Symphony task 87dd6f2b-4b67-431c-9c92-c067d38c6843).
// Addresses 2026-05-27 hang after child exit: tighter default timeout, start/end logs on every call,
// and progressive latest.* persistence so one failure never loses prior project data.
function lighthouseAudit(target, timeoutMs = 90_000) {
  const t0 = Date.now();
  console.error(
    `[watchdog] lighthouse start ${target.url} (timeout ${Math.round(timeoutMs / 1000)}s)`
  );
  const result = run(
    'pnpm',
    [
      'exec',
      'lighthouse',
      target.url,
      '--quiet',
      '--chrome-flags=--headless=new --no-sandbox',
      '--output=json',
      '--output-path=stdout',
      '--only-categories=performance,accessibility,best-practices,seo',
    ],
    { timeoutMs }
  );
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  if (result.timedOut) {
    console.error(`[watchdog] lighthouse TIMEOUT ${target.url} after ${dt}s`);
  } else if (!result.ok) {
    console.error(
      `[watchdog] lighthouse FAIL ${target.url} after ${dt}s: ${result.error || result.status || 'non-zero exit'}`
    );
  } else {
    console.error(`[watchdog] lighthouse OK ${target.url} after ${dt}s`);
  }
  if (!result.ok) {
    return {
      ok: false,
      error: result.stderr || result.error || 'lighthouse failed',
      tail: `${result.stdout}\n${result.stderr}`.split(/\r?\n/).filter(Boolean).slice(-12),
    };
  }
  try {
    const parsed = JSON.parse(result.stdout);
    const categories = parsed.categories ?? {};
    const audits = parsed.audits ?? {};
    const scores = {
      performance: Math.round((categories.performance?.score ?? 0) * 100),
      accessibility: Math.round((categories.accessibility?.score ?? 0) * 100),
      bestPractices: Math.round((categories['best-practices']?.score ?? 0) * 100),
      seo: Math.round((categories.seo?.score ?? 0) * 100),
    };
    const metrics = {
      lcpMs: audits['largest-contentful-paint']?.numericValue
        ? Math.round(audits['largest-contentful-paint'].numericValue)
        : null,
      cls: Number.isFinite(audits['cumulative-layout-shift']?.numericValue)
        ? Number(audits['cumulative-layout-shift'].numericValue.toFixed(3))
        : null,
      totalBlockingTimeMs: audits['total-blocking-time']?.numericValue
        ? Math.round(audits['total-blocking-time'].numericValue)
        : null,
    };
    const budgets = [
      budgetStatus(
        'lighthousePerformance',
        scores.performance,
        PERFORMANCE_BUDGETS.lighthousePerformance,
        'min'
      ),
      budgetStatus(
        'lighthouseAccessibility',
        scores.accessibility,
        PERFORMANCE_BUDGETS.lighthouseAccessibility,
        'min'
      ),
      budgetStatus(
        'lighthouseBestPractices',
        scores.bestPractices,
        PERFORMANCE_BUDGETS.lighthouseBestPractices,
        'min'
      ),
      budgetStatus('lighthouseSeo', scores.seo, PERFORMANCE_BUDGETS.lighthouseSeo, 'min'),
      budgetStatus('lcpMs', metrics.lcpMs, PERFORMANCE_BUDGETS.lcpMs),
      budgetStatus('cls', metrics.cls, PERFORMANCE_BUDGETS.cls),
    ].filter(Boolean);
    return {
      ok: budgets.every((budget) => budget.ok),
      scores,
      metrics,
      budgets,
      error: null,
    };
  } catch {
    return { ok: false, error: 'Could not parse Lighthouse JSON output' };
  }
}

function performanceAudit(project, options) {
  if (project.network && !project.network.ok) {
    return {
      ok: true,
      skipped: true,
      hasHardFailure: false,
      checks: (FRONTEND_TARGETS[project.slug] ?? []).map((target) => ({
        label: target.label,
        url: target.url,
        samples: [],
        summary: {
          httpCode: null,
          finalUrl: null,
          sizeDownload: null,
          dnsMs: null,
          connectMs: null,
          tlsMs: null,
          ttfbMs: null,
          totalMs: null,
        },
        budgets: [],
        lighthouse: null,
        ok: true,
        hardFailure: false,
      })),
    };
  }
  const targets = FRONTEND_TARGETS[project.slug] ?? [];
  const checks = targets.map((target) => {
    const samples = Array.from({ length: options.samples }, () => curlTiming(target));
    const successfulSamples = samples.filter((sample) => sample.ok);
    const summary = {
      httpCode: successfulSamples.at(-1)?.httpCode ?? samples.at(-1)?.httpCode ?? null,
      finalUrl: successfulSamples.at(-1)?.finalUrl ?? samples.at(-1)?.finalUrl ?? null,
      sizeDownload: median(successfulSamples.map((sample) => sample.sizeDownload)),
      dnsMs: median(successfulSamples.map((sample) => sample.timeNameLookupMs)),
      connectMs: median(successfulSamples.map((sample) => sample.timeConnectMs)),
      tlsMs: median(successfulSamples.map((sample) => sample.timeTlsMs)),
      ttfbMs: median(successfulSamples.map((sample) => sample.ttfbMs)),
      totalMs: median(successfulSamples.map((sample) => sample.totalMs)),
    };
    const budgets = [
      budgetStatus('ttfbMs', summary.ttfbMs, PERFORMANCE_BUDGETS.ttfbMs),
      budgetStatus('totalMs', summary.totalMs, PERFORMANCE_BUDGETS.totalMs),
      budgetStatus('downloadBytes', summary.sizeDownload, PERFORMANCE_BUDGETS.downloadBytes),
    ].filter(Boolean);
    const lighthouse = options.lighthouse
      ? lighthouseAudit(target, options.lighthouseTimeoutMs ?? 90_000)
      : null;
    const hardFailure = samples.every((sample) => !sample.ok) || lighthouse?.error;
    return {
      label: target.label,
      url: target.url,
      samples,
      summary,
      budgets,
      lighthouse,
      ok:
        !hardFailure && budgets.every((budget) => budget.ok) && (lighthouse ? lighthouse.ok : true),
      hardFailure: Boolean(hardFailure),
    };
  });
  return {
    ok: checks.every((check) => check.ok),
    hasHardFailure: checks.some((check) => check.hardFailure),
    checks,
  };
}

function readTextIfExists(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function marketingAudit(project) {
  const repoExists = fs.existsSync(project.path);
  if (!repoExists) {
    return {
      ok: false,
      skipped: true,
      businessLane: project.businessLane,
      error: 'Local repo missing',
      present: [],
      missing: MARKETING_ASSETS.map((asset) => asset.id),
      suggestions: [],
    };
  }

  const readme = readTextIfExists(path.join(project.path, 'README.md'));
  const present = [];
  const missing = [];
  const assetStatus = MARKETING_ASSETS.map((asset) => {
    const fullPath = path.join(project.path, asset.file);
    const exists = fs.existsSync(fullPath);
    if (exists) present.push(asset.id);
    else missing.push(asset.id);
    return { ...asset, exists };
  });
  const hasMarketingIndex = /docs\/marketing|marketing assets|marketing/i.test(readme);
  const domainPlanPath = path.join(
    project.fleetRoot ?? DEFAULT_FLEET_ROOT,
    'fleet-ops',
    'docs',
    'domain-marketing-plan.md'
  );
  const domainPlan = readTextIfExists(domainPlanPath);
  const domainPlanSlug = DOMAIN_MARKETING_PLAN_ALIASES[project.slug] ?? project.slug;
  const hasDomainMarketingPlan =
    DOMAIN_MARKETING_PROJECTS.has(project.slug) &&
    domainPlan.includes(`\`${domainPlanSlug}\``);
  const isFocusBucket = project.tier === 'core';
  const isSupportBucket = project.tier === 'support';
  const maxSuggestions = hasDomainMarketingPlan ? 0 : isFocusBucket ? 6 : isSupportBucket ? 4 : 1;
  const suggestions = assetStatus
    .filter((asset) => !asset.exists)
    .slice(0, maxSuggestions)
    .map((asset) => ({
      project: project.slug,
      title: `${project.slug}: marketing ${asset.title}`,
      priority: isFocusBucket ? 'high' : isSupportBucket ? 'medium' : 'low',
      evidence: `missing ${asset.file}`,
      valueProof: asset.why,
      description: [
        `Fleet bucket: ${project.businessLane}.`,
        'Agent-executable marketing task; no personal-account posting, secrets, deploy, or production config changes.',
        `Create ${asset.file} for ${project.desc || project.slug} only when durable source notes help; the required output is one or more SaaS Maker Marketing Queue ideas.`,
        'Acceptance: create generated marketing_posts via FND_API_URL=https://api.sassmaker.com pnpm --dir ~/Desktop/fleet/saas-maker/packages/cli exec tsx src/index.ts api POST /v1/marketing/posts --auth session with source_type task, task_id, project_slug, channel, title, body, optional hook/cta; default to tiktok, instagram_reels, or youtube_shorts with an AI video brief instead of generic social copy.',
        'Video rule: for reel-platform ideas, body must include scene-by-scene script, visual shot list, voiceover, on-screen captions, AI asset prompts, edit notes, and first-frame hook; avoid LinkedIn entirely and use X/Reddit only for non-promotional discussion prompts.',
        'Voice rule: direct, visual, product-specific, slightly opinionated, and honest about early product risk; avoid generic AI phrases such as unlock, revolutionize, seamless, game-changing, supercharge, elevate, and transform your workflow.',
        `Priority rationale: ${asset.why}; selected over generic UI polish because marketing now needs reusable distribution assets and measurement.`,
      ].join(' '),
    }));

  return {
    domainPlan: hasDomainMarketingPlan ? path.relative(project.fleetRoot ?? DEFAULT_FLEET_ROOT, domainPlanPath) : null,
    ok: (missing.length === 0 && hasMarketingIndex) || hasDomainMarketingPlan,
    skipped: false,
    businessLane: project.businessLane,
    hasMarketingIndex,
    present,
    missing,
    suggestions,
  };
}

function availableLocalChecks(project) {
  if (LOCAL_CHECK_OVERRIDES[project.slug]) return LOCAL_CHECK_OVERRIDES[project.slug];
  const pkgPath = path.join(project.path, 'package.json');
  if (!fs.existsSync(pkgPath)) return [];
  const pkg = readJson(pkgPath);
  const scripts = pkg.scripts ?? {};
  return ['typecheck', 'test', 'build']
    .filter((script) => scripts[script])
    .map((script) => ['pnpm', ['run', script]]);
}

function extractEpermPath(output) {
  const text = String(output ?? '');
  if (!text.includes('EPERM')) return null;
  const match = text.match(/open '([^']+)'/) ?? text.match(/open "([^"]+)"/);
  return match?.[1] ?? null;
}

function isPathInside(childPath, parentPath) {
  const rel = path.relative(parentPath, childPath);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function tryAutofixPermissions(projectPath, output) {
  const failingPath = extractEpermPath(output);
  if (!failingPath) return { attempted: false, notes: [] };
  const absoluteFailingPath = path.resolve(failingPath);
  const notes = [`EPERM at ${absoluteFailingPath}`];
  if (!isPathInside(absoluteFailingPath, projectPath)) {
    notes.push('Path is outside repo; skipping chmod');
    return { attempted: false, notes };
  }

  const targets = [];
  const failingDir = path.dirname(absoluteFailingPath);
  targets.push(failingDir);
  targets.push(absoluteFailingPath);

  let attempted = false;
  for (const target of targets) {
    if (!fs.existsSync(target)) continue;
    attempted = true;
    const chmodResult = run('chmod', ['-R', 'u+rwX', target], {
      cwd: projectPath,
      timeoutMs: 30_000,
    });
    if (!chmodResult.ok)
      notes.push(`chmod failed: ${chmodResult.error ?? chmodResult.status ?? 'unknown error'}`);
  }

  if (attempted) notes.push('Retried after chmod u+rwX');
  return { attempted, notes };
}

function localAudit(project, timeoutMs, options = {}) {
  const commands = availableLocalChecks(project);
  const checks = [];
  const localEnv = LOCAL_CHECK_ENV_OVERRIDES[project.slug] ?? {};
  for (const [command, args] of commands) {
    const result = run(command, args, { cwd: project.path, timeoutMs, env: localEnv });
    const combined = `${result.stdout}\n${result.stderr}`;
    let retryResult = null;
    let autofix = null;
    if (!result.ok && options.autofix) {
      autofix = tryAutofixPermissions(project.path, combined);
      if (autofix.attempted) {
        retryResult = run(command, args, { cwd: project.path, timeoutMs, env: localEnv });
      }
    }
    const finalResult = retryResult ?? result;
    checks.push({
      command: finalResult.command,
      ok: finalResult.ok,
      status: finalResult.status,
      timedOut: finalResult.timedOut,
      tail: `${finalResult.stdout}\n${finalResult.stderr}`
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(-12),
      autofix: autofix?.notes?.length
        ? { attempted: autofix.attempted, notes: autofix.notes }
        : null,
    });
    if (!finalResult.ok) break;
  }
  return { ok: checks.every((check) => check.ok), checks };
}

function classify(projectAudit) {
  const issues = [];
  const isPersonal = projectAudit.category === 'personal' || projectAudit.tier === 'personal';
  if (projectAudit.dirty && !projectAudit.dirty.ok)
    issues.push(`local dirty (${projectAudit.dirty.entries.length})`);
  if (projectAudit.github?.prs?.length) issues.push(`open PRs (${projectAudit.github.prs.length})`);
  if (projectAudit.github?.failedWorkflows?.length)
    issues.push(`failed workflows (${projectAudit.github.failedWorkflows.length})`);
  if (projectAudit.cloudflareBuilds && !projectAudit.cloudflareBuilds.ok) {
    const failedCount =
      projectAudit.cloudflareBuilds.services?.filter((service) => !service.ok).length ?? 0;
    issues.push(`Cloudflare builds unhealthy (${failedCount})`);
  }
  if (projectAudit.smoke && !projectAudit.smoke.ok) issues.push('prod smoke failed');
  if (projectAudit.local && !projectAudit.local.ok) issues.push('local check failed');
  if (projectAudit.performance && !projectAudit.performance.ok) {
    issues.push(
      projectAudit.performance.hasHardFailure
        ? 'performance audit failed'
        : 'performance budget watch'
    );
  }
  if (issues.length === 0) return { status: 'ok', issues };
  return {
    status: issues.some(
      (issue) =>
        !issue.startsWith('open PRs') &&
        !issue.startsWith('local dirty') &&
        !(isPersonal && issue.startsWith('failed workflows')) &&
        issue !== 'performance budget watch'
    )
      ? 'fail'
      : 'watch',
    issues,
  };
}

function buildTaskSuggestions(projectAudit) {
  const suggestions = [];
  const slug = projectAudit.slug;
  const isPersonal = projectAudit.category === 'personal' || projectAudit.tier === 'personal';
  if (!isPersonal) {
    for (const workflow of projectAudit.github?.failedWorkflows ?? []) {
      suggestions.push({
        project: slug,
        title: `[fleet-audit] ${slug}: ${workflow.workflowName} failing`,
        priority: 'high',
        evidence: workflow.url,
      });
    }
  }
  for (const smoke of projectAudit.smoke?.checks ?? []) {
    if (!smoke.ok) {
      suggestions.push({
        project: slug,
        title: `[fleet-audit] ${slug}: ${smoke.label} prod smoke failed`,
        priority: 'high',
        evidence: smoke.url,
      });
    }
  }
  for (const service of projectAudit.cloudflareBuilds?.services ?? []) {
    if (!service.ok) {
      suggestions.push({
        project: slug,
        title: `[fleet-audit] ${slug}: ${service.name} Cloudflare build unhealthy`,
        priority: 'high',
        evidence: service.error,
      });
    }
  }
  const failedLocal = projectAudit.local?.checks?.find((check) => !check.ok);
  if (failedLocal) {
    suggestions.push({
      project: slug,
      title: `[fleet-audit] ${slug}: local check failed`,
      priority: 'medium',
      evidence: failedLocal.command,
    });
  }
  for (const check of projectAudit.performance?.checks ?? []) {
    if (!check.ok) {
      suggestions.push({
        project: slug,
        title: `[fleet-audit] ${slug}: ${check.label} performance needs review`,
        priority: check.hardFailure ? 'high' : 'medium',
        evidence: check.url,
      });
    }
  }
  for (const task of projectAudit.marketing?.suggestions ?? []) {
    suggestions.push(task);
  }
  return suggestions;
}

function markdown(report) {
  const lines = [];
  lines.push(`# Fleet Audit`);
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  if (report.network) {
    lines.push(
      `Network: ${report.network.ok ? `ok (${report.network.status})` : `offline (${report.network.status ?? '?'})`}`
    );
  }
  lines.push(`Projects: ${report.projects.length}`);
  lines.push('');
  lines.push(`| Project | Status | Issues |`);
  lines.push(`|---|---:|---|`);
  for (const project of report.projects) {
    lines.push(`| ${project.slug} | ${project.status} | ${project.issues.join('; ') || '-'} |`);
  }
  lines.push('');
  lines.push(`## Task Suggestions`);
  if (report.taskSuggestions.length === 0) {
    lines.push('');
    lines.push('None.');
  } else {
    for (const task of report.taskSuggestions) {
      lines.push(`- ${task.priority}: ${task.title}${task.evidence ? ` (${task.evidence})` : ''}`);
    }
  }
  lines.push('');
  lines.push(`## Details`);
  for (const project of report.projects) {
    lines.push('');
    lines.push(`### ${project.slug}`);
    lines.push(`- Fleet bucket: ${project.businessLane ?? 'Unbucketed'}`);
    if (project.github) {
      if (project.github.skipped) {
        lines.push(`- PRs: skipped (no network)`);
        lines.push(`- Failed workflows: skipped (no network)`);
      } else {
        lines.push(
          `- PRs: ${project.github.prs.map((pr) => `#${pr.number} ${pr.title}`).join(', ') || 'none'}`
        );
        lines.push(
          `- Failed workflows: ${project.github.failedWorkflows.map((run) => run.workflowName).join(', ') || 'none'}`
        );
      }
    }
    if (project.smoke) {
      if (project.smoke.skipped) lines.push(`- Smoke: skipped (no network)`);
      else {
        lines.push(
          `- Smoke: ${project.smoke.checks.map((check) => `${check.label} ${check.status}${check.ok ? '' : ' FAIL'}`).join(', ') || 'no targets'}`
        );
      }
    }
    if (project.cloudflareBuilds) {
      if (project.cloudflareBuilds.skipped) {
        lines.push(`- Cloudflare builds: skipped (${project.cloudflareBuilds.error})`);
      } else {
        lines.push(
          `- Cloudflare builds: ${
            project.cloudflareBuilds.services
              .map((service) => {
                const state = service.ok ? 'PASS' : 'FAIL';
                return `${service.name} ${state} ${service.status ?? '?'} ${service.outcome ?? '?'} token=${service.tokenName ?? '?'}`;
              })
              .join(', ') || 'no Workers Builds targets'
          }`
        );
      }
    }
    if (project.local) {
      lines.push(
        `- Local: ${project.local.checks.map((check) => `${check.command} ${check.ok ? 'PASS' : 'FAIL'}`).join(', ') || 'no scripts'}`
      );
    }
    if (project.performance) {
      if (project.performance.skipped) lines.push(`- Performance: skipped (no network)`);
      else {
        const perfLines = project.performance.checks.map((check) => {
          const parts = [
            `${check.label} ${check.ok ? 'PASS' : 'WATCH'}`,
            `ttfb ${check.summary.ttfbMs ?? '?'}ms`,
            `total ${check.summary.totalMs ?? '?'}ms`,
          ];
          if (check.lighthouse) {
            parts.push(`LH perf ${check.lighthouse.scores?.performance ?? '?'}`);
          }
          return parts.join(' ');
        });
        lines.push(`- Performance: ${perfLines.join(', ') || 'no frontend targets'}`);
      }
    }
    if (project.marketing) {
      if (project.marketing.skipped) {
        lines.push(`- Marketing: skipped (${project.marketing.error})`);
      } else {
        lines.push(
          `- Marketing: ${
            project.marketing.ok ? 'PASS' : 'GAPS'
          } bucket=${project.marketing.businessLane}; assets ${project.marketing.present.length}/${MARKETING_ASSETS.length}; missing ${
            project.marketing.missing.join(', ') || '-'
          }`
        );
      }
    }
    if (project.dirty) {
      lines.push(`- Dirty files: ${project.dirty.entries.length}`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const network = networkAudit();
  const projects = loadProjects(args);
  const cloudflareBuilds = await cloudflareBuildAuditAll(projects, args, network);
  const audited = [];
  for (const project of projects) {
    const entry = { ...project, network };
    if (args.runDirty) entry.dirty = dirtyAudit(project);
    if (args.runGithub) entry.github = githubAudit(entry);
    if (cloudflareBuilds.has(project.slug))
      entry.cloudflareBuilds = cloudflareBuilds.get(project.slug);
    if (args.runSmoke) entry.smoke = smokeAudit(entry);
    if (args.runLocal) entry.local = localAudit(project, args.timeoutMs, { autofix: args.autofix });
    if (args.runPerformance) {
      try {
        entry.performance = performanceAudit(entry, {
          samples: args.performanceSamples,
          lighthouse: args.runLighthouse,
          lighthouseTimeoutMs: args.lighthouseTimeoutMs,
        });
      } catch (e) {
        console.error(`[watchdog] performance/LH error for ${project.slug}: ${e.message}`);
        entry.performance = {
          ok: false,
          hasHardFailure: true,
          checks: [],
          error: String(e.message || e),
          skipped: false,
        };
      }
    }
    if (args.runMarketing) entry.marketing = marketingAudit(entry);
    Object.assign(entry, classify(entry));
    entry.taskSuggestions = buildTaskSuggestions(entry);
    audited.push(entry);
    // Progressive persist after every project: latest.json/latest.md always reflect completed work
    // (preserves output on partial perf/LH failures per Symphony task 87dd6f2b...).
    persistReport(audited, network, args);
  }
  // Final report already persisted; console output only.
  const report = {
    generatedAt: new Date().toISOString(),
    network,
    projects: audited,
    taskSuggestions: audited.flatMap((project) => project.taskSuggestions),
  };

  if (args.jsonOnly) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(markdown(report));
    const jsonPath = path.join(args.outputDir, 'latest.json');
    const mdPath = path.join(args.outputDir, 'latest.md');
    console.log(`Wrote ${jsonPath}`);
    console.log(`Wrote ${mdPath}`);
  }
  const hasFailure = report.projects.some((project) => project.status === 'fail');
  process.exitCode = args.failOnFailure && hasFailure ? 1 : 0;
}

function persistReport(audited, network, args) {
  const report = {
    generatedAt: new Date().toISOString(),
    network,
    projects: audited,
    taskSuggestions: audited.flatMap((project) => project.taskSuggestions ?? []),
  };
  fs.mkdirSync(args.outputDir, { recursive: true });
  const jsonPath = path.join(args.outputDir, 'latest.json');
  const mdPath = path.join(args.outputDir, 'latest.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(mdPath, markdown(report));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
