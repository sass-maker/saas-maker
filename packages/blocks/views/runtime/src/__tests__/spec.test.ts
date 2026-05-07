import { describe, expect, it } from 'vitest';
import { parseViewSpec, safeParseViewSpec } from '../spec.js';

describe('parseViewSpec', () => {
  it('accepts a minimal valid spec', () => {
    const spec = parseViewSpec({
      id: 'cockpit',
      blocks: [{ id: 'mrr', type: 'MetricCard' }],
    });
    expect(spec.id).toBe('cockpit');
    expect(spec.layout).toBe('grid');
    expect(spec.bindings).toEqual({});
    expect(spec.blocks).toHaveLength(1);
  });

  it('parses bindings + filter + orderBy', () => {
    const spec = parseViewSpec({
      id: 'inbox',
      bindings: {
        unread: {
          source: 'gmail',
          entity: 'email',
          filter: { isRead: false },
          orderBy: { field: 'receivedAt', dir: 'desc' },
          limit: 25,
        },
      },
      blocks: [{ id: 'list', type: 'List', binding: 'unread' }],
    });
    expect(spec.bindings['unread']?.source).toBe('gmail');
    expect(spec.bindings['unread']?.limit).toBe(25);
  });

  it('rejects missing block id', () => {
    const result = safeParseViewSpec({
      id: 'x',
      blocks: [{ type: 'MetricCard' }],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects invalid layout enum', () => {
    const result = safeParseViewSpec({ id: 'x', layout: 'masonry' });
    expect(result.ok).toBe(false);
  });

  it('coerces version default', () => {
    const spec = parseViewSpec({ id: 'x' });
    expect(spec.version).toBe(1);
  });
});
