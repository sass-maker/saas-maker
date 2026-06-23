/**
 * Pure functions for the fleet failure importer.
 *
 * Side-effect-free helpers live here so they can be unit tested without
 * shelling out or hitting the network. The CLI wrapper in
 * `scripts/fleet-failure-import.mjs` orchestrates the actual gh / wrangler
 * commands and pipes raw output into these helpers.
 */

const TASK_TITLE_PREFIX = '[fleet-failure]';
const DEFAULT_IGNORED_WORKFLOW_NAMES = new Set(['Foundry Weekly Quality Check (reusable)']);

export const FAILURE_PRIORITY = {
  workflow: 'high',
  deployment: 'high',
  cron: 'medium',
};

export function extractRepoFromGitUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim().replace(/\.git$/, '');
  const sshMatch = trimmed.match(/^git@[^:]+:([^/]+)\/([^/]+)$/);
  if (sshMatch) return `${sshMatch[1]}/${sshMatch[2]}`;
  const httpsMatch = trimmed.match(/^https?:\/\/[^/]+\/([^/]+)\/([^/]+)$/);
  if (httpsMatch) return `${httpsMatch[1]}/${httpsMatch[2]}`;
  return null;
}

export function loadFleetManifest(rawJson) {
  if (!rawJson || typeof rawJson !== 'object') return [];
  return Object.entries(rawJson)
    .map(([slug, value]) => ({
      slug,
      desc: value?.desc ?? '',
      url: value?.url ?? '',
      repo: extractRepoFromGitUrl(value?.url ?? ''),
    }))
    .filter((entry) => entry.repo);
}

export function parseGhRunList(stdout) {
  if (!stdout || typeof stdout !== 'string') return [];
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((run) => run && typeof run === 'object')
    .map((run) => ({
      databaseId: run.databaseId ?? run.id ?? null,
      name: run.name ?? run.workflowName ?? 'workflow',
      conclusion: run.conclusion ?? null,
      status: run.status ?? null,
      headBranch: run.headBranch ?? run.head_branch ?? null,
      headSha: run.headSha ?? run.head_sha ?? null,
      event: run.event ?? null,
      createdAt: run.createdAt ?? run.created_at ?? null,
      url: run.url ?? null,
      displayTitle: run.displayTitle ?? run.display_title ?? null,
      workflowDatabaseId: run.workflowDatabaseId ?? run.workflow_database_id ?? null,
      workflowName: run.workflowName ?? run.workflow_name ?? null,
    }));
}

export function isFailedRun(run) {
  if (!run) return false;
  const failed = new Set(['failure', 'timed_out', 'startup_failure', 'cancelled']);
  return failed.has(String(run.conclusion ?? '').toLowerCase());
}

export function buildFailureFromRun(project, run) {
  if (!project || !run) return null;
  const surface = `workflow:${workflowSurfaceLabel(run)}`;
  return {
    project: project.slug,
    repo: project.repo,
    surface,
    kind: 'workflow',
    title: run.name,
    conclusion: run.conclusion ?? 'failure',
    headBranch: run.headBranch ?? null,
    headSha: run.headSha ?? null,
    event: run.event ?? null,
    createdAt: run.createdAt ?? null,
    url: run.url ?? null,
    displayTitle: run.displayTitle ?? null,
  };
}

function workflowSurfaceLabel(run) {
  return run.workflowName ?? run.name ?? 'workflow';
}

function runSurface(run) {
  return run.workflowDatabaseId
    ? `workflow-id:${run.workflowDatabaseId}`
    : `workflow:${workflowSurfaceLabel(run)}`;
}

function runTime(run) {
  return Date.parse(run?.createdAt ?? '') || 0;
}

export function buildCurrentFailuresFromRuns(project, runs) {
  if (!project || !Array.isArray(runs)) return [];
  const newestBySurface = new Map();
  for (const run of runs) {
    if (isIgnoredWorkflowRun(run)) continue;
    const surface = runSurface(run);
    const existing = newestBySurface.get(surface);
    if (!existing || runTime(run) > runTime(existing)) {
      newestBySurface.set(surface, run);
    }
  }
  return Array.from(newestBySurface.values())
    .filter(isFailedRun)
    .map((run) => buildFailureFromRun(project, run))
    .filter(Boolean);
}

