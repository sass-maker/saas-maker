import { createProjectResolver } from './marketing-program.mjs';

export function buildMarketingDryRun(snapshot, tasks, registry) {
  if (!snapshot?.totals || !Array.isArray(snapshot.projects) || !Array.isArray(tasks)) {
    throw new TypeError('snapshot projects/totals and tasks are required');
  }
  const canonicalize = createProjectResolver(registry);
  const openTasks = tasks.filter((task) => !['done', 'closed', 'cancelled'].includes(task?.status));
  const taskCounts = new Map();
  for (const task of openTasks) {
    const slug = canonicalize(task?.project_slug);
    taskCounts.set(slug, (taskCounts.get(slug) ?? 0) + 1);
  }
  const globalBlocked = snapshot.totals.reviewDebt >= registry.defaults.globalReviewDebtCeiling;
  const focus = registry.focusSet.map((slug) => {
    const project = snapshot.projects.find((entry) => entry.slug === slug);
    if (!project) throw new Error(`snapshot missing focus project: ${slug}`);
    let decision = 'eligible';
    if (globalBlocked) decision = 'blocked_global_review_debt';
    else if (project.reviewDebt >= registry.defaults.focusReviewDebtCeiling) decision = 'blocked_focus_review_debt';
    else if ((taskCounts.get(slug) ?? 0) > 0) decision = 'blocked_open_backlog';
    else if (project.freshness === 'fresh') decision = 'blocked_recent_experiment';
    return {
      slug,
      decision,
      reviewDebt: project.reviewDebt,
      openTaskCount: taskCounts.get(slug) ?? 0,
      freshness: project.freshness,
      nextAction: project.nextAction,
    };
  });
  return Object.freeze({
    schema: 'fleet.marketing-dry-run.v1',
    generatedAt: snapshot.generatedAt,
    dryRun: true,
    queueWrites: 0,
    backlog: {
      openTaskCount: openTasks.length,
      reviewDebt: snapshot.totals.reviewDebt,
      globalReviewDebtCeiling: registry.defaults.globalReviewDebtCeiling,
    },
    focus,
    eligibleCount: focus.filter((entry) => entry.decision === 'eligible').length,
  });
}
