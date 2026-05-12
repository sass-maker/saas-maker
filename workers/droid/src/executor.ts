import { getSandbox } from '@cloudflare/sandbox';
import type { CommandResult, RunExecutor } from './types';
import { captureGitPatch } from './patch';

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

type NativeAgentAction =
  | { action: 'list'; path?: string }
  | { action: 'read'; path: string; start_line?: number; end_line?: number }
  | { action: 'write'; path: string; content: string }
  | { action: 'command'; command: string; timeout_seconds?: number }
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

export const sandboxExecutor: RunExecutor = {
  async execute(input): Promise<CommandResult> {
    const sandbox = getDroidSandbox(input.env.Sandbox, input.sandboxId);
    const workspace = '/workspace/repo';
    let hydration: RepoHydration = { method: 'empty' };

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
        await input.recordEvent({ type: 'sandbox_destroy', message: `Destroying sandbox ${input.sandboxId}` });
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
      await finalizeWorkspacePatch(input, sandbox, workspace, hydration, result);
      if (input.destroyAfterRun) {
        await input.recordEvent({ type: 'sandbox_destroy', message: `Destroying sandbox ${input.sandboxId}` });
        await sandbox.destroy();
      }
      return result;
    }

    await input.recordEvent({ type: 'command_start', command: input.command, cwd });
    const result = await sandbox.exec(`cd ${quote(cwd)} && ${input.command}`, { timeout: input.timeoutSeconds * 1000 });
    await input.recordEvent({
      type: 'command_finish',
      command: input.command,
      cwd,
      exit_code: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    });

    await finalizeWorkspacePatch(input, sandbox, workspace, hydration, result);

    if (input.destroyAfterRun) {
      await input.recordEvent({ type: 'sandbox_destroy', message: `Destroying sandbox ${input.sandboxId}` });
      await sandbox.destroy();
    }

    return result;
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
        await input.recordEvent({ type: 'sandbox_destroy', message: `Destroying sandbox ${input.sandboxId}` });
        await sandbox.destroy();
      }
      return missing;
    }

    const hydration = await resolveHydrationForExistingWorkspace(input, sandbox, workspace);
    const finalResult = await finalizeWorkspacePatch(input, sandbox, workspace, hydration, result);
    if (input.destroyAfterRun) {
      await input.recordEvent({ type: 'sandbox_destroy', message: `Destroying sandbox ${input.sandboxId}` });
      await sandbox.destroy();
    }
    await input.recordEvent({
      type: 'reconcile_finish',
      message: finalResult.success ? 'Droid reconcile finished.' : 'Droid reconcile found unresolved work.',
      command: 'droid reconcile',
      cwd: workspace,
      exit_code: finalResult.exitCode,
    });
    return finalResult;
  },
  async cancel(input): Promise<void> {
    const sandbox = getDroidSandbox(input.env.Sandbox, input.sandboxId);
    const capturePromise = captureGitPatch({
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
    }, sandbox, '/workspace/repo', {
      stdout: '',
      stderr: 'Run cancelled.',
      exitCode: 130,
      success: false,
    }).catch((error) => input.recordEvent({
      type: 'patch_capture_failed',
      source: 'sandbox',
      message: error instanceof Error ? error.message : 'Patch capture during cancel failed.',
      exit_code: 1,
    }));
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
    await input.recordEvent({ type: 'sandbox_destroy', message: `Destroying sandbox ${input.sandboxId}` });
    await sandbox.destroy();
  },
};

function getDroidSandbox(ns: Parameters<typeof getSandbox>[0], sandboxId: string): ReturnType<typeof getSandbox> {
  return getSandbox(ns, sandboxId, {
    keepAlive: true,
    containerTimeouts: {
      instanceGetTimeoutMS: 180000,
      portReadyTimeoutMS: 240000,
      waitIntervalMS: 1000,
    },
  });
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
  if (input.mode === 'native') return runNativeAgent(input, sandbox, cwd);
  if (input.mode === 'aider') return runAider(input, sandbox, cwd);
  if (input.mode === 'kilo') return runKilo(input, sandbox, cwd);
  if (input.mode === 'opencode') return runOpenCode(input, sandbox, cwd);
  return runClaudeCode(input, sandbox, cwd);
}

