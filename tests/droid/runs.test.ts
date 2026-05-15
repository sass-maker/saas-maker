import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../workers/droid/src/app';
import type { Env, RunExecutor } from '../../workers/droid/src/types';

describe('droid runs', () => {
  it('requires the internal bearer token', async () => {
    const app = createApp(fakeExecutor());
    const env = createEnv();

    const response = await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({ command: 'echo ok' }),
        headers: { 'Content-Type': 'application/json' },
      },
      env
    );

    expect(response.status).toBe(401);
  });

  it('validates run input before creating a sandbox run', async () => {
    const app = createApp(fakeExecutor());
    const env = createEnv();

    const response = await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({ repo_url: 'ftp://example.test/repo.git' }),
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      },
      env
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'command is required' });
  });

  it('requires a prompt for agent runs', async () => {
    const app = createApp(fakeExecutor());
    const env = createEnv();

    const response = await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({ mode: 'native', provider: 'deepseek' }),
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      },
      env
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'prompt is required' });
  });

  it('validates acceptance settings before creating a ticket run', async () => {
    const app = createApp(fakeExecutor());
    const env = createEnv();
    const headers = {
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
    };

    const badCommand = await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({
          task_id: 'ticket-bad-acceptance-command',
          command: 'echo ok',
          acceptance_command: 123,
        }),
        headers,
      },
      env
    );
    expect(badCommand.status).toBe(400);
    await expect(badCommand.json()).resolves.toEqual({
      error: 'acceptance_command must be a string',
    });

    const badTimeout = await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({
          task_id: 'ticket-bad-acceptance-timeout',
          command: 'echo ok',
          acceptance_command: 'pnpm test',
          acceptance_timeout_seconds: 12.5,
        }),
        headers,
      },
      env
    );
    expect(badTimeout.status).toBe(400);
    await expect(badTimeout.json()).resolves.toEqual({
      error: 'acceptance_timeout_seconds must be between 30 and 900',
    });
    expect((env.DB as unknown as FakeD1).runs.size).toBe(0);
  });

  it('validates browser acceptance settings before creating a ticket run', async () => {
    const app = createApp(fakeExecutor());
    const env = createEnv();
    const headers = {
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
    };

    const badUrl = await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({
          command: 'echo ok',
          browser_acceptance: { url: 'ftp://example.test' },
        }),
        headers,
      },
      env
    );
    expect(badUrl.status).toBe(400);
    await expect(badUrl.json()).resolves.toEqual({
      error: 'browser_acceptance.url must be an http or https URL',
    });

    const badText = await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({
          command: 'echo ok',
          browser_acceptance: { url: 'https://example.test', assert_text: ['ok', 42] },
        }),
        headers,
      },
      env
    );
    expect(badText.status).toBe(400);
    await expect(badText.json()).resolves.toEqual({
      error: 'browser_acceptance.assert_text must be an array of strings',
    });
    expect((env.DB as unknown as FakeD1).runs.size).toBe(0);
  });

  it('requires a Browser Run binding when browser acceptance is enabled', async () => {
    const app = createApp(fakeExecutor());
    const env = createEnv({ BROWSER: undefined });

    const response = await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({
          command: 'echo ok',
          browser_acceptance: { url: 'https://example.test', assert_text: ['Example'] },
        }),
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      },
      env
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'BROWSER binding is required when browser_acceptance is enabled',
    });
    expect((env.DB as unknown as FakeD1).runs.size).toBe(0);
  });

  it('clamps ticket acceptance timeout settings into the supported range', async () => {
    const seen: Array<{ taskId?: string; acceptanceTimeoutSeconds?: number }> = [];
    const app = createApp({
      async execute(input) {
        seen.push({
          taskId: input.taskId,
          acceptanceTimeoutSeconds: input.acceptanceTimeoutSeconds,
        });
        return { stdout: 'ok\n', stderr: '', exitCode: 0, success: true };
      },
    });
    const env = createEnv();
    const headers = {
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
    };

    await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({
          task_id: 'ticket-low-timeout',
          command: 'echo ok',
          acceptance_command: 'pnpm test',
          acceptance_timeout_seconds: 5,
          wait_for_completion: true,
        }),
        headers,
      },
      env
    );
    await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({
          task_id: 'ticket-high-timeout',
          command: 'echo ok',
          acceptance_command: 'pnpm test',
          acceptance_timeout_seconds: 1200,
          wait_for_completion: true,
        }),
        headers,
      },
      env
    );

    expect(seen).toEqual([
      { taskId: 'ticket-low-timeout', acceptanceTimeoutSeconds: 30 },
      { taskId: 'ticket-high-timeout', acceptanceTimeoutSeconds: 900 },
    ]);
  });

  it('fails native runs before creating a run when DeepSeek is not configured', async () => {
    const app = createApp(fakeExecutor());
    const env = createEnv({ DROID_DEEPSEEK_API_KEY: undefined });

    const response = await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({ mode: 'native', provider: 'deepseek', prompt: 'inspect the repo' }),
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      },
      env
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'DROID_DEEPSEEK_API_KEY is required for native Droid runs',
    });
    expect((env.DB as unknown as FakeD1).runs.size).toBe(0);
  });

  it('fails PR runs before creating a run when GitHub is not configured', async () => {
    const app = createApp(fakeExecutor());
    const env = createEnv({ DROID_GITHUB_TOKEN: undefined });

    const response = await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({ command: 'echo ok', create_pr: true }),
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      },
      env
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'DROID_GITHUB_TOKEN is required when create_pr is true',
    });
    expect((env.DB as unknown as FakeD1).runs.size).toBe(0);
  });

  it('accepts native Droid runs', async () => {
    const app = createApp(fakeExecutor());
    const env = createEnv();

    const response = await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({
          mode: 'native',
          provider: 'deepseek',
          prompt: 'inspect the repo',
          max_turns: 3,
          wait_for_completion: true,
        }),
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      },
      env
    );

    expect(response.status).toBe(201);
    const payload = (await response.json()) as { data: { command: string; status: string } };
    expect(payload.data.command).toBe('native: inspect the repo');
    expect(payload.data.status).toBe('completed');
  });

  it('creates a run and stores detailed events', async () => {
    const app = createApp(fakeExecutor());
    const env = createEnv();

    const response = await app.request(
      '/v0/runs',
      {
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
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      },
      env
    );

    expect(response.status).toBe(201);
    const payload = (await response.json()) as {
      data: { id: string; status: string; exit_code: number };
    };
    expect(payload.data.status).toBe('completed');
    expect(payload.data.exit_code).toBe(0);

    const eventsResponse = await app.request(
      `/v0/runs/${payload.data.id}/events`,
      {
        headers: { Authorization: 'Bearer test-token' },
      },
      env
    );
    expect(eventsResponse.status).toBe(200);
    const eventsPayload = (await eventsResponse.json()) as {
      data: Array<{ type: string; stdout: string | null }>;
    };
    expect(eventsPayload.data.map((event) => event.type)).toEqual([
      'run_request',
      'run_started',
      'command_start',
      'command_finish',
      'run_finished',
    ]);
    expect(eventsPayload.data[3].stdout).toBe('ok\n');
  });

  it('passes task metadata and acceptance settings through to the executor', async () => {
    const seen: Array<{
      taskId?: string;
      projectSlug?: string;
      acceptanceCommand?: string;
      acceptanceTimeoutSeconds?: number;
      browserGoal?: string;
      browserAssertText?: string[];
    }> = [];
    const app = createApp({
      async execute(input) {
        seen.push({
          taskId: input.taskId,
          projectSlug: input.projectSlug,
          acceptanceCommand: input.acceptanceCommand,
          acceptanceTimeoutSeconds: input.acceptanceTimeoutSeconds,
          browserGoal: input.browserAcceptance?.goal,
          browserAssertText: input.browserAcceptance?.assert_text,
        });
        return { stdout: 'ok\n', stderr: '', exitCode: 0, success: true };
      },
    });
    const env = createEnv();

    const response = await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({
          task_id: 'task-blockable',
          project_slug: 'saas-maker',
          command: 'echo ok',
          acceptance_command: 'pnpm test',
          acceptance_timeout_seconds: 120,
          browser_acceptance: {
            goal: 'Verify task UI',
            url: 'https://example.test/tasks',
            assert_text: ['Droid', 'Events'],
            keep_open: true,
          },
          wait_for_completion: true,
        }),
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      },
      env
    );

    expect(response.status).toBe(201);
    expect(seen).toEqual([
      {
        taskId: 'task-blockable',
        projectSlug: 'saas-maker',
        acceptanceCommand: 'pnpm test',
        acceptanceTimeoutSeconds: 120,
        browserGoal: 'Verify task UI',
        browserAssertText: ['Droid', 'Events'],
      },
    ]);
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

    const response = await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({ command: 'echo ok', wait_for_completion: true }),
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      },
      env
    );
    const payload = (await response.json()) as { data: { id: string } };

    const artifactsResponse = await app.request(
      `/v0/runs/${payload.data.id}/artifacts`,
      {
        headers: { Authorization: 'Bearer test-token' },
      },
      env
    );

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

  it('mirrors run events into the live run room when configured', async () => {
    const rooms = new FakeRunRoomNamespace();
    const app = createApp(fakeExecutor());
    const env = createEnv({ DROID_RUN_ROOMS: rooms as unknown as DurableObjectNamespace });

    const response = await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({ command: 'echo ok', wait_for_completion: true }),
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      },
      env
    );
    const payload = (await response.json()) as { data: { id: string } };

    const statusResponse = await app.request(
      `/v0/runs/${payload.data.id}/live-status`,
      {
        headers: { Authorization: 'Bearer test-token' },
      },
      env
    );

    expect(statusResponse.status).toBe(200);
    await expect(statusResponse.json()).resolves.toMatchObject({
      data: {
        run_id: payload.data.id,
        event_count: 5,
        recent_events: expect.arrayContaining([
          expect.objectContaining({ type: 'command_finish' }),
        ]),
      },
    });
  });

  it('lists recent runs by task id', async () => {
    const app = createApp(fakeExecutor());
    const env = createEnv();

    const response = await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({
          task_id: 'task-logs',
          project_slug: 'saas-maker',
          command: 'echo ok',
          wait_for_completion: true,
        }),
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      },
      env
    );
    expect(response.status).toBe(201);

    const listResponse = await app.request(
      '/v0/runs?task_id=task-logs&limit=1',
      {
        headers: { Authorization: 'Bearer test-token' },
      },
      env
    );

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

  it('reports run stats for cockpit health views', async () => {
    const app = createApp({
      async execute(input) {
        if (input.command === 'hang') return new Promise(() => undefined);
        if (input.command === 'fail')
          return { stdout: '', stderr: 'nope', exitCode: 1, success: false };
        return { stdout: 'ok\n', stderr: '', exitCode: 0, success: true };
      },
    });
    const env = createEnv();
    const headers = {
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
    };

    await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({
          project_slug: 'saas-maker',
          command: 'pass',
          wait_for_completion: true,
        }),
        headers,
      },
      env
    );
    await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({
          project_slug: 'saas-maker',
          command: 'fail',
          wait_for_completion: true,
        }),
        headers,
      },
      env
    );
    await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({ project_slug: 'saas-maker', command: 'hang' }),
        headers,
      },
      env
    );

    const response = await app.request(
      '/v0/stats?project_slug=saas-maker&limit=2',
      {
        headers: { Authorization: 'Bearer test-token' },
      },
      env
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        total: 3,
        by_status: {
          queued: 0,
          running: 1,
          completed: 1,
          failed: 1,
        },
        stale_running: 1,
        idle_running: 1,
        estimated_compute_seconds: expect.any(Number),
        recent: expect.arrayContaining([expect.objectContaining({ project_slug: 'saas-maker' })]),
      },
    });
  });

  it('does not count active runs with fresh events as stale', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-14T12:00:00.000Z'));
    const app = createApp({
      async execute(input) {
        await input.recordEvent({ type: 'agent_process_start', command: input.command });
        return new Promise(() => undefined);
      },
    });
    const env = createEnv();

    try {
      const runResponse = await app.request(
        '/v0/runs',
        {
          method: 'POST',
          body: JSON.stringify({ project_slug: 'saas-maker', command: 'hang' }),
          headers: {
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          },
        },
        env
      );
      const runPayload = (await runResponse.json()) as { data: { id: string } };
      const db = env.DB as unknown as FakeD1;
      const latestEvent = db.events.filter((event) => event.run_id === runPayload.data.id).at(-1);
      latestEvent!.created_at = '2026-05-14T11:59:00.000Z';

      const statsResponse = await app.request(
        '/v0/stats?project_slug=saas-maker',
        {
          headers: { Authorization: 'Bearer test-token' },
        },
        env
      );

      expect(statsResponse.status).toBe(200);
      await expect(statsResponse.json()).resolves.toMatchObject({
        data: {
          by_status: { running: 1 },
          stale_running: 0,
          idle_running: 0,
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('queues same-repo runs when another run is active', async () => {
    let executeCalls = 0;
    const app = createApp({
      async execute() {
        executeCalls += 1;
        return new Promise(() => undefined);
      },
    });
    const env = createEnv();
    const headers = {
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
    };

    const firstResponse = await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({
          project_slug: 'saas-maker',
          repo_url: 'https://github.com/example/repo.git',
          command: 'first',
        }),
        headers,
      },
      env
    );
    expect(firstResponse.status).toBe(202);
    const firstPayload = (await firstResponse.json()) as { data: { id: string; status: string } };
    expect(firstPayload.data.status).toBe('running');

    const secondResponse = await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({
          project_slug: 'saas-maker',
          repo_url: 'https://github.com/example/repo.git',
          command: 'second',
          wait_for_completion: true,
        }),
        headers,
      },
      env
    );

    expect(secondResponse.status).toBe(202);
    const secondPayload = (await secondResponse.json()) as {
      data: { id: string; status: string };
      queued_after: string;
    };
    expect(secondPayload.data.status).toBe('queued');
    expect(secondPayload.queued_after).toBe(firstPayload.data.id);
    expect(executeCalls).toBe(1);

    const eventsResponse = await app.request(
      `/v0/runs/${secondPayload.data.id}/events`,
      {
        headers: { Authorization: 'Bearer test-token' },
      },
      env
    );
    const eventsPayload = (await eventsResponse.json()) as { data: Array<{ type: string }> };
    expect(eventsPayload.data.map((event) => event.type)).toEqual(['run_request', 'run_queued']);
  });

  it('auto-dequeues a queued same-repo run after the active run finishes', async () => {
    let releaseFirst: (() => void) | undefined;
    const executeCommands: string[] = [];
    const acceptanceCommands: Array<string | undefined> = [];
    const app = createApp({
      async execute(input) {
        executeCommands.push(input.command);
        acceptanceCommands.push(input.acceptanceCommand);
        if (input.command === 'first') {
          await new Promise<void>((resolve) => {
            releaseFirst = resolve;
          });
        }
        return { stdout: `${input.command}\n`, stderr: '', exitCode: 0, success: true };
      },
    });
    const env = createEnv();
    const headers = {
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
    };

    const firstResponsePromise = app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({
          project_slug: 'saas-maker',
          repo_url: 'https://github.com/example/repo.git',
          command: 'first',
          wait_for_completion: true,
        }),
        headers,
      },
      env
    );
    while (!releaseFirst) await Promise.resolve();

    const queuedResponse = await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({
          task_id: 'ticket-queued-acceptance',
          project_slug: 'saas-maker',
          repo_url: 'https://github.com/example/repo.git',
          command: 'second',
          acceptance_command: 'pnpm test -- ticket-queued-acceptance',
        }),
        headers,
      },
      env
    );
    const queuedPayload = (await queuedResponse.json()) as { data: { id: string; status: string } };
    expect(queuedPayload.data.status).toBe('queued');

    releaseFirst();
    await firstResponsePromise;
    for (let i = 0; i < 25 && executeCommands.length < 2; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const dequeuedResponse = await app.request(
      `/v0/runs/${queuedPayload.data.id}`,
      {
        headers: { Authorization: 'Bearer test-token' },
      },
      env
    );
    const dequeuedPayload = (await dequeuedResponse.json()) as {
      data: { status: string; exit_code: number };
    };
    expect(dequeuedPayload.data.status).toBe('completed');
    expect(dequeuedPayload.data.exit_code).toBe(0);
    expect(executeCommands).toEqual(['first', 'second']);
    expect(acceptanceCommands).toEqual([undefined, 'pnpm test -- ticket-queued-acceptance']);

    const eventsResponse = await app.request(
      `/v0/runs/${queuedPayload.data.id}/events`,
      {
        headers: { Authorization: 'Bearer test-token' },
      },
      env
    );
    const eventsPayload = (await eventsResponse.json()) as { data: Array<{ type: string }> };
    expect(eventsPayload.data.map((event) => event.type)).toEqual([
      'run_request',
      'run_queued',
      'run_dequeued',
      'run_started',
      'run_finished',
    ]);
  });

  it('marks stale running runs failed and releases the repo queue', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-14T12:00:00.000Z'));
    const executeCommands: string[] = [];
    const app = createApp({
      async execute(input) {
        executeCommands.push(input.command);
        if (input.command === 'first') return new Promise(() => undefined);
        return { stdout: `${input.command}\n`, stderr: '', exitCode: 0, success: true };
      },
    });
    const env = createEnv();
    const headers = {
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
    };

    try {
      const firstResponse = await app.request(
        '/v0/runs',
        {
          method: 'POST',
          body: JSON.stringify({
            project_slug: 'saas-maker',
            repo_url: 'https://github.com/example/repo.git',
            command: 'first',
          }),
          headers,
        },
        env
      );
      const firstPayload = (await firstResponse.json()) as { data: { id: string } };

      const queuedResponse = await app.request(
        '/v0/runs',
        {
          method: 'POST',
          body: JSON.stringify({
            project_slug: 'saas-maker',
            repo_url: 'https://github.com/example/repo.git',
            command: 'second',
          }),
          headers,
        },
        env
      );
      const queuedPayload = (await queuedResponse.json()) as { data: { id: string } };

      const staleResponse = await app.request(
        `/v0/runs/${firstPayload.data.id}/mark-stale`,
        {
          method: 'POST',
          body: JSON.stringify({ wait_for_dispatch: true }),
          headers,
        },
        env
      );

      expect(staleResponse.status).toBe(200);
      await expect(staleResponse.json()).resolves.toMatchObject({
        data: {
          status: 'failed',
          exit_code: 124,
          error_message: 'Droid run marked stale after no recent activity.',
        },
        marked_stale: true,
      });

      const queuedRunResponse = await app.request(
        `/v0/runs/${queuedPayload.data.id}`,
        {
          headers: { Authorization: 'Bearer test-token' },
        },
        env
      );
      await expect(queuedRunResponse.json()).resolves.toMatchObject({
        data: {
          status: 'completed',
          exit_code: 0,
        },
      });
      expect(executeCommands).toEqual(['first', 'second']);

      const firstEventsResponse = await app.request(
        `/v0/runs/${firstPayload.data.id}/events`,
        {
          headers: { Authorization: 'Bearer test-token' },
        },
        env
      );
      const firstEventsPayload = (await firstEventsResponse.json()) as {
        data: Array<{ type: string }>;
      };
      expect(firstEventsPayload.data.map((event) => event.type)).toContain('run_marked_stale');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reaps stale running runs in batches', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-14T12:00:00.000Z'));
    const app = createApp({
      async execute() {
        return new Promise(() => undefined);
      },
    });
    const env = createEnv();
    const headers = {
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
    };

    try {
      const runResponse = await app.request(
        '/v0/runs',
        {
          method: 'POST',
          body: JSON.stringify({ project_slug: 'saas-maker', command: 'hang' }),
          headers,
        },
        env
      );
      const runPayload = (await runResponse.json()) as { data: { id: string } };
      const response = await app.request(
        '/v0/runs/reap-stale',
        {
          method: 'POST',
          body: JSON.stringify({ project_slug: 'saas-maker', wait_for_dispatch: true }),
          headers,
        },
        env
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        data: { reaped: 1, run_ids: [runPayload.data.id] },
      });
      expect((env.DB as unknown as FakeD1).runs.get(runPayload.data.id)?.status).toBe('failed');
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts runs asynchronously by default', async () => {
    const app = createApp({
      async execute() {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { stdout: 'ok\n', stderr: '', exitCode: 0, success: true };
      },
    });
    const env = createEnv();

    const response = await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({ command: 'echo ok' }),
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      },
      env
    );

    expect(response.status).toBe(202);
    const payload = (await response.json()) as { data: { status: string } };
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

    const createResponse = await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({
          mode: 'native',
          provider: 'deepseek',
          prompt: 'make the change',
          create_pr: true,
        }),
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      },
      env
    );
    const createPayload = (await createResponse.json()) as { data: { id: string } };

    const reconcileResponse = await app.request(
      `/v0/runs/${createPayload.data.id}/reconcile`,
      {
        method: 'POST',
        body: JSON.stringify({ wait_for_completion: true }),
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      },
      env
    );

    expect(reconcileResponse.status).toBe(200);
    const reconcilePayload = (await reconcileResponse.json()) as {
      data: { status: string; summary: string };
    };
    expect(reconcilePayload.data.status).toBe('completed');
    expect(reconcilePayload.data.summary).toBe('Command completed with exit code 0.');
  });

  it('stores the first useful failure line in failed run summaries', async () => {
    const app = createApp({
      async execute() {
        return {
          stdout: 'preflight started\n',
          stderr: '\nError: package build failed\nmore details',
          exitCode: 1,
          success: false,
        };
      },
    });
    const env = createEnv();

    const response = await app.request(
      '/v0/runs',
      {
        method: 'POST',
        body: JSON.stringify({ command: 'pnpm build', wait_for_completion: true }),
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      },
      env
    );

    expect(response.status).toBe(201);
    const payload = (await response.json()) as { data: { status: string; summary: string } };
    expect(payload.data.status).toBe('failed');
    expect(payload.data.summary).toBe('Command failed with exit code 1: Error: package build failed');
  });

  it('uses live run room activity to guard reconcile', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-14T12:00:00.000Z'));
    const rooms = new FakeRunRoomNamespace({ createdAt: () => new Date().toISOString() });
    const app = createApp({
      async execute(input) {
        await input.recordEvent({ type: 'agent_process_start', command: input.command });
        return new Promise(() => undefined);
      },
      async reconcile() {
        return { stdout: 'reconciled', stderr: '', exitCode: 0, success: true };
      },
    });
    const env = createEnv({ DROID_RUN_ROOMS: rooms as unknown as DurableObjectNamespace });

    try {
      const createResponse = await app.request(
        '/v0/runs',
        {
          method: 'POST',
          body: JSON.stringify({ command: 'sleep forever' }),
          headers: {
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          },
        },
        env
      );
      const createPayload = (await createResponse.json()) as { data: { id: string } };

      const reconcileResponse = await app.request(
        `/v0/runs/${createPayload.data.id}/reconcile`,
        {
          method: 'POST',
          body: JSON.stringify({ wait_for_completion: true }),
          headers: {
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          },
        },
        env
      );

      expect(reconcileResponse.status).toBe(409);
      await expect(reconcileResponse.json()).resolves.toMatchObject({
        latest_event_source: 'run_room',
      });
    } finally {
      vi.useRealTimers();
    }
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
      const responsePromise = app.request(
        '/v0/runs',
        {
          method: 'POST',
          body: JSON.stringify({
            command: 'sleep forever',
            timeout_seconds: 60,
            wait_for_completion: true,
          }),
          headers: {
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          },
        },
        env
      );

      await vi.advanceTimersByTimeAsync(60_001);
      const response = await responsePromise;

      expect(response.status).toBe(201);
      const payload = (await response.json()) as {
        data: { id: string; status: string; exit_code: number; error_message: string };
      };
      expect(payload.data.status).toBe('failed');
      expect(payload.data.exit_code).toBe(124);
      expect(payload.data.error_message).toBe('Droid run timed out after 60 seconds.');
      expect(cancelCalls).toHaveLength(1);

      const eventsResponse = await app.request(
        `/v0/runs/${payload.data.id}/events`,
        {
          headers: { Authorization: 'Bearer test-token' },
        },
        env
      );
      const eventsPayload = (await eventsResponse.json()) as { data: Array<{ type: string }> };
      expect(eventsPayload.data.map((event) => event.type)).toEqual([
        'run_request',
        'run_started',
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
      await input.recordEvent({
        type: 'command_start',
        command: input.command,
        cwd: '/workspace/repo',
      });
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

function createEnv(overrides: Partial<Env> = {}): Env {
  return {
    DROID_INTERNAL_TOKEN: 'test-token',
    DROID_DEEPSEEK_API_KEY: 'test-deepseek-key',
    DROID_GITHUB_TOKEN: 'test-github-token',
    BROWSER: { fetch },
    DB: new FakeD1() as unknown as D1Database,
    Sandbox: {} as DurableObjectNamespace,
    ...overrides,
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

class FakeRunRoomNamespace {
  private rooms = new Map<string, FakeRunRoom>();

  constructor(private options: { createdAt?: (index: number) => string } = {}) {}

  getByName(name: string) {
    let room = this.rooms.get(name);
    if (!room) {
      room = new FakeRunRoom(name, this.options);
      this.rooms.set(name, room);
    }
    return room;
  }
}

class FakeRunRoom {
  private events: Array<Record<string, unknown>> = [];

  constructor(
    private runId: string,
    private options: { createdAt?: (index: number) => string } = {}
  ) {}

  async recordEvent(input: { runId: string; event: { type: string } & Record<string, unknown> }) {
    const index = this.events.length;
    const event = {
      id: `event-${index}`,
      run_id: input.runId,
      ...input.event,
      created_at: this.options.createdAt?.(index) ?? `2026-05-11T00:00:0${index}.000Z`,
    };
    this.events.push(event);
    return event;
  }

  async getStatus() {
    return {
      run_id: this.runId,
      last_event_at: this.events.at(-1)?.created_at ?? null,
      event_count: this.events.length,
      recent_events: this.events,
    };
  }
}

class FakeStatement {
  private params: unknown[] = [];

  constructor(
    private db: FakeD1,
    private sql: string
  ) {}

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  async run() {
    if (this.sql.includes('INSERT INTO droid_runs')) {
      const [id, task_id, project_slug, repo_url, branch, command, cwd, sandbox_id] = this.params;
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
      Object.assign(this.db.runs.get(id)!, {
        status: 'running',
        started_at: '2026-05-11 00:00:01',
      });
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
      const [id, run_id, type, name, uri, metadata] = this.params;
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
    if (this.sql.includes('SELECT AVG(duration_ms) AS avg_duration_ms FROM droid_runs')) {
      const projectSlug = this.params.length > 0 ? this.params[0] : undefined;
      const durations = Array.from(this.db.runs.values())
        .filter((run) => projectSlug === undefined || run.project_slug === projectSlug)
        .map((run) => run.duration_ms)
        .filter((duration): duration is number => typeof duration === 'number');
      return {
        avg_duration_ms:
          durations.length === 0
            ? null
            : durations.reduce((sum, duration) => sum + duration, 0) / durations.length,
      };
    }
    if (this.sql.includes('SELECT COUNT(*) AS count FROM droid_runs')) {
      const projectSlug = this.params.length > 0 ? this.params[0] : undefined;
      return {
        count: Array.from(this.db.runs.values())
          .filter((run) => projectSlug === undefined || run.project_slug === projectSlug)
          .filter((run) => run.status === 'running' && run.started_at)
          .filter((run) => isStaleFakeRun(this.db, run)).length,
      };
    }
    if (this.sql.includes('SELECT COALESCE(SUM(duration_ms), 0) AS total_duration_ms FROM droid_runs')) {
      const projectSlug = this.params.length > 0 ? this.params[0] : undefined;
      return {
        total_duration_ms: Array.from(this.db.runs.values())
          .filter((run) => projectSlug === undefined || run.project_slug === projectSlug)
          .reduce((sum, run) => sum + (typeof run.duration_ms === 'number' ? run.duration_ms : 0), 0),
      };
    }
    if (this.sql.includes('FROM droid_run_events') && this.sql.includes("type = 'run_request'")) {
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
    if (
      this.sql.includes('FROM droid_runs') &&
      this.sql.includes('id != ?') &&
      (this.sql.includes("status = 'running'") || this.sql.includes("status = 'queued'"))
    ) {
      const [queueValue, excludeRunId] = this.params;
      const key = this.sql.includes('repo_url = ?') ? 'repo_url' : 'project_slug';
      const status = this.sql.includes("status = 'queued'") ? 'queued' : 'running';
      return (
        Array.from(this.db.runs.values()).find(
          (run) => run[key] === queueValue && run.status === status && run.id !== excludeRunId
        ) ?? null
      );
    }
    if (this.sql.includes('SELECT * FROM droid_runs WHERE id = ?')) {
      return this.db.runs.get(String(this.params[0])) ?? null;
    }
    return null;
  }

  async all() {
    if (this.sql.includes('SELECT status, COUNT(*) AS count FROM droid_runs')) {
      const projectSlug = this.params.length > 0 ? this.params[0] : undefined;
      const counts = new Map<string, number>();
      for (const run of this.db.runs.values()) {
        if (projectSlug !== undefined && run.project_slug !== projectSlug) continue;
        const status = String(run.status);
        counts.set(status, (counts.get(status) ?? 0) + 1);
      }
      return {
        results: Array.from(counts.entries()).map(([status, count]) => ({ status, count })),
      };
    }
    if (this.sql.includes('SELECT * FROM droid_runs WHERE task_id = ?')) {
      const [taskId, limit] = this.params;
      return {
        results: Array.from(this.db.runs.values())
          .filter((run) => run.task_id === taskId)
          .slice(0, Number(limit)),
      };
    }
    if (
      this.sql.includes('SELECT * FROM droid_runs') &&
      this.sql.includes("status = 'running'") &&
      this.sql.includes("'+15 minutes'")
    ) {
      const hasProjectFilter = this.sql.includes('project_slug = ?');
      const projectSlug = hasProjectFilter ? this.params[0] : undefined;
      const limit = Number(hasProjectFilter ? this.params[1] : this.params[0]);
      return {
        results: Array.from(this.db.runs.values())
          .filter((run) => projectSlug === undefined || run.project_slug === projectSlug)
          .filter((run) => run.status === 'running' && run.started_at)
          .filter((run) => isStaleFakeRun(this.db, run))
          .slice(0, limit),
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
      return {
        results: this.db.artifacts.filter((artifact) => artifact.run_id === this.params[0]),
      };
    }
    return { results: [] };
  }
}

function isStaleFakeRun(db: FakeD1, run: Record<string, unknown>): boolean {
  const runEvents = db.events.filter((event) => event.run_id === run.id);
  const latestEventTime = Math.max(
    ...runEvents.map((event) => parseFakeTimestamp(String(event.created_at)))
  );
  const startedAt = parseFakeTimestamp(String(run.started_at));
  const latestActivity = Number.isFinite(latestEventTime) ? latestEventTime : startedAt;
  return Date.now() - latestActivity >= 15 * 60 * 1000;
}

function parseFakeTimestamp(value: string): number {
  if (value.includes('T')) return Date.parse(value);
  return Date.parse(`${value.replace(' ', 'T')}Z`);
}
