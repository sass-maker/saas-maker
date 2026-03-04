"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Trash2, ExternalLink, Copy, Loader2 } from "lucide-react";
import { apiFetchClient, getClientToken } from "@/lib/api-client";

interface FormActionsProps {
  formId: string;
  projectId: string;
  projectSlug: string;
}

export function FormActions({
  formId,
  projectId,
  projectSlug,
}: FormActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("Delete this form and all its responses?")) return;
    setLoading("delete");
    try {
      const token = await getClientToken();
      await apiFetchClient(
        `/v1/forms/dashboard/${projectId}/${formId}`,
        token,
        { method: "DELETE" }
      );
      router.refresh();
    } catch (e) {
      console.error("Failed to delete form:", e);
      setLoading(null);
    }
  }

  function copyShareLink() {
    const url = `${window.location.origin}/s/${projectSlug}`;
    navigator.clipboard.writeText(url);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={loading !== null}
          className="h-8 w-8"
        >
          {loading !== null ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreVertical className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() =>
            router.push(`/projects/${projectSlug}/forms/${formId}`)
          }
        >
          <ExternalLink />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyShareLink}>
          <Copy />
          Copy Link
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={handleDelete}>
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
