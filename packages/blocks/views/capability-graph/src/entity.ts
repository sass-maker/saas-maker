import { z } from 'zod';
import type { CapabilityDef, EntityActions, EntityDef, EntityFields } from './types.js';

export interface DefineEntityInput<TFields extends EntityFields, TActions extends EntityActions> {
  id: string;
  fields: TFields;
  actions?: TActions;
}

/**
 * Define a vendor-agnostic entity. Sources later register that they provide
 * data for this entity shape.
 */
export function entity<TFields extends EntityFields, TActions extends EntityActions = EntityActions>(
  input: DefineEntityInput<TFields, TActions>,
): EntityDef<TFields, TActions> {
  return {
    id: input.id,
    fields: input.fields,
    actions: (input.actions ?? {}) as TActions,
    schema: z.object(input.fields),
  };
}

/**
 * Helper for declaring an action capability on an entity.
 */
export function capability<TArgs extends z.ZodTypeAny = z.ZodNever>(
  scope: string,
  args?: TArgs,
): CapabilityDef<TArgs> {
  const def: CapabilityDef<TArgs> = { scope };
  if (args) def.args = args;
  return def;
}
