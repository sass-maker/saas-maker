import { getSandbox } from '@cloudflare/sandbox';
import type { CommandResult, RunExecutor } from './types';
import { runAcceptanceCommand } from './acceptance';
import { isBrowserAcceptanceEnabled, runBrowserAcceptance } from './browser-acceptance';
import { captureGitPatch } from './patch';
import { buildFinalReport, collectPrGateEvidence, type PrGateEvidence } from './pr-gate';
import { providerContractEvent, resolveProviderContract } from './provider';

type GitAuth = {
  prefix: string;
  githubToken: boolean;
  cloneRepoArg?: string;
};

type RepoHydration = {
  method: 'github_tarball' | 'git_clone' | 'empty';
  repo?: string;
  baseBranch?: string;
  baseSha?: string;
};

type PrCreationResult = {
  created: boolean;
  url?: string;
  branch?: string;
  number?: number;
  headSha?: string;
};

type NativeAgentAction =
  | { action: 'list'; path?: string }
  | { action: 'read'; path: string; start_line?: number; end_line?: number }
  | { action: 'write'; path: string; content: string }
  | { action: 'command'; command: string; timeout_seconds?: number }
  | { action: 'block'; reason: string; question: string; summary?: string }
  | { action: 'final'; summary: string };

type NativeChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type NativeToolResult = {
  ok: boolean;
  output: string;
  exitCode?: number;
};

const DEFAULT_NATIVE_MODEL = 'deepseek-v4-pro';
const DEFAULT_REVIEW_MODEL = 'deepseek-chat';

export const sandboxExecutor: RunExecutor = {
  async execute(input): Promise<CommandResult> {
    const workspace = '/workspace/repo';
    let hydration: RepoHydration = { method: 'empty' };

    await input.recordEvent(providerContractEvent(resolveProviderContract(input)));
    if (canRunBrowserAcceptanceWithoutSandbox(input)) {
      const browserResult = await runBrowserAcceptance(input, {}, workspace, input.browserAcceptance!);
      await recordStructuredFinal(
        input,
        {
          stdout: browserResult.stdout,
          stderr: browserResult.stderr,
          exitCode: browserResult.passed ? 0 : 78,
          success: browserResult.passed,
        },
        withAcceptanceChecks(collectPrGateEvidence({ patchBytes: 0, status: '', stat: '' }), input),
        null,
        null,
        {
          summary: browserResult.summary,
          risks: browserResult.passed ? [] : [browserResult.summary],
        }
      );
      return {
        stdout: browserResult.stdout,
        stderr: browserResult.stderr,
        exitCode: browserResult.passed ? 0 : 78,
        success: browserResult.passed,
      };
    }
    const sandbox = getDroidSandbox(input.env.Sandbox, input.sandboxId);
    await input.recordEvent({ type: 'sandbox_start', message: `Using sandbox ${input.sandboxId}` });
    const ready = await prepareSandboxWorkspace(input, sandbox, '/workspace/.droid-ready');
    if (!ready.success) {
      await input.recordEvent({
        type: 'sandbox_ready_failed',
        message: 'Sandbox did not become ready.',
        command: 'sandbox.mkdir /workspace',
        exit_code: ready.exitCode,
        stdout: ready.stdout,
        stderr: ready.stderr,
      });
      if (input.destroyAfterRun) {
        await input.recordEvent({
          type: 'sandbox_destroy',
          message: `Destroying sandbox ${input.sandboxId}`,
        });
        await sandbox.destroy();
      }
      return ready;
    }

    if (input.repoUrl) {
      const hydrated = await hydrateRepository(input, sandbox, workspace);
      hydration = hydrated.hydration;
      if (!hydrated.result.success) return hydrated.result;
    } else {
      await sandbox.exec(`rm -rf ${quote(workspace)}`, { timeout: 30000 });
      await sandbox.mkdir(workspace, { recursive: true });
    }

    const cwd = resolveWorkspaceCwd(workspace, input.cwd);
    if (input.mode !== 'command') {
      const result = await runAgent(input, sandbox, cwd);
      const finalResult = await finalizeWorkspacePatch(
        input,
        sandbox,
        workspace,
        hydration,
        result
      );
      if (input.destroyAfterRun) {
        await input.recordEvent({
          type: 'sandbox_destroy',
          message: `Destroying sandbox ${input.sandboxId}`,
        });
        await sandbox.destroy();
      }
      return finalResult;
    }

    await input.recordEvent({ type: 'command_start', command: input.command, cwd });
    const result = await sandbox.exec(`cd ${quote(cwd)} && ${input.command}`, {
      timeout: input.timeoutSeconds * 1000,
    });
    await input.recordEvent({
      type: 'command_finish',
      command: input.command,
      cwd,
      exit_code: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    });

    const finalResult = await finalizeWorkspacePatch(input, sandbox, workspace, hydration, result);

    if (input.destroyAfterRun) {
      await input.recordEvent({
        type: 'sandbox_destroy',
        message: `Destroying sandbox ${input.sandboxId}`,
      });
      await sandbox.destroy();
    }

    return finalResult;
  },
  async reconcile(input): Promise<CommandResult> {
    const sandbox = getDroidSandbox(input.env.Sandbox, input.sandboxId);
    const workspace = '/workspace/repo';
    const result = {
      stdout: 'Reconciled existing Droid sandbox workspace.',
      stderr: '',
      exitCode: 0,
      success: true,
    };
    await input.recordEvent({
      type: 'reconcile_start',
      message: `Reconciling sandbox ${input.sandboxId}`,
      command: 'droid reconcile',
      cwd: workspace,
    });

    const exists = await sandboxExecWithWorkerTimeout(
      sandbox,
      `bash -lc ${quote(`test -d ${quote(workspace)} && test -d ${quote(`${workspace}/.git`)}`)}`,
      { timeout: 15000 },
      20000
    );
    if (!exists.success) {
      const missing = {
        stdout: '',
        stderr: 'Droid sandbox workspace is not available for reconcile.',
        exitCode: 78,
        success: false,
      };
      await input.recordEvent({
        type: 'reconcile_failed',
        message: missing.stderr,
        command: 'droid reconcile',
        cwd: workspace,
        exit_code: missing.exitCode,
      });
      if (input.destroyAfterRun) {
        await input.recordEvent({
          type: 'sandbox_destroy',
          message: `Destroying sandbox ${input.sandboxId}`,
        });
        await sandbox.destroy();
      }
      return missing;
    }

    const hydration = await resolveHydrationForExistingWorkspace(input, sandbox, workspace);
    const finalResult = await finalizeWorkspacePatch(input, sandbox, workspace, hydration, result);
    if (input.destroyAfterRun) {
      await input.recordEvent({
        type: 'sandbox_destroy',
        message: `Destroying sandbox ${input.sandboxId}`,
      });
      await sandbox.destroy();
    }
    await input.recordEvent({
      type: 'reconcile_finish',
      message: finalResult.success
        ? 'Droid reconcile finished.'
        : 'Droid reconcile found unresolved work.',
      command: 'droid reconcile',
      cwd: workspace,
      exit_code: finalResult.exitCode,
    });
    return finalResult;
  },
  async cancel(input): Promise<void> {
    const sandbox = getDroidSandbox(input.env.Sandbox, input.sandboxId);
    const capturePromise = captureGitPatch(
      {
        env: input.env,
        runId: input.runId,
        sandboxId: input.sandboxId,
        command: 'cancel',
        mode: 'command',
        timeoutSeconds: 60,
        createPr: false,
        destroyAfterRun: true,
        recordEvent: input.recordEvent,
        recordArtifact: input.recordArtifact,
      },
      sandbox,
      '/workspace/repo',
      {
        stdout: '',
        stderr: 'Run cancelled.',
        exitCode: 130,
        success: false,
      }
    ).catch((error) =>
      input.recordEvent({
        type: 'patch_capture_failed',
        source: 'sandbox',
        message: error instanceof Error ? error.message : 'Patch capture during cancel failed.',
        exit_code: 1,
      })
    );
    const captureTimedOut = await Promise.race([
      capturePromise.then(() => false),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 8000)),
    ]);
    if (captureTimedOut) {
      capturePromise.catch(() => undefined);
      await input.recordEvent({
        type: 'patch_capture_skipped',
        source: 'sandbox',
        message: 'Patch capture timed out during cancel; destroying sandbox.',
        exit_code: 124,
      });
    }
    await input.recordEvent({
      type: 'sandbox_destroy',
      message: `Destroying sandbox ${input.sandboxId}`,
    });
    await sandbox.destroy();
  },
};

