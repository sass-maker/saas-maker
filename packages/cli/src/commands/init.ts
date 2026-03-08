import { createInterface } from 'node:readline/promises';
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
  } finally {
    rl.close();
  }
}
