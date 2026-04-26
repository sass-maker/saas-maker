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

vi.mock('../../packages/cli/src/lib/fleet.js', () => ({
  getLocalFleet: vi.fn().mockReturnValue([
    { name: 'app-a', path: '/tmp/fleet/a', slug: 'a', type: 'next', isLegacy: false, lastModified: '2026-01-01' },
    { name: 'app-b', path: '/tmp/fleet/b', slug: 'b', type: 'vite', isLegacy: false, lastModified: '2026-01-01' },
  ]),
}));

vi.mock('../../packages/cli/src/lib/auditor.js', () => ({
  auditProject: vi.fn().mockReturnValue([
    { check: 'Foundry Config', status: 'pass', detail: 'foundry.json present' },
  ]),
}));

vi.mock('../../packages/cli/src/lib/forge.js', () => ({
  applyStandard: vi.fn(),
  scaffoldRenovate: vi.fn(),
  scaffoldCI: vi.fn(),
  scaffoldHusky: vi.fn(),
  detectProjectType: vi.fn().mockReturnValue('next'),
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn().mockReturnValue('OK'),
  spawn: vi.fn().mockReturnValue({ on: vi.fn() }),
}));

vi.mock('node:fs', async () => {
  const real = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...real,
    existsSync: vi.fn().mockReturnValue(false),
    renameSync: vi.fn(),
  };
});

import {
  fleetListCommand,
  fleetAuditCommand,
  fleetFixCommand,
  fleetSecretsSyncCommand,
} from '../../packages/cli/src/commands/fleet.js';
import { requestApi } from '../../packages/cli/src/lib/request.js';
import { applyStandard, scaffoldHusky } from '../../packages/cli/src/lib/forge.js';
import { printOutput } from '../../packages/cli/src/lib/output.js';

const mockApi = requestApi as unknown as ReturnType<typeof vi.fn>;

describe('fleet CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list does not crash for non-empty fleet', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await fleetListCommand();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('audit runs auditor over every project and prints summary', async () => {
    await fleetAuditCommand();
    expect(printOutput).toHaveBeenCalled();
  });

  it('fix calls applyStandard + scaffoldHusky per project', async () => {
    mockApi.mockResolvedValue({ ok: true, data: { eslint_rules: {}, tsconfig_options: {}, prettier_options: {} } });
    await fleetFixCommand();
    expect(applyStandard).toHaveBeenCalledTimes(2);
    expect(scaffoldHusky).toHaveBeenCalledTimes(2);
  });

  it('fix fetches remote standards once per project type', async () => {
    mockApi.mockResolvedValue({ ok: true, data: { eslint_rules: {} } });
    await fleetFixCommand();
    const paths = mockApi.mock.calls.map((c) => c[0].path);
    expect(paths).toContain('/v1/standards/next');
    // detectProjectType is stubbed, every project resolves to next, so we
    // expect a single fetch rather than one per project.
    expect(paths.filter((p) => p === '/v1/standards/next')).toHaveLength(1);
  });

  it('secrets-sync hits /v1/secrets with session auth', async () => {
    mockApi.mockResolvedValue({ ok: true, data: { data: [] } });
    await fleetSecretsSyncCommand();
    expect(mockApi).toHaveBeenCalledWith({ path: '/v1/secrets', auth: 'session' });
  });
});
