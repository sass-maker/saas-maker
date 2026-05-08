#!/usr/bin/env node
/**
 * Fleet failure importer.
 *
 * Reads the active fleet manifest (foundry.projects.json), pulls recent
 * failed GitHub workflow runs per repo via `gh`, builds Symphony task
 * payloads, dedupes, and either prints (default --dry-run) or upserts
 * tasks via the existing Foundry CLI session.
 *
 * Goals:
 *   - Replace manual sweeps that look at GitHub + Cloudflare for each project.
 *   - Stay safe by default; dry-run is the default mode.
 *   - Keep parsing/dedupe/payload generation pure for cheap unit tests
 *     (see scripts/lib/fleet-failure-importer.mjs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  buildTaskPayloads,
  diffPayloadsAgainstTasks,
  loadFleetManifest,
  parseGhRunList,
  buildCurrentFailuresFromRuns,
} from './lib/fleet-failure-importer.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DEFAULT_MANIFEST = path.join(ROOT, 'foundry.projects.json');
const DEFAULT_LIMIT = 5;
const DEFAULT_RUN_LIMIT = 50;

function parseArgs(argv) {
  const args = {
    dryRun: true,
    write: false,
    limit: DEFAULT_LIMIT,
    runLimit: DEFAULT_RUN_LIMIT,
    project: null,
    branch: process.env.FLEET_FAIL_BRANCH || 'main',
    allBranches: false,
    manifest: DEFAULT_MANIFEST,
    ghCommand: process.env.FLEET_FAIL_GH_CMD || 'gh',
    json: false,
    verbose: Boolean(process.env.FLEET_FAIL_DEBUG),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--write') {
      args.write = true;
      args.dryRun = false;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
      args.write = false;
    } else if (arg === '--json') {
      args.json = true;
    } else if (arg === '--limit') {
      args.limit = Number.parseInt(argv[++i] ?? '', 10) || DEFAULT_LIMIT;
    } else if (arg === '--run-limit') {
      args.runLimit = Number.parseInt(argv[++i] ?? '', 10) || DEFAULT_RUN_LIMIT;
    } else if (arg === '--project') {
      args.project = argv[++i] ?? null;
    } else if (arg === '--branch') {
      args.branch = argv[++i] ?? 'main';
      args.allBranches = false;
    } else if (arg === '--all-branches') {
      args.allBranches = true;
    } else if (arg === '--manifest') {
      args.manifest = argv[++i] ?? DEFAULT_MANIFEST;
    } else if (arg === '--gh') {
      args.ghCommand = argv[++i] ?? 'gh';
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--verbose') {
      args.verbose = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Fleet failure importer

Usage:
  node scripts/fleet-failure-import.mjs [options]

Options:
  --dry-run              Default. Print task payloads without writing.
  --write                Upsert tasks via Foundry CLI (skips existing titles).
  --limit N              Max projects to scan (default ${DEFAULT_LIMIT}).
  --run-limit N          Max recent runs per repo (default ${DEFAULT_RUN_LIMIT}).
  --project SLUG         Limit scan to a single project slug.
  --branch NAME          Branch to scan (default main).
  --all-branches         Scan all branches instead of the configured branch.
  --manifest PATH        Override fleet manifest path.
  --gh CMD               Override gh binary (used in tests).
  --json                 Emit machine-readable JSON instead of pretty text.
  --verbose              Log every shell-out and parsed run.
`);
}

function readManifest(manifestPath) {
  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return loadFleetManifest(raw);
}

function ghRunList(args, repo) {
  const cmdParts = args.ghCommand.split(/\s+/).filter(Boolean);
  const command = cmdParts[0];
  const baseArgs = [
    ...cmdParts.slice(1),
    'run',
    'list',
    '--repo',
    repo,
    '--limit',
    String(args.runLimit),
    '--json',
    'databaseId,name,conclusion,status,headBranch,headSha,event,createdAt,url,displayTitle,workflowDatabaseId,workflowName',
  ];
  if (!args.allBranches && args.branch) {
    baseArgs.push('--branch', args.branch);
  }
  if (args.verbose) console.error(`[fleet-fail] ${command} ${baseArgs.join(' ')}`);
  const result = spawnSync(command, baseArgs, { encoding: 'utf8' });
  if (result.error) {
    console.error(`[fleet-fail] ${repo}: ${result.error.message}`);
    return [];
  }
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || '').trim();
    console.error(`[fleet-fail] ${repo}: gh exit ${result.status} - ${err}`);
    return [];
  }
  return parseGhRunList(result.stdout);
}

function gatherFailures(args, projects) {
  const failures = [];
  for (const project of projects) {
    const runs = ghRunList(args, project.repo);
    failures.push(...buildCurrentFailuresFromRuns(project, runs));
  }
  return failures;
}

function loadExistingTasks() {
  const cachePath = path.join(ROOT, '.symphony', 'tasks.json');
  try {
    const raw = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    return Array.isArray(raw?.tasks) ? raw.tasks : [];
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
    { encoding: 'utf8', stdio: 'inherit' },
  );
  return cli.status === 0;
}

function printPretty({ fresh, skipped, failures }, args) {
  console.log(`Fleet failure sweep (${args.dryRun ? 'dry-run' : 'write'})`);
  console.log(`Projects scanned: ${args.scanned}`);
  console.log(`Failures found: ${failures.length}`);
  console.log(`New tasks: ${fresh.length}`);
  console.log(`Already tracked: ${skipped.length}`);
  if (fresh.length === 0 && skipped.length === 0) return;
  for (const payload of fresh) {
    console.log('');
    console.log(`+ ${payload.title} [${payload.priority}]`);
    console.log(payload.description.split('\n').map((line) => `  ${line}`).join('\n'));
  }
  if (skipped.length) {
    console.log('');
    console.log('Already tracked:');
    for (const entry of skipped) {
      console.log(`  - ${entry.payload.title}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const allProjects = readManifest(args.manifest);
  const filtered = args.project
    ? allProjects.filter((p) => p.slug === args.project)
    : allProjects.slice(0, args.limit);
  args.scanned = filtered.length;

  const failures = gatherFailures(args, filtered);
  const payloads = buildTaskPayloads(failures);
  const existingTasks = loadExistingTasks();
  const { fresh, skipped } = diffPayloadsAgainstTasks(payloads, existingTasks);

  const summary = { dryRun: args.dryRun, scanned: filtered.length, failures, fresh, skipped };

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printPretty({ fresh, skipped, failures }, args);
  }

  if (args.dryRun || fresh.length === 0) return;

  let written = 0;
  for (const payload of fresh) {
    const ok = upsertViaSymphony(payload);
    if (ok) written += 1;
  }
  if (!args.json) console.log(`\nUpserted ${written}/${fresh.length} tasks via Symphony.`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  main().catch((error) => {
    console.error(error.stack ?? error.message ?? error);
    process.exit(1);
  });
}
