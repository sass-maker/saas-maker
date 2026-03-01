"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { FeedbackRecord, FeatureRequestStatus } from "@saas-maker/shared-types";
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
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ArrowDownUp,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  MessageSquare,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

type BoardStatus = FeatureRequestStatus;

const STATUS_COLUMNS: Array<{
  value: BoardStatus;
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
}> = [
  { value: "planned", label: "Planned", variant: "default" },
  { value: "in_progress", label: "In Progress", variant: "secondary" },
  { value: "shipped", label: "Shipped", variant: "secondary" },
  { value: "cancelled", label: "Cancelled", variant: "destructive" },
];

const STATUS_STYLE_MAP = Object.fromEntries(
  STATUS_COLUMNS.map((column) => [column.value, column])
) as Record<BoardStatus, (typeof STATUS_COLUMNS)[number]>;

interface Props {
  slug: string;
}

async function getClientToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/token");
    if (!res.ok) return null;
    const data = await res.json();
    return data.token as string;
  } catch {
    return null;
  }
}

function withVote(item: FeedbackRecord, vote: "up" | "down" | null): FeedbackRecord {
  const prev = item.viewer_vote ?? null;
  let up = item.upvote_count;
  let down = item.downvote_count;

  if (prev === "up") up = Math.max(up - 1, 0);
  if (prev === "down") down = Math.max(down - 1, 0);
  if (vote === "up") up += 1;
  if (vote === "down") down += 1;

  return {
    ...item,
    upvote_count: up,
    downvote_count: down,
    viewer_vote: vote,
  };
}

