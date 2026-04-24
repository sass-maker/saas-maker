import ora from 'ora';
import chalk from 'chalk';
import { createInterface } from 'node:readline/promises';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
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

export async function analyticsSetupCommand(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    console.log(chalk.bold('\n📊 Foundry Analytics Setup (PostHog)'));
    const apiKey = await rl.question('Enter your PostHog API Key: ');
    const apiHost = (await rl.question('Enter your PostHog Host [https://us.i.posthog.com]: ')).trim() || 'https://us.i.posthog.com';

    if (!apiKey) {
      log.error('API Key is required.');
      return;
    }

    const envPath = join(process.cwd(), '.env.local');
    const envEntry = `\n# Foundry Analytics\nNEXT_PUBLIC_POSTHOG_KEY="${apiKey}"\nNEXT_PUBLIC_POSTHOG_HOST="${apiHost}"\n`;

    appendFileSync(envPath, envEntry);
    log.success(`✓ Updated ${envPath}`);

    console.log('\n🚀 Next Steps:');
    console.log(`  1. Install SDK: ${chalk.cyan('pnpm add @saas-maker/analytics-sdk')}`);
    console.log(`  2. Add logic to your root layout:`);
    console.log(chalk.gray('     import { FoundryAnalytics } from "@saas-maker/analytics-sdk";'));
    console.log(chalk.gray('     FoundryAnalytics.init({ apiKey: process.env.NEXT_PUBLIC_POSTHOG_KEY! });'));
  } catch (err) {
    log.error('Failed to setup analytics');
  } finally {
    rl.close();
  }
}

export async function analyticsDashboardCommand(options: AnalyticsDashboardOptions = {}): Promise<void> {
  const projectId = resolveProjectId(options.project);
  if (!projectId) { log.error('No fleet project ID. Pass --project <id> or run `fnd init`.'); process.exitCode = 1; return; }

  const spinner = ora('Loading fleet analytics...').start();
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
  if (!projectId) { log.error('No fleet project ID. Pass --project <id> or run `fnd init`.'); process.exitCode = 1; return; }

  const validSections = ['pages', 'referrers', 'countries', 'devices', 'browsers', 'os', 'events', 'bots'];
  if (!validSections.includes(section)) { log.error(`Invalid section. Choose from: ${validSections.join(', ')}`); process.exitCode = 1; return; }

  const spinner = ora(`Loading ${section} data...`).start();
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
