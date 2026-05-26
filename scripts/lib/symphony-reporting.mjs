import fs from 'node:fs';

const ACTIVE_LOG_START = '<!-- ACTIVE-AI-TASK-LOG:START -->';
const ACTIVE_LOG_END = '<!-- ACTIVE-AI-TASK-LOG:END -->';
const PRODUCT_TASK_TYPES = new Set(['feature', 'bug']);

export function normalizeTaskTitle(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 2)
    .join(' ');
}

export function titleSimilarity(left, right) {
  const leftTokens = new Set(normalizeTaskTitle(left).split(' ').filter(Boolean));
  const rightTokens = new Set(normalizeTaskTitle(right).split(' ').filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }
  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

export function extractReadmeTaskLog(readmeContent) {
  const start = readmeContent.indexOf(ACTIVE_LOG_START);
  const end = readmeContent.indexOf(ACTIVE_LOG_END);
  if (start === -1 || end === -1 || end <= start) return [];
  return readmeContent
    .slice(start, end)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('| `'))
    .map((line) => {
      const columns = line.split('|').map((column) => column.trim());
      const idMatch = columns[1]?.match(/`([^`]+)`\s*(.*)$/);
      return {
        id: idMatch?.[1] ?? '',
        title: idMatch?.[2]?.trim() ?? '',
        status: columns[2] ?? '',
        priority: columns[3] ?? '',
        updated_at: columns[4] ?? '',
      };
    })
    .filter((entry) => entry.id && entry.title);
}

export function findReadmeDuplicateTaskWarnings(title, readmePath = 'README.md') {
  let readmeContent = '';
  try {
    readmeContent = fs.readFileSync(readmePath, 'utf8');
  } catch {
    return [];
  }
  return extractReadmeTaskLog(readmeContent)
    .map((entry) => ({ ...entry, similarity: titleSimilarity(title, entry.title) }))
    .filter((entry) => entry.similarity >= 0.5)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);
}

export function buildTaskPassSummary(tasks, options = {}) {
  const since = options.since ? Date.parse(options.since) : null;
  const scopedTasks = Number.isFinite(since)
    ? tasks.filter((task) => Date.parse(task.updated_at ?? task.created_at ?? '') >= since)
    : tasks;
  const projects = new Map();
  const ensureProject = (slug) => {
    const key = slug ?? 'unassigned';
    if (!projects.has(key)) {
      projects.set(key, {
        project: key,
        total: 0,
        todo: 0,
        in_progress: 0,
        done: 0,
        product_done: 0,
        product_done_with_changelog: 0,
        product_done_without_changelog: 0,
      });
    }
    return projects.get(key);
  };

  for (const task of scopedTasks) {
    const bucket = ensureProject(task.project_slug);
    bucket.total += 1;
    if (task.status === 'todo') bucket.todo += 1;
    else if (task.status === 'in_progress') bucket.in_progress += 1;
    else if (task.status === 'done') bucket.done += 1;

    if (task.status === 'done' && PRODUCT_TASK_TYPES.has(task.task_type)) {
      bucket.product_done += 1;
      if (task.has_changelog) bucket.product_done_with_changelog += 1;
      else bucket.product_done_without_changelog += 1;
    }
  }

  const projectSummaries = Array.from(projects.values()).sort((a, b) => {
    if (b.done !== a.done) return b.done - a.done;
    return a.project.localeCompare(b.project);
  });

  return {
    since: options.since ?? null,
    total: scopedTasks.length,
    done: scopedTasks.filter((task) => task.status === 'done').length,
    todo: scopedTasks.filter((task) => task.status === 'todo').length,
    in_progress: scopedTasks.filter((task) => task.status === 'in_progress').length,
    product_done_without_changelog: projectSummaries.reduce((sum, project) => sum + project.product_done_without_changelog, 0),
    projects: projectSummaries,
  };
}

export function formatTaskPassSummary(summary) {
  const scope = summary.since ? ` since ${summary.since}` : '';
  const lines = [
    `Task pass summary${scope}`,
    `Total: ${summary.total} | Done: ${summary.done} | In progress: ${summary.in_progress} | Todo: ${summary.todo}`,
    `Product done without changelog: ${summary.product_done_without_changelog}`,
    '',
  ];

  for (const project of summary.projects) {
    lines.push(
      `- ${project.project}: ${project.done} done, ${project.in_progress} in progress, ${project.todo} todo` +
      ` | changelog ${project.product_done_with_changelog}/${project.product_done}`
    );
  }

  return lines.join('\n').trimEnd();
}
