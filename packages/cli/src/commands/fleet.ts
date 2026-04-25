import { execSync } from 'node:child_process';
import ora from 'ora';
import chalk from 'chalk';
import { getLocalFleet } from '../lib/fleet.js';
import { log } from '../lib/ui.js';
import { auditProject } from '../lib/auditor.js';
import { printOutput } from '../lib/output.js';
import { applyStandard, scaffoldRenovate, detectProjectType } from '../lib/forge.js';
import { existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';

// ── Fleet Health (PostHog) ─────────────────────────────────────────────────────

interface PostHogEvent {
  properties?: Record<string, unknown>;
  timestamp?: string;
}

interface ProjectHealth {
  project: string;
  requests: number;
  errors: number;
  totalDurationMs: number;
}

async function queryPostHogTraces(apiKey: string, projectId: string): Promise<PostHogEvent[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const url = `https://us.i.posthog.com/api/projects/${projectId}/events/?limit=500&event=foundry_trace&after=${encodeURIComponent(since)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`PostHog API error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { results?: PostHogEvent[] };
  return data.results ?? [];
}

export async function fleetHealthCommand(): Promise<void> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;

  if (!apiKey || !projectId) {
    log.error(
      'Missing POSTHOG_PERSONAL_API_KEY or POSTHOG_PROJECT_ID env vars.\n' +
      '  Set them in your shell profile or .env file.'
    );
    process.exit(1);
  }

  const spinner = ora('Fetching fleet health from PostHog...').start();

  let events: PostHogEvent[];
  try {
    events = await queryPostHogTraces(apiKey, projectId);
    spinner.stop();
  } catch (err) {
    spinner.fail(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // Aggregate by project
  const byProject = new Map<string, ProjectHealth>();

  for (const evt of events) {
    const props = evt.properties ?? {};
    const project = String(props.project ?? props.distinct_id ?? 'unknown');
    const isError = props.outcome === 'error';
    const durationMs = Number(props.duration_ms ?? props.durationMs ?? 0);

    const existing = byProject.get(project) ?? {
      project,
      requests: 0,
      errors: 0,
      totalDurationMs: 0,
    };

    existing.requests += 1;
    if (isError) existing.errors += 1;
    existing.totalDurationMs += durationMs;

    byProject.set(project, existing);
  }

  if (byProject.size === 0) {
    console.log(chalk.dim('\nNo foundry_trace events found in the last 24h.\n'));
    return;
  }

  const rows = Array.from(byProject.values()).sort((a, b) => b.requests - a.requests);

  // Column widths
  const nameWidth = Math.max(16, ...rows.map((r) => r.project.length));

  console.log(chalk.bold('\nFLEET HEALTH — last 24h'));
  console.log(chalk.dim('━'.repeat(nameWidth + 42)));

  for (const row of rows) {
    const avgMs = row.requests > 0 ? Math.round(row.totalDurationMs / row.requests) : 0;
    const errColor = row.errors > 0 ? chalk.red : chalk.green;
    console.log(
      chalk.cyan(row.project.padEnd(nameWidth)) +
      '  ' +
      String(row.requests).padStart(5) + ' requests' +
      '  ' +
      errColor(String(row.errors).padStart(2) + ' errors') +
      '  ' +
      chalk.dim('avg ' + String(avgMs) + 'ms')
    );
  }

  console.log('');
}

interface FleetRunOptions {
  type?: 'next' | 'vite' | 'node';
  parallel?: boolean;
}

export async function fleetListCommand(): Promise<void> {
  const fleet = getLocalFleet();
  if (fleet.length === 0) { log.info('No fleet projects detected.'); return; }
  console.log(chalk.bold(`\n Detected ${fleet.length} projects in your fleet:`));
  fleet.forEach(p => {
    const status = p.isFoundry ? chalk.green('✓ Foundry') : chalk.yellow('! Legacy');
    console.log(`  ${status} ${chalk.cyan(p.name)} (${p.type}) at ./${p.slug}`);
  });
  console.log('');
}

export async function fleetRunCommand(command: string, options: FleetRunOptions = {}): Promise<void> {
  let fleet = getLocalFleet();
  if (options.type) fleet = fleet.filter(p => p.type === options.type);
  if (fleet.length === 0) { log.error('No projects matching criteria found.'); return; }

  log.info(`Running "${command}" across ${fleet.length} projects...\n`);

  for (const project of fleet) {
    const spinner = ora(`[${project.slug}] Executing...`).start();
    try {
      execSync(command, { cwd: project.path, stdio: 'inherit', env: { ...process.env, FORCE_COLOR: 'true' } });
      spinner.succeed(`[${project.slug}] Success`);
    } catch (err) {
      spinner.fail(`[${project.slug}] Failed`);
      if (!options.parallel) { log.error('Execution halted.'); return; }
    }
  }
  log.success('\nFleet-wide execution complete.');
}

export async function fleetAuditCommand(): Promise<void> {
  const fleet = getLocalFleet();
  if (fleet.length === 0) { log.info('No projects to audit.'); return; }

  log.info(`Auditing ${fleet.length} projects for Foundry compliance...\n`);
  const fleetResults: any[] = [];
  
  for (const project of fleet) {
    const audit = auditProject(project.path);
    const passCount = audit.filter(a => a.status === 'pass').length;
    fleetResults.push({
      project: project.name,
      slug: project.slug,
      score: `${passCount}/${audit.length}`,
      status: passCount === audit.length ? chalk.green('PASS') : passCount > 0 ? chalk.yellow('WARN') : chalk.red('FAIL'),
      type: project.type,
    });
  }

  printOutput(fleetResults, { output: 'table', defaultColumns: ['project', 'slug', 'type', 'score', 'status'] });
}

export async function fleetFixCommand(): Promise<void> {
  const fleet = getLocalFleet();
  if (fleet.length === 0) { log.info('No projects to fix.'); return; }

  log.info(`Applying Foundry Standards to ${fleet.length} projects...\n`);

  for (const project of fleet) {
    const spinner = ora(`[${project.slug}] Fixing...`).start();
    try {
      // 1. Migrate legacy config
      const legacyPath = join(project.path, '.saasmaker.json');
      const foundryPath = join(project.path, 'foundry.json');
      if (existsSync(legacyPath) && !existsSync(foundryPath)) {
        renameSync(legacyPath, foundryPath);
      }

      // 2. Re-apply standards
      const type = detectProjectType(project.path);
      applyStandard(type, project.path);
      scaffoldRenovate(project.path);
      
      spinner.succeed(`[${project.slug}] Compliant`);
    } catch (err) {
      spinner.fail(`[${project.slug}] Fix failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  log.success('\nFleet-wide fix complete. Run `fnd fleet upgrade` to ensure latest versions are installed.');
}

export async function fleetUpgradeCommand(): Promise<void> {
  const command = 'pnpm add -D @saas-maker/tooling @saas-maker/eslint-config @saas-maker/tsconfig @saas-maker/prettier-config @saas-maker/dev-config';
  return fleetRunCommand(command, { parallel: true });
}
