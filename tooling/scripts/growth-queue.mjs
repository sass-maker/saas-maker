#!/usr/bin/env node
// Builds the recurring growth queue: every launchable Fleet project paired with
// the next directory or launch destination it has not been submitted to yet.
// The queue is a plan, not permission — promotion into an executable manifest
// follows the launch-campaign skill and its owner-approval gate.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '../..');
const DEFAULT_CATALOG = resolve(REPOSITORY_ROOT, 'catalog/projects.json');
const DIRECTORIES = resolve(REPOSITORY_ROOT, 'tooling/config/directory-submissions/directories.json');
const ACCREDITATION = resolve(REPOSITORY_ROOT, 'tooling/config/directory-submissions/accreditation-state.json');
const DEFAULT_STATE = resolve(REPOSITORY_ROOT, 'tooling/config/directory-submissions/submissions.json');

const SUBMISSION_STATES = new Set(['queued', 'submitted', 'published', 'skipped', 'rejected']);

function usage() {
  return `Usage:
  node tooling/scripts/growth-queue.mjs next [--limit N] [--project ID] [--format markdown|json]
  node tooling/scripts/growth-queue.mjs record --project ID --destination ID --state STATE [--evidence URL]
  node tooling/scripts/growth-queue.mjs coverage [--format markdown|json]

Commands:
  next       Print the next (project × destination) pairs worth submitting.
             Automatable destinations come first; manual and protected channels
             are listed separately as human-kick items.
  record     Write a submission outcome into the state ledger so the next run
             does not requeue it. --state is one of: ${[...SUBMISSION_STATES].join(', ')}.
  coverage   Per-project submission counts across the destination catalog.

Options:
  --catalog PATH    Catalog JSON (default: catalog/projects.json)
  --state-path PATH Submission ledger (default: tooling/config/directory-submissions/submissions.json)
`;
}

function parseArgs(argv) {
  const [command = 'next', ...rest] = argv;
  const options = {
    command,
    catalog: DEFAULT_CATALOG,
    statePath: DEFAULT_STATE,
    limit: 10,
    format: 'markdown',
  };
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    if (flag === '--help') return { help: true };
    const value = rest[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    if (flag === '--catalog') options.catalog = resolve(value);
    else if (flag === '--state-path') options.statePath = resolve(value);
    else if (flag === '--project') options.projectId = value;
    else if (flag === '--destination') options.destinationId = value;
    else if (flag === '--state') options.state = value;
    else if (flag === '--evidence') options.evidence = value;
    else if (flag === '--limit') options.limit = Number(value);
    else if (flag === '--format') options.format = value;
    else throw new Error(`Unknown option: ${flag}`);
    index += 1;
  }
  return options;
}

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function repositoryUrl(project) {
  const url = project?.repositories?.url ?? project?.presentation?.public?.repositoryUrl;
  if (typeof url !== 'string') return null;
  try {
    return new URL(url).hostname === 'github.com' ? url : null;
  } catch {
    return null;
  }
}

// A project is launchable when its listing is maintained and its repository is
// public — the two facts a directory reviewer checks before anything else.
function launchableProjects(catalog) {
  return (catalog?.projects ?? []).filter(
    (project) => project?.presentation?.public?.listing === 'maintained'
      && project?.repositories?.visibility === 'public'
      && repositoryUrl(project),
  );
}

function loadState(path) {
  const state = readJson(path, null);
  if (state) return state;
  return { $schema: 'fleet.growth-submissions.v1', version: 1, updated: null, submissions: [] };
}

function accreditationByPlatform(state) {
  return new Map((state?.platforms ?? []).map((platform) => [platform.id, platform]));
}

function destinationLane(directory, accreditation) {
  const platform = accreditation.get(directory.id);
  const current = platform?.currentState ?? 'seed';
  if (current === 'rejected') return 'excluded';
  if (current === 'blocked' || directory.automation === 'blocked') return 'blocked';
  if (platform?.qualityGate === 'protected' || directory.automation === 'manual') return 'human-kick';
  return 'automatable';
}

function submittedKeys(state) {
  return new Map((state.submissions ?? []).map((entry) => [`${entry.projectId}:${entry.destinationId}`, entry]));
}

function buildQueue(catalog, directories, accreditation, state) {
  const platforms = accreditationByPlatform(accreditation);
  const submitted = submittedKeys(state);
  const lanes = { automatable: [], 'human-kick': [], blocked: [], excluded: [] };
  for (const project of launchableProjects(catalog)) {
    for (const directory of directories) {
      const key = `${project.id}:${directory.id}`;
      if (submitted.has(key)) continue;
      const lane = destinationLane(directory, platforms);
      lanes[lane].push({
        projectId: project.id,
        project: project.name ?? project.id,
        repositoryUrl: repositoryUrl(project),
        destinationId: directory.id,
        destination: directory.name,
        submitUrl: directory.submitUrl,
        cost: directory.cost,
        lane,
        reason: directory.reason ?? null,
      });
    }
  }
  return lanes;
}

