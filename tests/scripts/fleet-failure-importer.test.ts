import { describe, expect, it } from 'vitest';

import {
  buildFailureFromRun,
  buildCurrentFailuresFromRuns,
  buildTaskPayload,
  buildTaskPayloads,
  dedupeFailures,
  diffPayloadsAgainstTasks,
  extractRepoFromGitUrl,
  failureKey,
  isFailedRun,
  loadFleetManifest,
  parseGhRunList,
} from '../../scripts/lib/fleet-failure-importer.mjs';

describe('extractRepoFromGitUrl', () => {
  it('parses https git url', () => {
    expect(extractRepoFromGitUrl('https://github.com/owner/repo.git')).toBe('owner/repo');
  });

  it('parses ssh git url', () => {
    expect(extractRepoFromGitUrl('git@github.com:owner/repo.git')).toBe('owner/repo');
  });

  it('handles missing .git suffix', () => {
    expect(extractRepoFromGitUrl('https://github.com/owner/repo')).toBe('owner/repo');
  });

  it('returns null for garbage input', () => {
    expect(extractRepoFromGitUrl('')).toBeNull();
    expect(extractRepoFromGitUrl(undefined as unknown as string)).toBeNull();
    expect(extractRepoFromGitUrl('not-a-url')).toBeNull();
  });
});

describe('loadFleetManifest', () => {
  it('flattens manifest entries with parsed repos', () => {
    const manifest = {
      alpha: { desc: 'A', url: 'https://github.com/own/alpha.git' },
      bravo: { desc: 'B', url: 'git@github.com:own/bravo.git' },
      charlie: { desc: 'no repo', url: '' },
    };
    const entries = loadFleetManifest(manifest);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ slug: 'alpha', repo: 'own/alpha' });
    expect(entries[1]).toMatchObject({ slug: 'bravo', repo: 'own/bravo' });
  });
});

describe('parseGhRunList + isFailedRun', () => {
  const stdout = JSON.stringify([
    {
      databaseId: 1,
      name: 'CI',
      conclusion: 'failure',
      status: 'completed',
      headBranch: 'main',
      headSha: 'abc123',
      event: 'push',
      createdAt: '2026-05-01T00:00:00Z',
      url: 'https://github.com/own/alpha/actions/runs/1',
      displayTitle: 'fix: thing',
      workflowDatabaseId: 100,
      workflowName: 'CI',
    },
    {
      databaseId: 2,
      name: 'CI',
      conclusion: 'success',
      status: 'completed',
      headBranch: 'main',
      headSha: 'def456',
      event: 'push',
      createdAt: '2026-05-02T00:00:00Z',
    },
    {
      databaseId: 3,
      name: 'Deploy',
      conclusion: 'timed_out',
      status: 'completed',
      headBranch: 'main',
      headSha: 'ghi789',
      event: 'workflow_dispatch',
      createdAt: '2026-05-03T00:00:00Z',
    },
  ]);

  it('parses gh json output into normalized run objects', () => {
    const runs = parseGhRunList(stdout);
    expect(runs).toHaveLength(3);
    expect(runs[0]).toMatchObject({ name: 'CI', conclusion: 'failure', headBranch: 'main', workflowDatabaseId: 100, workflowName: 'CI' });
  });

  it('returns empty array for invalid json', () => {
    expect(parseGhRunList('not json')).toEqual([]);
    expect(parseGhRunList('')).toEqual([]);
  });

  it('flags only failed conclusions', () => {
    const runs = parseGhRunList(stdout);
    expect(runs.filter(isFailedRun).map((r) => r.databaseId)).toEqual([1, 3]);
  });
});

describe('buildFailureFromRun + dedupeFailures', () => {
  const project = { slug: 'alpha', repo: 'own/alpha', desc: '', url: '' };

  it('builds a stable failure surface from a workflow run', () => {
    const failure = buildFailureFromRun(project, {
      name: 'CI',
      conclusion: 'failure',
      headBranch: 'main',
      headSha: 'abc',
      createdAt: '2026-05-01T00:00:00Z',
      url: 'https://example.com/run/1',
    });
    expect(failure).toMatchObject({
      project: 'alpha',
      surface: 'workflow:CI',
      kind: 'workflow',
      headBranch: 'main',
    });
    expect(failureKey(failure!)).toBe('alpha::workflow:CI');
  });

  it('keeps newest failure per surface during dedupe', () => {
    const older = buildFailureFromRun(project, {
      name: 'CI',
      conclusion: 'failure',
      createdAt: '2026-05-01T00:00:00Z',
      url: 'old',
    });
    const newer = buildFailureFromRun(project, {
      name: 'CI',
      conclusion: 'failure',
      createdAt: '2026-05-05T00:00:00Z',
      url: 'new',
    });
    const other = buildFailureFromRun(project, {
      name: 'Deploy',
      conclusion: 'failure',
      createdAt: '2026-05-04T00:00:00Z',
      url: 'deploy',
    });
    const deduped = dedupeFailures([older, newer, other]);
    expect(deduped).toHaveLength(2);
    const ci = deduped.find((f) => f.surface === 'workflow:CI');
    expect(ci?.url).toBe('new');
  });

  it('drops null entries', () => {
    expect(dedupeFailures([null as never, undefined as never])).toEqual([]);
  });
});

