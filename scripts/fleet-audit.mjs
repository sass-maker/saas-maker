#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DEFAULT_FLEET_ROOT = path.resolve(ROOT, '..');
const DEFAULT_MANIFEST = path.join(ROOT, 'foundry.projects.json');
const DEFAULT_OUTPUT_DIR = path.join(ROOT, '.symphony', 'fleet-audit');
const DEFAULT_TIMEOUT_MS = 240_000;

const PROD_TARGETS = {
  anime_list: [
    { label: 'web', url: 'https://anime-list-9lk.pages.dev', ok: [200] },
    { label: 'api-root', url: 'https://mal-api.sarthakagrawal927.workers.dev', ok: [404] },
  ],
  CodeVetter: [{ label: 'web', url: 'https://codevetter.com', ok: [200] }],
  'email-manager': [{ label: 'web', url: 'https://email-manager.sarthakagrawal927.workers.dev', ok: [200] }],
  everythingrated: [{ label: 'web', url: 'https://everythingrated.sarthakagrawal927.workers.dev', ok: [200] }],
  'free-ai': [{ label: 'gateway', url: 'https://free-ai-gateway.sarthakagrawal927.workers.dev', ok: [200] }],
  'ai-game': [{ label: 'web', url: 'https://aliveville.com', ok: [200] }],
  'high-signal': [
    { label: 'web', url: 'https://highsignal.app', ok: [200] },
    { label: 'api', url: 'https://high-signal-api.sarthakagrawal927.workers.dev', ok: [200] },
  ],
  linkchat: [{ label: 'web', url: 'https://linkchat.sarthakagrawal927.workers.dev', ok: [200] }],
  looptv: [{ label: 'web', url: 'https://looptv.pages.dev', ok: [200] }],
  'open-historia': [{ label: 'web', url: 'https://open-historia.sarthakagrawal927.workers.dev', ok: [200] }],
  reader: [{ label: 'web', url: 'https://reader.sarthakagrawal927.workers.dev', ok: [200] }],
  'resume-tailor': [{ label: 'web', url: 'https://rolepatch.com', ok: [200] }],
  'saas-maker': [
    { label: 'cockpit', url: 'https://app.sassmaker.com', ok: [200] },
    { label: 'api-root', url: 'https://api.sassmaker.com', ok: [404] },
    { label: 'home', url: 'https://sassmaker.com', ok: [200] },
    { label: 'docs', url: 'https://docs.sassmaker.com', ok: [200] },
  ],
  significanthobbies: [{ label: 'web', url: 'https://significanthobbies.com', ok: [200] }],
  starboard: [{ label: 'web', url: 'https://starboard.sarthakagrawal927.workers.dev', ok: [200] }],
  'swe-interview-prep': [{ label: 'web', url: 'https://swe-interview-prep.pages.dev', ok: [200] }],
  'today-little-log': [{ label: 'web', url: 'https://today-little-log.pages.dev', ok: [200] }],
  truehire: [{ label: 'worker', url: 'https://truehire.sarthakagrawal927.workers.dev', ok: [200] }],
};

