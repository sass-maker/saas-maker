import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../workers/droid/src/app';
import type { Env, RunExecutor } from '../../workers/droid/src/types';

describe('droid runs', () => {
  it('requires the internal bearer token', async () => {
    const app = createApp(fakeExecutor());
    const env = createEnv();

    const response = await app.request('/v0/runs', {
      method: 'POST',
      body: JSON.stringify({ command: 'echo ok' }),
      headers: { 'Content-Type': 'application/json' },
    }, env);

    expect(response.status).toBe(401);
  });

  it('validates run input before creating a sandbox run', async () => {
    const app = createApp(fakeExecutor());
    const env = createEnv();

    const response = await app.request('/v0/runs', {
      method: 'POST',
      body: JSON.stringify({ repo_url: 'ftp://example.test/repo.git' }),
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
    }, env);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'command is required' });
  });

  it('requires a prompt for agent runs', async () => {
    const app = createApp(fakeExecutor());
    const env = createEnv();

    const response = await app.request('/v0/runs', {
      method: 'POST',
      body: JSON.stringify({ mode: 'native', provider: 'deepseek' }),
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
    }, env);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'prompt is required' });
  });

  it('accepts native Droid runs', async () => {
    const app = createApp(fakeExecutor());
    const env = createEnv();

    const response = await app.request('/v0/runs', {
      method: 'POST',
      body: JSON.stringify({ mode: 'native', provider: 'deepseek', prompt: 'inspect the repo', max_turns: 3, wait_for_completion: true }),
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
    }, env);

    expect(response.status).toBe(201);
    const payload = await response.json() as { data: { command: string; status: string } };
    expect(payload.data.command).toBe('native: inspect the repo');
    expect(payload.data.status).toBe('completed');
  });

  it('creates a run and stores detailed events', async () => {
    const app = createApp(fakeExecutor());
    const env = createEnv();

    const response = await app.request('/v0/runs', {
      method: 'POST',
      body: JSON.stringify({
        task_id: 'task-1',
        project_slug: 'saas-maker',
        repo_url: 'https://github.com/example/repo.git',
        branch: 'main',
        command: 'echo ok',
        wait_for_completion: true,
      }),
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
    }, env);

    expect(response.status).toBe(201);
    const payload = await response.json() as { data: { id: string; status: string; exit_code: number } };
    expect(payload.data.status).toBe('completed');
    expect(payload.data.exit_code).toBe(0);

    const eventsResponse = await app.request(`/v0/runs/${payload.data.id}/events`, {
      headers: { Authorization: 'Bearer test-token' },
    }, env);
    expect(eventsResponse.status).toBe(200);
    const eventsPayload = await eventsResponse.json() as { data: Array<{ type: string; stdout: string | null }> };
    expect(eventsPayload.data.map((event) => event.type)).toEqual([
      'run_started',
      'run_request',
      'command_start',
      'command_finish',
      'run_finished',
    ]);
    expect(eventsPayload.data[3].stdout).toBe('ok\n');
  });

  it('lists run artifacts', async () => {
    const app = createApp({
      async execute(input) {
        await input.recordArtifact({
          type: 'patch',
          name: 'git.diff',
          uri: `event://runs/${input.runId}/patch_captured`,
          metadata: { patch_bytes: 42 },
        });
        return { stdout: '', stderr: '', exitCode: 0, success: true };
      },
    });
    const env = createEnv();

    const response = await app.request('/v0/runs', {
      method: 'POST',
      body: JSON.stringify({ command: 'echo ok', wait_for_completion: true }),
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
    }, env);
    const payload = await response.json() as { data: { id: string } };

    const artifactsResponse = await app.request(`/v0/runs/${payload.data.id}/artifacts`, {
      headers: { Authorization: 'Bearer test-token' },
    }, env);

    expect(artifactsResponse.status).toBe(200);
    await expect(artifactsResponse.json()).resolves.toMatchObject({
      data: [
        {
          type: 'patch',
          name: 'git.diff',
          uri: `event://runs/${payload.data.id}/patch_captured`,
        },
      ],
    });
  });

  it('lists recent runs by task id', async () => {
    const app = createApp(fakeExecutor());
    const env = createEnv();

    const response = await app.request('/v0/runs', {
      method: 'POST',
      body: JSON.stringify({
        task_id: 'task-logs',
        project_slug: 'saas-maker',
        command: 'echo ok',
        wait_for_completion: true,
      }),
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
    }, env);
    expect(response.status).toBe(201);

    const listResponse = await app.request('/v0/runs?task_id=task-logs&limit=1', {
      headers: { Authorization: 'Bearer test-token' },
    }, env);

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      data: [
        {
          task_id: 'task-logs',
          project_slug: 'saas-maker',
          status: 'completed',
        },
      ],
    });
  });

  it('starts runs asynchronously by default', async () => {
    const app = createApp({
      async execute() {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { stdout: 'ok\n', stderr: '', exitCode: 0, success: true };
      },
    });
    const env = createEnv();

    const response = await app.request('/v0/runs', {
      method: 'POST',
      body: JSON.stringify({ command: 'echo ok' }),
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
    }, env);

    expect(response.status).toBe(202);
    const payload = await response.json() as { data: { status: string } };
    expect(payload.data.status).toBe('running');
  });

  it('reconciles an existing running run from the stored request', async () => {
    const app = createApp({
      async execute(input) {
        await input.recordEvent({ type: 'agent_process_start', command: input.command });
        await new Promise((resolve) => setTimeout(resolve, 500));
        return { stdout: '', stderr: 'still running', exitCode: 124, success: false };
      },
      async reconcile(input) {
        await input.recordEvent({ type: 'reconcile_finish', command: input.command });
        return { stdout: 'reconciled', stderr: '', exitCode: 0, success: true };
      },
    });
    const env = createEnv();

    const createResponse = await app.request('/v0/runs', {
      method: 'POST',
      body: JSON.stringify({ mode: 'native', provider: 'deepseek', prompt: 'make the change', create_pr: true }),
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
    }, env);
    const createPayload = await createResponse.json() as { data: { id: string } };

    const reconcileResponse = await app.request(`/v0/runs/${createPayload.data.id}/reconcile`, {
      method: 'POST',
      body: JSON.stringify({ wait_for_completion: true }),
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json',
      },
    }, env);

    expect(reconcileResponse.status).toBe(200);
    const reconcilePayload = await reconcileResponse.json() as { data: { status: string; summary: string } };
    expect(reconcilePayload.data.status).toBe('completed');
    expect(reconcilePayload.data.summary).toBe('Command completed with exit code 0.');
  });

  it('fails and cancels runs that exceed the hard Droid timeout', async () => {
    vi.useFakeTimers();
    const cancelCalls: string[] = [];
    const app = createApp({
      async execute(input) {
        await input.recordEvent({ type: 'agent_process_start', command: input.command });
        return new Promise(() => undefined);
      },
      async cancel(input) {
        cancelCalls.push(input.sandboxId);
        await input.recordEvent({
          type: 'sandbox_destroy',
          message: `Destroyed ${input.sandboxId}`,
          metadata: { sandbox_id: input.sandboxId },
        });
      },
    });
    const env = createEnv();

    try {
      const responsePromise = app.request('/v0/runs', {
        method: 'POST',
        body: JSON.stringify({ command: 'sleep forever', timeout_seconds: 60, wait_for_completion: true }),
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      }, env);

      await vi.advanceTimersByTimeAsync(60_001);
      const response = await responsePromise;

      expect(response.status).toBe(201);
      const payload = await response.json() as { data: { id: string; status: string; exit_code: number; error_message: string } };
      expect(payload.data.status).toBe('failed');
      expect(payload.data.exit_code).toBe(124);
      expect(payload.data.error_message).toBe('Droid run timed out after 60 seconds.');
      expect(cancelCalls).toHaveLength(1);

      const eventsResponse = await app.request(`/v0/runs/${payload.data.id}/events`, {
        headers: { Authorization: 'Bearer test-token' },
      }, env);
      const eventsPayload = await eventsResponse.json() as { data: Array<{ type: string }> };
      expect(eventsPayload.data.map((event) => event.type)).toEqual([
        'run_started',
        'run_request',
        'agent_process_start',
        'run_timeout',
        'sandbox_destroy',
        'run_finished',
      ]);
    } finally {
      vi.useRealTimers();
    }
  });
});

