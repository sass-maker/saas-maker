import type {
  Env,
  RunArtifactInput,
  RunArtifactRecord,
  RunEventInput,
  RunRecord,
  RunEventRecord,
  RunStats,
  DroidSuccessDashboard,
  DroidFailureReasonBreakdown,
  DroidRetryBucket,
} from './types';

export const DROID_IDLE_AFTER_SECONDS = 6 * 60;
export const DROID_STALE_AFTER_SECONDS = 15 * 60;

export async function createRun(
  env: Env,
  input: {
    id: string;
    taskId?: string;
    projectSlug?: string;
    repoUrl?: string;
    branch?: string;
    command: string;
    cwd?: string;
    sandboxId: string;
  }
): Promise<RunRecord> {
  await env.DB.prepare(
    `INSERT INTO droid_runs (
      id, task_id, project_slug, repo_url, branch, command, cwd, sandbox_id, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued')`
  )
    .bind(
      input.id,
      input.taskId ?? null,
      input.projectSlug ?? null,
      input.repoUrl ?? null,
      input.branch ?? null,
      input.command,
      input.cwd ?? null,
      input.sandboxId
    )
    .run();
  return getRun(env, input.id) as Promise<RunRecord>;
}

export async function getRun(env: Env, id: string): Promise<RunRecord | null> {
  const row = await env.DB.prepare(`SELECT * FROM droid_runs WHERE id = ?`).bind(id).first();
  return row ? (row as unknown as RunRecord) : null;
}

export async function listRuns(
  env: Env,
  input: { taskId?: string; projectSlug?: string; limit?: number }
): Promise<RunRecord[]> {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  if (input.taskId) {
    const rows = await env.DB.prepare(
      `SELECT * FROM droid_runs WHERE task_id = ? ORDER BY created_at DESC LIMIT ?`
    )
      .bind(input.taskId, limit)
      .all();
    return (rows.results ?? []) as unknown as RunRecord[];
  }
  if (input.projectSlug) {
    const rows = await env.DB.prepare(
      `SELECT * FROM droid_runs WHERE project_slug = ? ORDER BY created_at DESC LIMIT ?`
    )
      .bind(input.projectSlug, limit)
      .all();
    return (rows.results ?? []) as unknown as RunRecord[];
  }
  const rows = await env.DB.prepare(`SELECT * FROM droid_runs ORDER BY created_at DESC LIMIT ?`)
    .bind(limit)
    .all();
  return (rows.results ?? []) as unknown as RunRecord[];
}

export async function getActiveRunForQueue(
  env: Env,
  input: {
    repoUrl?: string;
    projectSlug?: string;
    excludeRunId?: string;
  }
): Promise<RunRecord | null> {
  if (input.repoUrl) {
    const row = await env.DB.prepare(
      `SELECT * FROM droid_runs
       WHERE repo_url = ? AND status = 'running' AND id != ?
       ORDER BY started_at ASC
       LIMIT 1`
    )
      .bind(input.repoUrl, input.excludeRunId ?? '')
      .first();
    return row ? (row as unknown as RunRecord) : null;
  }
  if (input.projectSlug) {
    const row = await env.DB.prepare(
      `SELECT * FROM droid_runs
       WHERE project_slug = ? AND status = 'running' AND id != ?
       ORDER BY started_at ASC
       LIMIT 1`
    )
      .bind(input.projectSlug, input.excludeRunId ?? '')
      .first();
    return row ? (row as unknown as RunRecord) : null;
  }
  return null;
}