const FRONTEND_TARGETS = {
  anime_list: [{ label: 'web', url: 'https://anime-list-9lk.pages.dev' }],
  CodeVetter: [{ label: 'web', url: 'https://codevetter.com' }],
  'email-manager': [{ label: 'web', url: 'https://email-manager.sarthakagrawal927.workers.dev' }],
  everythingrated: [{ label: 'web', url: 'https://everythingrated.sarthakagrawal927.workers.dev' }],
  'free-ai': [],
  'ai-game': [{ label: 'web', url: 'https://aliveville.com' }],
  'high-signal': [{ label: 'web', url: 'https://highsignal.app' }],
  linkchat: [{ label: 'web', url: 'https://linkchat.sarthakagrawal927.workers.dev' }],
  looptv: [{ label: 'web', url: 'https://looptv.pages.dev' }],
  'open-historia': [{ label: 'web', url: 'https://open-historia.sarthakagrawal927.workers.dev' }],
  reader: [{ label: 'web', url: 'https://reader.sarthakagrawal927.workers.dev' }],
  'resume-tailor': [{ label: 'web', url: 'https://rolepatch.com' }],
  'saas-maker': [
    { label: 'cockpit', url: 'https://app.sassmaker.com' },
    { label: 'home', url: 'https://sassmaker.com' },
    { label: 'docs', url: 'https://docs.sassmaker.com' },
  ],
  significanthobbies: [{ label: 'web', url: 'https://significanthobbies.com' }],
  starboard: [{ label: 'web', url: 'https://starboard.sarthakagrawal927.workers.dev' }],
  'swe-interview-prep': [{ label: 'web', url: 'https://swe-interview-prep.pages.dev' }],
  'today-little-log': [{ label: 'web', url: 'https://today-little-log.pages.dev' }],
  truehire: [{ label: 'web', url: 'https://truehire.sarthakagrawal927.workers.dev' }],
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
    ['pnpm', ['--dir', 'apps/landing-page', 'run', '--if-present', 'build']],
  ],
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
    runPerformance: false,
    runLighthouse: false,
    autofix: false,
    performanceSamples: 3,
    timeoutMs: DEFAULT_TIMEOUT_MS,
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
    else if (arg === '--performance') args.runPerformance = true;
    else if (arg === '--lighthouse') {
      args.runPerformance = true;
      args.runLighthouse = true;
    }
    else if (arg === '--autofix') args.autofix = true;
    else if (arg === '--performance-samples') {
      args.performanceSamples = Math.max(1, Number.parseInt(argv[++i] ?? '', 10) || args.performanceSamples);
    }
    else if (arg === '--timeout-ms') args.timeoutMs = Number.parseInt(argv[++i] ?? '', 10) || DEFAULT_TIMEOUT_MS;
    else if (arg === '--json') args.jsonOnly = true;
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
  --performance        Run frontend curl timing checks.
  --lighthouse         Run frontend Lighthouse checks. Implies --performance.
  --autofix            Attempt safe local remediations (permissions-only) and retry once.
  --performance-samples N
                       Number of curl timing samples per frontend URL.
  --timeout-ms N       Timeout per local script command.
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
    error: ok ? null : result.stderr || result.error || `curl returned HTTP ${Number.isFinite(status) ? status : 'unknown'}`,
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function repoFromUrl(url) {
  const trimmed = String(url ?? '').trim().replace(/\.git$/, '');
  const ssh = trimmed.match(/^git@[^:]+:([^/]+)\/([^/]+)$/);
  if (ssh) return `${ssh[1]}/${ssh[2]}`;
  const https = trimmed.match(/^https?:\/\/[^/]+\/([^/]+)\/([^/]+)$/);
  if (https) return `${https[1]}/${https[2]}`;
  return null;
}

function loadProjects(args) {
  const manifest = readJson(args.manifest);
  return Object.entries(manifest)
    .map(([slug, meta]) => ({
      slug,
      desc: meta?.desc ?? '',
      url: meta?.url ?? '',
      repo: repoFromUrl(meta?.url),
      path: path.join(args.fleetRoot, slug),
    }))
    .filter((project) => !args.project || project.slug === args.project);
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
    ['failure', 'cancelled', 'timed_out', 'startup_failure'].includes(String(workflow.conclusion ?? ''))
  );
  return {
    ok: prsResult.ok && runsResult.ok && failedWorkflows.length === 0,
    error: prsResult.ok && runsResult.ok ? null : [prsResult.stderr, runsResult.stderr].filter(Boolean).join('\n'),
    prs,
    workflows,
    failedWorkflows,
  };
}

