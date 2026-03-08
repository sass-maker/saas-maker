import { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { getColors, PIE_COLORS, tooltipStyle, type Theme } from './styles';
import { useAnalytics, type Period } from './use-analytics';

export interface AnalyticsDashboardProps {
  apiKey: string;
  period?: Period;
  theme?: 'light' | 'dark';
  apiBaseUrl?: string;
}

const PERIODS: { label: string; value: Period }[] = [
  { label: 'Today', value: 'today' },
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
  { label: 'All', value: 'all' },
];

/* ─── Sub-components ─── */

function StatCard({
  label,
  value,
  subtitle,
  colors,
}: {
  label: string;
  value: string;
  subtitle?: string;
  colors: ReturnType<typeof getColors>;
}) {
  return (
    <div
      style={{
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.bgCard,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 14, color: colors.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: colors.text }}>{value}</div>
      {subtitle && (
        <div style={{ fontSize: 12, color: colors.textDim, marginTop: 2 }}>{subtitle}</div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
  defaultOpen = true,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  colors: ReturnType<typeof getColors>;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      style={{
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.bgCard,
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: 16,
          textAlign: 'left',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: colors.textMuted,
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 12 }}>{open ? '\u25BE' : '\u25B8'}</span>
      </button>
      {open && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </div>
  );
}

function ListTable({
  data,
  labelKey,
  valueKey,
  valueLabel = 'Count',
  colors,
}: {
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  valueLabel?: string;
  colors: ReturnType<typeof getColors>;
}) {
  if (data.length === 0) {
    return <div style={{ fontSize: 14, color: colors.textDim, padding: '8px 0' }}>No data yet</div>;
  }
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
          color: colors.textDim,
          padding: '0 8px 4px',
          borderBottom: `1px solid ${colors.border}`,
          marginBottom: 4,
        }}
      >
        <span>{labelKey.charAt(0).toUpperCase() + labelKey.slice(1)}</span>
        <span>{valueLabel}</span>
      </div>
      {data.map((item, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 8px',
            borderRadius: 4,
            fontSize: 14,
          }}
        >
          <span
            style={{
              color: colors.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '70%',
            }}
          >
            {(item[labelKey] as string) || 'Unknown'}
          </span>
          <span style={{ color: colors.textMuted, fontVariantNumeric: 'tabular-nums' }}>
            {(item[valueKey] as number).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

function PeriodSelector({
  period,
  onChange,
  colors,
}: {
  period: Period;
  onChange: (p: Period) => void;
  colors: ReturnType<typeof getColors>;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        backgroundColor: colors.bgCard,
        borderRadius: 8,
        padding: 4,
      }}
    >
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            backgroundColor: period === p.value ? colors.border : 'transparent',
            color: period === p.value ? colors.text : colors.textMuted,
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

function formatTick(dateStr: string, period: Period): string {
  const d = new Date(dateStr);
  if (period === 'today') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function renderPieLabel(props: { name?: string; percent?: number }) {
  const { name = '', percent = 0 } = props;
  return `${name} ${(percent * 100).toFixed(0)}%`;
}

/* ─── Main Component ─── */

export function AnalyticsDashboard({
  apiKey,
  period: initialPeriod = '30d',
  theme = 'dark',
  apiBaseUrl,
}: AnalyticsDashboardProps) {
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const { loading, error, data } = useAnalytics(apiKey, period, apiBaseUrl);
  const colors = getColors(theme);
  const tipStyle = tooltipStyle(theme);

  const containerStyle: React.CSSProperties = {
    backgroundColor: colors.bg,
    color: colors.text,
    padding: 24,
    borderRadius: 12,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  };

  if (loading) {
    return (
      <div style={{ ...containerStyle, textAlign: 'center', padding: 64 }}>
        <div style={{ color: colors.textMuted }}>Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...containerStyle, textAlign: 'center', padding: 64 }}>
        <div style={{ color: colors.error }}>{error}</div>
      </div>
    );
  }

  if (!data || data.summary.page_views === 0) {
    return (
      <div style={{ ...containerStyle, textAlign: 'center', padding: 64 }}>
        <div style={{ color: colors.textMuted }}>No analytics data yet</div>
      </div>
    );
  }

  const { summary, timeseries, pages, referrers, countries, devices, browsers, os, events } = data;

  return (
    <div style={containerStyle}>
      {/* Period Selector */}
      <div style={{ marginBottom: 24 }}>
        <PeriodSelector period={period} onChange={setPeriod} colors={colors} />
      </div>

      {/* Timeseries Chart */}
      <div
        style={{
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.bgCard,
          padding: 16,
          marginBottom: 24,
        }}
      >
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={timeseries}>
            <defs>
              <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="visitorsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} />
            <XAxis
              dataKey="date"
              tick={{ fill: colors.textDim, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatTick(v, period)}
            />
            <YAxis
              tick={{ fill: colors.textDim, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip contentStyle={tipStyle} />
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
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          marginBottom: 24,
        }}
      >
        <StatCard
          label="Page Views"
          value={summary.page_views.toLocaleString()}
          colors={colors}
        />
        <StatCard
          label="Unique Visitors"
          value={summary.unique_visitors.toLocaleString()}
          colors={colors}
        />
        <StatCard
          label="Bounce Rate"
          value={`${summary.bounce_rate.toFixed(1)}%`}
          colors={colors}
        />
        <StatCard
          label="Pages / Session"
          value={summary.avg_session_pages.toFixed(1)}
          colors={colors}
        />
      </div>

      {/* Two-column breakdown grid */}
      <div
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(2, 1fr)',
          marginBottom: 24,
        }}
      >
        {/* Top Pages */}
        <Section title="Top Pages" colors={colors}>
          {pages.length === 0 ? (
            <div style={{ fontSize: 14, color: colors.textDim }}>No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, pages.length * 32)}>
              <BarChart data={pages} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} />
                <XAxis
                  type="number"
                  tick={{ fill: colors.textDim, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="pathname"
                  tick={{ fill: colors.textDim, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={120}
                />
                <Tooltip contentStyle={tipStyle} />
                <Bar dataKey="views" fill={colors.accent} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        {/* Top Referrers */}
        <Section title="Top Referrers" colors={colors}>
          {referrers.length === 0 ? (
            <div style={{ fontSize: 14, color: colors.textDim }}>No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, referrers.length * 32)}>
              <BarChart data={referrers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} />
                <XAxis
                  type="number"
                  tick={{ fill: colors.textDim, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="referrer"
                  tick={{ fill: colors.textDim, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={120}
                />
                <Tooltip contentStyle={tipStyle} />
                <Bar dataKey="count" fill={colors.accentSecondary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        {/* Countries */}
        <Section title="Countries" colors={colors}>
          <ListTable
            data={countries as Record<string, unknown>[]}
            labelKey="country"
            valueKey="count"
            colors={colors}
          />
        </Section>

        {/* Devices */}
        <Section title="Devices" colors={colors}>
          {devices.length === 0 ? (
            <div style={{ fontSize: 14, color: colors.textDim }}>No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={devices}
                  dataKey="count"
                  nameKey="device"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={renderPieLabel}
                >
                  {devices.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Section>

        {/* Browsers */}
        <Section title="Browsers" colors={colors}>
          {browsers.length === 0 ? (
            <div style={{ fontSize: 14, color: colors.textDim }}>No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={browsers}
                  dataKey="count"
                  nameKey="browser"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={renderPieLabel}
                >
                  {browsers.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Section>

        {/* Operating Systems */}
        <Section title="Operating Systems" colors={colors}>
          {os.length === 0 ? (
            <div style={{ fontSize: 14, color: colors.textDim }}>No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={os}
                  dataKey="count"
                  nameKey="os"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={renderPieLabel}
                >
                  {os.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      {/* Custom Events — only if events exist */}
      {events.length > 0 && (
        <Section title="Custom Events" colors={colors}>
          <ListTable
            data={events as Record<string, unknown>[]}
            labelKey="name"
            valueKey="count"
            colors={colors}
          />
        </Section>
      )}
    </div>
  );
}
