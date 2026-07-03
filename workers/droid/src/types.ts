import type { Sandbox } from '@cloudflare/sandbox';

export interface BrowserWorkerBinding {
  fetch: typeof fetch;
}

export interface Env {
  DB: D1Database;
  DROID_INTERNAL_TOKEN: string;
  DROID_DEEPSEEK_API_KEY?: string;
  DROID_DEEPSEEK_MODEL?: string;
  DROID_DEEPSEEK_REVIEW_MODEL?: string;
  DROID_MAX_RUNNING_RUNS?: string;
  DROID_GITHUB_TOKEN?: string;
  DROID_SAASMAKER_TOKEN?: string;
  DROID_BROWSER_PREVIEW_HOSTNAME?: string;
  SAASMAKER_API_URL?: string;
  BROWSER?: BrowserWorkerBinding;
  Sandbox: DurableObjectNamespace<Sandbox>;
  DROID_RUN_ROOMS?: DurableObjectNamespace;
}

export type RunMode = 'command' | 'native';
export type RunProvider = 'deepseek';

export interface BrowserAcceptanceRequest {
  enabled?: boolean;
  goal?: string;
  url?: string;
  start_command?: string;
  port?: number;
  preview_hostname?: string;
  assert_text?: string[];
  timeout_seconds?: number;
  keep_open?: boolean;
}

export type BackoffStrategy = 'fixed' | 'linear' | 'exponential';

export interface LoopPolicyRequest {
  enabled?: boolean;
  max_attempts?: number;
  retry_on_failure?: boolean;
  stop_on_blocker?: boolean;
  cost_budget_usd?: number;
  backoff_strategy?: BackoffStrategy;
  backoff_initial_ms?: number;
  backoff_max_ms?: number;
  backoff_jitter?: boolean;
}

/**
 * Explicit, durable retry contract derived from a LoopPolicyRequest.
 * Recorded as a `retry_contract` event so every Droid run declares its
 * retry behaviour up front instead of relying on implicit defaults.
 */
export interface RetryContract {
  max_attempts: number;
  retry_on_failure: boolean;
  stop_on_blocker: boolean;
  backoff_strategy: BackoffStrategy;
  backoff_initial_ms: number;
  backoff_max_ms: number;
  backoff_jitter: boolean;
}

/**
 * Explicit, durable timeout contract for a Droid run.
 * Recorded as a `timeout_contract` event so the per-attempt and total
 * timeout budgets are visible and auditable.
 */
export interface TimeoutContract {
  per_attempt_seconds: number;
  total_budget_seconds: number;
  grace_seconds: number;
}

export interface RunRequest {
  mode?: RunMode;
  provider?: RunProvider;
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
  acceptance_command?: string;
  acceptance_timeout_seconds?: number;
  browser_acceptance?: BrowserAcceptanceRequest;
  loop_policy?: LoopPolicyRequest;
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
  retry_count: number;
  failure_reason: string | null;
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
  idle_running: number;
  idle_after_seconds: number;
  stale_after_seconds: number;
  estimated_compute_seconds: number;
  recent: RunRecord[];
}

export interface DroidFailureReasonBreakdown {
  reason: string;
  count: number;
}

export interface DroidRetryBucket {
  retry_count: number;
  count: number;
}

export interface DroidSuccessDashboard {
  window_days: number;
  window_start: string;
  window_end: string;
  total_runs: number;
  completed_runs: number;
  failed_runs: number;
  success_rate: number | null;
  failure_reasons: DroidFailureReasonBreakdown[];
  avg_duration_ms: number | null;
  retry_count_distribution: DroidRetryBucket[];
  project_slug: string | null;
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
  taskId?: string;
  projectSlug?: string;
  repoUrl?: string;
  branch?: string;
  command: string;
  mode: RunMode;
  prompt?: string;
  provider?: RunProvider;
  maxTurns?: number;
  timeoutSeconds: number;
  createPr: boolean;
  prTitle?: string;
  prBody?: string;
  prBaseBranch?: string;
  acceptanceCommand?: string;
  acceptanceTimeoutSeconds?: number;
  browserAcceptance?: BrowserAcceptanceRequest;
  loopPolicy?: LoopPolicyRequest;
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