function dirtyAudit(project) {
  if (!fs.existsSync(path.join(project.path, '.git'))) {
    return { ok: false, error: 'Local checkout missing', entries: [] };
  }
  const result = run('git', ['status', '--short'], { cwd: project.path });
  const entries = result.stdout.split(/\r?\n/).filter(Boolean);
  return { ok: result.ok && entries.length === 0, error: result.ok ? null : result.stderr, entries };
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
    const result = run('curl', [
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
    ], { timeoutMs: 20_000 });
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
  const result = run('curl', [
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
  ], { timeoutMs: 35_000 });
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
      error: parsed.httpCode >= 200 && parsed.httpCode < 400 ? null : `Unexpected HTTP ${parsed.httpCode}`,
    };
  } catch {
    return { ok: false, error: `Could not parse curl timing output: ${result.stdout}` };
  }
}

function lighthouseAudit(target) {
  const result = run('pnpm', [
    'exec',
    'lighthouse',
    target.url,
    '--quiet',
    '--chrome-flags=--headless=new --no-sandbox',
    '--output=json',
    '--output-path=stdout',
    '--only-categories=performance,accessibility,best-practices,seo',
  ], { timeoutMs: 180_000 });
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
      budgetStatus('lighthousePerformance', scores.performance, PERFORMANCE_BUDGETS.lighthousePerformance, 'min'),
      budgetStatus('lighthouseAccessibility', scores.accessibility, PERFORMANCE_BUDGETS.lighthouseAccessibility, 'min'),
      budgetStatus('lighthouseBestPractices', scores.bestPractices, PERFORMANCE_BUDGETS.lighthouseBestPractices, 'min'),
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
    const lighthouse = options.lighthouse ? lighthouseAudit(target) : null;
    const hardFailure = samples.every((sample) => !sample.ok) || lighthouse?.error;
    return {
      label: target.label,
      url: target.url,
      samples,
      summary,
      budgets,
      lighthouse,
      ok: !hardFailure && budgets.every((budget) => budget.ok) && (lighthouse ? lighthouse.ok : true),
      hardFailure: Boolean(hardFailure),
    };
  });
  return {
    ok: checks.every((check) => check.ok),
    hasHardFailure: checks.some((check) => check.hardFailure),
    checks,
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
  const match = text.match(/open '([^']+)'/) ?? text.match(/open \"([^\"]+)\"/);
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
    const chmodResult = run('chmod', ['-R', 'u+rwX', target], { cwd: projectPath, timeoutMs: 30_000 });
    if (!chmodResult.ok) notes.push(`chmod failed: ${chmodResult.error ?? chmodResult.status ?? 'unknown error'}`);
  }

  if (attempted) notes.push('Retried after chmod u+rwX');
  return { attempted, notes };
}

function localAudit(project, timeoutMs, options = {}) {
  const commands = availableLocalChecks(project);
  const checks = [];
  for (const [command, args] of commands) {
    const result = run(command, args, { cwd: project.path, timeoutMs });
    const combined = `${result.stdout}\n${result.stderr}`;
    let retryResult = null;
    let autofix = null;
    if (!result.ok && options.autofix) {
      autofix = tryAutofixPermissions(project.path, combined);
      if (autofix.attempted) {
        retryResult = run(command, args, { cwd: project.path, timeoutMs });
      }
    }
    const finalResult = retryResult ?? result;
    checks.push({
      command: finalResult.command,
      ok: finalResult.ok,
      status: finalResult.status,
      timedOut: finalResult.timedOut,
      tail: `${finalResult.stdout}\n${finalResult.stderr}`.split(/\r?\n/).filter(Boolean).slice(-12),
      autofix: autofix?.notes?.length ? { attempted: autofix.attempted, notes: autofix.notes } : null,
    });
    if (!finalResult.ok) break;
  }
  return { ok: checks.every((check) => check.ok), checks };
}

