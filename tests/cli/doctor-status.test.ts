import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../packages/cli/src/lib/request.js', () => ({
  requestApi: vi.fn(),
  getResponseError: vi.fn().mockReturnValue('mock error'),
}));

vi.mock('../../packages/cli/src/lib/ui.js', () => ({
  log: { success: vi.fn(), error: vi.fn(), info: vi.fn(), dim: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../packages/cli/src/lib/output.js', () => ({
  printOutput: vi.fn(),
}));

vi.mock('../../packages/cli/src/lib/config.js', () => ({
  getApiKey: vi.fn().mockReturnValue('sm_test_token'),
  getApiBase: vi.fn().mockReturnValue('https://api.sassmaker.com'),
  getLocalConfig: vi.fn().mockReturnValue({ slug: 'foo', projectId: 'p_1', projectKey: 'pk_1' }),
  getLocalProjectKey: vi.fn().mockReturnValue('pk_1'),
}));

vi.mock('../../packages/cli/src/lib/project.js', () => ({
  requireLinkedProjectId: vi.fn().mockResolvedValue('p_1'),
}));

import { doctorCommand } from '../../packages/cli/src/commands/doctor.js';
import { statusCommand } from '../../packages/cli/src/commands/status.js';
import { requestApi } from '../../packages/cli/src/lib/request.js';
import { printOutput } from '../../packages/cli/src/lib/output.js';

const mockApi = requestApi as unknown as ReturnType<typeof vi.fn>;

describe('doctor + status CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('doctor probes /health with no auth', async () => {
    mockApi.mockResolvedValue({ ok: true, data: { status: 'ok' }, status: 200 });
    await doctorCommand({ output: 'json' });
    const paths = mockApi.mock.calls.map((c) => c[0].path);
    expect(paths).toContain('/health');
    const healthCall = mockApi.mock.calls.find((c) => c[0].path === '/health');
    expect(healthCall?.[0].auth).toBe('none');
  });

  it('doctor prints rows', async () => {
    mockApi.mockResolvedValue({ ok: true, data: { status: 'ok' }, status: 200 });
    await doctorCommand({ output: 'table' });
    expect(printOutput).toHaveBeenCalled();
  });

  it('status probes feedback + waitlist + testimonials + changelog', async () => {
    mockApi.mockResolvedValue({ ok: true, data: { data: [], total: 0, count: 0 }, status: 200 });
    await statusCommand({ quiet: true, output: 'json' });
    const paths = mockApi.mock.calls.map((c) => c[0].path);
    expect(paths).toContain('/v1/feedback');
    expect(paths).toContain('/v1/waitlist/count');
    expect(paths).toContain('/v1/testimonials');
    expect(paths).toContain('/v1/changelog');
  });
});
