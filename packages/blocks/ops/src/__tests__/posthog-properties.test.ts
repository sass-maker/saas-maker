import { describe, expect, it } from 'vitest';
import {
  POSTHOG_PROJECT_ID_COALESCE,
  resolvePostHogProjectId,
  withCanonicalProjectId,
} from '../posthog-properties.js';

describe('PostHog project identity', () => {
  it('exports the fleet HogQL coalesce expression', () => {
    expect(POSTHOG_PROJECT_ID_COALESCE).toContain('properties.project_id');
    expect(POSTHOG_PROJECT_ID_COALESCE).toContain('properties.foundry_project_id');
  });

  it('prefers canonical project_id over legacy keys', () => {
    expect(
      resolvePostHogProjectId({
        project_id: 'canonical',
        project_slug: 'legacy-slug',
        foundry_project_id: 'legacy-foundry',
      }),
    ).toBe('canonical');
  });

  it('coalesces legacy keys when project_id is missing', () => {
    expect(resolvePostHogProjectId({ project_slug: 'from-slug' })).toBe('from-slug');
    expect(resolvePostHogProjectId({ project: 'from-project' })).toBe('from-project');
    expect(resolvePostHogProjectId({ foundry_project_id: 'from-foundry' })).toBe('from-foundry');
  });

  it('normalizes emitted properties to project_id only', () => {
    expect(
      withCanonicalProjectId({
        project_slug: 'saas-maker',
        severity: 'high',
      }),
    ).toEqual({
      project_id: 'saas-maker',
      severity: 'high',
    });
  });
});