function getDroidSandbox(
  ns: Parameters<typeof getSandbox>[0],
  sandboxId: string
): ReturnType<typeof getSandbox> {
  return getSandbox(ns, sandboxId, {
    keepAlive: true,
    containerTimeouts: {
      instanceGetTimeoutMS: 180000,
      portReadyTimeoutMS: 240000,
      waitIntervalMS: 1000,
    },
  });
}

function canRunBrowserAcceptanceWithoutSandbox(input: Parameters<RunExecutor['execute']>[0]): boolean {
  return Boolean(
    input.browserAcceptance?.url?.trim() &&
      !input.browserAcceptance.start_command?.trim() &&
      input.mode === 'command' &&
      input.command === 'browser_acceptance' &&
      !input.repoUrl &&
      !input.createPr
  );
}

async function prepareSandboxWorkspace(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  path: string
): Promise<CommandResult> {
  const startedAt = Date.now();
  await input.recordEvent({
    type: 'sandbox_ready_start',
    command: `mkdir -p ${path}`,
    metadata: { path },
  });
  const result = await sandboxExecWithWorkerTimeout(
    sandbox,
    `mkdir -p ${quote(dirname(path))} && touch ${quote(path)}`,
    { timeout: 30000 },
    45000
  );
  const durationMs = Date.now() - startedAt;
  if (result.success) {
    await input.recordEvent({
      type: 'sandbox_ready_finish',
      command: `mkdir -p ${path}`,
      exit_code: 0,
      metadata: { path, duration_ms: durationMs },
    });
  }
  return result;
}

async function runAgent(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  cwd: string
): Promise<CommandResult> {
  return runNativeAgent(input, sandbox, cwd);
}

async function requireDeepSeekKey(
  input: Parameters<RunExecutor['execute']>[0]
): Promise<CommandResult | null> {
  if (input.env.DROID_DEEPSEEK_API_KEY) return null;
  const result = {
    stdout: '',
    stderr: 'DROID_DEEPSEEK_API_KEY is not configured',
    exitCode: 78,
    success: false,
  };
  await input.recordEvent({
    type: 'agent_config_missing',
    actor: 'droid',
    source: 'worker',
    message: result.stderr,
    exit_code: result.exitCode,
  });
  return result;
}

function resolveDeepSeekModel(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

async function runNativeAgent(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  cwd: string
): Promise<CommandResult> {
  const missingKey = await requireDeepSeekKey(input);
  if (missingKey) return missingKey;

  const model = resolveDeepSeekModel(input.env.DROID_DEEPSEEK_MODEL, DEFAULT_NATIVE_MODEL);
  const maxTurns = input.maxTurns ?? 20;
  const transcript: string[] = [];
  const taskContext = await hydrateNativeTaskContext(input, sandbox, cwd);
  const messages: NativeChatMessage[] = [
    { role: 'system', content: buildNativeSystemPrompt(cwd) },
    { role: 'user', content: buildNativeUserPrompt(input.prompt ?? '', taskContext) },
  ];

  await input.recordEvent({
    type: 'agent_start',
    actor: 'native',
    source: 'deepseek',
    command: 'droid native tool loop',
    cwd,
    metadata: {
      provider: input.provider ?? 'deepseek',
      model,
      max_turns: maxTurns,
      timeout_seconds: input.timeoutSeconds,
    },
  });

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    const action = await requestNativeAgentAction(input, messages, model);
    transcript.push(`turn ${turn}: ${summarizeNativeAction(action)}`);
    await input.recordEvent({
      type: 'agent_step',
      actor: 'native',
      source: 'deepseek',
      message: summarizeNativeAction(action),
      cwd,
      metadata: scrubNativeAction(action, turn),
    });

    if (action.action === 'final') {
      await input.recordEvent({
        type: 'agent_finish',
        actor: 'native',
        source: 'deepseek',
        command: 'droid native tool loop',
        cwd,
        exit_code: 0,
        stdout: action.summary,
        metadata: {
          provider: input.provider ?? 'deepseek',
          model,
          max_turns: maxTurns,
          turns: turn,
        },
      });
      return {
        stdout: `${transcript.join('\n')}\n\n${action.summary}\n`,
        stderr: '',
        exitCode: 0,
        success: true,
      };
    }

    if (action.action === 'block') {
      const blocked = await markTaskBlocked(input, action, transcript);
      const stderr = blocked
        ? `Droid blocked the task: ${action.reason}`
        : `Droid needs user input but could not update the task: ${action.reason}`;
      await input.recordEvent({
        type: 'agent_blocked',
        actor: 'native',
        source: 'deepseek',
        command: 'droid native tool loop',
        cwd,
        exit_code: 75,
        stderr,
        metadata: {
          reason: action.reason,
          question: action.question,
          task_id: input.taskId ?? null,
          callback_updated: blocked,
        },
      });
      return {
        stdout: `${transcript.join('\n')}\n\n${action.summary ?? action.reason}\nQuestion: ${action.question}\n`,
        stderr,
        exitCode: 75,
        success: false,
      };
    }

    const toolResult = await executeNativeTool(input, sandbox, cwd, action);
    transcript.push(toolResult.output);
    messages.push({ role: 'assistant', content: JSON.stringify(action) });
    messages.push({
      role: 'user',
      content: [
        `Tool result (${toolResult.ok ? 'ok' : 'error'}${toolResult.exitCode === undefined ? '' : `, exit ${toolResult.exitCode}`}):`,
        truncateForModel(toolResult.output, 12000),
        '',
        'Choose the next JSON action.',
      ].join('\n'),
    });
  }

  const stderr = `Native Droid reached max_turns (${maxTurns}) before final.`;
  await input.recordEvent({
    type: 'agent_finish',
    actor: 'native',
    source: 'deepseek',
    command: 'droid native tool loop',
    cwd,
    exit_code: 124,
    stderr,
    metadata: { provider: input.provider ?? 'deepseek', model, max_turns: maxTurns },
  });
  return { stdout: transcript.join('\n'), stderr, exitCode: 124, success: false };
}

function buildNativeSystemPrompt(cwd: string): string {
  return [
    'You are Droid, a coding agent running inside a sandboxed repository.',
    `Workspace cwd: ${cwd}`,
    'Return exactly one JSON object and no markdown.',
    'Valid actions:',
    '{"action":"list","path":"."}',
    '{"action":"read","path":"relative/file.ts","start_line":1,"end_line":160}',
    '{"action":"write","path":"relative/file.ts","content":"full file contents"}',
    '{"action":"command","command":"pnpm test","timeout_seconds":120}',
    '{"action":"block","reason":"what is blocking you","question":"specific question for the user","summary":"optional current state"}',
    '{"action":"final","summary":"what changed and what was verified"}',
    'Use relative paths only. Read files before editing unless the task is explicitly to create a new file.',
    'Prefer small diffs. Run the smallest useful check before final when possible.',
    'Use block only when you need a user decision, credential, review, or deploy permission.',
    'Use the provided repository context as orientation, but verify details by reading files before editing.',
  ].join('\n');
}

function buildNativeUserPrompt(prompt: string, taskContext: string): string {
  return [taskContext ? `Repository context:\n${taskContext}` : '', `Task:\n${prompt}`]
    .filter(Boolean)
    .join('\n\n');
}

