import type { z } from 'zod';

export type Scope = string;

export interface CapabilityDef<TArgs extends z.ZodTypeAny = z.ZodTypeAny> {
  scope: Scope;
  args?: TArgs;
}

export type EntityFields = Record<string, z.ZodTypeAny>;
export type EntityActions = Record<string, CapabilityDef>;

export interface EntityDef<
  TFields extends EntityFields = EntityFields,
  TActions extends EntityActions = EntityActions,
> {
  id: string;
  fields: TFields;
  actions: TActions;
  schema: z.ZodObject<TFields>;
}

export type InferEntity<T> = T extends EntityDef<infer F, EntityActions>
  ? z.infer<z.ZodObject<F>>
  : never;

export interface QueryOptions {
  filter?: Record<string, unknown>;
  orderBy?: { field: string; dir: 'asc' | 'desc' };
  limit?: number;
}

export interface ProviderContext {
  scopes: ReadonlySet<Scope>;
  signal?: AbortSignal;
}

export type EntityFetcher<TEntity extends EntityDef = EntityDef> = (
  ctx: ProviderContext,
  opts: QueryOptions,
) => Promise<Array<InferEntity<TEntity>>>;

export type ActionHandler<TArgs = unknown> = (
  ctx: ProviderContext,
  args: TArgs,
) => Promise<unknown>;

export interface ProviderRegistration {
  source: string;
  entity: EntityDef;
  fetch: EntityFetcher;
  actions?: Record<string, ActionHandler>;
}

export interface ResolveResult {
  source: string;
  fetch: EntityFetcher;
  actions: Record<string, ActionHandler>;
}
