import { createInterface } from 'node:readline/promises';
import ora from 'ora';
import { printOutput, type OutputFormat } from '../lib/output.js';
import { getResponseError, requestApi } from '../lib/request.js';
import { log } from '../lib/ui.js';

interface Project {
  id: string;
  name: string;
  slug: string;
  api_key: string;
  created_at: string;
}

interface ProjectsListOptions {
  output?: OutputFormat;
  select?: string;
  quiet?: boolean;
  raw?: boolean;
}

interface ProjectsCreateOptions {
  name?: string;
  output?: OutputFormat;
  raw?: boolean;
}

export async function projectsListCommand(options: ProjectsListOptions = {}): Promise<void> {
  const spinner = options.quiet ? null : ora('Loading projects...').start();

  try {
    const res = await requestApi<{ data: Project[] }>({ path: '/v1/projects', auth: 'session' });
    spinner?.stop();

    if (!res.ok) {
      log.error(getResponseError(res));
      process.exitCode = 1;
      return;
    }

    const projects = res.data?.data ?? [];
    if (projects.length === 0) {
      if (!options.quiet) log.info('No projects yet. Run `saasmaker projects create` to create one.');
      return;
    }

    printOutput(projects, {
      output: options.output ?? 'table',
      select: options.select,
      raw: options.raw,
      defaultColumns: ['name', 'slug', 'created_at', 'id'],
    });
  } catch (err) {
    spinner?.stop();
    log.error(err instanceof Error ? err.message : 'Failed to list projects');
  }
}

export async function projectsCreateCommand(options: ProjectsCreateOptions = {}): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const inputName = options.name ?? await rl.question('Project name: ');
    const name = inputName.trim();
    if (!name) {
      log.error('Project name cannot be empty.');
      return;
    }

    const spinner = ora('Creating project...').start();
    try {
      const res = await requestApi<Project>({
        path: '/v1/projects',
        method: 'POST',
        auth: 'session',
        body: { name },
      });
      spinner.stop();

      if (!res.ok || !res.data) {
        log.error(getResponseError(res));
        process.exitCode = 1;
        return;
      }

      const project = res.data;
      log.success(`Created "${project.name}" (${project.slug})`);
      printOutput(project, {
        output: options.output ?? 'json',
        raw: options.raw,
      });
    } catch (err) {
      spinner.stop();
      log.error(err instanceof Error ? err.message : 'Failed to create project');
    }
  } finally {
    rl.close();
  }
}
