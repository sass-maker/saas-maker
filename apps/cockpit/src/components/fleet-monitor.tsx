'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@foundry/ui';
import {
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
  Activity,
  ListChecks,
  Radar,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { apiFetchClient, getClientToken } from '@/lib/api-client';
import { visibleDashboardProjects } from '@/lib/dashboard-projects';
import { buildFleetCommandCenter } from '@/lib/fleet-health';

interface FleetProject {
  name: string;
  path: string;
  slug: string;
  type: 'next' | 'vite' | 'node';
  isLegacy: boolean;
  lastModified: string;
  compliance: {
    score: number;
    total: number;
    checks: {
      config: boolean;
      eslint: boolean;
      tsconfig: boolean;
      prettier: boolean;
      ci: boolean;
      health: boolean;
    };
  };
}

interface FleetHealth {
  percentage: number;
  compliant: number;
  legacy: number;
  registered: number;
  localOnly: number;
  needsAttention: number;
  critical: number;
}

export function FleetMonitor() {
  const [fleet, setFleet] = useState<FleetProject[]>([]);
  const [registeredProjectSlugs, setRegisteredProjectSlugs] = useState<string[]>([]);
  const [health, setHealth] = useState<FleetHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function scanFleet() {
      try {
        const [res, token] = await Promise.all([
          fetch('/api/fleet/scan'),
          getClientToken().catch(() => null),
        ]);
        if (!res.ok) throw new Error('Failed to scan local fleet');
        const data = await res.json();
        const visibleFleet = visibleDashboardProjects((data.fleet || []) as FleetProject[]);
        setFleet(visibleFleet);
        setHealth(data.health);

        if (token) {
          const projects = await apiFetchClient<{ data: Array<{ slug: string; name: string }> }>(
            '/v1/projects',
            token
          );
          setRegisteredProjectSlugs(
            visibleDashboardProjects(projects.data ?? []).map((project) => project.slug)
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Scanner unavailable');
      } finally {
        setLoading(false);
      }
    }
    scanFleet();
  }, []);

  if (loading) return null;
  if (error) return null;

  const commandCenter = buildFleetCommandCenter(fleet, registeredProjectSlugs);
  const displayHealth = commandCenter.health ?? health;
  const priorityProjects = commandCenter.projects
    .filter((project) => project.status !== 'ready')
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {displayHealth && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary/70">
                  Compliance Rate
                </CardTitle>
                <div className="text-2xl font-bold">{displayHealth.percentage}%</div>
              </div>
              <ShieldCheck className="h-5 w-5 text-primary/40" />
            </CardHeader>
          </Card>
          <Card className="bg-green-500/5 border-green-500/20">
            <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-green-600/70">
                  Fully Compliant
                </CardTitle>
                <div className="text-2xl font-bold">{displayHealth.compliant}</div>
              </div>
              <CheckCircle2 className="h-5 w-5 text-green-500/40" />
            </CardHeader>
          </Card>
          <Card className="bg-yellow-500/5 border-yellow-500/20">
            <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-yellow-600/70">
                  Needs Attention
                </CardTitle>
                <div className="text-2xl font-bold">{displayHealth.needsAttention}</div>
              </div>
              <AlertTriangle className="h-5 w-5 text-yellow-500/40" />
            </CardHeader>
          </Card>
        </div>
      )}

      <Card className="border-primary/20">
        <CardHeader className="p-4 border-b bg-muted/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Radar className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-bold uppercase">
                  Fleet Health Command Center
                </CardTitle>
              </div>
              <CardDescription>
                Highest-risk local units and the next standards action for each one.
              </CardDescription>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center sm:w-72">
              <div className="rounded-md border bg-background px-2 py-2">
                <div className="text-lg font-bold">{displayHealth?.registered ?? 0}</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  Synced
                </div>
              </div>
              <div className="rounded-md border bg-background px-2 py-2">
                <div className="text-lg font-bold">{displayHealth?.localOnly ?? 0}</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  Local
                </div>
              </div>
              <div className="rounded-md border bg-background px-2 py-2">
                <div className="text-lg font-bold">{displayHealth?.critical ?? 0}</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  Critical
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
          <div className="space-y-3">
            {priorityProjects.length > 0 ? (
              priorityProjects.map((project) => (
                <div key={project.slug} className="rounded-md border bg-background p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold">{project.name}</span>
                        <Badge
                          variant={project.status === 'critical' ? 'destructive' : 'secondary'}
                          className="text-[9px] uppercase"
                        >
                          {project.status}
                        </Badge>
                        {!project.isRegistered && (
                          <Badge variant="outline" className="text-[9px] uppercase">
                            Local only
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {project.issues.slice(0, 2).join(' · ')}
                      </p>
                    </div>
                    <div className="text-right font-mono text-xs">
                      {project.score}/{project.total}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Wrench className="h-3.5 w-3.5 shrink-0" />
                    <span>{project.actions[0] ?? 'Inspect the project.'}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-md border bg-green-500/5 p-4 text-sm text-green-700">
                All detected fleet units are ready.
              </div>
            )}
          </div>
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="mb-3 flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              <div className="text-xs font-bold uppercase tracking-wider">Action Digest</div>
            </div>
            <div className="space-y-2">
              {commandCenter.actionDigest.length > 0 ? (
                commandCenter.actionDigest.map((item) => (
                  <div key={item} className="rounded border bg-background px-3 py-2 text-xs">
                    {item}
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">No fleet actions queued.</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold tracking-tight">Active Units</h2>
          <Badge variant="outline" className="ml-auto font-mono text-[10px]">
            {fleet.length} units detected
          </Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fleet.map((project) => (
            <Card key={project.path} className="group transition-all hover:border-primary/50">
              <CardHeader className="p-4 pb-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-sm font-bold truncate leading-tight">
                      {project.name}
                    </CardTitle>
                    <CardDescription className="text-[10px] font-mono truncate opacity-60">
                      {project.slug}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={project.isLegacy ? 'secondary' : 'default'}
                    className="capitalize text-[9px] px-1.5 py-0 shrink-0 ml-2"
                  >
                    {project.type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold">
                      Factory Score
                    </span>
                    <span className="text-[10px] font-mono">
                      {project.compliance.score}/{project.compliance.total}
                    </span>
                  </div>
                  <div className="flex gap-0.5">
                    {Object.entries(project.compliance.checks).map(([key, val]) => (
                      <div
                        key={key}
                        className={`h-1 flex-1 rounded-full ${val ? 'bg-green-500' : 'bg-muted'}`}
                        title={`${key}: ${val ? 'Pass' : 'Fail'}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                    {project.isLegacy ? (
                      <Zap className="h-2.5 w-2.5 text-yellow-500" />
                    ) : (
                      <ShieldCheck className="h-2.5 w-2.5 text-green-500" />
                    )}
                    {project.isLegacy ? 'Legacy' : 'Standard'}
                  </span>
                  {registeredProjectSlugs.includes(project.slug) ? (
                    <Link
                      href={`/projects/${project.slug}`}
                      className="text-[11px] font-bold text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform"
                    >
                      Inspect <ArrowRight className="h-3 w-3" />
                    </Link>
                  ) : (
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Local only
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
