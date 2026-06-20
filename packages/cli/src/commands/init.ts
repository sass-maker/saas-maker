import { createInterface } from 'node:readline/promises';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ora from 'ora';
import { getResponseError, requestApi } from '../lib/request.js';
import { saveLocalConfig } from '../lib/config.js';
import { log } from '../lib/ui.js';
import { detectProjectType, applyStandard, scaffoldRenovate, scaffoldCI, scaffoldHusky } from '../lib/forge.js';

interface Project {
  id: string;
  name: string;
  slug: string;
  api_key: string;
}

const FOUNDRY_CONFIG = 'foundry.json';
const LEGACY_CONFIG = '.saasmaker.json';

function applyOfflineFoundry(name: string): void {
  const type = detectProjectType();

  const config = {
    name,
    type,
    linked: false,
    standards: { eslint: true, tsconfig: true, prettier: true, renovate: true },
  };
  writeFileSync(join(process.cwd(), FOUNDRY_CONFIG), JSON.stringify(config, null, 2) + '\n');
  log.success(`Created ${FOUNDRY_CONFIG} (offline — not linked to fleet yet)`);

  log.info(`Detected ${type} project. Applying Foundry Standards...`);
  applyStandard(type);
  scaffoldRenovate();
  scaffoldCI();
  scaffoldHusky();

  console.log('\n✓ Foundry Standards applied:');
  console.log('  eslint.config.js, tsconfig.json, .prettierrc.json, renovate.json');
  console.log('\nNext:');
  console.log('  pnpm install   ← installs eslint/prettier devDeps from package.json');
  console.log('  fnd login      ← then re-run fnd init to link to fleet');
}

export async function initCommand(options: { offline?: boolean } = {}): Promise<void> {
  const cwd = process.cwd();
  const foundryPath = join(cwd, FOUNDRY_CONFIG);
  const legacyPath = join(cwd, LEGACY_CONFIG);

  // Auto-migrate legacy → canonical at the start of every init
  if (!existsSync(foundryPath) && existsSync(legacyPath)) {
    writeFileSync(foundryPath, readFileSync(legacyPath, 'utf-8'));
    try { require('node:fs').unlinkSync(legacyPath); } catch { /* ignore */ }
    log.info('Migrated .saasmaker.json → foundry.json');
  }

  if (existsSync(foundryPath)) {
    log.info(`${FOUNDRY_CONFIG} already exists in this directory.`);
    return;
  }

  // Derive project name from package.json if present
  let pkgName = 'my-project';
  const pkgPath = join(cwd, 'package.json');
  if (existsSync(pkgPath)) {
    try { pkgName = JSON.parse(readFileSync(pkgPath, 'utf-8')).name ?? pkgName; } catch {}
  }

  // --offline: skip API, apply standards locally, skip fleet link
  if (options.offline) {
    applyOfflineFoundry(pkgName);
    return;
  }

  const spinner = ora('Loading fleet projects...').start();
  let projects: Project[];

  try {
    const res = await requestApi<{ data: Project[] }>({ path: '/v1/projects', auth: 'session' });
    if (!res.ok) {
      spinner.stop();
      log.warn(`Could not reach fleet API (${getResponseError(res)}). Falling back to offline mode.`);
      log.info('Run `fnd login` to re-authenticate, then `fnd init` to link to fleet.');
      applyOfflineFoundry(pkgName);
      return;
    }
    projects = res.data?.data ?? [];
    spinner.stop();
  } catch (err) {
    spinner.stop();
    log.warn(`Network error: ${err instanceof Error ? err.message : 'Unknown'}. Falling back to offline mode.`);
    applyOfflineFoundry(pkgName);
    return;
  }

  if (projects.length === 0) {
    log.info('No fleet projects found. Run `fnd projects create` first.');
    return;
  }

  console.log('\nAvailable fleet projects:');
  projects.forEach((p, i) => console.log(`  ${i + 1}. ${p.name} (${p.slug})`));

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const choice = await rl.question(`\nSelect project to link (1-${projects.length}): `);
    const idx = parseInt(choice, 10) - 1;

    if (isNaN(idx) || idx < 0 || idx >= projects.length) {
      log.error('Invalid selection.');
      return;
    }

    const project = projects[idx];
    const type = detectProjectType();

    // Single canonical foundry.json with all data merged
    const config = {
      name: project.name,
      slug: project.slug,
      type,
      linked: true,
      projectId: project.id,
      projectKey: project.api_key,
      standards: { eslint: true, tsconfig: true, prettier: true, renovate: true },
    };
    writeFileSync(foundryPath, JSON.stringify(config, null, 2) + '\n');

    // saveLocalConfig also persists the slug/projectId/projectKey shape
    saveLocalConfig({
      slug: project.slug,
      projectId: project.id,
      projectKey: project.api_key,
      linked: true,
    });

    log.success(`Linked to "${project.name}" — wrote ${FOUNDRY_CONFIG}`);

    log.info(`Detected ${type} project. Applying Foundry Standards...`);
    applyStandard(type);
    scaffoldRenovate();
    scaffoldCI();

    console.log('\n✓ Foundry Forge complete:');
    console.log('  1. Install dev tooling:');
    console.log('     pnpm install');
    console.log(`  2. Add to .env.local:`);
    console.log(`     NEXT_PUBLIC_FOUNDRY_KEY=${project.api_key}`);
  } finally {
    rl.close();
  }
}
