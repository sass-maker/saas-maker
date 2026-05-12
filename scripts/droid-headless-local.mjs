#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));
const workspace = await resolveWorkspace(args.workspace || process.cwd());
const prompt = await resolvePrompt(args);
const maxTurns = clampNumber(Number(args.maxTurns || 12), 1, 50);
const timeoutSeconds = clampNumber(Number(args.timeoutSeconds || 120), 5, 900);
const model = args.model || 'deepseek-chat';
const mock = Boolean(args.mock);

if (!prompt.trim()) {
  fail('Prompt is required. Use --prompt "..." or --prompt-file path.');
}
if (!mock && !process.env.DROID_DEEPSEEK_API_KEY) {
  fail('DROID_DEEPSEEK_API_KEY is required unless --mock is set.');
}

const messages = [
  { role: 'system', content: buildSystemPrompt(workspace) },
  { role: 'user', content: prompt },
];
const mockPlan = mock ? buildMockPlan(prompt) : [];
const transcript = [];

console.log(`Droid local headless`);
console.log(`workspace: ${workspace}`);
console.log(`mode: ${mock ? 'mock' : `deepseek:${model}`}`);

for (let turn = 1; turn <= maxTurns; turn += 1) {
  const action = mock ? mockPlan.shift() || { action: 'final', summary: 'Mock run completed.' } : await requestDeepSeekAction(messages, model);
  logEvent('agent_step', { turn, action: scrubAction(action) });
  transcript.push(`turn ${turn}: ${summarizeAction(action)}`);

  if (action.action === 'final') {
    console.log(action.summary);
    process.exit(0);
  }

  const result = await executeTool(action, { workspace, timeoutSeconds });
  logEvent('tool_result', { turn, ok: result.ok, exitCode: result.exitCode, output: truncate(result.output, 1200) });
  transcript.push(result.output);
  messages.push({ role: 'assistant', content: JSON.stringify(action) });
  messages.push({
    role: 'user',
    content: [
      `Tool result (${result.ok ? 'ok' : 'error'}${result.exitCode === undefined ? '' : `, exit ${result.exitCode}`}):`,
      truncate(result.output, 12000),
      '',
      'Choose the next JSON action.',
    ].join('\n'),
  });
}

