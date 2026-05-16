#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { FLEET_HEALTH_CONTRACTS } from './lib/fleet-health-contracts.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FLEET_ROOT = path.resolve(ROOT, '..');

function parseArgs(argv) {
  const args = { project: null, json: false, failOnMissing: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project') args.project = argv[++i] ?? null;
    else if (arg === '--json') args.json = true;
    else if (arg === '--fail-on-missing') args.failOnMissing = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(`Fleet monitoring audit

Usage:
  pnpm fleet:monitoring-audit
  pnpm fleet:monitoring-audit -- --project reader --fail-on-missing

Checks source coverage for:
- PostHog/SaaS Maker monitoring dependency
- browser page crash capture via installBrowserMonitoring/capturePageCrash
- auth/signup failure capture via captureAuthFailure/captureSignupFailure
`);
      process.exit(0);
    }
  }
  return args;
}

function loadProjects() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'foundry.projects.json'), 'utf8'));
  return Object.keys(manifest).map((slug) => ({ slug, dir: path.join(FLEET_ROOT, slug) }));
}

function readTextFiles(dir) {
  const output = [];
  const stack = [dir];
  const ignored = new Set(['node_modules', '.next', 'dist', 'build', '.wrangler', '.git', 'coverage', 'out']);
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !fs.existsSync(current)) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (/\.(tsx?|jsx?|mjs|cjs|json)$/.test(entry.name)) {
        output.push(full);
      }
    }
  }
  return output;
}

function auditProject(project) {
  const contract = FLEET_HEALTH_CONTRACTS[project.slug] ?? {};
  if (!contract.prodUrl) {
    return {
      project: project.slug,
      ok: true,
      skipped: true,
      checks: [
        { name: 'posthog_dependency_or_init', ok: true },
        { name: 'page_crash_capture', ok: true },
        { name: 'auth_or_signup_failure_capture', ok: true },
      ],
      signals: {},
    };
  }
  const requiresAuthCapture = contract.auth?.required === true;
  const files = readTextFiles(project.dir);
  let packageJson = {};
  try {
    packageJson = JSON.parse(fs.readFileSync(path.join(project.dir, 'package.json'), 'utf8'));
  } catch {
    // Some repos are nested apps; source scan still works.
  }
  const depText = JSON.stringify({
    dependencies: packageJson.dependencies ?? {},
    devDependencies: packageJson.devDependencies ?? {},
  });
  const source = files
    .filter((file) => !file.endsWith('pnpm-lock.yaml') && !file.endsWith('package-lock.json'))
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');

  const hasPostHogDependency = /@saas-maker\/posthog-client|posthog-js|posthog-node/.test(depText);
  const hasPostHogSource = /PostHogProvider|posthog\.init|configurePostHog|initPostHog/.test(source);
  const hasPageCrashCapture = /installBrowserMonitoring|capturePageCrash|foundry_page_crash/.test(source);
  const hasAuthFailureCapture = /captureAuthFailure|captureSignupFailure|foundry_auth_failure|foundry_signup_failure/.test(source);
  const hasSentry = /@sentry\/|Sentry\.init/.test(`${depText}\n${source}`);

  const checks = [
    { name: 'posthog_dependency_or_init', ok: hasPostHogDependency || hasPostHogSource },
    { name: 'page_crash_capture', ok: hasPageCrashCapture },
    { name: 'auth_or_signup_failure_capture', ok: !requiresAuthCapture || hasAuthFailureCapture },
  ];

  return {
    project: project.slug,
    requiresAuthCapture,
    ok: checks.every((check) => check.ok),
    checks,
    signals: {
      hasPostHogDependency,
      hasPostHogSource,
      hasPageCrashCapture,
      hasAuthFailureCapture,
      hasSentry,
    },
  };
}

function printMarkdown(results) {
  const failures = results.filter((result) => !result.ok);
  console.log('# Fleet Monitoring Audit\n');
  console.log(`Generated: ${new Date().toISOString()}\n`);
  console.log(`Projects: ${results.length}`);
  console.log(`Failures: ${failures.length}\n`);
  console.log('| Project | Status | Missing |');
  console.log('| --- | --- | --- |');
  for (const result of results) {
    const missing = result.checks.filter((check) => !check.ok).map((check) => check.name).join(', ');
    console.log(`| ${result.project} | ${result.ok ? 'pass' : 'fail'} | ${missing || '-'} |`);
  }
}

const args = parseArgs(process.argv.slice(2));
const projects = loadProjects().filter((project) => !args.project || project.slug === args.project);
const results = projects.map(auditProject);
if (args.json) console.log(JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
else printMarkdown(results);

if (args.failOnMissing && results.some((result) => !result.ok)) process.exit(1);
