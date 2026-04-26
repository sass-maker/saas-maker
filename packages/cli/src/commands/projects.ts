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

interface ProjectsDeleteOptions {
  id?: string;
  force?: boolean;
}

interface ProjectsUpdateOptions {
  id?: string;
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
      if (!options.quiet) log.info('No projects yet. Run `fnd projects create` to create one.');
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

export async function projectsDeleteCommand(options: ProjectsDeleteOptions = {}): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    let projectId = options.id;

    if (!projectId) {
      const listRes = await requestApi<{ data: Project[] }>({ path: '/v1/projects', auth: 'session' });
      if (!listRes.ok) { log.error(getResponseError(listRes)); process.exitCode = 1; return; }
      const projects = listRes.data?.data ?? [];
      if (projects.length === 0) { log.info('No projects to delete.'); return; }

      log.info('Your projects:');
      projects.forEach((p, i) => console.log(`  ${i + 1}. ${p.name} (${p.slug}) — ${p.id}`));
      const choice = await rl.question('\nProject ID or number to delete: ');
      const num = parseInt(choice, 10);
      projectId = num > 0 && num <= projects.length ? projects[num - 1].id : choice.trim();
    }

    if (!projectId) { log.error('No project ID provided.'); return; }

    if (!options.force) {
      const confirm = await rl.question(`Delete project ${projectId}? This cannot be undone. (y/N) `);
      if (confirm.toLowerCase() !== 'y') { log.info('Cancelled.'); return; }
    }

    const spinner = ora('Deleting project...').start();
    try {
      const res = await requestApi({ path: `/v1/projects/${projectId}`, method: 'DELETE', auth: 'session' });
      spinner.stop();
      if (!res.ok) { log.error(getResponseError(res)); process.exitCode = 1; return; }
      log.success('Project deleted.');
    } catch (err) {
      spinner.stop();
      log.error(err instanceof Error ? err.message : 'Failed to delete project');
    }
  } finally {
    rl.close();
  }
}

export async function projectsUpdateCommand(options: ProjectsUpdateOptions = {}): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    let projectId = options.id;
    if (!projectId) {
      const listRes = await requestApi<{ data: Project[] }>({ path: '/v1/projects', auth: 'session' });
      if (!listRes.ok) { log.error(getResponseError(listRes)); process.exitCode = 1; return; }
      const projects = listRes.data?.data ?? [];
      if (projects.length === 0) { log.info('No projects.'); return; }

      log.info('Your projects:');
      projects.forEach((p, i) => console.log(`  ${i + 1}. ${p.name} (${p.slug}) — ${p.id}`));
      const choice = await rl.question('\nProject ID or number to update: ');
      const num = parseInt(choice, 10);
      projectId = num > 0 && num <= projects.length ? projects[num - 1].id : choice.trim();
    }

    if (!projectId) { log.error('No project ID provided.'); return; }

    const name = options.name ?? (await rl.question('New project name: ')).trim();
    if (!name) { log.error('Name cannot be empty.'); return; }

    const spinner = ora('Updating project...').start();
    try {
      const res = await requestApi<Project>({ path: `/v1/projects/${projectId}`, method: 'PATCH', auth: 'session', body: { name } });
      spinner.stop();
      if (!res.ok || !res.data) { log.error(getResponseError(res)); process.exitCode = 1; return; }
      log.success(`Updated project to "${res.data.name}"`);
      printOutput(res.data, { output: options.output ?? 'json', raw: options.raw });
    } catch (err) {
      spinner.stop();
      log.error(err instanceof Error ? err.message : 'Failed to update project');
    }
  } finally {
    rl.close();
  }
}