export function PublicFeedbackContent({ slug }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const statusFilter = searchParams.get("status") ?? "all";
  const sort = searchParams.get("sort") ?? "upvotes";

  const [feedback, setFeedback] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [votePendingId, setVotePendingId] = useState<string | null>(null);
  const [statusPendingId, setStatusPendingId] = useState<string | null>(null);

  const selected = feedback.find((item) => item.id === selectedId) ?? null;

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all") params.delete(key);
      else params.set(key, value);
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const checkOwnerAccess = useCallback(
    async (activeToken: string | null) => {
      if (!activeToken) {
        setCanManage(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/v1/projects`, {
          headers: { Authorization: `Bearer ${activeToken}` },
        });
        if (!res.ok) {
          setCanManage(false);
          return;
        }
        const data = await res.json();
        const projects = (data.data ?? []) as Array<{ slug: string }>;
        setCanManage(projects.some((project) => project.slug === slug));
      } catch {
        setCanManage(false);
      }
    },
    [slug]
  );

  const fetchFeedback = useCallback(
    async (activeToken: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("type", "feature");
        if (statusFilter !== "all") params.set("status", statusFilter);
        params.set("sort", sort === "newest" ? "newest" : "upvotes");

        const res = await fetch(
          `${API_BASE}/v1/feedback/by-project/${slug}?${params.toString()}`,
          {
            headers: activeToken
              ? { Authorization: `Bearer ${activeToken}` }
              : undefined,
          }
        );
        if (!res.ok) throw new Error("Failed to load feature requests");

        const data = await res.json();
        const rows = (data.data ?? []) as FeedbackRecord[];
        setFeedback(rows);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load feature requests"
        );
      } finally {
        setLoading(false);
      }
    },
    [slug, statusFilter, sort]
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const nextToken = await getClientToken();
      if (cancelled) return;
      setToken(nextToken);
      await Promise.all([
        checkOwnerAccess(nextToken),
        fetchFeedback(nextToken),
      ]);
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [checkOwnerAccess, fetchFeedback]);

  const grouped = useMemo(() => {
    const buckets: Record<BoardStatus, FeedbackRecord[]> = {
      planned: [],
      in_progress: [],
      shipped: [],
      cancelled: [],
    };

    for (const item of feedback) {
      const normalized =
        item.status === "planned" ||
        item.status === "in_progress" ||
        item.status === "shipped" ||
        item.status === "cancelled"
          ? item.status
          : "planned";
      buckets[normalized].push(item);
    }

    return buckets;
  }, [feedback]);

  const handleVote = useCallback(
    async (item: FeedbackRecord, target: "up" | "down") => {
      setActionError(null);
      if (!token) {
        setActionError("Please sign in using the button in the header to vote.");
        return;
      }

      const currentVote = item.viewer_vote ?? null;
      const nextVote = currentVote === target ? null : target;

      const endpoint =
        target === "up"
          ? `/v1/feedback/${item.id}/upvote`
          : `/v1/feedback/${item.id}/downvote`;
      const method = nextVote === null ? "DELETE" : "POST";

      setVotePendingId(item.id);
      try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
          method,
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Voting failed");
        }

        setFeedback((prev) =>
          prev.map((candidate) =>
            candidate.id === item.id ? withVote(candidate, nextVote) : candidate
          )
        );
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Voting failed");
      } finally {
        setVotePendingId(null);
      }
    },
    [token]
  );

  const handleStatusChange = useCallback(
    async (item: FeedbackRecord, nextStatus: BoardStatus) => {
      if (!canManage || !token || item.status === nextStatus) return;
      setActionError(null);
      setStatusPendingId(item.id);

      try {
        const res = await fetch(`${API_BASE}/v1/feedback/${item.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: nextStatus }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to update status");
        }

        setFeedback((prev) =>
          prev.map((candidate) =>
            candidate.id === item.id
              ? { ...candidate, status: nextStatus }
              : candidate
          )
        );
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "Failed to update status"
        );
      } finally {
        setStatusPendingId(null);
      }
    },
    [canManage, token]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => updateParam("status", v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Columns</SelectItem>
            {STATUS_COLUMNS.map((column) => (
              <SelectItem key={column.value} value={column.value}>
                {column.label}
              </SelectItem>
            ))}
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
          {sort === "newest" ? "Newest" : "Most Voted"}
        </Button>

        <Badge variant="outline" className="gap-2">
          <LayoutGrid className="h-3.5 w-3.5" />
          Public Kanban
        </Badge>
      </div>

      {canManage && (
        <p className="text-sm text-muted-foreground">
          Owner mode enabled. You can update request status directly from each card.
        </p>
      )}

      {actionError && (
        <p className="text-sm text-destructive">{actionError}</p>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STATUS_COLUMNS.map((column) => (
            <div key={column.value} className="rounded-md border p-3 space-y-3">
              <div className="h-5 w-28 animate-pulse rounded bg-muted" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-md border p-3 space-y-2">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-full animate-pulse rounded bg-muted" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-destructive text-center py-8">{error}</div>
      ) : feedback.length === 0 ? (
        <div className="rounded-md border py-12 text-center text-muted-foreground">
          <MessageSquare className="mx-auto h-8 w-8 mb-2" />
          No feature requests yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STATUS_COLUMNS.map((column) => {
            if (statusFilter !== "all" && statusFilter !== column.value) {
              return null;
            }

            const cards = grouped[column.value];
            return (
              <div key={column.value} className="rounded-md border bg-card">
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <Badge variant={column.variant}>{column.label}</Badge>
                  <span className="text-xs text-muted-foreground">{cards.length}</span>
                </div>

                <div className="space-y-3 p-3">
                  {cards.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No requests</p>
                  ) : (
                    cards.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-md border p-3 space-y-3 cursor-pointer hover:bg-muted/30"
                        onClick={() => setSelectedId(item.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm font-medium leading-snug">{item.title}</h3>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant={item.viewer_vote === "up" ? "default" : "outline"}
                              size="icon"
                              className="h-7 w-7"
                              disabled={votePendingId === item.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVote(item, "up");
                              }}
                              title="Upvote"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant={item.viewer_vote === "down" ? "destructive" : "outline"}
                              size="icon"
                              className="h-7 w-7"
                              disabled={votePendingId === item.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVote(item, "down");
                              }}
                              title="Downvote"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>

                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>▲ {item.upvote_count}</span>
                          <span>▼ {item.downvote_count}</span>
                          <span>Score {item.upvote_count - item.downvote_count}</span>
                        </div>

                        {canManage && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={
                                item.status === "planned" ||
                                item.status === "in_progress" ||
                                item.status === "shipped" ||
                                item.status === "cancelled"
                                  ? item.status
                                  : "planned"
                              }
                              onValueChange={(value) =>
                                handleStatusChange(item, value as BoardStatus)
                              }
                              disabled={statusPendingId === item.id}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_COLUMNS.map((statusOption) => (
                                  <SelectItem
                                    key={statusOption.value}
                                    value={statusOption.value}
                                  >
                                    {statusOption.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet
        open={selectedId !== null}
        onOpenChange={(open) => !open && setSelectedId(null)}
      >
        <SheetContent className="w-full sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="default">Feature</Badge>
                  <Badge
                    variant={
                      STATUS_STYLE_MAP[
                        (selected.status === "planned" ||
                        selected.status === "in_progress" ||
                        selected.status === "shipped" ||
                        selected.status === "cancelled"
                          ? selected.status
                          : "planned") as BoardStatus
                      ].variant
                    }
                  >
                    {
                      STATUS_STYLE_MAP[
                        (selected.status === "planned" ||
                        selected.status === "in_progress" ||
                        selected.status === "shipped" ||
                        selected.status === "cancelled"
                          ? selected.status
                          : "planned") as BoardStatus
                      ].label
                    }
                  </Badge>
                </div>
                <SheetTitle className="text-left">{selected.title}</SheetTitle>
                <SheetDescription className="text-left">
                  Submitted {" "}
                  {new Date(selected.created_at).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </SheetDescription>
              </SheetHeader>

              <SheetBody className="space-y-6">
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

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>▲ {selected.upvote_count}</span>
                  <span>▼ {selected.downvote_count}</span>
                  <span>Score {selected.upvote_count - selected.downvote_count}</span>
                </div>
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
