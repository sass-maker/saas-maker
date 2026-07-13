#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';

import {
  buildSmokeFailures,
  buildSmokeTaskPayloads,
  diffPayloadsAgainstTasks,
} from './lib/fleet-production-smoke.mjs';
import { getHealthContractStatus, listHealthContracts } from './lib/fleet-health-contracts.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DEFAULT_OUTPUT_DIR = path.join(ROOT, '.symphony', 'fleet-production-smoke');
const DEFAULT_EXISTING_TASKS = path.join(ROOT, '.symphony', 'tasks.json');

const TARGETS = {
  'anime-list': [{ label: 'web', url: 'https://anime.significanthobbies.com' }],
  CodeVetter: [{ label: 'web', url: 'https://codevetter.com' }],
  'email-manager': [{ label: 'web', url: 'https://email-manager.sarthakagrawal927.workers.dev' }],
  drank: [{ label: 'web', url: 'https://drank-sand.vercel.app' }],
  'free-ai': [
    { label: 'health', url: 'https://ai-gateway.sassmaker.com/health' },
    { label: 'models', url: 'https://ai-gateway.sassmaker.com/v1/models' },
  ],
  'alive-ville': [{ label: 'web', url: 'https://aliveville.com' }],
  'high-signal': [{ label: 'web', url: 'https://highsignal.app' }],
  'knowledge-base': [
    { label: 'health', url: 'https://knowledgebase.sarthakagrawal927.workers.dev/v1/healthz' },
  ],
  karte: [{ label: 'web', url: 'https://linkchat.sarthakagrawal927.workers.dev' }],
  looptv: [
    {
      label: 'web',
      url: 'https://tv.significanthobbies.com',
      expectText: ['Channel-surf YouTube'],
      interactions: [
        {
          label: 'open-science-station',
          role: 'link',
          name: /^Science\b/i,
          expectText: ['Science'],
        },
        {
          label: 'play-science-video',
          role: 'button',
          name: /^Play$/,
          expectIframeIncludes: 'youtube.com/embed',
        },
      ],
    },
  ],
  pace: [{ label: 'web', url: 'https://pace-6xg.pages.dev' }],
  reader: [{ label: 'web', url: 'https://read.significanthobbies.com' }],
  'reel-pipeline': [
    {
      label: 'health',
      url: 'https://reel-pipeline-artifacts.sarthakagrawal927.workers.dev/health',
    },
  ],
  rolepatch: [{ label: 'web', url: 'https://rolepatch.com' }],
  'saas-maker': [
    { label: 'cockpit', url: 'https://app.sassmaker.com/login' },
    { label: 'home', url: 'https://sassmaker.com' },
    { label: 'docs', url: 'https://docs.sassmaker.com' },
  ],
  significanthobbies: [
    {
      label: 'web',
      url: 'https://significanthobbies.com',
      expectText: ['Start your hobby map'],
    },
  ],
  starboard: [{ label: 'web', url: 'https://starboard.codevetter.com' }],
  'swe-interview-prep': [{ label: 'web', url: 'https://learn.significanthobbies.com' }],
  posttrainllm: [
    {
      label: 'web',
      url: 'https://tinygpt.pages.dev',
      expectText: ['The LLM factory that fits on one Mac.'],
    },
    { label: 'devlog', url: 'https://tinygpt.pages.dev/devlog.html', expectText: ['Devlog'] },
  ],
};

const AUTH_PROBES = {
  reader: [
    {
      label: 'google-signin-provider-configured',
      url: 'https://read.significanthobbies.com/api/auth/sign-in/social',
      method: 'POST',
      body: { provider: 'google', callbackURL: '/' },
      okStatuses: [200, 302, 400, 401],
      failBodyIncludes: [
        'PROVIDER_NOT_FOUND',
        'Provider not found',
        'Authentication is not configured',
      ],
    },
  ],
  'saas-maker': [
    {
      label: 'cockpit-google-signin-returns-oauth-url',
      url: 'https://app.sassmaker.com/api/auth/sign-in/social',
      method: 'POST',
      body: { provider: 'google', callbackURL: '/projects' },
      okStatuses: [200],
      requireBodyIncludes: ['accounts.google.com'],
    },
  ],
  'swe-interview-prep': [
    {
      label: 'verify-rejects-logged-out',
      url: 'https://learn.significanthobbies.com/api/auth/verify',
      method: 'GET',
      okStatuses: [401],
    },
    {
      label: 'google-auth-is-configured',
      url: 'https://learn.significanthobbies.com/api/auth/google',
      method: 'POST',
      body: { credential: 'invalid-production-smoke-token' },
      okStatuses: [400, 401],
      failBodyIncludes: ['Authentication is not configured'],
    },
  ],
};