async function hydrateNativeTaskContext(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  cwd: string
): Promise<string> {
  const script = [
    `cd ${quote(cwd)}`,
    'root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"',
    'echo "cwd: $(pwd)"',
    'echo "root: $root"',
    'echo',
    'echo "### Git status"',
    'git -C "$root" status --short 2>/dev/null | head -120 || true',
    'echo',
    'echo "### Top-level files"',
    'find "$root" -maxdepth 2 -mindepth 1 \\( -path "$root/.git" -o -path "$root/node_modules" -o -path "$root/.next" -o -path "$root/dist" \\) -prune -o -print 2>/dev/null | sed "s#^$root/##" | head -160',
    'if test -f "$root/AGENTS.md"; then echo; echo "### AGENTS.md"; sed -n "1,220p" "$root/AGENTS.md"; fi',
    'if test -f "$root/package.json"; then echo; echo "### package.json scripts"; node -e "const fs=require(\'fs\'); const pkg=JSON.parse(fs.readFileSync(process.argv[1],\'utf8\')); console.log(JSON.stringify(pkg.scripts||{}, null, 2));" "$root/package.json" 2>/dev/null || sed -n "1,120p" "$root/package.json"; fi',
  ].join('\n');
  const result = await sandboxExecWithWorkerTimeout(
    sandbox,
    `bash -lc ${quote(script)}`,
    { timeout: 30000 },
    40000
  );
  if (!result.success) {
    await input.recordEvent({
      type: 'context_hydration_failed',
      actor: 'native',
      source: 'sandbox',
      command: 'Droid context hydration',
      cwd,
      exit_code: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    });
    return '';
  }

  const context = truncateForModel(result.stdout, 20000);
  await input.recordEvent({
    type: 'context_hydrated',
    actor: 'native',
    source: 'sandbox',
    command: 'Droid context hydration',
    cwd,
    stdout: context,
    metadata: {
      bytes: result.stdout.length,
      truncated: result.stdout.length > 20000,
    },
  });
  return context;
}

async function requestNativeAgentAction(
  input: Parameters<RunExecutor['execute']>[0],
  messages: NativeChatMessage[],
  model: string
): Promise<NativeAgentAction> {
  try {
    return await requestNativeAgentActionOnce(input, messages, model, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('response_format')) throw error;
    return requestNativeAgentActionOnce(input, messages, model, false);
  }
}

async function requestNativeAgentActionOnce(
  input: Parameters<RunExecutor['execute']>[0],
  messages: NativeChatMessage[],
  model: string,
  jsonMode: boolean
): Promise<NativeAgentAction> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  let response: Response;
  try {
    response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${input.env.DROID_DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.1,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
  } catch (error) {
    if (controller.signal.aborted) throw new Error('DeepSeek API timeout');
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `DeepSeek API ${response.status} ${response.statusText}: ${text.slice(0, 500)}`
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek response did not include message content');
  return parseNativeAction(content);
}

function parseNativeAction(content: string): NativeAgentAction {
  const trimmed = content.trim();
  const jsonText = trimmed.startsWith('{') ? trimmed : trimmed.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) throw new Error(`Native agent returned non-JSON output: ${trimmed.slice(0, 300)}`);
  const parsed = JSON.parse(jsonText) as Partial<NativeAgentAction> & Record<string, unknown>;
  if (parsed.action === 'list') return { action: 'list', path: stringOrUndefined(parsed.path) };
  if (parsed.action === 'read' && typeof parsed.path === 'string') {
    return {
      action: 'read',
      path: parsed.path,
      start_line: numberOrUndefined(parsed.start_line),
      end_line: numberOrUndefined(parsed.end_line),
    };
  }
  if (
    parsed.action === 'write' &&
    typeof parsed.path === 'string' &&
    typeof parsed.content === 'string'
  ) {
    return { action: 'write', path: parsed.path, content: parsed.content };
  }
  if (parsed.action === 'command' && typeof parsed.command === 'string') {
    return {
      action: 'command',
      command: parsed.command,
      timeout_seconds: numberOrUndefined(parsed.timeout_seconds),
    };
  }
  if (
    parsed.action === 'block' &&
    typeof parsed.reason === 'string' &&
    typeof parsed.question === 'string'
  ) {
    return {
      action: 'block',
      reason: parsed.reason,
      question: parsed.question,
      summary: stringOrUndefined(parsed.summary),
    };
  }
  if (parsed.action === 'final' && typeof parsed.summary === 'string') {
    return { action: 'final', summary: parsed.summary };
  }
  throw new Error(`Native agent returned invalid action: ${JSON.stringify(parsed).slice(0, 500)}`);
}

async function executeNativeTool(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  cwd: string,
  action: Exclude<NativeAgentAction, { action: 'final' } | { action: 'block' }>
): Promise<NativeToolResult> {
  try {
    if (action.action === 'list') return nativeList(input, sandbox, cwd, action.path);
    if (action.action === 'read') return nativeRead(input, sandbox, cwd, action);
    if (action.action === 'write') return nativeWrite(input, sandbox, cwd, action);
    return nativeCommand(input, sandbox, cwd, action);
  } catch (error) {
    return { ok: false, output: error instanceof Error ? error.message : String(error) };
  }
}

async function markTaskBlocked(
  input: Parameters<RunExecutor['execute']>[0],
  action: Extract<NativeAgentAction, { action: 'block' }>,
  transcript: string[]
): Promise<boolean> {
  if (!input.taskId) {
    await input.recordEvent({
      type: 'task_blocked_callback_skipped',
      actor: 'droid',
      source: 'worker',
      message: 'Droid wanted to block the task, but no task_id was attached to the run.',
      metadata: { reason: action.reason, question: action.question },
    });
    return false;
  }

  const client = await getTaskCallbackClient(input, 'task_blocked_callback_skipped');
  if (!client) {
    return false;
  }

  const commentBody = [
    'Droid is blocked and needs user input.',
    '',
    `Reason: ${action.reason}`,
    `Question: ${action.question}`,
    action.summary ? `Summary: ${action.summary}` : '',
    '',
    `Run: ${input.runId}`,
    `Project: ${input.projectSlug ?? 'unknown'}`,
    `Recent action: ${transcript.at(-1) ?? 'none'}`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await postTaskComment(client, commentBody);
    await patchTask(client, { blocked_on_user: true });

    await input.recordEvent({
      type: 'task_blocked_callback_succeeded',
      actor: 'droid',
      source: 'saas-maker-api',
      message: 'Droid posted an agent comment and marked the task blocked.',
      metadata: { task_id: input.taskId, reason: action.reason, question: action.question },
    });
    return true;
  } catch (error) {
    await input.recordEvent({
      type: 'task_blocked_callback_failed',
      actor: 'droid',
      source: 'saas-maker-api',
      message: error instanceof Error ? error.message : 'Failed to mark task blocked.',
      metadata: { task_id: input.taskId, reason: action.reason, question: action.question },
    });
    return false;
  }
}

type TaskCallbackClient = {
  apiUrl: string;
  token: string;
  taskId: string;
};

async function getTaskCallbackClient(
  input: Parameters<RunExecutor['execute']>[0],
  skippedEventType: string
): Promise<TaskCallbackClient | null> {
  if (!input.taskId) return null;
  const token = input.env.DROID_SAASMAKER_TOKEN?.trim();
  if (!token) {
    await input.recordEvent({
      type: skippedEventType,
      actor: 'droid',
      source: 'worker',
      message: 'DROID_SAASMAKER_TOKEN is not configured.',
      metadata: { task_id: input.taskId },
    });
    return null;
  }
  return {
    apiUrl: (input.env.SAASMAKER_API_URL?.trim() || 'https://api.sassmaker.com').replace(/\/+$/, ''),
    token,
    taskId: input.taskId,
  };
}

