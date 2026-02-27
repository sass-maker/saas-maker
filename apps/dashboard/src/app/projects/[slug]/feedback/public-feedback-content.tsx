"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ArrowDownUp, ThumbsUp, MessageSquare } from "lucide-react";
import type { FeedbackRecord } from "@/components/feedback-types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

const TYPE_STYLES: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  bug: { label: "Bug", variant: "destructive" },
  feature: { label: "Feature", variant: "default" },
  feedback: { label: "Feedback", variant: "secondary" },
};

const STATUS_STYLES: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  new: { label: "New", variant: "default" },
  in_progress: { label: "In Progress", variant: "secondary" },
  done: { label: "Done", variant: "outline" },
  dismissed: { label: "Dismissed", variant: "outline" },
};

interface Props {
  slug: string;
}

export function PublicFeedbackContent({ slug }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const typeFilter = searchParams.get("type") ?? "all";
  const statusFilter = searchParams.get("status") ?? "all";
  const sort = searchParams.get("sort") ?? "newest";

  const [feedback, setFeedback] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = feedback.find((f) => f.id === selectedId) ?? null;

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all") params.delete(key);
      else params.set(key, value);
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("sort", sort === "upvotes" ? "upvotes" : "newest");

      const qs = params.toString();
      const res = await fetch(
        `${API_BASE}/v1/feedback/by-project/${slug}${qs ? `?${qs}` : ""}`
      );
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

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={typeFilter} onValueChange={(v) => updateParam("type", v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="bug">Bug</SelectItem>
            <SelectItem value="feature">Feature</SelectItem>
            <SelectItem value="feedback">Feedback</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => updateParam("status", v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            updateParam("sort", sort === "newest" ? "upvotes" : "newest")
          }
          className="gap-2"
        >
          <ArrowDownUp className="h-4 w-4" />
          {sort === "newest" ? "Newest" : "Most Upvoted"}
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="rounded-md border">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border-b p-3 flex gap-4 items-center">
              <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-48 animate-pulse rounded bg-muted flex-1" />
              <div className="h-4 w-8 animate-pulse rounded bg-muted" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-destructive text-center py-8">{error}</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-[80px] text-center">Upvotes</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="hidden md:table-cell w-[120px]">
                  Date
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feedback.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-32 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <MessageSquare className="h-8 w-8" />
                      <p>No feedback yet. Be the first to share!</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                feedback.map((item) => {
                  const typeStyle = TYPE_STYLES[item.type] ?? {
                    label: item.type,
                    variant: "outline" as const,
                  };
                  const statusStyle = STATUS_STYLES[item.status] ?? {
                    label: item.status,
                    variant: "outline" as const,
                  };
                  return (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedId(item.id)}
                    >
                      <TableCell>
                        <Badge variant={typeStyle.variant}>
                          {typeStyle.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell className="text-center">
                        {item.upvote_count}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusStyle.variant}>
                          {statusStyle.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail sheet (read-only) */}
      <Sheet
        open={selectedId !== null}
        onOpenChange={(v) => !v && setSelectedId(null)}
      >
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      (TYPE_STYLES[selected.type]?.variant as "default") ??
                      "outline"
                    }
                  >
                    {TYPE_STYLES[selected.type]?.label ?? selected.type}
                  </Badge>
                  <Badge
                    variant={
                      (STATUS_STYLES[selected.status]?.variant as "default") ??
                      "outline"
                    }
                  >
                    {STATUS_STYLES[selected.status]?.label ?? selected.status}
                  </Badge>
                </div>
                <SheetTitle className="text-left">{selected.title}</SheetTitle>
                <SheetDescription className="text-left">
                  Submitted{" "}
                  {new Date(selected.created_at).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Description
                  </h4>
                  <p className="text-sm leading-relaxed">
                    {selected.description || "No description provided."}
                  </p>
                </div>

                {selected.image_url && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      Attachment
                    </h4>
                    <img
                      src={selected.image_url}
                      alt="Feedback attachment"
                      className="rounded-md border max-h-64 object-contain"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <ThumbsUp className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {selected.upvote_count} upvote
                    {selected.upvote_count !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
