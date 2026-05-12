import type { CommandResult, RunExecutor } from './types';

type SandboxLike = {
  exec(command: string, options?: { timeout?: number }): Promise<CommandResult>;
};

export interface PatchCaptureResult {
  changed: boolean;
  patchBytes: number;
  status: string;
  stat: string;
}

export async function captureGitPatch(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: SandboxLike,
  workspace: string,
  result: CommandResult
): Promise<PatchCaptureResult> {
  if (!input.repoUrl) return emptyPatch();

  try {
    const gitCheck = await sandbox.exec(`git -C ${quote(workspace)} rev-parse --is-inside-work-tree`, { timeout: 10000 });
    if (!gitCheck.success) {
      await input.recordEvent({
        type: 'patch_capture_skipped',
        source: 'sandbox',
        message: 'Workspace is not a git repository.',
        exit_code: gitCheck.exitCode,
        stderr: gitCheck.stderr,
      });
      return emptyPatch();
    }

    await sandbox.exec(`git -C ${quote(workspace)} add -N .`, { timeout: 10000 });
    const status = await sandbox.exec(`git -C ${quote(workspace)} status --short`, { timeout: 10000 });
    const changed = status.stdout.trim().length > 0;

    if (!changed) {
      await input.recordEvent({
        type: 'patch_empty',
        source: 'sandbox',
        message: 'No repository changes were produced.',
        command: 'git status --short',
        cwd: workspace,
        exit_code: status.exitCode,
        stdout: status.stdout,
        stderr: status.stderr,
        metadata: { run_exit_code: result.exitCode, run_success: result.success },
      });
      return { changed: false, patchBytes: 0, status: status.stdout, stat: '' };
    }

    const stat = await sandbox.exec(`git -C ${quote(workspace)} diff HEAD --stat -- .`, { timeout: 30000 });
    const diff = await sandbox.exec(`git -C ${quote(workspace)} diff HEAD --patch --binary -- .`, { timeout: 30000 });
    const patchBytes = new TextEncoder().encode(diff.stdout).length;

    await input.recordEvent({
      type: 'patch_captured',
      source: 'sandbox',
      message: 'Captured git diff before sandbox cleanup.',
      command: 'git diff --patch --binary -- .',
      cwd: workspace,
      exit_code: diff.exitCode,
      stdout: diff.stdout,
      stderr: diff.stderr,
      metadata: {
        patch_bytes: patchBytes,
        run_exit_code: result.exitCode,
        run_success: result.success,
        status: status.stdout,
        stat: stat.stdout,
        truncated_in_event: patchBytes > 16000,
      },
    });
    await input.recordArtifact({
      type: 'patch',
      name: 'git.diff',
      uri: `event://runs/${input.runId}/patch_captured`,
      metadata: {
        patch_bytes: patchBytes,
        status: status.stdout,
        stat: stat.stdout,
        truncated_in_event: patchBytes > 16000,
      },
    });
    return { changed: true, patchBytes, status: status.stdout, stat: stat.stdout };
  } catch (error) {
    await input.recordEvent({
      type: 'patch_capture_failed',
      source: 'worker',
      message: error instanceof Error ? error.message : 'Failed to capture git diff.',
    });
    return emptyPatch();
  }
}

function emptyPatch(): PatchCaptureResult {
  return { changed: false, patchBytes: 0, status: '', stat: '' };
}

function quote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
