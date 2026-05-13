import { describe, expect, it, vi } from 'vitest';
import { captureGitPatch } from '../../workers/droid/src/patch';
import type { RunArtifactInput, RunEventInput, RunExecutor } from '../../workers/droid/src/types';

describe('droid patch capture', () => {
  it('records a patch artifact when the sandbox repo changed', async () => {
    const exec = vi.fn(async (command: string) => {
      if (command.includes('rev-parse --is-inside-work-tree')) return ok('true\n');
      if (command.includes('add -N .')) return ok();
      if (command.includes('status --short')) return ok(' M README.md\n');
      if (command.includes('diff HEAD --stat')) return ok(' README.md | 1 +\n');
      if (command.includes('diff HEAD --patch')) return ok('diff --git a/README.md b/README.md\n');
      return ok();
    });
    const events: RunEventInput[] = [];
    const artifacts: RunArtifactInput[] = [];

    await captureGitPatch(createInput(events, artifacts), { exec }, '/workspace/repo', ok('done\n'));

    expect(events).toEqual([
      expect.objectContaining({
        type: 'patch_captured',
        stdout: 'diff --git a/README.md b/README.md\n',
      }),
    ]);
    expect(artifacts).toEqual([
      expect.objectContaining({
        type: 'patch',
        name: 'git.diff',
        uri: 'event://runs/run-1/patch_captured',
      }),
    ]);
  });

  it('records an empty patch event when no files changed', async () => {
    const exec = vi.fn(async (command: string) => {
      if (command.includes('rev-parse --is-inside-work-tree')) return ok('true\n');
      return ok();
    });
    const events: RunEventInput[] = [];
    const artifacts: RunArtifactInput[] = [];

    await captureGitPatch(createInput(events, artifacts), { exec }, '/workspace/repo', ok());

    expect(events).toEqual([
      expect.objectContaining({
        type: 'patch_empty',
      }),
    ]);
    expect(artifacts).toEqual([]);
  });
});

function createInput(events: RunEventInput[], artifacts: RunArtifactInput[]): Parameters<RunExecutor['execute']>[0] {
  return {
    env: {
      DROID_INTERNAL_TOKEN: 'test-token',
      DB: {} as D1Database,
      Sandbox: {} as DurableObjectNamespace,
    },
    runId: 'run-1',
    sandboxId: 'droid-run-1',
    repoUrl: 'https://github.com/example/repo.git',
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

function ok(stdout = '', stderr = '') {
  return { stdout, stderr, exitCode: 0, success: true };
}
