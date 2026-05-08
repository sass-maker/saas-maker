export function buildWeeklyWorkflow({
  nodeVersion = '22',
} = {}) {
  return `name: Weekly Quality Check
on:
  schedule:
    - cron: '0 9 * * 1'
  workflow_dispatch:

jobs:
  quality:
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '${nodeVersion}'

      - uses: pnpm/action-setup@v4
        if: hashFiles('pnpm-lock.yaml') != ''
        with:
          version: latest

      - name: Install dependencies
        run: |
          if [ -f pnpm-lock.yaml ]; then
            pnpm install --frozen-lockfile --ignore-scripts
          elif [ -f package-lock.json ]; then
            npm ci --ignore-scripts
          elif [ -f yarn.lock ]; then
            corepack enable
            yarn install --immutable
          else
            npm install --ignore-scripts
          fi

      - name: Run available quality scripts
        run: |
          run_script() {
            local script="$1"
            if node -e "const s=require('./package.json').scripts||{}; process.exit(s[process.argv[1]]?0:1)" "$script"; then
              if [ -f pnpm-lock.yaml ]; then
                pnpm run "$script"
              elif [ -f yarn.lock ]; then
                yarn "$script"
              else
                npm run "$script"
              fi
            else
              echo "No $script script"
            fi
          }

          run_script lint
          run_script typecheck
          run_script test
          run_script build
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
