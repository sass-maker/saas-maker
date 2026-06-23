import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  createRun,
  createRunArtifact,
  createRunEvent as createRunEventInDb,
  finishRun,
  getActiveRunForQueue,
  getLatestRunEvent,
  getLatestRunRequest,
  getNextQueuedRunForQueue,
  getRunningRunCount,
  getRun,
  getRunStats,
  listStaleRunningRuns,
  listRunArtifacts,
  listRunEvents,
  listRuns,
  markRunStarted,
} from './db';
import { fetchRunRoom, getRunRoomStatus, recordRunRoomEvent } from './run-room-client';
import type {
  CommandResult,
  Env,
  BrowserAcceptanceRequest,
  RunEventInput,
  RunExecutionInput,
  RunExecutor,
  RunMode,
  RunProvider,
  RunRecord,
  RunRequest,
  LoopPolicyRequest,
} from './types';

const DEFAULT_TIMEOUT_SECONDS = 900;
const DEFAULT_RECONCILE_TIMEOUT_SECONDS = 240;
const RECONCILE_STALE_AFTER_MS = 6 * 60 * 1000;
const DEFAULT_MAX_RUNNING_RUNS = 3;

type Variables = {
  requestId: string;
};

export function createApp(executor: RunExecutor) {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();

  app.use(
    '*',
    cors({
      origin: '*',
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
    })
  );

  app.use('*', async (c, next) => {
    c.set('requestId', crypto.randomUUID());
    await next();
  });

  app.onError((error, c) => {
    console.error(`[${c.get('requestId')}] Droid error`, error);
    return c.json({ error: 'Internal server error' }, 500);
  });

  // Structured JSON for unmatched routes (Hono's default is plain text).
  app.notFound((c) => c.json({ error: 'Not found' }, 404));

  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.use('*', async (c, next) => {
    if (isSandboxPreviewRequest(c.req.raw)) {
      const { proxyToSandbox } = await import('@cloudflare/sandbox');
      const proxyResponse = await proxyToSandbox(c.req.raw, c.env).catch(() => null);
      if (proxyResponse) return proxyResponse;
    }
    await next();
  });

  app.use('/v0/*', async (c, next) => {
    const expected = c.env.DROID_INTERNAL_TOKEN;
    const actual = c.req.header('Authorization');
    if (!expected || actual !== `Bearer ${expected}`) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    await next();
  });

  app.post('/v0/runs', async (c) => {
    const body = (await c.req.json().catch(() => null)) as RunRequest | null;
    const validation = validateRunRequest(body);
    if (!validation.ok) return c.json({ error: validation.error }, 400);

    const runId = crypto.randomUUID();
    const sandboxId = `droid-${runId}`;
    const startedAt = Date.now();
    const mode = normalizeMode(body?.mode);
    const environmentValidation = validateRunEnvironment(c.env, body, mode);
    if (!environmentValidation.ok) return c.json({ error: environmentValidation.error }, 503);
    const command =
      mode !== 'command'
        ? buildAgentLedgerCommand(mode, body?.prompt?.trim() ?? '')
        : body!.command!.trim();

    const run = await createRun(c.env, {
      id: runId,
      taskId: body?.task_id?.trim(),
      projectSlug: body?.project_slug?.trim(),
      repoUrl: body?.repo_url?.trim(),
      branch: body?.branch?.trim(),
      command,
      cwd: body?.cwd?.trim(),
      sandboxId,
    });

    await createRunEvent(c.env, runId, {
      type: 'run_request',
      message: 'Stored Droid run request for reconcile/resume.',
      command,
      metadata: buildRunRequestMetadata(body, {
        mode,
        command,
        repoUrl: body?.repo_url?.trim(),
        branch: body?.branch?.trim(),
        timeoutSeconds: normalizeTimeoutSeconds(body?.timeout_seconds) ?? DEFAULT_TIMEOUT_SECONDS,
      }),
    });

    const activeRun = await getActiveRunForQueue(c.env, {
      repoUrl: body?.repo_url?.trim(),
      projectSlug: body?.project_slug?.trim(),
      excludeRunId: runId,
    });
    const maxRunningRuns = normalizeMaxRunningRuns(c.env.DROID_MAX_RUNNING_RUNS);
    const runningCount = await getRunningRunCount(c.env);
    if (activeRun || runningCount >= maxRunningRuns) {
      await createRunEvent(c.env, runId, {
        type: 'run_queued',
        message: activeRun
          ? 'Droid run queued because another run is already active for this repository/project.'
          : 'Droid run queued because the global running-run limit is full.',
        command,
        metadata: {
          active_run_id: activeRun?.id ?? null,
          active_sandbox_id: activeRun?.sandbox_id ?? null,
          running_count: runningCount,
          max_running_runs: maxRunningRuns,
          repo_url: body?.repo_url?.trim() ?? null,
          project_slug: body?.project_slug?.trim() ?? null,
        },
      });
      const queuedRun = await getRun(c.env, runId);
      return c.json({ data: queuedRun ?? run, queued_after: activeRun?.id ?? 'global_limit' }, 202);
    }

    const loopPolicy = normalizeLoopPolicy(body?.loop_policy);

    await markRunStarted(c.env, runId);
    if (loopPolicy?.enabled) {
      await createRunEvent(
        c.env,
        runId,
        buildLoopStartedEvent(loopPolicy, {
          taskId: body?.task_id?.trim(),
          command,
        })
      );
    }
    await createRunEvent(c.env, runId, {
      type: 'run_started',
      message: 'Droid run started',
      command,
      metadata: {
        mode,
        provider: body?.provider ?? null,
        task_id: body?.task_id ?? null,
        project_slug: body?.project_slug ?? null,
        repo_url: body?.repo_url ?? null,
        branch: body?.branch ?? null,
        sandbox_id: sandboxId,
        timeout_seconds: normalizeTimeoutSeconds(body?.timeout_seconds) ?? DEFAULT_TIMEOUT_SECONDS,
      },
    });

    const runInput = {
      runId,
      sandboxId,
      startedAt,
      taskId: body?.task_id?.trim(),
      projectSlug: body?.project_slug?.trim(),
      repoUrl: body?.repo_url?.trim(),
      branch: body?.branch?.trim(),
      command,
      mode,
      prompt: body?.prompt?.trim(),
      provider: body?.provider,
      maxTurns: normalizeMaxTurns(body?.max_turns),
      timeoutSeconds: normalizeTimeoutSeconds(body?.timeout_seconds) ?? DEFAULT_TIMEOUT_SECONDS,
      createPr: body?.create_pr === true,
      prTitle: body?.pr_title?.trim(),
      prBody: body?.pr_body?.trim(),
      prBaseBranch: body?.pr_base_branch?.trim(),
      acceptanceCommand: body?.acceptance_command?.trim(),
      acceptanceTimeoutSeconds: normalizeAcceptanceTimeoutSeconds(body?.acceptance_timeout_seconds),
      browserAcceptance: normalizeBrowserAcceptance(body?.browser_acceptance),
      loopPolicy,
      cwd: body?.cwd?.trim(),
      destroyAfterRun: body?.destroy_after_run !== false,
      waitUntil: (promise: Promise<void>) => scheduleBackground(c, promise),
    };
    const runPromise = executeRun(c.env, executor, runInput);

    if (body?.wait_for_completion === true) {
      await runPromise;
    } else {
      try {
        c.executionCtx.waitUntil(runPromise);
      } catch {
        void runPromise;
      }
    }

    const updatedRun = await getRun(c.env, runId);
    return c.json(
      { data: updatedRun ?? run },
      updatedRun ? (body?.wait_for_completion === true ? 201 : 202) : 500
    );
  });

  app.get('/v0/runs/:id', async (c) => {
    const run = await getRun(c.env, c.req.param('id'));
    if (!run) return c.json({ error: 'Run not found' }, 404);
    return c.json({ data: run });
  });

  app.get('/v0/runs', async (c) => {
    const runs = await listRuns(c.env, {
      taskId: c.req.query('task_id')?.trim(),
      projectSlug: c.req.query('project_slug')?.trim(),
      limit: normalizeLimit(c.req.query('limit')),
    });
    return c.json({ data: runs });
  });

  app.get('/v0/stats', async (c) => {
    const stats = await getRunStats(c.env, {
      projectSlug: c.req.query('project_slug')?.trim(),
      limit: normalizeLimit(c.req.query('limit')),
    });
    return c.json({ data: stats });
  });

  app.post('/v0/runs/reap-stale', async (c) => {
    const incoming = (await c.req.json().catch(() => null)) as {
      project_slug?: string;
      limit?: number;
      wait_for_dispatch?: boolean;
    } | null;
    const staleRuns = await listStaleRunningRuns(c.env, {
      projectSlug: incoming?.project_slug?.trim(),
      limit: normalizeLimit(incoming?.limit),
    });
    for (const staleRun of staleRuns) {
      await markStaleRunAndReleaseQueue(c.env, executor, staleRun, {
        forced: false,
        waitForDispatch: incoming?.wait_for_dispatch === true,
        waitUntil: (promise) => scheduleBackground(c, promise),
      });
    }
    return c.json({ data: { reaped: staleRuns.length, run_ids: staleRuns.map((run) => run.id) } });
  });

  app.get('/v0/runs/:id/events', async (c) => {
    const run = await getRun(c.env, c.req.param('id'));
    if (!run) return c.json({ error: 'Run not found' }, 404);
    const events = await listRunEvents(c.env, run.id);
    return c.json({ data: events });
  });

  app.get('/v0/runs/:id/live', async (c) => {
    const run = await getRun(c.env, c.req.param('id'));
    if (!run) return c.json({ error: 'Run not found' }, 404);
    const response = fetchRunRoom(c.env, run.id, c.req.raw);
    if (!response) return c.json({ error: 'Droid run rooms are not configured' }, 501);
    return response;
  });

  app.get('/v0/runs/:id/live-status', async (c) => {
    const run = await getRun(c.env, c.req.param('id'));
    if (!run) return c.json({ error: 'Run not found' }, 404);
    const status = await getRunRoomStatus(c.env, run.id);
    if (!status) return c.json({ error: 'Droid run rooms are not configured' }, 501);
    return c.json({ data: status });
  });

  app.get('/v0/runs/:id/artifacts', async (c) => {
    const run = await getRun(c.env, c.req.param('id'));
    if (!run) return c.json({ error: 'Run not found' }, 404);
    const artifacts = await listRunArtifacts(c.env, run.id);
    return c.json({ data: artifacts });
  });

  app.post('/v0/runs/:id/cancel', async (c) => {
    const run = await getRun(c.env, c.req.param('id'));
    if (!run) return c.json({ error: 'Run not found' }, 404);
    await createRunEvent(c.env, run.id, {
      type: 'run_cancel_requested',
      message: 'Cancellation requested.',
      metadata: { sandbox_id: run.sandbox_id },
    });
    if (!executor.cancel) return c.json({ error: 'Run cancellation is not supported' }, 501);
    const cancelPromise = executor
      .cancel({
        env: c.env,
        runId: run.id,
        sandboxId: run.sandbox_id,
        recordEvent: (event) => createRunEvent(c.env, run.id, event),
        recordArtifact: (artifact) => createRunArtifact(c.env, run.id, artifact),
      })
      .catch((error) =>
        createRunEvent(c.env, run.id, {
          type: 'sandbox_destroy_failed',
          message: error instanceof Error ? error.message : 'Sandbox destroy failed.',
          metadata: { sandbox_id: run.sandbox_id },
        })
      );
    try {
      c.executionCtx.waitUntil(cancelPromise);
    } catch {
      void cancelPromise;
    }
    await finishRun(c.env, run.id, {
      status: 'failed',
      exitCode: 130,
      durationMs: 0,
      summary: 'Run cancelled.',
      errorMessage: 'Run cancelled.',
    });
    await createRunEvent(c.env, run.id, {
      type: 'run_cancelled',
      message: 'Sandbox destroyed and run marked cancelled.',
      exit_code: 130,
      metadata: { sandbox_id: run.sandbox_id },
    });
    const updatedRun = await getRun(c.env, run.id);
    return c.json({ data: updatedRun ?? run });
  });

  app.post('/v0/runs/:id/mark-stale', async (c) => {
    const run = await getRun(c.env, c.req.param('id'));
    if (!run) return c.json({ error: 'Run not found' }, 404);
    if (run.status === 'completed' || run.status === 'failed') {
      return c.json({ data: run, marked_stale: false });
    }
    if (run.status !== 'running') {
      return c.json({ error: 'Only running Droid runs can be marked stale.' }, 409);
    }

    const incoming = (await c.req.json().catch(() => null)) as {
      force?: boolean;
      wait_for_dispatch?: boolean;
    } | null;
    const latestActivity = await getLatestRunActivityWithStart(c.env, run);
    if (
      !incoming?.force &&
      latestActivity &&
      !isStaleEvent(latestActivity.created_at, RECONCILE_STALE_AFTER_MS)
    ) {
      return c.json(
        {
          error:
            'Run still appears active; stale recovery is only allowed after 6 minutes of no activity unless force is true.',
          latest_event_at: latestActivity.created_at,
          latest_event_source: latestActivity.source,
        },
        409
      );
    }

    await markStaleRunAndReleaseQueue(c.env, executor, run, {
      forced: incoming?.force === true,
      latestActivity,
      waitForDispatch: incoming?.wait_for_dispatch === true,
      waitUntil: (promise) => scheduleBackground(c, promise),
    });

    const updatedRun = await getRun(c.env, run.id);
    return c.json({ data: updatedRun ?? run, marked_stale: true });
  });

  app.post('/v0/runs/:id/reconcile', async (c) => {
    const run = await getRun(c.env, c.req.param('id'));
    if (!run) return c.json({ error: 'Run not found' }, 404);
    if (run.status === 'completed' || run.status === 'failed') {
      return c.json({ data: run, reconciled: false });
    }
    const incoming = (await c.req.json().catch(() => null)) as {
      wait_for_completion?: boolean;
      force?: boolean;
    } | null;
    const request = await getLatestRunRequest(c.env, run.id);
    if (run.status === 'queued') {
      const queuedInput = executionInputFromRun(run, request);
      const activeRun = await getActiveRunForQueue(c.env, {
        repoUrl: queuedInput.repoUrl,
        projectSlug: run.project_slug ?? undefined,
        excludeRunId: run.id,
      });
      if (!incoming?.force && activeRun) {
        return c.json(
          {
            error: 'Run is queued behind an active Droid run.',
            active_run_id: activeRun.id,
          },
          409
        );
      }

      await createRunEvent(c.env, run.id, {
        type: 'run_dequeued',
        message: 'Queued Droid run dequeued for execution.',
        command: queuedInput.command,
        metadata: {
          forced: incoming?.force === true,
          previous_status: run.status,
        },
      });
      await markRunStarted(c.env, run.id);
      if (queuedInput.loopPolicy?.enabled) {
        await createRunEvent(
          c.env,
          run.id,
          buildLoopStartedEvent(queuedInput.loopPolicy, {
            taskId: run.task_id ?? undefined,
            command: queuedInput.command,
            dequeued: true,
          })
        );
      }
      await createRunEvent(c.env, run.id, {
        type: 'run_started',
        message: 'Droid run started',
        command: queuedInput.command,
        metadata: {
          mode: queuedInput.mode,
          provider: queuedInput.provider ?? null,
          task_id: run.task_id,
          project_slug: run.project_slug,
          repo_url: queuedInput.repoUrl ?? null,
          branch: queuedInput.branch ?? null,
          sandbox_id: run.sandbox_id,
          timeout_seconds: queuedInput.timeoutSeconds,
          dequeued: true,
        },
      });
      const queuedPromise = executeRun(c.env, executor, {
        ...queuedInput,
        startedAt: Date.now(),
        waitUntil: (promise: Promise<void>) => scheduleBackground(c, promise),
      });

      if (incoming?.wait_for_completion === true) {
        await queuedPromise;
      } else {
        try {
          c.executionCtx.waitUntil(queuedPromise);
        } catch {
          void queuedPromise;
        }
      }

      const updatedRun = await getRun(c.env, run.id);
      return c.json(
        { data: updatedRun ?? run, dequeued: true },
        incoming?.wait_for_completion === true ? 200 : 202
      );
    }

    if (!executor.reconcile) return c.json({ error: 'Run reconciliation is not supported' }, 501);
    const latestEvent = await getLatestRunActivity(c.env, run.id);
    if (
      !incoming?.force &&
      latestEvent &&
      !isStaleEvent(latestEvent.created_at, RECONCILE_STALE_AFTER_MS)
    ) {
      return c.json(
        {
          error:
            'Run still appears active; reconcile is only allowed after 6 minutes of no events unless force is true.',
          latest_event_at: latestEvent.created_at,
          latest_event_source: latestEvent.source,
        },
        409
      );
    }

    await createRunEvent(c.env, run.id, {
      type: 'reconcile_requested',
      message: 'Droid reconcile requested.',
      metadata: { sandbox_id: run.sandbox_id, status: run.status },
    });
    const startedAt = Date.now();
    const reconcilePromise = executeRun(c.env, executor, {
      ...executionInputFromRun(run, request),
      startedAt,
      reconcile: true,
      waitUntil: (promise: Promise<void>) => scheduleBackground(c, promise),
    });

    if (incoming?.wait_for_completion === true) {
      await reconcilePromise;
    } else {
      try {
        c.executionCtx.waitUntil(reconcilePromise);
      } catch {
        void reconcilePromise;
      }
    }

    const updatedRun = await getRun(c.env, run.id);
    return c.json(
      { data: updatedRun ?? run, reconciled: true },
      incoming?.wait_for_completion === true ? 200 : 202
    );
  });

  return app;
}

