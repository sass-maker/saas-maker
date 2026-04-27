import { describe, it, expect } from 'vitest';
import { validatePostHogSchema, generateEventMap } from '../schema.js';

describe('validatePostHogSchema', () => {
  it('rejects non-array input', () => {
    const r = validatePostHogSchema({ events: [] });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain('top-level JSON array');
  });

  it('accepts a valid array', () => {
    const r = validatePostHogSchema([
      { event: 'project_created', description: 'fires on create', file: 'src/x.ts' },
    ]);
    expect(r.ok).toBe(true);
    expect(r.entries).toHaveLength(1);
  });

  it('flags non-snake-case event names', () => {
    const r = validatePostHogSchema([
      { event: 'ProjectCreated', description: 'd', file: 'f' },
    ]);
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toContain('snake_case');
  });

  it('flags duplicate event names', () => {
    const r = validatePostHogSchema([
      { event: 'foo', description: 'a', file: 'f' },
      { event: 'foo', description: 'b', file: 'g' },
    ]);
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toContain('duplicate');
  });

  it('warns on missing description / file', () => {
    const r = validatePostHogSchema([{ event: 'foo' }]);
    expect(r.warnings.length).toBe(2);
  });
});

describe('generateEventMap', () => {
  it('emits typed properties when present', () => {
    const ts = generateEventMap([
      {
        event: 'feedback_submitted',
        description: 'd',
        file: 'f',
        properties: {
          project_id: { type: 'string' },
          count: { type: 'number', required: false },
        },
      },
    ]);
    expect(ts).toContain('feedback_submitted: {');
    expect(ts).toContain('project_id: string;');
    expect(ts).toContain('count?: number;');
  });

  it('falls back to Record<string, unknown> when no properties', () => {
    const ts = generateEventMap([{ event: 'simple', description: 'd', file: 'f' }]);
    expect(ts).toContain('simple: Record<string, unknown> | undefined;');
  });
});
