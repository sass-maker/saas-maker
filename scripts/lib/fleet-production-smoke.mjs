/**
 * Pure helpers for the fleet production smoke script.
 *
 * The smoke runner produces an array of "checks" describing every probe
 * (page nav + auth) it ran against a production frontend. These helpers
 * turn the failed subset into actionable Symphony task payloads, and
 * dedupe them against the cached task list so the runner does not file
 * the same broken frontend twice.
 */

const TASK_TITLE_PREFIX = '[fleet-smoke]';

const HIGH_SEVERITY_TYPES = new Set([
  'navigation',
  'navigation-exception',
  'page-text',
  'auth',
  'auth-exception',
]);

export const SMOKE_FAILURE_PRIORITY = {
  high: 'high',
  medium: 'medium',
};

export function isFailedCheck(check) {
  return Boolean(check) && check.ok === false;
}

function topErrors(errors, max = 5) {
  if (!Array.isArray(errors)) return [];
  return errors.slice(0, max).map((error) => ({
    type: error?.type ?? 'unknown',
    message: typeof error?.message === 'string' ? error.message : null,
    status: typeof error?.status === 'number' ? error.status : null,
    url: typeof error?.url === 'string' ? error.url : null,
    resourceType: typeof error?.resourceType === 'string' ? error.resourceType : null,
    interaction: typeof error?.interaction === 'string' ? error.interaction : null,
  }));
}

function errorTypeCounts(errors) {
  const counts = {};
  if (!Array.isArray(errors)) return counts;
  for (const error of errors) {
    const type = error?.type ?? 'unknown';
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return counts;
}

function inferPriority(errors) {
  if (!Array.isArray(errors)) return SMOKE_FAILURE_PRIORITY.medium;
  return errors.some((error) => HIGH_SEVERITY_TYPES.has(error?.type))
    ? SMOKE_FAILURE_PRIORITY.high
    : SMOKE_FAILURE_PRIORITY.medium;
}

export function buildSmokeFailure(check) {
  if (!isFailedCheck(check)) return null;
  const kind = check.kind ?? 'page';
  return {
    project: check.project,
    label: check.label,
    kind,
    url: check.url ?? null,
    status: typeof check.status === 'number' ? check.status : null,
    errorCount: Array.isArray(check.errors) ? check.errors.length : 0,
    errorTypes: errorTypeCounts(check.errors),
    topErrors: topErrors(check.errors),
    priority: inferPriority(check.errors),
  };
}

export function buildSmokeFailures(checks) {
  if (!Array.isArray(checks)) return [];
  const failures = [];
  for (const check of checks) {
    const failure = buildSmokeFailure(check);
    if (failure) failures.push(failure);
  }
  return failures.sort((a, b) => {
    if (a.project !== b.project) return a.project.localeCompare(b.project);
    return a.label.localeCompare(b.label);
  });
}

export function failureKey(failure) {
  if (!failure) return '';
  return `${failure.project}::${failure.kind}:${failure.label}`;
}

export function buildSmokeTaskTitle(failure) {
  return `${TASK_TITLE_PREFIX} ${failure.project}/${failure.label}`;
}

export function buildSmokeTaskDescription(failure, { generatedAt } = {}) {
  const lines = [];
  lines.push('Auto-imported from fleet production smoke sweep.');
  lines.push('');
  lines.push(`Project: ${failure.project}`);
  lines.push(`Surface: ${failure.kind}:${failure.label}`);
  if (failure.url) lines.push(`URL: ${failure.url}`);
  if (failure.status !== null && failure.status !== undefined) lines.push(`HTTP status: ${failure.status}`);
  if (generatedAt) lines.push(`Detected at: ${generatedAt}`);
  lines.push('');
  lines.push(`Errors observed (${failure.errorCount}):`);
  for (const [type, count] of Object.entries(failure.errorTypes)) {
    lines.push(`- ${type}: ${count}`);
  }
  if (failure.topErrors.length) {
    lines.push('');
    lines.push('Top errors:');
    for (const error of failure.topErrors) {
      const parts = [];
      if (error.message) parts.push(error.message);
      if (error.status) parts.push(`status ${error.status}`);
      if (error.resourceType) parts.push(error.resourceType);
      if (error.url) parts.push(error.url);
      if (error.interaction) parts.push(`after ${error.interaction}`);
      lines.push(`- [${error.type}] ${parts.join(' - ') || 'failed'}`);
    }
  }
  lines.push('');
  lines.push('Acceptance criteria:');
  lines.push('- Reproduce locally against the production URL or replay the smoke run.');
  lines.push('- Land a fix on the project default branch.');
  lines.push('- Re-run `pnpm run fleet:prod-smoke --project <slug>` and confirm pass.');
  lines.push('- Note root cause + prevention in the PR description.');
  return lines.join('\n');
}

export function buildSmokeTaskPayload(failure, options = {}) {
  return {
    title: buildSmokeTaskTitle(failure),
    description: buildSmokeTaskDescription(failure, options),
    project_slug: failure.project,
    priority: failure.priority,
    metadata: {
      source: 'fleet-production-smoke',
      failure_key: failureKey(failure),
      kind: failure.kind,
      label: failure.label,
      url: failure.url,
      error_types: failure.errorTypes,
    },
  };
}

export function buildSmokeTaskPayloads(failures, options = {}) {
  if (!Array.isArray(failures)) return [];
  const seen = new Map();
  for (const failure of failures) {
    if (!failure) continue;
    const key = failureKey(failure);
    if (!seen.has(key)) seen.set(key, failure);
  }
  return Array.from(seen.values()).map((failure) => buildSmokeTaskPayload(failure, options));
}

export function findExistingTask(tasks, payload) {
  if (!Array.isArray(tasks) || !payload) return null;
  const openStatuses = new Set(['todo', 'in_progress', 'blocked', 'review']);
  return (
    tasks.find((task) => {
      if (!task) return false;
      if (task.title !== payload.title) return false;
      const status = typeof task.status === 'string' ? task.status : 'todo';
      return openStatuses.has(status);
    }) ?? null
  );
}

export function diffPayloadsAgainstTasks(payloads, existingTasks) {
  const fresh = [];
  const skipped = [];
  for (const payload of payloads ?? []) {
    const existing = findExistingTask(existingTasks, payload);
    if (existing) skipped.push({ payload, existing });
    else fresh.push(payload);
  }
  return { fresh, skipped };
}

export const __testables = { TASK_TITLE_PREFIX, HIGH_SEVERITY_TYPES };