function scheduleBackground(
  c: { executionCtx: { waitUntil: (promise: Promise<unknown>) => void } },
  promise: Promise<void>
) {
  try {
    c.executionCtx.waitUntil(promise);
  } catch {
    void promise;
  }
}

async function getLatestRunActivity(
  env: Env,
  runId: string
): Promise<{ created_at: string; source: 'd1' | 'run_room' } | null> {
  const candidates: Array<{ created_at: string; source: 'd1' | 'run_room'; parsed: number }> = [];
  const latestEvent = await getLatestRunEvent(env, runId);
  const latestEventTime = latestEvent ? parseRunTimestamp(latestEvent.created_at) : Number.NaN;
  if (latestEvent && Number.isFinite(latestEventTime)) {
    candidates.push({ created_at: latestEvent.created_at, source: 'd1', parsed: latestEventTime });
  }

  const roomStatus = await getRunRoomStatus(env, runId);
  const roomEventTime = roomStatus?.last_event_at
    ? parseRunTimestamp(roomStatus.last_event_at)
    : Number.NaN;
  if (roomStatus?.last_event_at && Number.isFinite(roomEventTime)) {
    candidates.push({
      created_at: roomStatus.last_event_at,
      source: 'run_room',
      parsed: roomEventTime,
    });
  }

  candidates.sort((left, right) => right.parsed - left.parsed);
  const latest = candidates[0];
  return latest ? { created_at: latest.created_at, source: latest.source } : null;
}

