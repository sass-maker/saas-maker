import ora from 'ora';
import chalk from 'chalk';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { getLocalFleet } from '../lib/fleet.js';
import { log } from '../lib/ui.js';
import { existsSync, rmSync, readdirSync, statSync } from 'node:fs';

interface CleanOptions {
  dryRun?: boolean;
  deep?: boolean;
  hard?: boolean;
}

const TARGET_DIRS = [
  '.next',
  'dist',
  'build',
  '.turbo',
  '.wrangler',
  '.cache',
  'tsconfig.tsbuildinfo',
  'src-tauri/target', // Massive Rust build artifacts
  'target',           // Standard Rust target
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

  log.info(`Scanning ${fleet.length} units for industrial cleaning...${options.dryRun ? chalk.yellow(' [DRY RUN]') : ''}\n`);

  let totalDeleted = 0;
  const targets = options.hard ? [...TARGET_DIRS, ...DEEP_TARGETS] : TARGET_DIRS;

  for (const project of fleet) {
    const projectTargets: string[] = [];
    
    // Find matching targets in the project root AND sub-apps (1 level deep)
    const scanTargets = (dir: string) => {
      targets.forEach(t => {
        const fullPath = join(dir, t);
        if (existsSync(fullPath)) projectTargets.push(fullPath);
      });

      // Scan sub-apps for monorepos (e.g. apps/web/.next)
      if (options.deep) {
        const appsDir = join(dir, 'apps');
        if (existsSync(appsDir)) {
          const apps = readdirSync(appsDir);
          apps.forEach(app => {
            const appPath = join(appsDir, app);
            if (statSync(appPath).isDirectory()) {
              targets.forEach(t => {
                const fullPath = join(appPath, t);
                if (existsSync(fullPath)) projectTargets.push(fullPath);
              });
            }
          });
        }
      }
    };

    scanTargets(project.path);

    if (projectTargets.length > 0) {
      if (options.dryRun) {
        console.log(`${chalk.cyan(project.slug)}: Would remove ${chalk.gray(projectTargets.map(t => t.replace(project.path, '.')).join(', '))}`);
      } else {
        const spinner = ora(`Purging ${project.slug}...`).start();
        projectTargets.forEach(targetPath => {
          rmSync(targetPath, { recursive: true, force: true });
        });
        spinner.succeed(`Purged ${project.slug} (${projectTargets.length} targets)`);
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
    log.success(`\nFleet industrial clean complete. Reclaimed space from ${totalDeleted} targets.`);
  } else {
    log.info(`\nDry run complete. Found ${totalDeleted} targets to purge.`);
    log.info(`To execute, run: ${chalk.cyan('fnd fleet clean --deep')}`);
  }
}
