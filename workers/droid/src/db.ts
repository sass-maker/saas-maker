import type { Env, RunArtifactInput, RunArtifactRecord, RunEventInput, RunRecord, RunEventRecord } from './types';

export async function createRun(env: Env, input: {
  id: string;
  taskId?: string;
  projectSlug?: string;
  repoUrl?: string;
  branch?: string;
  command: string;
  cwd?: string;
  sandboxId: string;
}): Promise<RunRecord> {
  await env.DB.prepare(
    `INSERT INTO droid_runs (
      id, task_id, project_slug, repo_url, branch, command, cwd, sandbox_id, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued')`
  ).bind(
    input.id,
    input.taskId ?? null,
    input.projectSlug ?? null,
    input.repoUrl ?? null,
    input.branch ?? null,
    input.command,
    input.cwd ?? null,
    input.sandboxId
  ).run();
  return getRun(env, input.id) as Promise<RunRecord>;
}

export async function getRun(env: Env, id: string): Promise<RunRecord | null> {
  const row = await env.DB.prepare(`SELECT * FROM droid_runs WHERE id = ?`).bind(id).first();
  return row ? row as unknown as RunRecord : null;
}

export async function listRuns(env: Env, input: { taskId?: string; projectSlug?: string; limit?: number }): Promise<RunRecord[]> {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  if (input.taskId) {
    const rows = await env.DB.prepare(
      `SELECT * FROM droid_runs WHERE task_id = ? ORDER BY created_at DESC LIMIT ?`
    ).bind(input.taskId, limit).all();
    return (rows.results ?? []) as unknown as RunRecord[];
  }
  if (input.projectSlug) {
    const rows = await env.DB.prepare(
      `SELECT * FROM droid_runs WHERE project_slug = ? ORDER BY created_at DESC LIMIT ?`
    ).bind(input.projectSlug, limit).all();
    return (rows.results ?? []) as unknown as RunRecord[];
  }
  const rows = await env.DB.prepare(
    `SELECT * FROM droid_runs ORDER BY created_at DESC LIMIT ?`
  ).bind(limit).all();
  return (rows.results ?? []) as unknown as RunRecord[];
}

export async function listRunEvents(env: Env, runId: string): Promise<RunEventRecord[]> {
  const rows = await env.DB.prepare(
    `SELECT * FROM droid_run_events WHERE run_id = ? ORDER BY created_at ASC`
  ).bind(runId).all();
  return (rows.results ?? []) as unknown as RunEventRecord[];
}

export async function getLatestRunEvent(env: Env, runId: string): Promise<RunEventRecord | null> {
  const row = await env.DB.prepare(
    `SELECT * FROM droid_run_events WHERE run_id = ? ORDER BY created_at DESC LIMIT 1`
  ).bind(runId).first();
  return row ? row as unknown as RunEventRecord : null;
}

export async function listRunArtifacts(env: Env, runId: string): Promise<RunArtifactRecord[]> {
  const rows = await env.DB.prepare(
    `SELECT * FROM droid_run_artifacts WHERE run_id = ? ORDER BY created_at ASC`
  ).bind(runId).all();
  return (rows.results ?? []) as unknown as RunArtifactRecord[];
}

export async function getLatestRunRequest(env: Env, runId: string): Promise<Record<string, unknown> | null> {
  const row = await env.DB.prepare(
    `SELECT metadata FROM droid_run_events
     WHERE run_id = ? AND type = 'run_request'
     ORDER BY created_at DESC
     LIMIT 1`
  ).bind(runId).first<{ metadata: string }>();
  if (!row?.metadata) return null;
  try {
    return JSON.parse(row.metadata) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function markRunStarted(env: Env, id: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE droid_runs SET status = 'running', started_at = datetime('now') WHERE id = ?`
  ).bind(id).run();
}

export async function finishRun(env: Env, id: string, input: {
  status: 'completed' | 'failed';
  exitCode?: number;
  durationMs: number;
  summary?: string;
  errorMessage?: string;
}): Promise<void> {
  await env.DB.prepare(
    `UPDATE droid_runs
     SET status = ?, exit_code = ?, duration_ms = ?, summary = ?, error_message = ?, finished_at = datetime('now')
     WHERE id = ?`
  ).bind(
    input.status,
    input.exitCode ?? null,
    input.durationMs,
    input.summary ?? null,
    input.errorMessage ?? null,
    id
  ).run();
}

export async function createRunEvent(env: Env, runId: string, input: RunEventInput): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO droid_run_events (
      id, run_id, type, actor, source, message, command, cwd, exit_code, stdout, stderr, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(),
    runId,
    input.type,
    input.actor ?? 'droid',
    input.source ?? 'worker',
    input.message ?? null,
    input.command ?? null,
    input.cwd ?? null,
    input.exit_code ?? null,
    truncate(input.stdout),
    truncate(input.stderr),
    JSON.stringify(input.metadata ?? {})
  ).run();
}

export async function createRunArtifact(env: Env, runId: string, input: RunArtifactInput): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO droid_run_artifacts (
      id, run_id, type, name, uri, metadata
    ) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(),
    runId,
    input.type,
    input.name,
    input.uri,
    JSON.stringify(input.metadata ?? {})
  ).run();
}

function truncate(value: string | undefined): string | null {
  if (value === undefined) return null;
  return value.length > 16000 ? `${value.slice(0, 16000)}\n...[truncated]` : value;
}
