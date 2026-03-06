"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThumbsUp } from "lucide-react";
import type { RoadmapItemRecord, RoadmapColumn } from "@saas-maker/shared-types";

const COLUMNS: RoadmapColumn[] = ["backlog", "planned", "in_progress", "done"];
const COLUMN_LABELS: Record<RoadmapColumn, string> = {
  backlog: "Backlog",
  planned: "Planned",
  in_progress: "In Progress",
  done: "Done",
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

interface Props {
  slug: string;
  initialItems: RoadmapItemRecord[];
}

export function PublicRoadmap({ slug, initialItems }: Props) {
  const [items, setItems] = useState(initialItems);

  function getColumnItems(col: RoadmapColumn) {
    return items.filter((i) => i.column === col).sort((a, b) => a.position - b.position);
  }

  async function handleUpvote(itemId: string) {
    let userId = localStorage.getItem("roadmap_user_id");
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem("roadmap_user_id", userId);
    }

    try {
      await fetch(`${API_BASE}/v1/roadmap/public/${slug}/${itemId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_identifier: userId, vote: 1 }),
      });
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, upvote_count: i.upvote_count + 1 } : i))
      );
    } catch {
      // Silently fail
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {COLUMNS.map((col) => {
        const colItems = getColumnItems(col);
        return (
          <div key={col} className="flex flex-col rounded-lg border bg-muted/30 p-3 min-h-[200px]">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold">{COLUMN_LABELS[col]}</h3>
              <Badge variant="secondary" className="text-xs">{colItems.length}</Badge>
            </div>
            <div className="flex flex-col gap-2 flex-1">
              {colItems.map((item) => (
                <Card key={item.id} className="p-3">
                  <h4 className="text-sm font-medium">{item.title}</h4>
                  {item.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{item.description}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleUpvote(item.id)}
                    >
                      <ThumbsUp className="h-3 w-3 mr-1" />
                      {item.upvote_count}
                    </Button>
                  </div>
                </Card>
              ))}
              {colItems.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No items</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
