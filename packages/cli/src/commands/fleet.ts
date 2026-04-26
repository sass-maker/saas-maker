import { execSync, spawn } from 'node:child_process';
import ora from 'ora';
import chalk from 'chalk';
import { getLocalFleet } from '../lib/fleet.js';
import { log } from '../lib/ui.js';
import { auditProject } from '../lib/auditor.js';
import { printOutput } from '../lib/output.js';
import { applyStandard, scaffoldRenovate, detectProjectType, scaffoldCI, scaffoldHusky, type RemoteStandards } from '../lib/forge.js';
import { existsSync, mkdirSync, renameSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { requestApi, getResponseError } from '../lib/request.js';

interface FleetRunOptions {
  type?: 'next' | 'vite' | 'node';
  parallel?: boolean;
}

export async function fleetListCommand(): Promise<void> {
  const fleet = getLocalFleet();
  if (fleet.length === 0) { log.info('No fleet projects detected.'); return; }

  let manifest: Record<string, { desc: string, url: string }> = {};
  try {
    const rootPath = resolve(process.cwd().split('saas-maker')[0], 'saas-maker');
    const manifestPath = join(rootPath, 'foundry.projects.json');
    if (existsSync(manifestPath)) {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    }
  } catch {}

  console.log(chalk.bold(`\n Detected ${fleet.length} projects in your fleet:`));
  fleet.forEach(p => {
    const status = p.isFoundry ? chalk.green('✓') : chalk.yellow('!');
    const meta = manifest[p.slug] || manifest[p.name];
    const desc = meta?.desc || chalk.gray('No description available.');
    console.log(`  ${status} ${chalk.cyan(p.name.padEnd(20))} ${chalk.gray('—')} ${desc}`);
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

async function fetchRemoteStandards(type: 'next' | 'vite' | 'node'): Promise<RemoteStandards | null> {
  try {
    const res = await requestApi<RemoteStandards>({ path: `/v1/standards/${type}`, auth: 'session' });
    if (!res.ok || !res.data) return null;
    return res.data;
  } catch {
    return null;
  }
}

export async function fleetFixCommand(): Promise<void> {
  const fleet = getLocalFleet();
  if (fleet.length === 0) { log.info('No projects to fix.'); return; }

  log.info(`Applying Foundry Standards to ${fleet.length} projects...\n`);

  // Fetch remote standards once per type, then reuse across projects of that type
  const remoteCache: Record<string, RemoteStandards | null> = {};

  for (const project of fleet) {
    const spinner = ora(`[${project.slug}] Fixing...`).start();
    try {
      const legacyPath = join(project.path, '.saasmaker.json');
      const foundryPath = join(project.path, 'foundry.json');
      if (existsSync(legacyPath) && !existsSync(foundryPath)) {
        renameSync(legacyPath, foundryPath);
      }

      const type = detectProjectType(project.path);
      if (!(type in remoteCache)) remoteCache[type] = await fetchRemoteStandards(type);
      const remote = remoteCache[type] ?? undefined;

      applyStandard(type, project.path, remote);
      scaffoldRenovate(project.path);
      scaffoldCI(project.path);
      scaffoldHusky(project.path);

      spinner.succeed(`[${project.slug}] Compliant${remote ? ' (remote standards applied)' : ''}`);
    } catch (err) {
      spinner.fail(`[${project.slug}] Fix failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  log.success('\nFleet-wide fix complete. Run `fnd fleet upgrade` to ensure latest versions are installed.');
}

/**
 * Searches for a pattern across the entire fleet.
 */
export async function fleetSearchCommand(pattern: string): Promise<void> {
  const fleet = getLocalFleet();
  if (!pattern) { log.error('Please provide a search pattern.'); return; }

  log.info(`🔍 Searching for "${chalk.bold(pattern)}" across ${fleet.length} projects...\n`);

  for (const project of fleet) {
    try {
      // Use grep for fast recursive search
      const cmd = `grep -rnE --exclude-dir={node_modules,.next,dist,build,.wrangler,.turbo} "${pattern}" .`;
      const output = execSync(cmd, { cwd: project.path, encoding: 'utf-8' });

      if (output.trim()) {
        console.log(chalk.bgCyan.black(` ${project.slug} `));
        const lines = output.split('\n').filter(Boolean);
        lines.forEach(line => {
          const [file, num, ...content] = line.split(':');
          console.log(`  ${chalk.yellow(file)}:${chalk.green(num)} ${chalk.gray('—')} ${content.join(':').trim()}`);
        });
        console.log('');
      }
    } catch (err) {
      // No matches
    }
  }
  log.info('Fleet search complete.');
}

export async function fleetProvisionCommand(): Promise<void> {
  const rootPath = process.cwd().includes('Fleet') 
    ? process.cwd().split('Fleet')[0] + 'Fleet'
    : join(process.env.HOME || '', 'Desktop', 'Fleet');

  if (!existsSync(rootPath)) {
    mkdirSync(rootPath, { recursive: true });
    log.info(`Created Factory Floor at: ${rootPath}`);
  }

  let manifest: Record<string, { desc: string, url: string }> = {};
  try {
    const manifestPath = join(process.cwd().split('saas-maker')[0], 'saas-maker', 'foundry.projects.json');
    if (existsSync(manifestPath)) {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    }
  } catch (err) {
    log.error('Manifest not found. Ensure you are inside saas-maker.');
    return;
  }

  const projects = Object.entries(manifest);
  log.info(`🏭 Provisioning ${projects.length} units to the Factory Floor...\n`);

  for (const [slug, meta] of projects) {
    if (existsSync(join(rootPath, slug))) {
      log.info(`${chalk.gray('SKIP')} ${slug}`);
      continue;
    }

    const spinner = ora(`Cloning ${slug}...`).start();
    try {
      execSync(`git clone ${meta.url} ${slug}`, { cwd: rootPath, stdio: 'ignore' });
      spinner.succeed(`Cloned ${slug}`);
    } catch (err) {
      spinner.fail(`Failed to clone ${slug}`);
    }
  }

  log.info('\n🛠️  Applying Industrial Standards and Syncing Secrets...');
  try {
    await fleetFixCommand();
    await fleetSecretsSyncCommand();
  } catch (err) {
    log.warn('Standardization sweep partially failed.');
  }

  log.success('\n✨ Factory Floor is fully provisioned and ready for work.');
}

export async function fleetVersionsCommand(action: 'list' | 'fix' | 'check'): Promise<void> {
  const rootPath = resolve(process.cwd().split('Fleet')[0], 'Fleet');
  const configPath = join(rootPath, 'saas-maker', 'packages', 'cli', 'syncpack.config.cjs');
  const bin = 'npx syncpack';

  const commands = { list: 'list', fix: 'fix', check: 'lint' };
  const spinner = ora(`Running syncpack ${action}...`).start();
  try {
    execSync(`${bin} ${commands[action]} --config ${configPath}`, { cwd: rootPath, stdio: 'inherit' });
    spinner.succeed('Fleet version audit complete.');
  } catch (err) {
    spinner.fail('Version inconsistencies detected.');
    if (action === 'check') process.exitCode = 1;
  }
}

export async function fleetApplySkillCommand(skillName: string): Promise<void> {
  const fleet = getLocalFleet();
  const rootPath = resolve(process.cwd().split('saas-maker')[0], 'saas-maker');
  const skillPath = join(rootPath, 'skills', `${skillName}.md`);

  if (!existsSync(skillPath)) { log.error(`Skill protocol not found: ${skillName}.`); return; }

  const skillContent = readFileSync(skillPath, 'utf-8');
  log.info(`🚀 Dispatching Agent Swarm to apply protocol: ${chalk.bold(skillName)}\n`);

  for (const project of fleet) {
    const spinner = ora(`[${project.slug}] Agent working...`).start();
    const prompt = `[FACTORY SWARM] Apply protocol ${skillName}:\n${skillContent}`;

    try {
      const agent = spawn('gemini', ['--prompt', prompt], { cwd: project.path, stdio: 'ignore', env: { ...process.env, FORCE_COLOR: 'true' } });
      await new Promise<void>((resolve) => {
        agent.on('close', (code) => {
          if (code === 0) spinner.succeed(`[${project.slug}] Applied ${skillName}`);
          else spinner.fail(`[${project.slug}] Agent failed`);
          resolve();
        });
      });
    } catch (err) {
      spinner.fail(`[${project.slug}] Dispatch failed`);
    }
  }
  log.success('\nFleet-wide refactor swarm complete.');
}

export async function fleetSecretsSyncCommand(): Promise<void> {
  const fleet = getLocalFleet();
  if (fleet.length === 0) { log.info('No fleet projects detected.'); return; }

  const spinner = ora('Fetching fleet secrets from Cockpit...').start();
  let secrets: any[] = [];

  try {
    const res = await requestApi<{ data: any[] }>({ path: '/v1/secrets', auth: 'session' });
    if (!res.ok) { spinner.stop(); log.error(getResponseError(res)); return; }
    secrets = res.data?.data || [];
    spinner.succeed(`Fetched ${secrets.length} secrets from Cockpit.`);
  } catch (err) {
    spinner.stop(); log.error('Failed to fetch secrets'); return;
  }

  log.info(`Synchronizing across ${fleet.length} projects...\n`);

  for (const project of fleet) {
    const projectSpinner = ora(`[${project.slug}] Syncing .env.local...`).start();
    try {
      const envPath = join(project.path, '.env.local');
      let currentContent = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';

      const foundryPath = join(project.path, 'foundry.json');
      let projectConfig: any = existsSync(foundryPath) ? JSON.parse(readFileSync(foundryPath, 'utf-8')) : {};

      const relevantSecrets = secrets.filter(s => !s.project_id || s.project_id === projectConfig.projectId);

      let newContent = currentContent;
      let addedCount = 0;
      let updatedCount = 0;

      relevantSecrets.forEach(s => {
        const line = `${s.key}="${s.value}"`;
        const regex = new RegExp(`^${s.key}=.*`, 'm');
        if (currentContent.match(regex)) {
          if (!currentContent.includes(line)) { newContent = newContent.replace(regex, line); updatedCount++; }
        } else { newContent += `\n${line}`; addedCount++; }
      });

      if (addedCount > 0 || updatedCount > 0) { writeFileSync(envPath, newContent.trim() + '\n'); projectSpinner.succeed(`[${project.slug}] +${addedCount} / ~${updatedCount} secrets`); }
      else { projectSpinner.info(`[${project.slug}] Up to date`); }
    } catch (err) { projectSpinner.fail(`[${project.slug}] Sync failed`); }
  }
  log.success('\nFleet-wide secret synchronization complete.');
}

export async function fleetUpgradeCommand(): Promise<void> {
  const command = 'pnpm add -D @saas-maker/tooling @saas-maker/eslint-config @saas-maker/tsconfig @saas-maker/prettier-config @saas-maker/dev-config';
  return fleetRunCommand(command, { parallel: true });
}
