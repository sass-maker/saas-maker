import ora from 'ora';
import { printOutput, type OutputFormat } from '../lib/output.js';
import { getResponseError, requestApi } from '../lib/request.js';
import { log } from '../lib/ui.js';
import { getLocalConfig, getLocalProjectId } from '../lib/config.js';

interface AnalyticsDashboardOptions {
  project?: string;
  period?: string;
  includeBots?: boolean;
  output?: OutputFormat;
  raw?: boolean;
}

interface AnalyticsDetailOptions {
  project?: string;
  period?: string;
  limit?: string;
  offset?: string;
  output?: OutputFormat;
  raw?: boolean;
}

function resolveProjectId(option?: string): string | null {
  if (option) return option;
  return getLocalProjectId(getLocalConfig());
}

export async function analyticsDashboardCommand(options: AnalyticsDashboardOptions = {}): Promise<void> {
  const projectId = resolveProjectId(options.project);
  if (!projectId) { log.error('No project ID. Pass --project <id> or run `saasmaker init`.'); process.exitCode = 1; return; }

  const spinner = ora('Loading analytics...').start();
  try {
    const res = await requestApi<unknown>({
      path: '/v1/analytics/dashboard',
      auth: 'session',
      query: { project_id: projectId, period: options.period ?? '30d', include_bots: options.includeBots ? 'true' : undefined },
    });
    spinner.stop();
    if (!res.ok) { log.error(getResponseError(res)); process.exitCode = 1; return; }
    printOutput(res.data, { output: options.output ?? 'json', raw: options.raw });
  } catch (err) {
    spinner.stop();
    log.error(err instanceof Error ? err.message : 'Failed to load analytics');
  }
}

export async function analyticsDetailCommand(section: string, options: AnalyticsDetailOptions = {}): Promise<void> {
  const projectId = resolveProjectId(options.project);
  if (!projectId) { log.error('No project ID. Pass --project <id> or run `saasmaker init`.'); process.exitCode = 1; return; }

  const validSections = ['pages', 'referrers', 'countries', 'devices', 'browsers', 'os', 'events', 'bots'];
  if (!validSections.includes(section)) { log.error(`Invalid section. Choose from: ${validSections.join(', ')}`); process.exitCode = 1; return; }

  const spinner = ora(`Loading ${section}...`).start();
  try {
    const res = await requestApi<unknown>({
      path: `/v1/analytics/detail/${section}`,
      auth: 'session',
      query: { project_id: projectId, period: options.period ?? '30d', limit: options.limit, offset: options.offset },
    });
    spinner.stop();
    if (!res.ok) { log.error(getResponseError(res)); process.exitCode = 1; return; }
    printOutput(res.data, { output: options.output ?? 'json', raw: options.raw });
  } catch (err) {
    spinner.stop();
    log.error(err instanceof Error ? err.message : 'Failed to load analytics detail');
  }
}
