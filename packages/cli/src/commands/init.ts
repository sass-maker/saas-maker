import { createInterface } from 'node:readline/promises';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ora from 'ora';
import { getResponseError, requestApi } from '../lib/request.js';
import { saveLocalConfig } from '../lib/config.js';
import { log } from '../lib/ui.js';
import { detectProjectType, applyStandard, scaffoldRenovate } from '../lib/forge.js';

interface Project {
  id: string;
  name: string;
  slug: string;
  api_key: string;
}

export async function initCommand(): Promise<void> {
  const configName = 'foundry.json';
  if (existsSync(join(process.cwd(), configName))) {
    log.info(`${configName} already exists in this directory.`);
    return;
  }

  const spinner = ora('Loading fleet projects...').start();
  let projects: Project[];

  try {
    const res = await requestApi<{ data: Project[] }>({ path: '/v1/projects', auth: 'session' });
    if (!res.ok) {
      spinner.stop();
      log.error(getResponseError(res));
      return;
    }
    projects = res.data?.data ?? [];
    spinner.stop();
  } catch (err) {
    spinner.stop();
    log.error(err instanceof Error ? err.message : 'Failed to load projects');
    return;
  }

  if (projects.length === 0) {
    log.info('No fleet projects found. Run `foundry fleet create` first.');
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
    saveLocalConfig({ slug: project.slug, projectId: project.id, projectKey: project.api_key });
    
    // Rename old config if it exists
    if (existsSync(join(process.cwd(), '.saasmaker.json'))) {
      const old = readFileSync(join(process.cwd(), '.saasmaker.json'), 'utf-8');
      writeFileSync(join(process.cwd(), configName), old);
      log.info('Migrated .saasmaker.json to foundry.json');
    }

    log.success(`Linked to "${project.name}" — wrote ${configName}`);

    // FOUNDRY FORGE: Apply Standards
    const type = detectProjectType();
    log.info(`Detected ${type} project. Applying Foundry Standards...`);
    
    applyStandard(type);
    scaffoldRenovate();

    // Print next steps
    console.log('\n🚀 Foundry Forge complete:');
    console.log(`  1. Install standards: pnpm add -D @saas-maker/tooling @saas-maker/eslint-config @saas-maker/tsconfig @saas-maker/prettier-config`);
    console.log(`  2. Set API Key in .env.local:`);
    console.log(`     NEXT_PUBLIC_FOUNDRY_KEY=${project.api_key}`);
  } finally {
    rl.close();
  }
}
