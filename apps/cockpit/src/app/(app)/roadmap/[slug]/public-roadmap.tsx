"use client";

import { useState } from "react";
import { ThumbsUp, Lightbulb, ChevronRight, CheckCircle2, Clock, Rocket } from "lucide-react";
import type { RoadmapItemRecord, RoadmapColumn } from "@saas-maker/shared-types";

const PUBLIC_COLUMNS: RoadmapColumn[] = ["planned", "in_progress", "done"];

const COLUMN_CONFIG: Record<
  Extract<RoadmapColumn, "planned" | "in_progress" | "done">,
  { label: string; icon: React.ReactNode; accent: string; badge: string }
> = {
  planned: {
    label: "Planned",
    icon: <Clock className="h-4 w-4" />,
    accent: "border-blue-500/30 bg-blue-500/5",
    badge: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  },
  in_progress: {
    label: "In Progress",
    icon: <Rocket className="h-4 w-4" />,
    accent: "border-amber-500/30 bg-amber-500/5",
    badge: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  },
  done: {
    label: "Done",
    icon: <CheckCircle2 className="h-4 w-4" />,
    accent: "border-green-500/30 bg-green-500/5",
    badge: "bg-green-500/10 text-green-400 border border-green-500/20",
  },
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.sassmaker.com";

interface Props {
  slug: string;
  initialItems: RoadmapItemRecord[];
}

export function PublicRoadmap({ slug, initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [votingId, setVotingId] = useState<string | null>(null);

  // Submit idea state
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function getEmail(): string {
    if (email.trim()) return email.trim();
    const stored = typeof window !== "undefined" ? localStorage.getItem("roadmap_email") : null;
    return stored ?? "";
  }

  function getColumnItems(col: RoadmapColumn) {
    return items
      .filter((i) => i.column === col)
      .sort((a, b) => b.upvote_count - a.upvote_count || a.position - b.position);
  }

  async function handleUpvote(itemId: string) {
    if (votedIds.has(itemId) || votingId) return;

    const userEmail = getEmail();
    if (!userEmail) {
      const promptedEmail = window.prompt("Enter your email to vote:");
      if (!promptedEmail?.trim()) return;
      localStorage.setItem("roadmap_email", promptedEmail.trim());
    } else {
      localStorage.setItem("roadmap_email", userEmail);
    }

    const identifier = localStorage.getItem("roadmap_email") ?? userEmail;
    setVotingId(itemId);

    try {
      const res = await fetch(`${API_BASE}/v1/roadmap/public/${slug}/${itemId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_identifier: identifier, vote: 1 }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) => (i.id === itemId ? { ...i, upvote_count: i.upvote_count + 1 } : i))
        );
        setVotedIds((prev) => new Set([...prev, itemId]));
      }
    } catch {
      // Silently fail
    } finally {
      setVotingId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`${API_BASE}/v1/roadmap/public/${slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), email: email.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error ?? "Submission failed");
      }

      localStorage.setItem("roadmap_email", email.trim());
      setSubmitted(true);
      setTitle("");
      setDescription("");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const totalItems = items.filter((i) => PUBLIC_COLUMNS.includes(i.column as any)).length;

  return (
    <div className="space-y-10">
      {/* Kanban columns */}
      {totalItems === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-sm text-neutral-500">
          No public roadmap items yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PUBLIC_COLUMNS.map((col) => {
            const cfg = COLUMN_CONFIG[col as keyof typeof COLUMN_CONFIG];
            const colItems = getColumnItems(col);
            return (
              <div
                key={col}
                className={`flex flex-col rounded-xl border p-4 min-h-[220px] ${cfg.accent}`}
              >
                {/* Column header */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-neutral-400">{cfg.icon}</span>
                  <h3 className="text-sm font-semibold text-neutral-100">{cfg.label}</h3>
                  <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
                    {colItems.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2 flex-1">
                  {colItems.map((item) => {
                    const voted = votedIds.has(item.id);
                    const loading = votingId === item.id;
                    return (
                      <div
                        key={item.id}
                        className="group rounded-lg border border-neutral-700/50 bg-neutral-900/60 p-3 transition-all hover:border-neutral-600 hover:bg-neutral-900"
                      >
                        <div className="flex items-start gap-3">
                          {/* Vote button */}
                          <button
                            onClick={() => handleUpvote(item.id)}
                            disabled={voted || !!loading}
                            className={`flex flex-col items-center gap-0.5 rounded-md border px-2 py-1.5 text-xs font-semibold transition-all shrink-0 ${
                              voted
                                ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-400 cursor-default"
                                : "border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 hover:text-indigo-400"
                            }`}
                            title={voted ? "Voted" : "Upvote"}
                          >
                            <ThumbsUp className={`h-3 w-3 ${loading ? "animate-pulse" : ""}`} />
                            <span>{item.upvote_count}</span>
                          </button>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-neutral-100 leading-snug">{item.title}</p>
                            {item.description && (
                              <p className="mt-1 text-xs text-neutral-500 line-clamp-2 leading-relaxed">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {colItems.length === 0 && (
                    <p className="text-xs text-neutral-600 text-center py-6">Nothing here yet</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submit idea section */}
      <div className="rounded-xl border border-dashed border-neutral-700 p-6">
        {!showForm && !submitted && (
          <button
            onClick={() => setShowForm(true)}
            className="flex w-full items-center justify-center gap-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors group"
          >
            <Lightbulb className="h-4 w-4 text-amber-400 group-hover:text-amber-300 transition-colors" />
            <span>Have an idea? Submit it</span>
            <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}

        {submitted && (
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-green-400">Thanks for your idea!</p>
            <p className="text-xs text-neutral-500">We&apos;ll review it and add it to the roadmap if it fits.</p>
            <button
              onClick={() => { setSubmitted(false); setShowForm(false); }}
              className="mt-3 text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-300"
            >
              Submit another
            </button>
          </div>
        )}

        {showForm && !submitted && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-neutral-100">Submit an idea</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-neutral-400 mb-1 block" htmlFor="idea-title">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  id="idea-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Dark mode support"
                  required
                  maxLength={120}
                  className="w-full rounded-md border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-400 mb-1 block" htmlFor="idea-desc">
                  Description <span className="text-neutral-600">(optional)</span>
                </label>
                <textarea
                  id="idea-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell us more about your idea..."
                  rows={3}
                  maxLength={500}
                  className="w-full resize-none rounded-md border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-400 mb-1 block" htmlFor="idea-email">
                  Your email <span className="text-red-400">*</span>
                </label>
                <input
                  id="idea-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-md border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                />
              </div>
            </div>

            {submitError && (
              <p className="text-xs text-red-400">{submitError}</p>
            )}

            <div className="flex items-center gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => { setShowForm(false); setSubmitError(null); }}
                className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !title.trim() || !email.trim()}
                className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "Submitting..." : "Submit idea"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
