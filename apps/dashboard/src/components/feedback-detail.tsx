"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ThumbsUp, Trash2 } from "lucide-react";
import type { FeedbackRecord, FeedbackStatus } from "@saasmaker/shared-types";

const TYPE_STYLES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  bug: { label: "Bug", variant: "destructive" },
  feature: { label: "Feature", variant: "default" },
  feedback: { label: "Feedback", variant: "secondary" },
};

interface FeedbackDetailProps {
  item: FeedbackRecord | null;
  open: boolean;
  onClose: () => void;
  onStatusChange?: (id: string, status: FeedbackStatus) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export function FeedbackDetail({ item, open, onClose, onStatusChange, onDelete }: FeedbackDetailProps) {
  const [status, setStatus] = useState<FeedbackStatus>(item?.status ?? "new");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Sync status when item changes
  if (item && item.status !== status && !open) {
    setStatus(item.status);
  }

  if (!item) return null;

  const typeStyle = TYPE_STYLES[item.type] ?? { label: item.type, variant: "outline" as const };

  async function handleStatusChange(value: string) {
    const newStatus = value as FeedbackStatus;
    setStatus(newStatus);
    if (onStatusChange && item) {
      setUpdating(true);
      try {
        await onStatusChange(item.id, newStatus);
      } finally {
        setUpdating(false);
      }
    }
  }

  async function handleDelete() {
    if (onDelete && item) {
      setDeleting(true);
      try {
        await onDelete(item.id);
      } finally {
        setDeleting(false);
      }
    }
    setConfirmDelete(false);
    onClose();
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <Badge variant={typeStyle.variant}>{typeStyle.label}</Badge>
            </div>
            <SheetTitle className="text-left">{item.title}</SheetTitle>
            <SheetDescription className="text-left">
              Submitted by {item.submitter_name ?? item.submitter_email}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Description */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Description</h4>
              <p className="text-sm leading-relaxed">
                {item.description || "No description provided."}
              </p>
            </div>

            {/* Image */}
            {item.image_url && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Attachment</h4>
                <img
                  src={item.image_url}
                  alt="Feedback attachment"
                  className="rounded-md border max-h-64 object-contain"
                />
              </div>
            )}

            {/* Upvotes */}
            <div className="flex items-center gap-2 text-sm">
              <ThumbsUp className="h-4 w-4 text-muted-foreground" />
              <span>{item.upvote_count} upvote{item.upvote_count !== 1 ? "s" : ""}</span>
            </div>

            {/* Submitter info */}
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-muted-foreground">Submitter</h4>
              <p className="text-sm">{item.submitter_email}</p>
              {item.submitter_name && (
                <p className="text-sm text-muted-foreground">{item.submitter_name}</p>
              )}
            </div>

            {/* Date */}
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-muted-foreground">Submitted</h4>
              <p className="text-sm">
                {new Date(item.created_at).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
              <Select value={status} onValueChange={handleStatusChange} disabled={updating}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Delete */}
            <div className="border-t pt-4">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete Feedback
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Feedback</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{item.title}&quot;? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
