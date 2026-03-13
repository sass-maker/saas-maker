import { createInterface } from 'node:readline/promises';
import ora from 'ora';
import { printOutput, type OutputFormat } from '../lib/output.js';
import { getResponseError, requestApi } from '../lib/request.js';
import { log } from '../lib/ui.js';
import { getLocalConfig, getLocalProjectId } from '../lib/config.js';

interface FormsListOptions {
  project?: string;
  output?: OutputFormat;
  select?: string;
  quiet?: boolean;
  raw?: boolean;
}

interface FormsCreateOptions {
  project?: string;
  title?: string;
  slug?: string;
  output?: OutputFormat;
  raw?: boolean;
}

interface FormsGetOptions {
  project?: string;
  output?: OutputFormat;
  raw?: boolean;
}

interface FormsResponsesOptions {
  project?: string;
  page?: string;
  limit?: string;
  output?: OutputFormat;
  raw?: boolean;
}

function resolveProjectId(option?: string): string | null {
  if (option) return option;
  return getLocalProjectId(getLocalConfig());
}

export async function formsListCommand(options: FormsListOptions = {}): Promise<void> {
  const projectId = resolveProjectId(options.project);
  if (!projectId) { log.error('No project ID. Pass --project <id> or run `saasmaker init`.'); process.exitCode = 1; return; }

  const spinner = options.quiet ? null : ora('Loading forms...').start();
  try {
    const res = await requestApi<{ data: unknown[] }>({ path: `/v1/forms/dashboard/${projectId}`, auth: 'session' });
    spinner?.stop();
    if (!res.ok) { log.error(getResponseError(res)); process.exitCode = 1; return; }

    const items = res.data?.data ?? [];
    if (items.length === 0) { if (!options.quiet) log.info('No forms yet.'); return; }
    printOutput(items, { output: options.output ?? 'table', select: options.select, raw: options.raw, defaultColumns: ['id', 'title', 'slug', 'status', 'created_at'] });
  } catch (err) {
    spinner?.stop();
    log.error(err instanceof Error ? err.message : 'Failed to list forms');
  }
}

export async function formsCreateCommand(options: FormsCreateOptions = {}): Promise<void> {
  const projectId = resolveProjectId(options.project);
  if (!projectId) { log.error('No project ID. Pass --project <id> or run `saasmaker init`.'); process.exitCode = 1; return; }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const title = options.title ?? (await rl.question('Form title: ')).trim();
    if (!title) { log.error('Title cannot be empty.'); return; }
    const slug = options.slug ?? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const spinner = ora('Creating form...').start();
    try {
      const res = await requestApi<{ data: unknown }>({
        path: `/v1/forms/dashboard/${projectId}`,
        method: 'POST', auth: 'session',
        body: { title, slug },
      });
      spinner.stop();
      if (!res.ok) { log.error(getResponseError(res)); process.exitCode = 1; return; }
      log.success(`Created form: "${title}" (${slug})`);
      printOutput(res.data?.data ?? res.data, { output: options.output ?? 'json', raw: options.raw });
    } catch (err) {
      spinner.stop();
      log.error(err instanceof Error ? err.message : 'Failed to create form');
    }
  } finally {
    rl.close();
  }
}

export async function formsGetCommand(formId: string, options: FormsGetOptions = {}): Promise<void> {
  const projectId = resolveProjectId(options.project);
  if (!projectId) { log.error('No project ID. Pass --project <id> or run `saasmaker init`.'); process.exitCode = 1; return; }

  const spinner = ora('Loading form...').start();
  try {
    const res = await requestApi<{ data: unknown }>({ path: `/v1/forms/dashboard/${projectId}/${formId}`, auth: 'session' });
    spinner.stop();
    if (!res.ok) { log.error(getResponseError(res)); process.exitCode = 1; return; }
    printOutput(res.data?.data ?? res.data, { output: options.output ?? 'json', raw: options.raw });
  } catch (err) {
    spinner.stop();
    log.error(err instanceof Error ? err.message : 'Failed to get form');
  }
}

export async function formsDeleteCommand(formId: string, options: { project?: string } = {}): Promise<void> {
  const projectId = resolveProjectId(options.project);
  if (!projectId) { log.error('No project ID. Pass --project <id> or run `saasmaker init`.'); process.exitCode = 1; return; }

  const spinner = ora('Deleting form...').start();
  try {
    const res = await requestApi({ path: `/v1/forms/dashboard/${projectId}/${formId}`, method: 'DELETE', auth: 'session' });
    spinner.stop();
    if (!res.ok) { log.error(getResponseError(res)); process.exitCode = 1; return; }
    log.success('Form deleted.');
  } catch (err) {
    spinner.stop();
    log.error(err instanceof Error ? err.message : 'Failed to delete form');
  }
}

export async function formsResponsesCommand(formId: string, options: FormsResponsesOptions = {}): Promise<void> {
  const projectId = resolveProjectId(options.project);
  if (!projectId) { log.error('No project ID. Pass --project <id> or run `saasmaker init`.'); process.exitCode = 1; return; }

  const spinner = ora('Loading responses...').start();
  try {
    const res = await requestApi<unknown>({
      path: `/v1/forms/dashboard/${projectId}/${formId}/responses`,
      auth: 'session',
      query: { page: options.page, limit: options.limit },
    });
    spinner.stop();
    if (!res.ok) { log.error(getResponseError(res)); process.exitCode = 1; return; }
    printOutput(res.data, { output: options.output ?? 'json', raw: options.raw });
  } catch (err) {
    spinner.stop();
    log.error(err instanceof Error ? err.message : 'Failed to load responses');
  }
}

export async function formsAnalyticsCommand(formId: string, options: FormsGetOptions = {}): Promise<void> {
  const projectId = resolveProjectId(options.project);
  if (!projectId) { log.error('No project ID. Pass --project <id> or run `saasmaker init`.'); process.exitCode = 1; return; }

  const spinner = ora('Loading form analytics...').start();
  try {
    const res = await requestApi<unknown>({ path: `/v1/forms/dashboard/${projectId}/${formId}/analytics`, auth: 'session' });
    spinner.stop();
    if (!res.ok) { log.error(getResponseError(res)); process.exitCode = 1; return; }
    printOutput(res.data, { output: options.output ?? 'json', raw: options.raw });
  } catch (err) {
    spinner.stop();
    log.error(err instanceof Error ? err.message : 'Failed to load form analytics');
  }
}
