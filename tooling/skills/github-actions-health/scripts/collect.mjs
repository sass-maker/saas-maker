#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const failures = new Set(['failure', 'timed_out', 'action_required', 'startup_failure']);

async function api(endpoint, paginated = false) {
  try {
    const args = ['api', ...(paginated ? ['--paginate', '--slurp'] : []), endpoint];
    const { stdout } = await exec('gh', args, { maxBuffer: 32 * 1024 * 1024, timeout: 90000 });
    return JSON.parse(stdout);
  } catch (error) {
    const status = error.stderr?.match(/HTTP (\d+)/)?.[1];
    throw new Error(`${endpoint}: ${status ? `HTTP ${status}` : 'GitHub query failed or timed out'}`);
  }
}

async function mapLimit(values, limit, mapper) {
  const results = new Array(values.length);
  let next = 0;
  async function worker() {
    while (next < values.length) {
      const index = next++;
      results[index] = await mapper(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

function compact(run) {
  if (!run) return null;
  return {
    id: run.id, status: run.status, conclusion: run.conclusion, event: run.event,
    branch: run.head_branch, sha: run.head_sha, createdAt: run.created_at,
    startedAt: run.run_started_at, updatedAt: run.updated_at, url: run.html_url,
  };
}

export function workflowConfig(source) {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => /^(?:on|"on"|'on')\s*:/.test(line));
  if (start < 0) return { triggers: [], schedules: [], configUnknown: true };
  let end = start + 1;
  while (end < lines.length && (!/^\S/.test(lines[end]) || /^#/.test(lines[end]))) end++;
  const block = lines.slice(start, end).join('\n');
  const names = ['push', 'pull_request', 'pull_request_target', 'schedule', 'workflow_dispatch',
    'workflow_call', 'workflow_run', 'release', 'check_suite', 'repository_dispatch', 'merge_group'];
  return {
    triggers: names.filter((name) => new RegExp(`\\b${name}\\b`).test(block)),
    schedules: [...block.matchAll(/cron:\s*["']([^"'\n]+)["']/g)].map((match) => match[1]),
    configUnknown: false,
  };
}

export async function collectRepository(repository, github = api) {
  const errors = [];
  async function optional(endpoint, paginated = false) {
    try { return await github(endpoint, paginated); }
    catch (error) { errors.push(error.message); return null; }
  }
  const prefix = `repos/${repository}`;
  const metadata = await optional(prefix);
  if (!metadata) return { repository, errors, workflows: [], pullRequests: [] };
  const branch = metadata.default_branch;
  const commit = await optional(`${prefix}/commits/${encodeURIComponent(branch)}`);
  if (!commit) return { repository, branch, errors, workflows: [], pullRequests: [] };
  const sha = commit.sha;
  const ongoingPages = await mapLimit(['queued', 'in_progress', 'waiting'], 2, (status) =>
    optional(`${prefix}/actions/runs?status=${status}&per_page=100`, true),
  );
  const ongoing = [...new Map(ongoingPages.flatMap((pages) =>
    (pages ?? []).flatMap((page) => page.workflow_runs ?? []),
  ).map((run) => [run.id, compact(run)])).values()];
  const [workflowPages, tree, prPages] = await Promise.all([
    optional(`${prefix}/actions/workflows?per_page=100`, true),
    optional(`${prefix}/git/trees/${sha}?recursive=1`),
    optional(`${prefix}/pulls?state=open&per_page=100`, true),
  ]);
  if (tree?.truncated) errors.push('remote Git tree truncated; workflow inventory incomplete');
  const files = new Set((tree?.tree ?? []).filter((entry) =>
    entry.type === 'blob' && /^\.github\/workflows\/[^/]+\.ya?ml$/.test(entry.path),
  ).map((entry) => entry.path));
  const listed = (workflowPages ?? []).flatMap((page) => page.workflows ?? []);
  const current = listed.filter((workflow) => files.has(workflow.path) || workflow.path.startsWith('dynamic/'));
  const unregistered = [...files].filter((path) => !listed.some((workflow) => workflow.path === path));
  const removed = listed.filter((workflow) => !current.includes(workflow)).map((workflow) => workflow.path);
  const workflows = await mapLimit(current, 2, async (workflow) => {
    let config = { triggers: [], schedules: [], configUnknown: true };
    if (files.has(workflow.path)) {
      const file = await optional(`${prefix}/contents/${workflow.path}?ref=${sha}`);
      if (file?.encoding === 'base64') config = workflowConfig(Buffer.from(file.content, 'base64').toString('utf8'));
    }
    const endpoint = `${prefix}/actions/workflows/${workflow.id}/runs`;
    const [latest, main, scheduled] = await Promise.all([
      optional(`${endpoint}?per_page=1`),
      optional(`${endpoint}?branch=${encodeURIComponent(branch)}&event=push&per_page=1`),
      config.triggers.includes('schedule') ? optional(`${endpoint}?event=schedule&per_page=1`) : null,
    ]);
    return {
      id: workflow.id, name: workflow.name, path: workflow.path, state: workflow.state,
      generated: workflow.path.startsWith('dynamic/'), ...config,
      latest: compact(latest?.workflow_runs?.[0]),
      defaultBranch: compact(main?.workflow_runs?.[0]),
      schedule: compact(scheduled?.workflow_runs?.[0]),
    };
  });
  const pullRequests = await mapLimit((prPages ?? []).flat(), 2, async (pr) => {
    const pages = await optional(`${prefix}/actions/runs?event=pull_request&head_sha=${pr.head.sha}&per_page=100`, true);
    const byWorkflow = new Map();
    for (const run of (pages ?? []).flatMap((page) => page.workflow_runs ?? [])) {
      if (!byWorkflow.has(run.workflow_id)) byWorkflow.set(run.workflow_id, compact(run));
    }
    return { number: pr.number, head: pr.head.sha, url: pr.html_url, runs: [...byWorkflow.values()] };
  });
  const problemRuns = new Map();
  for (const run of [
    ...workflows.flatMap((workflow) => [workflow.latest, workflow.defaultBranch, workflow.schedule]),
    ...pullRequests.flatMap((pr) => pr.runs),
  ]) {
    if (run && failures.has(run.conclusion)) problemRuns.set(run.id, run);
  }
  const failedJobs = await mapLimit([...problemRuns.values()], 2, async (run) => {
    const pages = await optional(`${prefix}/actions/runs/${run.id}/jobs?per_page=100`, true);
    return { runId: run.id, jobs: (pages ?? []).flatMap((page) => page.jobs ?? []).filter((job) =>
      failures.has(job.conclusion),
    ).map((job) => ({
      id: job.id, name: job.name, conclusion: job.conclusion, url: job.html_url,
      steps: (job.steps ?? []).filter((step) => failures.has(step.conclusion)).map((step) => step.name),
    })) };
  });
  return {
    repository: metadata.full_name, branch, sha, archived: metadata.archived,
    workflows, unregistered, removed, pullRequests, ongoing, failedJobs, errors,
  };
}

export function catalogRepositories(data, { includeInactive = false, includeReviewed = false } = {}) {
  const repositories = new Set();
  for (const project of data.projects) {
    if (!includeInactive && !['primary', 'active'].includes(project.lifecycle?.status)) continue;
    const match = project.repositories?.url?.match(/^https:\/\/github\.com\/([^/]+\/[^/]+?)\/?$/);
    if (match) repositories.add(match[1]);
  }
  if (includeReviewed) for (const row of data.repositoryReview?.repositories ?? []) {
    if (row.currentRepository) repositories.add(row.currentRepository);
  }
  return [...repositories];
}

async function main() {
  const args = process.argv.slice(2);
  const repositories = new Set();
  const excludes = new Set();
  let catalog;
  let includeReviewed = false;
  let includeInactive = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--catalog') catalog = args[++index];
    else if (arg === '--repo') repositories.add(args[++index]);
    else if (arg === '--exclude-repo') excludes.add(args[++index]);
    else if (arg === '--include-reviewed') includeReviewed = true;
    else if (arg === '--include-inactive') includeInactive = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (catalog) {
    const data = JSON.parse(readFileSync(catalog, 'utf8'));
    for (const repository of catalogRepositories(data, { includeInactive, includeReviewed })) repositories.add(repository);
  }
  const targets = [...repositories].filter((repo) => !excludes.has(repo)).sort();
  if (!targets.length || targets.some((repo) => !/^[\w.-]+\/[\w.-]+$/.test(repo))) {
    throw new Error('Supply --catalog PATH and/or --repo OWNER/NAME; repository names must be valid');
  }
  const observedAt = new Date().toISOString();
  const results = await mapLimit(targets, 4, async (repository) => {
    const result = await collectRepository(repository);
    process.stderr.write(`${repository}: ${result.workflows.length} current workflows, ${result.errors.length} query errors\n`);
    return result;
  });
  process.stdout.write(`${JSON.stringify({ observedAt, completedAt: new Date().toISOString(), scope: { catalog: catalog ? (includeInactive ? 'all-catalog-projects' : 'active-and-primary-projects') : null, includeReviewed, targetCount: targets.length }, excluded: [...excludes], repositories: results }, null, 2)}\n`);
  if (results.some((result) => result.errors.length || result.unregistered?.length)) process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
