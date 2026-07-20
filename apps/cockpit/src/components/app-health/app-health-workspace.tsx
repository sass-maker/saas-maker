'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowUpRight,
  CircleCheckBig,
  Clock3,
  Gauge,
  HeartPulse,
  Radio,
  TriangleAlert,
} from 'lucide-react';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PillarHeader,
  StatusPanel,
} from '@foundry/ui';

import type {
  ApiRouteRollup,
  RecentRequestSpan,
  SpeedSnapshot,
  SpeedWindow,
} from '@/lib/speed-data';

export type AppHealthState = 'healthy' | 'degraded' | 'unhealthy' | 'insufficient';

const WINDOW_LABELS: Record<SpeedWindow, string> = {
  '1h': 'Last hour',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
};

export function appHealthState(route: ApiRouteRollup, windowKey: SpeedWindow): AppHealthState {
  const metrics = route.metrics[windowKey];
  if (
    metrics.requestCount < 20 ||
    metrics.p95 == null ||
    !Number.isFinite(metrics.p95) ||
    !Number.isFinite(metrics.errorRate)
  ) {
    return 'insufficient';
  }
  if (metrics.errorRate >= 5 || metrics.p95 >= 2_000) return 'unhealthy';
  if (metrics.errorRate >= 1 || metrics.p95 >= 1_000) return 'degraded';
  return 'healthy';
}

function stateLabel(state: AppHealthState) {
  return state === 'insufficient' ? 'Collecting data' : state;
}

function stateClass(state: AppHealthState) {
  if (state === 'healthy') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (state === 'degraded') return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  if (state === 'unhealthy') return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
  return 'border-slate-500/30 bg-slate-500/10 text-slate-300';
}

