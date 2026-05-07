export { entity, capability } from './entity.js';
export { CapabilityGraph, createGraph } from './graph.js';
export {
  CapabilityError,
  MissingScopeError,
  UnknownActionError,
  UnknownEntityError,
  UnknownSourceError,
} from './errors.js';
export type {
  ActionHandler,
  CapabilityDef,
  EntityActions,
  EntityDef,
  EntityFetcher,
  EntityFields,
  InferEntity,
  ProviderContext,
  ProviderRegistration,
  QueryOptions,
  ResolveResult,
  Scope,
} from './types.js';
export type { DefineEntityInput } from './entity.js';
export type { InvokeArgs, QueryArgs } from './graph.js';
