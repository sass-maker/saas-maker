import { NextResponse } from 'next/server';
import { getManifestProjectRepos } from '@/lib/fleet-manifest';
import {
  DROID_API_URL,
  droidApiUrl,
  droidJsonResponse,
  requireDroidAccess,
} from '@/app/api/droid/_lib';

export const dynamic = 'force-dynamic';

type DroidRunTask = {
  id?: string;
  project_slug?: string | null;
  branch_name?: string | null;
};

function resolveRepoUrl(input: {
  repo_url?: unknown;
  task?: DroidRunTask;
  projectSlug?: string | null;
}) {
  if (typeof input.repo_url === 'string' && input.repo_url.trim()) {
    return input.repo_url.trim();
  }
  const slug = input.projectSlug || input.task?.project_slug;
  if (!slug) return undefined;
  return getManifestProjectRepos()[slug];
}

export async function POST(req: Request) {
  const denied = await requireDroidAccess();
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as {
    task?: DroidRunTask;
    task_id?: unknown;
    project_slug?: unknown;
    command?: unknown;
    mode?: unknown;
    provider?: unknown;
    prompt?: unknown;
    max_turns?: unknown;
    timeout_seconds?: unknown;
    create_pr?: unknown;
    pr_title?: unknown;
    pr_body?: unknown;
    pr_base_branch?: unknown;
    acceptance_command?: unknown;
    acceptance_timeout_seconds?: unknown;
    browser_acceptance?: unknown;
    loop_policy?: unknown;
    repo_url?: unknown;
    branch?: unknown;
    cwd?: unknown;
    destroy_after_run?: unknown;
    wait_for_completion?: unknown;
  } | null;

  const mode = body?.mode === 'native' ? body.mode : 'command';
  if (!body || (mode === 'command' && (typeof body.command !== 'string' || !body.command.trim()))) {
    return NextResponse.json({ error: 'command is required' }, { status: 400 });
  }
  if (mode !== 'command' && (typeof body.prompt !== 'string' || !body.prompt.trim())) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  const taskId =
    typeof body.task_id === 'string' && body.task_id.trim() ? body.task_id.trim() : body.task?.id;
  const projectSlug =
    typeof body.project_slug === 'string' && body.project_slug.trim()
      ? body.project_slug.trim()
      : body.task?.project_slug;
  const repoUrl = resolveRepoUrl({ repo_url: body.repo_url, task: body.task, projectSlug });
  const payload = {
    mode,
    provider: mode !== 'command' ? 'deepseek' : undefined,
    task_id: taskId,
    project_slug: projectSlug,
    repo_url: repoUrl,
    branch:
      typeof body.branch === 'string' && body.branch.trim()
        ? body.branch.trim()
        : body.task?.branch_name || undefined,
    command: typeof body.command === 'string' ? body.command.trim() : undefined,
    prompt: typeof body.prompt === 'string' ? body.prompt.trim() : undefined,
    max_turns: typeof body.max_turns === 'number' ? body.max_turns : undefined,
    timeout_seconds: typeof body.timeout_seconds === 'number' ? body.timeout_seconds : undefined,
    create_pr: body.create_pr === true,
    pr_title:
      typeof body.pr_title === 'string' && body.pr_title.trim() ? body.pr_title.trim() : undefined,
    pr_body:
      typeof body.pr_body === 'string' && body.pr_body.trim() ? body.pr_body.trim() : undefined,
    pr_base_branch:
      typeof body.pr_base_branch === 'string' && body.pr_base_branch.trim()
        ? body.pr_base_branch.trim()
        : undefined,
    acceptance_command:
      typeof body.acceptance_command === 'string' && body.acceptance_command.trim()
        ? body.acceptance_command.trim()
        : undefined,
    acceptance_timeout_seconds:
      typeof body.acceptance_timeout_seconds === 'number'
        ? body.acceptance_timeout_seconds
        : undefined,
    browser_acceptance: normalizeBrowserAcceptance(body.browser_acceptance),
    loop_policy: normalizeLoopPolicy(body.loop_policy),
    cwd: typeof body.cwd === 'string' && body.cwd.trim() ? body.cwd.trim() : undefined,
    destroy_after_run: body.destroy_after_run !== false,
    wait_for_completion: body.wait_for_completion === true,
  };

  return droidJsonResponse(droidApiUrl('/v0/runs'), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function normalizeBrowserAcceptance(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const assertText = Array.isArray(input.assert_text)
    ? input.assert_text
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim())
    : undefined;
  return {
    enabled: input.enabled === true,
    goal: typeof input.goal === 'string' && input.goal.trim() ? input.goal.trim() : undefined,
    url: typeof input.url === 'string' && input.url.trim() ? input.url.trim() : undefined,
    start_command:
      typeof input.start_command === 'string' && input.start_command.trim()
        ? input.start_command.trim()
        : undefined,
    port: typeof input.port === 'number' ? input.port : undefined,
    preview_hostname:
      typeof input.preview_hostname === 'string' && input.preview_hostname.trim()
        ? input.preview_hostname.trim()
        : undefined,
    assert_text: assertText?.length ? assertText : undefined,
    timeout_seconds: typeof input.timeout_seconds === 'number' ? input.timeout_seconds : undefined,
    keep_open: input.keep_open === true,
  };
}

function normalizeLoopPolicy(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  if (input.enabled !== true) return undefined;
  return {
    enabled: true,
    max_attempts: typeof input.max_attempts === 'number' ? input.max_attempts : undefined,
    retry_on_failure:
      typeof input.retry_on_failure === 'boolean' ? input.retry_on_failure : undefined,
    stop_on_blocker: typeof input.stop_on_blocker === 'boolean' ? input.stop_on_blocker : undefined,
    cost_budget_usd: typeof input.cost_budget_usd === 'number' ? input.cost_budget_usd : undefined,
  };
}

export async function GET(req: Request) {
  const denied = await requireDroidAccess();
  if (denied) return denied;

  const incoming = new URL(req.url);
  const upstream = new URL(`${DROID_API_URL}/v0/runs`);
  for (const key of ['task_id', 'project_slug', 'limit']) {
    const value = incoming.searchParams.get(key);
    if (value) upstream.searchParams.set(key, value);
  }

  return droidJsonResponse(upstream);
}
