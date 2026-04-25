import { execSync } from 'node:child_process';
import ora from 'ora';
import chalk from 'chalk';
import { getLocalFleet } from '../lib/fleet.js';
import { log } from '../lib/ui.js';
import { auditProject } from '../lib/auditor.js';
import { printOutput } from '../lib/output.js';
import { applyStandard, scaffoldRenovate, detectProjectType, scaffoldCI } from '../lib/forge.js';
import { existsSync, renameSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { requestApi, getResponseError } from '../lib/request.js';

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
      const legacyPath = join(project.path, '.saasmaker.json');
      const foundryPath = join(project.path, 'foundry.json');
      if (existsSync(legacyPath) && !existsSync(foundryPath)) {
        renameSync(legacyPath, foundryPath);
      }

      const type = detectProjectType(project.path);
      applyStandard(type, project.path);
      scaffoldRenovate(project.path);
      scaffoldCI(project.path);
      
      spinner.succeed(`[${project.slug}] Compliant`);
    } catch (err) {
      spinner.fail(`[${project.slug}] Fix failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  log.success('\nFleet-wide fix complete. Run `fnd fleet upgrade` to ensure latest versions are installed.');
}

/**
 * Syncpack-based version management for the entire fleet.
 */
export async function fleetVersionsCommand(action: 'list' | 'fix' | 'check'): Promise<void> {
  const rootPath = resolve(process.cwd().split('Fleet')[0], 'Fleet');
  const bin = 'npx syncpack';

  const commands = {
    list: 'list',
    fix: 'fix',
    check: 'lint'
  };

  const spinner = ora(`Running syncpack ${action}...`).start();
  try {
    execSync(`${bin} ${commands[action]}`, { cwd: rootPath, stdio: 'inherit' });
    spinner.succeed('Fleet version audit complete.');
  } catch (err) {
    spinner.fail('Version inconsistencies detected in the fleet.');
    if (action === 'check') process.exitCode = 1;
  }
}

export async function fleetSecretsSyncCommand(): Promise<void> {
  const fleet = getLocalFleet();
  if (fleet.length === 0) { log.info('No projects to sync.'); return; }

  const spinner = ora('Fetching fleet secrets from Cockpit...').start();
  let secrets: any[] = [];

  try {
    const res = await requestApi<{ data: any[] }>({ path: '/v1/secrets', auth: 'session' });
    if (!res.ok) {
      spinner.stop();
      log.error(getResponseError(res));
      return;
    }
    secrets = res.data?.data || [];
    spinner.succeed(`Fetched ${secrets.length} secrets from Cockpit.`);
  } catch (err) {
    spinner.stop();
    log.error('Failed to fetch secrets');
    return;
  }

  log.info(`Synchronizing across ${fleet.length} projects...\n`);

  for (const project of fleet) {
    const projectSpinner = ora(`[${project.slug}] Syncing .env.local...`).start();
    try {
      const envPath = join(project.path, '.env.local');
      let currentContent = '';
      if (existsSync(envPath)) {
        currentContent = readFileSync(envPath, 'utf-8');
      }

      const foundryPath = join(project.path, 'foundry.json');
      let projectConfig: any = {};
      if (existsSync(foundryPath)) {
        projectConfig = JSON.parse(readFileSync(foundryPath, 'utf-8'));
      }

      const relevantSecrets = secrets.filter(s => 
        !s.project_id || s.project_id === projectConfig.projectId
      );

      let newContent = currentContent;
      let addedCount = 0;
      let updatedCount = 0;

      relevantSecrets.forEach(s => {
        const line = `${s.key}="${s.value}"`;
        const regex = new RegExp(`^${s.key}=.*`, 'm');

        if (currentContent.match(regex)) {
          if (!currentContent.includes(line)) {
            newContent = newContent.replace(regex, line);
            updatedCount++;
          }
        } else {
          newContent += `\n${line}`;
          addedCount++;
        }
      });

      if (addedCount > 0 || updatedCount > 0) {
        writeFileSync(envPath, newContent.trim() + '\n');
        projectSpinner.succeed(`[${project.slug}] +${addedCount} / ~${updatedCount} secrets`);
      } else {
        projectSpinner.info(`[${project.slug}] Up to date`);
      }
    } catch (err) {
      projectSpinner.fail(`[${project.slug}] Sync failed`);
    }
  }

  log.success('\nFleet-wide secret synchronization complete.');
}

export async function fleetUpgradeCommand(): Promise<void> {
  const command = 'pnpm add -D @saas-maker/tooling @saas-maker/eslint-config @saas-maker/tsconfig @saas-maker/prettier-config @saas-maker/dev-config';
  return fleetRunCommand(command, { parallel: true });
}
