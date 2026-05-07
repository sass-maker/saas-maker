import type { ComponentType } from 'react';

export interface BlockRenderProps<TRow = unknown> {
  /** Rows resolved from the binding (empty array if no binding). */
  data: TRow[];
  /** True while the binding fetch is in flight. */
  loading: boolean;
  /** Set if the binding fetch threw. */
  error?: Error;
  /** Block-specific props from the spec. */
  props: Record<string, unknown>;
  /** Block id from the spec. */
  blockId: string;
}

export type BlockComponent<TRow = unknown> = ComponentType<BlockRenderProps<TRow>>;
