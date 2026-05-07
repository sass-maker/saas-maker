import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { z } from 'zod';
import { createGraph, entity } from '@saas-maker/capability-graph';
import { ViewRuntime } from '../runtime.js';

const Issue = entity({
  id: 'issue',
  fields: {
    id: z.string(),
    title: z.string(),
    status: z.string(),
    points: z.number(),
  },
});

function buildGraph(rows: Array<{ id: string; title: string; status: string; points: number }>) {
  const graph = createGraph().provide({
    source: 'linear',
    entity: Issue,
    fetch: async () => rows,
  });
  return graph;
}

const ctx = { scopes: new Set(['issue:read']) };

describe('<ViewRuntime>', () => {
  it('renders an invalid-spec error card on bad input', () => {
    const graph = createGraph();
    render(
      <ViewRuntime
        spec={{ blocks: [{ type: 'MetricCard' }] }}
        graph={graph}
        ctx={{ scopes: new Set() }}
      />,
    );
    expect(screen.getByText(/Invalid view spec/i)).toBeInTheDocument();
  });

  it('renders title and description from the spec', async () => {
    const graph = buildGraph([]);
    render(
      <ViewRuntime
        spec={{
          id: 'sprint',
          title: 'Sprint health',
          description: 'Open issues in the current cycle',
          bindings: { open: { entity: 'issue' } },
          blocks: [],
        }}
        graph={graph}
        ctx={ctx}
      />,
    );
    expect(screen.getByText('Sprint health')).toBeInTheDocument();
    expect(screen.getByText(/Open issues in the current cycle/i)).toBeInTheDocument();
  });

  it('aggregates rows through MetricCard sum', async () => {
    const graph = buildGraph([
      { id: 'a', title: 'one', status: 'open', points: 3 },
      { id: 'b', title: 'two', status: 'open', points: 5 },
    ]);
    render(
      <ViewRuntime
        spec={{
          id: 'velocity',
          bindings: { open: { entity: 'issue' } },
          blocks: [
            {
              id: 'pts',
              type: 'MetricCard',
              binding: 'open',
              props: { label: 'Story points', field: 'points', aggregate: 'sum' },
            },
          ],
        }}
        graph={graph}
        ctx={ctx}
      />,
    );
    await waitFor(() => expect(screen.getByText('8')).toBeInTheDocument());
    expect(screen.getByText('Story points')).toBeInTheDocument();
  });

  it('renders a List block with primary/secondary fields', async () => {
    const graph = buildGraph([
      { id: 'a', title: 'Fix login', status: 'open', points: 2 },
      { id: 'b', title: 'Ship dashboard', status: 'in_progress', points: 5 },
    ]);
    render(
      <ViewRuntime
        spec={{
          id: 'sprint',
          bindings: { open: { entity: 'issue' } },
          blocks: [
            {
              id: 'list',
              type: 'List',
              binding: 'open',
              props: { title: 'Sprint', primary: 'title', secondary: 'status' },
            },
          ],
        }}
        graph={graph}
        ctx={ctx}
      />,
    );
    await waitFor(() => expect(screen.getByText('Fix login')).toBeInTheDocument());
    expect(screen.getByText('Ship dashboard')).toBeInTheDocument();
    expect(screen.getByText('in_progress')).toBeInTheDocument();
  });

  it('renders an UnknownBlock fallback for unregistered block types', async () => {
    const graph = buildGraph([]);
    render(
      <ViewRuntime
        spec={{
          id: 'x',
          blocks: [{ id: 'b1', type: 'NotARealBlock' }],
        }}
        graph={graph}
        ctx={{ scopes: new Set() }}
      />,
    );
    expect(await screen.findByText(/Unknown block type/i)).toBeInTheDocument();
    expect(screen.getByText('NotARealBlock')).toBeInTheDocument();
  });

  it('shows binding error in the block when the provider throws', async () => {
    const graph = createGraph().provide({
      source: 'linear',
      entity: Issue,
      fetch: async () => {
        throw new Error('upstream timeout');
      },
    });
    render(
      <ViewRuntime
        spec={{
          id: 'x',
          bindings: { broken: { entity: 'issue' } },
          blocks: [
            {
              id: 'm',
              type: 'MetricCard',
              binding: 'broken',
              props: { label: 'Issues' },
            },
          ],
        }}
        graph={graph}
        ctx={ctx}
      />,
    );
    await waitFor(() => expect(screen.getByText(/upstream timeout/i)).toBeInTheDocument());
  });
});