async function getLatestRunActivityWithStart(
  env: Env,
  run: { id: string; started_at: string | null }
): Promise<{ created_at: string; source: 'd1' | 'run_room' | 'started_at' } | null> {
  const activity = await getLatestRunActivity(env, run.id);
  if (activity) return activity;
  return run.started_at ? { created_at: run.started_at, source: 'started_at' } : null;
}

function isStaleEvent(createdAt: string, thresholdMs: number): boolean {
  const parsed = parseRunTimestamp(createdAt);
  if (!Number.isFinite(parsed)) return false;
  return Date.now() - parsed >= thresholdMs;
}

function durationSince(createdAt: string | null): number {
  if (!createdAt) return 0;
  const parsed = parseRunTimestamp(createdAt);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(Date.now() - parsed, 0);
}

function parseRunTimestamp(value: string): number {
  if (value.includes('T')) return Date.parse(value);
  return Date.parse(`${value.replace(' ', 'T')}Z`);
}

async function createRunEvent(env: Env, runId: string, input: RunEventInput): Promise<void> {
  await createRunEventInDb(env, runId, input);
  try {
    await recordRunRoomEvent(env, runId, input);
  } catch (error) {
    console.warn('Failed to record Droid run room event', error);
  }
}

async function executeRun(
  env: Env,
  executor: RunExecutor,
  input: {
    runId: string;
    sandboxId: string;
    startedAt: number;
    taskId?: string;
    projectSlug?: string;
    repoUrl?: string;
    branch?: string;
    command: string;
    mode: RunMode;
    prompt?: string;
    provider?: RunProvider;
    maxTurns?: number;
    timeoutSeconds: number;
    createPr: boolean;
    prTitle?: string;
    prBody?: string;
    prBaseBranch?: string;
    acceptanceCommand?: string;
    acceptanceTimeoutSeconds?: number;
    browserAcceptance?: BrowserAcceptanceRequest;
    loopPolicy?: LoopPolicyRequest;
    cwd?: string;
    destroyAfterRun: boolean;
    reconcile?: boolean;
    waitUntil?: (promise: Promise<void>) => void;
  }
): Promise<void> {
  try {
    const executionInput: RunExecutionInput = {
      env,
      runId: input.runId,
      sandboxId: input.sandboxId,
      taskId: input.taskId,
      projectSlug: input.projectSlug,
      repoUrl: input.repoUrl,
      branch: input.branch,
      command: input.command,
      mode: input.mode,
      prompt: input.prompt,
      provider: input.provider,
      maxTurns: input.maxTurns,
      timeoutSeconds: input.timeoutSeconds,
      createPr: input.createPr,
      prTitle: input.prTitle,
      prBody: input.prBody,
      prBaseBranch: input.prBaseBranch,
      acceptanceCommand: input.acceptanceCommand,
      acceptanceTimeoutSeconds: input.acceptanceTimeoutSeconds,
      browserAcceptance: input.browserAcceptance,
      loopPolicy: input.loopPolicy,
      cwd: input.cwd,
      destroyAfterRun: input.destroyAfterRun,
      recordEvent: (event) => createRunEvent(env, input.runId, event),
      recordArtifact: (artifact) => createRunArtifact(env, input.runId, artifact),
    };
    const result = await executeRunAttempts(env, executor, input, executionInput);

    const durationMs = Date.now() - input.startedAt;
    const status = result.success ? 'completed' : 'failed';
    const summary = summarizeCommandResult(result);
    await finishRun(env, input.runId, {
      status,
      exitCode: result.exitCode,
      durationMs,
      summary,
      errorMessage: result.success ? undefined : result.stderr || summary,
    });
    await createRunEvent(env, input.runId, {
      type: 'run_finished',
      message: summary,
      exit_code: result.exitCode,
      metadata: { duration_ms: durationMs, status },
    });
    if (input.loopPolicy?.enabled) {
      await createRunEvent(env, input.runId, {
        type: result.success ? 'loop_completed' : 'loop_stopped',
        message: result.success
          ? `Droid loop completed on attempt ${result.attempt}.`
          : `Droid loop stopped after attempt ${result.attempt}.`,
        exit_code: result.exitCode,
        metadata: {
          attempt: result.attempt,
          max_attempts: input.loopPolicy.max_attempts,
          retry_on_failure: input.loopPolicy.retry_on_failure,
          stop_on_blocker: input.loopPolicy.stop_on_blocker,
          status,
          blocked: result.blocked,
          exhausted: result.exhausted,
        },
      });
    }
  } catch (error) {
    if (error instanceof RunTimeoutError) {
      await handleRunTimeout(env, executor, input, error);
      return;
    }
    const durationMs = Date.now() - input.startedAt;
    const message = error instanceof Error ? error.message : 'Droid run failed.';
    await finishRun(env, input.runId, {
      status: 'failed',
      exitCode: 1,
      durationMs,
      summary: 'Droid run failed.',
      errorMessage: message,
    });
    await createRunEvent(env, input.runId, {
      type: 'run_failed',
      message,
      exit_code: 1,
      metadata: { duration_ms: durationMs },
    });
  } finally {
    const nextPromise = dispatchNextQueuedRun(env, executor, input).catch((error) =>
      createRunEvent(env, input.runId, {
        type: 'queue_dispatch_failed',
        message: error instanceof Error ? error.message : 'Droid queue dispatch failed.',
        metadata: { run_id: input.runId },
      })
    );
    if (input.waitUntil) {
      input.waitUntil(nextPromise);
    } else {
      void nextPromise;
    }
  }
}

