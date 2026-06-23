'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { KanbanColumn } from './kanban-column';
import { KanbanCard } from './kanban-card';
import { CreateRoadmapItemDialog } from './create-roadmap-item-dialog';
import { apiFetchClient, getClientToken } from '@/lib/api-client';
import type { RoadmapItemRecord, RoadmapColumn } from '@saas-maker/contracts';

const COLUMNS: RoadmapColumn[] = ['backlog', 'planned', 'in_progress', 'done'];

interface Props {
  projectId: string;
  initialItems: RoadmapItemRecord[];
}

export function RoadmapBoard({ projectId, initialItems }: Props) {
  const [items, setItems] = useState<RoadmapItemRecord[]>(initialItems);
  const [activeItem, setActiveItem] = useState<RoadmapItemRecord | null>(null);
  const [addColumn, setAddColumn] = useState<RoadmapColumn | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function getColumnItems(col: RoadmapColumn) {
    return items.filter((i) => i.column === col).sort((a, b) => a.position - b.position);
  }

  function findColumnForItem(id: string): RoadmapColumn | null {
    const item = items.find((i) => i.id === id);
    return item ? item.column : null;
  }

  function handleDragStart(event: DragStartEvent) {
    const item = items.find((i) => i.id === event.active.id);
    if (item) setActiveItem(item);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeCol = findColumnForItem(activeId);
    const overCol = COLUMNS.includes(overId as RoadmapColumn)
      ? (overId as RoadmapColumn)
      : findColumnForItem(overId);

    if (!activeCol || !overCol || activeCol === overCol) return;

    setItems((prev) =>
      prev.map((item) => (item.id === activeId ? { ...item, column: overCol } : item))
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveItem(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeCol = findColumnForItem(activeId);
    if (!activeCol) return;

    const colItems = getColumnItems(activeCol);
    const activeIndex = colItems.findIndex((i) => i.id === activeId);

    let overIndex: number;
    if (COLUMNS.includes(overId as RoadmapColumn)) {
      overIndex = colItems.length - 1;
    } else {
      overIndex = colItems.findIndex((i) => i.id === overId);
    }

    if (activeIndex !== overIndex && overIndex >= 0) {
      const reordered = arrayMove(colItems, activeIndex, overIndex);
      setItems((prev) => {
        const others = prev.filter((i) => i.column !== activeCol);
        return [...others, ...reordered.map((item, i) => ({ ...item, position: i }))];
      });
    }

    // Persist reorder
    const finalColItems = getColumnItems(activeCol);
    persistReorder(
      finalColItems.map((item, i) => ({ id: item.id, column: activeCol, position: i }))
    );
  }

  async function persistReorder(
    updates: { id: string; column: RoadmapColumn; position: number }[]
  ) {
    try {
      const token = await getClientToken();
      await apiFetchClient(`/v1/roadmap/dashboard/${projectId}/reorder`, token, {
        method: 'POST',
        body: JSON.stringify({ items: updates }),
      });
    } catch {
      // Silently fail — next refresh will correct
    }
  }

  function handleItemCreated(item: RoadmapItemRecord) {
    setItems((prev) => [...prev, item]);
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-4 gap-4">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col}
              column={col}
              items={getColumnItems(col)}
              onAddClick={() => setAddColumn(col)}
              onCardClick={() => {}}
            />
          ))}
        </div>
        <DragOverlay>
          {activeItem ? <KanbanCard item={activeItem} onClick={() => {}} /> : null}
        </DragOverlay>
      </DndContext>

      {addColumn && (
        <CreateRoadmapItemDialog
          projectId={projectId}
          column={addColumn}
          open={!!addColumn}
          onOpenChange={(open) => {
            if (!open) setAddColumn(null);
          }}
          onCreated={handleItemCreated}
        />
      )}
    </>
  );
}
