import ora from 'ora';
import { printOutput, type OutputFormat } from '../lib/output.js';
import { getResponseError, requestApi } from '../lib/request.js';
import { log } from '../lib/ui.js';

interface WaitlistListOptions {
  output?: OutputFormat;
  select?: string;
  quiet?: boolean;
  raw?: boolean;
}

export async function waitlistListCommand(options: WaitlistListOptions = {}): Promise<void> {
  const spinner = options.quiet ? null : ora('Loading waitlist...').start();
  try {
    const res = await requestApi<{ data: unknown[] }>({ path: '/v1/waitlist/', auth: 'session' });
    spinner?.stop();
    if (!res.ok) { log.error(getResponseError(res)); process.exitCode = 1; return; }

    const items = res.data?.data ?? (Array.isArray(res.data) ? res.data : []);
    if (items.length === 0) { if (!options.quiet) log.info('No waitlist entries yet.'); return; }
    printOutput(items, { output: options.output ?? 'table', select: options.select, raw: options.raw, defaultColumns: ['id', 'email', 'created_at'] });
  } catch (err) {
    spinner?.stop();
    log.error(err instanceof Error ? err.message : 'Failed to list waitlist');
  }
}

export async function waitlistCountCommand(): Promise<void> {
  const spinner = ora('Loading count...').start();
  try {
    const res = await requestApi<{ count: number }>({ path: '/v1/waitlist/count', auth: 'project' });
    spinner.stop();
    if (!res.ok) { log.error(getResponseError(res)); process.exitCode = 1; return; }
    log.info(`Waitlist count: ${(res.data as { count?: number })?.count ?? 'unknown'}`);
  } catch (err) {
    spinner.stop();
    log.error(err instanceof Error ? err.message : 'Failed to get waitlist count');
  }
}

export async function waitlistDeleteCommand(id: string): Promise<void> {
  const spinner = ora('Deleting entry...').start();
  try {
    const res = await requestApi({ path: `/v1/waitlist/${id}`, method: 'DELETE', auth: 'session' });
    spinner.stop();
    if (!res.ok) { log.error(getResponseError(res)); process.exitCode = 1; return; }
    log.success('Waitlist entry deleted.');
  } catch (err) {
    spinner.stop();
    log.error(err instanceof Error ? err.message : 'Failed to delete waitlist entry');
  }
}
