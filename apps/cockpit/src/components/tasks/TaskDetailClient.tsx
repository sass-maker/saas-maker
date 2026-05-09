'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bot, CheckCircle2, ExternalLink, FileText, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { apiFetchClient, getClientToken } from '@/lib/api-client';
import type { SymphonyRunRow, TaskCommentRow, TaskRow } from './TaskBoard';

function formatTime(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return value;
  return new Date(time).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
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
}: {
  initialTask: TaskRow;
  initialComments: TaskCommentRow[];
  initialRuns: SymphonyRunRow[];
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

  const addComment = async () => {
    if (!commentText.trim()) return;
    const resolvesBlocker = task.blocked_on_user && resolveWithComment;
    const marksDone = task.status !== 'done' && markDoneWithComment;
    setSaving(true);
    setError(null);
    try {
      const token = await getClientToken();
      const res = await apiFetchClient<{ data: TaskCommentRow; task?: TaskRow | null }>(`/v1/tasks/${task.id}/comments`, token, {
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
        const updated = await apiFetchClient<{ data: TaskRow }>(`/v1/tasks/${task.id}`, token, {
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
                Blocked on me
              </Badge>
            ) : null}
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

        <div className="space-y-2">
          {comments.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No comments yet.</p>
          ) : comments.map(comment => (
            <article key={comment.id} className="rounded-lg border bg-muted/20 p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
              <p className="whitespace-pre-wrap text-sm leading-5 text-foreground">{comment.body}</p>
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
              Resolve “blocked on me” with this comment
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
              Block this task on me with this comment
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
