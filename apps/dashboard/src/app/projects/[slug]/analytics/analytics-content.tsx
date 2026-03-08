"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Eye,
  Users,
  TrendingDown,
  Layers,
  Bot,
  ChevronDown,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { getClientToken, apiFetchClient } from "@/lib/api-client";
import type { AnalyticsDashboard } from "@saas-maker/shared-types";

type Period = "today" | "7d" | "30d" | "90d" | "all";

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4"];

const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  all: "All time",
};

interface AnalyticsContentProps {
  projectId: string;
}

function StatCard({
  label,
  value,
  icon: Icon,
  subtitle,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  subtitle?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm text-zinc-400">{label}</div>
        <Icon className="h-4 w-4 text-zinc-500" />
      </div>
      <div className="text-2xl font-bold text-zinc-50">{value}</div>
      {subtitle && (
        <div className="text-xs text-zinc-500 mt-0.5">{subtitle}</div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
  defaultOpen = true,
  onSeeAll,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  onSeeAll?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full p-4 text-left"
      >
        <h3 className="text-sm font-medium text-zinc-400">{title}</h3>
        <div className="flex items-center gap-2">
          {onSeeAll && open && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onSeeAll();
              }}
              className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
            >
              See all
            </span>
          )}
          {open ? (
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-zinc-500" />
          )}
        </div>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function ListTable({
  data,
  labelKey,
  valueKey,
  valueLabel = "Count",
}: {
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  valueLabel?: string;
}) {
  if (data.length === 0) {
    return <div className="text-sm text-zinc-500 py-2">No data yet</div>;
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-zinc-500 px-2 pb-1 border-b border-zinc-800">
        <span>{labelKey.charAt(0).toUpperCase() + labelKey.slice(1)}</span>
        <span>{valueLabel}</span>
      </div>
      {data.map((item, i) => (
        <div
          key={i}
          className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-zinc-800/50 text-sm"
        >
          <span className="text-zinc-200 truncate max-w-[70%]">
            {(item[labelKey] as string) || "Unknown"}
          </span>
          <span className="text-zinc-400 tabular-nums">
            {(item[valueKey] as number).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: "6px",
  color: "#fafafa",
};

export function AnalyticsContent({ projectId }: AnalyticsContentProps) {
  const [period, setPeriod] = useState<Period>("30d");
  const [includeBots, setIncludeBots] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);

  // detail modal state
  const [detailSection, setDetailSection] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<unknown[]>([]);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOffset, setDetailOffset] = useState(0);
  const DETAIL_LIMIT = 50;

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getClientToken();
      const qs = `?project_id=${projectId}&period=${period}&include_bots=${includeBots}`;
      const data = await apiFetchClient<AnalyticsDashboard>(
        `/v1/analytics/dashboard${qs}`,
        token
      );
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [projectId, period, includeBots]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const fetchDetail = useCallback(
    async (section: string, offset = 0) => {
      setDetailLoading(true);
      try {
        const token = await getClientToken();
        const qs = `?project_id=${projectId}&period=${period}&include_bots=${includeBots}&limit=${DETAIL_LIMIT}&offset=${offset}`;
        const res = await apiFetchClient<{ data: unknown[]; total: number }>(
          `/v1/analytics/detail/${section}${qs}`,
          token
        );
        setDetailData(offset === 0 ? res.data : [...detailData, ...res.data]);
        setDetailTotal(res.total);
        setDetailOffset(offset);
        setDetailSection(section);
      } catch {
        // silently fail for detail
      } finally {
        setDetailLoading(false);
      }
    },
    [projectId, period, includeBots, detailData]
  );

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

  if (!dashboard || dashboard.summary.page_views === 0) {
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

  const { summary, timeseries, pages, referrers, countries, devices, browsers, os, events, bots } =
    dashboard;

  const formattedTimeseries = timeseries.map((t) => ({
    ...t,
    date:
      period === "today"
        ? new Date(t.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : new Date(t.date).toLocaleDateString([], { month: "short", day: "numeric" }),
  }));

  return (
    <div className="rounded-lg bg-zinc-950 text-zinc-50 p-6 space-y-6">
      {/* Period Selector + Bot Toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
          {(["today", "7d", "30d", "90d", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === p
                  ? "bg-zinc-700 text-zinc-50"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={includeBots}
            onChange={(e) => setIncludeBots(e.target.checked)}
            className="rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-zinc-950"
          />
          <Bot className="h-3.5 w-3.5" />
          Include bots
          {summary.bot_count > 0 && (
            <span className="text-xs text-zinc-500">
              ({summary.bot_percentage}%)
            </span>
          )}
        </label>
      </div>

      {/* Hero Time-Series Chart */}
      {formattedTimeseries.length > 1 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={formattedTimeseries}>
              <defs>
                <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="visitorsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="views"
                stroke="#3b82f6"
                fill="url(#viewsGrad)"
                strokeWidth={2}
                name="Page Views"
              />
              <Area
                type="monotone"
                dataKey="visitors"
                stroke="#8b5cf6"
                fill="url(#visitorsGrad)"
                strokeWidth={2}
                name="Visitors"
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-2 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-blue-500 rounded" /> Page Views
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-purple-500 rounded" /> Visitors
            </span>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Page Views"
          value={summary.page_views.toLocaleString()}
          icon={Eye}
        />
        <StatCard
          label="Unique Visitors"
          value={summary.unique_visitors.toLocaleString()}
          icon={Users}
        />
        <StatCard
          label="Bounce Rate"
          value={`${summary.bounce_rate}%`}
          icon={TrendingDown}
        />
        <StatCard
          label="Pages / Session"
          value={summary.avg_session_pages.toFixed(1)}
          icon={Layers}
        />
      </div>

      {/* Two-Column Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Pages */}
        <Section
          title="Top Pages"
          onSeeAll={() => fetchDetail("pages")}
        >
          {pages.length > 0 ? (
            <ResponsiveContainer
              width="100%"
              height={Math.max(180, pages.length * 32)}
            >
              <BarChart
                data={pages}
                layout="vertical"
                margin={{ left: 0, right: 16, top: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="pathname"
                  width={140}
                  tick={{ fill: "#a1a1aa", fontSize: 11 }}
                  tickFormatter={(v: string) =>
                    v.length > 22 ? v.slice(0, 22) + "..." : v
                  }
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="views" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-zinc-500 py-2">No page data yet</div>
          )}
        </Section>

        {/* Top Referrers */}
        <Section
          title="Top Referrers"
          onSeeAll={() => fetchDetail("referrers")}
        >
          {referrers.length > 0 ? (
            <ResponsiveContainer
              width="100%"
              height={Math.max(180, referrers.length * 32)}
            >
              <BarChart
                data={referrers}
                layout="vertical"
                margin={{ left: 0, right: 16, top: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="referrer"
                  width={140}
                  tick={{ fill: "#a1a1aa", fontSize: 11 }}
                  tickFormatter={(v: string) =>
                    v.length > 22 ? v.slice(0, 22) + "..." : v
                  }
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-zinc-500 py-2">No referrer data yet</div>
          )}
        </Section>

        {/* Countries */}
        <Section
          title="Countries"
          onSeeAll={() => fetchDetail("countries")}
        >
          <ListTable data={countries as Record<string, unknown>[]} labelKey="country" valueKey="count" valueLabel="Visitors" />
        </Section>

        {/* Devices */}
        <Section title="Devices" onSeeAll={() => fetchDetail("devices")}>
          {devices.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={devices}
                  dataKey="count"
                  nameKey="device"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  strokeWidth={0}
                  label={(props) => {
                      const e = props as unknown as { device: string; percent: number };
                      return `${e.device} ${(e.percent * 100).toFixed(0)}%`;
                    }}
                >
                  {devices.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-zinc-500 py-2">No device data yet</div>
          )}
        </Section>

        {/* Browsers */}
        <Section title="Browsers" onSeeAll={() => fetchDetail("browsers")}>
          {browsers.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={browsers}
                  dataKey="count"
                  nameKey="browser"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  strokeWidth={0}
                  label={(props) => {
                      const e = props as unknown as { browser: string; percent: number };
                      return `${e.browser} ${(e.percent * 100).toFixed(0)}%`;
                    }}
                >
                  {browsers.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-zinc-500 py-2">No browser data yet</div>
          )}
        </Section>

        {/* Operating Systems */}
        <Section title="Operating Systems" onSeeAll={() => fetchDetail("os")}>
          {os.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={os}
                  dataKey="count"
                  nameKey="os"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  strokeWidth={0}
                  label={(props) => {
                      const e = props as unknown as { os: string; percent: number };
                      return `${e.os} ${(e.percent * 100).toFixed(0)}%`;
                    }}
                >
                  {os.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-zinc-500 py-2">No OS data yet</div>
          )}
        </Section>
      </div>

      {/* Bot Traffic */}
      {summary.bot_count > 0 && (
        <Section title={`Bot Traffic (${summary.bot_count.toLocaleString()} requests, ${summary.bot_percentage}%)`} defaultOpen={false}>
          <ListTable data={bots as Record<string, unknown>[]} labelKey="name" valueKey="count" valueLabel="Requests" />
        </Section>
      )}

      {/* Custom Events */}
      {events.length > 0 && (
        <Section title="Custom Events" onSeeAll={() => fetchDetail("events")}>
          <ListTable data={events as Record<string, unknown>[]} labelKey="name" valueKey="count" />
        </Section>
      )}

      {/* Detail Drawer */}
      {detailSection && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setDetailSection(null);
              setDetailData([]);
            }}
          />
          <div className="relative w-full max-w-lg bg-zinc-950 border-l border-zinc-800 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-50 capitalize">
                {detailSection}
              </h2>
              <button
                onClick={() => {
                  setDetailSection(null);
                  setDetailData([]);
                }}
                className="text-zinc-400 hover:text-zinc-200 text-sm"
              >
                Close
              </button>
            </div>
            <div className="text-xs text-zinc-500 mb-3">
              {detailTotal.toLocaleString()} total
            </div>
            <div className="space-y-1">
              {(detailData as Record<string, unknown>[]).map((item, i) => {
                const keys = Object.keys(item);
                const labelKey = keys.find((k) => typeof item[k] === "string") || keys[0];
                const valueKey = keys.find((k) => typeof item[k] === "number") || keys[1];
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-zinc-800/50 text-sm"
                  >
                    <span className="text-zinc-200 truncate max-w-[70%]">
                      {(item[labelKey] as string) || "Unknown"}
                    </span>
                    <span className="text-zinc-400 tabular-nums">
                      {(item[valueKey] as number)?.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
            {detailData.length < detailTotal && (
              <button
                onClick={() => fetchDetail(detailSection, detailOffset + DETAIL_LIMIT)}
                disabled={detailLoading}
                className="mt-4 w-full py-2 text-sm text-blue-400 hover:text-blue-300 border border-zinc-800 rounded-lg"
              >
                {detailLoading ? "Loading..." : "Load more"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
