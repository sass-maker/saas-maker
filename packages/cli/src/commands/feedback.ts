import ora from 'ora';
import { printOutput, type OutputFormat } from '../lib/output.js';
import { getResponseError, requestApi } from '../lib/request.js';
import { log } from '../lib/ui.js';
import { getLocalConfig, getLocalProjectId } from '../lib/config.js';

interface FeedbackListOptions {
  project?: string;
  output?: OutputFormat;
  select?: string;
  quiet?: boolean;
  raw?: boolean;
}

interface FeedbackUpdateOptions {
  status?: string;
  output?: OutputFormat;
  raw?: boolean;
}

function resolveProjectId(option?: string): string | null {
  if (option) return option;
  return getLocalProjectId(getLocalConfig());
}

export async function feedbackListCommand(options: FeedbackListOptions = {}): Promise<void> {
  const projectId = resolveProjectId(options.project);
  if (!projectId) { log.error('No project ID. Pass --project <id> or run `saasmaker init`.'); process.exitCode = 1; return; }

  const spinner = options.quiet ? null : ora('Loading feedback...').start();
  try {
    const res = await requestApi<{ data: unknown[] }>({ path: `/v1/feedback/inbox/${projectId}`, auth: 'session' });
    spinner?.stop();
    if (!res.ok) { log.error(getResponseError(res)); process.exitCode = 1; return; }

    const items = res.data?.data ?? [];
    if (items.length === 0) { if (!options.quiet) log.info('No feedback yet.'); return; }
    printOutput(items, { output: options.output ?? 'table', select: options.select, raw: options.raw, defaultColumns: ['id', 'type', 'message', 'status', 'created_at'] });
  } catch (err) {
    spinner?.stop();
    log.error(err instanceof Error ? err.message : 'Failed to list feedback');
  }
}

export async function feedbackUpdateCommand(id: string, options: FeedbackUpdateOptions = {}): Promise<void> {
  const status = options.status;
  if (!status) { log.error('--status is required (open, planned, in_progress, done, closed).'); process.exitCode = 1; return; }

  const spinner = ora('Updating feedback...').start();
  try {
    const res = await requestApi({ path: `/v1/feedback/${id}`, method: 'PATCH', auth: 'session', body: { status } });
    spinner.stop();
    if (!res.ok) { log.error(getResponseError(res)); process.exitCode = 1; return; }
    log.success(`Feedback ${id} updated to "${status}".`);
    if (res.data) printOutput(res.data, { output: options.output ?? 'json', raw: options.raw });
  } catch (err) {
    spinner.stop();
    log.error(err instanceof Error ? err.message : 'Failed to update feedback');
  }
}

export async function feedbackDeleteCommand(id: string): Promise<void> {
  const spinner = ora('Deleting feedback...').start();
  try {
    const res = await requestApi({ path: `/v1/feedback/${id}`, method: 'DELETE', auth: 'session' });
    spinner.stop();
    if (!res.ok) { log.error(getResponseError(res)); process.exitCode = 1; return; }
    log.success('Feedback deleted.');
  } catch (err) {
    spinner.stop();
    log.error(err instanceof Error ? err.message : 'Failed to delete feedback');
  }
}
