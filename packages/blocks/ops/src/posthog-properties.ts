const LEGACY_PROJECT_ID_KEYS = ['project_slug', 'project', 'foundry_project_id'] as const;

/** HogQL expression for reading fleet project identity across event history. */
export const POSTHOG_PROJECT_ID_COALESCE =
  'coalesce(properties.project_id, properties.project_slug, properties.project, properties.foundry_project_id)';

export function resolvePostHogProjectId(
  properties: Record<string, unknown> | undefined,
): string | undefined {
  if (!properties) return undefined;

  const canonical = properties['project_id'];
  if (typeof canonical === 'string' && canonical.length > 0) return canonical;

  for (const key of LEGACY_PROJECT_ID_KEYS) {
    const value = properties[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }

  return undefined;
}

/** Ensures emitted PostHog properties use canonical `project_id` only. */
export function withCanonicalProjectId(
  properties: Record<string, unknown> = {},
): Record<string, unknown> {
  const projectId = resolvePostHogProjectId(properties);
  if (!projectId) return { ...properties };

  const normalized: Record<string, unknown> = { ...properties, project_id: projectId };
  for (const key of LEGACY_PROJECT_ID_KEYS) {
    delete normalized[key];
  }
  return normalized;
}