describe('buildCurrentFailuresFromRuns', () => {
  const project = { slug: 'alpha', repo: 'own/alpha', desc: '', url: '' };

  it('does not create a failure when a newer run on the same surface succeeded', () => {
    const failures = buildCurrentFailuresFromRuns(project, [
      {
        name: '.github/workflows/ci.yml',
        workflowDatabaseId: 100,
        workflowName: 'CI',
        conclusion: 'failure',
        createdAt: '2026-05-01T00:00:00Z',
        url: 'old-failure',
      },
      {
        name: 'CI',
        workflowDatabaseId: 100,
        workflowName: 'CI',
        conclusion: 'success',
        createdAt: '2026-05-02T00:00:00Z',
        url: 'new-success',
      },
    ]);

    expect(failures).toEqual([]);
  });

  it('keeps the newest failing surface when it is still red', () => {
    const failures = buildCurrentFailuresFromRuns(project, [
      {
        name: 'CI',
        conclusion: 'success',
        createdAt: '2026-05-01T00:00:00Z',
      },
      {
        name: 'CI',
        conclusion: 'failure',
        createdAt: '2026-05-02T00:00:00Z',
        url: 'new-failure',
      },
      {
        name: 'Deploy',
        conclusion: 'failure',
        createdAt: '2026-05-03T00:00:00Z',
        url: 'deploy-failure',
      },
    ]);

    expect(failures.map((failure) => failure.surface)).toEqual(['workflow:CI', 'workflow:Deploy']);
    expect(failures[0].url).toBe('new-failure');
  });

  it('ignores retired reusable Foundry workflow surfaces', () => {
    const failures = buildCurrentFailuresFromRuns(project, [
      {
        name: 'Foundry Weekly Quality Check (reusable)',
        workflowName: 'Foundry Weekly Quality Check (reusable)',
        conclusion: 'failure',
        createdAt: '2026-05-01T00:00:00Z',
        url: 'stale-reusable-failure',
      },
      {
        name: 'Weekly Quality Check',
        conclusion: 'failure',
        createdAt: '2026-05-02T00:00:00Z',
        url: 'real-weekly-failure',
      },
    ]);

    expect(failures.map((failure) => failure.surface)).toEqual(['workflow:Weekly Quality Check']);
  });
});

describe('buildTaskPayload + buildTaskPayloads', () => {
  const project = { slug: 'alpha', repo: 'own/alpha', desc: '', url: '' };

  it('produces a deterministic title and description', () => {
    const failure = buildFailureFromRun(project, {
      name: 'CI',
      conclusion: 'failure',
      headBranch: 'main',
      headSha: 'abc1234',
      createdAt: '2026-05-01T00:00:00Z',
      url: 'https://example.com/run/1',
      displayTitle: 'fix: thing',
    })!;
    const payload = buildTaskPayload(failure);
    expect(payload.title).toBe('[fleet-failure] alpha: workflow:CI @main');
    expect(payload.project_slug).toBe('alpha');
    expect(payload.priority).toBe('high');
    expect(payload.metadata).toMatchObject({
      source: 'fleet-failure-importer',
      failure_key: 'alpha::workflow:CI',
      kind: 'workflow',
    });
    expect(payload.description).toContain('Project: alpha');
    expect(payload.description).toContain('Evidence: https://example.com/run/1');
    expect(payload.description).toContain('Acceptance criteria:');
  });

  it('builds payloads from a deduped list', () => {
    const failures = [
      buildFailureFromRun(project, {
        name: 'CI',
        conclusion: 'failure',
        createdAt: '2026-05-01T00:00:00Z',
      })!,
      buildFailureFromRun(project, {
        name: 'CI',
        conclusion: 'failure',
        createdAt: '2026-05-02T00:00:00Z',
      })!,
    ];
    const payloads = buildTaskPayloads(failures);
    expect(payloads).toHaveLength(1);
  });
});

describe('diffPayloadsAgainstTasks', () => {
  it('separates fresh payloads from already tracked ones', () => {
    const project = { slug: 'alpha', repo: 'own/alpha', desc: '', url: '' };
    const failure = buildFailureFromRun(project, {
      name: 'CI',
      conclusion: 'failure',
      headBranch: 'main',
      createdAt: '2026-05-01T00:00:00Z',
    })!;
    const payload = buildTaskPayload(failure);
    const existing = [{ id: 't1', title: payload.title, status: 'todo' }];
    const result = diffPayloadsAgainstTasks([payload], existing);
    expect(result.fresh).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].existing.id).toBe('t1');
  });

  it('returns all fresh when no existing tasks match', () => {
    const project = { slug: 'beta', repo: 'own/beta', desc: '', url: '' };
    const failure = buildFailureFromRun(project, {
      name: 'Deploy',
      conclusion: 'failure',
      createdAt: '2026-05-01T00:00:00Z',
    })!;
    const payload = buildTaskPayload(failure);
    const result = diffPayloadsAgainstTasks([payload], []);
    expect(result.fresh).toEqual([payload]);
    expect(result.skipped).toEqual([]);
  });
});
