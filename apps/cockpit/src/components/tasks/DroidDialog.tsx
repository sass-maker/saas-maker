'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clipboard, ExternalLink, Eye, Play, Repeat2, Square, XCircle } from 'lucide-react';
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
  idle_running?: number;
  idle_after_seconds?: number;
  stale_after_seconds?: number;
  estimated_compute_seconds?: number;
  recent: DroidRunRow[];
}

export type DroidMode = 'command' | 'native';

interface DroidDialogProps {
  task: TaskRow | null;
  mode: DroidMode;
  command: string;
  prompt: string;
  maxTurns: string;
  loopEnabled: boolean;
  loopMaxAttempts: string;
  loopRetryOnFailure: boolean;
  createPr: boolean;
  acceptanceCommand: string;
  acceptanceSuggestions: string[];
  browserAcceptanceEnabled: boolean;
  browserAcceptanceUrl: string;
  browserAcceptanceGoal: string;
  browserAcceptanceAssertText: string;
  browserAcceptanceStartCommand: string;
  browserAcceptancePort: string;
  browserAcceptanceKeepOpen: boolean;
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
  onLoopEnabledChange: (value: boolean) => void;
  onLoopMaxAttemptsChange: (value: string) => void;
  onLoopRetryOnFailureChange: (value: boolean) => void;
  onCreatePrChange: (value: boolean) => void;
  onAcceptanceCommandChange: (value: string) => void;
  onBrowserAcceptanceEnabledChange: (value: boolean) => void;
  onBrowserAcceptanceUrlChange: (value: string) => void;
  onBrowserAcceptanceGoalChange: (value: string) => void;
  onBrowserAcceptanceAssertTextChange: (value: string) => void;
  onBrowserAcceptanceStartCommandChange: (value: string) => void;
  onBrowserAcceptancePortChange: (value: string) => void;
  onBrowserAcceptanceKeepOpenChange: (value: boolean) => void;
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
  loopEnabled,
  loopMaxAttempts,
  loopRetryOnFailure,
  createPr,
  acceptanceCommand,
  acceptanceSuggestions,
  browserAcceptanceEnabled,
  browserAcceptanceUrl,
  browserAcceptanceGoal,
  browserAcceptanceAssertText,
  browserAcceptanceStartCommand,
  browserAcceptancePort,
  browserAcceptanceKeepOpen,
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
  onLoopEnabledChange,
  onLoopMaxAttemptsChange,
  onLoopRetryOnFailureChange,
  onCreatePrChange,
  onAcceptanceCommandChange,
  onBrowserAcceptanceEnabledChange,
  onBrowserAcceptanceUrlChange,
  onBrowserAcceptanceGoalChange,
  onBrowserAcceptanceAssertTextChange,
  onBrowserAcceptanceStartCommandChange,
  onBrowserAcceptancePortChange,
  onBrowserAcceptanceKeepOpenChange,
  onRepoUrlChange,
  onBranchChange,
  onCwdChange,
  onRun,
  onReconcile,
  onCancel,
  onMarkStale,
  onClose,
}: DroidDialogProps) {
  const acceptanceWarning = createPr && !acceptanceCommand.trim();
  const browserTargetMissing = browserAcceptanceEnabled && !browserAcceptanceUrl.trim() && !browserAcceptanceStartCommand.trim();

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
                <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
                  <div className="space-y-1.5">
                    <Label htmlFor="droid-max-turns">Max turns</Label>
                    <Input
                      id="droid-max-turns"
                      value={maxTurns}
                      onChange={event => onMaxTurnsChange(event.target.value)}
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <Label htmlFor="droid-loop-mode" className="inline-flex items-center gap-1.5">
                          <Repeat2 className="h-3.5 w-3.5" />
                          Loop mode
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Bounded attempts with audit-only retry policy.
                        </p>
                      </div>
                      <Switch id="droid-loop-mode" checked={loopEnabled} onCheckedChange={onLoopEnabledChange} />
                    </div>
                    {loopEnabled ? (
                      <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
                        <div className="space-y-1.5">
                          <Label htmlFor="droid-loop-attempts">Attempts</Label>
                          <Input
                            id="droid-loop-attempts"
                            value={loopMaxAttempts}
                            onChange={event => onLoopMaxAttemptsChange(event.target.value)}
                            inputMode="numeric"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
                          <Label htmlFor="droid-loop-retry" className="text-xs text-muted-foreground">
                            Retry on failed checks
                          </Label>
                          <Switch id="droid-loop-retry" checked={loopRetryOnFailure} onCheckedChange={onLoopRetryOnFailureChange} />
                        </div>
                      </div>
                    ) : null}
                  </div>
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

              <div className="space-y-1.5">
                <Label htmlFor="droid-acceptance">Acceptance command</Label>
                <Input
                  id="droid-acceptance"
                  value={acceptanceCommand}
                  onChange={event => onAcceptanceCommandChange(event.target.value)}
                  placeholder="pnpm test"
                  className="font-mono text-xs"
                />
                {acceptanceSuggestions.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {acceptanceSuggestions.map(suggestion => (
                      <Button
                        key={suggestion}
                        type="button"
                        size="sm"
                        variant={acceptanceCommand === suggestion ? 'secondary' : 'outline'}
                        className="h-auto min-h-7 max-w-full justify-start px-2 py-1 font-mono text-[11px]"
                        onClick={() => onAcceptanceCommandChange(suggestion)}
                      >
                        <span className="truncate">{suggestion}</span>
                      </Button>
                    ))}
                  </div>
                ) : null}
                {acceptanceWarning ? (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/35 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>Droid can open a PR without this, but no acceptance check will guard it.</span>
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Optional. Droid runs this in the repo before opening a draft PR.
                </p>
              </div>

              <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="droid-browser-acceptance">Browser test</Label>
                    <p className="text-xs text-muted-foreground">
                      Run a Cloudflare Browser Run check and capture a screenshot.
                    </p>
                  </div>
                  <Switch
                    id="droid-browser-acceptance"
                    checked={browserAcceptanceEnabled}
                    onCheckedChange={onBrowserAcceptanceEnabledChange}
                  />
                </div>
                {browserAcceptanceEnabled ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="droid-browser-goal">Goal</Label>
                      <Input
                        id="droid-browser-goal"
                        value={browserAcceptanceGoal}
                        onChange={event => onBrowserAcceptanceGoalChange(event.target.value)}
                        placeholder="Verify the Droid dialog shows acceptance, artifacts, and events"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="droid-browser-url">URL</Label>
                      <Input
                        id="droid-browser-url"
                        value={browserAcceptanceUrl}
                        onChange={event => onBrowserAcceptanceUrlChange(event.target.value)}
                        placeholder="https://preview-or-deploy.example.com/tasks"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem]">
                      <div className="space-y-1.5">
                        <Label htmlFor="droid-browser-start">Start command</Label>
                        <Input
                          id="droid-browser-start"
                          value={browserAcceptanceStartCommand}
                          onChange={event => onBrowserAcceptanceStartCommandChange(event.target.value)}
                          placeholder="pnpm dev --host 0.0.0.0 --port 3000"
                          className="font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="droid-browser-port">Port</Label>
                        <Input
                          id="droid-browser-port"
                          value={browserAcceptancePort}
                          onChange={event => onBrowserAcceptancePortChange(event.target.value)}
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="droid-browser-assert">Text to assert</Label>
                      <Input
                        id="droid-browser-assert"
                        value={browserAcceptanceAssertText}
                        onChange={event => onBrowserAcceptanceAssertTextChange(event.target.value)}
                        placeholder="Droid,Acceptance,Events"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="droid-browser-keep-open" className="text-xs text-muted-foreground">
                        Keep live browser open briefly
                      </Label>
                      <Switch
                        id="droid-browser-keep-open"
                        checked={browserAcceptanceKeepOpen}
                        onCheckedChange={onBrowserAcceptanceKeepOpenChange}
                      />
                    </div>
                    {browserTargetMissing ? (
                      <div className="flex items-start gap-2 rounded-md border border-amber-500/35 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-200">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>Add a URL or a start command before running browser acceptance.</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
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
                <Button type="button" onClick={onRun} disabled={running || browserTargetMissing || (mode === 'command' ? !command.trim() : !prompt.trim())}>
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
                events={events}
                running={running}
                onReconcile={onReconcile}
                onCancel={onCancel}
                onMarkStale={onMarkStale}
              />
              <DroidAcceptance events={events} />
              <DroidBrowserAcceptance events={events} artifacts={artifacts} />
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
    ['Idle', stats.idle_running ?? 0],
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
      <div className="mt-2 grid grid-cols-6 gap-2">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-md border bg-background px-2 py-1.5 text-center">
            <div className="text-sm font-semibold text-foreground">{value}</div>
            <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      {stats.estimated_compute_seconds ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          approx {Math.round(stats.estimated_compute_seconds / 60)}m sandbox runtime tracked
        </p>
      ) : null}
      <p className="mt-2 text-[11px] text-muted-foreground">
        idle after {formatDuration(stats.idle_after_seconds ?? 360)}; stale reap after {formatDuration(stats.stale_after_seconds ?? 900)}
      </p>
    </div>
  );
}

function DroidResult({
  run,
  events,
  running,
  onReconcile,
  onCancel,
  onMarkStale,
}: {
  run: DroidRunRow | null;
  events: DroidRunEvent[];
  running: boolean;
  onReconcile: () => void;
  onCancel: () => void;
  onMarkStale: () => void;
}) {
  const finalReport = useMemo(() => getFinalReport(events), [events]);
  const loopStatus = useMemo(() => getLoopStatus(events), [events]);
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
          {loopStatus ? (
            <div className="mt-2 rounded-md border bg-background p-2 text-[11px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                  <Repeat2 className="h-3 w-3" />
                  Loop
                </span>
                <Badge variant="outline">{loopStatus.label}</Badge>
              </div>
              <p className="mt-1 text-muted-foreground">
                attempt {loopStatus.attempt} of {loopStatus.maxAttempts}
                {loopStatus.retryOnFailure ? ', retry on failed checks' : ', no retry'}
              </p>
              {loopStatus.message ? <p className="mt-1 text-muted-foreground">{loopStatus.message}</p> : null}
            </div>
          ) : null}
          {run.summary ? <p className="pt-1 text-sm text-foreground">{run.summary}</p> : null}
          {run.error_message ? <p className="pt-1 text-sm text-red-500">{run.error_message}</p> : null}
          {finalReport ? (
            <div className="mt-2 space-y-2 rounded-md border bg-background p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground">Final report</span>
                {finalReport.prUrl ? (
                  <a
                    href={finalReport.prUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-300"
                  >
                    PR
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
              {finalReport.summary ? <p className="text-xs text-foreground">{finalReport.summary}</p> : null}
              {finalReport.prBranch ? (
                <div className="break-all text-[11px] text-muted-foreground">
                  <span className="text-foreground">Branch:</span> {finalReport.prBranch}
                </div>
              ) : null}
              {finalReport.filesChanged.length > 0 ? (
                <div className="text-[11px] text-muted-foreground">
                  <span className="text-foreground">Files:</span> {finalReport.filesChanged.slice(0, 4).join(', ')}
                  {finalReport.filesChanged.length > 4 ? ` +${finalReport.filesChanged.length - 4}` : ''}
                </div>
              ) : null}
              {finalReport.checksRun.length > 0 ? (
                <div className="text-[11px] text-muted-foreground">
                  <span className="text-foreground">Checks:</span> {finalReport.checksRun.join(', ')}
                </div>
              ) : null}
              {finalReport.nextAction ? (
                <div className="text-[11px] text-muted-foreground">
                  <span className="text-foreground">Next:</span> {finalReport.nextAction}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Run a command to see the audit trail.</p>
      )}
    </div>
  );
}

function DroidAcceptance({ events }: { events: DroidRunEvent[] }) {
  const acceptance = useMemo(() => getLatestEvent(events, ['acceptance_passed', 'acceptance_failed']), [events]);
  if (!acceptance) return null;
  const passed = acceptance.type === 'acceptance_passed';
  return (
    <div className={cn(
      'rounded-lg border p-3',
      passed
        ? 'border-emerald-500/35 bg-emerald-500/10'
        : 'border-red-500/40 bg-red-500/10'
    )}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {passed ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" /> : <XCircle className="h-4 w-4 text-red-600 dark:text-red-300" />}
          Acceptance
        </h3>
        <Badge variant="outline" className={passed
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
          : 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-200'
        }>
          {passed ? 'passed' : 'failed'}
        </Badge>
      </div>
      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        {acceptance.command ? <div className="break-all font-mono text-foreground">{acceptance.command}</div> : null}
        {acceptance.cwd ? <div className="break-all font-mono text-[11px]">{acceptance.cwd}</div> : null}
        {acceptance.message ? <p>{acceptance.message}</p> : null}
        {acceptance.exit_code !== null ? <p>exit {acceptance.exit_code}</p> : null}
      </div>
    </div>
  );
}

function DroidBrowserAcceptance({ events, artifacts }: { events: DroidRunEvent[]; artifacts: DroidRunArtifact[] }) {
  const event = useMemo(() => getLatestEvent(events, ['browser_acceptance_passed', 'browser_acceptance_failed']), [events]);
  const artifact = useMemo(() => [...artifacts].reverse().find(item => item.type === 'browser_acceptance') ?? null, [artifacts]);
  if (!event && !artifact) return null;
  const passed = event?.type === 'browser_acceptance_passed';
  const metadata = parseDroidMetadata((artifact ?? event)?.metadata ?? '{}');
  const screenshot = stringFromUnknown(metadata.screenshot_data_uri);
  const url = stringFromUnknown(metadata.url);
  const title = stringFromUnknown(metadata.title);
  const sessionId = stringFromUnknown(metadata.session_id);
  return (
    <div className={cn(
      'rounded-lg border p-3',
      passed
        ? 'border-emerald-500/35 bg-emerald-500/10'
        : 'border-red-500/40 bg-red-500/10'
    )}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Eye className={cn('h-4 w-4', passed ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300')} />
          Browser
        </h3>
        <Badge variant="outline" className={passed
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
          : 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-200'
        }>
          {passed ? 'passed' : 'failed'}
        </Badge>
      </div>
      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 text-blue-600 hover:underline dark:text-blue-300">
            <span className="truncate">{url}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : null}
        {title ? <p><span className="text-foreground">Title:</span> {title}</p> : null}
        {sessionId ? <p className="break-all font-mono text-[11px]">session {sessionId}</p> : null}
        {event?.message ? <p>{event.message}</p> : null}
      </div>
      {screenshot ? (
        <div className="mt-2 overflow-hidden rounded-md border bg-background">
          <img src={screenshot} alt="Droid browser acceptance screenshot" className="h-auto w-full" />
        </div>
      ) : null}
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
          const screenshot = stringFromUnknown(metadata.screenshot_data_uri);
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
              {screenshot ? (
                <img src={screenshot} alt={artifact.name} className="mt-2 h-auto w-full rounded border" />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DroidEvents({ events }: { events: DroidRunEvent[] }) {
  const [copied, setCopied] = useState(false);
  const copyLogs = async () => {
    try {
      await navigator.clipboard.writeText(formatDroidEvents(events));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="max-h-[26rem] overflow-y-auto rounded-lg border bg-background p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Events</h3>
        <Button type="button" size="sm" variant="outline" onClick={copyLogs} disabled={events.length === 0}>
          <Clipboard className="h-3.5 w-3.5" />
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
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

function getLatestEvent(events: DroidRunEvent[], types: string[]) {
  const allowed = new Set(types);
  return [...events].reverse().find(event => allowed.has(event.type)) ?? null;
}

function getFinalReport(events: DroidRunEvent[]) {
  const finalEvent = getLatestEvent(events, ['final_output']);
  if (!finalEvent) return null;
  const metadata = parseDroidMetadata(finalEvent.metadata);
  return {
    summary: stringFromUnknown(metadata.summary) || finalEvent.message || finalEvent.stdout || '',
    prUrl: stringFromUnknown(metadata.pr_url),
    prBranch: stringFromUnknown(metadata.pr_branch),
    nextAction: stringFromUnknown(metadata.next_action),
    filesChanged: stringArrayFromUnknown(metadata.files_changed),
    checksRun: stringArrayFromUnknown(metadata.checks_run),
  };
}

function getLoopStatus(events: DroidRunEvent[]) {
  const loopEvent = getLatestEvent(events, ['loop_completed', 'loop_stopped', 'loop_started']);
  if (!loopEvent) return null;
  const metadata = parseDroidMetadata(loopEvent.metadata);
  return {
    label: loopEvent.type.replace('loop_', '').replace('_', ' '),
    message: loopEvent.message ?? '',
    attempt: numberFromUnknown(metadata.attempt) ?? 1,
    maxAttempts: numberFromUnknown(metadata.max_attempts) ?? 1,
    retryOnFailure: metadata.retry_on_failure === true,
  };
}

function numberFromUnknown(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function formatDroidEvents(events: DroidRunEvent[]) {
  return events.map(event => {
    const lines = [
      `[${formatRunTime(event.created_at)}] ${event.type}`,
      event.command ? `command: ${event.command}` : '',
      event.cwd ? `cwd: ${event.cwd}` : '',
      event.exit_code !== null ? `exit: ${event.exit_code}` : '',
      event.message ? `message: ${event.message}` : '',
      event.stdout ? `stdout:\n${event.stdout}` : '',
      event.stderr ? `stderr:\n${event.stderr}` : '',
    ].filter(Boolean);
    return lines.join('\n');
  }).join('\n\n');
}

function stringArrayFromUnknown(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function stringFromUnknown(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function formatRunTime(value: string) {
  const time = new Date(value);
  if (!Number.isFinite(time.getTime())) return value;
  return time.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m`;
}

function parseDroidMetadata(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}
