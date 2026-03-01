"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Users, FileText, Globe, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getClientToken, apiFetchClient } from "@/lib/api-client";
import type { AnalyticsOverview } from "@saas-maker/shared-types";

type Period = "7d" | "30d" | "90d";

interface PageData {
  url: string;
  views: number;
}
interface ReferrerData {
  referrer: string;
  count: number;
}
interface CountryData {
  country: string;
  count: number;
}
interface DeviceData {
  device: string;
  count: number;
}
interface EventData {
  name: string;
  count: number;
}

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

interface AnalyticsContentProps {
  projectId: string;
}

export function AnalyticsContent({ projectId }: AnalyticsContentProps) {
  const [period, setPeriod] = useState<Period>("30d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [pages, setPages] = useState<PageData[]>([]);
  const [referrers, setReferrers] = useState<ReferrerData[]>([]);
  const [countries, setCountries] = useState<CountryData[]>([]);
  const [devices, setDevices] = useState<DeviceData[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getClientToken();
      const qs = `?project_id=${projectId}&period=${period}`;

      const [
        overviewRes,
        pagesRes,
        referrersRes,
        countriesRes,
        devicesRes,
        eventsRes,
      ] = await Promise.all([
        apiFetchClient<AnalyticsOverview>(`/v1/analytics/overview${qs}`, token),
        apiFetchClient<{ data: PageData[] }>(`/v1/analytics/pages${qs}`, token),
        apiFetchClient<{ data: ReferrerData[] }>(`/v1/analytics/referrers${qs}`, token),
        apiFetchClient<{ data: CountryData[] }>(`/v1/analytics/countries${qs}`, token),
        apiFetchClient<{ data: DeviceData[] }>(`/v1/analytics/devices${qs}`, token),
        apiFetchClient<{ data: EventData[] }>(`/v1/analytics/events${qs}`, token),
      ]);

      setOverview(overviewRes);
      setPages(pagesRes.data ?? []);
      setReferrers(referrersRes.data ?? []);
      setCountries(countriesRes.data ?? []);
      setDevices(devicesRes.data ?? []);
      setEvents(eventsRes.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [projectId, period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="rounded-lg bg-zinc-950 text-zinc-50 p-6">
        <div className="flex items-center justify-center py-16">
          <div className="text-zinc-400">Loading analytics...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-zinc-950 text-zinc-50 p-6">
        <div className="text-center py-16 text-red-400">{error}</div>
      </div>
    );
  }

  if (!overview || overview.page_views === 0) {
    return (
      <div className="rounded-lg bg-zinc-950 text-zinc-50 p-6">
        <div className="flex flex-col items-center text-center py-16 space-y-4">
          <BarChart3 className="h-12 w-12 text-zinc-600" />
          <h3 className="text-lg font-semibold">No analytics data yet</h3>
          <p className="text-zinc-400 max-w-md">
            Add the tracking script to your site to start collecting
            privacy-friendly analytics.
          </p>
          <pre className="rounded-md bg-zinc-900 border border-zinc-800 p-4 text-sm font-mono text-zinc-300 text-left max-w-lg w-full overflow-x-auto">
{`<script defer
  src="https://cdn.saasmaker.dev/a.js"
  data-project="YOUR_API_KEY">
</script>`}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-zinc-950 text-zinc-50 p-6 space-y-6">
      {/* Period Selector */}
      <div className="flex gap-1 rounded-lg bg-zinc-900 p-1 w-fit">
        {(["7d", "30d", "90d"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              period === p
                ? "bg-zinc-700 text-zinc-50"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {p === "7d" ? "7 days" : p === "30d" ? "30 days" : "90 days"}
          </button>
        ))}
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm text-zinc-400">Page Views</div>
            <Eye className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-50">
            {overview.page_views.toLocaleString()}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm text-zinc-400">Unique Visitors</div>
            <Users className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-50">
            {overview.unique_visitors.toLocaleString()}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm text-zinc-400">Top Page</div>
            <FileText className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="text-lg font-bold text-zinc-50 truncate">
            {overview.top_page ?? "\u2014"}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm text-zinc-400">Top Referrer</div>
            <Globe className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="text-lg font-bold text-zinc-50 truncate">
            {overview.top_referrer ?? "Direct"}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Pages */}
        {pages.length > 0 && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="text-sm font-medium text-zinc-400 mb-4">
              Top Pages
            </h3>
            <ResponsiveContainer
              width="100%"
              height={Math.max(200, pages.slice(0, 10).length * 36)}
            >
              <BarChart
                data={pages.slice(0, 10)}
                layout="vertical"
                margin={{ left: 0, right: 16, top: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="url"
                  width={160}
                  tick={{ fill: "#a1a1aa", fontSize: 12 }}
                  tickFormatter={(v: string) =>
                    v.length > 24 ? v.slice(0, 24) + "..." : v
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: "6px",
                    color: "#fafafa",
                  }}
                />
                <Bar dataKey="views" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top Referrers */}
        {referrers.length > 0 && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="text-sm font-medium text-zinc-400 mb-4">
              Top Referrers
            </h3>
            <ResponsiveContainer
              width="100%"
              height={Math.max(200, referrers.slice(0, 10).length * 36)}
            >
              <BarChart
                data={referrers.slice(0, 10)}
                layout="vertical"
                margin={{ left: 0, right: 16, top: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="referrer"
                  width={160}
                  tick={{ fill: "#a1a1aa", fontSize: 12 }}
                  tickFormatter={(v: string) =>
                    v.length > 24 ? v.slice(0, 24) + "..." : v
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: "6px",
                    color: "#fafafa",
                  }}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Devices */}
        {devices.length > 0 && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="text-sm font-medium text-zinc-400 mb-4">Devices</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={devices}
                  dataKey="count"
                  nameKey="device"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  strokeWidth={0}
                  label={(props) => {
                    const entry = props as unknown as Record<string, unknown>;
                    const name = (entry.device as string) ?? props.name;
                    const pct = typeof props.percent === "number" ? (props.percent * 100).toFixed(0) : "0";
                    return `${name} ${pct}%`;
                  }}
                >
                  {devices.map((_, i) => (
                    <Cell
                      key={i}
                      fill={PIE_COLORS[i % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: "6px",
                    color: "#fafafa",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Countries */}
        {countries.length > 0 && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="text-sm font-medium text-zinc-400 mb-4">
              Countries
            </h3>
            <div className="space-y-1 max-h-[280px] overflow-y-auto">
              <div className="flex items-center justify-between text-xs text-zinc-500 px-2 pb-1 border-b border-zinc-800">
                <span>Country</span>
                <span>Visitors</span>
              </div>
              {countries.map((c) => (
                <div
                  key={c.country}
                  className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-zinc-800/50 text-sm"
                >
                  <span className="text-zinc-200">
                    {c.country || "Unknown"}
                  </span>
                  <span className="text-zinc-400 tabular-nums">
                    {c.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Custom Events */}
      {events.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="text-sm font-medium text-zinc-400 mb-4">
            Custom Events
          </h3>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-zinc-500 px-2 pb-1 border-b border-zinc-800">
              <span>Event Name</span>
              <span>Count</span>
            </div>
            {events.map((e) => (
              <div
                key={e.name}
                className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-zinc-800/50 text-sm"
              >
                <span className="text-zinc-200 font-mono text-xs">
                  {e.name}
                </span>
                <span className="text-zinc-400 tabular-nums">
                  {e.count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
