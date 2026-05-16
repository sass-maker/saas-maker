#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  auditProjectSecretPlan,
  buildProjectSecretPlan,
  buildSecretTaskPayload,
  formatRequiredSecret,
  loadFleetProjects,
  secretFailureKey,
} from './lib/fleet-secret-audit.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function parseArgs(argv) {
  const args = {
    project: null,
    json: false,
    failOnMissing: false,
    createTasks: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project') args.project = argv[++i] ?? null;
    else if (arg === '--json') args.json = true;
    else if (arg === '--fail-on-missing') args.failOnMissing = true;
    else if (arg === '--create-tasks') args.createTasks = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Fleet secret audit

Usage:
  pnpm fleet:secret-audit
  pnpm fleet:secret-audit -- --project reader --fail-on-missing
  pnpm fleet:secret-audit -- --create-tasks

Checks secret names only. It never prints or reads secret values.

Options:
  --project SLUG       Audit one fleet project.
  --json               Print machine-readable results.
  --fail-on-missing    Exit non-zero when any required secret name is missing.
  --create-tasks       Create/update SaaS Maker task suggestions for failures.
`);
}

function printMarkdown(results) {
  const failures = results.filter((result) => !result.ok);
  console.log(`# Fleet Secret Audit\n`);
  console.log(`Generated: ${new Date().toISOString()}\n`);
  console.log(`Projects: ${results.length}`);
  console.log(`Failures: ${failures.length}\n`);
  console.log('| Project | Status | Missing |');
  console.log('| --- | --- | --- |');
  for (const result of results) {
    const missing = result.checks
      .flatMap((check) => check.missing.map((name) => `${check.platform}:${formatRequiredSecret(name)}`))
      .join(', ');
    const errors = result.checks
      .filter((check) => check.error)
      .map((check) => `${check.platform}: ${check.error}`)
      .join('; ');
    console.log(`| ${result.project} | ${result.ok ? 'pass' : 'fail'} | ${missing || errors || '-'} |`);
  }
  if (failures.length > 0) {
    console.log('\n## Failure Detail\n');
    for (const result of failures) {
      console.log(`### ${result.project}`);
      for (const check of result.checks) {
        if (check.ok && !check.error) continue;
        const target = check.target ? ` (${check.target})` : '';
        const missing = check.missing.length ? check.missing.map(formatRequiredSecret).join(', ') : 'none';
        console.log(`- ${check.platform}${target}: missing ${missing}${check.error ? `; error: ${check.error}` : ''}`);
      }
      console.log('');
    }
  }
}

async function createTasksForFailures(failures) {
  if (failures.length === 0) return { created: [], skipped: [] };
  const existing = readCachedTasks();
  const open = new Set(['todo', 'in_progress', 'blocked', 'review']);
  const created = [];
  const skipped = [];

  for (const failure of failures) {
    const key = secretFailureKey(failure);
    const existingTask = existing.find((task) => {
      const status = String(task.status ?? '').toLowerCase();
      return open.has(status) && (task.title === `[fleet-secrets] ${failure.project}` || String(task.description ?? '').includes(key));
    });
    if (existingTask) {
      skipped.push({ failure, existing: existingTask });
      continue;
    }
    const payload = buildSecretTaskPayload(failure);
    payload.description = `${payload.description}\n\nFailure key: ${key}`;
    const result = spawnSync('pnpm', [
      '--dir',
      'packages/cli',
      'exec',
      'tsx',
      'src/index.ts',
      'api',
      'POST',
      '/v1/tasks',
      '--auth',
      'session',
      '--body',
      JSON.stringify(payload),
      '--output',
      'json',
      '--no-validate',
    ], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, FND_API_URL: process.env.FND_API_URL || 'https://api.sassmaker.com' },
    });
    if (result.status !== 0) {
      throw new Error(`Failed to create task for ${failure.project}: ${result.stderr || result.stdout}`);
    }
    created.push({ failure, response: result.stdout });
  }

  return { created, skipped };
}

function readCachedTasks() {
  const cachePath = path.join(ROOT, '.symphony', 'tasks.json');
  if (!fs.existsSync(cachePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    return parsed.tasks ?? parsed ?? [];
  } catch {
    return [];
  }
}

const args = parseArgs(process.argv.slice(2));
const projects = loadFleetProjects(ROOT)
  .filter((project) => !args.project || project.slug === args.project);

if (args.project && projects.length === 0) {
  console.error(`Unknown project: ${args.project}`);
  process.exit(2);
}

const plans = projects.map((project) => buildProjectSecretPlan(project));
const results = plans.map((plan) => auditProjectSecretPlan(plan, { root: ROOT }));
const failures = results.filter((result) => !result.ok);

if (args.createTasks) {
  const taskResult = await createTasksForFailures(failures);
  if (!args.json) {
    console.log(`Secret tasks created: ${taskResult.created.length}`);
    console.log(`Secret tasks already tracked: ${taskResult.skipped.length}`);
  }
}

if (args.json) {
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
} else {
  printMarkdown(results);
}

if (args.failOnMissing && failures.length > 0) process.exit(1);
