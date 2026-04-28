import { useEffect, useMemo, useState } from 'react';
import type { CapabilityGraph, ProviderContext } from '@saas-maker/capability-graph';
import { resolveBinding } from './binding.js';
import { defaultBlocks, UnknownBlock, type BlockRegistry } from './blocks/registry.js';
import { cn } from './lib/utils.js';
import { parseViewSpec, type Binding, type BlockSpec, type ViewSpec } from './spec.js';

interface BindingState {
  loading: boolean;
  data: unknown[];
  error?: Error;
}

const initialState: BindingState = { loading: true, data: [] };

export interface ViewRuntimeProps {
  /** Either a pre-parsed spec or raw JSON to validate. */
  spec: ViewSpec | unknown;
  /** Capability graph carrying registered providers. */
  graph: CapabilityGraph;
  /** Provider context (scopes, abort signal). Re-fetches when scopes change. */
  ctx: ProviderContext;
  /** Optional override map of block type → component. Falls back to defaults. */
  blocks?: BlockRegistry;
  /** Extra className on the root container. */
  className?: string;
}

/**
 * Resolves a view spec to a live dashboard.
 *
 * - Validates the spec (zod) and renders an error card if invalid.
 * - Fetches each binding via the capability graph in parallel.
 * - Mounts blocks from the registry, passing per-binding loading/error state.
 */
export function ViewRuntime({ spec, graph, ctx, blocks, className }: ViewRuntimeProps) {
  const parsed = useMemo(() => {
    try {
      return { ok: true as const, spec: parseViewSpec(spec) };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }, [spec]);

  if (!parsed.ok) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
        <p className="font-medium">Invalid view spec</p>
        <pre className="mt-2 whitespace-pre-wrap text-xs opacity-80">{parsed.error.message}</pre>
      </div>
    );
  }

  return (
    <ViewRuntimeInner
      spec={parsed.spec}
      graph={graph}
      ctx={ctx}
      blocks={blocks ?? defaultBlocks}
      className={className}
    />
  );
}

interface InnerProps {
  spec: ViewSpec;
  graph: CapabilityGraph;
  ctx: ProviderContext;
  blocks: BlockRegistry;
  className?: string;
}

function ViewRuntimeInner({ spec, graph, ctx, blocks, className }: InnerProps) {
  const bindings = useBindings(spec.bindings, graph, ctx);

  const layoutClass =
    spec.layout === 'flex'
      ? 'flex flex-wrap gap-4'
      : spec.layout === 'stack'
        ? 'flex flex-col gap-4'
        : 'grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-min';

  return (
    <div className={cn('w-full', className)}>
      {spec.title ? (
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{spec.title}</h1>
          {spec.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{spec.description}</p>
          ) : null}
        </header>
      ) : null}
      <div className={layoutClass}>
        {spec.blocks.map((block) => (
          <BlockShell key={block.id} block={block} bindings={bindings} blocks={blocks} />
        ))}
      </div>
    </div>
  );
}

function BlockShell({
  block,
  bindings,
  blocks,
}: {
  block: BlockSpec;
  bindings: Record<string, BindingState>;
  blocks: BlockRegistry;
}) {
  const Component = blocks[block.type] ?? UnknownBlock;
  const state = block.binding ? (bindings[block.binding] ?? initialState) : { loading: false, data: [] };
  const layout = block.layout;
  const colSpan = layout?.w ? colSpanClass(layout.w) : undefined;
  const rowSpan = layout?.h ? rowSpanClass(layout.h) : undefined;

  const propsForBlock: Record<string, unknown> = {
    ...(block.props ?? {}),
    __type: block.type,
  };

  return (
    <div className={cn(colSpan, rowSpan)}>
      <Component
        blockId={block.id}
        data={state.data}
        loading={state.loading}
        {...(state.error ? { error: state.error } : {})}
        props={propsForBlock}
      />
    </div>
  );
}

function colSpanClass(w: number): string {
  // Tailwind needs static class names — map common widths only.
  const map: Record<number, string> = {
    1: 'md:col-span-1',
    2: 'md:col-span-2',
    3: 'md:col-span-3',
    4: 'md:col-span-4 lg:col-span-4',
    6: 'md:col-span-3 lg:col-span-4',
    12: 'md:col-span-3 lg:col-span-4',
  };
  return map[w] ?? '';
}

function rowSpanClass(h: number): string {
  const map: Record<number, string> = {
    1: 'row-span-1',
    2: 'row-span-2',
    3: 'row-span-3',
  };
  return map[h] ?? '';
}

/**
 * Resolves all bindings concurrently. Re-runs when bindings, graph, or ctx changes.
 */
function useBindings(
  specBindings: Record<string, Binding>,
  graph: CapabilityGraph,
  ctx: ProviderContext,
): Record<string, BindingState> {
  const [state, setState] = useState<Record<string, BindingState>>(() => {
    const initial: Record<string, BindingState> = {};
    for (const key of Object.keys(specBindings)) initial[key] = initialState;
    return initial;
  });

  const keys = Object.keys(specBindings).sort().join('|');
  const scopeKey = Array.from(ctx.scopes).sort().join('|');

  useEffect(() => {
    let cancelled = false;
    const next: Record<string, BindingState> = {};
    for (const key of Object.keys(specBindings)) next[key] = { loading: true, data: [] };
    setState(next);

    const tasks = Object.entries(specBindings).map(async ([key, binding]) => {
      try {
        const data = await resolveBinding(graph, binding, ctx);
        if (cancelled) return;
        setState((prev) => ({ ...prev, [key]: { loading: false, data } }));
      } catch (err) {
        if (cancelled) return;
        const error = err instanceof Error ? err : new Error(String(err));
        setState((prev) => ({ ...prev, [key]: { loading: false, data: [], error } }));
      }
    });

    void Promise.allSettled(tasks);

    return () => {
      cancelled = true;
    };
    // We intentionally include serialised keys — bindings is a fresh object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, scopeKey, graph]);

  return state;
}
