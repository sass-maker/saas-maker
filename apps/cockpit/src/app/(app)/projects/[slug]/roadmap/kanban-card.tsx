'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Lock, MessageSquare } from 'lucide-react';
import type { RoadmapItemRecord } from '@saas-maker/contracts';

interface KanbanCardProps {
  item: RoadmapItemRecord;
  onClick: () => void;
}

export function KanbanCard({ item, onClick }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-3 cursor-grab active:cursor-grabbing hover:border-foreground/20 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium leading-tight">{item.title}</h4>
        <div className="flex items-center gap-1 shrink-0">
          {!item.public && <Lock className="h-3 w-3 text-muted-foreground" />}
          {item.feedback_id && <MessageSquare className="h-3 w-3 text-muted-foreground" />}
        </div>
      </div>
      {item.description && (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.description}</p>
      )}
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>&#9650; {item.upvote_count}</span>
        {item.downvote_count > 0 && <span>&#9660; {item.downvote_count}</span>}
      </div>
    </Card>
  );
}