async function requireDeepSeekKey(input: Parameters<RunExecutor['execute']>[0]): Promise<CommandResult | null> {
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

async function runNativeAgent(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  cwd: string
): Promise<CommandResult> {
  const missingKey = await requireDeepSeekKey(input);
  if (missingKey) return missingKey;

  const model = 'deepseek-reasoner';
  const maxTurns = input.maxTurns ?? 20;
  const transcript: string[] = [];
  const messages: NativeChatMessage[] = [
    { role: 'system', content: buildNativeSystemPrompt(cwd) },
    { role: 'user', content: input.prompt ?? '' },
  ];

  await input.recordEvent({
    type: 'agent_start',
    actor: 'native',
    source: 'deepseek',
    command: 'droid native tool loop',
    cwd,
    metadata: { provider: input.provider ?? 'deepseek', model, max_turns: maxTurns, timeout_seconds: input.timeoutSeconds },
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
        metadata: { provider: input.provider ?? 'deepseek', model, max_turns: maxTurns, turns: turn },
      });
      return { stdout: `${transcript.join('\n')}\n\n${action.summary}\n`, stderr: '', exitCode: 0, success: true };
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
    '{"action":"final","summary":"what changed and what was verified"}',
    'Use relative paths only. Read files before editing unless the task is explicitly to create a new file.',
    'Prefer small diffs. Run the smallest useful check before final when possible.',
  ].join('\n');
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
        'Authorization': `Bearer ${input.env.DROID_DEEPSEEK_API_KEY}`,
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
    throw new Error(`DeepSeek API ${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  }

  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
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
  if (parsed.action === 'write' && typeof parsed.path === 'string' && typeof parsed.content === 'string') {
    return { action: 'write', path: parsed.path, content: parsed.content };
  }
  if (parsed.action === 'command' && typeof parsed.command === 'string') {
    return { action: 'command', command: parsed.command, timeout_seconds: numberOrUndefined(parsed.timeout_seconds) };
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
  action: Exclude<NativeAgentAction, { action: 'final' }>
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
  return { ok: true, output: `wrote ${action.path} (${new TextEncoder().encode(action.content).length} bytes)`, exitCode: 0 };
}

async function nativeCommand(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  cwd: string,
  action: Extract<NativeAgentAction, { action: 'command' }>
): Promise<NativeToolResult> {
  const timeoutSeconds = Math.min(Math.max(action.timeout_seconds ?? 120, 5), Math.min(input.timeoutSeconds, 300));
  await input.recordEvent({
    type: 'command_start',
    actor: 'native',
    source: 'tool',
    command: action.command,
    cwd,
    metadata: { timeout_seconds: timeoutSeconds },
  });
  const result = await sandbox.exec(`cd ${quote(cwd)} && timeout ${timeoutSeconds}s bash -lc ${quote(action.command)}`, {
    timeout: (timeoutSeconds + 15) * 1000,
  });
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
    output: truncateForModel([result.stdout, result.stderr ? `stderr:\n${result.stderr}` : ''].filter(Boolean).join('\n'), 12000),
    exitCode: result.exitCode,
  };
}

async function runClaudeCode(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  cwd: string
): Promise<CommandResult> {
  const missingKey = await requireDeepSeekKey(input);
  if (missingKey) return missingKey;
  const deepSeekApiKey = input.env.DROID_DEEPSEEK_API_KEY ?? '';

  await sandbox.writeFile('/tmp/droid-agent-prompt.txt', input.prompt ?? '');
  await sandbox.writeFile('/tmp/droid-agent-env', [
    `ANTHROPIC_BASE_URL=${shellEnvValue('https://api.deepseek.com/anthropic')}`,
    `ANTHROPIC_AUTH_TOKEN=${shellEnvValue(deepSeekApiKey)}`,
    `ANTHROPIC_MODEL=${shellEnvValue('deepseek-v4-pro[1m]')}`,
    `ANTHROPIC_DEFAULT_OPUS_MODEL=${shellEnvValue('deepseek-v4-pro[1m]')}`,
    `ANTHROPIC_DEFAULT_SONNET_MODEL=${shellEnvValue('deepseek-v4-pro[1m]')}`,
    `ANTHROPIC_DEFAULT_HAIKU_MODEL=${shellEnvValue('deepseek-v4-flash')}`,
    `CLAUDE_CODE_SUBAGENT_MODEL=${shellEnvValue('deepseek-v4-flash')}`,
    `CLAUDE_CODE_EFFORT_LEVEL=${shellEnvValue('max')}`,
  ].join('\n'));

  const maxTurns = input.maxTurns ?? 25;
  const timeoutSeconds = input.timeoutSeconds;
  const safeCommand = `claude -p <prompt> --cwd ${cwd} --max-turns ${maxTurns}`;
  await input.recordEvent({
    type: 'agent_start',
    actor: 'claude_code',
    source: 'deepseek',
    command: safeCommand,
    cwd,
    metadata: { provider: input.provider ?? 'deepseek', max_turns: maxTurns, timeout_seconds: timeoutSeconds },
  });

  const claudeScript = [
    'set -a',
    '. /tmp/droid-agent-env',
    'set +a',
    `cd ${quote(cwd)}`,
    [
      'claude',
      '-p "$(cat /tmp/droid-agent-prompt.txt)"',
      '--output-format text',
      `--max-turns ${maxTurns}`,
      '--permission-mode acceptEdits',
      '--allowedTools "Bash,Read,Edit,MultiEdit,Write"',
    ].join(' '),
  ].join(' && ');
  const result = await sandbox.exec(`timeout ${timeoutSeconds}s bash -lc ${quote(claudeScript)}`, {
    timeout: (timeoutSeconds + 15) * 1000,
  });

  await input.recordEvent({
    type: 'agent_finish',
    actor: 'claude_code',
    source: 'deepseek',
    command: safeCommand,
    cwd,
    exit_code: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    metadata: { provider: input.provider ?? 'deepseek', max_turns: maxTurns, timeout_seconds: timeoutSeconds },
  });

  return result;
}

async function runOpenCode(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  cwd: string
): Promise<CommandResult> {
  const missingKey = await requireDeepSeekKey(input);
  if (missingKey) return missingKey;

  await sandbox.writeFile('/tmp/droid-agent-prompt.txt', input.prompt ?? '');
  await sandbox.writeFile('/tmp/droid-opencode.json', JSON.stringify(buildOpenCodeConfig(), null, 2));

  const timeoutSeconds = Math.min(input.timeoutSeconds, 240);
  const maxPasses = Math.max(1, Math.min(input.maxTurns ?? 3, 6));
  const idleTimeoutSeconds = Math.min(180, Math.max(60, Math.floor(timeoutSeconds / 5)));
  const passTimeoutSeconds = Math.max(120, Math.min(420, Math.floor(timeoutSeconds / maxPasses)));
  const model = 'deepseek/deepseek-v4-pro';
  const safeCommand = `droid-supervisor --model ${model} --max-passes ${maxPasses} <prompt>`;
  const preflight = await runOpenCodePreflight(input, sandbox, cwd, model);
  if (!preflight.success) return preflight;

  await input.recordEvent({
    type: 'agent_start',
    actor: 'opencode',
    source: 'deepseek',
    command: safeCommand,
    cwd,
    metadata: {
      provider: input.provider ?? 'deepseek',
      model,
      max_passes: maxPasses,
      timeout_seconds: timeoutSeconds,
      requested_timeout_seconds: input.timeoutSeconds,
      idle_timeout_seconds: idleTimeoutSeconds,
      pass_timeout_seconds: passTimeoutSeconds,
      config: 'supervised-headless',
    },
  });

  const opencodeScript = [
    `cd ${quote(cwd)} || exit $?`,
    'command -v droid-supervisor >/dev/null || exit 127',
    'command -v timeout >/dev/null || exit 127',
    [
      'timeout',
      '--kill-after=10s',
      `${timeoutSeconds}s`,
      'droid-supervisor',
      `--repo ${quote(cwd)}`,
      '--prompt-file /tmp/droid-agent-prompt.txt',
      `--model ${quote(model)}`,
      `--max-passes ${maxPasses}`,
      `--idle-timeout ${idleTimeoutSeconds}`,
      `--pass-timeout ${passTimeoutSeconds}`,
      '--validation "git add -N . && git diff --check -- ."',
    ].join(' '),
  ].join('\n');
  const result = await sandboxBackgroundSupervisorWithPoll(
    input,
    sandbox,
    opencodeScript,
    {
      DEEPSEEK_API_KEY: input.env.DROID_DEEPSEEK_API_KEY,
      OPENCODE_CONFIG: '/tmp/droid-opencode.json',
    },
    (timeoutSeconds + 45) * 1000,
    safeCommand,
    cwd
  );
  if (result.exitCode === 124) {
    await input.recordEvent({
      type: 'agent_idle_timeout',
      actor: 'opencode',
      source: 'droid',
      command: safeCommand,
      cwd,
      exit_code: result.exitCode,
      stderr: result.stderr,
      metadata: { idle_timeout_seconds: idleTimeoutSeconds, timeout_seconds: timeoutSeconds, requested_timeout_seconds: input.timeoutSeconds, max_passes: maxPasses },
    });
  }

  await input.recordEvent({
    type: 'agent_finish',
    actor: 'opencode',
    source: 'deepseek',
    command: safeCommand,
    cwd,
    exit_code: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    metadata: {
      provider: input.provider ?? 'deepseek',
      model,
      max_passes: maxPasses,
      timeout_seconds: timeoutSeconds,
      requested_timeout_seconds: input.timeoutSeconds,
      idle_timeout_seconds: idleTimeoutSeconds,
      pass_timeout_seconds: passTimeoutSeconds,
    },
  });

  return result;
}

async function runOpenCodePreflight(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  cwd: string,
  model: string
): Promise<CommandResult> {
  const command = `opencode preflight ${model}`;
  await input.recordEvent({
    type: 'agent_preflight_start',
    actor: 'opencode',
    source: 'droid',
    command,
    cwd,
    metadata: { model },
  });

  const script = [
    'set -e',
    `cd ${quote(cwd)}`,
    'command -v node',
    'node --version',
    'command -v npm',
    'npm --version',
    'command -v opencode',
    'opencode --version',
    'command -v droid-supervisor',
    'node /usr/local/bin/droid-supervisor --help >/dev/null 2>&1 || true',
  ].join('\n');

  const result = await sandboxExecWithWorkerTimeout(
    sandbox,
    `bash -lc ${quote(script)}`,
    {
      timeout: 30000,
      env: {
        DEEPSEEK_API_KEY: input.env.DROID_DEEPSEEK_API_KEY,
        OPENCODE_CONFIG: '/tmp/droid-opencode.json',
      },
    },
    45000
  );

  await input.recordEvent({
    type: result.success ? 'agent_preflight_finish' : 'agent_preflight_failed',
    actor: 'opencode',
    source: 'droid',
    command,
    cwd,
    exit_code: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    metadata: { model },
  });

  return result;
}

async function runKilo(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  cwd: string
): Promise<CommandResult> {
  const missingKey = await requireDeepSeekKey(input);
  if (missingKey) return missingKey;

  await sandbox.writeFile('/tmp/droid-agent-prompt.txt', input.prompt ?? '');
  await sandbox.writeFile('/tmp/droid-kilo.json', JSON.stringify(buildKiloConfig(), null, 2));

  const timeoutSeconds = input.timeoutSeconds;
  const model = 'deepseek/deepseek-v4-flash';
  const safeCommand = `kilo run --auto --format json --agent build --model ${model} --dir ${cwd} <prompt>`;
  await input.recordEvent({
    type: 'agent_start',
    actor: 'kilo',
    source: 'deepseek',
    command: safeCommand,
    cwd,
    metadata: { provider: input.provider ?? 'deepseek', model, timeout_seconds: timeoutSeconds, config: 'headless' },
  });

  const kiloScript = [
    `cd ${quote(cwd)}`,
    'if command -v kilo >/dev/null 2>&1; then droid_kilo=kilo; else droid_kilo="npx -y --package=@kilocode/cli kilo"; fi',
    [
      '$droid_kilo',
      'run',
      '--pure',
      '--format json',
      '--print-logs',
      '--log-level DEBUG',
      '--agent build',
      '--auto',
      `--model ${quote(model)}`,
      '--dir .',
      '"$(cat /tmp/droid-agent-prompt.txt)"',
    ].join(' '),
  ].join(' && ');
  const result = await sandbox.exec(`timeout ${timeoutSeconds}s bash -lc ${quote(kiloScript)}`, {
    timeout: (timeoutSeconds + 15) * 1000,
    env: {
      DEEPSEEK_API_KEY: input.env.DROID_DEEPSEEK_API_KEY,
      KILO_CONFIG: '/tmp/droid-kilo.json',
    },
  });

  await input.recordEvent({
    type: 'agent_finish',
    actor: 'kilo',
    source: 'deepseek',
    command: safeCommand,
    cwd,
    exit_code: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    metadata: { provider: input.provider ?? 'deepseek', model, timeout_seconds: timeoutSeconds },
  });

  return result;
}

async function runAider(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  cwd: string
): Promise<CommandResult> {
  const missingKey = await requireDeepSeekKey(input);
  if (missingKey) return missingKey;

  await sandbox.writeFile('/tmp/droid-agent-prompt.txt', input.prompt ?? '');

  const timeoutSeconds = input.timeoutSeconds;
  const model = 'deepseek/deepseek-chat';
  const apiTimeout = Math.max(30, timeoutSeconds - 30);
  const safeCommand = `aider --model ${model} --message-file <prompt> --yes-always`;
  await input.recordEvent({
    type: 'agent_start',
    actor: 'aider',
    source: 'deepseek',
    command: safeCommand,
    cwd,
    metadata: { provider: input.provider ?? 'deepseek', model, timeout_seconds: timeoutSeconds, api_timeout_seconds: apiTimeout },
  });

  const aiderScript = [
    `cd ${quote(cwd)}`,
    'if command -v aider >/dev/null 2>&1; then droid_aider=aider; elif python3 -m aider --version >/dev/null 2>&1; then droid_aider="python3 -m aider"; else droid_aider="uvx --from aider-chat aider"; fi',
    [
      '$droid_aider',
      `--model ${quote(model)}`,
      '--message-file /tmp/droid-agent-prompt.txt',
      '--yes-always',
      '--no-auto-commits',
      '--no-dirty-commits',
      '--no-stream',
      '--no-check-update',
      '--analytics-disable',
      '--no-show-model-warnings',
      `--timeout ${apiTimeout}`,
    ].join(' '),
  ].join(' && ');
  const result = await sandbox.exec(`timeout ${timeoutSeconds}s bash -lc ${quote(aiderScript)}`, {
    timeout: (timeoutSeconds + 15) * 1000,
    env: { DEEPSEEK_API_KEY: input.env.DROID_DEEPSEEK_API_KEY },
  });

  await input.recordEvent({
    type: 'agent_finish',
    actor: 'aider',
    source: 'deepseek',
    command: safeCommand,
    cwd,
    exit_code: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    metadata: { provider: input.provider ?? 'deepseek', model, timeout_seconds: timeoutSeconds, api_timeout_seconds: apiTimeout },
  });

  return result;
}

function buildOpenCodeConfig() {
  return {
    $schema: 'https://opencode.ai/config.json',
    model: 'deepseek/deepseek-v4-pro',
    share: 'disabled',
    snapshot: false,
    autoupdate: false,
    enabled_providers: ['deepseek'],
    watcher: {
      ignore: ['.git/**', 'node_modules/**', 'dist/**', '.next/**', 'coverage/**'],
    },
    permission: {
      '*': 'allow',
      question: 'deny',
      task: 'deny',
      todowrite: 'deny',
      webfetch: 'deny',
      websearch: 'deny',
      lsp: 'deny',
      skill: 'deny',
      external_directory: 'allow',
      doom_loop: 'allow',
    },
    provider: {
      deepseek: {
        options: {
          apiKey: '{env:DEEPSEEK_API_KEY}',
          timeout: 240000,
          chunkTimeout: 60000,
        },
      },
    },
  };
}

function buildKiloConfig() {
  return {
    model: 'deepseek/deepseek-v4-flash',
    share: 'disabled',
    snapshot: false,
    autoupdate: false,
    enabled_providers: ['deepseek'],
    permission: {
      '*': 'allow',
      question: 'deny',
      task: 'deny',
      todowrite: 'deny',
      webfetch: 'deny',
      websearch: 'deny',
      lsp: 'deny',
      skill: 'deny',
      external_directory: 'allow',
      doom_loop: 'allow',
    },
    provider: {
      deepseek: {
        options: {
          apiKey: '{env:DEEPSEEK_API_KEY}',
          timeout: 240000,
          chunkTimeout: 60000,
        },
      },
    },
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
    const baseRef = await githubRequest<{ object: { sha: string } }>(input, `/repos/${repo}/git/ref/heads/${encodePath(baseBranch)}`);
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
      metadata: { repo, branch: baseBranch, github_token: Boolean(input.env.DROID_GITHUB_TOKEN), method: 'github_tarball' },
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
  const result = await sandbox.exec([
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
  ].join('\n'), { timeout: 150000 });
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

  const authedRepoUrl = input.repoUrl.replace('https://github.com/', `https://x-access-token:${input.env.DROID_GITHUB_TOKEN}@github.com/`);
  await sandbox.writeFile('/tmp/droid-github-repo-url', authedRepoUrl);
  await sandbox.writeFile('/tmp/droid-github-token', input.env.DROID_GITHUB_TOKEN);
  await sandbox.writeFile('/tmp/droid-git-askpass', [
    '#!/bin/sh',
    'case "$1" in',
    '  *Username*) echo x-access-token ;;',
    '  *Password*) cat /tmp/droid-github-token ;;',
    '  *) echo "" ;;',
    'esac',
  ].join('\n'));
  await sandbox.exec('chmod 700 /tmp/droid-git-askpass && chmod 600 /tmp/droid-github-token /tmp/droid-github-repo-url', { timeout: 30000 });
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
): Promise<void> {
  if (!input.env.DROID_GITHUB_TOKEN || !hydration.repo) {
    await input.recordEvent({
      type: 'pr_skipped',
      source: 'github',
      message: 'DROID_GITHUB_TOKEN or GitHub repo metadata is not configured.',
      metadata: { github_token: Boolean(input.env.DROID_GITHUB_TOKEN), repo_url: input.repoUrl ?? null, method: hydration.method },
    });
    return;
  }

  const repo = hydration.repo;
  const baseBranch = input.prBaseBranch || hydration.baseBranch || input.branch || 'main';
  const branchName = `droid/${sanitizeBranchPart(input.runId).slice(0, 12)}`;
  const title = input.prTitle || `Droid run ${input.runId.slice(0, 8)}`;
  const body = input.prBody || [
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
      : await githubRequest<{ object: { sha: string } }>(input, `/repos/${repo}/git/ref/heads/${encodePath(baseBranch)}`);
    const baseCommit = await githubRequest<{ tree: { sha: string } }>(input, `/repos/${repo}/git/commits/${baseRef.object.sha}`);
    const tree = await collectChangedTree(input, sandbox, workspace, repo, baseCommit.tree.sha);
    if (tree.entryCount === 0) {
      await input.recordEvent({
        type: 'pr_skipped',
        source: 'github',
        message: 'No changed files were found for PR creation.',
        metadata: { repo, base_branch: baseBranch, head_branch: branchName },
      });
      return;
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
    const pr = await githubRequest<{ html_url: string; number: number }>(input, `/repos/${repo}/pulls`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        body,
        head: branchName,
        base: baseBranch,
        draft: true,
      }),
    });

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
      metadata: { repo, base_branch: baseBranch, head_branch: branchName, title, pr_number: pr.number },
    });
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
  if (!patch.changed || !input.createPr) return result;

  const review = await reviewPatchForPr(input, sandbox, workspace, patch);
  if (!review.approved) {
    return {
      stdout: result.stdout,
      stderr: appendTail(result.stderr, review.summary || 'Droid patch review rejected PR creation.'),
      exitCode: result.success ? 78 : result.exitCode,
      success: false,
    };
  }

  await createDraftPullRequestWithTimeout(input, sandbox, workspace, hydration, patch);
  return result;
}

