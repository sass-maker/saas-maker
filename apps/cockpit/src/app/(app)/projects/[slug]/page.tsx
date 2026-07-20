import { PageHeader } from '@/components/page-header';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@foundry/ui';
import {
  Activity,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Zap,
  Globe,
  Rocket,
  Terminal,
} from 'lucide-react';
import { getAuthenticatedProject } from './get-project';
import { getProjectOperationalState } from '@/lib/posthog-server';
import { getFleetCIStatus } from '@/lib/github-server';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProjectStatusPage({ params }: Props) {
  const { slug } = await params;
  const { project } = await getAuthenticatedProject(slug);

  // 1. Fetch Live Operational State (PostHog)
  const opState = await getProjectOperationalState(project.id);

  // 2. Fetch CI/CD State (GitHub)
  const ciMap = await getFleetCIStatus([project.slug]);
  const latestCI = ciMap[project.slug];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title={project.name} description={`Fleet Unit Status: ${project.slug}`} />
        <div className="flex items-center gap-2">
          {opState?.isOnline ? (
            <Badge variant="success" className="h-6 gap-1.5 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Live Pulse
            </Badge>
          ) : (
            <Badge variant="secondary" className="h-6 gap-1.5 opacity-60">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Idle
            </Badge>
          )}
        </div>
      </div>

      {/* Operational Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary/70">
                Avg Latency
              </p>
              <div className="text-2xl font-bold">{opState?.avgLatency || 0}ms</div>
            </div>
            <Activity className="h-5 w-5 text-primary/40" />
          </CardHeader>
        </Card>

        <Card className="bg-destructive/5 border-destructive/20">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-destructive/70">
                Errors (24h)
              </p>
              <div className="text-2xl font-bold">{opState?.errorCount || 0}</div>
            </div>
            <AlertTriangle className="h-5 w-5 text-destructive/40" />
          </CardHeader>
        </Card>

        <Card className="bg-muted/50 border-muted">
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Last Activity
              </p>
              <div className="text-lg font-bold truncate max-w-[150px]">
                {opState?.lastEventAt
                  ? new Date(opState.lastEventAt).toLocaleTimeString()
                  : 'No data'}
              </div>
            </div>
            <Clock className="h-5 w-5 text-muted-foreground/40" />
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* CI/CD State */}
        <Card>
          <CardHeader className="pb-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Rocket className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-sm font-bold uppercase">Deployment Status</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {latestCI ? (
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={latestCI.conclusion === 'success' ? 'success' : 'destructive'}>
                      {latestCI.conclusion?.toUpperCase() || 'RUNNING'}
                    </Badge>
                    <span className="text-xs font-mono text-muted-foreground">
                      {latestCI.workflowName}
                    </span>
                  </div>
                  {latestCI.updatedAt && (
                    <p className="text-[10px] text-muted-foreground italic">
                      Updated {new Date(latestCI.updatedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                {latestCI.url && (
                  <Button variant="outline" size="sm" className="h-8 text-[10px] gap-1" asChild>
                    <a href={latestCI.url} target="_blank" rel="noreferrer">
                      Action Logs <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground italic">
                No active CI pipelines detected on GitHub.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Industrial Actions */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3 border-b bg-primary/5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold uppercase">Factory Actions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="h-10 text-xs gap-2 border-primary/20 hover:bg-primary/5"
            >
              <Terminal className="h-3 w-3" /> Fix Unit
            </Button>
            <Button
              variant="outline"
              className="h-10 text-xs gap-2 border-primary/20 hover:bg-primary/5"
            >
              <Zap className="h-3 w-3" /> Sync Secrets
            </Button>
            <Button variant="default" className="h-10 text-xs gap-2 col-span-2 shadow-lg">
              <Globe className="h-3 w-3" /> Launch Unit <ExternalLink className="h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ExternalLink(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}
