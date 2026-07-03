import type { CommandResult, RunExecutionInput, RunEventInput } from './types';

/**
 * Pre-flight validation result. When `ok` is false the run is aborted fast
 * with a clear, categorized failure reason so the dashboard can break down
 * failures by cause.
 */
export interface PreflightResult {
  ok: boolean;
  reason: string | null;
  checks: PreflightCheck[];
}

export interface PreflightCheck {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  message: string;
}

export type SandboxLike = {
  exec: (
    command: string,
    options?: { timeout?: number; env?: Record<string, string> }
  ) => Promise<CommandResult>;
};

type SandboxExec = Awaited<ReturnType<typeof import('@cloudflare/sandbox').getSandbox>>;

/**
 * Runs pre-flight checks inside the sandboxed workspace before the main
 * Droid task executes. Each check is recorded as a `preflight_check` event
 * and a single `preflight_passed` or `preflight_failed` event summarises
 * the outcome.
 *
 * Checks performed:
 *  - git_clean_state: the repo working tree must be clean (only when a
 *    repo was hydrated; skipped for empty workspaces).
 *  - dependencies_installed: node_modules must exist, otherwise the
 *    detected package manager install is run. Skipped when no
 *    package.json is present.
 *
 * Env/secret and task-definition validation already happen at the API
 * layer (validateRunEnvironment / validateRunRequest) and fail fast before
 * a sandbox is created, so they are not re-run here.
 */
export async function runPreflight(
  input: Pick<RunExecutionInput, 'runId' | 'recordEvent' | 'repoUrl' | 'mode' | 'command'>,
  sandbox: SandboxExec | SandboxLike,
  cwd: string
): Promise<PreflightResult> {
  const checks: PreflightCheck[] = [];

  // 1. Git clean-state check (only meaningful when a repo was hydrated).
  if (input.repoUrl) {
    const gitCheck = await checkGitCleanState(sandbox, cwd);
    checks.push(gitCheck);
    await recordCheck(input, gitCheck);
  } else {
    const skipped: PreflightCheck = {
      name: 'git_clean_state',
      status: 'skipped',
      message: 'No repo_url provided; git clean-state check skipped.',
    };
    checks.push(skipped);
    await recordCheck(input, skipped);
  }

  // 2. Dependencies installed check.
  const depsCheck = await checkDependenciesInstalled(sandbox, cwd);
  checks.push(depsCheck);
  await recordCheck(input, depsCheck);

  const failed = checks.find((check) => check.status === 'failed');
  const result: PreflightResult = {
    ok: !failed,
    reason: failed ? failureReasonForCheck(failed.name) : null,
    checks,
  };

  const summaryEvent: RunEventInput = failed
    ? {
        type: 'preflight_failed',
        actor: 'droid',
        source: 'worker',
        message: `Pre-flight validation failed: ${failed.name} — ${failed.message}`,
        metadata: {
          reason: result.reason,
          failed_check: failed.name,
          checks: checks.map((c) => ({ name: c.name, status: c.status })),
        },
      }
    : {
        type: 'preflight_passed',
        actor: 'droid',
        source: 'worker',
        message: 'Pre-flight validation passed.',
        metadata: {
          checks: checks.map((c) => ({ name: c.name, status: c.status })),
        },
      };
  await input.recordEvent(summaryEvent);

  return result;
}

async function recordCheck(
  input: Pick<RunExecutionInput, 'recordEvent'>,
  check: PreflightCheck
): Promise<void> {
  await input.recordEvent({
    type: 'preflight_check',
    actor: 'droid',
    source: 'worker',
    message: `${check.name}: ${check.status} — ${check.message}`,
    metadata: { name: check.name, status: check.status, message: check.message },
  });
}

async function checkGitCleanState(
  sandbox: SandboxExec | SandboxLike,
  cwd: string
): Promise<PreflightCheck> {
  const result = await sandbox.exec(
    `bash -lc ${quote(`cd ${quote(cwd)} && git rev-parse --is-inside-work-tree 2>/dev/null && git status --porcelain`)}`,
    { timeout: 20000 }
  );
  if (!result.success) {
    return {
      name: 'git_clean_state',
      status: 'failed',
      message: 'git status check did not run successfully (is this a git repo?).',
    };
  }
  const dirty = result.stdout.trim();
  if (dirty) {
    const firstLine = dirty.split('\n')[0] ?? '';
    return {
      name: 'git_clean_state',
      status: 'failed',
      message: `Repository working tree is not clean: ${firstLine.slice(0, 160)}`,
    };
  }
  return {
    name: 'git_clean_state',
    status: 'passed',
    message: 'Repository working tree is clean.',
  };
}

async function checkDependenciesInstalled(
  sandbox: SandboxExec | SandboxLike,
  cwd: string
): Promise<PreflightCheck> {
  const hasPackageJson = await sandbox.exec(
    `bash -lc ${quote(`test -f ${quote(`${cwd}/package.json`)}`)}`,
    { timeout: 10000 }
  );
  if (!hasPackageJson.success) {
    return {
      name: 'dependencies_installed',
      status: 'skipped',
      message: 'No package.json found; dependency check skipped.',
    };
  }

  const hasNodeModules = await sandbox.exec(
    `bash -lc ${quote(`test -d ${quote(`${cwd}/node_modules`)}`)}`,
    { timeout: 10000 }
  );
  if (hasNodeModules.success) {
    return {
      name: 'dependencies_installed',
      status: 'passed',
      message: 'node_modules present.',
    };
  }

  // node_modules missing — attempt a best-effort install so the run can
  // proceed. Detect the package manager from the lockfile.
  const lockfile = await detectLockfile(sandbox, cwd);
  const installCommand = lockfile ? `${lockfile.manager} install --frozen-lockfile` : 'npm install';
  const installResult = await sandbox.exec(
    `bash -lc ${quote(`cd ${quote(cwd)} && ${installCommand}`)}`,
    { timeout: 180000 }
  );
  if (!installResult.success) {
    const tail = (installResult.stderr || installResult.stdout || '').trim().slice(-200);
    return {
      name: 'dependencies_installed',
      status: 'failed',
      message: `Dependency install failed (${installCommand}): ${tail}`,
    };
  }
  return {
    name: 'dependencies_installed',
    status: 'passed',
    message: `Dependencies installed via ${installCommand}.`,
  };
}

async function detectLockfile(
  sandbox: SandboxExec | SandboxLike,
  cwd: string
): Promise<{ manager: string } | null> {
  const checks: Array<{ file: string; manager: string }> = [
    { file: 'pnpm-lock.yaml', manager: 'pnpm' },
    { file: 'yarn.lock', manager: 'yarn' },
    { file: 'package-lock.json', manager: 'npm' },
  ];
  for (const { file, manager } of checks) {
    const exists = await sandbox.exec(`bash -lc ${quote(`test -f ${quote(`${cwd}/${file}`)}`)}`, {
      timeout: 8000,
    });
    if (exists.success) return { manager };
  }
  return null;
}

/**
 * Maps a failed preflight check to a stable failure-reason label used by
 * the dashboard. Keeping these stable lets the failure-reason breakdown
 * stay meaningful over time.
 */
export function failureReasonForCheck(name: string): string {
  if (name === 'git_clean_state') return 'preflight_dirty_repo';
  if (name === 'dependencies_installed') return 'preflight_deps_install_failed';
  return 'preflight_failed';
}

function quote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