async function reviewPatchForPr(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  workspace: string,
  patch: { patchBytes: number; status: string; stat: string }
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
      metadata: { patch_bytes: patch.patchBytes },
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
      message: 'Patch passed local review. DeepSeek review skipped because no API key is configured.',
      metadata: { patch_bytes: patch.patchBytes, review: 'local_only' },
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
        'Authorization': `Bearer ${input.env.DROID_DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
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
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
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

function parseReviewJson(content: string): { approved: boolean; summary: string; concerns: string[] } {
  const jsonText = content.trim().startsWith('{') ? content.trim() : content.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) return { approved: false, summary: 'Patch review returned non-JSON output.', concerns: [content.slice(0, 300)] };
  const parsed = JSON.parse(jsonText) as { decision?: unknown; summary?: unknown; concerns?: unknown };
  const concerns = Array.isArray(parsed.concerns) ? parsed.concerns.filter((item): item is string => typeof item === 'string') : [];
  return {
    approved: parsed.decision === 'approve',
    summary: typeof parsed.summary === 'string' ? parsed.summary : String(parsed.decision ?? 'No review summary.'),
    concerns,
  };
}

async function resolveHydrationForExistingWorkspace(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  workspace: string
): Promise<RepoHydration> {
  const repo = parseGitHubRepo(input.repoUrl ?? '');
  const branch = input.prBaseBranch || input.branch || await currentGitBranch(sandbox, workspace) || 'main';
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
): Promise<void> {
  const timeoutMs = 60000;
  let timedOut = false;
  const prPromise = createDraftPullRequest(input, sandbox, workspace, hydration, patch);
  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      timedOut = true;
      resolve();
    }, timeoutMs);
  });
  await Promise.race([prPromise, timeoutPromise]);
  if (!timedOut) return;
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
  const changed = await sandbox.exec(`git -C ${quote(workspace)} diff --name-only --diff-filter=ACMRT HEAD -- .`, { timeout: 30000 });
  const deleted = await sandbox.exec(`git -C ${quote(workspace)} diff --name-only --diff-filter=D HEAD -- .`, { timeout: 30000 });
  const changedPaths = uniqueLines(changed.stdout);
  const deletedPaths = uniqueLines(deleted.stdout);
  const entries: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string | null }> = [];

  for (const path of changedPaths) {
    const content = await sandbox.exec(`base64 -w0 ${quote(`${workspace}/${path}`)}`, { timeout: 30000 });
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
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${input.env.DROID_GITHUB_TOKEN}`,
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
  return Array.from(new Set(value.split('\n').map((line) => line.trim()).filter(Boolean)));
}