function classify(projectAudit) {
  const issues = [];
  if (projectAudit.dirty && !projectAudit.dirty.ok) issues.push(`local dirty (${projectAudit.dirty.entries.length})`);
  if (projectAudit.github?.prs?.length) issues.push(`open PRs (${projectAudit.github.prs.length})`);
  if (projectAudit.github?.failedWorkflows?.length) issues.push(`failed workflows (${projectAudit.github.failedWorkflows.length})`);
  if (projectAudit.smoke && !projectAudit.smoke.ok) issues.push('prod smoke failed');
  if (projectAudit.local && !projectAudit.local.ok) issues.push('local check failed');
  if (projectAudit.performance && !projectAudit.performance.ok) {
    issues.push(projectAudit.performance.hasHardFailure ? 'performance audit failed' : 'performance budget watch');
  }
  if (issues.length === 0) return { status: 'ok', issues };
  return {
    status: issues.some((issue) =>
      !issue.startsWith('open PRs') &&
      !issue.startsWith('local dirty') &&
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
  for (const workflow of projectAudit.github?.failedWorkflows ?? []) {
    suggestions.push({
      project: slug,
      title: `[fleet-audit] ${slug}: ${workflow.workflowName} failing`,
      priority: 'high',
      evidence: workflow.url,
    });
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
  return suggestions;
}

function markdown(report) {
  const lines = [];
  lines.push(`# Fleet Audit`);
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  if (report.network) {
    lines.push(`Network: ${report.network.ok ? `ok (${report.network.status})` : `offline (${report.network.status ?? '?'})`}`);
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
    if (project.github) {
      if (project.github.skipped) {
        lines.push(`- PRs: skipped (no network)`);
        lines.push(`- Failed workflows: skipped (no network)`);
      } else {
        lines.push(`- PRs: ${project.github.prs.map((pr) => `#${pr.number} ${pr.title}`).join(', ') || 'none'}`);
        lines.push(`- Failed workflows: ${project.github.failedWorkflows.map((run) => run.workflowName).join(', ') || 'none'}`);
      }
    }
    if (project.smoke) {
      if (project.smoke.skipped) lines.push(`- Smoke: skipped (no network)`);
      else {
        lines.push(`- Smoke: ${project.smoke.checks.map((check) => `${check.label} ${check.status}${check.ok ? '' : ' FAIL'}`).join(', ') || 'no targets'}`);
      }
    }
    if (project.local) {
      lines.push(`- Local: ${project.local.checks.map((check) => `${check.command} ${check.ok ? 'PASS' : 'FAIL'}`).join(', ') || 'no scripts'}`);
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
  const audited = [];
  for (const project of projects) {
    const entry = { ...project, network };
    if (args.runDirty) entry.dirty = dirtyAudit(project);
    if (args.runGithub) entry.github = githubAudit(entry);
    if (args.runSmoke) entry.smoke = smokeAudit(entry);
    if (args.runLocal) entry.local = localAudit(project, args.timeoutMs, { autofix: args.autofix });
    if (args.runPerformance) {
      entry.performance = performanceAudit(entry, {
        samples: args.performanceSamples,
        lighthouse: args.runLighthouse,
      });
    }
    Object.assign(entry, classify(entry));
    entry.taskSuggestions = buildTaskSuggestions(entry);
    audited.push(entry);
  }
  const report = {
    generatedAt: new Date().toISOString(),
    network,
    projects: audited,
    taskSuggestions: audited.flatMap((project) => project.taskSuggestions),
  };

  fs.mkdirSync(args.outputDir, { recursive: true });
  const jsonPath = path.join(args.outputDir, 'latest.json');
  const mdPath = path.join(args.outputDir, 'latest.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(mdPath, markdown(report));
  if (args.jsonOnly) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(markdown(report));
    console.log(`Wrote ${jsonPath}`);
    console.log(`Wrote ${mdPath}`);
  }
  const hasFailure = report.projects.some((project) => project.status === 'fail');
  process.exitCode = args.failOnFailure && hasFailure ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