function fakeExecutor(): RunExecutor {
  return {
    async execute(input) {
      await input.recordEvent({ type: 'command_start', command: input.command, cwd: '/workspace/repo' });
      await input.recordEvent({
        type: 'command_finish',
        command: input.command,
        cwd: '/workspace/repo',
        exit_code: 0,
        stdout: 'ok\n',
        stderr: '',
      });
      return { stdout: 'ok\n', stderr: '', exitCode: 0, success: true };
    },
  };
}

function createEnv(): Env {
  return {
    DROID_INTERNAL_TOKEN: 'test-token',
    DB: new FakeD1() as unknown as D1Database,
    Sandbox: {} as DurableObjectNamespace,
  };
}

class FakeD1 {
  runs = new Map<string, Record<string, unknown>>();
  events: Record<string, unknown>[] = [];
  artifacts: Record<string, unknown>[] = [];

  prepare(sql: string) {
    return new FakeStatement(this, sql);
  }
}

class FakeStatement {
  private params: unknown[] = [];

  constructor(private db: FakeD1, private sql: string) {}

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  async run() {
    if (this.sql.includes('INSERT INTO droid_runs')) {
      const [
        id,
        task_id,
        project_slug,
        repo_url,
        branch,
        command,
        cwd,
        sandbox_id,
      ] = this.params;
      this.db.runs.set(String(id), {
        id,
        task_id,
        project_slug,
        repo_url,
        branch,
        command,
        cwd,
        sandbox_id,
        status: 'queued',
        exit_code: null,
        duration_ms: null,
        summary: null,
        error_message: null,
        created_at: '2026-05-11 00:00:00',
        started_at: null,
        finished_at: null,
      });
    }

    if (this.sql.includes("SET status = 'running'")) {
      const id = String(this.params[0]);
      Object.assign(this.db.runs.get(id)!, { status: 'running', started_at: '2026-05-11 00:00:01' });
    }

    if (this.sql.includes('SET status = ?, exit_code = ?')) {
      const [status, exit_code, duration_ms, summary, error_message, id] = this.params;
      Object.assign(this.db.runs.get(String(id))!, {
        status,
        exit_code,
        duration_ms,
        summary,
        error_message,
        finished_at: '2026-05-11 00:00:02',
      });
    }

    if (this.sql.includes('INSERT INTO droid_run_events')) {
      const [
        id,
        run_id,
        type,
        actor,
        source,
        message,
        command,
        cwd,
        exit_code,
        stdout,
        stderr,
        metadata,
      ] = this.params;
      this.db.events.push({
        id,
        run_id,
        type,
        actor,
        source,
        message,
        command,
        cwd,
        exit_code,
        stdout,
        stderr,
        metadata,
        created_at: `2026-05-11 00:00:0${this.db.events.length}`,
      });
    }

    if (this.sql.includes('INSERT INTO droid_run_artifacts')) {
      const [
        id,
        run_id,
        type,
        name,
        uri,
        metadata,
      ] = this.params;
      this.db.artifacts.push({
        id,
        run_id,
        type,
        name,
        uri,
        metadata,
        created_at: `2026-05-11 00:00:0${this.db.artifacts.length}`,
      });
    }

    return { success: true };
  }

