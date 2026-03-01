import { createInterface } from 'node:readline/promises';
import ora from 'ora';
import { apiFetch } from '../lib/api.js';
import { log, table } from '../lib/ui.js';

interface Project {
  id: string;
  name: string;
  slug: string;
  api_key: string;
  created_at: string;
}

export async function projectsListCommand(): Promise<void> {
  const spinner = ora('Loading projects...').start();

  try {
    const res = await apiFetch<{ data: Project[] }>('/v1/projects');
    spinner.stop();

    const projects = res.data ?? [];
    if (projects.length === 0) {
      log.info('No projects yet. Run `saasmaker projects create` to create one.');
      return;
    }

    table([
      ['NAME', 'SLUG', 'CREATED'],
      ...projects.map((p) => [
        p.name,
        p.slug,
        new Date(p.created_at).toLocaleDateString(),
      ]),
    ]);
  } catch (err) {
    spinner.stop();
    log.error(err instanceof Error ? err.message : 'Failed to list projects');
  }
}

export async function projectsCreateCommand(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const name = await rl.question('Project name: ');
    if (!name.trim()) {
      log.error('Project name cannot be empty.');
      return;
    }

    const spinner = ora('Creating project...').start();

    try {
      const project = await apiFetch<Project>('/v1/projects', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      spinner.stop();
      log.success(`Created "${project.name}" (${project.slug})`);
      log.dim(`  API Key: ${project.api_key}`);
    } catch (err) {
      spinner.stop();
      log.error(err instanceof Error ? err.message : 'Failed to create project');
    }
  } finally {
    rl.close();
  }
}
