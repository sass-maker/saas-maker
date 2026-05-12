import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createRun, createRunArtifact, createRunEvent, finishRun, getLatestRunEvent, getLatestRunRequest, getRun, listRunArtifacts, listRunEvents, listRuns, markRunStarted } from './db';
import type { CommandResult, Env, RunExecutionInput, RunExecutor, RunMode, RunRequest } from './types';

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

  app.get('/v0/debug/sandbox', async (c) => {
    const { getSandbox } = await import('@cloudflare/sandbox');
    const sandboxId = c.req.query('id')?.trim() || 'debug-fixed';
    const sandbox = getSandbox(c.env.Sandbox, sandboxId, {
      keepAlive: true,
      containerTimeouts: {
        instanceGetTimeoutMS: 180000,
        portReadyTimeoutMS: 240000,
        waitIntervalMS: 1000,
      },
    });
    const startedAt = Date.now();
    const steps: Array<Record<string, unknown>> = [];

    async function step<T>(name: string, action: () => Promise<T>): Promise<T> {
      const stepStartedAt = Date.now();
      try {
        const result = await action();
        steps.push({ name, ok: true, duration_ms: Date.now() - stepStartedAt, result: summarizeDebugResult(result) });
        return result;
      } catch (error) {
        steps.push({
          name,
          ok: false,
          duration_ms: Date.now() - stepStartedAt,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    try {
      await step('mkdir', () => sandbox.mkdir('/workspace/debug', { recursive: true }));
      await step('writeFile', () => sandbox.writeFile('/workspace/debug/hello.txt', 'hello sandbox'));
      const file = await step('readFile', () => sandbox.readFile('/workspace/debug/hello.txt'));
      const exec = await step('exec', () => sandbox.exec('echo sandbox-exec-ok', { timeout: 30000 }));
      if (c.req.query('destroy') === 'true') {
        await step('destroy', () => sandbox.destroy());
      }
      return c.json({
        ok: true,
        sandbox_id: sandboxId,
        duration_ms: Date.now() - startedAt,
        file_content: file.content,
        exec,
        steps,
      });
    } catch (error) {
      return c.json({
        ok: false,
        sandbox_id: sandboxId,
        duration_ms: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
        steps,
      }, 500);
    }
  });

  app.post('/v0/runs', async (c) => {
    const body = await c.req.json().catch(() => null) as RunRequest | null;
    const validation = validateRunRequest(body);
    if (!validation.ok) return c.json({ error: validation.error }, 400);

    const runId = crypto.randomUUID();
    const sandboxId = `droid-${runId}`;
    const startedAt = Date.now();
    const mode = normalizeMode(body?.mode);
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
      },
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
        timeoutSeconds: normalizeTimeoutSeconds(body?.timeout_seconds) ?? 900,
      }),
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
      timeoutSeconds: normalizeTimeoutSeconds(body?.timeout_seconds) ?? 900,
      createPr: body?.create_pr === true,
      prTitle: body?.pr_title?.trim(),
      prBody: body?.pr_body?.trim(),
      prBaseBranch: body?.pr_base_branch?.trim(),
      cwd: body?.cwd?.trim(),
      destroyAfterRun: body?.destroy_after_run !== false,
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
    if (!executor.reconcile) return c.json({ error: 'Run reconciliation is not supported' }, 501);
    const incoming = await c.req.json().catch(() => null) as { wait_for_completion?: boolean; force?: boolean } | null;
    const latestEvent = await getLatestRunEvent(c.env, run.id);
    if (!incoming?.force && latestEvent && !isStaleEvent(latestEvent.created_at, 6 * 60 * 1000)) {
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
    const request = await getLatestRunRequest(c.env, run.id);
    const startedAt = Date.now();
    const reconcilePromise = executeRun(c.env, executor, {
      ...executionInputFromRun(run, request),
      startedAt,
      reconcile: true,
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
    const result = input.reconcile && executor.reconcile
      ? await executor.reconcile(executionInput)
      : await executor.execute(executionInput);

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
  }
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
  const timeoutSeconds = normalizeTimeoutSeconds(request?.timeout_seconds) ?? 240;
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

function summarizeDebugResult(result: unknown): unknown {
  if (!result || typeof result !== 'object') return result;
  const record = result as Record<string, unknown>;
  return {
    ...record,
    stdout: typeof record.stdout === 'string' ? record.stdout.slice(0, 500) : record.stdout,
    stderr: typeof record.stderr === 'string' ? record.stderr.slice(0, 500) : record.stderr,
    content: typeof record.content === 'string' ? record.content.slice(0, 500) : record.content,
  };
}

function normalizeMode(value: unknown): RunMode {
  if (value === 'native' || value === 'claude_code' || value === 'opencode' || value === 'kilo' || value === 'aider') return value;
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
