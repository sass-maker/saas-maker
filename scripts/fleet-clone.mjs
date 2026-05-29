#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DEFAULT_MANIFEST = path.join(ROOT, 'foundry.projects.json');
const DEFAULT_FLEET_ROOT = path.resolve(ROOT, '..');

function parseArgs(argv) {
  const args = {
    manifest: DEFAULT_MANIFEST,
    fleetRoot: DEFAULT_FLEET_ROOT,
    dryRun: false,
    pull: false,
    https: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') continue;
    else if (arg === '--manifest') args.manifest = path.resolve(argv[++i] ?? DEFAULT_MANIFEST);
    else if (arg === '--fleet-root') args.fleetRoot = path.resolve(argv[++i] ?? DEFAULT_FLEET_ROOT);
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--pull') args.pull = true;
    else if (arg === '--https') args.https = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Fleet clone bootstrap

Usage:
  pnpm fleet:clone -- --dry-run
  pnpm fleet:clone
  pnpm fleet:clone -- --https
  pnpm fleet:clone -- --pull

Options:
  --manifest PATH    Project manifest, default foundry.projects.json.
  --fleet-root PATH  Parent folder for project checkouts, default repo parent.
  --dry-run          Print actions without cloning or pulling.
  --https            Convert git@github.com:owner/repo.git URLs to HTTPS.
  --pull             For existing git repos, run git pull --ff-only.
`);
}

function readManifest(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function toHttpsUrl(url) {
  const match = /^git@github\.com:([^/]+)\/(.+)$/.exec(url);
  if (!match) return url;
  return `https://github.com/${match[1]}/${match[2]}`;
}

function run(command, args, options) {
  if (options.dryRun) {
    console.log(`dry-run: ${command} ${args.map(shellQuote).join(' ')}`);
    return { status: 0 };
  }

  return spawnSync(command, args, {
    cwd: options.cwd,
    stdio: 'inherit',
    env: process.env,
  });
}

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:@=-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function isGitRepo(dir) {
  return fs.existsSync(path.join(dir, '.git'));
}

const args = parseArgs(process.argv.slice(2));
const manifest = readManifest(args.manifest);
fs.mkdirSync(args.fleetRoot, { recursive: true });

const results = [];
for (const [slug, project] of Object.entries(manifest)) {
  const target = path.join(args.fleetRoot, slug);
  const url = args.https ? toHttpsUrl(project.url) : project.url;

  if (fs.existsSync(target)) {
    if (!isGitRepo(target)) {
      results.push({ slug, status: 'exists-non-git', target });
      console.log(`${slug}: exists but is not a git repo: ${target}`);
      continue;
    }

    if (args.pull) {
      console.log(`${slug}: pulling existing checkout`);
      const result = run('git', ['pull', '--ff-only'], { cwd: target, dryRun: args.dryRun });
      results.push({ slug, status: result.status === 0 ? 'pulled' : 'pull-failed', target });
      if (result.status !== 0) process.exitCode = 1;
    } else {
      results.push({ slug, status: 'exists', target });
      console.log(`${slug}: exists`);
    }
    continue;
  }

  console.log(`${slug}: cloning ${url}`);
  const result = run('git', ['clone', url, target], { cwd: args.fleetRoot, dryRun: args.dryRun });
  results.push({ slug, status: result.status === 0 ? 'cloned' : 'clone-failed', target });
  if (result.status !== 0) process.exitCode = 1;
}

const summary = results.reduce((acc, result) => {
  acc[result.status] = (acc[result.status] ?? 0) + 1;
  return acc;
}, {});

console.log('\nSummary');
for (const [status, count] of Object.entries(summary)) {
  console.log(`- ${status}: ${count}`);
}
