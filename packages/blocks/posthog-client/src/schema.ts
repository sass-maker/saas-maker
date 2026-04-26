/**
 * Validates `.posthog-events.json` against the Foundry registry schema.
 * Designed to run in CI / pre-push hooks to keep tracking in sync with code.
 */

export interface PostHogEventEntry {
  event: string;
  description: string;
  file: string;
  /** Optional typed payload schema (free-form, used for documentation only). */
  properties?: Record<string, { type: string; description?: string; required?: boolean }>;
}

export interface ValidateResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  entries: PostHogEventEntry[];
}

const EVENT_NAME_RE = /^[a-z][a-z0-9_]*$/;

export function validatePostHogSchema(raw: unknown): ValidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const entries: PostHogEventEntry[] = [];

  if (!Array.isArray(raw)) {
    return {
      ok: false,
      errors: ['Schema must be a top-level JSON array of event entries.'],
      warnings,
      entries,
    };
  }

  const seen = new Set<string>();

  raw.forEach((item, idx) => {
    if (!item || typeof item !== 'object') {
      errors.push(`[${idx}] entry must be an object`);
      return;
    }
    const e = item as Record<string, unknown>;
    const event = e['event'];
    const description = e['description'];
    const file = e['file'];
    const properties = e['properties'];

    if (typeof event !== 'string' || !event) {
      errors.push(`[${idx}] missing required "event" string`);
      return;
    }
    if (!EVENT_NAME_RE.test(event)) {
      errors.push(
        `[${idx}] event "${event}" must be snake_case, lowercase, start with a letter`,
      );
    }
    if (seen.has(event)) {
      errors.push(`[${idx}] duplicate event name "${event}"`);
    }
    seen.add(event);

    if (typeof description !== 'string' || !description) {
      warnings.push(`[${idx}] event "${event}" missing description`);
    }
    if (typeof file !== 'string' || !file) {
      warnings.push(`[${idx}] event "${event}" missing source file reference`);
    }

    entries.push({
      event,
      description: typeof description === 'string' ? description : '',
      file: typeof file === 'string' ? file : '',
      properties:
        properties && typeof properties === 'object'
          ? (properties as PostHogEventEntry['properties'])
          : undefined,
    });
  });

  return { ok: errors.length === 0, errors, warnings, entries };
}

/**
 * Generate a TypeScript EventMap interface from a validated registry.
 * Useful for code-gen step in repos that want full type safety on `track()`.
 */
export function generateEventMap(entries: PostHogEventEntry[]): string {
  const lines = ['export interface PostHogEventMap {'];
  for (const e of entries) {
    if (e.properties) {
      const props = Object.entries(e.properties)
        .map(([k, p]) => `    ${k}${p.required === false ? '?' : ''}: ${tsType(p.type)};`)
        .join('\n');
      lines.push(`  ${e.event}: {`);
      lines.push(props);
      lines.push('  };');
    } else {
      lines.push(`  ${e.event}: Record<string, unknown> | undefined;`);
    }
  }
  lines.push('}');
  return lines.join('\n');
}

function tsType(raw: string): string {
  switch (raw.toLowerCase()) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return 'unknown';
  }
}