async function postTaskComment(client: TaskCallbackClient, body: string): Promise<void> {
  const response = await fetch(`${client.apiUrl}/v1/tasks/${encodeURIComponent(client.taskId)}/comments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${client.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body, author_type: 'agent' }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`comment failed with HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
}

async function patchTask(client: TaskCallbackClient, body: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${client.apiUrl}/v1/tasks/${encodeURIComponent(client.taskId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${client.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`task update failed with HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
}

async function nativeList(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  cwd: string,
  requestedPath: string | undefined
): Promise<NativeToolResult> {
  const path = resolveNativePath(cwd, requestedPath ?? '.');
  const command = [
    `cd ${quote(path)}`,
    'find . -maxdepth 2 \\( -path "./.git" -o -path "./node_modules" -o -path "./.next" -o -path "./dist" \\) -prune -o -print | sort | sed "s#^./##" | head -200',
  ].join(' && ');
  await input.recordEvent({
    type: 'command_start',
    actor: 'native',
    source: 'tool',
    command: `list ${requestedPath ?? '.'}`,
    cwd,
    metadata: { path: requestedPath ?? '.' },
  });
  const result = await sandbox.exec(`bash -lc ${quote(command)}`, { timeout: 30000 });
  await input.recordEvent({
    type: 'command_finish',
    actor: 'native',
    source: 'tool',
    command: `list ${requestedPath ?? '.'}`,
    cwd,
    exit_code: result.exitCode,
    stdout: truncateForEvent(result.stdout),
    stderr: truncateForEvent(result.stderr),
    metadata: { path: requestedPath ?? '.' },
  });
  return { ok: result.success, output: result.stdout || result.stderr, exitCode: result.exitCode };
}

async function nativeRead(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  cwd: string,
  action: Extract<NativeAgentAction, { action: 'read' }>
): Promise<NativeToolResult> {
  const path = resolveNativePath(cwd, action.path);
  const start = normalizeLineNumber(action.start_line, 1);
  const end = Math.min(normalizeLineNumber(action.end_line, start + 199), start + 239);
  const command = `test -f ${quote(path)} && nl -ba ${quote(path)} | sed -n ${quote(`${start},${end}p`)}`;
  await input.recordEvent({
    type: 'command_start',
    actor: 'native',
    source: 'tool',
    command: `read ${action.path}`,
    cwd,
    metadata: { path: action.path, start_line: start, end_line: end },
  });
  const result = await sandbox.exec(`bash -lc ${quote(command)}`, { timeout: 30000 });
  await input.recordEvent({
    type: 'command_finish',
    actor: 'native',
    source: 'tool',
    command: `read ${action.path}`,
    cwd,
    exit_code: result.exitCode,
    stdout: truncateForEvent(result.stdout),
    stderr: truncateForEvent(result.stderr),
    metadata: { path: action.path, start_line: start, end_line: end },
  });
  return { ok: result.success, output: result.stdout || result.stderr, exitCode: result.exitCode };
}

async function nativeWrite(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  cwd: string,
  action: Extract<NativeAgentAction, { action: 'write' }>
): Promise<NativeToolResult> {
  const path = resolveNativePath(cwd, action.path);
  await input.recordEvent({
    type: 'command_start',
    actor: 'native',
    source: 'tool',
    command: `write ${action.path}`,
    cwd,
    metadata: { path: action.path, bytes: new TextEncoder().encode(action.content).length },
  });
  await sandbox.exec(`mkdir -p ${quote(dirname(path))}`, { timeout: 30000 });
  await sandbox.writeFile(path, action.content);
  await input.recordEvent({
    type: 'command_finish',
    actor: 'native',
    source: 'tool',
    command: `write ${action.path}`,
    cwd,
    exit_code: 0,
    metadata: { path: action.path, bytes: new TextEncoder().encode(action.content).length },
  });
  return {
    ok: true,
    output: `wrote ${action.path} (${new TextEncoder().encode(action.content).length} bytes)`,
    exitCode: 0,
  };
}

async function nativeCommand(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  cwd: string,
  action: Extract<NativeAgentAction, { action: 'command' }>
): Promise<NativeToolResult> {
  const timeoutSeconds = Math.min(
    Math.max(action.timeout_seconds ?? 120, 5),
    Math.min(input.timeoutSeconds, 300)
  );
  await input.recordEvent({
    type: 'command_start',
    actor: 'native',
    source: 'tool',
    command: action.command,
    cwd,
    metadata: { timeout_seconds: timeoutSeconds },
  });
  const result = await sandbox.exec(
    `cd ${quote(cwd)} && timeout ${timeoutSeconds}s bash -lc ${quote(action.command)}`,
    {
      timeout: (timeoutSeconds + 15) * 1000,
    }
  );
  await input.recordEvent({
    type: 'command_finish',
    actor: 'native',
    source: 'tool',
    command: action.command,
    cwd,
    exit_code: result.exitCode,
    stdout: truncateForEvent(result.stdout),
    stderr: truncateForEvent(result.stderr),
    metadata: { timeout_seconds: timeoutSeconds },
  });
  return {
    ok: result.success,
    output: truncateForModel(
      [result.stdout, result.stderr ? `stderr:\n${result.stderr}` : ''].filter(Boolean).join('\n'),
      12000
    ),
    exitCode: result.exitCode,
  };
}

async function hydrateRepository(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  workspace: string
): Promise<{ result: CommandResult; hydration: RepoHydration }> {
  const repo = parseGitHubRepo(input.repoUrl ?? '');
  if (!repo) {
    return hydrateWithGitClone(input, sandbox, workspace);
  }

  try {
    const repoInfo = await githubRequest<{ default_branch: string }>(input, `/repos/${repo}`);
    const baseBranch = input.branch || repoInfo.default_branch || 'main';
    const baseRef = await githubRequest<{ object: { sha: string } }>(
      input,
      `/repos/${repo}/git/ref/heads/${encodePath(baseBranch)}`
    );
    const tarballUrl = `https://api.github.com/repos/${repo}/tarball/${encodeURIComponent(baseBranch)}`;
    const script = [
      'set -euo pipefail',
      `rm -rf ${quote(workspace)} /tmp/droid-repo-src /tmp/droid-repo.tgz`,
      `mkdir -p ${quote(workspace)} /tmp/droid-repo-src`,
      'curl_args=(-fsSL -H "X-GitHub-Api-Version: 2022-11-28" -H "Accept: application/vnd.github+json")',
      'if [ -n "${GITHUB_TOKEN:-}" ]; then curl_args+=(-H "Authorization: Bearer ${GITHUB_TOKEN}"); fi',
      `curl "\${curl_args[@]}" -o /tmp/droid-repo.tgz ${quote(tarballUrl)}`,
      'tar -xzf /tmp/droid-repo.tgz -C /tmp/droid-repo-src --strip-components=1',
      `cp -a /tmp/droid-repo-src/. ${quote(workspace)}/`,
      `cd ${quote(workspace)}`,
      'git init -q',
      `git checkout -b ${quote(baseBranch)}`,
      `git config user.name ${quote('SaaS Maker Droid')}`,
      `git config user.email ${quote('droid@saas-maker.local')}`,
      'git add .',
      `git commit -q -m ${quote('Droid base snapshot')} --no-gpg-sign`,
    ].join('\n');

    await input.recordEvent({
      type: 'command_start',
      command: 'github tarball hydrate',
      cwd: '/workspace',
      metadata: {
        repo,
        branch: baseBranch,
        github_token: Boolean(input.env.DROID_GITHUB_TOKEN),
        method: 'github_tarball',
      },
    });
    const result = await sandbox.exec(`bash -lc ${quote(script)}`, {
      timeout: 180000,
      env: { GITHUB_TOKEN: input.env.DROID_GITHUB_TOKEN },
    });
    await input.recordEvent({
      type: 'command_finish',
      command: 'github tarball hydrate',
      cwd: '/workspace',
      exit_code: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      metadata: { repo, branch: baseBranch, method: 'github_tarball' },
    });
    return {
      result,
      hydration: { method: 'github_tarball', repo, baseBranch, baseSha: baseRef.object.sha },
    };
  } catch (error) {
    const result = {
      stdout: '',
      stderr: error instanceof Error ? error.message : 'GitHub tarball hydration failed.',
      exitCode: 1,
      success: false,
    };
    await input.recordEvent({
      type: 'repo_hydrate_failed',
      source: 'github',
      message: result.stderr,
      exit_code: result.exitCode,
      metadata: { repo, method: 'github_tarball' },
    });
    return { result, hydration: { method: 'github_tarball', repo } };
  }
}

async function hydrateWithGitClone(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  workspace: string
): Promise<{ result: CommandResult; hydration: RepoHydration }> {
  const gitAuth = await configureGitAuth(input, sandbox);
  await input.recordEvent({
    type: 'command_start',
    command: 'git clone',
    cwd: '/workspace',
    metadata: {
      repo_url: input.repoUrl,
      branch: input.branch ?? null,
      github_token: gitAuth.githubToken,
      method: 'git_clone',
    },
  });
  const branchArgs = input.branch ? ` --branch ${quote(input.branch)}` : '';
  const repoArg = gitAuth.cloneRepoArg ?? quote(input.repoUrl ?? '');
  const gitClone = `${gitAuth.prefix}git clone --depth 1${branchArgs} ${repoArg} ${quote(workspace)}`;
  const result = await sandbox.exec(
    [
      `rm -rf ${quote(workspace)}`,
      'code=1',
      'for attempt in 1 2; do',
      `  timeout 120s bash -lc ${quote(gitClone)}`,
      '  code=$?',
      '  [ "$code" -eq 0 ] && break',
      '  echo "git clone attempt ${attempt} failed with exit ${code}" >&2',
      '  sleep $((attempt * 3))',
      'done',
      '[ "$code" -eq 0 ] || exit "$code"',
    ].join('\n'),
    { timeout: 150000 }
  );
  await input.recordEvent({
    type: 'command_finish',
    command: 'git clone',
    cwd: '/workspace',
    exit_code: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    metadata: { method: 'git_clone' },
  });
  return { result, hydration: { method: 'git_clone' } };
}

async function configureGitAuth(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>
): Promise<GitAuth> {
  if (!input.env.DROID_GITHUB_TOKEN || !input.repoUrl?.startsWith('https://github.com/')) {
    return { prefix: 'GIT_TERMINAL_PROMPT=0 ', githubToken: false };
  }

  const authedRepoUrl = input.repoUrl.replace(
    'https://github.com/',
    `https://x-access-token:${input.env.DROID_GITHUB_TOKEN}@github.com/`
  );
  await sandbox.writeFile('/tmp/droid-github-repo-url', authedRepoUrl);
  await sandbox.writeFile('/tmp/droid-github-token', input.env.DROID_GITHUB_TOKEN);
  await sandbox.writeFile(
    '/tmp/droid-git-askpass',
    [
      '#!/bin/sh',
      'case "$1" in',
      '  *Username*) echo x-access-token ;;',
      '  *Password*) cat /tmp/droid-github-token ;;',
      '  *) echo "" ;;',
      'esac',
    ].join('\n')
  );
  await sandbox.exec(
    'chmod 700 /tmp/droid-git-askpass && chmod 600 /tmp/droid-github-token /tmp/droid-github-repo-url',
    { timeout: 30000 }
  );
  return {
    prefix: 'GIT_TERMINAL_PROMPT=0 GIT_ASKPASS=/tmp/droid-git-askpass ',
    githubToken: true,
    cloneRepoArg: '"$(cat /tmp/droid-github-repo-url)"',
  };
}

async function createDraftPullRequest(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  workspace: string,
  hydration: RepoHydration,
  patch: { patchBytes: number; status: string; stat: string }
): Promise<PrCreationResult> {
  if (!input.env.DROID_GITHUB_TOKEN || !hydration.repo) {
    await input.recordEvent({
      type: 'pr_skipped',
      source: 'github',
      message: 'DROID_GITHUB_TOKEN or GitHub repo metadata is not configured.',
      metadata: {
        github_token: Boolean(input.env.DROID_GITHUB_TOKEN),
        repo_url: input.repoUrl ?? null,
        method: hydration.method,
      },
    });
    return { created: false };
  }

  const repo = hydration.repo;
  const baseBranch = input.prBaseBranch || hydration.baseBranch || input.branch || 'main';
  const branchName = `droid/${sanitizeBranchPart(input.runId).slice(0, 12)}`;
  const title = input.prTitle || `Droid run ${input.runId.slice(0, 8)}`;
  const body =
    input.prBody ||
    [
      `Droid run: ${input.runId}`,
      '',
      'Captured changes:',
      '```',
      patch.stat.trim() || patch.status.trim() || 'No diff stat available.',
      '```',
    ].join('\n');

  await input.recordEvent({
    type: 'pr_start',
    source: 'github',
    command: 'GitHub API create tree, commit, ref, draft PR',
    cwd: workspace,
    metadata: {
      repo,
      base_branch: baseBranch,
      head_branch: branchName,
      patch_bytes: patch.patchBytes,
      method: 'github_api',
    },
  });

  try {
    const baseRef = hydration.baseSha
      ? { object: { sha: hydration.baseSha } }
      : await githubRequest<{ object: { sha: string } }>(
          input,
          `/repos/${repo}/git/ref/heads/${encodePath(baseBranch)}`
        );
    const baseCommit = await githubRequest<{ tree: { sha: string } }>(
      input,
      `/repos/${repo}/git/commits/${baseRef.object.sha}`
    );
    const tree = await collectChangedTree(input, sandbox, workspace, repo, baseCommit.tree.sha);
    if (tree.entryCount === 0) {
      await input.recordEvent({
        type: 'pr_skipped',
        source: 'github',
        message: 'No changed files were found for PR creation.',
        metadata: { repo, base_branch: baseBranch, head_branch: branchName },
      });
      return { created: false };
    }

    const commit = await githubRequest<{ sha: string }>(input, `/repos/${repo}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({
        message: title,
        tree: tree.sha,
        parents: [baseRef.object.sha],
      }),
    });
    await githubRequest(input, `/repos/${repo}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: commit.sha,
      }),
    });
    const pr = await githubRequest<{ html_url: string; number: number }>(
      input,
      `/repos/${repo}/pulls`,
      {
        method: 'POST',
        body: JSON.stringify({
          title,
          body,
          head: branchName,
          base: baseBranch,
          draft: true,
        }),
      }
    );

    await input.recordEvent({
      type: 'pr_created',
      source: 'github',
      command: 'GitHub API draft PR',
      cwd: workspace,
      exit_code: 0,
      stdout: pr.html_url,
      metadata: {
        repo,
        base_branch: baseBranch,
        head_branch: branchName,
        title,
        pr_number: pr.number,
        tree_entries: tree.entryCount,
      },
    });
    await input.recordArtifact({
      type: 'pull_request',
      name: 'GitHub draft PR',
      uri: pr.html_url,
      metadata: {
        repo,
        base_branch: baseBranch,
        head_branch: branchName,
        title,
        pr_number: pr.number,
      },
    });
    return { created: true, url: pr.html_url, branch: branchName, number: pr.number, headSha: commit.sha };
  } catch (error) {
    await input.recordEvent({
      type: 'pr_failed',
      source: 'github',
      command: 'GitHub API draft PR',
      cwd: workspace,
      exit_code: 1,
      stderr: error instanceof Error ? error.message : 'GitHub PR creation failed.',
      metadata: {
        repo,
        base_branch: baseBranch,
        head_branch: branchName,
        title,
      },
    });
    return { created: false };
  }
}

