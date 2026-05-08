// Pure helpers shared by scripts/symphony-local.mjs and its tests.

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

export function taskRank(task) {
  return PRIORITY_RANK[task.priority] ?? PRIORITY_RANK.medium;
}

export function normalizeDependencies(task) {
  const raw = task?.dependencies;
  if (Array.isArray(raw)) return raw.filter((id) => typeof id === 'string' && id);
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string' && id) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function isTaskBlocked(task, tasks) {
  const deps = normalizeDependencies(task);
  if (deps.length === 0) return false;
  const byId = tasks instanceof Map ? tasks : new Map(tasks.map((t) => [t.id, t]));
  return deps.some((id) => {
    const prereq = byId.get(id);
    return !prereq || prereq.status !== 'done';
  });
}

export function annotateTasks(tasks) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  return tasks.map((task) => ({ ...task, blocked: isTaskBlocked(task, byId) }));
}

function compareTasks(a, b) {
  const priorityDelta = taskRank(a) - taskRank(b);
  if (priorityDelta !== 0) return priorityDelta;
  return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));
}

export function sortTasksRunnableFirst(tasks) {
  const annotated = annotateTasks(tasks);
  return annotated.sort((a, b) => {
    if (a.blocked !== b.blocked) return a.blocked ? 1 : -1;
    return compareTasks(a, b);
  });
}

export function findNextTask(tasks, options = {}) {
  const status = options.status ?? 'todo';
  const project = options.project ?? null;
  const annotated = annotateTasks(tasks);
  const candidates = annotated
    .filter((task) => task.status === status)
    .filter((task) => !project || task.project_slug === project)
    .filter((task) => !(status === 'todo' && task.blocked))
    .sort(compareTasks);

  if (candidates.length === 0) {
    const projectHint = project ? ` for project ${project}` : '';
    const blockedCount = annotated.filter((task) => task.status === status && task.blocked).length;
    const blockedHint = status === 'todo' && blockedCount > 0 ? ` (${blockedCount} blocked by unfinished prerequisites)` : '';
    throw new Error(`No runnable ${status} tasks available${projectHint}${blockedHint}.`);
  }
  return candidates[0];
}