function encodePath(value: string): string {
  return value.split('/').map(encodeURIComponent).join('/');
}

function sanitizeBranchPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._/-]+/g, '-').replace(/^[-/.]+|[-/.]+$/g, '') || 'run';
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
        timeout = setTimeout(() => resolve({
          stdout: '',
          stderr: `Sandbox exec Worker watchdog timed out after ${timeoutMs}ms.`,
          exitCode: 124,
          success: false,
        }), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function sandboxBackgroundSupervisorWithPoll(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  script: string,
  env: Record<string, string | undefined>,
  timeoutMs: number,
  safeCommand: string,
  cwd: string
): Promise<CommandResult> {
  const prefix = `/tmp/droid-supervisor-${sanitizeBranchPart(input.runId).slice(0, 16)}`;
  const scriptPath = `${prefix}.sh`;
  const stdoutPath = `${prefix}.stdout`;
  const stderrPath = `${prefix}.stderr`;
  const exitPath = `${prefix}.exit`;
  const pidPath = `${prefix}.pid`;
  const launchPath = `${prefix}.launch`;
  const startedAt = Date.now();
  let stdout = '';
  let stderr = '';
  let lastOutputBytes = -1;
  let lastOutputEventAt = 0;

  await sandbox.writeFile(scriptPath, [
    '#!/usr/bin/env bash',
    'set +e',
    script,
    'code=$?',
    `printf "%s" "$code" > ${quote(exitPath)}`,
    'exit "$code"',
  ].join('\n'));

  const launch = await sandboxExecWithWorkerTimeout(
    sandbox,
    `bash -lc ${quote([
      `rm -f ${quote(stdoutPath)} ${quote(stderrPath)} ${quote(exitPath)} ${quote(pidPath)} ${quote(launchPath)}`,
      `chmod +x ${quote(scriptPath)}`,
      `if command -v setsid >/dev/null 2>&1; then nohup setsid ${quote(scriptPath)} > ${quote(stdoutPath)} 2> ${quote(stderrPath)} & else nohup ${quote(scriptPath)} > ${quote(stdoutPath)} 2> ${quote(stderrPath)} & fi`,
      `echo $! > ${quote(pidPath)}`,
      `cat ${quote(pidPath)}`,
    ].join('\n'))}`,
    { timeout: 15000, env },
    20000
  );
  if (!launch.success) return launch;

  await input.recordEvent({
    type: 'agent_process_start',
    actor: 'supervisor',
    source: 'droid',
    command: safeCommand,
    cwd,
    stdout: launch.stdout,
    stderr: launch.stderr,
    metadata: { pid: launch.stdout.trim() || null, mode: 'detached_file_poll' },
  });

  while (Date.now() - startedAt < timeoutMs) {
    const poll = await sandboxExecWithWorkerTimeout(
      sandbox,
      `bash -lc ${quote(buildSupervisorPollScript(stdoutPath, stderrPath, exitPath))}`,
      { timeout: 15000 },
      20000
    );
    if (!poll.success) {
      stderr = appendTail(stderr, poll.stderr || 'Supervisor poll failed.');
    } else {
      const parsed = parseSupervisorPoll(poll.stdout);
      stdout = trimTail(parsed.stdout);
      stderr = trimTail(parsed.stderr);
      const outputBytes = parsed.stdoutBytes + parsed.stderrBytes;
      const now = Date.now();
      if (outputBytes !== lastOutputBytes && now - lastOutputEventAt >= 15000) {
        lastOutputBytes = outputBytes;
        lastOutputEventAt = now;
        await input.recordEvent({
          type: 'agent_process_poll',
          actor: 'supervisor',
          source: 'droid',
          command: safeCommand,
          cwd,
          stdout: stdout.slice(-4000),
          stderr: stderr.slice(-4000),
          metadata: {
            status: parsed.done ? 'completed' : 'running',
            exit_code: parsed.exitCode,
            stdout_bytes: parsed.stdoutBytes,
            stderr_bytes: parsed.stderrBytes,
          },
        });
      }
      if (parsed.done) {
        await sandbox.exec(`rm -f ${quote(scriptPath)} ${quote(pidPath)} ${quote(launchPath)}`, { timeout: 15000 }).catch(() => undefined);
        return {
          stdout,
          stderr,
          exitCode: parsed.exitCode ?? 1,
          success: parsed.exitCode === 0,
        };
      }
    }
    await sleep(5000);
  }

  const timeoutMessage = `Droid supervisor file poller timed out after ${timeoutMs}ms.`;
  await input.recordEvent({
    type: 'agent_process_timeout',
    actor: 'supervisor',
    source: 'droid',
    command: safeCommand,
    cwd,
    exit_code: 124,
    stdout: stdout.slice(-4000),
    stderr: appendTail(stderr, timeoutMessage).slice(-4000),
    metadata: { timeout_ms: timeoutMs, pid_path: pidPath },
  });
  await sandbox.exec(`bash -lc ${quote(buildSupervisorKillScript(pidPath, exitPath))}`, { timeout: 15000 }).catch(() => undefined);
  const finalPoll = await sandboxExecWithWorkerTimeout(
    sandbox,
    `bash -lc ${quote(buildSupervisorPollScript(stdoutPath, stderrPath, exitPath))}`,
    { timeout: 15000 },
    20000
  );
  if (finalPoll.success) {
    const parsed = parseSupervisorPoll(finalPoll.stdout);
    stdout = trimTail(parsed.stdout);
    stderr = trimTail(parsed.stderr);
  }
  return {
    stdout,
    stderr: appendTail(stderr, timeoutMessage),
    exitCode: 124,
    success: false,
  };
}

function buildSupervisorKillScript(pidPath: string, exitPath: string): string {
  return [
    'set +e',
    `pid="$(cat ${quote(pidPath)} 2>/dev/null || true)"`,
    'if [ -n "$pid" ]; then',
    '  kill -TERM "-$pid" 2>/dev/null || true',
    '  pkill -TERM -P "$pid" 2>/dev/null || true',
    '  kill -TERM "$pid" 2>/dev/null || true',
    '  sleep 3',
    '  kill -KILL "-$pid" 2>/dev/null || true',
    '  pkill -KILL -P "$pid" 2>/dev/null || true',
    '  kill -KILL "$pid" 2>/dev/null || true',
    'fi',
    `printf "124" > ${quote(exitPath)}`,
  ].join('\n');
}

function buildSupervisorPollScript(stdoutPath: string, stderrPath: string, exitPath: string): string {
  return [
    'set +e',
    'echo __DROID_STATUS__',
    `if [ -f ${quote(exitPath)} ]; then echo done; cat ${quote(exitPath)}; echo ""; else echo running; echo ""; fi`,
    'echo __DROID_SIZES__',
    `wc -c < ${quote(stdoutPath)} 2>/dev/null || echo 0`,
    `wc -c < ${quote(stderrPath)} 2>/dev/null || echo 0`,
    'echo __DROID_STDOUT__',
    `tail -c 200000 ${quote(stdoutPath)} 2>/dev/null || true`,
    'echo __DROID_STDERR__',
    `tail -c 200000 ${quote(stderrPath)} 2>/dev/null || true`,
  ].join('\n');
}

function parseSupervisorPoll(value: string): {
  done: boolean;
  exitCode: number | null;
  stdoutBytes: number;
  stderrBytes: number;
  stdout: string;
  stderr: string;
} {
  const status = between(value, '__DROID_STATUS__\n', '\n__DROID_SIZES__').trim().split('\n');
  const sizes = between(value, '__DROID_SIZES__\n', '\n__DROID_STDOUT__').trim().split('\n');
  const output = value.split('__DROID_STDOUT__\n').slice(1).join('__DROID_STDOUT__\n');
  const stderrMarker = '\n__DROID_STDERR__\n';
  const stderrMarkerIndex = output.indexOf(stderrMarker);
  const stdout = stderrMarkerIndex === -1 ? output : output.slice(0, stderrMarkerIndex);
  const stderr = stderrMarkerIndex === -1 ? '' : output.slice(stderrMarkerIndex + stderrMarker.length);
  return {
    done: status[0] === 'done',
    exitCode: status[1] && /^-?\d+$/.test(status[1]) ? Number(status[1]) : null,
    stdoutBytes: Number(sizes[0]) || 0,
    stderrBytes: Number(sizes[1]) || 0,
    stdout,
    stderr,
  };
}

function between(value: string, start: string, end: string): string {
  const startIndex = value.indexOf(start);
  if (startIndex === -1) return '';
  const contentStart = startIndex + start.length;
  const endIndex = value.indexOf(end, contentStart);
  return endIndex === -1 ? value.slice(contentStart) : value.slice(contentStart, endIndex);
}

async function sandboxProcessWithPoll(
  input: Parameters<RunExecutor['execute']>[0],
  sandbox: Awaited<ReturnType<typeof getSandbox>>,
  command: string,
  options: Parameters<Awaited<ReturnType<typeof getSandbox>>['startProcess']>[1],
  timeoutMs: number,
  safeCommand: string,
  cwd: string
): Promise<CommandResult> {
  const processId = `droid-${sanitizeBranchPart(input.runId).slice(0, 16)}-opencode`;
  const startedAt = Date.now();
  let lastOutputBytes = -1;
  let lastOutputEventAt = 0;
  let stdout = '';
  let stderr = '';

  try {
    const proc = await sandbox.startProcess(command, {
      ...options,
      processId,
      autoCleanup: false,
    });

    await input.recordEvent({
      type: 'agent_process_start',
      actor: 'opencode',
      source: 'droid',
      command: safeCommand,
      cwd,
      metadata: { process_id: proc.id, pid: proc.pid ?? null },
    });

    while (Date.now() - startedAt < timeoutMs) {
      const [status, logs] = await Promise.all([
        proc.getStatus(),
        proc.getLogs().catch(() => ({ stdout, stderr })),
      ]);
      stdout = trimTail(logs.stdout);
      stderr = trimTail(logs.stderr);

      const outputBytes = stdout.length + stderr.length;
      const now = Date.now();
      if (outputBytes !== lastOutputBytes && now - lastOutputEventAt >= 15000) {
        lastOutputBytes = outputBytes;
        lastOutputEventAt = now;
        await input.recordEvent({
          type: 'agent_process_poll',
          actor: 'opencode',
          source: 'droid',
          command: safeCommand,
          cwd,
          stdout: stdout.slice(-4000),
          stderr: stderr.slice(-4000),
          metadata: { process_id: proc.id, status, stdout_bytes: stdout.length, stderr_bytes: stderr.length },
        });
      }

      if (status === 'completed' || status === 'failed' || status === 'killed' || status === 'error') {
        const latest = await sandbox.getProcess(proc.id).catch(() => null);
        const exitCode = latest?.exitCode ?? proc.exitCode ?? (status === 'completed' ? 0 : 1);
        await sandbox.cleanupCompletedProcesses().catch(() => undefined);
        return { stdout, stderr, exitCode, success: status === 'completed' && exitCode === 0 };
      }

      await sleep(5000);
    }

    await proc.kill().catch(() => undefined);
    return {
      stdout,
      stderr: appendTail(stderr, `Droid process poller timed out after ${timeoutMs}ms.`),
      exitCode: 124,
      success: false,
    };
  } catch (error) {
    return {
      stdout,
      stderr: appendTail(
        stderr,
        error instanceof Error ? error.message : String(error)
      ),
      exitCode: 1,
      success: false,
    };
  }
}

function appendTail(current: string, next: string, maxLength = 200000): string {
  const value = current + next;
  return value.length > maxLength ? value.slice(value.length - maxLength) : value;
}

function trimTail(value: string, maxLength = 200000): string {
  return value.length > maxLength ? value.slice(value.length - maxLength) : value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  return `final ${action.summary.slice(0, 120)}`;
}

function scrubNativeAction(action: NativeAgentAction, turn: number): Record<string, unknown> {
  if (action.action === 'write') {
    return { turn, action: action.action, path: action.path, bytes: new TextEncoder().encode(action.content).length };
  }
  if (action.action === 'final') {
    return { turn, action: action.action, summary: action.summary.slice(0, 500) };
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

function shellEnvValue(value: string): string {
  return quote(value);
}

function resolveWorkspaceCwd(workspace: string, cwd: string | undefined): string {
  if (!cwd || cwd === '.') return workspace;
  const normalized = cwd.replace(/^\/+/, '').split('/').filter((part) => part && part !== '.');
  if (normalized.includes('..')) return workspace;
  return `${workspace}/${normalized.join('/')}`;
}
