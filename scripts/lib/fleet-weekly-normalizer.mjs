const DEFAULT_REUSABLE_WORKFLOW =
  'sarthakagrawal927/saas-maker/.github/workflows/foundry-weekly.yml@main';

export function buildWeeklyWorkflow({
  reusableWorkflow = DEFAULT_REUSABLE_WORKFLOW,
  nodeVersion = '22',
} = {}) {
  return `name: Weekly Quality Check
on:
  schedule:
    - cron: '0 9 * * 1'
  workflow_dispatch:

jobs:
  foundry-weekly:
    uses: ${reusableWorkflow}
    with:
      node-version: '${nodeVersion}'
`;
}

export function normalizeWorkflowContent(content) {
  return String(content ?? '').replace(/\r\n/g, '\n').trimEnd() + '\n';
}

export function isCanonicalWeeklyWorkflow(content, options = {}) {
  return normalizeWorkflowContent(content) === buildWeeklyWorkflow(options);
}

export function projectRepoPath(fleetRoot, slug) {
  if (!fleetRoot || !slug) return null;
  return `${fleetRoot.replace(/\/$/, '')}/${slug}`;
}

export function buildNormalizationPlan({
  projects,
  fleetRoot,
  existingWorkflows = new Map(),
  options = {},
}) {
  if (!Array.isArray(projects)) return [];
  const expected = buildWeeklyWorkflow(options);

  return projects.map((project) => {
    const slug = project.slug ?? project;
    const repoPath = project.path ?? projectRepoPath(fleetRoot, slug);
    const workflowPath = `${repoPath}/.github/workflows/weekly.yml`;
    const existing = existingWorkflows.get(slug) ?? null;
    const status = existing === null
      ? 'missing'
      : isCanonicalWeeklyWorkflow(existing, options)
        ? 'canonical'
        : 'drifted';

    return {
      slug,
      repoPath,
      workflowPath,
      status,
      expected,
    };
  });
}

export function summarizeNormalizationPlan(plan) {
  const counts = { canonical: 0, drifted: 0, missing: 0 };
  for (const entry of plan) {
    if (entry.status in counts) counts[entry.status] += 1;
  }
  return counts;
}

export { DEFAULT_REUSABLE_WORKFLOW };