export async function getRunningRunCount(env: Env): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM droid_runs WHERE status = 'running'`
  ).first<{ count: number }>();
  return Number(row?.count ?? 0);
}

export async function getNextQueuedRunForQueue(
  env: Env,
  input: {
    repoUrl?: string | null;
    projectSlug?: string | null;
    excludeRunId?: string;
  }
): Promise<RunRecord | null> {
  if (input.repoUrl) {
    const row = await env.DB.prepare(
      `SELECT * FROM droid_runs
       WHERE repo_url = ? AND status = 'queued' AND id != ?
       ORDER BY created_at ASC
       LIMIT 1`
    )
      .bind(input.repoUrl, input.excludeRunId ?? '')
      .first();
    return row ? (row as unknown as RunRecord) : null;
  }
  if (input.projectSlug) {
    const row = await env.DB.prepare(
      `SELECT * FROM droid_runs
       WHERE project_slug = ? AND status = 'queued' AND id != ?
       ORDER BY created_at ASC
       LIMIT 1`
    )
      .bind(input.projectSlug, input.excludeRunId ?? '')
      .first();
    return row ? (row as unknown as RunRecord) : null;
  }
  return null;
}

export async function getRunStats(
  env: Env,
  input: { projectSlug?: string; limit?: number }
): Promise<RunStats> {
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
  )
    .bind(...(input.projectSlug ? [input.projectSlug] : []))
    .all<{ status: RunRecord['status']; count: number }>();
  for (const row of statusRows.results ?? []) {
    if (row.status in byStatus) byStatus[row.status] = Number(row.count) || 0;
  }

  const avgWhere = input.projectSlug
    ? 'WHERE project_slug = ? AND duration_ms IS NOT NULL'
    : 'WHERE duration_ms IS NOT NULL';
  const avgRow = await env.DB.prepare(
    `SELECT AVG(duration_ms) AS avg_duration_ms FROM droid_runs ${avgWhere}`
  )
    .bind(...(input.projectSlug ? [input.projectSlug] : []))
    .first<{ avg_duration_ms: number | null }>();
  const staleWhere = input.projectSlug
    ? `WHERE project_slug = ? AND status = 'running' AND started_at IS NOT NULL
       AND datetime(
         COALESCE((SELECT MAX(created_at) FROM droid_run_events WHERE run_id = droid_runs.id), started_at),
         '+15 minutes'
       ) < datetime('now')`
    : `WHERE status = 'running' AND started_at IS NOT NULL
       AND datetime(
         COALESCE((SELECT MAX(created_at) FROM droid_run_events WHERE run_id = droid_runs.id), started_at),
         '+15 minutes'
       ) < datetime('now')`;
  const staleRow = await env.DB.prepare(`SELECT COUNT(*) AS count FROM droid_runs ${staleWhere}`)
    .bind(...(input.projectSlug ? [input.projectSlug] : []))
    .first<{ count: number }>();
  const idleWhere = input.projectSlug
    ? `WHERE project_slug = ? AND status = 'running' AND started_at IS NOT NULL
       AND datetime(
         COALESCE((SELECT MAX(created_at) FROM droid_run_events WHERE run_id = droid_runs.id), started_at),
         '+6 minutes'
       ) < datetime('now')`
    : `WHERE status = 'running' AND started_at IS NOT NULL
       AND datetime(
         COALESCE((SELECT MAX(created_at) FROM droid_run_events WHERE run_id = droid_runs.id), started_at),
         '+6 minutes'
       ) < datetime('now')`;
  const idleRow = await env.DB.prepare(`SELECT COUNT(*) AS count FROM droid_runs ${idleWhere}`)
    .bind(...(input.projectSlug ? [input.projectSlug] : []))
    .first<{ count: number }>();
  const durationWhere = input.projectSlug ? 'WHERE project_slug = ?' : '';
  const durationRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(duration_ms), 0) AS total_duration_ms FROM droid_runs ${durationWhere}`
  )
    .bind(...(input.projectSlug ? [input.projectSlug] : []))
    .first<{ total_duration_ms: number }>();
  const recent = await listRuns(env, { projectSlug: input.projectSlug, limit });

  return {
    total: byStatus.queued + byStatus.running + byStatus.completed + byStatus.failed,
    by_status: byStatus,
    avg_duration_ms:
      avgRow?.avg_duration_ms === null || avgRow?.avg_duration_ms === undefined
        ? null
        : Math.round(Number(avgRow.avg_duration_ms)),
    stale_running: Number(staleRow?.count ?? 0),
    idle_running: Number(idleRow?.count ?? 0),
    idle_after_seconds: DROID_IDLE_AFTER_SECONDS,
    stale_after_seconds: DROID_STALE_AFTER_SECONDS,
    estimated_compute_seconds: Math.round(Number(durationRow?.total_duration_ms ?? 0) / 1000),
    recent,
  };
}

