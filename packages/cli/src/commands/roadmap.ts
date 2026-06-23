import { createInterface } from 'node:readline/promises';
import ora from 'ora';
import { printOutput, type OutputFormat } from '../lib/output.js';
import { getResponseError, requestApi } from '../lib/request.js';
import { log } from '../lib/ui.js';
import { getLocalConfig, getLocalProjectId } from '../lib/config.js';

interface RoadmapListOptions {
  project?: string;
  output?: OutputFormat;
  select?: string;
  quiet?: boolean;
  raw?: boolean;
}

interface RoadmapCreateOptions {
  project?: string;
  title?: string;
  description?: string;
  status?: string;
  output?: OutputFormat;
  raw?: boolean;
}

interface RoadmapUpdateOptions {
  project?: string;
  title?: string;
  description?: string;
  status?: string;
  output?: OutputFormat;
  raw?: boolean;
}

function resolveProjectId(option?: string): string | null {
  if (option) return option;
  return getLocalProjectId(getLocalConfig());
}

export async function roadmapListCommand(options: RoadmapListOptions = {}): Promise<void> {
  const projectId = resolveProjectId(options.project);
  if (!projectId) {
    log.error('No project ID. Pass --project <id> or run `fnd init`.');
    process.exitCode = 1;
    return;
  }

  const spinner = options.quiet ? null : ora('Loading roadmap...').start();
  try {
    const res = await requestApi<{ data: unknown[] }>({
      path: `/v1/roadmap/dashboard/${projectId}`,
      auth: 'session',
    });
    spinner?.stop();
    if (!res.ok) {
      log.error(getResponseError(res));
      process.exitCode = 1;
      return;
    }

    const items = res.data?.data ?? [];
    if (items.length === 0) {
      if (!options.quiet) log.info('No roadmap items yet.');
      return;
    }
    printOutput(items, {
      output: options.output ?? 'table',
      select: options.select,
      raw: options.raw,
      defaultColumns: ['id', 'title', 'status', 'votes', 'created_at'],
    });
  } catch (err) {
    spinner?.stop();
    log.error(err instanceof Error ? err.message : 'Failed to list roadmap');
  }
}

export async function roadmapCreateCommand(options: RoadmapCreateOptions = {}): Promise<void> {
  const projectId = resolveProjectId(options.project);
  if (!projectId) {
    log.error('No project ID. Pass --project <id> or run `fnd init`.');
    process.exitCode = 1;
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const title = options.title ?? (await rl.question('Title: ')).trim();
    if (!title) {
      log.error('Title cannot be empty.');
      return;
    }
    const description =
      options.description ?? (await rl.question('Description (optional): ')).trim();
    const status = options.status ?? 'planned';

    const spinner = ora('Creating roadmap item...').start();
    try {
      const res = await requestApi<{ data: unknown }>({
        path: `/v1/roadmap/dashboard/${projectId}`,
        method: 'POST',
        auth: 'session',
        body: { title, description: description || undefined, status },
      });
      spinner.stop();
      if (!res.ok) {
        log.error(getResponseError(res));
        process.exitCode = 1;
        return;
      }
      log.success(`Created roadmap item: "${title}"`);
      printOutput(res.data?.data ?? res.data, {
        output: options.output ?? 'json',
        raw: options.raw,
      });
    } catch (err) {
      spinner.stop();
      log.error(err instanceof Error ? err.message : 'Failed to create roadmap item');
    }
  } finally {
    rl.close();
  }
}

export async function roadmapUpdateCommand(
  id: string,
  options: RoadmapUpdateOptions = {}
): Promise<void> {
  const projectId = resolveProjectId(options.project);
  if (!projectId) {
    log.error('No project ID. Pass --project <id> or run `fnd init`.');
    process.exitCode = 1;
    return;
  }

  const body: Record<string, string> = {};
  if (options.title) body.title = options.title;
  if (options.description) body.description = options.description;
  if (options.status) body.status = options.status;
  if (Object.keys(body).length === 0) {
    log.error('Provide at least one of --title, --description, or --status.');
    process.exitCode = 1;
    return;
  }

  const spinner = ora('Updating roadmap item...').start();
  try {
    const res = await requestApi({
      path: `/v1/roadmap/dashboard/${projectId}/${id}`,
      method: 'PATCH',
      auth: 'session',
      body,
    });
    spinner.stop();
    if (!res.ok) {
      log.error(getResponseError(res));
      process.exitCode = 1;
      return;
    }
    log.success('Roadmap item updated.');
    if (res.data) printOutput(res.data, { output: options.output ?? 'json', raw: options.raw });
  } catch (err) {
    spinner.stop();
    log.error(err instanceof Error ? err.message : 'Failed to update roadmap item');
  }
}

export async function roadmapDeleteCommand(
  id: string,
  options: { project?: string } = {}
): Promise<void> {
  const projectId = resolveProjectId(options.project);
  if (!projectId) {
    log.error('No project ID. Pass --project <id> or run `fnd init`.');
    process.exitCode = 1;
    return;
  }

  const spinner = ora('Deleting roadmap item...').start();
  try {
    const res = await requestApi({
      path: `/v1/roadmap/dashboard/${projectId}/${id}`,
      method: 'DELETE',
      auth: 'session',
    });
    spinner.stop();
    if (!res.ok) {
      log.error(getResponseError(res));
      process.exitCode = 1;
      return;
    }
    log.success('Roadmap item deleted.');
  } catch (err) {
    spinner.stop();
    log.error(err instanceof Error ? err.message : 'Failed to delete roadmap item');
  }
}
