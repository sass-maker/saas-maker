import { redirect } from 'next/navigation';
import { AlertTriangle, Boxes, CircleCheckBig, RadioTower } from 'lucide-react';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PillarHeader,
  StatusPanel,
} from '@foundry/ui';
import inventory from '@foundry-catalog/observability.json';
import { getDashboardSession } from '@/lib/server-session';

export const dynamic = 'force-dynamic';

type VerificationState =
  | 'source-configured'
  | 'fresh-verified'
  | 'stale'
  | 'unknown'
  | 'not-applicable';

function panelState(state: VerificationState) {
  if (state === 'fresh-verified') return 'success' as const;
  if (state === 'stale') return 'stale' as const;
  if (state === 'not-applicable') return 'blocked' as const;
  return 'empty' as const;
}

function stateLabel(state: VerificationState) {
  return state.replaceAll('-', ' ');
}

export default async function ObservabilityPage() {
  const session = await getDashboardSession();
  if (!session?.user) redirect('/login');

  const configured = inventory.projects.filter((project) => project.adapters.length > 0).length;
  const verified = inventory.projects.filter(
    (project) => project.verification.state === 'fresh-verified'
  ).length;
  const unknown = inventory.projects.filter(
    (project) => project.verification.state === 'unknown'
  ).length;
  const warningCount = inventory.findings.filter((finding) => finding.severity !== 'info').length;

  return (
    <div className="space-y-6">
      <PillarHeader
        eyebrow="Visibility"
        title="Fleet observability"
        description="Provider-neutral coverage from the canonical catalog. Source configuration and recent live proof remain separate claims."
        actions={
          <Badge variant="outline">
            Snapshot {new Date(inventory.generatedAt).toLocaleString()}
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Maintained products',
            value: inventory.summary.projects,
            icon: Boxes,
            tone: 'text-cyan-400',
          },
          {
            label: 'Source configured',
            value: configured,
            icon: RadioTower,
            tone: 'text-blue-400',
          },
          {
            label: 'Freshly verified',
            value: verified,
            icon: CircleCheckBig,
            tone: 'text-emerald-400',
          },
          {
            label: 'Warnings / errors',
            value: warningCount,
            icon: AlertTriangle,
            tone: 'text-amber-400',
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

      <StatusPanel
        state={verified > 0 ? 'success' : 'stale'}
        title={
          verified > 0
            ? `${verified} products have fresh delivery proof`
            : 'No product has fresh delivery proof yet'
        }
        description={`${configured} products have recognizable adapters in source; ${unknown} remain unknown because their source or receipts were unavailable to this monorepo snapshot.`}
        meta="Configured does not mean events are arriving. Fresh verification requires a successful timestamped receipt."
      />

      <Card className="border-border/70 bg-card/70">
        <CardHeader>
          <CardTitle className="text-base">Provider and evidence coverage</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                <th className="pb-3 font-medium">Product</th>
                <th className="pb-3 font-medium">Verification</th>
                <th className="pb-3 font-medium">Providers in source</th>
                <th className="pb-3 text-right font-medium">Findings</th>
              </tr>
            </thead>
            <tbody>
              {inventory.projects.map((project) => (
                <tr key={project.projectId} className="border-b border-border/50 last:border-0">
                  <td className="py-3 font-medium">{project.projectId}</td>
                  <td className="py-3">
                    <StatusPanel
                      className="max-w-[190px] px-3 py-2"
                      state={panelState(project.verification.state as VerificationState)}
                      title={stateLabel(project.verification.state as VerificationState)}
                    />
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {project.adapters.length
                      ? project.adapters.map((adapter) => adapter.provider.name).join(', ')
                      : 'No source adapter found'}
                  </td>
                  <td className="py-3 text-right font-mono text-xs">{project.findings.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/70">
        <CardHeader>
          <CardTitle className="text-base">Integrity findings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {inventory.findings.length === 0 ? (
            <StatusPanel state="success" title="No source-integrity findings" />
          ) : (
            inventory.findings.map((finding, index) => (
              <StatusPanel
                key={`${finding.projectId}-${finding.code}-${index}`}
                state={
                  finding.severity === 'info'
                    ? 'empty'
                    : finding.severity === 'warning'
                      ? 'stale'
                      : 'error'
                }
                title={`${finding.projectId} · ${finding.code}`}
                description={finding.message}
                meta={
                  finding.file
                    ? `${finding.file}${finding.line ? `:${finding.line}` : ''}`
                    : finding.severity
                }
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