console.error(`Droid local reached max turns (${maxTurns}) before final.`);
process.exit(124);

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg === '--mock') parsed.mock = true;
    else if (arg === '--workspace') parsed.workspace = argv[++i];
    else if (arg === '--prompt') parsed.prompt = argv[++i];
    else if (arg === '--prompt-file') parsed.promptFile = argv[++i];
    else if (arg === '--max-turns') parsed.maxTurns = argv[++i];
    else if (arg === '--timeout-seconds') parsed.timeoutSeconds = argv[++i];
    else if (arg === '--model') parsed.model = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/droid-headless-local.mjs --workspace PATH --prompt "task" [--mock]`);
      process.exit(0);
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

async function resolvePrompt(input) {
  if (input.prompt) return input.prompt;
  if (input.promptFile) return readFile(input.promptFile, 'utf8');
  return '';
}

async function resolveWorkspace(value) {
  const resolved = path.resolve(value);
  return realpath(resolved);
}

function buildSystemPrompt(cwd) {
  return [
    'You are Droid, a local headless coding agent.',
    `Workspace cwd: ${cwd}`,
    'Return exactly one JSON object and no markdown.',
    'Valid actions:',
    '{"action":"list","path":"."}',
    '{"action":"read","path":"relative/file.ts","start_line":1,"end_line":160}',
    '{"action":"write","path":"relative/file.ts","content":"full file contents"}',
    '{"action":"command","command":"pnpm test","timeout_seconds":120}',
    '{"action":"final","summary":"what changed and what was verified"}',
    'Use relative paths only. Read files before editing unless creating a new file.',
    'Prefer small diffs. Run the smallest useful check before final when possible.',
  ].join('\n');
}

function buildMockPlan(userPrompt) {
  const fileMatch = userPrompt.match(/(?:create|write|add)\s+([A-Za-z0-9._/-]+\.(?:md|txt|json|ts|tsx|js|mjs))/i);
  const filePath = fileMatch?.[1] || 'droid-local-smoke.md';
  const content = [
    '# Droid Local Smoke',
    '',
    'Native Droid local headless smoke passed.',
    '',
  ].join('\n');
  return [
    { action: 'list', path: '.' },
    { action: 'write', path: filePath, content },
    { action: 'command', command: `test -f ${shellQuote(filePath)} && sed -n '1,5p' ${shellQuote(filePath)}`, timeout_seconds: 30 },
    { action: 'final', summary: `Created ${filePath} and verified it exists.` },
  ];
}

async function requestDeepSeekAction(messages, model) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  let response;
  try {
    response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.DROID_DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });
  } catch (error) {
    if (controller.signal.aborted) fail('DeepSeek request timed out.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const text = await response.text();
    fail(`DeepSeek API ${response.status}: ${text.slice(0, 500)}`);
  }
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) fail('DeepSeek response did not include content.');
  return parseAction(content);
}

function parseAction(content) {
  const trimmed = content.trim();
  const jsonText = trimmed.startsWith('{') ? trimmed : trimmed.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) fail(`Model returned non-JSON output: ${trimmed.slice(0, 300)}`);
  const parsed = JSON.parse(jsonText);
  if (parsed.action === 'list') return { action: 'list', path: optionalString(parsed.path) };
  if (parsed.action === 'read' && typeof parsed.path === 'string') {
    return { action: 'read', path: parsed.path, start_line: optionalNumber(parsed.start_line), end_line: optionalNumber(parsed.end_line) };
  }
  if (parsed.action === 'write' && typeof parsed.path === 'string' && typeof parsed.content === 'string') {
    return { action: 'write', path: parsed.path, content: parsed.content };
  }
  if (parsed.action === 'command' && typeof parsed.command === 'string') {
    return { action: 'command', command: parsed.command, timeout_seconds: optionalNumber(parsed.timeout_seconds) };
  }
  if (parsed.action === 'final' && typeof parsed.summary === 'string') return { action: 'final', summary: parsed.summary };
  fail(`Invalid action: ${JSON.stringify(parsed).slice(0, 500)}`);
}

async function executeTool(action, context) {
  try {
    if (action.action === 'list') return listTool(action, context);
    if (action.action === 'read') return readTool(action, context);
    if (action.action === 'write') return writeTool(action, context);
    if (action.action === 'command') return commandTool(action, context);
    return { ok: false, output: `Unsupported action ${action.action}` };
  } catch (error) {
    return { ok: false, output: error instanceof Error ? error.message : String(error) };
  }
}

async function listTool(action, { workspace }) {
  const target = resolveSafePath(workspace, action.path || '.');
  return commandTool({
    action: 'command',
    command: `find ${shellQuote(path.relative(workspace, target) || '.')} -maxdepth 2 \\( -path '*/.git' -o -path '*/node_modules' -o -path '*/.next' -o -path '*/dist' \\) -prune -o -print | sort | head -200`,
    timeout_seconds: 30,
  }, { workspace, timeoutSeconds: 30 });
}

async function readTool(action, { workspace }) {
  const target = resolveSafePath(workspace, action.path);
  const text = await readFile(target, 'utf8');
  const lines = text.split('\n');
  const start = clampNumber(action.start_line || 1, 1, lines.length || 1);
  const end = clampNumber(action.end_line || start + 199, start, Math.min(lines.length || 1, start + 239));
  const output = lines.slice(start - 1, end).map((line, index) => `${start + index}\t${line}`).join('\n');
  return { ok: true, output };
}

async function writeTool(action, { workspace }) {
  const target = resolveSafePath(workspace, action.path);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, action.content);
  return { ok: true, exitCode: 0, output: `wrote ${action.path} (${Buffer.byteLength(action.content)} bytes)` };
}

function commandTool(action, { workspace, timeoutSeconds }) {
  const commandTimeout = clampNumber(action.timeout_seconds || 120, 5, timeoutSeconds);
  return new Promise((resolve) => {
    const child = spawn(action.command, {
      cwd: workspace,
      shell: true,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), commandTimeout * 1000);
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const timedOut = signal === 'SIGTERM';
      resolve({
        ok: code === 0 && !timedOut,
        exitCode: timedOut ? 124 : code ?? 1,
        output: truncate([stdout, stderr ? `stderr:\n${stderr}` : ''].filter(Boolean).join('\n'), 20000),
      });
    });
  });
}

function resolveSafePath(workspace, value) {
  if (!value || typeof value !== 'string') fail('Tool path must be a string.');
  if (path.isAbsolute(value)) fail('Tool paths must be relative.');
  const resolved = path.resolve(workspace, value);
  const relative = path.relative(workspace, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) fail('Tool path escapes workspace.');
  return resolved;
}

function summarizeAction(action) {
  if (action.action === 'list') return `list ${action.path || '.'}`;
  if (action.action === 'read') return `read ${action.path}`;
  if (action.action === 'write') return `write ${action.path}`;
  if (action.action === 'command') return `command ${action.command}`;
  return `final ${action.summary.slice(0, 120)}`;
}

function scrubAction(action) {
  if (action.action !== 'write') return action;
  return { action: 'write', path: action.path, bytes: Buffer.byteLength(action.content) };
}

function logEvent(type, payload) {
  console.log(JSON.stringify({ type, ...payload }));
}

function optionalString(value) {
  return typeof value === 'string' ? value : undefined;
}

function optionalNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function truncate(value, max) {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n...[truncated ${value.length - max} chars]`;
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