async function finalizeWorkspacePatch(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  workspace: string,
  hydration: RepoHydration,
  result: CommandResult
): Promise<CommandResult> {
  const patch = await captureGitPatch(input, sandbox, workspace, result);
  const evidence = collectPrGateEvidence(patch);
  const finalEvidence = withAcceptanceChecks(evidence, input);

  if (!input.createPr) {
    const accepted = await runConfiguredAcceptance(input, sandbox, workspace);
    if (!accepted.success) {
    await recordStructuredFinal(input, accepted, finalEvidence, null, null, {
      summary: accepted.stderr || 'Droid acceptance command failed.',
      risks: [accepted.stderr || 'Droid acceptance command failed.'],
    });
      return accepted;
    }
    await recordStructuredFinal(input, result, finalEvidence, null, null);
    return result;
  }

  await input.recordEvent({
    type: 'pr_gate_start',
    actor: 'reviewer',
    source: 'worker',
    command: 'Droid PR gate',
    cwd: workspace,
    message: 'Checking whether Droid has enough evidence to open a draft PR.',
    metadata: {
      patch_changed: patch.changed,
      patch_bytes: patch.patchBytes,
      files_changed: evidence.filesChanged,
      checks_run: finalEvidence.checkCommands,
    },
  });

  if (!patch.changed || !evidence.meaningful) {
    const summary = patch.changed
      ? 'Droid captured a patch, but it did not include a meaningful changed-file summary.'
      : 'Droid did not produce repository changes, so no pull request was created.';
    await input.recordEvent({
      type: 'pr_gate_failed',
      actor: 'reviewer',
      source: 'worker',
      command: 'Droid PR gate',
      cwd: workspace,
      exit_code: 78,
      message: summary,
      metadata: {
        patch_changed: patch.changed,
        patch_bytes: patch.patchBytes,
        files_changed: evidence.filesChanged,
      },
    });
    await recordStructuredFinal(input, result, finalEvidence, null, null, { summary, risks: [summary] });
    return {
      stdout: result.stdout,
      stderr: appendTail(result.stderr, summary),
      exitCode: result.success ? 78 : result.exitCode,
      success: false,
    };
  }

  const review = await reviewPatchForPr(input, sandbox, workspace, patch, evidence);
  if (!review.approved) {
    await recordStructuredFinal(input, result, finalEvidence, null, null, {
      summary: review.summary || 'Droid patch review rejected PR creation.',
      risks: review.summary ? [review.summary] : [],
    });
    return {
      stdout: result.stdout,
      stderr: appendTail(
        result.stderr,
        review.summary || 'Droid patch review rejected PR creation.'
      ),
      exitCode: result.success ? 78 : result.exitCode,
      success: false,
    };
  }

  const accepted = await runConfiguredAcceptance(input, sandbox, workspace);
  if (!accepted.success) {
    const summary = accepted.stderr || 'Droid acceptance command failed, so no pull request was created.';
    await input.recordEvent({
      type: 'pr_gate_failed',
      actor: 'tester',
      source: 'worker',
      command: 'Droid acceptance gate',
      cwd: resolveWorkspaceCwd(workspace, input.cwd),
      exit_code: accepted.exitCode,
      stdout: accepted.stdout,
      stderr: accepted.stderr,
      message: summary,
      metadata: {
        patch_changed: patch.changed,
        patch_bytes: patch.patchBytes,
        files_changed: evidence.filesChanged,
        checks_run: finalEvidence.checkCommands,
      },
    });
    await recordStructuredFinal(input, accepted, finalEvidence, null, null, {
      summary,
      risks: [summary],
    });
    return accepted;
  }

  const pr = await createDraftPullRequestWithTimeout(
    input,
    sandbox,
    workspace,
    hydration,
    patch
  );
  if (!pr.created) {
    const summary = 'Droid could not create the requested pull request.';
    await recordStructuredFinal(input, result, finalEvidence, null, null, { summary, risks: [summary] });
    return {
      stdout: result.stdout,
      stderr: appendTail(result.stderr, summary),
      exitCode: result.success ? 78 : result.exitCode,
      success: false,
    };
  }

  await input.recordEvent({
    type: 'pr_gate_passed',
    actor: 'reviewer',
    source: 'worker',
    command: 'Droid PR gate',
    cwd: workspace,
    message: 'Droid PR gate passed and a draft PR was created.',
    metadata: {
      patch_bytes: patch.patchBytes,
      files_changed: evidence.filesChanged,
      checks_run: finalEvidence.checkCommands,
      pr_url: pr.url ?? null,
      pr_branch: pr.branch ?? null,
      pr_number: pr.number ?? null,
      head_sha: pr.headSha ?? null,
    },
  });
  await input.recordEvent({
    type: 'pr_followup_plan',
    actor: 'droid',
    source: 'worker',
    command: 'Droid PR follow-up',
    cwd: workspace,
    message: 'Droid opened a draft PR. If CI fails, rerun Droid on the same task with the PR context to repair the branch.',
    metadata: {
      pr_url: pr.url ?? null,
      pr_branch: pr.branch ?? null,
      pr_number: pr.number ?? null,
      head_sha: pr.headSha ?? null,
      next_action: 'Watch PR checks; if they fail, rerun Droid with this run id and PR URL.',
    },
  });
  await recordStructuredFinal(input, result, finalEvidence, pr.url ?? null, pr.branch ?? null, {
    nextAction: 'Review the draft PR and let Droid rerun if CI reports failures.',
  });
  return result;
}

