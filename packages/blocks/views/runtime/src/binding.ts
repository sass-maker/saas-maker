import type { CapabilityGraph, ProviderContext, QueryOptions } from '@saas-maker/capability-graph';
import type { Binding } from './spec.js';

/**
 * Resolve a binding into a list of rows by routing through the capability graph.
 * Returned data is whatever the provider yields - caller is responsible for
 * narrowing/typing per block.
 */
export async function resolveBinding(
  graph: CapabilityGraph,
  binding: Binding,
  ctx: ProviderContext,
): Promise<unknown[]> {
  const opts: QueryOptions = {};
  if (binding.filter) opts.filter = binding.filter;
  if (binding.orderBy) opts.orderBy = binding.orderBy;
  if (binding.limit !== undefined) opts.limit = binding.limit;

  return graph.query(
    {
      entityId: binding.entity,
      ...(binding.source ? { source: binding.source } : {}),
      options: opts,
    },
    ctx,
  );
}
