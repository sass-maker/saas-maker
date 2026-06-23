import { execSync, spawn } from 'node:child_process';
import ora from 'ora';
import chalk from 'chalk';
import { getLocalFleet } from '../lib/fleet.js';
import { log } from '../lib/ui.js';
import { auditProject } from '../lib/auditor.js';
import { printOutput } from '../lib/output.js';
import {
  applyStandard,
  scaffoldRenovate,
  detectProjectType,
  scaffoldCI,
  scaffoldHusky,
  usesBiome,
  type RemoteStandards,
} from '../lib/forge.js';
import { existsSync, mkdirSync, renameSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { requestApi, getResponseError } from '../lib/request.js';

interface FleetRunOptions {
  type?: 'next' | 'vite' | 'node';
  parallel?: boolean;
}

export async function fleetListCommand(): Promise<void> {
  const fleet = getLocalFleet();
  if (fleet.length === 0) {
    log.info('No fleet projects detected.');
    return;
  }

  let manifest: Record<string, { desc: string; url: string }> = {};
  try {
    const rootPath = resolve(process.cwd().split('saas-maker')[0], 'saas-maker');
    const manifestPath = join(rootPath, 'foundry.projects.json');
    if (existsSync(manifestPath)) {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    }
  } catch {}

  console.log(chalk.bold(`\n Detected ${fleet.length} projects in your fleet:`));
  fleet.forEach((p) => {
    const status = p.isFoundry ? chalk.green('✓') : chalk.yellow('!');
    const meta = manifest[p.slug] || manifest[p.name];
    const desc = meta?.desc || chalk.gray('No description available.');
    console.log(`  ${status} ${chalk.cyan(p.name.padEnd(20))} ${chalk.gray('—')} ${desc}`);
  });
  console.log('');
}

export async function fleetRunCommand(
  command: string,
  options: FleetRunOptions = {}
): Promise<void> {
  let fleet = getLocalFleet();
  if (options.type) fleet = fleet.filter((p) => p.type === options.type);
  if (fleet.length === 0) {
    log.error('No projects matching criteria found.');
    return;
  }

  log.info(`Running "${command}" across ${fleet.length} projects...\n`);

  for (const project of fleet) {
    const spinner = ora(`[${project.slug}] Executing...`).start();
    try {
      execSync(command, {
        cwd: project.path,
        stdio: 'inherit',
        env: { ...process.env, FORCE_COLOR: 'true' },
      });
      spinner.succeed(`[${project.slug}] Success`);
    } catch (_err) {
      spinner.fail(`[${project.slug}] Failed`);
      if (!options.parallel) {
        log.error('Execution halted.');
        return;
      }
    }
  }
  log.success('\nFleet-wide execution complete.');
}

export async function fleetAuditCommand(): Promise<void> {
  const fleet = getLocalFleet();
  if (fleet.length === 0) {
    log.info('No projects to audit.');
    return;
  }

  log.info(`Auditing ${fleet.length} projects for Foundry compliance...\n`);
  const fleetResults: any[] = [];

  for (const project of fleet) {
    const audit = auditProject(project.path);
    const passCount = audit.filter((a) => a.status === 'pass').length;
    fleetResults.push({
      project: project.name,
      slug: project.slug,
      score: `${passCount}/${audit.length}`,
      status:
        passCount === audit.length
          ? chalk.green('PASS')
          : passCount > 0
            ? chalk.yellow('WARN')
            : chalk.red('FAIL'),
      type: project.type,
    });
  }

  printOutput(fleetResults, {
    output: 'table',
    defaultColumns: ['project', 'slug', 'type', 'score', 'status'],
  });
}

async function fetchRemoteStandards(
  type: 'next' | 'vite' | 'node'
): Promise<RemoteStandards | null> {
  try {
    const res = await requestApi<RemoteStandards>({
      path: `/v1/standards/${type}`,
      auth: 'session',
    });
    if (!res.ok || !res.data) return null;
    return res.data;
  } catch {
    return null;
  }
}

export async function fleetFixCommand(opts: { force?: boolean } = {}): Promise<void> {
  const fleet = getLocalFleet();
  if (fleet.length === 0) {
    log.info('No projects to fix.');
    return;
  }

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

      applyStandard(type, project.path, remote, { force: opts.force });
      scaffoldRenovate(project.path);
      scaffoldCI(project.path, { force: opts.force });
      scaffoldHusky(project.path, { force: opts.force });

      spinner.succeed(`[${project.slug}] Compliant${remote ? ' (remote standards applied)' : ''}`);
    } catch (err) {
      spinner.fail(
        `[${project.slug}] Fix failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  log.success(
    '\nFleet-wide fix complete. Run `fnd fleet upgrade` to refresh lint/format devDependencies.'
  );
}

/**
 * Searches for a pattern across the entire fleet.
 */
export async function fleetSearchCommand(pattern: string): Promise<void> {
  const fleet = getLocalFleet();
  if (!pattern) {
    log.error('Please provide a search pattern.');
    return;
  }

  log.info(`🔍 Searching for "${chalk.bold(pattern)}" across ${fleet.length} projects...\n`);

  for (const project of fleet) {
    try {
      // Use grep for fast recursive search
      const cmd = `grep -rnE --exclude-dir={node_modules,.next,dist,build,.wrangler,.turbo} "${pattern}" .`;
      const output = execSync(cmd, { cwd: project.path, encoding: 'utf-8' });

      if (output.trim()) {
        console.log(chalk.bgCyan.black(` ${project.slug} `));
        const lines = output.split('\n').filter(Boolean);
        lines.forEach((line) => {
          const [file, num, ...content] = line.split(':');
          console.log(
            `  ${chalk.yellow(file)}:${chalk.green(num)} ${chalk.gray('—')} ${content.join(':').trim()}`
          );
        });
        console.log('');
      }
    } catch (_err) {
      // No matches
    }
  }
  log.info('Fleet search complete.');
}

export async function fleetProvisionCommand(): Promise<void> {
  const rootPath = process.cwd().includes('Fleet')
    ? `${process.cwd().split('Fleet')[0]}Fleet`
    : join(process.env.HOME || '', 'Desktop', 'Fleet');

  if (!existsSync(rootPath)) {
    mkdirSync(rootPath, { recursive: true });
    log.info(`Created Factory Floor at: ${rootPath}`);
  }

  let manifest: Record<string, { desc: string; url: string }> = {};
  try {
    const manifestPath = join(
      process.cwd().split('saas-maker')[0],
      'saas-maker',
      'foundry.projects.json'
    );
    if (existsSync(manifestPath)) {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    }
  } catch (_err) {
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
    } catch (_err) {
      spinner.fail(`Failed to clone ${slug}`);
    }
  }

  log.info('\n🛠️  Applying Industrial Standards and Syncing Secrets...');
  try {
    await fleetFixCommand();
    await fleetSecretsSyncCommand();
  } catch (_err) {
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
    execSync(`${bin} ${commands[action]} --config ${configPath}`, {
      cwd: rootPath,
      stdio: 'inherit',
    });
    spinner.succeed('Fleet version audit complete.');
  } catch (_err) {
    spinner.fail('Version inconsistencies detected.');
    if (action === 'check') process.exitCode = 1;
  }
}

export async function fleetApplySkillCommand(skillName: string): Promise<void> {
  const fleet = getLocalFleet();
  const rootPath = resolve(process.cwd().split('saas-maker')[0], 'saas-maker');
  const skillPath = join(rootPath, 'skills', `${skillName}.md`);

  if (!existsSync(skillPath)) {
    log.error(`Skill protocol not found: ${skillName}.`);
    return;
  }

  const skillContent = readFileSync(skillPath, 'utf-8');
  log.info(`🚀 Dispatching Agent Swarm to apply protocol: ${chalk.bold(skillName)}\n`);

  for (const project of fleet) {
    const spinner = ora(`[${project.slug}] Agent working...`).start();
    const prompt = `[FACTORY SWARM] Apply protocol ${skillName}:\n${skillContent}`;

    try {
      const agent = spawn('gemini', ['--prompt', prompt], {
        cwd: project.path,
        stdio: 'ignore',
        env: { ...process.env, FORCE_COLOR: 'true' },
      });
      await new Promise<void>((resolve) => {
        agent.on('close', (code) => {
          if (code === 0) spinner.succeed(`[${project.slug}] Applied ${skillName}`);
          else spinner.fail(`[${project.slug}] Agent failed`);
          resolve();
        });
      });
    } catch (_err) {
      spinner.fail(`[${project.slug}] Dispatch failed`);
    }
  }
  log.success('\nFleet-wide refactor swarm complete.');
}

export async function fleetSecretsSyncCommand(): Promise<void> {
  const fleet = getLocalFleet();
  if (fleet.length === 0) {
    log.info('No fleet projects detected.');
    return;
  }

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
  } catch (_err) {
    spinner.stop();
    log.error('Failed to fetch secrets');
    return;
  }

  log.info(`Synchronizing across ${fleet.length} projects...\n`);

  for (const project of fleet) {
    const projectSpinner = ora(`[${project.slug}] Syncing .env.local...`).start();
    try {
      const envPath = join(project.path, '.env.local');
      const currentContent = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';

      const foundryPath = join(project.path, 'foundry.json');
      const projectConfig: any = existsSync(foundryPath)
        ? JSON.parse(readFileSync(foundryPath, 'utf-8'))
        : {};

      const relevantSecrets = secrets.filter(
        (s) => !s.project_id || s.project_id === projectConfig.projectId
      );

      let newContent = currentContent;
      let addedCount = 0;
      let updatedCount = 0;

      relevantSecrets.forEach((s) => {
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
        writeFileSync(envPath, `${newContent.trim()}\n`);
        projectSpinner.succeed(`[${project.slug}] +${addedCount} / ~${updatedCount} secrets`);
      } else {
        projectSpinner.info(`[${project.slug}] Up to date`);
      }
    } catch (_err) {
      projectSpinner.fail(`[${project.slug}] Sync failed`);
    }
  }
  log.success('\nFleet-wide secret synchronization complete.');
}

/** Base ESLint + Prettier deps shared by all non-Biome JS projects. */
const ESLINT_BASE_DEPS =
  'eslint @eslint/js typescript-eslint globals eslint-config-prettier eslint-plugin-simple-import-sort';

/** Extra deps for React/Vite projects. */
const ESLINT_VITE_EXTRA = 'eslint-plugin-react-hooks eslint-plugin-react-refresh';

/** Extra deps for Next.js projects (includes Vite extras via eslint-config-next). */
const ESLINT_NEXT_EXTRA =
  'eslint-config-next eslint-plugin-react-hooks eslint-plugin-react-refresh';

/** Prettier base — all non-Biome, non-node projects get the tailwind plugin. */
const PRETTIER_BASE_DEPS = 'prettier';
const PRETTIER_TAILWIND_EXTRA = 'prettier-plugin-tailwindcss';

export async function fleetUpgradeCommand(): Promise<void> {
  const fleet = getLocalFleet();
  if (fleet.length === 0) {
    log.info('No projects to upgrade.');
    return;
  }

  log.info(`Upgrading devDependencies across ${fleet.length} projects...\n`);

  for (const project of fleet) {
    const spinner = ora(`[${project.slug}] Upgrading...`).start();
    try {
      // Skip Biome projects entirely — they manage lint/format themselves
      if (usesBiome(project.path)) {
        spinner.info(`[${project.slug}] Skipped (Biome project)`);
        continue;
      }

      const type = detectProjectType(project.path);
      let deps = `${ESLINT_BASE_DEPS} ${PRETTIER_BASE_DEPS}`;

      if (type === 'next') {
        deps += ` ${ESLINT_NEXT_EXTRA} ${PRETTIER_TAILWIND_EXTRA}`;
      } else if (type === 'vite') {
        deps += ` ${ESLINT_VITE_EXTRA} ${PRETTIER_TAILWIND_EXTRA}`;
      }
      // node: no react/next plugins, no tailwind prettier plugin

      execSync(`pnpm add -D ${deps}`, {
        cwd: project.path,
        stdio: 'inherit',
        env: { ...process.env, FORCE_COLOR: 'true' },
      });
      spinner.succeed(`[${project.slug}] Upgraded (${type})`);
    } catch (err) {
      spinner.fail(
        `[${project.slug}] Upgrade failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  log.success('\nFleet-wide upgrade complete.');
}

import { checkProjectDrift, applyDriftFixes, type DriftReport } from '../lib/drift.js';

interface CheckDriftOptions {
  output?: 'table' | 'json';
  fix?: boolean;
}

/**
 * `fnd fleet check-drift` — audits every Fleet project against Foundry rules.
 *
 * Reads foundry.projects.json (registry of all Fleet projects + paths) and walks
 * the local Fleet directory. Resolves each registered slug to a path under
 * ~/Desktop/Fleet (or wherever the parent saas-maker lives), runs the drift
 * checker, and emits a table or JSON report. Exits with code 1 if any project
 * has at least one failed check. Pass --fix to auto-apply known fixes.
 */
export async function fleetCheckDriftCommand(options: CheckDriftOptions = {}): Promise<void> {
  const fleet = getLocalFleet();

  // Read the registry to map slugs → metadata. Resolve relative to the
  // currently-located saas-maker root.
  const cwd = process.cwd();
  const rootPath = cwd.includes('saas-maker')
    ? resolve(cwd.split('saas-maker')[0]!, 'saas-maker')
    : cwd;
  const manifestPath = join(rootPath, 'foundry.projects.json');
  let manifest: Record<string, { desc?: string; url?: string }> = {};
  if (existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    } catch {
      log.warn('foundry.projects.json present but unreadable — falling back to local fleet only.');
    }
  }

  // Build the list of (slug, projectPath) we want to audit:
  // - everything in the registry that exists locally
  // - plus any locally-detected fleet entries not in the registry (best-effort)
  const registrySlugs = Object.keys(manifest);
  const fleetByPath = new Map(fleet.map((p) => [p.path, p]));
  const targets: { name: string; path: string }[] = [];

  for (const slug of registrySlugs) {
    const guessPath = join(dirname(rootPath), slug);
    if (existsSync(join(guessPath, 'package.json'))) {
      targets.push({ name: slug, path: guessPath });
    }
  }
  for (const project of fleet) {
    if (!targets.find((t) => t.path === project.path)) {
      targets.push({ name: project.name, path: project.path });
    }
  }
  // Silence unused warning — fleetByPath kept for potential dedupe.
  void fleetByPath;

  if (targets.length === 0) {
    log.info('No projects detected to audit.');
    return;
  }

  log.info(`Checking drift for ${targets.length} projects...\n`);

  const reports: DriftReport[] = [];
  for (const t of targets) {
    reports.push(checkProjectDrift(t.path, t.name));
  }

  if (options.fix) {
    log.info('--fix enabled — applying known fixes\n');
    for (const r of reports) {
      const result = applyDriftFixes(r);
      if (result.applied.length > 0) {
        log.success(`[${r.project}] applied: ${result.applied.join(', ')}`);
      }
      if (result.skipped.length > 0) {
        log.info(`[${r.project}] no auto-fix: ${result.skipped.join(', ')}`);
      }
    }
    // Re-run after fixes to surface remaining drift
    reports.length = 0;
    for (const t of targets) reports.push(checkProjectDrift(t.path, t.name));
  }

  if (options.output === 'json') {
    console.log(JSON.stringify(reports, null, 2));
  } else {
    const rows = reports.map((r) => ({
      project: r.project,
      score: `${r.passCount}/${r.totalCount}`,
      failed:
        r.checks
          .filter((c) => c.status === 'fail')
          .map((c) => c.id)
          .join(',') || '—',
      warned:
        r.checks
          .filter((c) => c.status === 'warn')
          .map((c) => c.id)
          .join(',') || '—',
      status: r.checks.some((c) => c.status === 'fail')
        ? chalk.red('FAIL')
        : r.checks.some((c) => c.status === 'warn')
          ? chalk.yellow('WARN')
          : chalk.green('PASS'),
    }));
    printOutput(rows, {
      output: 'table',
      defaultColumns: ['project', 'score', 'failed', 'warned', 'status'],
    });
  }

  const anyFailed = reports.some((r) => r.checks.some((c) => c.status === 'fail'));
  if (anyFailed) {
    log.error('\nDrift detected. Re-run with `--fix` to auto-apply known fixes.');
    process.exitCode = 1;
  } else {
    log.success('\nNo drift detected.');
  }
}