export async function listStaleRunningRuns(
  env: Env,
  input: { projectSlug?: string; limit?: number }
): Promise<RunRecord[]> {
  const limit = Math.min(Math.max(input.limit ?? 5, 1), 25);
  const where = input.projectSlug
    ? `project_slug = ? AND status = 'running' AND started_at IS NOT NULL`
    : `status = 'running' AND started_at IS NOT NULL`;
  const rows = await env.DB.prepare(
    `SELECT * FROM droid_runs
     WHERE ${where}
       AND datetime(
         COALESCE((SELECT MAX(created_at) FROM droid_run_events WHERE run_id = droid_runs.id), started_at),
         '+15 minutes'
       ) < datetime('now')
     ORDER BY started_at ASC
     LIMIT ?`
  )
    .bind(...(input.projectSlug ? [input.projectSlug, limit] : [limit]))
    .all();
  return (rows.results ?? []) as unknown as RunRecord[];
}

export async function listRunEvents(env: Env, runId: string): Promise<RunEventRecord[]> {
  const rows = await env.DB.prepare(
    `SELECT * FROM droid_run_events WHERE run_id = ? ORDER BY created_at ASC`
  )
    .bind(runId)
    .all();
  return (rows.results ?? []) as unknown as RunEventRecord[];
}

export async function getLatestRunEvent(env: Env, runId: string): Promise<RunEventRecord | null> {
  const row = await env.DB.prepare(
    `SELECT * FROM droid_run_events WHERE run_id = ? ORDER BY created_at DESC LIMIT 1`
  )
    .bind(runId)
    .first();
  return row ? (row as unknown as RunEventRecord) : null;
}

export async function listRunArtifacts(env: Env, runId: string): Promise<RunArtifactRecord[]> {
  const rows = await env.DB.prepare(
    `SELECT * FROM droid_run_artifacts WHERE run_id = ? ORDER BY created_at ASC`
  )
    .bind(runId)
    .all();
  return (rows.results ?? []) as unknown as RunArtifactRecord[];
}

export async function getLatestRunRequest(
  env: Env,
  runId: string
): Promise<Record<string, unknown> | null> {
  const row = await env.DB.prepare(
    `SELECT metadata FROM droid_run_events
     WHERE run_id = ? AND type = 'run_request'
     ORDER BY created_at DESC
     LIMIT 1`
  )
    .bind(runId)
    .first<{ metadata: string }>();
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
  )
    .bind(id)
    .run();
}

export async function finishRun(
  env: Env,
  id: string,
  input: {
    status: 'completed' | 'failed';
    exitCode?: number;
    durationMs: number;
    summary?: string;
    errorMessage?: string;
  }
): Promise<void> {
  await env.DB.prepare(
    `UPDATE droid_runs
     SET status = ?, exit_code = ?, duration_ms = ?, summary = ?, error_message = ?, finished_at = datetime('now')
     WHERE id = ?`
  )
    .bind(
      input.status,
      input.exitCode ?? null,
      input.durationMs,
      input.summary ?? null,
      input.errorMessage ?? null,
      id
    )
    .run();
}

export async function createRunEvent(env: Env, runId: string, input: RunEventInput): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO droid_run_events (
      id, run_id, type, actor, source, message, command, cwd, exit_code, stdout, stderr, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
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
    )
    .run();
}

export async function createRunArtifact(
  env: Env,
  runId: string,
  input: RunArtifactInput
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO droid_run_artifacts (
      id, run_id, type, name, uri, metadata
    ) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      runId,
      input.type,
      input.name,
      input.uri,
      JSON.stringify(input.metadata ?? {})
    )
    .run();
}