async function executeRunAttempts(
  env: Env,
  executor: RunExecutor,
  input: Parameters<typeof executeRun>[2],
  executionInput: RunExecutionInput
): Promise<CommandResult & { attempt: number; blocked: boolean; exhausted: boolean }> {
  const loopPolicy = input.loopPolicy?.enabled ? input.loopPolicy : undefined;
  const maxAttempts = loopPolicy?.max_attempts ?? 1;
  let attempt = 1;
  let result: CommandResult | null = null;
  let blocked = false;

  while (attempt <= maxAttempts) {
    if (loopPolicy) {
      await createRunEvent(env, input.runId, {
        type: 'loop_attempt_started',
        message: `Droid loop attempt ${attempt} started.`,
        command: input.command,
        metadata: {
          attempt,
          max_attempts: maxAttempts,
          retry_on_failure: loopPolicy.retry_on_failure,
          stop_on_blocker: loopPolicy.stop_on_blocker,
        },
      });
    }

    const operation =
      input.reconcile && executor.reconcile
        ? executor.reconcile(executionInput)
        : executor.execute(executionInput);
    result = await runWithTimeout(operation, input.timeoutSeconds * 1000);
    blocked = await isRunBlocked(env, input.runId, result);

    if (loopPolicy) {
      await createRunEvent(env, input.runId, {
        type: 'loop_attempt_finished',
        message: `Droid loop attempt ${attempt} ${result.success ? 'completed' : 'failed'}.`,
        command: input.command,
        exit_code: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        metadata: {
          attempt,
          max_attempts: maxAttempts,
          status: result.success ? 'completed' : 'failed',
          blocked,
        },
      });
    }

    if (result.success || (blocked && loopPolicy?.stop_on_blocker !== false)) {
      break;
    }
    if (!loopPolicy?.retry_on_failure || attempt >= maxAttempts) {
      break;
    }

    await createRunEvent(env, input.runId, {
      type: 'loop_retry_scheduled',
      message: `Droid loop retry ${attempt + 1} scheduled after failed attempt ${attempt}.`,
      command: input.command,
      metadata: {
        attempt,
        next_attempt: attempt + 1,
        max_attempts: maxAttempts,
      },
    });
    attempt += 1;
  }

  if (!result) {
    return {
      stdout: '',
      stderr: 'Droid loop did not execute.',
      exitCode: 1,
      success: false,
      attempt,
      blocked: false,
      exhausted: true,
    };
  }

  return {
    ...result,
    attempt,
    blocked,
    exhausted: !result.success && !blocked && attempt >= maxAttempts,
  };
}

