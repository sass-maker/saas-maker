"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { apiFetchClient, getClientToken } from "@/lib/api-client";

interface ResponseActionsProps {
  responseId: string;
  projectId: string;
  formId: string;
}

export function ResponseActions({
  responseId,
  projectId,
  formId,
}: ResponseActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this response?")) return;
    setLoading(true);
    try {
      const token = await getClientToken();
      await apiFetchClient(
        `/v1/forms/dashboard/${projectId}/${formId}/responses/${responseId}`,
        token,
        { method: "DELETE" }
      );
      router.refresh();
    } catch (e) {
      console.error("Failed to delete response:", e);
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleDelete}
      disabled={loading}
      className="h-8 w-8"
      title="Delete response"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  );
}