async function runConfiguredAcceptance(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  workspace: string
): Promise<CommandResult> {
  if (!input.acceptanceCommand && !isBrowserAcceptanceEnabled(input.browserAcceptance)) {
    return { stdout: '', stderr: '', exitCode: 0, success: true };
  }
  const cwd = resolveWorkspaceCwd(workspace, input.cwd);
  if (input.acceptanceCommand) {
    const result = await runAcceptanceCommand(
      input,
      sandbox,
      cwd,
      input.acceptanceCommand,
      input.acceptanceTimeoutSeconds
    );
    if (!result.passed) {
      return {
        stdout: result.stdout,
        stderr: appendTail(result.stderr, result.summary),
        exitCode: result.exitCode || 78,
        success: false,
      };
    }
  }
  if (isBrowserAcceptanceEnabled(input.browserAcceptance)) {
    const browserResult = await runBrowserAcceptance(input, sandbox, cwd, input.browserAcceptance);
    if (!browserResult.passed) {
      return {
        stdout: browserResult.stdout,
        stderr: appendTail(browserResult.stderr, browserResult.summary),
        exitCode: 78,
        success: false,
      };
    }
    return {
      stdout: browserResult.stdout,
      stderr: browserResult.stderr,
      exitCode: 0,
      success: true,
    };
  }
  return { stdout: '', stderr: '', exitCode: 0, success: true };
}

function withAcceptanceChecks(
  evidence: PrGateEvidence,
  input: Parameters<RunExecutor['execute']>[0]
): PrGateEvidence {
  const checks = [...evidence.checkCommands];
  if (input.acceptanceCommand) checks.push(input.acceptanceCommand);
  if (isBrowserAcceptanceEnabled(input.browserAcceptance)) {
    const label = input.browserAcceptance.goal?.trim() || input.browserAcceptance.url?.trim() || 'browser acceptance';
    checks.push(`browser: ${label}`);
  }
  return {
    ...evidence,
    checkCommands: checks,
  };
}

