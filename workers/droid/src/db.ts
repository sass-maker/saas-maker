import type { Env, RunArtifactInput, RunArtifactRecord, RunEventInput, RunRecord, RunEventRecord, RunStats } from './types';

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

export async function getActiveRunForQueue(env: Env, input: {
  repoUrl?: string;
  projectSlug?: string;
  excludeRunId?: string;
}): Promise<RunRecord | null> {
  if (input.repoUrl) {
    const row = await env.DB.prepare(
      `SELECT * FROM droid_runs
       WHERE repo_url = ? AND status = 'running' AND id != ?
       ORDER BY started_at ASC
       LIMIT 1`
    ).bind(input.repoUrl, input.excludeRunId ?? '').first();
    return row ? row as unknown as RunRecord : null;
  }
  if (input.projectSlug) {
    const row = await env.DB.prepare(
      `SELECT * FROM droid_runs
       WHERE project_slug = ? AND status = 'running' AND id != ?
       ORDER BY started_at ASC
       LIMIT 1`
    ).bind(input.projectSlug, input.excludeRunId ?? '').first();
    return row ? row as unknown as RunRecord : null;
  }
  return null;
}

export async function getNextQueuedRunForQueue(env: Env, input: {
  repoUrl?: string | null;
  projectSlug?: string | null;
  excludeRunId?: string;
}): Promise<RunRecord | null> {
  if (input.repoUrl) {
    const row = await env.DB.prepare(
      `SELECT * FROM droid_runs
       WHERE repo_url = ? AND status = 'queued' AND id != ?
       ORDER BY created_at ASC
       LIMIT 1`
    ).bind(input.repoUrl, input.excludeRunId ?? '').first();
    return row ? row as unknown as RunRecord : null;
  }
  if (input.projectSlug) {
    const row = await env.DB.prepare(
      `SELECT * FROM droid_runs
       WHERE project_slug = ? AND status = 'queued' AND id != ?
       ORDER BY created_at ASC
       LIMIT 1`
    ).bind(input.projectSlug, input.excludeRunId ?? '').first();
    return row ? row as unknown as RunRecord : null;
  }
  return null;
}

export async function getRunStats(env: Env, input: { projectSlug?: string; limit?: number }): Promise<RunStats> {
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 25);
  const byStatus: RunStats['by_status'] = {
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
  };
  const where = input.projectSlug ? 'WHERE project_slug = ?' : '';
  const statusRows = await env.DB.prepare(
    `SELECT status, COUNT(*) AS count FROM droid_runs ${where} GROUP BY status`
  ).bind(...(input.projectSlug ? [input.projectSlug] : [])).all<{ status: RunRecord['status']; count: number }>();
  for (const row of statusRows.results ?? []) {
    if (row.status in byStatus) byStatus[row.status] = Number(row.count) || 0;
  }

  const avgWhere = input.projectSlug ? 'WHERE project_slug = ? AND duration_ms IS NOT NULL' : 'WHERE duration_ms IS NOT NULL';
  const avgRow = await env.DB.prepare(
    `SELECT AVG(duration_ms) AS avg_duration_ms FROM droid_runs ${avgWhere}`
  ).bind(...(input.projectSlug ? [input.projectSlug] : [])).first<{ avg_duration_ms: number | null }>();
  const staleWhere = input.projectSlug
    ? `WHERE project_slug = ? AND status = 'running' AND started_at IS NOT NULL AND datetime(started_at, '+15 minutes') < datetime('now')`
    : `WHERE status = 'running' AND started_at IS NOT NULL AND datetime(started_at, '+15 minutes') < datetime('now')`;
  const staleRow = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM droid_runs ${staleWhere}`
  ).bind(...(input.projectSlug ? [input.projectSlug] : [])).first<{ count: number }>();
  const recent = await listRuns(env, { projectSlug: input.projectSlug, limit });

  return {
    total: byStatus.queued + byStatus.running + byStatus.completed + byStatus.failed,
    by_status: byStatus,
    avg_duration_ms: avgRow?.avg_duration_ms === null || avgRow?.avg_duration_ms === undefined
      ? null
      : Math.round(Number(avgRow.avg_duration_ms)),
    stale_running: Number(staleRow?.count ?? 0),
    recent,
  };
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
