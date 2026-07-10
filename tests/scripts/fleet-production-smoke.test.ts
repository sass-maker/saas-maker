import { describe, expect, it } from 'vitest';

import {
  buildSmokeFailure,
  buildSmokeFailures,
  buildSmokeTaskPayload,
  buildSmokeTaskPayloads,
  diffPayloadsAgainstTasks,
  failureKey,
  findExistingTask,
  isFailedCheck,
} from '../../scripts/lib/fleet-production-smoke.mjs';
import {
  FLEET_HEALTH_CONTRACTS,
  getHealthContractStatus,
} from '../../scripts/lib/fleet-health-contracts.mjs';

const passingCheck = {
  kind: 'page',
  project: 'alpha',
  label: 'web',
  url: 'https://alpha.example.com',
  status: 200,
  ok: true,
  errors: [],
};

const failingNavCheck = {
  kind: 'page',
  project: 'alpha',
  label: 'web',
  url: 'https://alpha.example.com',
  status: 500,
  ok: false,
  errors: [
    { type: 'navigation', status: 500, message: 'unexpected status 500' },
    {
      type: 'bad-response',
      status: 503,
      url: 'https://alpha.example.com/api',
      resourceType: 'fetch',
    },
  ],
};

const failingConsoleOnlyCheck = {
  kind: 'page',
  project: 'bravo',
  label: 'home',
  url: 'https://bravo.example.com',
  status: 200,
  ok: false,
  errors: [{ type: 'console', message: 'TypeError: undefined is not a function' }],
};

const failingAuthCheck = {
  kind: 'auth',
  project: 'alpha',
  label: 'google-signin',
  url: 'https://alpha.example.com/api/auth/sign-in/social',
  status: 500,
  ok: false,
  errors: [{ type: 'auth', message: 'expected status 200, got 500', body: '' }],
};

describe('isFailedCheck', () => {
  it('passes only failed checks', () => {
    expect(isFailedCheck(passingCheck)).toBe(false);
    expect(isFailedCheck(failingNavCheck)).toBe(true);
    expect(isFailedCheck(null as never)).toBe(false);
  });
});

describe('buildSmokeFailure', () => {
  it('summarizes errors and infers high priority for navigation issues', () => {
    const failure = buildSmokeFailure(failingNavCheck);
    expect(failure).toMatchObject({
      project: 'alpha',
      label: 'web',
      kind: 'page',
      status: 500,
      errorCount: 2,
      priority: 'high',
    });
    expect(failure?.errorTypes).toEqual({ navigation: 1, 'bad-response': 1 });
    expect(failure?.topErrors).toHaveLength(2);
  });

  it('falls back to medium priority when only console errors fail the check', () => {
    expect(buildSmokeFailure(failingConsoleOnlyCheck)?.priority).toBe('medium');
  });

  it('promotes auth failures to high priority', () => {
    expect(buildSmokeFailure(failingAuthCheck)?.priority).toBe('high');
  });

  it('returns null for passing checks', () => {
    expect(buildSmokeFailure(passingCheck)).toBeNull();
  });
});

describe('buildSmokeFailures + buildSmokeTaskPayloads', () => {
  it('skips passing checks and sorts by project/label', () => {
    const failures = buildSmokeFailures([
      passingCheck,
      failingConsoleOnlyCheck,
      failingNavCheck,
      failingAuthCheck,
    ]);
    expect(failures.map((f) => `${f.project}/${f.label}`)).toEqual([
      'alpha/google-signin',
      'alpha/web',
      'bravo/home',
    ]);
  });

  it('produces stable task payloads with metadata and acceptance criteria', () => {
    const failure = buildSmokeFailure(failingNavCheck)!;
    const payload = buildSmokeTaskPayload(failure, { generatedAt: '2026-05-16T12:00:00Z' });
    expect(payload.title).toBe('[fleet-smoke] alpha/web');
    expect(payload.project_slug).toBe('alpha');
    expect(payload.priority).toBe('high');
    expect(payload.metadata).toMatchObject({
      source: 'fleet-production-smoke',
      failure_key: 'alpha::page:web',
      kind: 'page',
      label: 'web',
      url: 'https://alpha.example.com',
    });
    expect(payload.description).toContain('Project: alpha');
    expect(payload.description).toContain('Detected at: 2026-05-16T12:00:00Z');
    expect(payload.description).toContain('Acceptance criteria:');
    expect(payload.description).toContain('fleet:prod-smoke');
  });

  it('dedupes payloads sharing the same project+kind+label', () => {
    const duplicate = { ...failingNavCheck };
    const payloads = buildSmokeTaskPayloads(buildSmokeFailures([failingNavCheck, duplicate]));
    expect(payloads).toHaveLength(1);
  });

  it('returns failureKey unique per surface', () => {
    expect(failureKey(buildSmokeFailure(failingNavCheck)!)).toBe('alpha::page:web');
    expect(failureKey(buildSmokeFailure(failingAuthCheck)!)).toBe('alpha::auth:google-signin');
  });
});

describe('diffPayloadsAgainstTasks', () => {
  const payload = buildSmokeTaskPayload(buildSmokeFailure(failingNavCheck)!);

  it('treats matching open tasks as already-tracked', () => {
    const existing = [{ id: 't1', title: '[fleet-smoke] alpha/web', status: 'todo' }];
    const { fresh, skipped } = diffPayloadsAgainstTasks([payload], existing);
    expect(fresh).toHaveLength(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].existing.id).toBe('t1');
  });

  it('ignores closed tasks so a regression refiles a new suggestion', () => {
    const existing = [{ id: 't1', title: '[fleet-smoke] alpha/web', status: 'done' }];
    const { fresh, skipped } = diffPayloadsAgainstTasks([payload], existing);
    expect(fresh).toHaveLength(1);
    expect(skipped).toHaveLength(0);
  });

  it('treats blocked/in_progress tasks as already-tracked', () => {
    const inProgress = findExistingTask(
      [{ id: 't2', title: '[fleet-smoke] alpha/web', status: 'in_progress' }],
      payload
    );
    expect(inProgress?.id).toBe('t2');
    const blocked = findExistingTask(
      [{ id: 't3', title: '[fleet-smoke] alpha/web', status: 'blocked' }],
      payload
    );
    expect(blocked?.id).toBe('t3');
  });

  it('tolerates missing/garbage task list', () => {
    const { fresh, skipped } = diffPayloadsAgainstTasks([payload], undefined as never);
    expect(fresh).toHaveLength(1);
    expect(skipped).toHaveLength(0);
  });
});

describe('fleet health contracts', () => {
  it('covers every active project listed in foundry.projects.json', async () => {
    const fs = await import('node:fs');
    const projects = JSON.parse(fs.readFileSync('foundry.projects.json', 'utf8'));
    expect(Object.keys(FLEET_HEALTH_CONTRACTS).sort()).toEqual(Object.keys(projects).sort());
  });

  it('reports blocked when a project has no production URL or no checks', () => {
    expect(getHealthContractStatus('ai-game', [])).toBe('blocked');
    expect(getHealthContractStatus('reader', [])).toBe('blocked');
  });

  it('maps smoke checks to pass/fail health state', () => {
    expect(getHealthContractStatus('rolepatch', [{ ...passingCheck, project: 'rolepatch' }])).toBe(
      'pass'
    );
    expect(
      getHealthContractStatus('rolepatch', [{ ...failingAuthCheck, project: 'rolepatch' }])
    ).toBe('fail');
  });
});