async function isRunBlocked(env: Env, runId: string, result: CommandResult): Promise<boolean> {
  if (result.exitCode === 75) return true;
  const events = await listRunEvents(env, runId);
  return events.some((event) => event.type === 'agent_blocked');
}

async function dispatchNextQueuedRun(
  env: Env,
  executor: RunExecutor,
  input: {
    runId: string;
    repoUrl?: string;
    waitUntil?: (promise: Promise<void>) => void;
  }
): Promise<void> {
  const finishedRun = await getRun(env, input.runId);
  if (!finishedRun) return;
  const nextRun = await getNextQueuedRunForQueue(env, {
    repoUrl: finishedRun.repo_url ?? input.repoUrl,
    projectSlug: finishedRun.project_slug,
    excludeRunId: finishedRun.id,
  });
  if (!nextRun) return;

  const request = await getLatestRunRequest(env, nextRun.id);
  const queuedInput = executionInputFromRun(nextRun, request);
  const activeRun = await getActiveRunForQueue(env, {
    repoUrl: queuedInput.repoUrl,
    projectSlug: nextRun.project_slug ?? undefined,
    excludeRunId: nextRun.id,
  });
  if (activeRun) return;

  await createRunEvent(env, nextRun.id, {
    type: 'run_dequeued',
    message: 'Queued Droid run dequeued after the previous run finished.',
    command: queuedInput.command,
    metadata: {
      auto: true,
      previous_run_id: finishedRun.id,
    },
  });
  await markRunStarted(env, nextRun.id);
  await createRunEvent(env, nextRun.id, {
    type: 'run_started',
    message: 'Droid run started',
    command: queuedInput.command,
    metadata: {
      mode: queuedInput.mode,
      provider: queuedInput.provider ?? null,
      task_id: nextRun.task_id,
      project_slug: nextRun.project_slug,
      repo_url: queuedInput.repoUrl ?? null,
      branch: queuedInput.branch ?? null,
      sandbox_id: nextRun.sandbox_id,
      timeout_seconds: queuedInput.timeoutSeconds,
      dequeued: true,
      auto: true,
    },
  });
  await executeRun(env, executor, {
    ...queuedInput,
    startedAt: Date.now(),
    waitUntil: input.waitUntil,
  });
}

async function runWithTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  operation.catch(() => undefined);
  const watchdog = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new RunTimeoutError(timeoutMs)), timeoutMs);
  });
  try {
    return await Promise.race([operation, watchdog]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

class RunTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Droid run timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
  }
}

function summarizeCommandResult(result: CommandResult): string {
  if (result.success) {
    return `Command completed with exit code ${result.exitCode}.`;
  }

  const reason = firstUsefulLine(result.stderr) || firstUsefulLine(result.stdout);
  if (!reason) {
    return `Command failed with exit code ${result.exitCode}. Inspect the Droid events for the failing command.`;
  }
  return `Command failed with exit code ${result.exitCode}: ${truncateSummary(reason)}`;
}

function firstUsefulLine(value: string): string {
  return (
    value
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? ''
  );
}