function formatMs(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}s`;
  return `${Math.round(value)}ms`;
}

function formatPercent(value: number) {
  return `${value.toFixed(value < 1 ? 2 : 1)}%`;
}

function formatSeen(value: string | undefined, generatedAt: string) {
  if (!value) return '—';
  const then = Date.parse(value);
  const reference = Date.parse(generatedAt);
  if (!Number.isFinite(then) || !Number.isFinite(reference)) return '—';
  const minutes = Math.max(0, Math.floor((reference - then) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function appHealthProjectIds(snapshot: SpeedSnapshot) {
  return [...new Set(snapshot.routes.map((route) => route.projectId))].sort();
}

export function appHealthRoutes(
  snapshot: SpeedSnapshot,
  project: string,
  windowKey: SpeedWindow,
  sort: 'traffic' | 'latency' | 'errors'
) {
  const filtered = snapshot.routes.filter(
    (route) => project === 'all' || route.projectId === project
  );
  return [...filtered].sort((a, b) => {
    const left = a.metrics[windowKey];
    const right = b.metrics[windowKey];
    if (sort === 'latency') return (right.p95 ?? -1) - (left.p95 ?? -1);
    if (sort === 'errors') return right.errorRate - left.errorRate;
    return right.requestCount - left.requestCount;
  });
}

export function AppHealthWorkspace({ snapshot }: { snapshot: SpeedSnapshot }) {
  const projects = useMemo(() => appHealthProjectIds(snapshot), [snapshot]);
  const [project, setProject] = useState('all');
  const [windowKey, setWindowKey] = useState<SpeedWindow>('24h');
  const [sort, setSort] = useState<'traffic' | 'latency' | 'errors'>('traffic');

  const routes = useMemo(() => {
    return appHealthRoutes(snapshot, project, windowKey, sort);
  }, [project, snapshot.routes, sort, windowKey]);

  const recent = snapshot.recentRequests
    .filter((request) => project === 'all' || request.projectId === project)
    .slice(0, 8);
  const states = routes.map((route) => appHealthState(route, windowKey));
  const totalRequests = routes.reduce(
    (total, route) => total + route.metrics[windowKey].requestCount,
    0
  );
  const healthy = states.filter((state) => state === 'healthy').length;
  const attention = states.filter((state) => state === 'degraded' || state === 'unhealthy').length;
  const unavailable = snapshot.boundary.mode === 'unavailable';
  const connectedEmpty = !unavailable && snapshot.routes.length === 0;

  return (
    <div className="space-y-6">
      <PillarHeader
        eyebrow="Visibility"
        title="App Health"
        description="Every endpoint, one clear pulse. Install one small SDK and your Node.js or Go routes appear here as traffic arrives — sampled latency, errors, activity, and last seen."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="https://packages.sassmaker.com/sdk/app-health-node"
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium transition-colors hover:bg-muted"
            >
              Install SDK <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </a>
            <Link
              href="/fleet/speed"
              className="inline-flex items-center gap-1 px-2 py-2 text-xs font-medium text-cyan-400 hover:underline"
            >
              Advanced speed view →
            </Link>
          </div>
        }
      />

      {unavailable ? (
        <StatusPanel
          state="empty"
          title="Endpoint evidence is unavailable"
          description={snapshot.boundary.message}
          meta="No sample data is substituted. Check the API session and performance tables before trusting this view."
        />
      ) : connectedEmpty ? (
        <StatusPanel
          state="empty"
          title="Connected — waiting for the first endpoint"
          description="The evidence API is reachable, but this account has not received an App Health route sample yet."
          meta="Install one SDK, use the project API key, and make a request. No sample data is substituted."
        />
      ) : (
        <StatusPanel
          state="success"
          title={
            snapshot.boundary.truncatedWindows?.length
              ? 'Live bounded SDK evidence'
              : 'Live SDK evidence'
          }
          description="Request-derived data is limited to bounded samples of normalized route templates, method, status class, duration, and timestamp."
          meta={`${snapshot.boundary.message} Samples retain ${snapshot.retention.spansDays} days · generated ${new Date(snapshot.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Discovered endpoints"
          value={unavailable ? '—' : routes.length}
          icon={Radio}
          tone="cyan"
        />
        <MetricCard
          label="Observed samples"
          value={unavailable ? '—' : totalRequests.toLocaleString('en-IN')}
          icon={Activity}
          tone="violet"
        />
        <MetricCard
          label="Healthy"
          value={unavailable ? '—' : healthy}
          icon={CircleCheckBig}
          tone="emerald"
        />
        <MetricCard
          label="Needs attention"
          value={unavailable ? '—' : attention}
          icon={TriangleAlert}
          tone="rose"
        />
      </div>

      <Card className="overflow-hidden border-border/70 bg-card/70">
        <div className="border-b border-border/60 bg-gradient-to-r from-cyan-500/10 via-transparent to-violet-500/10 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <HeartPulse className="h-4 w-4 text-cyan-400" aria-hidden />
                Endpoint inventory
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Normalized framework routes, never raw user paths or query values.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Filter label="Project" value={project} onChange={setProject}>
                <option value="all">All projects</option>
                {projects.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </Filter>
              <Filter
                label="Window"
                value={windowKey}
                onChange={(value) => setWindowKey(value as SpeedWindow)}
              >
                {Object.entries(WINDOW_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Filter>
              <Filter label="Sort" value={sort} onChange={(value) => setSort(value as typeof sort)}>
                <option value="traffic">Most traffic</option>
                <option value="latency">Slowest p95</option>
                <option value="errors">Highest errors</option>
              </Filter>
            </div>
          </div>
        </div>
        <CardContent className="p-0">
          {routes.length === 0 ? (
            <EmptyEndpoints unavailable={unavailable} />
          ) : (
            <div
              className="overflow-x-auto"
              role="region"
              aria-label="Endpoint performance samples"
              // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users need to focus and horizontally scroll this data region.
              tabIndex={0}
            >
              <p className="border-b border-border/60 px-5 py-2 text-xs text-muted-foreground lg:hidden">
                Scroll horizontally to inspect every metric.
              </p>
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/20 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Endpoint</th>
                    <th className="px-3 py-3 font-medium">Health</th>
                    <th className="px-3 py-3 text-right font-medium">Samples</th>
                    <th className="px-3 py-3 text-right font-medium">p50</th>
                    <th className="px-3 py-3 text-right font-medium">p95</th>
                    <th className="px-3 py-3 text-right font-medium">Errors</th>
                    <th className="px-5 py-3 text-right font-medium">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((route) => (
                    <EndpointRow
                      key={route.id}
                      route={route}
                      windowKey={windowKey}
                      generatedAt={snapshot.generatedAt}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <RecentActivity requests={recent} />
        <InstallCard />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: typeof Activity;
  tone: 'cyan' | 'violet' | 'emerald' | 'rose';
}) {
  const tones = {
    cyan: 'bg-cyan-500/10 text-cyan-400',
    violet: 'bg-violet-500/10 text-violet-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    rose: 'bg-rose-500/10 text-rose-400',
  };
  return (
    <Card className="border-border/70 bg-card/70">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
        </div>
        <span className={`rounded-xl p-2.5 ${tones[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </CardContent>
    </Card>
  );
}

function Filter({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      <span>{label}</span>
      <select
        className="block min-w-32 rounded-md border border-border bg-background px-2.5 py-2 text-sm font-normal normal-case tracking-normal text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function EndpointRow({
  route,
  windowKey,
  generatedAt,
}: {
  route: ApiRouteRollup;
  windowKey: SpeedWindow;
  generatedAt: string;
}) {
  const metrics = route.metrics[windowKey];
  const state = appHealthState(route, windowKey);
  return (
    <tr className="border-b border-border/45 transition-colors last:border-0 hover:bg-muted/20">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="w-16 justify-center font-mono text-[10px]">
            {route.method}
          </Badge>
          <div className="min-w-0">
            <p className="font-mono text-sm font-medium">{route.routeTemplate}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {route.projectId} · {route.source}
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-4">
        <Badge variant="outline" className={`capitalize ${stateClass(state)}`}>
          {stateLabel(state)}
        </Badge>
      </td>
      <td className="px-3 py-4 text-right font-medium tabular-nums">
        {metrics.requestCount.toLocaleString('en-IN')}
      </td>
      <td className="px-3 py-4 text-right tabular-nums text-muted-foreground">
        {formatMs(metrics.p50)}
      </td>
      <td className="px-3 py-4 text-right font-medium tabular-nums">{formatMs(metrics.p95)}</td>
      <td className="px-3 py-4 text-right tabular-nums">
        <span className={metrics.errorRate >= 1 ? 'text-rose-400' : 'text-muted-foreground'}>
          {formatPercent(metrics.errorRate)}
        </span>
      </td>
      <td className="px-5 py-4 text-right text-xs text-muted-foreground">
        {formatSeen(route.lastSeen, generatedAt)}
      </td>
    </tr>
  );
}

function EmptyEndpoints({ unavailable }: { unavailable: boolean }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="rounded-2xl bg-cyan-500/10 p-4 text-cyan-400">
        <Radio className="h-7 w-7" aria-hidden />
      </span>
      <h2 className="mt-5 text-lg font-semibold">
        {unavailable ? 'Endpoint inventory unavailable' : 'Waiting for your first endpoint'}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {unavailable
          ? 'Restore the API session or performance tables before using this inventory.'
          : 'Install the SDK, paste your project key, and make one request. The normalized route will appear here automatically.'}
      </p>
      {!unavailable && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <a
            className="rounded-md border border-border bg-background px-3 py-2 text-xs hover:bg-muted"
            href="https://packages.sassmaker.com/sdk/app-health-node"
          >
            Node.js guide
          </a>
          <a
            className="rounded-md border border-border bg-background px-3 py-2 text-xs hover:bg-muted"
            href="https://packages.sassmaker.com/sdk/app-health-go"
          >
            Go guide
          </a>
        </div>
      )}
    </div>
  );
}

function RecentActivity({ requests }: { requests: RecentRequestSpan[] }) {
  return (
    <Card className="border-border/70 bg-card/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock3 className="h-4 w-4 text-cyan-400" aria-hidden /> Recent activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {requests.map((request) => (
          <div
            key={request.traceId}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/25"
          >
            <span
              className={`h-2 w-2 rounded-full ${request.statusClass === '5xx' ? 'bg-rose-400' : request.statusClass === '4xx' ? 'bg-amber-400' : 'bg-emerald-400'}`}
              aria-hidden
            />
            <span className="sr-only">{request.statusClass} response</span>
            <div className="min-w-0">
              <p className="truncate font-mono text-xs">
                {request.method} {request.routeTemplate}
              </p>
              <p className="text-[11px] text-muted-foreground">{request.projectId}</p>
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatMs(request.durationMs)}
            </span>
          </div>
        ))}
        {requests.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No recent requests in this selection.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function InstallCard() {
  return (
    <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-card to-violet-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="h-4 w-4 text-cyan-400" aria-hidden /> Add another service
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Node.js / Express
          </p>
          <code className="mt-2 block overflow-x-auto rounded-md border border-border/70 bg-background/80 p-3 text-xs">
            npm install @saas-maker/sdk
          </code>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Go</p>
          <code className="mt-2 block overflow-x-auto rounded-md border border-border/70 bg-background/80 p-3 text-xs">
            go get github.com/sass-maker/saas-maker/packages/app-health-go
          </code>
        </div>
        <a
          href="https://packages.sassmaker.com/sdk/app-health"
          className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:underline"
        >
          Open the installation guide <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </a>
      </CardContent>
    </Card>
  );
}
