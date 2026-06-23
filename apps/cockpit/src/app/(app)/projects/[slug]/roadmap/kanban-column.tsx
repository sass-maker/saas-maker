'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard } from './kanban-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import type { RoadmapItemRecord, RoadmapColumn } from '@saas-maker/contracts';

const COLUMN_LABELS: Record<RoadmapColumn, string> = {
  backlog: 'Backlog',
  planned: 'Planned',
  in_progress: 'In Progress',
  done: 'Done',
};

interface KanbanColumnProps {
  column: RoadmapColumn;
  items: RoadmapItemRecord[];
  onAddClick: () => void;
  onCardClick: (item: RoadmapItemRecord) => void;
}

export function KanbanColumn({ column, items, onAddClick, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-lg border bg-muted/30 p-3 min-h-[200px] ${
        isOver ? 'border-foreground/30 bg-muted/50' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{COLUMN_LABELS[column]}</h3>
          <Badge variant="secondary" className="text-xs">
            {items.length}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onAddClick}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 flex-1">
          {items.map((item) => (
            <KanbanCard key={item.id} item={item} onClick={() => onCardClick(item)} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