function truncateSummary(value: string): string {
  return value.length > 220 ? `${value.slice(0, 217)}...` : value;
}

async function markStaleRunAndReleaseQueue(
  env: Env,
  executor: RunExecutor,
  run: RunRecord,
  input: {
    forced: boolean;
    latestActivity?: { created_at?: string; source?: string } | null;
    waitForDispatch: boolean;
    waitUntil: (promise: Promise<void>) => void;
  }
): Promise<void> {
  await createRunEvent(env, run.id, {
    type: 'run_marked_stale',
    message: 'Droid run marked stale after no recent activity.',
    exit_code: 124,
    metadata: {
      sandbox_id: run.sandbox_id,
      latest_event_at: input.latestActivity?.created_at ?? null,
      latest_event_source: input.latestActivity?.source ?? null,
      forced: input.forced,
    },
  });
  await finishRun(env, run.id, {
    status: 'failed',
    exitCode: 124,
    durationMs: durationSince(run.started_at),
    summary: 'Droid run marked stale after no recent activity.',
    errorMessage: 'Droid run marked stale after no recent activity.',
  });

  if (executor.cancel) {
    const cancelPromise = executor
      .cancel({
        env,
        runId: run.id,
        sandboxId: run.sandbox_id,
        recordEvent: (event) => createRunEvent(env, run.id, event),
        recordArtifact: (artifact) => createRunArtifact(env, run.id, artifact),
      })
      .catch((error) =>
        createRunEvent(env, run.id, {
          type: 'sandbox_destroy_failed',
          message: error instanceof Error ? error.message : 'Sandbox destroy failed.',
          metadata: { sandbox_id: run.sandbox_id, during_stale_recovery: true },
        })
      );
    input.waitUntil(cancelPromise);
  }

  const dispatchPromise = dispatchNextQueuedRun(env, executor, {
    runId: run.id,
    repoUrl: run.repo_url ?? undefined,
    waitUntil: input.waitUntil,
  }).catch((error) =>
    createRunEvent(env, run.id, {
      type: 'queue_dispatch_failed',
      message: error instanceof Error ? error.message : 'Droid queue dispatch failed.',
      metadata: { run_id: run.id, during_stale_recovery: true },
    })
  );
  if (input.waitForDispatch) {
    await dispatchPromise;
  } else {
    input.waitUntil(dispatchPromise);
  }
}

async function handleRunTimeout(
  env: Env,
  executor: RunExecutor,
  input: {
    runId: string;
    sandboxId: string;
    startedAt: number;
    timeoutSeconds: number;
  },
  error: RunTimeoutError
): Promise<void> {
  const durationMs = Date.now() - input.startedAt;
  await createRunEvent(env, input.runId, {
    type: 'run_timeout',
    message: error.message,
    exit_code: 124,
    metadata: {
      duration_ms: durationMs,
      sandbox_id: input.sandboxId,
      timeout_seconds: input.timeoutSeconds,
    },
  });

  if (executor.cancel) {
    try {
      await executor.cancel({
        env,
        runId: input.runId,
        sandboxId: input.sandboxId,
        recordEvent: (event) => createRunEvent(env, input.runId, event),
        recordArtifact: (artifact) => createRunArtifact(env, input.runId, artifact),
      });
    } catch (cancelError) {
      await createRunEvent(env, input.runId, {
        type: 'run_timeout_cancel_failed',
        message:
          cancelError instanceof Error ? cancelError.message : 'Timed out sandbox cleanup failed.',
        metadata: { sandbox_id: input.sandboxId },
      });
    }
  }

  await finishRun(env, input.runId, {
    status: 'failed',
    exitCode: 124,
    durationMs,
    summary: error.message,
    errorMessage: error.message,
  });
  await createRunEvent(env, input.runId, {
    type: 'run_finished',
    message: error.message,
    exit_code: 124,
    metadata: { duration_ms: durationMs, status: 'failed', reason: 'timeout' },
  });
}

function buildRunRequestMetadata(
  body: RunRequest | null,
  normalized: {
    mode: RunMode;
    command: string;
    repoUrl?: string;
    branch?: string;
    timeoutSeconds: number;
  }
): Record<string, unknown> {
  return {
    mode: normalized.mode,
    provider: body?.provider ?? null,
    task_id: body?.task_id ?? null,
    project_slug: body?.project_slug ?? null,
    repo_url: normalized.repoUrl ?? null,
    branch: normalized.branch ?? null,
    command: normalized.command,
    prompt: body?.prompt ?? null,
    max_turns: body?.max_turns ?? null,
    timeout_seconds: normalized.timeoutSeconds,
    create_pr: body?.create_pr === true,
    pr_title: body?.pr_title ?? null,
    pr_body: body?.pr_body ?? null,
    pr_base_branch: body?.pr_base_branch ?? null,
    acceptance_command: body?.acceptance_command ?? null,
    acceptance_timeout_seconds: body?.acceptance_timeout_seconds ?? null,
    browser_acceptance: normalizeBrowserAcceptance(body?.browser_acceptance) ?? null,
    loop_policy: normalizeLoopPolicy(body?.loop_policy) ?? null,
    cwd: body?.cwd ?? null,
    destroy_after_run: body?.destroy_after_run !== false,
  };
}