export function isIgnoredWorkflowRun(run) {
  const names = [run?.workflowName, run?.name].filter(Boolean);
  return names.some((name) => DEFAULT_IGNORED_WORKFLOW_NAMES.has(String(name)));
}

export function buildFailureFromDeployment(project, deployment) {
  if (!project || !deployment) return null;
  const surface = `deployment:${deployment.environment ?? deployment.target ?? 'production'}`;
  return {
    project: project.slug,
    repo: project.repo,
    surface,
    kind: 'deployment',
    title: deployment.title ?? `${deployment.target ?? 'deploy'} failed`,
    conclusion: deployment.status ?? 'failure',
    headBranch: deployment.branch ?? null,
    headSha: deployment.sha ?? null,
    event: 'deploy',
    createdAt: deployment.createdAt ?? null,
    url: deployment.url ?? null,
    displayTitle: deployment.title ?? null,
  };
}

export function failureKey(failure) {
  if (!failure) return '';
  return `${failure.project}::${failure.surface}`;
}

export function dedupeFailures(failures) {
  const byKey = new Map();
  for (const failure of failures) {
    if (!failure) continue;
    const key = failureKey(failure);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, failure);
      continue;
    }
    const existingTime = Date.parse(existing.createdAt ?? '') || 0;
    const incomingTime = Date.parse(failure.createdAt ?? '') || 0;
    if (incomingTime > existingTime) byKey.set(key, failure);
  }
  return Array.from(byKey.values()).sort((a, b) => {
    if (a.project !== b.project) return a.project.localeCompare(b.project);
    return a.surface.localeCompare(b.surface);
  });
}

export function buildTaskTitle(failure) {
  const branch = failure.headBranch ? ` @${failure.headBranch}` : '';
  return `${TASK_TITLE_PREFIX} ${failure.project}: ${failure.surface}${branch}`;
}

export function buildTaskDescription(failure) {
  const lines = [];
  lines.push(`Auto-imported from fleet failure sweep.`);
  lines.push('');
  lines.push(`Project: ${failure.project}`);
  if (failure.repo) lines.push(`Repo: ${failure.repo}`);
  lines.push(`Surface: ${failure.surface}`);
  lines.push(`Kind: ${failure.kind}`);
  if (failure.conclusion) lines.push(`Conclusion: ${failure.conclusion}`);
  if (failure.headBranch) lines.push(`Branch: ${failure.headBranch}`);
  if (failure.headSha) lines.push(`SHA: ${failure.headSha}`);
  if (failure.event) lines.push(`Event: ${failure.event}`);
  if (failure.createdAt) lines.push(`Detected at: ${failure.createdAt}`);
  if (failure.displayTitle && failure.displayTitle !== failure.title) {
    lines.push(`Run: ${failure.displayTitle}`);
  }
  if (failure.url) lines.push(`Evidence: ${failure.url}`);
  lines.push('');
  lines.push('Acceptance criteria:');
  lines.push('- Reproduce the failure locally or via the linked run.');
  lines.push('- Land a fix on the project default branch.');
  lines.push('- Confirm the next run on the same surface is green.');
  lines.push('- Note root cause + prevention in the PR description.');
  return lines.join('\n');
}

export function buildTaskPayload(failure) {
  return {
    title: buildTaskTitle(failure),
    description: buildTaskDescription(failure),
    project_slug: failure.project,
    priority: FAILURE_PRIORITY[failure.kind] ?? 'medium',
    metadata: {
      source: 'fleet-failure-importer',
      failure_key: failureKey(failure),
      surface: failure.surface,
      kind: failure.kind,
    },
  };
}

export function buildTaskPayloads(failures) {
  return dedupeFailures(failures).map(buildTaskPayload);
}

export function findExistingTask(tasks, payload) {
  if (!Array.isArray(tasks)) return null;
  return tasks.find((task) => task && task.title === payload.title) ?? null;
}

export function diffPayloadsAgainstTasks(payloads, existingTasks) {
  const fresh = [];
  const skipped = [];
  for (const payload of payloads) {
    const existing = findExistingTask(existingTasks, payload);
    if (existing) skipped.push({ payload, existing });
    else fresh.push(payload);
  }
  return { fresh, skipped };
}

export const __testables = { TASK_TITLE_PREFIX };
