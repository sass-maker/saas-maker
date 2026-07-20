'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  CircleCheckBig,
  Clock3,
  Gauge,
  RadioTower,
  Timer,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PillarHeader,
  StatusPanel,
} from '@foundry/ui';
import type {
  ApiRouteRollup,
  BudgetSuggestion,
  RecentRequestSpan,
  SpeedFreshness,
  SpeedSnapshot,
  SpeedWindow,
} from '@/lib/speed-data';

function freshnessTone(state: SpeedFreshness) {
  if (state === 'fresh') return 'success' as const;
  if (state === 'stale') return 'stale' as const;
  if (state === 'failing') return 'error' as const;
  if (state === 'partial') return 'stale' as const;
  return 'empty' as const;
}

function fmtMs(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${Math.round(value)}ms`;
}

function fmtPct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(2)}%`;
}

function countByState(snapshot: SpeedSnapshot, state: SpeedFreshness) {
  return snapshot.surfaces.filter((s) => s.state === state).length;
}

export function SpeedWorkspace({ snapshot }: { snapshot: SpeedSnapshot }) {
  const [project, setProject] = useState<string>('all');
  const [windowKey, setWindowKey] = useState<SpeedWindow>('24h');
  const [source, setSource] = useState<string>('all');
  const [selectedRoute, setSelectedRoute] = useState<string | null>(snapshot.routes[0]?.id ?? null);
  const [percentile, setPercentile] = useState<'p75' | 'p95' | 'p99'>('p95');
  const [pendingBudget, setPendingBudget] = useState<{
    surface: SpeedSnapshot['surfaces'][number];
    budget: BudgetSuggestion;
  } | null>(null);
  const [budgetStatus, setBudgetStatus] = useState<string | null>(null);

  const projects = useMemo(
    () => [...new Set(snapshot.surfaces.map((s) => s.projectId))].sort(),
    [snapshot.surfaces]
  );
  const sources = useMemo(
    () =>
      [
        ...new Set([
          ...snapshot.routes.map((route) => route.source),
          ...snapshot.recentRequests.map((request) => request.source),
        ]),
      ].sort(),
    [snapshot.recentRequests, snapshot.routes]
  );

  const filteredSurfaces = snapshot.surfaces.filter(
    (s) => project === 'all' || s.projectId === project
  );

  const filteredRoutes = snapshot.routes.filter((r) => {
    if (project !== 'all' && r.projectId !== project) return false;
    if (source !== 'all' && r.source !== source) return false;
    return true;
  });

  const filteredRecent = snapshot.recentRequests.filter((r) => {
    if (project !== 'all' && r.projectId !== project) return false;
    if (source !== 'all' && r.source !== source) return false;
    return true;
  });
  const filteredWebDiagnostics = snapshot.webDiagnostics.filter(
    (diagnostic) => project === 'all' || diagnostic.projectId === project
  );

  const topVolume = [...filteredRoutes].sort(
    (a, b) => b.metrics[windowKey].requestCount - a.metrics[windowKey].requestCount
  );
  const slowest = [...filteredRoutes].sort(
    (a, b) => (b.metrics[windowKey][percentile] ?? -1) - (a.metrics[windowKey][percentile] ?? -1)
  );
  const highestError = [...filteredRoutes].sort(
    (a, b) => b.metrics[windowKey].errorRate - a.metrics[windowKey].errorRate
  );

  const routeDetail = snapshot.routeDetails.find((d) => d.routeId === selectedRoute);
  const selectedRouteMeta = snapshot.routes.find((r) => r.id === selectedRoute);

  return (
    <div className="space-y-6">
      <PillarHeader
        eyebrow="Visibility"
        title="Fleet speed"
        description="Provider-neutral web and API evidence: synthetic probes, runtime spans, and PSI Swarm distributions. Observation-only until you approve budgets."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Mode {snapshot.boundary.mode}</Badge>
            <Badge variant="outline">
              Observation day {snapshot.observation.elapsedDays}/{snapshot.observation.minimumDays}
            </Badge>
            <Link
              href="/fleet/observability"
              className="text-xs font-medium text-cyan-400 hover:underline"
            >
              Config inventory →
            </Link>
          </div>
        }
      />

      <StatusPanel
        state={
          snapshot.boundary.providerEnrichment === 'available'
            ? 'success'
            : snapshot.boundary.providerEnrichment === 'partial'
              ? 'stale'
              : 'empty'
        }
        title={
          snapshot.boundary.providerEnrichment === 'unavailable'
            ? 'Provider enrichment unavailable — synthetic/runtime evidence still shown'
            : 'Evidence boundary'
        }
        description={snapshot.boundary.message}
        meta={`Retention: spans ${snapshot.retention.spansDays}d · rollups ${snapshot.retention.rollupsMonths}mo · generated ${new Date(snapshot.generatedAt).toLocaleString()}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Fresh',
            value: countByState(snapshot, 'fresh'),
            icon: CircleCheckBig,
            tone: 'text-emerald-400',
          },
          {
            label: 'Stale / partial',
            value: countByState(snapshot, 'stale') + countByState(snapshot, 'partial'),
            icon: Clock3,
            tone: 'text-amber-400',
          },
          {
            label: 'Unmeasured / N/A',
            value: countByState(snapshot, 'unmeasured') + countByState(snapshot, 'not-applicable'),
            icon: RadioTower,
            tone: 'text-slate-400',
          },
          {
            label: 'Failing',
            value: countByState(snapshot, 'failing'),
            icon: AlertTriangle,
            tone: 'text-rose-400',
          },
        ].map((metric) => (
          <Card key={metric.label} className="border-border/70 bg-card/70">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums">{metric.value}</p>
              </div>
              <metric.icon className={`h-5 w-5 ${metric.tone}`} aria-hidden="true" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/70 bg-card/70">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Project</span>
            <select
              className="block rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              value={project}
              onChange={(e) => setProject(e.target.value)}
            >
              <option value="all">All projects</option>
              {projects.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Window</span>
            <select
              className="block rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              value={windowKey}
              onChange={(e) => setWindowKey(e.target.value as SpeedWindow)}
            >
              <option value="1h">1 hour</option>
              <option value="24h">24 hours</option>
              <option value="7d">7 days</option>
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Source</span>
            <select
              className="block rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="all">All sources</option>
              {sources.map((sourceName) => (
                <option key={sourceName} value={sourceName}>
                  {sourceName}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Slow percentile</span>
            <select
              className="block rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              value={percentile}
              onChange={(e) => setPercentile(e.target.value as 'p75' | 'p95' | 'p99')}
            >
              <option value="p75">p75</option>
              <option value="p95">p95</option>
              <option value="p99">p99</option>
            </select>
          </label>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-4 w-4" aria-hidden />
            Fleet surfaces
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                <th className="pb-3 pr-3 font-medium">Product</th>
                <th className="pb-3 pr-3 font-medium">State</th>
                <th className="pb-3 pr-3 font-medium">Mode</th>
                <th className="pb-3 pr-3 font-medium">Web p75/p95</th>
                <th className="pb-3 pr-3 font-medium">API p50/p95/p99</th>
                <th className="pb-3 pr-3 font-medium">Traffic</th>
                <th className="pb-3 pr-3 font-medium">Errors</th>
                <th className="pb-3 pr-3 font-medium">Source / rev</th>
                <th className="pb-3 font-medium">Regression</th>
              </tr>
            </thead>
            <tbody>
              {filteredSurfaces.map((surface) => (
                <tr key={surface.id} className="border-b border-border/50 align-top">
                  <td className="py-3 pr-3">
                    <div className="font-medium">{surface.projectName}</div>
                    <div className="text-xs text-muted-foreground">{surface.label}</div>
                  </td>
                  <td className="py-3 pr-3">
                    <Badge variant="outline" className="capitalize">
                      {surface.state}
                    </Badge>
                  </td>
                  <td className="py-3 pr-3 capitalize text-muted-foreground">{surface.mode}</td>
                  <td className="py-3 pr-3 tabular-nums">
                    {surface.web
                      ? `${fmtMs(surface.web.metrics.lcpP75)} / ${fmtMs(surface.web.metrics.lcpP95)}`
                      : '—'}
                  </td>
                  <td className="py-3 pr-3 tabular-nums">
                    {surface.api
                      ? `${fmtMs(surface.api.metrics.p50)} / ${fmtMs(surface.api.metrics.p95)} / ${fmtMs(surface.api.metrics.p99)}`
                      : '—'}
                  </td>
                  <td className="py-3 pr-3 tabular-nums">
                    {surface.api ? surface.api.metrics.requestCount.toLocaleString() : '—'}
                  </td>
                  <td className="py-3 pr-3 tabular-nums">
                    {surface.api ? fmtPct(surface.api.metrics.errorRate) : '—'}
                  </td>
                  <td className="py-3 pr-3 text-xs text-muted-foreground">
                    {(surface.api?.provenance.source ?? surface.web?.provenance.source ?? '—') +
                      (surface.api?.provenance.revision || surface.web?.provenance.revision
                        ? ` · ${(surface.api?.provenance.revision ?? surface.web?.provenance.revision)?.slice(0, 7)}`
                        : '')}
                  </td>
                  <td className="py-3 text-xs">
                    {surface.regression ? (
                      <span className="text-rose-400">
                        {surface.regression.metric} {surface.regression.deltaPercent > 0 ? '+' : ''}
                        {surface.regression.deltaPercent.toFixed(1)}%
                      </span>
                    ) : surface.budget ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setPendingBudget({ surface, budget: surface.budget! })}
                      >
                        Review {surface.budget.threshold}
                        {surface.budget.unit} alert
                      </Button>
                    ) : (
                      (surface.note ?? '—')
                    )}
                  </td>
                </tr>
              ))}
              {filteredSurfaces.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    No surfaces match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <RouteTable
          title="Top by volume"
          icon={Activity}
          routes={topVolume}
          windowKey={windowKey}
          metric={(r) => r.metrics[windowKey].requestCount.toLocaleString()}
          metricLabel="reqs"
          onSelect={setSelectedRoute}
          selected={selectedRoute}
        />
        <RouteTable
          title={`Slowest ${percentile}`}
          icon={Timer}
          routes={slowest}
          windowKey={windowKey}
          metric={(r) => fmtMs(r.metrics[windowKey][percentile])}
          metricLabel={percentile}
          onSelect={setSelectedRoute}
          selected={selectedRoute}
        />
        <RouteTable
          title="Highest error"
          icon={AlertTriangle}
          routes={highestError}
          windowKey={windowKey}
          metric={(r) => fmtPct(r.metrics[windowKey].errorRate)}
          metricLabel="err"
          onSelect={setSelectedRoute}
          selected={selectedRoute}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-border/70 bg-card/70">
          <CardHeader>
            <CardTitle className="text-base">Recent API requests</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">When</th>
                  <th className="pb-2 pr-2 font-medium">Route</th>
                  <th className="pb-2 pr-2 font-medium">Status</th>
                  <th className="pb-2 pr-2 font-medium">Duration</th>
                  <th className="pb-2 font-medium">Downstream</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecent.map((span) => (
                  <RecentRow key={span.traceId} span={span} />
                ))}
                {filteredRecent.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No sampled API requests in this window.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/70">
          <CardHeader>
            <CardTitle className="text-base">
              Route detail
              {selectedRouteMeta
                ? `: ${selectedRouteMeta.method} ${selectedRouteMeta.routeTemplate}`
                : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {!routeDetail ? (
              <p className="text-muted-foreground">Select a route to inspect trends.</p>
            ) : (
              <>
                {routeDetail.synthetic && (
                  <div className="rounded-md border border-border/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Synthetic cold / warm
                    </p>
                    <p className="mt-1 tabular-nums">
                      cold p95 {fmtMs(routeDetail.synthetic.coldP95)} · warm p95{' '}
                      {fmtMs(routeDetail.synthetic.warmP95)} · n=
                      {routeDetail.synthetic.sampleCount}
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {routeDetail.statusClasses.map((s) => (
                    <Badge key={s.label} variant="outline">
                      {s.label}: {s.count}
                    </Badge>
                  ))}
                </div>
                {routeDetail.trends.map((series) => (
                  <div key={`${series.source}-${series.revision}`} className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {series.source} · {series.environment}
                      {series.revision ? ` · ${series.revision.slice(0, 7)}` : ''} · n=
                      {series.sampleCount}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {series.points.map((point) => (
                        <div
                          key={point.label}
                          className="rounded border border-border/50 p-2 tabular-nums"
                        >
                          <div className="text-xs text-muted-foreground">{point.label}</div>
                          <div>p95 {fmtMs(point.p95)}</div>
                          <div className="text-xs">
                            {point.requests} req · {fmtPct(point.errorRate)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/70">
        <CardHeader>
          <CardTitle className="text-base">Web diagnostics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredWebDiagnostics.map((diag) => (
            <div
              key={diag.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border/60 p-3"
            >
              <div>
                <div className="font-medium">
                  {diag.surfaceLabel}{' '}
                  <Badge variant="outline" className="ml-1 capitalize">
                    {diag.state}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{diag.finding}</p>
                <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                  LCP p75 {fmtMs(diag.current.lcpP75)}
                  {diag.previous ? ` ← ${fmtMs(diag.previous.lcpP75)}` : ''} ·{' '}
                  {diag.provenance.source} · n={diag.provenance.sampleCount}
                </p>
              </div>
              {diag.artifactHref && (
                <a
                  href={diag.artifactHref}
                  className="text-xs font-medium text-cyan-400 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {diag.artifactLabel ?? 'PSI artifact'} →
                </a>
              )}
            </div>
          ))}
          {filteredWebDiagnostics.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No web performance evidence for this selection.
            </p>
          )}
        </CardContent>
      </Card>

      <StatusPanel
        state={freshnessTone('stale')}
        title="Budgets stay inactive during observation"
        description="Suggested thresholds appear on surfaces with enough samples. Activate alerting only after explicit owner confirmation; deploy-blocking enforcement is a later decision."
        meta={`Observation started ${new Date(snapshot.observation.startedAt).toLocaleDateString()}`}
      />

      {pendingBudget && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base">Confirm alert-only budget</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Activate {pendingBudget.budget.metric} at {pendingBudget.budget.threshold}
              {pendingBudget.budget.unit} for {pendingBudget.surface.projectName}. This enables
              alerting only; it cannot block a deploy.
            </p>
            <p className="text-muted-foreground">{pendingBudget.budget.rationale}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={async () => {
                  setBudgetStatus('Saving…');
                  const response = await fetch('/api/fleet/speed', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      project_id: pendingBudget.surface.projectId,
                      surface: pendingBudget.surface.id,
                      environment: 'production',
                      mode: 'alerting',
                      latency_p95_ms:
                        pendingBudget.budget.unit === 'ms' ? pendingBudget.budget.threshold : null,
                      error_rate:
                        pendingBudget.budget.unit === '%' ? pendingBudget.budget.threshold : null,
                    }),
                  });
                  setBudgetStatus(
                    response.ok ? 'Alert budget activated.' : 'Budget activation failed.'
                  );
                  if (response.ok) setPendingBudget(null);
                }}
              >
                Confirm alerting
              </Button>
              <Button type="button" variant="outline" onClick={() => setPendingBudget(null)}>
                Cancel
              </Button>
            </div>
            {budgetStatus && <p aria-live="polite">{budgetStatus}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RouteTable({
  title,
  icon: Icon,
  routes,
  windowKey,
  metric,
  metricLabel,
  onSelect,
  selected,
}: {
  title: string;
  icon: typeof Activity;
  routes: ApiRouteRollup[];
  windowKey: SpeedWindow;
  metric: (r: ApiRouteRollup) => string;
  metricLabel: string;
  onSelect: (id: string) => void;
  selected: string | null;
}) {
  return (
    <Card className="border-border/70 bg-card/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4" aria-hidden />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {routes.slice(0, 6).map((route) => (
          <button
            key={route.id}
            type="button"
            onClick={() => onSelect(route.id)}
            className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${
              selected === route.id
                ? 'border-cyan-500/60 bg-cyan-500/10'
                : 'border-border/50 hover:border-border'
            }`}
          >
            <span>
              <span className="font-mono text-xs text-muted-foreground">{route.method}</span>{' '}
              {route.routeTemplate}
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                {route.projectId} · {route.source} · {windowKey}
              </span>
            </span>
            <span className="tabular-nums text-xs">
              {metric(route)} {metricLabel}
            </span>
          </button>
        ))}
        {routes.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No route evidence.</p>
        )}
      </CardContent>
    </Card>
  );
}

function RecentRow({ span }: { span: RecentRequestSpan }) {
  return (
    <tr className="border-b border-border/40 align-top">
      <td className="py-2 pr-2 text-xs text-muted-foreground">
        {new Date(span.observedAt).toLocaleTimeString()}
      </td>
      <td className="py-2 pr-2">
        <span className="font-mono text-xs text-muted-foreground">{span.method}</span>{' '}
        {span.routeTemplate}
        <span className="block text-[11px] text-muted-foreground">
          {span.projectId} · {span.traceId}
          {span.temperature ? ` · ${span.temperature}` : ''}
        </span>
      </td>
      <td className="py-2 pr-2">{span.statusClass}</td>
      <td className="py-2 pr-2 tabular-nums">{fmtMs(span.durationMs)}</td>
      <td className="py-2 text-xs text-muted-foreground">
        {span.operations.length === 0
          ? '—'
          : span.operations.map((op) => `${op.label} ${fmtMs(op.durationMs)}`).join(' · ')}
      </td>
    </tr>
  );
}
