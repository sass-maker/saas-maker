import type { CommandResult, RunExecutionInput } from './types';

type SandboxLike = {
  exec(command: string, options?: { timeout?: number }): Promise<CommandResult>;
};

export interface AcceptanceResult {
  passed: boolean;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  summary: string;
}

export async function runAcceptanceCommand(
  input: RunExecutionInput,
  sandbox: SandboxLike,
  cwd: string,
  command: string,
  timeoutSeconds = 300
): Promise<AcceptanceResult> {
  const timeoutMs = Math.min(Math.max(timeoutSeconds, 30), 900) * 1000;
  await input.recordEvent({
    type: 'acceptance_start',
    actor: 'tester',
    source: 'sandbox',
    command,
    cwd,
    message: 'Running Droid acceptance command.',
    metadata: { timeout_ms: timeoutMs },
  });

  const result = await sandbox.exec(`cd ${quote(cwd)} && ${command}`, { timeout: timeoutMs });
  const passed = result.success;
  const summary = passed
    ? 'Acceptance command passed.'
    : `Acceptance command failed with exit code ${result.exitCode}.`;

  await input.recordEvent({
    type: passed ? 'acceptance_passed' : 'acceptance_failed',
    actor: 'tester',
    source: 'sandbox',
    command,
    cwd,
    exit_code: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    message: summary,
    metadata: { timeout_ms: timeoutMs },
  });
  await input.recordArtifact({
    type: 'acceptance',
    name: 'Droid acceptance report',
    uri: `event://runs/${input.runId}/${passed ? 'acceptance_passed' : 'acceptance_failed'}`,
    metadata: {
      command,
      cwd,
      exit_code: result.exitCode,
      passed,
    },
  });

  return {
    passed,
    command,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    summary,
  };
}

function quote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
