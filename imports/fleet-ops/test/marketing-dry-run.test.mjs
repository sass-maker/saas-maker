import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMarketingDryRun } from '../lib/marketing-dry-run.mjs';

const registry = {
  defaults: { globalReviewDebtCeiling: 5, focusReviewDebtCeiling: 3 },
  focusSet: ['pace', 'reel-pipeline'],
  projects: [
    { slug: 'pace', aliases: [] },
    { slug: 'reel-pipeline', aliases: ['reel'] },
  ],
};

test('dry run reports aggregate backlog decisions and guarantees zero writes', () => {
  const result = buildMarketingDryRun({
    generatedAt: '2026-07-13T00:00:00.000Z',
    totals: { reviewDebt: 2 },
    projects: [
      { slug: 'pace', reviewDebt: 0, freshness: 'stale', nextAction: 'Propose' },
      { slug: 'reel-pipeline', reviewDebt: 2, freshness: 'fresh', nextAction: 'Review' },
    ],
  }, [
    { project_slug: 'pace', status: 'done', id: 'hidden' },
    { project_slug: 'reel', status: 'todo', title: 'hidden content' },
  ], registry);
  assert.equal(result.queueWrites, 0);
  assert.equal(result.focus[0].decision, 'eligible');
  assert.equal(result.focus[1].decision, 'blocked_open_backlog');
  assert.equal(JSON.stringify(result).includes('hidden'), false);
});

test('global review debt blocks every focus program', () => {
  const result = buildMarketingDryRun({
    generatedAt: '2026-07-13T00:00:00.000Z', totals: { reviewDebt: 5 },
    projects: registry.focusSet.map((slug) => ({ slug, reviewDebt: 0, freshness: 'stale', nextAction: 'Propose' })),
  }, [], registry);
  assert.ok(result.focus.every((entry) => entry.decision === 'blocked_global_review_debt'));
});