function executionInputFromRun(
  run: Awaited<ReturnType<typeof getRun>> & {},
  request: Record<string, unknown> | null
) {
  const mode = normalizeMode(request?.mode);
  const timeoutSeconds =
    normalizeTimeoutSeconds(request?.timeout_seconds) ?? DEFAULT_RECONCILE_TIMEOUT_SECONDS;
  return {
    runId: run.id,
    sandboxId: run.sandbox_id,
    taskId: run.task_id ?? undefined,
    projectSlug: run.project_slug ?? undefined,
    repoUrl: stringFromUnknown(request?.repo_url) ?? run.repo_url ?? undefined,
    branch: stringFromUnknown(request?.branch) ?? run.branch ?? undefined,
    command: stringFromUnknown(request?.command) ?? run.command,
    mode,
    prompt: stringFromUnknown(request?.prompt),
    provider: request?.provider === 'deepseek' ? ('deepseek' as const) : undefined,
    maxTurns: normalizeMaxTurns(request?.max_turns),
    timeoutSeconds,
    createPr: request?.create_pr === true,
    prTitle: stringFromUnknown(request?.pr_title),
    prBody: stringFromUnknown(request?.pr_body),
    prBaseBranch: stringFromUnknown(request?.pr_base_branch),
    acceptanceCommand: stringFromUnknown(request?.acceptance_command),
    acceptanceTimeoutSeconds: normalizeAcceptanceTimeoutSeconds(
      request?.acceptance_timeout_seconds
    ),
    browserAcceptance: normalizeBrowserAcceptance(request?.browser_acceptance),
    loopPolicy: normalizeLoopPolicy(request?.loop_policy),
    cwd: stringFromUnknown(request?.cwd) ?? run.cwd ?? undefined,
    destroyAfterRun: request?.destroy_after_run !== false,
  };
}

function stringFromUnknown(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isSandboxPreviewRequest(request: Request): boolean {
  const hostname = new URL(request.url).hostname;
  return /^\d+-droid-[a-z0-9-]+-[a-z0-9_]+/i.test(hostname.split('.')[0] ?? '');
}

function validateRunRequest(body: RunRequest | null): { ok: true } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'JSON body is required' };
  const mode = normalizeMode(body.mode);
  if (mode === 'command' && (typeof body.command !== 'string' || !body.command.trim())) {
    return { ok: false, error: 'command is required' };
  }
  if (mode !== 'command') {
    if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
      return { ok: false, error: 'prompt is required' };
    }
    if (body.provider !== undefined && body.provider !== 'deepseek') {
      return { ok: false, error: 'provider must be deepseek' };
    }
  }
  if (body.repo_url !== undefined && typeof body.repo_url !== 'string') {
    return { ok: false, error: 'repo_url must be a string' };
  }
  if (body.repo_url && !/^https:\/\/|^git@/.test(body.repo_url)) {
    return { ok: false, error: 'repo_url must be an https or git SSH URL' };
  }
  if (body.cwd !== undefined && (typeof body.cwd !== 'string' || body.cwd.includes('..'))) {
    return { ok: false, error: 'cwd must be a safe relative path' };
  }
  if (body.max_turns !== undefined && normalizeMaxTurns(body.max_turns) === undefined) {
    return { ok: false, error: 'max_turns must be between 1 and 50' };
  }
  if (
    body.timeout_seconds !== undefined &&
    normalizeTimeoutSeconds(body.timeout_seconds) === undefined
  ) {
    return { ok: false, error: 'timeout_seconds must be between 60 and 1800' };
  }
  if (body.pr_title !== undefined && typeof body.pr_title !== 'string') {
    return { ok: false, error: 'pr_title must be a string' };
  }
  if (body.pr_body !== undefined && typeof body.pr_body !== 'string') {
    return { ok: false, error: 'pr_body must be a string' };
  }
  if (body.pr_base_branch !== undefined && typeof body.pr_base_branch !== 'string') {
    return { ok: false, error: 'pr_base_branch must be a string' };
  }
  if (body.acceptance_command !== undefined && typeof body.acceptance_command !== 'string') {
    return { ok: false, error: 'acceptance_command must be a string' };
  }
  if (
    body.acceptance_timeout_seconds !== undefined &&
    normalizeAcceptanceTimeoutSeconds(body.acceptance_timeout_seconds) === undefined
  ) {
    return { ok: false, error: 'acceptance_timeout_seconds must be between 30 and 900' };
  }
  const browserValidation = validateBrowserAcceptance(body.browser_acceptance);
  if (!browserValidation.ok) return browserValidation;
  const loopValidation = validateLoopPolicy(body.loop_policy);
  if (!loopValidation.ok) return loopValidation;
  return { ok: true };
}

function validateRunEnvironment(
  env: Env,
  body: RunRequest | null,
  mode: RunMode
): { ok: true } | { ok: false; error: string } {
  if (mode === 'native' && !env.DROID_DEEPSEEK_API_KEY?.trim()) {
    return { ok: false, error: 'DROID_DEEPSEEK_API_KEY is required for native Droid runs' };
  }
  if (body?.create_pr === true && !env.DROID_GITHUB_TOKEN?.trim()) {
    return { ok: false, error: 'DROID_GITHUB_TOKEN is required when create_pr is true' };
  }
  if (isBrowserAcceptanceRequested(body?.browser_acceptance) && !env.BROWSER) {
    return { ok: false, error: 'BROWSER binding is required when browser_acceptance is enabled' };
  }
  return { ok: true };
}

function normalizeMode(value: unknown): RunMode {
  if (value === 'native') return value;
  return 'command';
}

function buildAgentLedgerCommand(mode: Exclude<RunMode, 'command'>, prompt: string) {
  const summary = prompt.split(/\s+/).slice(0, 12).join(' ');
  return `${mode}: ${summary || 'task prompt'}`;
}

function normalizeMaxTurns(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value)) return undefined;
  if (value < 1 || value > 50) return undefined;
  return value;
}

function normalizeTimeoutSeconds(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value)) return undefined;
  if (value < 60) return 60;
  if (value > 1800) return 1800;
  return value;
}

function normalizeAcceptanceTimeoutSeconds(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value)) return undefined;
  if (value < 30) return 30;
  if (value > 900) return 900;
  return value;
}

