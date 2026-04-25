import ora from 'ora';
import chalk from 'chalk';
import { createInterface } from 'node:readline/promises';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
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
    const apiKey = await rl.question('Enter your PostHog Personal API Key: ');
    const apiProject = await rl.question('Enter your PostHog Project ID: ');
    const apiHost = (await rl.question('Enter your PostHog Host [https://us.i.posthog.com]: ')).trim() || 'https://us.i.posthog.com';

    if (!apiKey || !apiProject) {
      log.error('API Key and Project ID are required.');
      return;
    }

    const envPath = join(process.cwd(), '.env.local');
    const envEntry = `\n# Foundry Analytics (Control Plane)\nPOSTHOG_PERSONAL_API_KEY="${apiKey}"\nPOSTHOG_PROJECT_ID="${apiProject}"\nPOSTHOG_HOST="${apiHost}"\n`;

    appendFileSync(envPath, envEntry);
    log.success(`✓ Updated ${envPath}`);

    console.log('\n🚀 Next Step:');
    console.log(`  Run ${chalk.cyan('fnd analytics forge-dashboard')} to create your Mission Control.`);
  } catch (err) {
    log.error('Failed to setup analytics');
  } finally {
    rl.close();
  }
}

export async function analyticsForgeDashboardCommand(): Promise<void> {
  // We need to pull keys from the .env.local of the cockpit
  const saasMakerPath = process.cwd().includes('saas-maker') ? process.cwd().split('saas-maker')[0] + 'saas-maker' : process.cwd();
  const envPath = join(saasMakerPath, 'apps', 'cockpit', '.env.local');
  
  let apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  let projectId = process.env.POSTHOG_PROJECT_ID;
  let host = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!apiKey && existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    apiKey = envContent.match(/POSTHOG_PERSONAL_API_KEY="?([^"\n]+)"?/)?.[1];
    projectId = envContent.match(/POSTHOG_PROJECT_ID="?([^"\n]+)"?/)?.[1];
  }

  if (!apiKey || !projectId) {
    log.error('PostHog credentials missing. Run `fnd analytics setup` inside apps/cockpit first.');
    return;
  }

  const spinner = ora('Forging Foundry Mission Control dashboard in PostHog...').start();

  try {
    // 1. Create Dashboard
    const dbRes = await fetch(`${host}/api/projects/${projectId}/dashboards/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: "Foundry Fleet Mission Control", description: "Standardized observability for the project fleet." })
    });

    if (!dbRes.ok) throw new Error(`Dashboard failed: ${await dbRes.text()}`);
    const dashboard = await dbRes.json();
    const dashboardId = dashboard.id;

    spinner.text = 'Creating fleet insights...';

    // 2. Create Fleet Error Insight (HogQL)
    await fetch(`${host}/api/projects/${projectId}/insights/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: "Fleet Error Volume (24h)",
        dashboards: [dashboardId],
        query: {
          kind: "EventsQuery",
          select: ["count()", "properties.foundry_project_id"],
          where: ["event == 'foundry_error'"],
          groupBy: ["properties.foundry_project_id"]
        }
      })
    });

    // 3. Create Latency Heatmap Insight (HogQL)
    await fetch(`${host}/api/projects/${projectId}/insights/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: "Fleet Latency Heatmap",
        dashboards: [dashboardId],
        query: {
          kind: "EventsQuery",
          select: ["avg(properties.traceDuration)", "properties.foundry_project_id"],
          where: ["event == 'foundry_trace'"],
          groupBy: ["properties.foundry_project_id"]
        }
      })
    });

    spinner.succeed(`Foundry Mission Control created! ID: ${dashboardId}`);
    console.log(chalk.gray(`\nView it at: ${host}/dashboard/${dashboardId}`));

  } catch (err) {
    spinner.fail(`Forge failed: ${err instanceof Error ? err.message : String(err)}`);
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
