import type { Sandbox } from '@cloudflare/sandbox';

export interface Env {
  DB: D1Database;
  DROID_INTERNAL_TOKEN: string;
  DROID_DEEPSEEK_API_KEY?: string;
  DROID_DEEPSEEK_MODEL?: string;
  DROID_DEEPSEEK_REVIEW_MODEL?: string;
  DROID_GITHUB_TOKEN?: string;
  Sandbox: DurableObjectNamespace<Sandbox>;
}

export type RunMode = 'command' | 'native';

export interface RunRequest {
  mode?: RunMode;
  provider?: 'deepseek';
  task_id?: string;
  project_slug?: string;
  repo_url?: string;
  branch?: string;
  command?: string;
  prompt?: string;
  cwd?: string;
  max_turns?: number;
  timeout_seconds?: number;
  create_pr?: boolean;
  pr_title?: string;
  pr_body?: string;
  pr_base_branch?: string;
  destroy_after_run?: boolean;
  wait_for_completion?: boolean;
}

export interface RunRecord {
  id: string;
  task_id: string | null;
  project_slug: string | null;
  repo_url: string | null;
  branch: string | null;
  command: string;
  cwd: string | null;
  sandbox_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  exit_code: number | null;
  duration_ms: number | null;
  summary: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface RunEventRecord {
  id: string;
  run_id: string;
  type: string;
  actor: string;
  source: string;
  message: string | null;
  command: string | null;
  cwd: string | null;
  exit_code: number | null;
  stdout: string | null;
  stderr: string | null;
  metadata: string;
  created_at: string;
}

export interface RunArtifactRecord {
  id: string;
  run_id: string;
  type: string;
  name: string;
  uri: string;
  metadata: string;
  created_at: string;
}

export interface RunStats {
  total: number;
  by_status: Record<RunRecord['status'], number>;
  avg_duration_ms: number | null;
  stale_running: number;
  recent: RunRecord[];
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

export interface RunExecutionInput {
  env: Env;
  runId: string;
  sandboxId: string;
  repoUrl?: string;
  branch?: string;
  command: string;
  mode: RunMode;
  prompt?: string;
  provider?: 'deepseek';
  maxTurns?: number;
  timeoutSeconds: number;
  createPr: boolean;
  prTitle?: string;
  prBody?: string;
  prBaseBranch?: string;
  cwd?: string;
  destroyAfterRun: boolean;
  recordEvent: (event: RunEventInput) => Promise<void>;
  recordArtifact: (artifact: RunArtifactInput) => Promise<void>;
}

export interface RunExecutor {
  execute(input: RunExecutionInput): Promise<CommandResult>;
  reconcile?(input: RunExecutionInput): Promise<CommandResult>;
  cancel?(input: {
    env: Env;
    runId: string;
    sandboxId: string;
    recordEvent: (event: RunEventInput) => Promise<void>;
    recordArtifact: (artifact: RunArtifactInput) => Promise<void>;
  }): Promise<void>;
}

export interface RunEventInput {
  type: string;
  actor?: string;
  source?: string;
  message?: string;
  command?: string;
  cwd?: string;
  exit_code?: number;
  stdout?: string;
  stderr?: string;
  metadata?: Record<string, unknown>;
}

export interface RunArtifactInput {
  type: string;
  name: string;
  uri: string;
  metadata?: Record<string, unknown>;
}
