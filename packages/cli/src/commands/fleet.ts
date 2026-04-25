import { execSync } from 'node:child_process';
import ora from 'ora';
import chalk from 'chalk';
import { getLocalFleet } from '../lib/fleet.js';
import { log } from '../lib/ui.js';
import { auditProject } from '../lib/auditor.js';
import { printOutput } from '../lib/output.js';
import { applyStandard, scaffoldRenovate, detectProjectType, scaffoldCI } from '../lib/forge.js';
import { existsSync, renameSync, appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

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
      scaffoldCI(project.path);
      
      spinner.succeed(`[${project.slug}] Compliant`);
    } catch (err) {
      spinner.fail(`[${project.slug}] Fix failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  log.success('\nFleet-wide fix complete. Run `fnd fleet upgrade` to ensure latest versions are installed.');
}

export async function fleetSecretsSyncCommand(): Promise<void> {
  const fleet = getLocalFleet();
  if (fleet.length === 0) { log.info('No projects to sync.'); return; }

  log.info(`Synchronizing Foundry Secrets across ${fleet.length} projects...\n`);

  // These are the "Gold Standard" secrets that every Foundry project should have
  const commonSecrets = {
    FOUNDRY_API_URL: 'https://api.foundry.dev',
    NEXT_PUBLIC_SAASMAKER_API_KEY: 'shared_key_placeholder',
  };

  for (const project of fleet) {
    const spinner = ora(`[${project.slug}] Syncing .env.local...`).start();
    try {
      const envPath = join(project.path, '.env.local');
      let currentContent = '';
      if (existsSync(envPath)) {
        currentContent = readFileSync(envPath, 'utf-8');
      }

      let newContent = currentContent;
      let addedCount = 0;

      Object.entries(commonSecrets).forEach(([key, val]) => {
        if (!currentContent.includes(`${key}=`)) {
          newContent += `\n${key}="${val}"`;
          addedCount++;
        }
      });

      if (addedCount > 0) {
        writeFileSync(envPath, newContent);
        spinner.succeed(`[${project.slug}] Added ${addedCount} secrets`);
      } else {
        spinner.info(`[${project.slug}] Up to date`);
      }
    } catch (err) {
      spinner.fail(`[${project.slug}] Sync failed`);
    }
  }

  log.success('\nFleet-wide secret synchronization complete.');
}

export async function fleetUpgradeCommand(): Promise<void> {
  const command = 'pnpm add -D @saas-maker/tooling @saas-maker/eslint-config @saas-maker/tsconfig @saas-maker/prettier-config @saas-maker/dev-config';
  return fleetRunCommand(command, { parallel: true });
}
