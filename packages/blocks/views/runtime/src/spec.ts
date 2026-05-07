import { z } from 'zod';

/**
 * A binding maps a logical name (used by blocks) to an entity query.
 * `source` may be omitted to let the graph pick the default provider.
 */
export const BindingSchema = z.object({
  source: z.string().optional(),
  entity: z.string(),
  filter: z.record(z.string(), z.unknown()).optional(),
  orderBy: z
    .object({
      field: z.string(),
      dir: z.enum(['asc', 'desc']),
    })
    .optional(),
  limit: z.number().int().positive().optional(),
});
export type Binding = z.infer<typeof BindingSchema>;

/**
 * Block spec - declarative description of one tile in a view. `binding` references
 * a key in `view.bindings`. `props` is block-specific (validated by the block itself).
 */
export const BlockSpecSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  binding: z.string().optional(),
  props: z.record(z.string(), z.unknown()).optional(),
  layout: z
    .object({
      x: z.number().int().nonnegative().optional(),
      y: z.number().int().nonnegative().optional(),
      w: z.number().int().positive().optional(),
      h: z.number().int().positive().optional(),
    })
    .optional(),
});
export type BlockSpec = z.infer<typeof BlockSpecSchema>;

export const ViewSpecSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  layout: z.enum(['grid', 'flex', 'stack']).default('grid'),
  bindings: z.record(z.string(), BindingSchema).default({}),
  blocks: z.array(BlockSpecSchema).default([]),
  version: z.number().int().nonnegative().default(1),
});
export type ViewSpec = z.infer<typeof ViewSpecSchema>;

/** Parse + validate a raw spec. Throws ZodError if invalid. */
export function parseViewSpec(input: unknown): ViewSpec {
  return ViewSpecSchema.parse(input);
}

export function safeParseViewSpec(
  input: unknown,
): { ok: true; spec: ViewSpec } | { ok: false; error: z.ZodError } {
  const result = ViewSpecSchema.safeParse(input);
  if (result.success) return { ok: true, spec: result.data };
  return { ok: false, error: result.error };
}
