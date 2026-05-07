import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { capability, entity } from '../entity.js';

describe('entity()', () => {
  it('creates an entity with schema and default empty actions', () => {
    const Email = entity({
      id: 'email',
      fields: {
        id: z.string(),
        subject: z.string(),
      },
    });

    expect(Email.id).toBe('email');
    expect(Email.actions).toEqual({});
    const parsed = Email.schema.safeParse({ id: 'a', subject: 'hi' });
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid records via schema', () => {
    const Issue = entity({
      id: 'issue',
      fields: { id: z.string(), title: z.string() },
    });
    const result = Issue.schema.safeParse({ id: 1 });
    expect(result.success).toBe(false);
  });

  it('attaches actions with capability scopes', () => {
    const Email = entity({
      id: 'email',
      fields: { id: z.string() },
      actions: {
        archive: capability('email:write'),
        label: capability('email:write', z.object({ name: z.string() })),
      },
    });
    expect(Email.actions['archive']?.scope).toBe('email:write');
    expect(Email.actions['label']?.args).toBeDefined();
  });
});

describe('capability()', () => {
  it('omits args when not provided', () => {
    const cap = capability('email:read');
    expect(cap.args).toBeUndefined();
  });
});