async function recordStructuredFinal(
  input: Parameters<RunExecutor['execute']>[0],
  result: CommandResult,
  evidence: PrGateEvidence,
  prUrl: string | null,
  prBranch: string | null,
  override: { summary?: string; blockers?: string[]; risks?: string[]; nextAction?: string } = {}
): Promise<void> {
  const summary =
    override.summary ??
    (result.success
      ? `Droid run completed with exit code ${result.exitCode}.`
      : `Droid run failed with exit code ${result.exitCode}.`);
  const nextAction =
    override.nextAction ??
    (prUrl
      ? 'Review the draft PR and let Droid rerun if CI reports failures.'
      : result.success
        ? 'Review the run output.'
        : 'Inspect the Droid events and rerun after fixing the blocker.');
  await input.recordEvent({
    type: 'final_output',
    actor: 'droid',
    source: 'worker',
    message: summary,
    exit_code: result.exitCode,
    metadata: buildFinalReport({
      summary,
      filesChanged: evidence.filesChanged,
      checksRun: evidence.checkCommands,
      prUrl,
      prBranch,
      nextAction,
      blockers: override.blockers,
      risks: override.risks,
    }),
  });
  await syncTaskFromFinalReport(input, {
    summary,
    filesChanged: evidence.filesChanged,
    checksRun: evidence.checkCommands,
    prUrl,
    prBranch,
    nextAction,
    success: result.success,
    exitCode: result.exitCode,
    blockers: override.blockers ?? [],
    risks: override.risks ?? [],
  });
}

async function syncTaskFromFinalReport(
  input: Parameters<RunExecutor['execute']>[0],
  report: {
    summary: string;
    filesChanged: string[];
    checksRun: string[];
    prUrl: string | null;
    prBranch: string | null;
    nextAction: string;
    success: boolean;
    exitCode: number;
    blockers: string[];
    risks: string[];
  }
): Promise<void> {
  const client = await getTaskCallbackClient(input, 'task_final_callback_skipped');
  if (!client) return;

  const comment = [
    report.prUrl ? 'Droid opened a draft PR.' : report.success ? 'Droid finished the run.' : 'Droid finished with a failure.',
    '',
    `Summary: ${report.summary}`,
    report.prUrl ? `PR: ${report.prUrl}` : '',
    report.prBranch ? `Branch: ${report.prBranch}` : '',
    report.filesChanged.length ? `Files: ${report.filesChanged.slice(0, 8).join(', ')}${report.filesChanged.length > 8 ? ` +${report.filesChanged.length - 8}` : ''}` : '',
    report.checksRun.length ? `Checks: ${report.checksRun.join(', ')}` : '',
    report.risks.length ? `Risks: ${report.risks.join('; ')}` : '',
    report.blockers.length ? `Blockers: ${report.blockers.join('; ')}` : '',
    `Exit: ${report.exitCode}`,
    `Run: ${input.runId}`,
    `Next: ${report.nextAction}`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await postTaskComment(client, comment);
    if (report.prUrl) {
      await patchTask(client, {
        pr_url: report.prUrl,
        pr_status: 'draft',
        branch_name: report.prBranch,
        blocked_on_user: false,
      });
    }
    await input.recordEvent({
      type: 'task_final_callback_succeeded',
      actor: 'droid',
      source: 'saas-maker-api',
      message: 'Droid posted the final run summary back to the task.',
      metadata: {
        task_id: input.taskId ?? null,
        pr_url: report.prUrl,
        pr_branch: report.prBranch,
      },
    });
  } catch (error) {
    await input.recordEvent({
      type: 'task_final_callback_failed',
      actor: 'droid',
      source: 'saas-maker-api',
      message: error instanceof Error ? error.message : 'Failed to sync final run summary to task.',
      metadata: {
        task_id: input.taskId ?? null,
        pr_url: report.prUrl,
        pr_branch: report.prBranch,
      },
    });
  }
}

async function reviewPatchForPr(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  workspace: string,
  patch: { patchBytes: number; status: string; stat: string },
  evidence: PrGateEvidence
): Promise<{ approved: boolean; summary: string }> {
  const diffCheck = await sandboxExecWithWorkerTimeout(
    sandbox,
    `bash -lc ${quote(`cd ${quote(workspace)} && git diff --check -- .`)}`,
    { timeout: 30000 },
    40000
  );
  if (!diffCheck.success) {
    const summary = diffCheck.stderr || diffCheck.stdout || 'git diff --check failed.';
    await input.recordEvent({
      type: 'patch_review_failed',
      actor: 'reviewer',
      source: 'git',
      command: 'git diff --check -- .',
      cwd: workspace,
      exit_code: diffCheck.exitCode,
      stdout: diffCheck.stdout,
      stderr: diffCheck.stderr,
      message: summary,
      metadata: { patch_bytes: patch.patchBytes, files_changed: evidence.filesChanged },
    });
    return { approved: false, summary };
  }

  if (!input.env.DROID_DEEPSEEK_API_KEY) {
    await input.recordEvent({
      type: 'patch_review_approved',
      actor: 'reviewer',
      source: 'git',
      command: 'git diff --check -- .',
      cwd: workspace,
      message:
        'Patch passed local review. DeepSeek review skipped because no API key is configured.',
      metadata: {
        patch_bytes: patch.patchBytes,
        files_changed: evidence.filesChanged,
        review: 'local_only',
      },
    });
    return { approved: true, summary: 'Patch passed local review.' };
  }

  const diff = await sandboxExecWithWorkerTimeout(
    sandbox,
    `bash -lc ${quote(`cd ${quote(workspace)} && git diff HEAD --patch -- . | head -c 30000`)}`,
    { timeout: 30000 },
    40000
  );
  const review = await requestPatchReview(input, {
    prompt: input.prompt ?? input.command,
    stat: patch.stat,
    status: patch.status,
    diff: diff.stdout,
  });
  await input.recordEvent({
    type: review.approved ? 'patch_review_approved' : 'patch_review_rejected',
    actor: 'reviewer',
    source: 'deepseek',
    command: 'Droid patch review',
    cwd: workspace,
    message: review.summary,
    metadata: {
      patch_bytes: patch.patchBytes,
      files_changed: evidence.filesChanged,
      approved: review.approved,
      concerns: review.concerns,
    },
  });
  return { approved: review.approved, summary: review.summary };
}

async function requestPatchReview(
  input: Parameters<RunExecutor['execute']>[0],
  reviewInput: { prompt: string; stat: string; status: string; diff: string }
): Promise<{ approved: boolean; summary: string; concerns: string[] }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${input.env.DROID_DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: resolveDeepSeekModel(input.env.DROID_DEEPSEEK_REVIEW_MODEL, DEFAULT_REVIEW_MODEL),
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: [
              'You are a strict code-review gate for Droid before it opens a pull request.',
              'Return JSON only: {"decision":"approve"|"reject","summary":"...","concerns":["..."]}.',
              'Approve only if the patch appears to implement the requested task and is not just a stub, type-only placeholder, or obviously incomplete partial work.',
              'Reject patches that merely add unused interfaces/imports, leave the requested UI/API behavior absent, or show no meaningful implementation.',
            ].join('\n'),
          },
          {
            role: 'user',
            content: [
              'Task prompt:',
              reviewInput.prompt,
              '',
              'Git status:',
              reviewInput.status,
              '',
              'Diff stat:',
              reviewInput.stat,
              '',
              'Patch:',
              reviewInput.diff.slice(0, 30000),
            ].join('\n'),
          },
        ],
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`DeepSeek review API ${response.status}: ${text.slice(0, 500)}`);
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error('DeepSeek review response did not include content.');
    const parsed = parseReviewJson(content);
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await input.recordEvent({
      type: 'patch_review_failed',
      actor: 'reviewer',
      source: 'deepseek',
      command: 'Droid patch review',
      exit_code: 1,
      stderr: message,
      metadata: { fallback: 'reject' },
    });
    return { approved: false, summary: `Patch review failed: ${message}`, concerns: [message] };
  } finally {
    clearTimeout(timeout);
  }
}

