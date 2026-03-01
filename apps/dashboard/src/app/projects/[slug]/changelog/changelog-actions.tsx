"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Trash2, Loader2 } from "lucide-react";
import { apiFetchClient, getClientToken } from "@/lib/api-client";

interface ChangelogActionsProps {
  entryId: string;
  projectId: string;
  isPublished: boolean;
}

export function ChangelogActions({
  entryId,
  projectId,
  isPublished,
}: ChangelogActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleTogglePublish() {
    const action = isPublished ? "unpublish" : "publish";
    setLoading(action);
    try {
      const token = await getClientToken();
      await apiFetchClient(
        `/v1/changelog/dashboard/${projectId}/${entryId}`,
        token,
        { method: "PATCH", body: JSON.stringify({ published: !isPublished }) }
      );
      router.refresh();
    } catch (e) {
      console.error("Failed to update changelog entry:", e);
      setLoading(null);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this changelog entry?")) return;
    setLoading("delete");
    try {
      const token = await getClientToken();
      await apiFetchClient(
        `/v1/changelog/dashboard/${projectId}/${entryId}`,
        token,
        { method: "DELETE" }
      );
      router.refresh();
    } catch (e) {
      console.error("Failed to delete changelog entry:", e);
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleTogglePublish}
        disabled={loading !== null}
        className="h-8 w-8"
        title={isPublished ? "Unpublish" : "Publish"}
      >
        {loading === "publish" || loading === "unpublish" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isPublished ? (
          <EyeOff className="h-4 w-4 text-orange-500" />
        ) : (
          <Eye className="h-4 w-4 text-green-600" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDelete}
        disabled={loading !== null}
        className="h-8 w-8"
        title="Delete"
      >
        {loading === "delete" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>
    </div>
  );
}
