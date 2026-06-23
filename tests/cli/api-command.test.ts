import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../packages/cli/src/lib/request.js', () => ({
  requestApi: vi.fn(),
  getResponseError: vi.fn(),
}));

vi.mock('../../packages/cli/src/lib/ui.js', () => ({
  log: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    dim: vi.fn(),
  },
}));

vi.mock('../../packages/cli/src/lib/output.js', () => ({
  printOutput: vi.fn(),
}));

import { apiCommand } from '../../packages/cli/src/commands/api.js';
import { printOutput } from '../../packages/cli/src/lib/output.js';
import { requestApi, getResponseError } from '../../packages/cli/src/lib/request.js';
import { log } from '../../packages/cli/src/lib/ui.js';

describe('apiCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

  it('rejects unsupported methods', async () => {
    await apiCommand('TRACE', '/v1/projects', {});
    expect(log.error).toHaveBeenCalledWith(
      'Unsupported method "TRACE". Use GET, POST, PUT, PATCH, or DELETE.'
    );
    expect(requestApi).not.toHaveBeenCalled();
  });

  it('rejects invalid JSON body', async () => {
    await apiCommand('POST', '/v1/feedback', { body: '{"broken":' });
    expect(log.error).toHaveBeenCalledWith('Request body must be valid JSON.');
    expect(requestApi).not.toHaveBeenCalled();
  });

  it('rejects body with GET', async () => {
    await apiCommand('GET', '/v1/projects', { body: '{"name":"x"}' });
    expect(log.error).toHaveBeenCalledWith(
      'Method GET should not be used with --body/--body-file.'
    );
    expect(requestApi).not.toHaveBeenCalled();
  });

  it('rejects paths not in OpenAPI by default', async () => {
    await apiCommand('GET', '/v1/not-a-real-route', {});
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('is not in OpenAPI spec'));
    expect(requestApi).not.toHaveBeenCalled();
  });

  it('allows unknown paths when validation is disabled', async () => {
    vi.mocked(requestApi).mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://api.example.com/v1/not-a-real-route',
      data: { ok: true },
      text: undefined,
    });

    await apiCommand('GET', '/v1/not-a-real-route', { validate: false, quiet: true });
    expect(requestApi).toHaveBeenCalled();
  });

  it('passes parsed query/header/body to requestApi', async () => {
    vi.mocked(requestApi).mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://api.example.com/v1/feedback?page=1&type=bug',
      data: { data: [{ id: 'fb_1' }] },
      text: undefined,
    });

    await apiCommand('POST', '/v1/feedback', {
      auth: 'project',
      projectKey: 'pk_test',
      query: ['page=1', 'type=bug'],
      header: ['X-Test=123'],
      body: '{"title":"Bug"}',
      output: 'json',
      quiet: true,
    });

    expect(requestApi).toHaveBeenCalledWith({
      method: 'POST',
      path: '/v1/feedback',
      auth: 'project',
      query: { page: '1', type: 'bug' },
      headers: { 'X-Test': '123' },
      body: { title: 'Bug' },
      token: undefined,
      projectKey: 'pk_test',
    });
    expect(printOutput).toHaveBeenCalledWith(
      { data: [{ id: 'fb_1' }] },
      { output: 'json', select: undefined, raw: undefined }
    );
  });

  it('prints actionable error for non-2xx response', async () => {
    vi.mocked(requestApi).mockResolvedValue({
      ok: false,
      status: 401,
      url: 'https://api.example.com/v1/projects',
      data: { error: 'Unauthorized' },
      text: undefined,
    });
    vi.mocked(getResponseError).mockReturnValue('Unauthorized');

    await apiCommand('GET', '/v1/projects', { quiet: true });

    expect(log.error).toHaveBeenCalledWith('HTTP 401: Unauthorized');
    expect(process.exitCode).toBe(1);
  });
});
