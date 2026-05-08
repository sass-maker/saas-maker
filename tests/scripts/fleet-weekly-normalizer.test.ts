import { describe, expect, it } from 'vitest';

import {
  buildNormalizationPlan,
  buildWeeklyWorkflow,
  isCanonicalWeeklyWorkflow,
  summarizeNormalizationPlan,
} from '../../scripts/lib/fleet-weekly-normalizer.mjs';

describe('buildWeeklyWorkflow', () => {
  it('builds the self-contained weekly workflow', () => {
    const workflow = buildWeeklyWorkflow();

    expect(workflow).toContain('runs-on: ubuntu-latest');
    expect(workflow).toContain('run_script lint');
    expect(workflow).toContain('corepack install');
    expect(workflow).toContain('pnpm install --frozen-lockfile --ignore-scripts');
    expect(workflow).toContain("node-version: '22'");
  });

  it('allows node version override', () => {
    expect(buildWeeklyWorkflow({ nodeVersion: '20' })).toContain("node-version: '20'");
  });
});

describe('isCanonicalWeeklyWorkflow', () => {
  it('accepts exact generated workflow content', () => {
    expect(isCanonicalWeeklyWorkflow(buildWeeklyWorkflow())).toBe(true);
  });

  it('rejects hand-written weekly workflows', () => {
    expect(isCanonicalWeeklyWorkflow('name: Weekly\njobs:\n  test:\n    runs-on: ubuntu-latest\n')).toBe(false);
  });
});

describe('buildNormalizationPlan', () => {
  it('marks canonical, drifted, and missing workflows', () => {
    const projects = [{ slug: 'alpha' }, { slug: 'bravo' }, { slug: 'charlie' }];
    const existing = new Map<string, string | null>([
      ['alpha', buildWeeklyWorkflow()],
      ['bravo', 'name: custom\n'],
      ['charlie', null],
    ]);

    const plan = buildNormalizationPlan({
      projects,
      fleetRoot: '/fleet',
      existingWorkflows: existing,
    });

    expect(plan.map((entry) => [entry.slug, entry.status])).toEqual([
      ['alpha', 'canonical'],
      ['bravo', 'drifted'],
      ['charlie', 'missing'],
    ]);
    expect(summarizeNormalizationPlan(plan)).toEqual({
      canonical: 1,
      drifted: 1,
      missing: 1,
    });
  });
});