const SEVERE_TEXT_PATTERNS = [
  /ChunkLoadError/i,
  /Loading chunk \d+ failed/i,
  /Application error/i,
  /Authentication is not configured/i,
  /Provider not found/i,
  /PROVIDER_NOT_FOUND/i,
  /Encountered a script tag while rendering React component/i,
  /localhost:8787/i,
];

const DEPRECATED_SAAS_MAKER_ANALYTICS_URL = 'https://api.sassmaker.com/v1/analytics/events';

function parseArgs(argv) {
  const args = {
    project: null,
    outputDir: DEFAULT_OUTPUT_DIR,
    jsonOnly: false,
    failOnFailure: false,
    timeoutMs: 45_000,
    concurrency: 6,
    existingTasksFile: DEFAULT_EXISTING_TASKS,
    createTasks: false,
    screenshotAll: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project') args.project = argv[++i] ?? null;
    else if (arg === '--output-dir') args.outputDir = path.resolve(argv[++i] ?? DEFAULT_OUTPUT_DIR);
    else if (arg === '--timeout-ms')
      args.timeoutMs = Number.parseInt(argv[++i] ?? '', 10) || args.timeoutMs;
    else if (arg === '--concurrency')
      args.concurrency = Number.parseInt(argv[++i] ?? '', 10) || args.concurrency;
    else if (arg === '--json') args.jsonOnly = true;
    else if (arg === '--fail-on-failure') args.failOnFailure = true;
    else if (arg === '--existing-tasks')
      args.existingTasksFile = path.resolve(argv[++i] ?? DEFAULT_EXISTING_TASKS);
    else if (arg === '--create-tasks') args.createTasks = true;
    else if (arg === '--screenshot-all') args.screenshotAll = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Fleet production smoke

Usage:
  node scripts/fleet-production-smoke.mjs [options]

Options:
  --project SLUG        Probe one project.
  --timeout-ms N        Browser navigation timeout per page.
  --concurrency N       Number of projects to probe in parallel (default 6).
  --json                Print JSON only.
  --screenshot-all      Capture screenshots for passing pages too.
  --fail-on-failure     Exit non-zero when any probe fails.
  --existing-tasks PATH Path to cached tasks.json for dedupe (default .symphony/tasks.json).
  --create-tasks        Upsert fresh suggestions via symphony-local CLI.
`);
}

function includesPattern(value, patterns = SEVERE_TEXT_PATTERNS) {
  return patterns.some((pattern) => pattern.test(value));
}

function normalizeError(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function isIgnoredResponse(response) {
  return response.url().startsWith(DEPRECATED_SAAS_MAKER_ANALYTICS_URL);
}

async function runPageProbe(browser, project, target, args, artifactDir) {
  const page = await browser.newPage();
  const errors = [];
  const warnings = [];

  page.on('console', (message) => {
    const text = normalizeError(message.text());
    const isBrowserResourceMessage = /^Failed to load resource:/i.test(text);
    if ((message.type() === 'error' && !isBrowserResourceMessage) || includesPattern(text)) {
      errors.push({ type: 'console', message: text });
    }
  });

  page.on('pageerror', (error) => {
    errors.push({ type: 'pageerror', message: normalizeError(error.message), stack: error.stack });
  });

  page.on('requestfailed', (request) => {
    const resourceType = request.resourceType();
    const failureText = request.failure()?.errorText ?? 'request failed';
    if (failureText.includes('ERR_ABORTED')) return;
    if (['document', 'script', 'stylesheet', 'xhr', 'fetch'].includes(resourceType)) {
      errors.push({
        type: 'requestfailed',
        resourceType,
        url: request.url(),
        message: failureText,
      });
    }
  });

  page.on('response', (response) => {
    const resourceType = response.request().resourceType();
    const status = response.status();
    const expectedLoggedOutFetch =
      ['xhr', 'fetch'].includes(resourceType) && [401, 403].includes(status);
    if (
      ['document', 'script', 'stylesheet', 'xhr', 'fetch'].includes(resourceType) &&
      status >= 400 &&
      !expectedLoggedOutFetch &&
      !isIgnoredResponse(response)
    ) {
      errors.push({
        type: 'bad-response',
        resourceType,
        status,
        url: response.url(),
      });
    }
  });

  let status = null;
  try {
    const response = await page.goto(target.url, {
      waitUntil: 'domcontentloaded',
      timeout: args.timeoutMs,
    });
    status = response?.status() ?? null;
    if (!status || status >= 400) {
      errors.push({ type: 'navigation', status, message: `unexpected status ${status}` });
    }
    await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1_500);

    const bodyText = normalizeError(
      await page
        .locator('body')
        .innerText({ timeout: 5_000 })
        .catch(() => '')
    );
    if (includesPattern(bodyText)) {
      errors.push({ type: 'page-text', message: bodyText });
    }
    for (const expected of target.expectText ?? []) {
      if (!bodyText.includes(expected)) {
        errors.push({
          type: 'missing-text',
          expected,
          message: `Expected page text to include "${expected}"`,
        });
      }
    }

    for (const interaction of target.interactions ?? []) {
      await runInteraction(page, interaction, errors);
    }
  } catch (error) {
    errors.push({ type: 'navigation-exception', message: normalizeError(error.message) });
  }

  if (args.screenshotAll || errors.length > 0) {
    const screenshot = path.join(artifactDir, `${project}-${target.label}.png`);
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
    warnings.push(`screenshot: ${screenshot}`);
  }

  await page.close();

  return {
    kind: 'page',
    project,
    label: target.label,
    url: target.url,
    status,
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

async function runInteraction(page, interaction, errors) {
  const before = errors.length;
  try {
    const locator = interaction.role
      ? page.getByRole(interaction.role, { name: interaction.name }).first()
      : page.getByText(interaction.name).first();
    await locator.click({ timeout: 8_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(750);
    const bodyText = normalizeError(
      await page
        .locator('body')
        .innerText({ timeout: 5_000 })
        .catch(() => '')
    );
    for (const expected of interaction.expectText ?? []) {
      if (!bodyText.includes(expected)) {
        errors.push({
          type: 'interaction-missing-text',
          label: interaction.label,
          expected,
          message: `Expected page text to include "${expected}"`,
        });
      }
    }
    if (interaction.expectIframeIncludes) {
      const iframeSources = await page
        .locator('iframe')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('src') ?? ''));
      if (!iframeSources.some((source) => source.includes(interaction.expectIframeIncludes))) {
        errors.push({
          type: 'interaction-missing-iframe',
          label: interaction.label,
          expected: interaction.expectIframeIncludes,
          message: `Expected iframe src to include "${interaction.expectIframeIncludes}"`,
        });
      }
    }
  } catch (error) {
    errors.push({
      type: 'interaction',
      label: interaction.label,
      message: normalizeError(error.message),
    });
  }

  const newErrors = errors.slice(before);
  for (const error of newErrors) {
    error.interaction = interaction.label;
  }
}

async function runAuthProbe(project, probe, timeoutMs) {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const init = {
    method: probe.method,
    headers: probe.body ? { 'Content-Type': 'application/json' } : undefined,
    body: probe.body ? JSON.stringify(probe.body) : undefined,
    redirect: 'manual',
    signal: controller.signal,
  };

  try {
    const response = await fetch(probe.url, init);
    const body = await response.text();
    const errors = [];
    const okStatuses = probe.okStatuses ?? [200];

    if (!okStatuses.includes(response.status)) {
      errors.push(`expected status ${okStatuses.join('/')}, got ${response.status}`);
    }

    for (const needle of probe.requireBodyIncludes ?? []) {
      if (!body.includes(needle)) errors.push(`response missing ${needle}`);
    }

    for (const needle of probe.failBodyIncludes ?? []) {
      if (body.includes(needle)) errors.push(`response contains ${needle}`);
    }

    return {
      kind: 'auth',
      project,
      label: probe.label,
      url: probe.url,
      status: response.status,
      ok: errors.length === 0,
      durationMs: Date.now() - started,
      errors: errors.map((message) => ({ type: 'auth', message, body: normalizeError(body) })),
    };
  } catch (error) {
    return {
      kind: 'auth',
      project,
      label: probe.label,
      url: probe.url,
      status: null,
      ok: false,
      durationMs: Date.now() - started,
      errors: [{ type: 'auth-exception', message: normalizeError(error.message) }],
    };
  } finally {
    clearTimeout(timeout);
  }
}

function selectedProjects(args) {
  const projects = Object.keys(TARGETS).filter(
    (project) => !args.project || project === args.project
  );
  if (args.project && projects.length === 0) {
    throw new Error(`Unknown project: ${args.project}`);
  }
  return projects;
}

function summarize(projects, checks) {
  return projects.map((project) => {
    const projectChecks = checks.filter((check) => check.project === project);
    const failures = projectChecks.filter((check) => !check.ok);
    return {
      project,
      status: failures.length === 0 ? 'pass' : 'fail',
      checks: projectChecks.length,
      failures: failures.length,
    };
  });
}

function summarizeHealthContracts(checks) {
  return listHealthContracts().map((contract) => ({
    project: contract.project,
    displayName: contract.displayName,
    status: getHealthContractStatus(contract.project, checks),
    prodUrl: contract.prodUrl,
    expectedStatus: contract.expectedStatus,
    criticalRoutes: contract.criticalRoutes,
    auth: contract.auth,
    requiredEnv: contract.requiredEnv,
    deployTarget: contract.deployTarget,
    githubWorkflow: contract.githubWorkflow,
    smokeCommand: contract.smokeCommand,
  }));
}

function writeReports(args, report) {
  fs.mkdirSync(args.outputDir, { recursive: true });
  fs.mkdirSync(path.join(args.outputDir, 'artifacts'), { recursive: true });
  fs.writeFileSync(
    path.join(args.outputDir, 'latest.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  fs.writeFileSync(path.join(args.outputDir, 'latest.md'), renderMarkdown(report));
}

function renderMarkdown(report) {
  const lines = [
    '# Fleet Production Smoke',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    '| Project | Status | Checks | Failures |',
    '| --- | --- | ---: | ---: |',
  ];

  for (const item of report.summary) {
    lines.push(`| ${item.project} | ${item.status} | ${item.checks} | ${item.failures} |`);
  }

  lines.push('', '## Failures', '');
  const failures = report.checks.filter((check) => !check.ok);
  if (failures.length === 0) {
    lines.push('None.');
  } else {
    for (const failure of failures) {
      lines.push(`### ${failure.project} / ${failure.label}`);
      lines.push('');
      lines.push(`URL: ${failure.url}`);
      lines.push('');
      for (const error of failure.errors) {
        lines.push(`- ${error.type}: ${formatError(error)}`);
      }
      if (failure.warnings?.length) {
        for (const warning of failure.warnings) lines.push(`- ${warning}`);
      }
      lines.push('');
    }
  }

  lines.push('## Health Contracts', '');
  lines.push('| Project | Status | Prod URL | Deploy Target | Workflow | Smoke |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const contract of report.healthContracts ?? []) {
    lines.push(
      [
        contract.project,
        contract.status,
        contract.prodUrl ?? 'blocked',
        contract.deployTarget ?? 'unknown',
        contract.githubWorkflow ?? 'none',
        contract.smokeCommand ? '`configured`' : 'blocked',
      ]
        .join(' | ')
        .replace(/^/, '| ')
        .replace(/$/, ' |')
    );
  }
  lines.push('');

  lines.push('## Task suggestions', '');
  const fresh = report.taskSuggestions?.fresh ?? [];
  const skipped = report.taskSuggestions?.skipped ?? [];
  if (fresh.length === 0 && skipped.length === 0) {
    lines.push('None. (No probe failures to triage.)');
  } else {
    if (fresh.length === 0) {
      lines.push('No new suggestions — existing open tasks already cover every failure.');
    } else {
      lines.push(`${fresh.length} new task suggestion(s):`, '');
      for (const payload of fresh) {
        lines.push(`- **${payload.title}** [${payload.priority}]`);
      }
    }
    if (skipped.length) {
      lines.push('', `${skipped.length} failure(s) already tracked by open tasks:`, '');
      for (const entry of skipped) {
        const existingId = entry.existing?.id ? ` (id ${entry.existing.id})` : '';
        lines.push(`- ${entry.payload.title}${existingId}`);
      }
    }
  }
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function formatError(error) {
  const parts = [];
  if (error.message) parts.push(error.message);
  if (error.status) parts.push(`status ${error.status}`);
  if (error.resourceType) parts.push(error.resourceType);
  if (error.url) parts.push(error.url);
  if (error.interaction) parts.push(`after ${error.interaction}`);
  return parts.join(' - ') || 'failed';
}

