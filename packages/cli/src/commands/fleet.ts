import { execSync } from 'node:child_process';
import ora from 'ora';
import chalk from 'chalk';
import { getLocalFleet } from '../lib/fleet.js';
import { log } from '../lib/ui.js';
import { auditProject } from '../lib/auditor.js';
import { printOutput } from '../lib/output.js';

interface FleetRunOptions {
  type?: 'next' | 'vite' | 'node';
  parallel?: boolean;
}

export async function fleetListCommand(): Promise<void> {
  const fleet = getLocalFleet();
  if (fleet.length === 0) {
    log.info('No fleet projects detected in parent directory.');
    return;
  }

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
      if (!options.parallel) { log.error('Execution halted. Use --parallel to continue on failures.'); return; }
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
    const score = `${passCount}/${audit.length}`;
    
    fleetResults.push({
      project: project.name,
      slug: project.slug,
      score,
      status: passCount === audit.length ? chalk.green('PASS') : passCount > 0 ? chalk.yellow('WARN') : chalk.red('FAIL'),
      type: project.type,
    });
  }

  printOutput(fleetResults, {
    output: 'table',
    defaultColumns: ['project', 'slug', 'type', 'score', 'status']
  });
}

export async function fleetUpgradeCommand(): Promise<void> {
  const command = 'pnpm add -D @saas-maker/tooling @saas-maker/eslint-config @saas-maker/tsconfig @saas-maker/prettier-config @saas-maker/dev-config';
  return fleetRunCommand(command, { parallel: true });
}
