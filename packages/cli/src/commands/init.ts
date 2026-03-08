import { createInterface } from 'node:readline/promises';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ora from 'ora';
import { getResponseError, requestApi } from '../lib/request.js';
import { saveLocalConfig, hasLocalConfig } from '../lib/config.js';
import { log } from '../lib/ui.js';

interface Project {
  id: string;
  name: string;
  slug: string;
  api_key: string;
}

export async function initCommand(): Promise<void> {
  if (hasLocalConfig()) {
    log.info('.saasmaker.json already exists in this directory.');
    return;
  }

  const spinner = ora('Loading projects...').start();
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
    log.info('No projects found. Run `saasmaker projects create` first.');
    return;
  }

  console.log('\nAvailable projects:');
  projects.forEach((p, i) => console.log(`  ${i + 1}. ${p.name} (${p.slug})`));

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const choice = await rl.question(`\nSelect project (1-${projects.length}): `);
    const idx = parseInt(choice, 10) - 1;

    if (isNaN(idx) || idx < 0 || idx >= projects.length) {
      log.error('Invalid selection.');
      return;
    }

    const project = projects[idx];
    saveLocalConfig({ slug: project.slug, projectId: project.id, projectKey: project.api_key });
    log.success(`Linked to "${project.name}" — wrote .saasmaker.json`);

    // Scaffold dependabot config for automatic SDK updates
    scaffoldDependabot();

    // Print next steps
    console.log('\n📋 Next steps:');
    console.log(`  1. Add your API key to .env.local:`);
    console.log(`     NEXT_PUBLIC_SAASMAKER_API_KEY=${project.api_key}`);
    console.log(`     (or VITE_SAASMAKER_API_KEY= for Vite projects)`);
    console.log(`  2. Install the SDK: pnpm add @saas-maker/sdk`);
    console.log(`  3. See integration guide: https://docs.sassmaker.com/getting-started/integration`);
  } finally {
    rl.close();
  }
}

const DEPENDABOT_CONFIG = `version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule:
      interval: weekly
      day: monday
    allow:
      - dependency-name: "@saas-maker/sdk"
    commit-message:
      prefix: "deps"
    open-pull-requests-limit: 1
`;

function scaffoldDependabot(): void {
  const dir = join(process.cwd(), '.github');
  const file = join(dir, 'dependabot.yml');

  if (existsSync(file)) return;

  mkdirSync(dir, { recursive: true });
  writeFileSync(file, DEPENDABOT_CONFIG, 'utf-8');
  log.success('Created .github/dependabot.yml — SDK updates will be auto-PRed weekly');
}
