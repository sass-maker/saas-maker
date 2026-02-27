"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FilterBar } from "@/components/filter-bar";
import { FeedbackTable } from "@/components/feedback-table";
import type { FeedbackRecord, FeedbackStatus } from "@/components/feedback-types";
import { apiFetch } from "@/lib/api";
// apiFetch still used for auth'd writes (status change, delete)

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

interface InboxContentProps {
  slug: string;
}

async function getToken(): Promise<string> {
  const res = await fetch("/api/token");
  if (!res.ok) throw new Error("Failed to get auth token");
  const data = await res.json();
  return data.token;
}

export function InboxContent({ slug }: InboxContentProps) {
  const searchParams = useSearchParams();

  const typeFilter = searchParams.get("type") ?? "all";
  const statusFilter = searchParams.get("status") ?? "all";
  const sort = searchParams.get("sort") ?? "newest";

  const [feedback, setFeedback] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("sort", sort === "upvotes" ? "upvotes" : "newest");

      const qs = params.toString();
      const res = await fetch(`${API_BASE}/v1/feedback/by-project/${slug}${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to load feedback");
      const data = await res.json();
      setFeedback(data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feedback");
    } finally {
      setLoading(false);
    }
  }, [slug, typeFilter, statusFilter, sort]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  async function handleStatusChange(id: string, status: FeedbackStatus) {
    const token = await getToken();
    const updated: FeedbackRecord = await apiFetch(
      `/v1/feedback/${id}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      token
    );
    setFeedback((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updated } : f))
    );
  }

  async function handleDelete(id: string) {
    const token = await getToken();
    await apiFetch(`/v1/feedback/${id}`, { method: "DELETE" }, token);
    setFeedback((prev) => prev.filter((f) => f.id !== id));
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <FilterBar />
        <div className="rounded-md border">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="border-b p-3 flex gap-4 items-center">
              <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-48 animate-pulse rounded bg-muted flex-1" />
              <div className="h-4 w-32 animate-pulse rounded bg-muted hidden sm:block" />
              <div className="h-4 w-8 animate-pulse rounded bg-muted" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <FilterBar />
        <div className="text-destructive text-center py-8">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FilterBar />
      <FeedbackTable
        feedback={feedback}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
      />
    </div>
  );
}
