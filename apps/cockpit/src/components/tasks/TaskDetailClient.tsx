'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bot, CheckCircle2, ExternalLink, FileText, MessageSquare, Play, Save, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetchClient, getClientToken } from '@/lib/api-client';
import type { SymphonyRunRow, TaskCommentRow, TaskRow } from './TaskBoard';

type TaskWorkflowRow = {
  id: string;
  owner_id: string;
  task_id: string | null;
  project_slug: string | null;
  name: string;
  description: string | null;
  context_markdown: string;
  prompt_template: string;
  status: 'draft' | 'active' | 'archived';
  last_run_id: string | null;
  created_at: string;
  updated_at: string;
};

type TaskWorkflowArtifactRow = {
  id: string;
  workflow_id: string;
  task_id: string | null;
  project_slug: string | null;
  run_id: string | null;
  name: string;
  content_markdown: string;
  share_token: string;
  created_at: string;
};

const DEFAULT_WORKFLOW_PROMPT = `Use the task and context above to do the smallest useful implementation pass.

Requirements:
- Keep the diff small and aligned with the repository.
- Run the smallest relevant check.
- Return a concise handoff with changed files, checks, blockers, and next tasks.`;

async function taskDetailFetch<T>(path: string, isLocal: boolean, init?: RequestInit): Promise<T> {
  if (isLocal) {
    const token = await getClientToken();
    return apiFetchClient<T>(path, token, init);
  }
  const cockpitPath = path.replace(/^\/v1/, '/api/cockpit');
  const res = await fetch(cockpitPath, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error((await res.text()) || `Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

function formatTime(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return value;
  return new Date(time).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

function pillClass(value: string) {
  if (value === 'high' || value === 'failed') return 'border-red-500/45 bg-red-500/10 text-red-600 dark:text-red-300';
  if (value === 'medium' || value === 'pending') return 'border-amber-500/45 bg-amber-500/10 text-amber-600 dark:text-amber-300';
  if (value === 'done' || value === 'success' || value === 'merged') return 'border-emerald-500/45 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300';
  return 'border-border/60 bg-background/35 text-muted-foreground';
}

export function TaskDetailClient({
  initialTask,
  initialComments,
  initialRuns,
  isLocal,
}: {
  initialTask: TaskRow;
  initialComments: TaskCommentRow[];
  initialRuns: SymphonyRunRow[];
  isLocal: boolean;
}) {
  const [task, setTask] = useState(initialTask);
  const [comments, setComments] = useState(initialComments);
  const [commentText, setCommentText] = useState('');
  const [resolveWithComment, setResolveWithComment] = useState(initialTask.blocked_on_user);
  const [markDoneWithComment, setMarkDoneWithComment] = useState(false);
  const [blockWithComment, setBlockWithComment] = useState(false);
  const [syncCommentToDescription, setSyncCommentToDescription] = useState(initialTask.blocked_on_user);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<TaskWorkflowRow[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState(`${initialTask.title} workflow`);
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [workflowContext, setWorkflowContext] = useState(initialTask.description ?? '');
  const [workflowPrompt, setWorkflowPrompt] = useState(DEFAULT_WORKFLOW_PROMPT);
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const [workflowRunning, setWorkflowRunning] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowRunResult, setWorkflowRunResult] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<TaskWorkflowArtifactRow[]>([]);
  const [artifactName, setArtifactName] = useState(`${initialTask.title} result`);
  const [artifactMarkdown, setArtifactMarkdown] = useState('');
  const [artifactSaving, setArtifactSaving] = useState(false);

  const loadWorkflowArtifacts = async (workflowId: string) => {
    try {
      const res = await taskDetailFetch<{ data: TaskWorkflowRow; artifacts?: TaskWorkflowArtifactRow[] }>(`/v1/task-workflows/${workflowId}`, isLocal);
      setArtifacts(res.artifacts ?? []);
    } catch {
      setArtifacts([]);
    }
  };

  const selectWorkflow = (workflow: TaskWorkflowRow) => {
    setSelectedWorkflowId(workflow.id);
    setWorkflowName(workflow.name);
    setWorkflowDescription(workflow.description ?? '');
    setWorkflowContext(workflow.context_markdown);
    setWorkflowPrompt(workflow.prompt_template);
    setWorkflowRunResult(workflow.last_run_id ? `Last Droid run: ${workflow.last_run_id}` : null);
    void loadWorkflowArtifacts(workflow.id);
  };

  useEffect(() => {
    let cancelled = false;
    taskDetailFetch<{ data: TaskWorkflowRow[] }>(`/v1/task-workflows?task_id=${encodeURIComponent(initialTask.id)}`, isLocal)
      .then(res => {
        if (cancelled) return;
        setWorkflows(res.data ?? []);
        if (res.data?.[0]) selectWorkflow(res.data[0]);
      })
      .catch(err => {
        if (!cancelled) setWorkflowError(err instanceof Error ? err.message : 'Failed to load workflows');
      });
    return () => {
      cancelled = true;
    };
    // selectWorkflow intentionally owns the artifact side-load and form hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTask.id, isLocal]);

  const saveWorkflow = async () => {
    if (!workflowName.trim() || !workflowPrompt.trim()) return null;
    setWorkflowSaving(true);
    setWorkflowError(null);
    try {
      const body = {
        task_id: task.id,
        project_slug: task.project_slug,
        name: workflowName.trim(),
        description: workflowDescription.trim() || null,
        context_markdown: workflowContext.trim(),
        prompt_template: workflowPrompt.trim(),
        status: 'active',
      };
      const res = await taskDetailFetch<{ data: TaskWorkflowRow }>(
        selectedWorkflowId ? `/v1/task-workflows/${selectedWorkflowId}` : '/v1/task-workflows',
        isLocal,
        {
          method: selectedWorkflowId ? 'PATCH' : 'POST',
          body: JSON.stringify(body),
        },
      );
      setSelectedWorkflowId(res.data.id);
      setWorkflows(prev => [res.data, ...prev.filter(workflow => workflow.id !== res.data.id)]);
      return res.data;
    } catch (err) {
      setWorkflowError(err instanceof Error ? err.message : 'Failed to save workflow');
      return null;
    } finally {
      setWorkflowSaving(false);
    }
  };

  const runWorkflow = async () => {
    const workflow = selectedWorkflowId ? workflows.find(item => item.id === selectedWorkflowId) ?? await saveWorkflow() : await saveWorkflow();
    if (!workflow) return;
    setWorkflowRunning(true);
    setWorkflowError(null);
    setWorkflowRunResult(null);
    try {
      const res = await fetch(`/api/task-workflows/${workflow.id}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ create_pr: false }),
      });
      const json = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : `Droid run failed: ${res.status}`);
      const runId = typeof json.id === 'string'
        ? json.id
        : json.data && typeof json.data === 'object' && typeof (json.data as Record<string, unknown>).id === 'string'
          ? (json.data as Record<string, unknown>).id as string
          : null;
      setWorkflowRunResult(runId ? `Droid run started: ${runId}` : 'Droid run started.');
      if (runId) setWorkflows(prev => prev.map(item => item.id === workflow.id ? { ...item, last_run_id: runId } : item));
    } catch (err) {
      setWorkflowError(err instanceof Error ? err.message : 'Failed to run workflow');
    } finally {
      setWorkflowRunning(false);
    }
  };

  const saveArtifact = async () => {
    if (!selectedWorkflowId || !artifactName.trim() || !artifactMarkdown.trim()) return;
    setArtifactSaving(true);
    setWorkflowError(null);
    try {
      const currentWorkflow = workflows.find(workflow => workflow.id === selectedWorkflowId);
      const res = await taskDetailFetch<{ data: TaskWorkflowArtifactRow }>(`/v1/task-workflows/${selectedWorkflowId}/artifacts`, isLocal, {
        method: 'POST',
        body: JSON.stringify({
          name: artifactName.trim(),
          content_markdown: artifactMarkdown.trim(),
          run_id: currentWorkflow?.last_run_id ?? null,
        }),
      });
      setArtifacts(prev => [res.data, ...prev]);
      setArtifactMarkdown('');
    } catch (err) {
      setWorkflowError(err instanceof Error ? err.message : 'Failed to save artifact');
    } finally {
      setArtifactSaving(false);
    }
  };

  const addComment = async () => {
    if (!commentText.trim()) return;
    const resolvesBlocker = task.blocked_on_user && resolveWithComment;
    const marksDone = task.status !== 'done' && markDoneWithComment;
    setSaving(true);
    setError(null);
    try {
      const res = await taskDetailFetch<{ data: TaskCommentRow; task?: TaskRow | null }>(`/v1/tasks/${task.id}/comments`, isLocal, {
        method: 'POST',
        body: JSON.stringify({
          body: commentText.trim(),
          resolves_blocker: resolvesBlocker,
          marks_done: marksDone,
          sync_to_description: syncCommentToDescription,
        }),
      });
      setComments(prev => [...prev, res.data]);
      if (res.task) {
        setTask(res.task);
      } else if (resolvesBlocker || marksDone) {
        setTask(prev => ({
          ...prev,
          status: marksDone ? 'done' : prev.status,
          blocked_on_user: false,
          updated_at: new Date().toISOString(),
        }));
      }
      if (resolvesBlocker) {
        setResolveWithComment(false);
      }
      if (marksDone) {
        setMarkDoneWithComment(false);
      }
      if (blockWithComment && !marksDone) {
        const updated = await taskDetailFetch<{ data: TaskRow }>(`/v1/tasks/${task.id}`, isLocal, {
          method: 'PATCH',
          body: JSON.stringify({ blocked_on_user: true }),
        });
        setTask(updated.data);
        setBlockWithComment(false);
      }
      if (syncCommentToDescription) {
        setSyncCommentToDescription(false);
      }
      setCommentText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <Link href="/tasks" className="text-sm text-muted-foreground hover:text-foreground">
            Back to tasks
          </Link>
          <h1 className="break-words text-2xl font-bold text-foreground">{task.title}</h1>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={pillClass(task.status)}>{task.status.replace('_', ' ')}</Badge>
            <Badge variant="outline" className={pillClass(task.priority)}>{task.priority}</Badge>
            <Badge variant="outline">{task.task_type}</Badge>
            {task.project_slug ? <Badge variant="outline">{task.project_slug}</Badge> : null}
            {task.blocked_on_user ? (
              <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-300">
                Needs decision
              </Badge>
            ) : null}
            {task.status === 'done' && (
              task.has_changelog
                ? <Badge variant="outline" className="border-emerald-500/45 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">Changelog</Badge>
                : (task.task_type === 'feature' || task.task_type === 'bug')
                  ? <Badge variant="outline" className="border-amber-500/45 bg-amber-500/10 text-amber-600 dark:text-amber-300">No changelog</Badge>
                  : null
            )}
          </div>
        </div>
      </div>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Details</h2>
        {task.description ? (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{task.description}</p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No description.</p>
        )}
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div><span className="text-muted-foreground">Created:</span> {formatTime(task.created_at)}</div>
          <div><span className="text-muted-foreground">Updated:</span> {formatTime(task.updated_at)}</div>
          {task.branch_name ? <div><span className="text-muted-foreground">Branch:</span> <span className="font-mono">{task.branch_name}</span></div> : null}
          {task.commit_sha ? <div><span className="text-muted-foreground">Commit:</span> <span className="font-mono">{task.commit_sha.slice(0, 7)}</span></div> : null}
          {task.pr_url ? (
            <a href={task.pr_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-foreground hover:underline">
              Pull request <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
          {task.deployment_url ? (
            <a href={task.deployment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-foreground hover:underline">
              Deployment <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Task Workflows</h2>
          <Badge variant="outline" className="font-mono text-[10px]">{workflows.length}</Badge>
        </div>

        {workflows.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {workflows.map(workflow => (
              <button
                key={workflow.id}
                type="button"
                onClick={() => selectWorkflow(workflow)}
                className={`rounded-md border px-3 py-2 text-left text-xs transition ${selectedWorkflowId === workflow.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border/70 bg-muted/20 text-muted-foreground hover:text-foreground'}`}
              >
                <span className="block font-medium">{workflow.name}</span>
                <span className="font-mono">{workflow.status}{workflow.last_run_id ? ` - ${workflow.last_run_id.slice(0, 8)}` : ''}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="workflow-name">Name</Label>
                <Input id="workflow-name" value={workflowName} onChange={event => setWorkflowName(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="workflow-description">Description</Label>
                <Input id="workflow-description" value={workflowDescription} onChange={event => setWorkflowDescription(event.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="workflow-context">Context Markdown</Label>
              <Textarea
                id="workflow-context"
                value={workflowContext}
                onChange={event => setWorkflowContext(event.target.value)}
                rows={5}
                className="min-h-28 resize-y font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="workflow-prompt">Prompt Template</Label>
              <Textarea
                id="workflow-prompt"
                value={workflowPrompt}
                onChange={event => setWorkflowPrompt(event.target.value)}
                rows={7}
                className="min-h-36 resize-y font-mono text-xs"
              />
            </div>
            {workflowRunResult ? <p className="text-sm text-muted-foreground">{workflowRunResult}</p> : null}
            {workflowError ? <p className="text-sm text-red-500">{workflowError}</p> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={saveWorkflow} disabled={workflowSaving || !workflowName.trim() || !workflowPrompt.trim()}>
                <Save className="h-4 w-4" />
                {workflowSaving ? 'Saving...' : selectedWorkflowId ? 'Save Workflow' : 'Create Workflow'}
              </Button>
              <Button type="button" onClick={runWorkflow} disabled={workflowRunning || workflowSaving || !workflowName.trim() || !workflowPrompt.trim()}>
                <Play className="h-4 w-4" />
                {workflowRunning ? 'Starting...' : 'Run Droid'}
              </Button>
            </div>
          </div>

          <aside className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Markdown Artifacts</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Save the compiled result worth sharing after a run completes.</p>
            </div>
            <Input value={artifactName} onChange={event => setArtifactName(event.target.value)} placeholder="Artifact name" />
            <Textarea
              value={artifactMarkdown}
              onChange={event => setArtifactMarkdown(event.target.value)}
              rows={6}
              className="min-h-32 resize-y font-mono text-xs"
              placeholder="Paste or write the Markdown result..."
            />
            <Button type="button" variant="outline" className="w-full" onClick={saveArtifact} disabled={artifactSaving || !selectedWorkflowId || !artifactName.trim() || !artifactMarkdown.trim()}>
              <Share2 className="h-4 w-4" />
              {artifactSaving ? 'Saving...' : 'Save Share Link'}
            </Button>
            {artifacts.length > 0 ? (
              <div className="space-y-2">
                {artifacts.map(artifact => (
                  <a
                    key={artifact.id}
                    href={`/workflow-artifacts/${artifact.share_token}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-md border bg-background/70 p-2 text-xs hover:bg-background"
                  >
                    <span className="block font-medium text-foreground">{artifact.name}</span>
                    <span className="mt-1 inline-flex items-center gap-1 text-muted-foreground">
                      <ExternalLink className="h-3 w-3" />
                      Share page
                    </span>
                  </a>
                ))}
              </div>
            ) : null}
          </aside>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Agent Runs</h2>
          <Badge variant="outline" className="font-mono text-[10px]">{initialRuns.length}</Badge>
        </div>
        {initialRuns.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No agent runs recorded for this task.</p>
        ) : (
          <div className="space-y-2">
            {initialRuns.map(run => {
              const metadata = typeof run.metadata === 'string'
                ? (() => { try { return JSON.parse(run.metadata || '{}') as Record<string, unknown>; } catch { return {}; } })()
                : (run.metadata ?? {});
              return (
                <article key={run.id ?? `${run.task_id}-${run.started_at}`} className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{run.agent_profile ?? run.command_template}</span>
                    <Badge variant="outline" className={pillClass(run.status)}>{run.status}</Badge>
                    <span>{formatTime(run.started_at)}</span>
                    {run.pid ? <span>pid {run.pid}</span> : null}
                  </div>
                  {typeof metadata.route_reason === 'string' ? (
                    <p className="mt-2 text-sm leading-5 text-muted-foreground">{metadata.route_reason}</p>
                  ) : null}
                  {typeof metadata.route_budget_note === 'string' ? (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{metadata.route_budget_note}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {run.prompt_path ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 font-mono">
                        <FileText className="h-3 w-3" />
                        {run.prompt_path}
                      </span>
                    ) : null}
                    {run.log_hint ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 font-mono">
                        <FileText className="h-3 w-3" />
                        {run.log_hint}
                      </span>
                    ) : null}
                    {run.cost_note ? <span className="rounded-full border border-border/60 px-2 py-0.5">{run.cost_note}</span> : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-lg border bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Comments</h2>
          <Badge variant="outline" className="font-mono text-[10px]">{comments.length}</Badge>
        </div>

        <div className="space-y-3">
          {comments.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No comments yet.</p>
          ) : comments.map(comment => (
            <article key={comment.id} className="min-w-0 overflow-hidden rounded-lg border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-muted-foreground">
                <span className="font-medium text-foreground">{comment.author_type === 'agent' ? 'Agent' : 'You'}</span>
                <span>{formatTime(comment.created_at)}</span>
                {comment.resolves_blocker ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />
                    resolved blocker
                  </span>
                ) : null}
                {comment.marks_done ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />
                    marked done
                  </span>
                ) : null}
              </div>
              <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground [overflow-wrap:anywhere]">{comment.body}</div>
            </article>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          <Textarea
            value={commentText}
            onChange={event => setCommentText(event.target.value)}
            rows={5}
            className="min-h-28 resize-y"
            placeholder="Add context, answer a blocker, or leave a note for the next agent..."
          />
          {task.blocked_on_user ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={resolveWithComment}
                onChange={event => setResolveWithComment(event.target.checked)}
                className="h-4 w-4 rounded border-border text-primary"
              />
              Resolve decision blocker with this comment
            </label>
          ) : null}
          {task.status !== 'done' ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={markDoneWithComment}
                onChange={event => setMarkDoneWithComment(event.target.checked)}
                className="h-4 w-4 rounded border-border text-primary"
              />
              Mark task done with this comment
            </label>
          ) : null}
          {!task.blocked_on_user && task.status !== 'done' ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={blockWithComment}
                onChange={event => setBlockWithComment(event.target.checked)}
                className="h-4 w-4 rounded border-border text-primary"
              />
              Mark as needing my decision with this comment
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={syncCommentToDescription}
              onChange={event => setSyncCommentToDescription(event.target.checked)}
              className="h-4 w-4 rounded border-border text-primary"
            />
            Add this comment to the task description
          </label>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <div className="flex justify-end">
            <Button type="button" onClick={addComment} disabled={saving || !commentText.trim()}>
              <MessageSquare className="h-4 w-4" />
              {saving ? 'Adding...' : 'Add Comment'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