function loadExistingTasks(filePath) {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.tasks)) return raw.tasks;
    if (Array.isArray(raw?.data)) return raw.data;
    return [];
  } catch {
    return [];
  }
}

function upsertViaSymphony(payload) {
  const cli = spawnSync(
    'node',
    [
      path.join(ROOT, 'scripts', 'symphony-local.mjs'),
      'create',
      payload.title,
      '--description',
      payload.description,
      '--project',
      payload.project_slug,
      '--priority',
      payload.priority,
    ],
    { encoding: 'utf8', stdio: 'inherit' }
  );
  return cli.status === 0;
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projects = selectedProjects(args);
  const artifactDir = path.join(args.outputDir, 'artifacts');
  fs.mkdirSync(artifactDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const checks = [];

  try {
    const projectChecks = await mapLimit(
      projects,
      Math.max(1, args.concurrency),
      async (project) => {
        const checksForProject = [];
        for (const target of TARGETS[project]) {
          checksForProject.push(await runPageProbe(browser, project, target, args, artifactDir));
        }
        for (const probe of AUTH_PROBES[project] ?? []) {
          checksForProject.push(await runAuthProbe(project, probe, args.timeoutMs));
        }
        return checksForProject;
      }
    );
    checks.push(...projectChecks.flat());
  } finally {
    await browser.close();
  }

  const generatedAt = new Date().toISOString();
  const failures = buildSmokeFailures(checks);
  const payloads = buildSmokeTaskPayloads(failures, { generatedAt });
  const existingTasks = loadExistingTasks(args.existingTasksFile);
  const { fresh, skipped } = diffPayloadsAgainstTasks(payloads, existingTasks);

  const report = {
    generatedAt,
    summary: summarize(projects, checks),
    healthContracts: summarizeHealthContracts(checks),
    checks,
    taskSuggestions: {
      existingTasksFile: args.existingTasksFile,
      failures,
      fresh,
      skipped,
    },
  };

  writeReports(args, report);

  if (args.jsonOnly) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const item of report.summary) {
      const marker = item.status === 'pass' ? 'PASS' : 'FAIL';
      console.log(
        `${marker} ${item.project}: ${item.checks - item.failures}/${item.checks} checks passed`
      );
    }
    if (fresh.length || skipped.length) {
      console.log(`\nSuggested tasks: ${fresh.length} new, ${skipped.length} already tracked`);
      for (const payload of fresh) {
        console.log(`  + ${payload.title} [${payload.priority}]`);
      }
    }
    console.log(`\nReport: ${path.join(args.outputDir, 'latest.md')}`);
  }

  if (args.createTasks && fresh.length) {
    let written = 0;
    for (const payload of fresh) {
      if (upsertViaSymphony(payload)) written += 1;
    }
    if (!args.jsonOnly) console.log(`\nUpserted ${written}/${fresh.length} tasks via Symphony.`);
  }

  const failed = report.summary.some((item) => item.status === 'fail');
  if (failed && args.failOnFailure) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