function truncate(value: string | undefined): string | null {
  if (value === undefined) return null;
  return value.length > 16000 ? `${value.slice(0, 16000)}\n...[truncated]` : value;
}

// ---------------------------------------------------------------------------
// Droid graduation: success-rate dashboard
// ---------------------------------------------------------------------------

export async function getDroidSuccessDashboard(
  env: Env,
  input: { projectSlug?: string; days?: number }
): Promise<DroidSuccessDashboard> {
  const days = Math.min(Math.max(input.days ?? 7, 1), 90);
  const projectSlug = input.projectSlug?.trim() || null;
  const binds: (string | number)[] = [];
  const projectWhere = projectSlug ? 'AND project_slug = ?' : '';
  if (projectSlug) binds.push(projectSlug);

  // Window bounds
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - days * 24 * 60 * 60 * 1000);
  const windowStartIso = windowStart.toISOString();

  // Total / completed / failed counts in the window
  binds.push(windowStartIso);
  const summaryRow = await env.DB.prepare(
    `SELECT
       COUNT(*) AS total_runs,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_runs,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_runs,
       AVG(CASE WHEN duration_ms IS NOT NULL THEN duration_ms END) AS avg_duration_ms
     FROM droid_runs
     WHERE created_at >= ? ${projectWhere}`
  )
    .bind(...binds)
    .first<{ total_runs: number; completed_runs: number; failed_runs: number; avg_duration_ms: number | null }>();

  const totalRuns = Number(summaryRow?.total_runs ?? 0);
  const completedRuns = Number(summaryRow?.completed_runs ?? 0);
  const failedRuns = Number(summaryRow?.failed_runs ?? 0);
  const successRate =
    totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 1000) / 1000 : null;

  // Failure reason breakdown
  const reasonBinds: (string | number)[] = [windowStartIso];
  if (projectSlug) reasonBinds.push(projectSlug);
  const reasonRows = await env.DB.prepare(
    `SELECT failure_reason AS reason, COUNT(*) AS count
     FROM droid_runs
     WHERE created_at >= ? ${projectWhere} AND status = 'failed' AND failure_reason IS NOT NULL
     GROUP BY failure_reason
     ORDER BY count DESC
     LIMIT 20`
  )
    .bind(...reasonBinds)
    .all<{ reason: string; count: number }>();

  const failureReasons: DroidFailureReasonBreakdown[] = (reasonRows.results ?? []).map((r) => ({
    reason: r.reason,
    count: Number(r.count) || 0,
  }));

  // Retry count distribution
  const retryBinds: (string | number)[] = [windowStartIso];
  if (projectSlug) retryBinds.push(projectSlug);
  const retryRows = await env.DB.prepare(
    `SELECT retry_count, COUNT(*) AS count
     FROM droid_runs
     WHERE created_at >= ? ${projectWhere}
     GROUP BY retry_count
     ORDER BY retry_count ASC
     LIMIT 10`
  )
    .bind(...retryBinds)
    .all<{ retry_count: number; count: number }>();

  const retryDistribution: DroidRetryBucket[] = (retryRows.results ?? []).map((r) => ({
    retry_count: Number(r.retry_count) || 0,
    count: Number(r.count) || 0,
  }));

  return {
    window_days: days,
    window_start: windowStart.toISOString(),
    window_end: windowEnd.toISOString(),
    total_runs: totalRuns,
    completed_runs: completedRuns,
    failed_runs: failedRuns,
    success_rate: successRate,
    failure_reasons: failureReasons,
    avg_duration_ms:
      summaryRow?.avg_duration_ms === null || summaryRow?.avg_duration_ms === undefined
        ? null
        : Math.round(Number(summaryRow.avg_duration_ms)),
    retry_count_distribution: retryDistribution,
    project_slug: projectSlug,
  };
}
