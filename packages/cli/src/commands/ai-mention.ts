import ora from 'ora';
import { requestApi, getResponseError } from '../lib/request.js';
import { printOutput, type OutputFormat } from '../lib/output.js';
import { log } from '../lib/ui.js';
import { getLocalConfig, getLocalProjectId } from '../lib/config.js';
import type { AIMentionConfigRecord, AIMentionPromptRecord, AIMentionCheckRecord, AIMentionResultRecord } from '@saas-maker/shared-types';

function resolveProjectId(option?: string): string | null {
  if (option) return option;
  return getLocalProjectId(getLocalConfig());
}

interface BaseOptions {
  project?: string;
  output?: OutputFormat;
  raw?: boolean;
}

export async function aiMentionConfigCommand(options: BaseOptions = {}): Promise<void> {
  const projectId = resolveProjectId(options.project);
  if (!projectId) { log.error('No project ID. Use --project or run saasmaker init'); process.exitCode = 1; return; }

  const spinner = ora('Loading config...').start();
  const res = await requestApi<AIMentionConfigRecord | null>({ path: `/v1/ai-mention/config/${projectId}`, auth: 'session' });
  spinner.stop();

  if (!res.ok) { log.error(getResponseError(res)); process.exitCode = 1; return; }

  if (!res.data) {
    log.info('No AI Mention Check config. Use the dashboard to set up.');
    return;
  }

  printOutput(res.data, { output: options.output || 'json', raw: options.raw });
}

export async function aiMentionPromptsCommand(options: BaseOptions = {}): Promise<void> {
  const projectId = resolveProjectId(options.project);
  if (!projectId) { log.error('No project ID. Use --project or run saasmaker init'); process.exitCode = 1; return; }

  const spinner = ora('Loading prompts...').start();
  const res = await requestApi<AIMentionPromptRecord[]>({ path: `/v1/ai-mention/prompts/${projectId}`, auth: 'session' });
  spinner.stop();

  if (!res.ok) { log.error(getResponseError(res)); process.exitCode = 1; return; }

  printOutput(res.data, { output: options.output || 'table', raw: options.raw, defaultColumns: ['id', 'prompt_text', 'category'], emptyMessage: 'No prompts configured.' });
}

export async function aiMentionPromptsAddCommand(options: BaseOptions & { text?: string; category?: string } = {}): Promise<void> {
  const projectId = resolveProjectId(options.project);
  if (!projectId) { log.error('No project ID. Use --project or run saasmaker init'); process.exitCode = 1; return; }

  let promptText = options.text;
  if (!promptText) {
    const readline = await import('node:readline/promises');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      promptText = await rl.question('Prompt text: ');
    } finally {
      rl.close();
    }
  }
  if (!promptText?.trim()) { log.error('Prompt text is required'); process.exitCode = 1; return; }

  const spinner = ora('Adding prompt...').start();
  const res = await requestApi<AIMentionPromptRecord>({
    path: `/v1/ai-mention/prompts/${projectId}`,
    method: 'POST',
    auth: 'session',
    body: { prompt_text: promptText, category: options.category },
  });
  spinner.stop();

  if (!res.ok) { log.error(getResponseError(res)); process.exitCode = 1; return; }

  log.success('Prompt added');
  printOutput(res.data, { output: options.output || 'json', raw: options.raw });
}

export async function aiMentionCheckCommand(options: BaseOptions = {}): Promise<void> {
  const projectId = resolveProjectId(options.project);
  if (!projectId) { log.error('No project ID. Use --project or run saasmaker init'); process.exitCode = 1; return; }

  const spinner = ora('Starting AI mention check...').start();
  const res = await requestApi<AIMentionCheckRecord>({
    path: `/v1/ai-mention/check/${projectId}`,
    method: 'POST',
    auth: 'session',
  });

  if (!res.ok) { spinner.stop(); log.error(getResponseError(res)); process.exitCode = 1; return; }

  const checkId = res.data!.id;
  spinner.text = `Check running (${res.data!.total_queries} queries)...`;

  // Poll until complete
  let completed = false;
  while (!completed) {
    await new Promise((r) => setTimeout(r, 3000));
    const poll = await requestApi<AIMentionCheckRecord & { results: AIMentionResultRecord[] }>({
      path: `/v1/ai-mention/checks/${projectId}/${checkId}`,
      auth: 'session',
    });
    if (!poll.ok) { spinner.stop(); log.error(getResponseError(poll)); process.exitCode = 1; return; }

    const check = poll.data!;
    spinner.text = `Check running (${check.completed_queries}/${check.total_queries})...`;

    if (check.status !== 'running') {
      completed = true;
      spinner.stop();

      if (check.status === 'completed') {
        log.success(check.summary || 'Check completed');
        if (check.results && check.results.length > 0) {
          const summary = check.results.map((r: AIMentionResultRecord) => ({
            platform: r.platform,
            mentioned: r.brand_mentioned ? 'Yes' : 'No',
            position: r.brand_position || '-',
            sentiment: r.brand_sentiment || '-',
          }));
          printOutput(summary, { output: options.output || 'table', raw: options.raw });
        }
      } else {
        log.error(check.summary || 'Check failed');
        process.exitCode = 1;
      }
    }
  }
}

export async function aiMentionHistoryCommand(options: BaseOptions = {}): Promise<void> {
  const projectId = resolveProjectId(options.project);
  if (!projectId) { log.error('No project ID. Use --project or run saasmaker init'); process.exitCode = 1; return; }

  const spinner = ora('Loading history...').start();
  const res = await requestApi<AIMentionCheckRecord[]>({ path: `/v1/ai-mention/checks/${projectId}`, auth: 'session' });
  spinner.stop();

  if (!res.ok) { log.error(getResponseError(res)); process.exitCode = 1; return; }

  printOutput(res.data, {
    output: options.output || 'table',
    raw: options.raw,
    defaultColumns: ['id', 'status', 'brand_mention_rate', 'total_queries', 'created_at'],
    emptyMessage: 'No checks run yet.',
  });
}
