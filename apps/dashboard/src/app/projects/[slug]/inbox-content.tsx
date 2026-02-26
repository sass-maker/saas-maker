"use client";

import { useSearchParams } from "next/navigation";
import { FilterBar } from "@/components/filter-bar";
import { FeedbackTable } from "@/components/feedback-table";
import type { FeedbackRecord } from "@/components/feedback-types";

const MOCK_FEEDBACK: FeedbackRecord[] = [
  {
    id: "1",
    project_id: "1",
    type: "bug",
    status: "new",
    title: "Login button not working on mobile",
    description:
      "When I try to tap the login button on my iPhone 15, nothing happens. I have to refresh the page and try again. This has been happening consistently for the past two days.",
    image_url: null,
    submitter_email: "user@example.com",
    submitter_name: "Jane Doe",
    upvote_count: 5,
    created_at: "2026-02-25T10:00:00Z",
  },
  {
    id: "2",
    project_id: "1",
    type: "feature",
    status: "in_progress",
    title: "Add dark mode support",
    description:
      "It would be great to have a dark mode option. My eyes get strained when using the app at night. Many modern apps support this feature.",
    image_url: null,
    submitter_email: "dev@example.com",
    submitter_name: "John Smith",
    upvote_count: 12,
    created_at: "2026-02-24T08:00:00Z",
  },
  {
    id: "3",
    project_id: "1",
    type: "feedback",
    status: "done",
    title: "Great onboarding experience!",
    description:
      "Just wanted to say that the onboarding flow is really well designed. The step-by-step tutorial made it super easy to get started.",
    image_url: null,
    submitter_email: "happy@example.com",
    submitter_name: null,
    upvote_count: 3,
    created_at: "2026-02-23T15:00:00Z",
  },
];

export function InboxContent() {
  const searchParams = useSearchParams();

  const typeFilter = searchParams.get("type") ?? "all";
  const statusFilter = searchParams.get("status") ?? "all";
  const sort = searchParams.get("sort") ?? "newest";

  let filtered = MOCK_FEEDBACK;

  if (typeFilter !== "all") {
    filtered = filtered.filter((f) => f.type === typeFilter);
  }
  if (statusFilter !== "all") {
    filtered = filtered.filter((f) => f.status === statusFilter);
  }

  if (sort === "upvotes") {
    filtered = [...filtered].sort((a, b) => b.upvote_count - a.upvote_count);
  } else {
    filtered = [...filtered].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  return (
    <div className="space-y-4">
      <FilterBar />
      <FeedbackTable feedback={filtered} />
    </div>
  );
}
