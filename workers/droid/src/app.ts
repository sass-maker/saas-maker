import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createRun, createRunArtifact, createRunEvent, finishRun, getActiveRunForQueue, getLatestRunEvent, getLatestRunRequest, getNextQueuedRunForQueue, getRun, getRunStats, listRunArtifacts, listRunEvents, listRuns, markRunStarted } from './db';
import type { CommandResult, Env, RunExecutionInput, RunExecutor, RunMode, RunRequest } from './types';

const DEFAULT_TIMEOUT_SECONDS = 900;
const DEFAULT_RECONCILE_TIMEOUT_SECONDS = 240;
const RECONCILE_STALE_AFTER_MS = 6 * 60 * 1000;

type Variables = {
  requestId: string;
};

export function createApp(executor: RunExecutor) {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();

  app.use('*', cors({
    origin: '*',
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  }));

  app.use('*', async (c, next) => {
    c.set('requestId', crypto.randomUUID());
    await next();
  });

  app.onError((error, c) => {
    console.error(`[${c.get('requestId')}] Droid error`, error);
    return c.json({ error: 'Internal server error' }, 500);
  });

  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.use('/v0/*', async (c, next) => {
    const expected = c.env.DROID_INTERNAL_TOKEN;
    const actual = c.req.header('Authorization');
    if (!expected || actual !== `Bearer ${expected}`) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    await next();
  });

  app.post('/v0/runs', async (c) => {
    const body = await c.req.json().catch(() => null) as RunRequest | null;
    const validation = validateRunRequest(body);
    if (!validation.ok) return c.json({ error: validation.error }, 400);

    const runId = crypto.randomUUID();
    const sandboxId = `droid-${runId}`;
    const startedAt = Date.now();
    const mode = normalizeMode(body?.mode);
    const environmentValidation = validateRunEnvironment(c.env, body, mode);
    if (!environmentValidation.ok) return c.json({ error: environmentValidation.error }, 503);
    const command = mode !== 'command'
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
    if (activeRun) {
      await createRunEvent(c.env, runId, {
        type: 'run_queued',
        message: 'Droid run queued because another run is already active for this repository/project.',
        command,
        metadata: {
          active_run_id: activeRun.id,
          active_sandbox_id: activeRun.sandbox_id,
          repo_url: body?.repo_url?.trim() ?? null,
          project_slug: body?.project_slug?.trim() ?? null,
        },
      });
      const queuedRun = await getRun(c.env, runId);
      return c.json({ data: queuedRun ?? run, queued_after: activeRun.id }, 202);
    }

    await markRunStarted(c.env, runId);
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
    return c.json({ data: updatedRun ?? run }, updatedRun ? (body?.wait_for_completion === true ? 201 : 202) : 500);
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

  app.get('/v0/runs/:id/events', async (c) => {
    const run = await getRun(c.env, c.req.param('id'));
    if (!run) return c.json({ error: 'Run not found' }, 404);
    const events = await listRunEvents(c.env, run.id);
    return c.json({ data: events });
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
    const cancelPromise = executor.cancel({
      env: c.env,
      runId: run.id,
      sandboxId: run.sandbox_id,
      recordEvent: (event) => createRunEvent(c.env, run.id, event),
      recordArtifact: (artifact) => createRunArtifact(c.env, run.id, artifact),
    }).catch((error) => createRunEvent(c.env, run.id, {
      type: 'sandbox_destroy_failed',
      message: error instanceof Error ? error.message : 'Sandbox destroy failed.',
      metadata: { sandbox_id: run.sandbox_id },
    }));
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

  app.post('/v0/runs/:id/reconcile', async (c) => {
    const run = await getRun(c.env, c.req.param('id'));
    if (!run) return c.json({ error: 'Run not found' }, 404);
    if (run.status === 'completed' || run.status === 'failed') {
      return c.json({ data: run, reconciled: false });
    }
    const incoming = await c.req.json().catch(() => null) as { wait_for_completion?: boolean; force?: boolean } | null;
    const request = await getLatestRunRequest(c.env, run.id);
    if (run.status === 'queued') {
      const queuedInput = executionInputFromRun(run, request);
      const activeRun = await getActiveRunForQueue(c.env, {
        repoUrl: queuedInput.repoUrl,
        projectSlug: run.project_slug ?? undefined,
        excludeRunId: run.id,
      });
      if (!incoming?.force && activeRun) {
        return c.json({
          error: 'Run is queued behind an active Droid run.',
          active_run_id: activeRun.id,
        }, 409);
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
      return c.json({ data: updatedRun ?? run, dequeued: true }, incoming?.wait_for_completion === true ? 200 : 202);
    }

    if (!executor.reconcile) return c.json({ error: 'Run reconciliation is not supported' }, 501);
    const latestEvent = await getLatestRunEvent(c.env, run.id);
    if (!incoming?.force && latestEvent && !isStaleEvent(latestEvent.created_at, RECONCILE_STALE_AFTER_MS)) {
      return c.json({
        error: 'Run still appears active; reconcile is only allowed after 6 minutes of no events unless force is true.',
        latest_event_at: latestEvent.created_at,
      }, 409);
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
    return c.json({ data: updatedRun ?? run, reconciled: true }, incoming?.wait_for_completion === true ? 200 : 202);
  });

  return app;
}

function scheduleBackground(c: { executionCtx: { waitUntil: (promise: Promise<unknown>) => void } }, promise: Promise<void>) {
  try {
    c.executionCtx.waitUntil(promise);
  } catch {
    void promise;
  }
}

function isStaleEvent(createdAt: string, thresholdMs: number): boolean {
  const parsed = Date.parse(`${createdAt.replace(' ', 'T')}Z`);
  if (!Number.isFinite(parsed)) return false;
  return Date.now() - parsed >= thresholdMs;
}

async function executeRun(env: Env, executor: RunExecutor, input: {
  runId: string;
  sandboxId: string;
  startedAt: number;
  repoUrl?: string;
  branch?: string;
  command: string;
  mode: RunMode;
  prompt?: string;
  provider?: 'deepseek';
  maxTurns?: number;
  timeoutSeconds: number;
  createPr: boolean;
  prTitle?: string;
  prBody?: string;
  prBaseBranch?: string;
  cwd?: string;
  destroyAfterRun: boolean;
  reconcile?: boolean;
  waitUntil?: (promise: Promise<void>) => void;
}): Promise<void> {
  try {
    const executionInput: RunExecutionInput = {
      env,
      runId: input.runId,
      sandboxId: input.sandboxId,
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
      cwd: input.cwd,
      destroyAfterRun: input.destroyAfterRun,
      recordEvent: (event) => createRunEvent(env, input.runId, event),
      recordArtifact: (artifact) => createRunArtifact(env, input.runId, artifact),
    };
    const operation = input.reconcile && executor.reconcile
      ? executor.reconcile(executionInput)
      : executor.execute(executionInput);
    const result = await runWithTimeout(operation, input.timeoutSeconds * 1000);

    const durationMs = Date.now() - input.startedAt;
    const status = result.success ? 'completed' : 'failed';
    const summary = result.success
      ? `Command completed with exit code ${result.exitCode}.`
      : `Command failed with exit code ${result.exitCode}.`;
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
    const nextPromise = dispatchNextQueuedRun(env, executor, input).catch((error) => createRunEvent(env, input.runId, {
      type: 'queue_dispatch_failed',
      message: error instanceof Error ? error.message : 'Droid queue dispatch failed.',
      metadata: { run_id: input.runId },
    }));
    if (input.waitUntil) {
      input.waitUntil(nextPromise);
    } else {
      void nextPromise;
    }
  }
}

async function dispatchNextQueuedRun(env: Env, executor: RunExecutor, input: {
  runId: string;
  repoUrl?: string;
  waitUntil?: (promise: Promise<void>) => void;
}): Promise<void> {
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

async function handleRunTimeout(env: Env, executor: RunExecutor, input: {
  runId: string;
  sandboxId: string;
  startedAt: number;
  timeoutSeconds: number;
}, error: RunTimeoutError): Promise<void> {
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
        message: cancelError instanceof Error ? cancelError.message : 'Timed out sandbox cleanup failed.',
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

function buildRunRequestMetadata(body: RunRequest | null, normalized: {
  mode: RunMode;
  command: string;
  repoUrl?: string;
  branch?: string;
  timeoutSeconds: number;
}): Record<string, unknown> {
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
    cwd: body?.cwd ?? null,
    destroy_after_run: body?.destroy_after_run !== false,
  };
}

function executionInputFromRun(run: Awaited<ReturnType<typeof getRun>> & {}, request: Record<string, unknown> | null) {
  const mode = normalizeMode(request?.mode);
  const timeoutSeconds = normalizeTimeoutSeconds(request?.timeout_seconds) ?? DEFAULT_RECONCILE_TIMEOUT_SECONDS;
  return {
    runId: run.id,
    sandboxId: run.sandbox_id,
    repoUrl: stringFromUnknown(request?.repo_url) ?? run.repo_url ?? undefined,
    branch: stringFromUnknown(request?.branch) ?? run.branch ?? undefined,
    command: stringFromUnknown(request?.command) ?? run.command,
    mode,
    prompt: stringFromUnknown(request?.prompt),
    provider: request?.provider === 'deepseek' ? 'deepseek' as const : undefined,
    maxTurns: normalizeMaxTurns(request?.max_turns),
    timeoutSeconds,
    createPr: request?.create_pr === true,
    prTitle: stringFromUnknown(request?.pr_title),
    prBody: stringFromUnknown(request?.pr_body),
    prBaseBranch: stringFromUnknown(request?.pr_base_branch),
    cwd: stringFromUnknown(request?.cwd) ?? run.cwd ?? undefined,
    destroyAfterRun: request?.destroy_after_run !== false,
  };
}

function stringFromUnknown(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
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
  if (body.timeout_seconds !== undefined && normalizeTimeoutSeconds(body.timeout_seconds) === undefined) {
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
  return { ok: true };
}

function validateRunEnvironment(env: Env, body: RunRequest | null, mode: RunMode): { ok: true } | { ok: false; error: string } {
  if (mode === 'native' && !env.DROID_DEEPSEEK_API_KEY?.trim()) {
    return { ok: false, error: 'DROID_DEEPSEEK_API_KEY is required for native Droid runs' };
  }
  if (body?.create_pr === true && !env.DROID_GITHUB_TOKEN?.trim()) {
    return { ok: false, error: 'DROID_GITHUB_TOKEN is required when create_pr is true' };
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

function normalizeLimit(value: unknown): number | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return undefined;
  if (parsed < 1) return 1;
  if (parsed > 50) return 50;
  return parsed;
}
