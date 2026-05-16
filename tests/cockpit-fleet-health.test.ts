import { describe, expect, it } from 'vitest';
import { buildFleetCommandCenter } from '../apps/cockpit/src/lib/fleet-health';

describe('cockpit fleet health command center', () => {
  it('prioritizes critical projects and produces an action digest', () => {
    const commandCenter = buildFleetCommandCenter([
      {
        name: 'Healthy App',
        slug: 'healthy-app',
        type: 'next',
        compliance: {
          score: 6,
          total: 6,
          checks: {
            config: true,
            eslint: true,
            tsconfig: true,
            prettier: true,
            ci: true,
            health: true,
          },
        },
      },
      {
        name: 'Missing CI',
        slug: 'missing-ci',
        type: 'vite',
        compliance: {
          score: 4,
          total: 6,
          checks: {
            config: true,
            eslint: true,
            tsconfig: true,
            prettier: true,
            ci: false,
            health: false,
          },
        },
      },
      {
        name: 'Local Only',
        slug: 'local-only',
        type: 'node',
        compliance: {
          score: 6,
          total: 6,
          checks: {
            config: true,
            eslint: true,
            tsconfig: true,
            prettier: true,
            ci: true,
            health: true,
          },
        },
      },
    ], ['healthy-app', 'missing-ci']);

    expect(commandCenter.health).toMatchObject({
      percentage: 89,
      compliant: 1,
      registered: 2,
      localOnly: 1,
      needsAttention: 2,
      critical: 1,
    });
    expect(commandCenter.projects[0]).toMatchObject({
      slug: 'missing-ci',
      status: 'critical',
      readiness: 67,
    });
    expect(commandCenter.projects[0].actions).toContain('Add the standard CI workflow.');
    expect(commandCenter.actionDigest).toEqual([
      'Missing CI: Add the standard CI workflow.',
      'Local Only: Create or sync the project record.',
    ]);
  });

  it('handles an empty fleet without dividing by zero', () => {
    expect(buildFleetCommandCenter([]).health).toMatchObject({
      percentage: 0,
      compliant: 0,
      needsAttention: 0,
      critical: 0,
    });
  });
});
