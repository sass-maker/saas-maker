import type {
  ActionHandler,
  EntityDef,
  EntityFetcher,
  ProviderContext,
  ProviderRegistration,
  QueryOptions,
  ResolveResult,
  Scope,
} from './types.js';
import {
  MissingScopeError,
  UnknownActionError,
  UnknownEntityError,
  UnknownSourceError,
} from './errors.js';

interface EntityRegistry {
  entity: EntityDef;
  providers: Map<string, ProviderRegistration>;
}

export interface QueryArgs {
  source?: string;
  entityId: string;
  options?: QueryOptions;
}

export interface InvokeArgs<TArgs = unknown> {
  source?: string;
  entityId: string;
  action: string;
  args: TArgs;
}

/**
 * Runtime registry mapping entity IDs to providers. Sources register the
 * entities they expose; views and runtime ask the graph to resolve them.
 */
export class CapabilityGraph {
  private readonly entries = new Map<string, EntityRegistry>();

  /** Register an entity definition. Idempotent — re-registering same id is a no-op. */
  register(entity: EntityDef): this {
    if (!this.entries.has(entity.id)) {
      this.entries.set(entity.id, { entity, providers: new Map() });
    }
    return this;
  }

  /** A provider declares it can supply an entity. Auto-registers the entity. */
  provide(registration: ProviderRegistration): this {
    this.register(registration.entity);
    const reg = this.entries.get(registration.entity.id)!;
    reg.providers.set(registration.source, registration);
    return this;
  }

  /** List all registered entity ids. */
  entities(): string[] {
    return Array.from(this.entries.keys());
  }

  /** List sources that provide a given entity. */
  providersFor(entityId: string): string[] {
    return Array.from(this.entries.get(entityId)?.providers.keys() ?? []);
  }

  /** Resolve which provider to use. Errors if entity unknown. */
  private locate(entityId: string, source?: string): ProviderRegistration {
    const reg = this.entries.get(entityId);
    if (!reg || reg.providers.size === 0) {
      throw new UnknownEntityError(entityId);
    }
    if (source) {
      const provider = reg.providers.get(source);
      if (!provider) throw new UnknownSourceError(source, entityId);
      return provider;
    }
    // No source pinned — return first registered. Stable order = insertion order.
    const first = reg.providers.values().next().value;
    if (!first) throw new UnknownEntityError(entityId);
    return first;
  }

  /** Resolve a binding to a callable fetch + action handlers (no execution yet). */
  resolve(entityId: string, source?: string): ResolveResult {
    const provider = this.locate(entityId, source);
    return {
      source: provider.source,
      fetch: provider.fetch,
      actions: provider.actions ?? {},
    };
  }

  /** Execute a query through the registered provider. Enforces scopes. */
  async query<T = unknown>(
    args: QueryArgs,
    ctx: ProviderContext,
  ): Promise<T[]> {
    const provider = this.locate(args.entityId, args.source);
    // Read scope convention: `<entityId>:read` (e.g. `email:read`)
    const required: Scope = `${args.entityId}:read`;
    if (!ctx.scopes.has(required)) throw new MissingScopeError(required);
    const fetch = provider.fetch as EntityFetcher;
    const result = await fetch(ctx, args.options ?? {});
    return result as T[];
  }

  /** Execute an action through the registered provider. Enforces declared scope. */
  async invoke<T = unknown>(
    args: InvokeArgs,
    ctx: ProviderContext,
  ): Promise<T> {
    const provider = this.locate(args.entityId, args.source);
    const actionDef = provider.entity.actions[args.action];
    if (!actionDef) throw new UnknownActionError(args.entityId, args.action);
    if (!ctx.scopes.has(actionDef.scope)) throw new MissingScopeError(actionDef.scope);
    const handler = provider.actions?.[args.action] as ActionHandler | undefined;
    if (!handler) throw new UnknownActionError(args.entityId, args.action);
    if (actionDef.args) {
      const parsed = actionDef.args.safeParse(args.args);
      if (!parsed.success) {
        throw new Error(`Invalid args for ${args.entityId}.${args.action}: ${parsed.error.message}`);
      }
      return (await handler(ctx, parsed.data)) as T;
    }
    return (await handler(ctx, args.args)) as T;
  }
}

/** Convenience helper for tests / single-use graphs. */
export function createGraph(): CapabilityGraph {
  return new CapabilityGraph();
}