function validateBrowserAcceptance(value: unknown): { ok: true } | { ok: false; error: string } {
  if (value === undefined) return { ok: true };
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'browser_acceptance must be an object' };
  }
  const config = value as Record<string, unknown>;
  if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
    return { ok: false, error: 'browser_acceptance.enabled must be a boolean' };
  }
  if (config.goal !== undefined && typeof config.goal !== 'string') {
    return { ok: false, error: 'browser_acceptance.goal must be a string' };
  }
  if (config.url !== undefined && typeof config.url !== 'string') {
    return { ok: false, error: 'browser_acceptance.url must be a string' };
  }
  if (typeof config.url === 'string' && config.url.trim() && !isHttpUrl(config.url)) {
    return { ok: false, error: 'browser_acceptance.url must be an http or https URL' };
  }
  if (config.start_command !== undefined && typeof config.start_command !== 'string') {
    return { ok: false, error: 'browser_acceptance.start_command must be a string' };
  }
  if (config.port !== undefined && normalizeBrowserPort(config.port) === undefined) {
    return { ok: false, error: 'browser_acceptance.port must be between 1024 and 65535' };
  }
  if (config.preview_hostname !== undefined && typeof config.preview_hostname !== 'string') {
    return { ok: false, error: 'browser_acceptance.preview_hostname must be a string' };
  }
  if (
    config.timeout_seconds !== undefined &&
    normalizeBrowserTimeoutSeconds(config.timeout_seconds) === undefined
  ) {
    return { ok: false, error: 'browser_acceptance.timeout_seconds must be between 30 and 300' };
  }
  if (config.keep_open !== undefined && typeof config.keep_open !== 'boolean') {
    return { ok: false, error: 'browser_acceptance.keep_open must be a boolean' };
  }
  if (
    config.assert_text !== undefined &&
    (!Array.isArray(config.assert_text) ||
      config.assert_text.some((item) => typeof item !== 'string'))
  ) {
    return { ok: false, error: 'browser_acceptance.assert_text must be an array of strings' };
  }
  return { ok: true };
}

function normalizeBrowserAcceptance(value: unknown): BrowserAcceptanceRequest | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const config = value as Record<string, unknown>;
  const assertText = Array.isArray(config.assert_text)
    ? config.assert_text
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim())
    : undefined;
  return {
    enabled: typeof config.enabled === 'boolean' ? config.enabled : undefined,
    goal: stringFromUnknown(config.goal),
    url: stringFromUnknown(config.url),
    start_command: stringFromUnknown(config.start_command),
    port: normalizeBrowserPort(config.port),
    preview_hostname: stringFromUnknown(config.preview_hostname),
    assert_text: assertText?.length ? assertText : undefined,
    timeout_seconds: normalizeBrowserTimeoutSeconds(config.timeout_seconds),
    keep_open: typeof config.keep_open === 'boolean' ? config.keep_open : undefined,
  };
}

function validateLoopPolicy(value: unknown): { ok: true } | { ok: false; error: string } {
  if (value === undefined) return { ok: true };
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'loop_policy must be an object' };
  }
  const config = value as Record<string, unknown>;
  if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
    return { ok: false, error: 'loop_policy.enabled must be a boolean' };
  }
  if (
    config.max_attempts !== undefined &&
    normalizeLoopMaxAttempts(config.max_attempts) === undefined
  ) {
    return { ok: false, error: 'loop_policy.max_attempts must be between 1 and 5' };
  }
  if (config.retry_on_failure !== undefined && typeof config.retry_on_failure !== 'boolean') {
    return { ok: false, error: 'loop_policy.retry_on_failure must be a boolean' };
  }
  if (config.stop_on_blocker !== undefined && typeof config.stop_on_blocker !== 'boolean') {
    return { ok: false, error: 'loop_policy.stop_on_blocker must be a boolean' };
  }
  if (
    config.cost_budget_usd !== undefined &&
    normalizeLoopCostBudgetUsd(config.cost_budget_usd) === undefined
  ) {
    return { ok: false, error: 'loop_policy.cost_budget_usd must be between 0.01 and 25' };
  }
  return { ok: true };
}

function normalizeLoopPolicy(value: unknown): LoopPolicyRequest | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const config = value as Record<string, unknown>;
  const enabled = config.enabled === true;
  if (!enabled) return undefined;
  return {
    enabled,
    max_attempts: normalizeLoopMaxAttempts(config.max_attempts) ?? 2,
    retry_on_failure: typeof config.retry_on_failure === 'boolean' ? config.retry_on_failure : true,
    stop_on_blocker: typeof config.stop_on_blocker === 'boolean' ? config.stop_on_blocker : true,
    cost_budget_usd: normalizeLoopCostBudgetUsd(config.cost_budget_usd),
  };
}

function normalizeLoopMaxAttempts(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value)) return undefined;
  if (value < 1 || value > 5) return undefined;
  return value;
}

function normalizeLoopCostBudgetUsd(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value < 0.01 || value > 25) return undefined;
  return Math.round(value * 100) / 100;
}

function buildLoopStartedEvent(
  policy: LoopPolicyRequest,
  input: {
    taskId?: string;
    command: string;
    dequeued?: boolean;
  }
): RunEventInput {
  return {
    type: 'loop_started',
    actor: 'droid',
    source: 'worker',
    message: 'Droid loop started with bounded retry attempts.',
    command: input.command,
    metadata: {
      task_id: input.taskId ?? null,
      attempt: 1,
      max_attempts: policy.max_attempts,
      retry_on_failure: policy.retry_on_failure,
      stop_on_blocker: policy.stop_on_blocker,
      cost_budget_usd: policy.cost_budget_usd ?? null,
      dequeued: input.dequeued === true,
    },
  };
}

function isBrowserAcceptanceRequested(value: unknown): boolean {
  const config = normalizeBrowserAcceptance(value);
  if (!config || config.enabled === false) return false;
  return Boolean(config.goal || config.url || config.start_command);
}

function normalizeBrowserTimeoutSeconds(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value)) return undefined;
  if (value < 30) return 30;
  if (value > 300) return 300;
  return value;
}

function normalizeBrowserPort(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value)) return undefined;
  if (value < 1024 || value > 65535) return undefined;
  return value;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeLimit(value: unknown): number | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  if (typeof value === 'string' && !value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return undefined;
  if (parsed < 1) return 1;
  if (parsed > 50) return 50;
  return parsed;
}

function normalizeMaxRunningRuns(value: unknown): number {
  if (typeof value !== 'string' && typeof value !== 'number') return DEFAULT_MAX_RUNNING_RUNS;
  if (typeof value === 'string' && !value.trim()) return DEFAULT_MAX_RUNNING_RUNS;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return DEFAULT_MAX_RUNNING_RUNS;
  if (parsed < 1) return 1;
  if (parsed > 20) return 20;
  return parsed;
}
