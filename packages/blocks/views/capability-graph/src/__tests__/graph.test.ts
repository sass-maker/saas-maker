import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { capability, entity } from '../entity.js';
import { createGraph } from '../graph.js';
import {
  MissingScopeError,
  UnknownActionError,
  UnknownEntityError,
  UnknownSourceError,
} from '../errors.js';

const Email = entity({
  id: 'email',
  fields: {
    id: z.string(),
    subject: z.string(),
    isRead: z.boolean(),
  },
  actions: {
    archive: capability('email:write'),
    label: capability('email:write', z.object({ name: z.string() })),
  },
});

function ctx(scopes: string[]): { scopes: ReadonlySet<string> } {
  return { scopes: new Set(scopes) };
}

describe('CapabilityGraph', () => {
  it('registers an entity without a provider', () => {
    const g = createGraph();
    g.register(Email);
    expect(g.entities()).toContain('email');
    expect(g.providersFor('email')).toEqual([]);
  });

  it('throws UnknownEntityError when querying a non-registered entity', async () => {
    const g = createGraph();
    await expect(g.query({ entityId: 'unknown' }, ctx(['unknown:read']))).rejects.toBeInstanceOf(
      UnknownEntityError,
    );
  });

  it('routes a query to the registered provider with read scope', async () => {
    const g = createGraph();
    const fetch = vi.fn().mockResolvedValue([{ id: 'a', subject: 'hi', isRead: false }]);
    g.provide({ source: 'gmail', entity: Email, fetch });

    const result = await g.query({ entityId: 'email' }, ctx(['email:read']));

    expect(fetch).toHaveBeenCalledOnce();
    expect(result).toHaveLength(1);
  });

  it('rejects query without read scope', async () => {
    const g = createGraph();
    g.provide({ source: 'gmail', entity: Email, fetch: vi.fn() });
    await expect(g.query({ entityId: 'email' }, ctx([]))).rejects.toBeInstanceOf(MissingScopeError);
  });

  it('honours pinned source when multiple providers exist', async () => {
    const g = createGraph();
    const gmailFetch = vi.fn().mockResolvedValue([{ id: 'g' }]);
    const outlookFetch = vi.fn().mockResolvedValue([{ id: 'o' }]);
    g.provide({ source: 'gmail', entity: Email, fetch: gmailFetch });
    g.provide({ source: 'outlook', entity: Email, fetch: outlookFetch });

    const result = await g.query({ entityId: 'email', source: 'outlook' }, ctx(['email:read']));

    expect(outlookFetch).toHaveBeenCalled();
    expect(gmailFetch).not.toHaveBeenCalled();
    expect(result[0]).toEqual({ id: 'o' });
  });

  it('throws UnknownSourceError when pinning non-registered source', async () => {
    const g = createGraph();
    g.provide({ source: 'gmail', entity: Email, fetch: vi.fn() });
    await expect(
      g.query({ entityId: 'email', source: 'nope' }, ctx(['email:read'])),
    ).rejects.toBeInstanceOf(UnknownSourceError);
  });

  it('invokes a declared action with declared scope', async () => {
    const g = createGraph();
    const archive = vi.fn().mockResolvedValue(true);
    g.provide({
      source: 'gmail',
      entity: Email,
      fetch: vi.fn(),
      actions: { archive },
    });

    const result = await g.invoke(
      { entityId: 'email', action: 'archive', args: undefined },
      ctx(['email:write']),
    );

    expect(archive).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('rejects invoke without required scope', async () => {
    const g = createGraph();
    g.provide({
      source: 'gmail',
      entity: Email,
      fetch: vi.fn(),
      actions: { archive: vi.fn() },
    });
    await expect(
      g.invoke({ entityId: 'email', action: 'archive', args: undefined }, ctx(['email:read'])),
    ).rejects.toBeInstanceOf(MissingScopeError);
  });

  it('throws UnknownActionError for unregistered action', async () => {
    const g = createGraph();
    g.provide({ source: 'gmail', entity: Email, fetch: vi.fn(), actions: {} });
    await expect(
      g.invoke({ entityId: 'email', action: 'archive', args: undefined }, ctx(['email:write'])),
    ).rejects.toBeInstanceOf(UnknownActionError);
  });

  it('validates action args via zod', async () => {
    const g = createGraph();
    const label = vi.fn().mockResolvedValue(true);
    g.provide({
      source: 'gmail',
      entity: Email,
      fetch: vi.fn(),
      actions: { label },
    });

    await expect(
      g.invoke(
        { entityId: 'email', action: 'label', args: { wrong: 1 } },
        ctx(['email:write']),
      ),
    ).rejects.toThrow(/Invalid args/);
    expect(label).not.toHaveBeenCalled();
  });

  it('resolves without executing - returns fetch + actions', () => {
    const g = createGraph();
    const fetch = vi.fn();
    const archive = vi.fn();
    g.provide({ source: 'gmail', entity: Email, fetch, actions: { archive } });

    const r = g.resolve('email');
    expect(r.source).toBe('gmail');
    expect(r.fetch).toBe(fetch);
    expect(r.actions['archive']).toBe(archive);
  });
});
