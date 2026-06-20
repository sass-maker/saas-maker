"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Check, X, Trash2, Loader2 } from "lucide-react";
import { apiFetchClient, getClientToken } from "@/lib/api-client";
import type { TestimonialStatus } from "@saas-maker/contracts";

interface TestimonialActionsProps {
  testimonialId: string;
  projectId: string;
  currentStatus: TestimonialStatus;
}

export function TestimonialActions({
  testimonialId,
  projectId,
  currentStatus,
}: TestimonialActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleStatusChange(status: TestimonialStatus) {
    setLoading(status);
    try {
      const token = await getClientToken();
      await apiFetchClient(
        `/v1/testimonials/${testimonialId}?project_id=${projectId}`,
        token,
        { method: "PATCH", body: JSON.stringify({ status }) }
      );
      router.refresh();
    } catch (e) {
      console.error("Failed to update testimonial:", e);
      setLoading(null);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this testimonial?")) return;
    setLoading("delete");
    try {
      const token = await getClientToken();
      await apiFetchClient(
        `/v1/testimonials/${testimonialId}?project_id=${projectId}`,
        token,
        { method: "DELETE" }
      );
      router.refresh();
    } catch (e) {
      console.error("Failed to delete testimonial:", e);
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-1">
      {currentStatus !== "approved" && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleStatusChange("approved")}
          disabled={loading !== null}
          className="h-8 w-8"
          title="Approve"
        >
          {loading === "approved" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4 text-green-600" />
          )}
        </Button>
      )}
      {currentStatus !== "rejected" && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleStatusChange("rejected")}
          disabled={loading !== null}
          className="h-8 w-8"
          title="Reject"
        >
          {loading === "rejected" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4 text-orange-500" />
          )}
        </Button>
      )}
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