function renderNext(lanes, limit, format) {
  const queue = lanes.automatable.slice(0, limit);
  const humanKick = lanes['human-kick'];
  if (format === 'json') {
    return `${JSON.stringify({
      schema: 'fleet.growth-queue.v1',
      automatable: queue,
      automatableRemaining: lanes.automatable.length - queue.length,
      humanKick,
      blocked: lanes.blocked.length,
      excluded: lanes.excluded.length,
    }, null, 2)}\n`;
  }
  const lines = [
    '# Growth queue',
    '',
    `${queue.length} automatable submissions shown (${lanes.automatable.length} pending), ${humanKick.length} human-kick, ${lanes.blocked.length} blocked, ${lanes.excluded.length} excluded.`,
    '',
    '## Automatable',
    '',
  ];
  for (const item of queue) {
    lines.push(`- **${item.project}** → ${item.destination} (${item.submitUrl ?? 'no form'}) — ${item.cost}`);
  }
  if (!queue.length) lines.push('- Nothing pending.');
  lines.push('', '## Human-kick (manual or protected channels)', '');
  const byDestination = new Map();
  for (const item of humanKick) {
    const rows = byDestination.get(item.destinationId) ?? [];
    rows.push(item.project);
    byDestination.set(item.destinationId, rows);
  }
  for (const [id, projects] of byDestination) {
    lines.push(`- ${id}: ${projects.length} projects — ${projects.slice(0, 6).join(', ')}${projects.length > 6 ? '…' : ''}`);
  }
  lines.push(
    '',
    'After each real submission:',
    '  node tooling/scripts/growth-queue.mjs record --project <id> --destination <id> --state submitted --evidence <url>',
  );
  return `${lines.join('\n')}\n`;
}

function renderCoverage(catalog, directories, state, format) {
  const submitted = submittedKeys(state);
  const rows = launchableProjects(catalog).map((project) => {
    const done = directories.filter((directory) => submitted.has(`${project.id}:${directory.id}`));
    return { projectId: project.id, project: project.name ?? project.id, submitted: done.length, total: directories.length };
  });
  if (format === 'json') return `${JSON.stringify({ schema: 'fleet.growth-coverage.v1', rows }, null, 2)}\n`;
  const lines = ['# Growth coverage', '', '| Project | Submitted | Remaining |', '| --- | --- | --- |'];
  for (const row of rows) lines.push(`| ${row.project} | ${row.submitted} | ${row.total - row.submitted} |`);
  return `${lines.join('\n')}\n`;
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  process.stdout.write(usage());
  process.exit(0);
}
const catalog = readJson(options.catalog);
const directories = readJson(DIRECTORIES)?.directories ?? [];
const accreditation = readJson(ACCREDITATION);
const state = loadState(options.statePath);

if (options.command === 'record') {
  if (!options.projectId || !options.destinationId) throw new Error('record requires --project and --destination');
  if (!SUBMISSION_STATES.has(options.state)) throw new Error(`--state must be one of: ${[...SUBMISSION_STATES].join(', ')}`);
  const project = (catalog.projects ?? []).find((entry) => entry.id === options.projectId);
  if (!project) throw new Error(`unknown project: ${options.projectId}`);
  if (!directories.some((entry) => entry.id === options.destinationId)) {
    throw new Error(`unknown destination: ${options.destinationId}`);
  }
  const key = `${options.projectId}:${options.destinationId}`;
  state.submissions = (state.submissions ?? []).filter((entry) => `${entry.projectId}:${entry.destinationId}` !== key);
  state.submissions.push({
    projectId: options.projectId,
    destinationId: options.destinationId,
    state: options.state,
    evidence: options.evidence ?? null,
    recordedAt: new Date().toISOString(),
  });
  state.updated = new Date().toISOString();
  mkdirSync(dirname(options.statePath), { recursive: true });
  writeFileSync(options.statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  process.stdout.write(`Recorded ${options.projectId} → ${options.destinationId}: ${options.state}\n`);
} else if (options.command === 'next') {
  const lanes = buildQueue(catalog, directories, accreditation, state);
  for (const lane of Object.values(lanes)) {
    if (options.projectId) {
      for (let index = lane.length - 1; index >= 0; index -= 1) {
        if (lane[index].projectId !== options.projectId) lane.splice(index, 1);
      }
    }
  }
  process.stdout.write(renderNext(lanes, options.limit, options.format));
} else if (options.command === 'coverage') {
  process.stdout.write(renderCoverage(catalog, directories, state, options.format));
} else {
  throw new Error(`Unknown command: ${options.command}. Run with --help for usage.`);
}
