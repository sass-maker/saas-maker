import { ListBlock } from './list.js';
import { MetricCardBlock } from './metric-card.js';
import { TableBlock } from './table.js';
import { UnknownBlock } from './empty.js';
import type { BlockComponent } from './types.js';

export type BlockRegistry = Record<string, BlockComponent>;

export const defaultBlocks: BlockRegistry = {
  MetricCard: MetricCardBlock,
  List: ListBlock,
  Table: TableBlock,
};

export { UnknownBlock };
