import { describe, expect, it } from 'vitest';
import {
  buildTaskPassSummary,
  extractReadmeTaskLog,
  formatTaskPassSummary,
  titleSimilarity,
} from '../../scripts/lib/symphony-reporting.mjs';

describe('Symphony reporting helpers', () => {
  it('extracts Active AI README task log rows', () => {
    const entries = extractReadmeTaskLog(`
<!-- ACTIVE-AI-TASK-LOG:START -->
| Task | Status | Priority | Updated |
| --- | --- | --- | --- |
| \`abc12345\` Improve checkout empty state | done | high | 2026-05-26 |
<!-- ACTIVE-AI-TASK-LOG:END -->
`);

    expect(entries).toEqual([
      {
        id: 'abc12345',
        title: 'Improve checkout empty state',
        status: 'done',
        priority: 'high',
        updated_at: '2026-05-26',
      },
    ]);
  });

  it('scores similar task titles high enough for duplicate warnings', () => {
    expect(
      titleSimilarity('Improve checkout empty state copy', 'Improve checkout empty state')
    ).toBeGreaterThanOrEqual(0.75);
  });

  it('summarizes tasks by project and changelog coverage', () => {
    const summary = buildTaskPassSummary([
      {
        id: '1',
        project_slug: 'reader',
        status: 'done',
        task_type: 'feature',
        has_changelog: true,
        updated_at: '2026-05-26T00:00:00Z',
      },
      {
        id: '2',
        project_slug: 'reader',
        status: 'done',
        task_type: 'bug',
        has_changelog: false,
        updated_at: '2026-05-26T00:00:00Z',
      },
      {
        id: '3',
        project_slug: 'saas-maker',
        status: 'todo',
        task_type: 'chore',
        has_changelog: false,
        updated_at: '2026-05-26T00:00:00Z',
      },
    ]);

    expect(summary.done).toBe(2);
    expect(summary.product_done_without_changelog).toBe(1);
    expect(formatTaskPassSummary(summary)).toContain('reader: 2 done');
    expect(formatTaskPassSummary(summary)).toContain('changelog 1/2');
  });
});
