#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import {
  buildNormalizationPlan,
  summarizeNormalizationPlan,
} from './lib/fleet-weekly-normalizer.mjs';
import { loadFleetManifest } from './lib/fleet-failure-importer.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DEFAULT_MANIFEST = path.join(ROOT, 'foundry.projects.json');
const DEFAULT_FLEET_ROOT = path.resolve(ROOT, '..');

function parseArgs(argv) {
  const args = {
    write: false,
    json: false,
    manifest: DEFAULT_MANIFEST,
    fleetRoot: DEFAULT_FLEET_ROOT,
    project: null,
    nodeVersion: '22',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--write') args.write = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--manifest') args.manifest = argv[++i] ?? DEFAULT_MANIFEST;
    else if (arg === '--fleet-root') args.fleetRoot = path.resolve(argv[++i] ?? DEFAULT_FLEET_ROOT);
    else if (arg === '--project') args.project = argv[++i] ?? null;
    else if (arg === '--node-version') args.nodeVersion = argv[++i] ?? '22';
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Fleet weekly workflow normalizer

Usage:
  node scripts/fleet-weekly-normalize.mjs [options]

Options:
  --write                Rewrite drifted/missing weekly workflows.
  --json                 Emit machine-readable JSON.
  --manifest PATH        Override fleet manifest path.
  --fleet-root PATH      Override local fleet root path.
  --project SLUG         Limit to one project.
  --node-version VERSION Node version passed to the reusable workflow.
`);
}

function readProjects(manifestPath, projectSlug) {
  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const projects = loadFleetManifest(raw);
  return projectSlug ? projects.filter((project) => project.slug === projectSlug) : projects;
}

function readExistingWorkflows(projects, fleetRoot) {
  const workflows = new Map();
  for (const project of projects) {
    const workflowPath = path.join(fleetRoot, project.slug, '.github', 'workflows', 'weekly.yml');
    try {
      workflows.set(project.slug, fs.readFileSync(workflowPath, 'utf8'));
    } catch {
      workflows.set(project.slug, null);
    }
  }
  return workflows;
}

function writePlan(plan) {
  for (const entry of plan) {
    if (entry.status === 'canonical') continue;
    fs.mkdirSync(path.dirname(entry.workflowPath), { recursive: true });
    fs.writeFileSync(entry.workflowPath, entry.expected);
  }
}

function printPretty(plan, summary, write) {
  console.log(`Fleet weekly workflow ${write ? 'normalization' : 'check'}`);
  console.log(`Canonical: ${summary.canonical}`);
  console.log(`Drifted: ${summary.drifted}`);
  console.log(`Missing: ${summary.missing}`);

  for (const entry of plan) {
    if (entry.status === 'canonical') continue;
    console.log(
      `${write ? 'wrote' : 'needs update'}\t${entry.status}\t${entry.slug}\t${entry.workflowPath}`
    );
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const projects = readProjects(args.manifest, args.project);
  const existingWorkflows = readExistingWorkflows(projects, args.fleetRoot);
  const plan = buildNormalizationPlan({
    projects,
    fleetRoot: args.fleetRoot,
    existingWorkflows,
    options: { nodeVersion: args.nodeVersion },
  });
  const summary = summarizeNormalizationPlan(plan);

  if (args.write) writePlan(plan);

  if (args.json) {
    console.log(JSON.stringify({ write: args.write, summary, plan }, null, 2));
  } else {
    printPretty(plan, summary, args.write);
  }
}

main();
