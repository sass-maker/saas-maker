"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetchClient, getClientToken } from "@/lib/api-client";
import type {
  ChangelogEntryRecord,
  ChangelogEntryType,
  RoadmapColumn,
  RoadmapItemRecord,
} from "@saas-maker/shared-types";

type ProgressLane = "in_progress" | "planned" | "shipped";

interface ProgressBoardProps {
  projectId: string;
  initialRoadmap: RoadmapItemRecord[];
  initialChangelog: ChangelogEntryRecord[];
}

type EditTarget =
  | { lane: "in_progress" | "planned"; item?: RoadmapItemRecord }
  | { lane: "shipped"; item?: ChangelogEntryRecord };

const LANES: Array<{
  key: ProgressLane;
  title: string;
  description: string;
}> = [
  {
    key: "in_progress",
    title: "In Progress",
    description: "Public work actively moving now.",
  },
  {
    key: "planned",
    title: "Planned",
    description: "Public commitments that are up next.",
  },
  {
    key: "shipped",
    title: "Shipped",
    description: "Published updates users can already see.",
  },
];

export function ProgressBoard({
  projectId,
  initialRoadmap,
  initialChangelog,
}: ProgressBoardProps) {
  const [roadmap, setRoadmap] = useState(initialRoadmap);
  const [changelog, setChangelog] = useState(initialChangelog);
  const [target, setTarget] = useState<EditTarget | null>(null);

  const visibleChangelog = useMemo(
    () => changelog.filter((entry) => entry.published),
    [changelog]
  );

  function roadmapItems(column: RoadmapColumn) {
    return roadmap
      .filter((item) => item.column === column && item.public)
      .sort((a, b) => a.position - b.position);
  }

  function laneCount(lane: ProgressLane) {
    if (lane === "shipped") return visibleChangelog.length;
    return roadmapItems(lane).length;
  }

  async function deleteItem(lane: ProgressLane, id: string) {
    if (!confirm("Remove this public progress item?")) return;

    const token = await getClientToken();
    if (lane === "shipped") {
      await apiFetchClient(`/v1/changelog/dashboard/${projectId}/${id}`, token, {
        method: "DELETE",
      });
      setChangelog((prev) => prev.filter((entry) => entry.id !== id));
      return;
    }

    await apiFetchClient(`/v1/roadmap/dashboard/${projectId}/${id}`, token, {
      method: "DELETE",
    });
    setRoadmap((prev) => prev.filter((item) => item.id !== id));
  }

  function upsertRoadmap(item: RoadmapItemRecord) {
    setRoadmap((prev) => {
      const exists = prev.some((current) => current.id === item.id);
      if (!exists) return [...prev, item];
      return prev.map((current) => (current.id === item.id ? item : current));
    });
  }

  function upsertChangelog(entry: ChangelogEntryRecord) {
    setChangelog((prev) => {
      const exists = prev.some((current) => current.id === entry.id);
      if (!exists) return [entry, ...prev];
      return prev.map((current) => (current.id === entry.id ? entry : current));
    });
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        {LANES.map((lane) => (
          <section
            key={lane.key}
            className="min-h-[420px] rounded-lg border bg-background"
          >
            <div className="flex items-start justify-between gap-3 border-b p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">{lane.title}</h2>
                  <Badge variant="secondary">{laneCount(lane.key)}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lane.description}
                </p>
              </div>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 shrink-0"
                title={`Add ${lane.title}`}
                onClick={() => setTarget({ lane: lane.key })}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3 p-3">
              {lane.key === "shipped"
                ? visibleChangelog.map((entry) => (
                    <ProgressCard
                      key={entry.id}
                      title={entry.title}
                      body={entry.content}
                      meta={entry.version ?? entry.type}
                      onEdit={() => setTarget({ lane: "shipped", item: entry })}
                      onDelete={() => deleteItem("shipped", entry.id)}
                    />
                  ))
                : roadmapItems(lane.key).map((item) => {
                    const roadmapLane = lane.key as "in_progress" | "planned";
                    return (
                      <ProgressCard
                        key={item.id}
                        title={item.title}
                        body={item.description ?? ""}
                        meta="Public roadmap"
                        onEdit={() => setTarget({ lane: roadmapLane, item })}
                        onDelete={() => deleteItem(roadmapLane, item.id)}
                      />
                    );
                  })}

              {laneCount(lane.key) === 0 && (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No public progress yet.
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      <ProgressEditor
        projectId={projectId}
        target={target}
        onClose={() => setTarget(null)}
        onRoadmapSaved={upsertRoadmap}
        onChangelogSaved={upsertChangelog}
      />
    </>
  );
}

function ProgressCard({
  title,
  body,
  meta,
  onEdit,
  onDelete,
}: {
  title: string;
  body: string;
  meta: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium leading-5">{title}</h3>
          {body && (
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">
              {body}
            </p>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">{meta}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            title="Edit"
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive"
            title="Delete"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ProgressEditor({
  projectId,
  target,
  onClose,
  onRoadmapSaved,
  onChangelogSaved,
}: {
  projectId: string;
  target: EditTarget | null;
  onClose: () => void;
  onRoadmapSaved: (item: RoadmapItemRecord) => void;
  onChangelogSaved: (entry: ChangelogEntryRecord) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOpen = target !== null;
  const isShipped = target?.lane === "shipped";
  const existing = target?.item;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [version, setVersion] = useState("");

  useEffect(() => {
    if (!target) return;
    const targetItem = target.item;
    setTitle(targetItem?.title ?? "");
    setBody(
      target.lane === "shipped"
        ? (targetItem as ChangelogEntryRecord | undefined)?.content ?? ""
        : (targetItem as RoadmapItemRecord | undefined)?.description ?? ""
    );
    setVersion((targetItem as ChangelogEntryRecord | undefined)?.version ?? "");
    setError(null);
  }, [target]);

  function syncForm(open: boolean) {
    if (!open) {
      onClose();
      setError(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;

    setLoading(true);
    setError(null);

    try {
      const token = await getClientToken();
      if (target.lane === "shipped") {
        const payload = {
          title: title.trim(),
          content: body.trim(),
          version: version.trim() || undefined,
          type: (existing as ChangelogEntryRecord | undefined)?.type ?? ("improvement" satisfies ChangelogEntryType),
          published: true,
        };
        const entry = await apiFetchClient<ChangelogEntryRecord>(
          existing
            ? `/v1/changelog/dashboard/${projectId}/${existing.id}`
            : `/v1/changelog/dashboard/${projectId}`,
          token,
          {
            method: existing ? "PATCH" : "POST",
            body: JSON.stringify(payload),
          }
        );
        onChangelogSaved(entry);
      } else {
        const payload = {
          title: title.trim(),
          description: body.trim() || undefined,
          column: target.lane,
          public: true,
        };
        const item = await apiFetchClient<RoadmapItemRecord>(
          existing
            ? `/v1/roadmap/dashboard/${projectId}/${existing.id}`
            : `/v1/roadmap/dashboard/${projectId}`,
          token,
          {
            method: existing ? "PATCH" : "POST",
            body: JSON.stringify(payload),
          }
        );
        onRoadmapSaved(item);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save progress");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={syncForm}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {existing ? "Edit" : "Add"} {isShipped ? "shipped update" : "progress item"}
            </DialogTitle>
            <DialogDescription>
              Public progress is user-facing and separate from internal tasks.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="progress-title">Title *</Label>
              <Input
                id="progress-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="progress-body">
                {isShipped ? "Changelog copy *" : "Description"}
              </Label>
              <Textarea
                id="progress-body"
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required={isShipped}
              />
            </div>
            {isShipped && (
              <div className="grid gap-2">
                <Label htmlFor="progress-version">Version</Label>
                <Input
                  id="progress-version"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="1.2.0"
                />
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !title.trim() || (isShipped && !body.trim())}
            >
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