  async first() {
    if (this.sql.includes("FROM droid_run_events") && this.sql.includes("type = 'run_request'")) {
      const [runId] = this.params;
      const event = this.db.events
        .filter((item) => item.run_id === runId && item.type === 'run_request')
        .at(-1);
      return event ? { metadata: event.metadata } : null;
    }
    if (this.sql.includes('SELECT * FROM droid_run_events WHERE run_id = ?')) {
      const [runId] = this.params;
      return this.db.events.filter((item) => item.run_id === runId).at(-1) ?? null;
    }
    if (this.sql.includes('SELECT * FROM droid_runs WHERE id = ?')) {
      return this.db.runs.get(String(this.params[0])) ?? null;
    }
    return null;
  }

  async all() {
    if (this.sql.includes('SELECT * FROM droid_runs WHERE task_id = ?')) {
      const [taskId, limit] = this.params;
      return {
        results: Array.from(this.db.runs.values())
          .filter((run) => run.task_id === taskId)
          .slice(0, Number(limit)),
      };
    }
    if (this.sql.includes('SELECT * FROM droid_runs WHERE project_slug = ?')) {
      const [projectSlug, limit] = this.params;
      return {
        results: Array.from(this.db.runs.values())
          .filter((run) => run.project_slug === projectSlug)
          .slice(0, Number(limit)),
      };
    }
    if (this.sql.includes('SELECT * FROM droid_runs ORDER BY created_at DESC')) {
      const [limit] = this.params;
      return { results: Array.from(this.db.runs.values()).slice(0, Number(limit)) };
    }
    if (this.sql.includes('SELECT * FROM droid_run_events WHERE run_id = ?')) {
      return { results: this.db.events.filter((event) => event.run_id === this.params[0]) };
    }
    if (this.sql.includes('SELECT * FROM droid_run_artifacts WHERE run_id = ?')) {
      return { results: this.db.artifacts.filter((artifact) => artifact.run_id === this.params[0]) };
    }
    return { results: [] };
  }
}
