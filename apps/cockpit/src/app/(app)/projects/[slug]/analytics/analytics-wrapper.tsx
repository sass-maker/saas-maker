"use client";

import { useEffect, useState } from "react";
import { AnalyticsDashboard } from "@saas-maker/analytics-ui";
import { getClientToken } from "@/lib/api-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

interface RecentEvent {
  id: string;
  name: string;
  url: string | null;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function RecentEventsFeed({ projectId }: { projectId: string }) {
  const [events, setEvents] = useState<RecentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const token = await getClientToken();
        const res = await fetch(
          `${API_BASE}/v1/analytics/recent?project_id=${projectId}&limit=20`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setEvents(json.data ?? []);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    // Poll every 30s for near-real-time feel
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [projectId]);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Recent Events</span>
        <span className="text-xs text-muted-foreground">last 20 · auto-refreshes every 30s</span>
      </div>

      {loading && (
        <div className="px-4 py-6 text-sm text-muted-foreground">Loading…</div>
      )}
      {error && (
        <div className="px-4 py-6 text-sm text-destructive">{error}</div>
      )}
      {!loading && !error && events.length === 0 && (
        <div className="px-4 py-6 text-sm text-muted-foreground">No events yet.</div>
      )}

      {!loading && !error && events.length > 0 && (
        <ul className="divide-y divide-border">
          {events.map((ev) => (
            <li key={ev.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <span className="inline-block rounded px-1.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground mr-2">
                  {ev.name}
                </span>
                {ev.url && (
                  <span className="text-xs text-foreground truncate max-w-xs inline-block align-middle">
                    {ev.url.replace(/^https?:\/\/[^/]+/, "") || "/"}
                  </span>
                )}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {timeAgo(ev.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AnalyticsWrapper({
  apiKey,
  projectId,
}: {
  apiKey: string;
  projectId: string;
}) {
  return (
    <div className="space-y-6">
      {/* Main dashboard — trend chart, top pages, breakdown, summary cards */}
      <AnalyticsDashboard apiKey={apiKey} theme="dark" />

      {/* Recent events feed — session-auth, near real-time */}
      <RecentEventsFeed projectId={projectId} />
    </div>
  );
}
