import { describe, expect, it, vi } from 'vitest';
import { runAcceptanceCommand } from '../../workers/droid/src/acceptance';
import type { RunArtifactInput, RunEventInput, RunExecutionInput } from '../../workers/droid/src/types';

describe('droid acceptance command', () => {
  it('records acceptance pass evidence', async () => {
    const events: RunEventInput[] = [];
    const artifacts: RunArtifactInput[] = [];
    const exec = vi.fn(async () => ({ stdout: 'ok\n', stderr: '', exitCode: 0, success: true }));

    const result = await runAcceptanceCommand(
      createInput(events, artifacts),
      { exec },
      '/workspace/repo',
      'pnpm test',
      120
    );

    expect(result.passed).toBe(true);
    expect(exec).toHaveBeenCalledWith("cd '/workspace/repo' && pnpm test", { timeout: 120000 });
    expect(events.map((event) => event.type)).toEqual(['acceptance_start', 'acceptance_passed']);
    expect(artifacts).toEqual([
      expect.objectContaining({
        type: 'acceptance',
        name: 'Droid acceptance report',
      }),
    ]);
  });

  it('records acceptance failure evidence', async () => {
    const events: RunEventInput[] = [];
    const artifacts: RunArtifactInput[] = [];
    const exec = vi.fn(async () => ({
      stdout: '',
      stderr: 'failed\n',
      exitCode: 1,
      success: false,
    }));

    const result = await runAcceptanceCommand(
      createInput(events, artifacts),
      { exec },
      '/workspace/repo',
      'pnpm test'
    );

    expect(result.passed).toBe(false);
    expect(result.summary).toBe('Acceptance command failed with exit code 1.');
    expect(events.map((event) => event.type)).toEqual(['acceptance_start', 'acceptance_failed']);
  });

  it('clamps acceptance command timeouts to the worker limits', async () => {
    const events: RunEventInput[] = [];
    const artifacts: RunArtifactInput[] = [];
    const exec = vi.fn(async () => ({ stdout: 'ok\n', stderr: '', exitCode: 0, success: true }));

    await runAcceptanceCommand(
      createInput(events, artifacts),
      { exec },
      '/workspace/repo',
      'echo lower',
      5
    );
    await runAcceptanceCommand(
      createInput(events, artifacts),
      { exec },
      '/workspace/repo',
      'echo upper',
      1200
    );

    expect(exec).toHaveBeenNthCalledWith(1, "cd '/workspace/repo' && echo lower", {
      timeout: 30000,
    });
    expect(exec).toHaveBeenNthCalledWith(2, "cd '/workspace/repo' && echo upper", {
      timeout: 900000,
    });
  });
});

function createInput(
  events: RunEventInput[],
  artifacts: RunArtifactInput[]
): RunExecutionInput {
  return {
    env: {
      DROID_INTERNAL_TOKEN: 'test-token',
      DB: {} as D1Database,
      Sandbox: {} as DurableObjectNamespace,
    },
    runId: 'run-1',
    sandboxId: 'droid-run-1',
    command: 'echo ok',
    mode: 'command',
    createPr: false,
    timeoutSeconds: 900,
    destroyAfterRun: true,
    recordEvent: async (event) => {
      events.push(event);
    },
    recordArtifact: async (artifact) => {
      artifacts.push(artifact);
    },
  };
}