function parseReviewJson(content: string): {
  approved: boolean;
  summary: string;
  concerns: string[];
} {
  const jsonText = content.trim().startsWith('{')
    ? content.trim()
    : content.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText)
    return {
      approved: false,
      summary: 'Patch review returned non-JSON output.',
      concerns: [content.slice(0, 300)],
    };
  const parsed = JSON.parse(jsonText) as {
    decision?: unknown;
    summary?: unknown;
    concerns?: unknown;
  };
  const concerns = Array.isArray(parsed.concerns)
    ? parsed.concerns.filter((item): item is string => typeof item === 'string')
    : [];
  return {
    approved: parsed.decision === 'approve',
    summary:
      typeof parsed.summary === 'string'
        ? parsed.summary
        : String(parsed.decision ?? 'No review summary.'),
    concerns,
  };
}

async function resolveHydrationForExistingWorkspace(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  workspace: string
): Promise<RepoHydration> {
  const repo = parseGitHubRepo(input.repoUrl ?? '');
  const branch =
    input.prBaseBranch || input.branch || (await currentGitBranch(sandbox, workspace)) || 'main';
  if (!repo) return { method: 'git_clone', baseBranch: branch };
  return { method: 'github_tarball', repo, baseBranch: branch };
}

async function currentGitBranch(
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  workspace: string
): Promise<string | undefined> {
  const result = await sandboxExecWithWorkerTimeout(
    sandbox,
    `git -C ${quote(workspace)} branch --show-current`,
    { timeout: 15000 },
    20000
  );
  return result.success && result.stdout.trim() ? result.stdout.trim() : undefined;
}

async function createDraftPullRequestWithTimeout(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  workspace: string,
  hydration: RepoHydration,
  patch: { patchBytes: number; status: string; stat: string }
): Promise<PrCreationResult> {
  const timeoutMs = 60000;
  let timedOut = false;
  const prPromise = createDraftPullRequest(input, sandbox, workspace, hydration, patch);
  const timeoutPromise = new Promise<PrCreationResult>((resolve) => {
    setTimeout(() => {
      timedOut = true;
      resolve({ created: false });
    }, timeoutMs);
  });
  const result = await Promise.race([prPromise, timeoutPromise]);
  if (!timedOut) return result;
  prPromise.catch(() => undefined);
  await input.recordEvent({
    type: 'pr_failed',
    source: 'github',
    command: 'GitHub API draft PR',
    cwd: workspace,
    exit_code: 124,
    stderr: `PR creation timed out after ${timeoutMs / 1000}s.`,
    metadata: {
      repo_url: input.repoUrl ?? null,
      method: hydration.method,
      timeout_ms: timeoutMs,
    },
  });
  return { created: false };
}

function parseGitHubRepo(repoUrl: string): string | null {
  const match = repoUrl.match(/^https:\/\/github\.com\/([^/]+\/[^/.]+)(?:\.git)?$/);
  return match?.[1] ?? null;
}

async function collectChangedTree(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  workspace: string,
  repo: string,
  baseTreeSha: string
): Promise<{ sha: string; entryCount: number }> {
  const changed = await sandbox.exec(
    `git -C ${quote(workspace)} diff --name-only --diff-filter=ACMRT HEAD -- .`,
    { timeout: 30000 }
  );
  const deleted = await sandbox.exec(
    `git -C ${quote(workspace)} diff --name-only --diff-filter=D HEAD -- .`,
    { timeout: 30000 }
  );
  const changedPaths = uniqueLines(changed.stdout);
  const deletedPaths = uniqueLines(deleted.stdout);
  const entries: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string | null }> = [];

  for (const path of changedPaths) {
    const content = await sandbox.exec(`base64 -w0 ${quote(`${workspace}/${path}`)}`, {
      timeout: 30000,
    });
    if (!content.success) continue;
    const blob = await githubRequest<{ sha: string }>(input, `/repos/${repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({
        content: content.stdout.trim(),
        encoding: 'base64',
      }),
    });
    entries.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  for (const path of deletedPaths) {
    entries.push({ path, mode: '100644', type: 'blob', sha: null });
  }

  if (entries.length === 0) return { sha: baseTreeSha, entryCount: 0 };

  const tree = await githubRequest<{ sha: string }>(input, `/repos/${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: entries,
    }),
  });
  return { sha: tree.sha, entryCount: entries.length };
}

async function githubRequest<T>(
  input: Parameters<RunExecutor['execute']>[0],
  path: string,
  init: RequestInit = {}
): Promise<T> {
  if (!input.env.DROID_GITHUB_TOKEN) {
    throw new Error('DROID_GITHUB_TOKEN is not configured');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let response: Response;
  try {
    response = await fetch(`https://api.github.com${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${input.env.DROID_GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'saas-maker-droid',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`GitHub API timeout for ${path}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  }
  return response.json() as Promise<T>;
}

function uniqueLines(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    )
  );
}

function encodePath(value: string): string {
  return value.split('/').map(encodeURIComponent).join('/');
}

function sanitizeBranchPart(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9._/-]+/g, '-')
      .replace(/^[-/.]+|[-/.]+$/g, '') || 'run'
  );
}

async function sandboxExecWithWorkerTimeout(
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  command: string,
  options: Parameters<Awaited<ReturnType<typeof getSandbox>>['exec']>[1],
  timeoutMs: number
): Promise<CommandResult> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const execPromise = sandbox.exec(command, options);
  execPromise.catch(() => undefined);
  try {
    return await Promise.race([
      execPromise,
      new Promise<CommandResult>((resolve) => {
        timeout = setTimeout(
          () =>
            resolve({
              stdout: '',
              stderr: `Sandbox exec Worker watchdog timed out after ${timeoutMs}ms.`,
              exitCode: 124,
              success: false,
            }),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function appendTail(current: string, next: string, maxLength = 200000): string {
  const value = current + next;
  return value.length > maxLength ? value.slice(value.length - maxLength) : value;
}

function resolveNativePath(cwd: string, value: string): string {
  if (value.startsWith('/')) throw new Error('Native tool paths must be relative');
  const parts = value.split('/').filter((part) => part && part !== '.');
  if (parts.includes('..')) throw new Error('Native tool paths cannot include ..');
  return parts.length === 0 ? cwd : `${cwd}/${parts.join('/')}`;
}

function dirname(path: string): string {
  const index = path.lastIndexOf('/');
  return index <= 0 ? '/' : path.slice(0, index);
}

function normalizeLineNumber(value: number | undefined, fallback: number): number {
  if (!Number.isInteger(value) || value === undefined || value < 1) return fallback;
  return value;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function summarizeNativeAction(action: NativeAgentAction): string {
  if (action.action === 'list') return `list ${action.path ?? '.'}`;
  if (action.action === 'read') return `read ${action.path}`;
  if (action.action === 'write') return `write ${action.path}`;
  if (action.action === 'command') return `command ${action.command}`;
  if (action.action === 'block') return `block ${action.reason.slice(0, 120)}`;
  return `final ${action.summary.slice(0, 120)}`;
}

function scrubNativeAction(action: NativeAgentAction, turn: number): Record<string, unknown> {
  if (action.action === 'write') {
    return {
      turn,
      action: action.action,
      path: action.path,
      bytes: new TextEncoder().encode(action.content).length,
    };
  }
  if (action.action === 'final') {
    return { turn, action: action.action, summary: action.summary.slice(0, 500) };
  }
  if (action.action === 'block') {
    return {
      turn,
      action: action.action,
      reason: action.reason.slice(0, 500),
      question: action.question.slice(0, 500),
      summary: action.summary?.slice(0, 500) ?? null,
    };
  }
  return { turn, ...action };
}

function truncateForEvent(value: string): string {
  return truncateForModel(value, 6000);
}

function truncateForModel(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n...[truncated ${value.length - maxChars} chars]`;
}

function quote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function resolveWorkspaceCwd(workspace: string, cwd: string | undefined): string {
  if (!cwd || cwd === '.') return workspace;
  const normalized = cwd
    .replace(/^\/+/, '')
    .split('/')
    .filter((part) => part && part !== '.');
  if (normalized.includes('..')) return workspace;
  return `${workspace}/${normalized.join('/')}`;
}
