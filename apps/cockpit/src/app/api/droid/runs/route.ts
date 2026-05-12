import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isLocalAuthBypassEnabled } from "@/lib/local-auth";
import { getManifestProjectRepos } from "@/lib/fleet-manifest";

export const dynamic = "force-dynamic";

const DROID_API_URL = process.env.DROID_API_URL || "https://saasmaker-droid.sarthakagrawal927.workers.dev";

type DroidRunTask = {
  id?: string;
  project_slug?: string | null;
  branch_name?: string | null;
};

async function assertAuthorized() {
  const requestHeaders = await headers();
  if (isLocalAuthBypassEnabled(requestHeaders.get("host"))) return true;
  const session = await auth.api.getSession({ headers: requestHeaders });
  return Boolean(session?.user);
}

function resolveRepoUrl(input: { repo_url?: unknown; task?: DroidRunTask; projectSlug?: string | null }) {
  if (typeof input.repo_url === "string" && input.repo_url.trim()) {
    return input.repo_url.trim();
  }
  const slug = input.projectSlug || input.task?.project_slug;
  if (!slug) return undefined;
  return getManifestProjectRepos()[slug];
}

export async function POST(req: Request) {
  if (!(await assertAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.DROID_INTERNAL_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "DROID_INTERNAL_TOKEN is not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => null) as {
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
    repo_url?: unknown;
    branch?: unknown;
    cwd?: unknown;
    destroy_after_run?: unknown;
  } | null;

  const mode = body?.mode === "native" || body?.mode === "claude_code" || body?.mode === "opencode" || body?.mode === "kilo" || body?.mode === "aider" ? body.mode : "command";
  if (!body || (mode === "command" && (typeof body.command !== "string" || !body.command.trim()))) {
    return NextResponse.json({ error: "command is required" }, { status: 400 });
  }
  if (mode !== "command" && (typeof body.prompt !== "string" || !body.prompt.trim())) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const taskId = typeof body.task_id === "string" && body.task_id.trim()
    ? body.task_id.trim()
    : body.task?.id;
  const projectSlug = typeof body.project_slug === "string" && body.project_slug.trim()
    ? body.project_slug.trim()
    : body.task?.project_slug;
  const repoUrl = resolveRepoUrl({ repo_url: body.repo_url, task: body.task, projectSlug });
  const payload = {
    mode,
    provider: mode !== "command" ? "deepseek" : undefined,
    task_id: taskId,
    project_slug: projectSlug,
    repo_url: repoUrl,
    branch: typeof body.branch === "string" && body.branch.trim() ? body.branch.trim() : body.task?.branch_name || undefined,
    command: typeof body.command === "string" ? body.command.trim() : undefined,
    prompt: typeof body.prompt === "string" ? body.prompt.trim() : undefined,
    max_turns: typeof body.max_turns === "number" ? body.max_turns : undefined,
    timeout_seconds: typeof body.timeout_seconds === "number" ? body.timeout_seconds : undefined,
    create_pr: body.create_pr === true,
    pr_title: typeof body.pr_title === "string" && body.pr_title.trim() ? body.pr_title.trim() : undefined,
    pr_body: typeof body.pr_body === "string" && body.pr_body.trim() ? body.pr_body.trim() : undefined,
    pr_base_branch: typeof body.pr_base_branch === "string" && body.pr_base_branch.trim() ? body.pr_base_branch.trim() : undefined,
    cwd: typeof body.cwd === "string" && body.cwd.trim() ? body.cwd.trim() : undefined,
    destroy_after_run: body.destroy_after_run !== false,
  };

  const response = await fetch(`${DROID_API_URL}/v0/runs`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text };
  }

  return NextResponse.json(data, { status: response.status });
}

export async function GET(req: Request) {
  if (!(await assertAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.DROID_INTERNAL_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "DROID_INTERNAL_TOKEN is not configured" }, { status: 500 });
  }

  const incoming = new URL(req.url);
  const upstream = new URL(`${DROID_API_URL}/v0/runs`);
  for (const key of ["task_id", "project_slug", "limit"]) {
    const value = incoming.searchParams.get(key);
    if (value) upstream.searchParams.set(key, value);
  }

  const response = await fetch(upstream, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const text = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text };
  }

  return NextResponse.json(data, { status: response.status });
}
