import { NextResponse } from 'next/server';
import { droidApiUrl, droidJsonResponse, requireDroidAccess } from '@/app/api/droid/_lib';
import { getManifestProjectRepos } from '@/lib/fleet-manifest';
import {
  getCockpitTask,
  getCockpitTaskWorkflow,
  updateCockpitTaskWorkflow,
  type TaskWorkflowRow,
} from '@/lib/cockpit-tasks-store';
import type { TaskRow } from '@/components/tasks/TaskBoard';

export const dynamic = 'force-dynamic';

function renderWorkflowPrompt(workflow: TaskWorkflowRow, task?: TaskRow | null) {
  const sections = [
    `# ${workflow.name}`,
    workflow.description ? `## Workflow\n${workflow.description}` : null,
    task ? [
      '## Task',
      `- id: ${task.id}`,
      `- title: ${task.title}`,
      `- project: ${task.project_slug ?? workflow.project_slug ?? 'unassigned'}`,
      `- status: ${task.status}`,
      `- priority: ${task.priority}`,
      task.description ? `\n${task.description}` : null,
    ].filter(Boolean).join('\n') : null,
    workflow.context_markdown.trim() ? `## Context\n${workflow.context_markdown.trim()}` : null,
    `## Prompt\n${workflow.prompt_template.trim()}`,
  ].filter(Boolean);
  return sections.join('\n\n').trim();
}

function resolveRunId(data: unknown) {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  if (typeof record.id === 'string') return record.id;
  if (record.data && typeof record.data === 'object' && typeof (record.data as Record<string, unknown>).id === 'string') {
    return (record.data as Record<string, unknown>).id as string;
  }
  return null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireDroidAccess();
  if (denied) return denied;
  const { id } = await params;
  const workflow = await getCockpitTaskWorkflow(id);
  if (!workflow) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
  const task = workflow.task_id ? await getCockpitTask(workflow.task_id) : null;
  const prompt = renderWorkflowPrompt(workflow, task);
  const projectSlug = workflow.project_slug ?? task?.project_slug ?? null;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const payload = {
    mode: 'native',
    provider: 'deepseek',
    task_id: workflow.task_id ?? undefined,
    project_slug: projectSlug ?? undefined,
    repo_url: projectSlug ? getManifestProjectRepos()[projectSlug] : undefined,
    branch: typeof body.branch === 'string' && body.branch.trim() ? body.branch.trim() : task?.branch_name ?? undefined,
    prompt,
    max_turns: typeof body.max_turns === 'number' ? body.max_turns : 12,
    timeout_seconds: typeof body.timeout_seconds === 'number' ? body.timeout_seconds : 1800,
    create_pr: body.create_pr === true,
    pr_title: typeof body.pr_title === 'string' && body.pr_title.trim() ? body.pr_title.trim() : undefined,
    pr_body: typeof body.pr_body === 'string' && body.pr_body.trim() ? body.pr_body.trim() : undefined,
    destroy_after_run: body.destroy_after_run !== false,
    wait_for_completion: body.wait_for_completion === true,
  };

  const upstreamResponse = await droidJsonResponse(droidApiUrl('/v0/runs'), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await upstreamResponse.clone().json().catch(() => null);
  const runId = resolveRunId(data);
  if (runId) await updateCockpitTaskWorkflow(workflow.id, { last_run_id: runId });
  return upstreamResponse;
}
