import ora from 'ora';
import { printOutput, type OutputFormat } from '../lib/output.js';
import { getResponseError, requestApi } from '../lib/request.js';
import { log } from '../lib/ui.js';
import { getLocalConfig, getLocalProjectId } from '../lib/config.js';

interface TestimonialsListOptions {
  project?: string;
  output?: OutputFormat;
  select?: string;
  quiet?: boolean;
  raw?: boolean;
}

interface TestimonialsUpdateOptions {
  status?: string;
  output?: OutputFormat;
  raw?: boolean;
}

function resolveProjectId(option?: string): string | null {
  if (option) return option;
  return getLocalProjectId(getLocalConfig());
}

export async function testimonialsListCommand(options: TestimonialsListOptions = {}): Promise<void> {
  const projectId = resolveProjectId(options.project);
  if (!projectId) { log.error('No project ID. Pass --project <id> or run `saasmaker init`.'); process.exitCode = 1; return; }

  const spinner = options.quiet ? null : ora('Loading testimonials...').start();
  try {
    const res = await requestApi<{ data: unknown[] }>({ path: '/v1/testimonials/all', auth: 'session', query: { project_id: projectId } });
    spinner?.stop();
    if (!res.ok) { log.error(getResponseError(res)); process.exitCode = 1; return; }

    const items = res.data?.data ?? (Array.isArray(res.data) ? res.data : []);
    if (items.length === 0) { if (!options.quiet) log.info('No testimonials yet.'); return; }
    printOutput(items, { output: options.output ?? 'table', select: options.select, raw: options.raw, defaultColumns: ['id', 'author_name', 'content', 'status', 'created_at'] });
  } catch (err) {
    spinner?.stop();
    log.error(err instanceof Error ? err.message : 'Failed to list testimonials');
  }
}

export async function testimonialsUpdateCommand(id: string, options: TestimonialsUpdateOptions = {}): Promise<void> {
  const status = options.status;
  if (!status) { log.error('--status is required (approved, rejected, pending).'); process.exitCode = 1; return; }

  const spinner = ora('Updating testimonial...').start();
  try {
    const res = await requestApi({ path: `/v1/testimonials/${id}`, method: 'PATCH', auth: 'session', body: { status } });
    spinner.stop();
    if (!res.ok) { log.error(getResponseError(res)); process.exitCode = 1; return; }
    log.success(`Testimonial ${id} updated to "${status}".`);
    if (res.data) printOutput(res.data, { output: options.output ?? 'json', raw: options.raw });
  } catch (err) {
    spinner.stop();
    log.error(err instanceof Error ? err.message : 'Failed to update testimonial');
  }
}

export async function testimonialsDeleteCommand(id: string): Promise<void> {
  const spinner = ora('Deleting testimonial...').start();
  try {
    const res = await requestApi({ path: `/v1/testimonials/${id}`, method: 'DELETE', auth: 'session' });
    spinner.stop();
    if (!res.ok) { log.error(getResponseError(res)); process.exitCode = 1; return; }
    log.success('Testimonial deleted.');
  } catch (err) {
    spinner.stop();
    log.error(err instanceof Error ? err.message : 'Failed to delete testimonial');
  }
}
