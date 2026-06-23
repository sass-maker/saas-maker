import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../packages/cli/src/lib/request.js', () => ({
  requestApi: vi.fn(),
  getResponseError: vi.fn().mockReturnValue('mock error'),
}));

vi.mock('../../packages/cli/src/lib/ui.js', () => ({
  log: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    dim: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../packages/cli/src/lib/output.js', () => ({
  printOutput: vi.fn(),
}));

import {
  projectsListCommand,
  projectsCreateCommand,
  projectsDeleteCommand,
  projectsUpdateCommand,
} from '../../packages/cli/src/commands/projects.js';
import { requestApi } from '../../packages/cli/src/lib/request.js';
import { printOutput } from '../../packages/cli/src/lib/output.js';
import { log } from '../../packages/cli/src/lib/ui.js';

const mocked = requestApi as unknown as ReturnType<typeof vi.fn>;

describe('projects CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

  it('list hits /v1/projects with session auth', async () => {
    mocked.mockResolvedValue({ ok: true, data: { data: [] }, status: 200 });
    await projectsListCommand({ output: 'json' });
    expect(mocked).toHaveBeenCalledWith({ path: '/v1/projects', auth: 'session' });
  });

  it('list prints rows when API returns data', async () => {
    mocked.mockResolvedValue({
      ok: true,
      data: {
        data: [{ id: 'p_1', name: 'Foo', slug: 'foo', api_key: 'pk_1', created_at: '2026-01-01' }],
      },
      status: 200,
    });
    await projectsListCommand({ output: 'json' });
    expect(printOutput).toHaveBeenCalled();
  });

  it('list logs error when API fails', async () => {
    mocked.mockResolvedValue({ ok: false, status: 500 });
    await projectsListCommand({ output: 'json' });
    expect(log.error).toHaveBeenCalled();
  });

  it('create POSTs with the project name', async () => {
    mocked.mockResolvedValue({
      ok: true,
      data: { id: 'p_1', name: 'New', slug: 'new', api_key: 'pk_1' },
      status: 200,
    });
    await projectsCreateCommand({ name: 'New' });
    expect(mocked).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/v1/projects',
        method: 'POST',
        auth: 'session',
        body: { name: 'New' },
      })
    );
  });

  it('delete sends DELETE to the resolved project id', async () => {
    mocked
      .mockResolvedValueOnce({
        ok: true,
        data: { data: [{ id: 'p_1', name: 'Foo', slug: 'foo', api_key: 'pk_1' }] },
        status: 200,
      })
      .mockResolvedValueOnce({ ok: true, data: { ok: true }, status: 200 });

    await projectsDeleteCommand({ id: 'p_1', force: true });

    const calls = mocked.mock.calls.map((c) => c[0]);
    expect(calls.some((c: any) => c.path === '/v1/projects/p_1' && c.method === 'DELETE')).toBe(
      true
    );
  });

  it('update sends PATCH with provided name', async () => {
    mocked
      .mockResolvedValueOnce({
        ok: true,
        data: { data: [{ id: 'p_1', name: 'Foo', slug: 'foo', api_key: 'pk_1' }] },
        status: 200,
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { id: 'p_1', name: 'Renamed', slug: 'foo', api_key: 'pk_1' },
        status: 200,
      });

    await projectsUpdateCommand({ id: 'p_1', name: 'Renamed' });

    const calls = mocked.mock.calls.map((c) => c[0]);
    expect(
      calls.some(
        (c: any) =>
          c.path === '/v1/projects/p_1' && c.method === 'PATCH' && c.body?.name === 'Renamed'
      )
    ).toBe(true);
  });
});
