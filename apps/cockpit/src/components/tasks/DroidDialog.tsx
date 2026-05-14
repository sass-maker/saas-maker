'use client';

import { Play, Square } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { TaskRow } from './TaskBoard';

export interface DroidRunRow {
  id: string;
  task_id: string | null;
  project_slug: string | null;
  repo_url: string | null;
  branch: string | null;
  command: string;
  cwd: string | null;
  sandbox_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  exit_code: number | null;
  duration_ms: number | null;
  summary: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface DroidRunEvent {
  id: string;
  run_id: string;
  type: string;
  actor: string;
  source: string;
  message: string | null;
  command: string | null;
  cwd: string | null;
  exit_code: number | null;
  stdout: string | null;
  stderr: string | null;
  metadata: string;
  created_at: string;
}

export interface DroidRunArtifact {
  id: string;
  run_id: string;
  type: string;
  name: string;
  uri: string;
  metadata: string;
  created_at: string;
}

export interface DroidRunStats {
  total: number;
  by_status: Record<DroidRunRow['status'], number>;
  avg_duration_ms: number | null;
  stale_running: number;
  recent: DroidRunRow[];
}

export type DroidMode = 'command' | 'native';

interface DroidDialogProps {
  task: TaskRow | null;
  mode: DroidMode;
  command: string;
  prompt: string;
  maxTurns: string;
  createPr: boolean;
  repoUrl: string;
  branch: string;
  cwd: string;
  run: DroidRunRow | null;
  events: DroidRunEvent[];
  artifacts: DroidRunArtifact[];
  stats: DroidRunStats | null;
  error: string | null;
  running: boolean;
  onModeChange: (mode: DroidMode) => void;
  onCommandChange: (value: string) => void;
  onPromptChange: (value: string) => void;
  onMaxTurnsChange: (value: string) => void;
  onCreatePrChange: (value: boolean) => void;
  onRepoUrlChange: (value: string) => void;
  onBranchChange: (value: string) => void;
  onCwdChange: (value: string) => void;
  onRun: () => void;
  onReconcile: () => void;
  onCancel: () => void;
  onMarkStale: () => void;
  onClose: () => void;
}

export function DroidDialog({
  task,
  mode,
  command,
  prompt,
  maxTurns,
  createPr,
  repoUrl,
  branch,
  cwd,
  run,
  events,
  artifacts,
  stats,
  error,
  running,
  onModeChange,
  onCommandChange,
  onPromptChange,
  onMaxTurnsChange,
  onCreatePrChange,
  onRepoUrlChange,
  onBranchChange,
  onCwdChange,
  onRun,
  onReconcile,
  onCancel,
  onMarkStale,
  onClose,
}: DroidDialogProps) {
  return (
    <Dialog open={!!task} onOpenChange={open => {
      if (!open) onClose();
    }}>
      <DialogContent className="w-[min(56rem,calc(100vw-2rem))] sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Droid</DialogTitle>
        </DialogHeader>
        {task && (
          <div className="mt-2 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.85fr)]">
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/25 p-3">
                <div className="text-sm font-medium text-foreground">{task.title}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">
                  <span>{task.project_slug ?? 'Unassigned'}</span>
                  {repoUrl ? <span className="font-mono">{repoUrl}</span> : <span>No repo selected</span>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Mode</Label>
                <Select value={mode} onValueChange={value => onModeChange(value as DroidMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="native">Native Droid via DeepSeek</SelectItem>
                    <SelectItem value="command">Command</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {mode === 'command' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="droid-command">Command</Label>
                  <Textarea
                    id="droid-command"
                    value={command}
                    onChange={event => onCommandChange(event.target.value)}
                    rows={5}
                    className="min-h-28 resize-y font-mono text-xs"
                    placeholder="pnpm test"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="droid-prompt">Prompt</Label>
                  <Textarea
                    id="droid-prompt"
                    value={prompt}
                    onChange={event => onPromptChange(event.target.value)}
                    rows={8}
                    className="min-h-40 resize-y"
                    placeholder="Ask Droid to inspect or change the repo..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Uses Droid native tools pointed at DeepSeek. Requires the Droid Worker secret `DROID_DEEPSEEK_API_KEY`.
                  </p>
                </div>
              )}

              {mode === 'native' ? (
                <div className="max-w-40 space-y-1.5">
                  <Label htmlFor="droid-max-turns">Max turns</Label>
                  <Input
                    id="droid-max-turns"
                    value={maxTurns}
                    onChange={event => onMaxTurnsChange(event.target.value)}
                    inputMode="numeric"
                  />
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
                <div>
                  <Label htmlFor="droid-create-pr">Draft PR</Label>
                  <p className="text-xs text-muted-foreground">
                    Push changed Droid runs to a GitHub branch and open a draft PR.
                  </p>
                </div>
                <Switch id="droid-create-pr" checked={createPr} onCheckedChange={onCreatePrChange} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="droid-repo">Repo URL</Label>
                  <Input
                    id="droid-repo"
                    value={repoUrl}
                    onChange={event => onRepoUrlChange(event.target.value)}
                    placeholder="https://github.com/org/repo.git"
                  />
                  <p className="text-xs text-muted-foreground">
                    Private GitHub repos require `DROID_GITHUB_TOKEN` on the Droid Worker.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="droid-branch">Branch</Label>
                  <Input
                    id="droid-branch"
                    value={branch}
                    onChange={event => onBranchChange(event.target.value)}
                    placeholder="main"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="droid-cwd">Working directory</Label>
                <Input
                  id="droid-cwd"
                  value={cwd}
                  onChange={event => onCwdChange(event.target.value)}
                  placeholder="packages/cli"
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Close
                </Button>
                <Button type="button" onClick={onRun} disabled={running || (mode === 'command' ? !command.trim() : !prompt.trim())}>
                  <Play className="h-4 w-4" />
                  {running ? 'Running...' : mode === 'command' ? 'Run in Droid' : 'Ask Droid'}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <DroidStats stats={stats} />
              <DroidError error={error} />
              <DroidResult
                run={run}
                running={running}
                onReconcile={onReconcile}
                onCancel={onCancel}
                onMarkStale={onMarkStale}
              />
              <DroidArtifacts artifacts={artifacts} />
              <DroidEvents events={events} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DroidError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
      {error}
    </div>
  );
}

function DroidStats({ stats }: { stats: DroidRunStats | null }) {
  if (!stats) return null;
  const items = [
    ['Total', stats.total],
    ['Queued', stats.by_status.queued],
    ['Running', stats.by_status.running],
    ['Failed', stats.by_status.failed],
    ['Stale', stats.stale_running],
  ] as const;
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Health</h3>
        {stats.avg_duration_ms !== null ? (
          <span className="text-xs text-muted-foreground">avg {Math.round(stats.avg_duration_ms / 1000)}s</span>
        ) : null}
      </div>
      <div className="mt-2 grid grid-cols-5 gap-2">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-md border bg-background px-2 py-1.5 text-center">
            <div className="text-sm font-semibold text-foreground">{value}</div>
            <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DroidResult({
  run,
  running,
  onReconcile,
  onCancel,
  onMarkStale,
}: {
  run: DroidRunRow | null;
  running: boolean;
  onReconcile: () => void;
  onCancel: () => void;
  onMarkStale: () => void;
}) {
  const reconcileLabel = run?.status === 'queued' ? 'Start queued' : 'Check run';
  const canControl = run?.status === 'queued' || run?.status === 'running';
  const canMarkStale = run?.status === 'running';
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Result</h3>
        {run ? (
          <div className="flex items-center gap-2">
            {canControl ? (
              <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={running}>
                <Square className="h-3.5 w-3.5" />
                Cancel
              </Button>
            ) : null}
            {canControl ? (
              <Button type="button" size="sm" variant="outline" onClick={onReconcile} disabled={running}>
                {reconcileLabel}
              </Button>
            ) : null}
            {canMarkStale ? (
              <Button type="button" size="sm" variant="outline" onClick={onMarkStale} disabled={running}>
                Mark stale
              </Button>
            ) : null}
            <Badge variant="outline" className={cn(
              run.status === 'completed'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                : run.status === 'failed'
                  ? 'border-red-500/45 bg-red-500/10 text-red-600 dark:text-red-300'
                  : 'border-amber-500/45 bg-amber-500/10 text-amber-600 dark:text-amber-300'
            )}>
              {run.status}
            </Badge>
          </div>
        ) : null}
      </div>
      {run ? (
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <div><span className="text-foreground">Run:</span> <span className="font-mono">{run.id}</span></div>
          <div><span className="text-foreground">Exit:</span> {run.exit_code ?? 'pending'}</div>
          <div><span className="text-foreground">Duration:</span> {run.duration_ms ? `${Math.round(run.duration_ms / 1000)}s` : 'pending'}</div>
          {run.summary ? <p className="pt-1 text-sm text-foreground">{run.summary}</p> : null}
          {run.error_message ? <p className="pt-1 text-sm text-red-500">{run.error_message}</p> : null}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Run a command to see the audit trail.</p>
      )}
    </div>
  );
}

function DroidArtifacts({ artifacts }: { artifacts: DroidRunArtifact[] }) {
  if (artifacts.length === 0) return null;
  return (
    <div className="rounded-lg border bg-muted/15 p-3">
      <h3 className="text-sm font-semibold text-foreground">Artifacts</h3>
      <div className="mt-2 space-y-2">
        {artifacts.map(artifact => {
          const metadata = parseDroidMetadata(artifact.metadata);
          const stat = typeof metadata.stat === 'string' ? metadata.stat.trim().split('\n')[0] : '';
          const patchBytes = typeof metadata.patch_bytes === 'number' ? metadata.patch_bytes : null;
          return (
            <div key={artifact.id} className="rounded-md border bg-background p-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground">{artifact.name}</span>
                <Badge variant="outline" className="border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-300">
                  {artifact.type}
                </Badge>
              </div>
              {stat ? <p className="mt-1 text-muted-foreground">{stat}</p> : null}
              {patchBytes !== null ? <p className="mt-1 text-muted-foreground">{patchBytes.toLocaleString()} bytes captured in audit log</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DroidEvents({ events }: { events: DroidRunEvent[] }) {
  return (
    <div className="max-h-[26rem] overflow-y-auto rounded-lg border bg-background p-3">
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Droid events yet.</p>
      ) : (
        <div className="space-y-2">
          {events.map(event => (
            <article key={event.id} className="rounded-md border bg-muted/20 p-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{event.type}</span>
                <span>{formatRunTime(event.created_at)}</span>
                {event.exit_code !== null ? <span>exit {event.exit_code}</span> : null}
              </div>
              {event.command ? <div className="mt-1 break-all font-mono text-xs text-foreground">{event.command}</div> : null}
              {event.cwd ? <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{event.cwd}</div> : null}
              {event.message ? <p className="mt-1 text-xs text-muted-foreground">{event.message}</p> : null}
              {event.stdout || event.stderr ? (
                <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-black/75 p-2 text-[11px] leading-5 text-zinc-100">
                  {[event.stdout, event.stderr].filter(Boolean).join('\n')}
                </pre>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function formatRunTime(value: string) {
  const time = new Date(value);
  if (!Number.isFinite(time.getTime())) return value;
  return time.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function parseDroidMetadata(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}
