import ora from 'ora';
import chalk from 'chalk';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { getLocalFleet } from '../lib/fleet.js';
import { log } from '../lib/ui.js';
import { existsSync, rmSync, statSync } from 'node:fs';

interface CleanOptions {
  dryRun?: boolean;
  deep?: boolean;
}

const TARGET_DIRS = [
  '.next',
  'dist',
  'build',
  '.turbo',
  '.wrangler',
  '.cache',
  'tsconfig.tsbuildinfo',
];

const DEEP_TARGETS = [
  'node_modules',
];

export async function fleetCleanCommand(options: CleanOptions = {}): Promise<void> {
  const fleet = getLocalFleet();
  if (fleet.length === 0) {
    log.info('No fleet projects detected.');
    return;
  }

  log.info(`Scaning ${fleet.length} projects for storage cleanup...${options.dryRun ? chalk.yellow(' [DRY RUN]') : ''}\n`);

  let totalDeleted = 0;
  const targets = options.deep ? [...TARGET_DIRS, ...DEEP_TARGETS] : TARGET_DIRS;

  for (const project of fleet) {
    const projectTargets: string[] = [];
    
    targets.forEach(dir => {
      const targetPath = join(project.path, dir);
      if (existsSync(targetPath)) {
        projectTargets.push(dir);
      }
    });

    if (projectTargets.length > 0) {
      if (options.dryRun) {
        console.log(`${chalk.cyan(project.slug)}: Would remove ${chalk.gray(projectTargets.join(', '))}`);
      } else {
        const spinner = ora(`Cleaning ${project.slug}...`).start();
        projectTargets.forEach(dir => {
          rmSync(join(project.path, dir), { recursive: true, force: true });
        });
        spinner.succeed(`Cleaned ${project.slug} (${projectTargets.length} targets)`);
      }
      totalDeleted += projectTargets.length;
    }
  }

  if (!options.dryRun) {
    const pruneSpinner = ora('Pruning global pnpm store...').start();
    try {
      execSync('pnpm store prune', { stdio: 'ignore' });
      pruneSpinner.succeed('Global pnpm store pruned.');
    } catch (e) {
      pruneSpinner.fail('Failed to prune pnpm store.');
    }
    log.success(`\nFleet cleanup complete. Handled ${totalDeleted} targets.`);
  } else {
    log.info(`\nDry run complete. Found ${totalDeleted} targets to clean.`);
  }
}
