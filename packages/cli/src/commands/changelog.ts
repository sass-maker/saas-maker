import { createInterface } from 'node:readline/promises';
import ora from 'ora';
import { printOutput, type OutputFormat } from '../lib/output.js';
import { getResponseError, requestApi } from '../lib/request.js';
import { log } from '../lib/ui.js';
import { getLocalConfig, getLocalProjectId } from '../lib/config.js';

interface ChangelogListOptions {
  project?: string;
  output?: OutputFormat;
  select?: string;
  quiet?: boolean;
  raw?: boolean;
}

interface ChangelogCreateOptions {
  project?: string;
  title?: string;
  content?: string;
  status?: string;
  output?: OutputFormat;
  raw?: boolean;
}

interface ChangelogUpdateOptions {
  project?: string;
  title?: string;
  content?: string;
  status?: string;
  output?: OutputFormat;
  raw?: boolean;
}

function resolveProjectId(option?: string): string | null {
  if (option) return option;
  return getLocalProjectId(getLocalConfig());
}

export async function changelogListCommand(options: ChangelogListOptions = {}): Promise<void> {
  const projectId = resolveProjectId(options.project);
  if (!projectId) {
    log.error('No project ID. Pass --project <id> or run `fnd init`.');
    process.exitCode = 1;
    return;
  }

  const spinner = options.quiet ? null : ora('Loading changelog...').start();
  try {
    const res = await requestApi<{ data: unknown[] }>({
      path: `/v1/changelog/dashboard/${projectId}`,
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
      if (!options.quiet) log.info('No changelog entries yet.');
      return;
    }
    printOutput(items, {
      output: options.output ?? 'table',
      select: options.select,
      raw: options.raw,
      defaultColumns: ['id', 'title', 'status', 'published_at', 'created_at'],
    });
  } catch (err) {
    spinner?.stop();
    log.error(err instanceof Error ? err.message : 'Failed to list changelog');
  }
}

export async function changelogCreateCommand(options: ChangelogCreateOptions = {}): Promise<void> {
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
    const content = options.content ?? (await rl.question('Content (markdown): ')).trim();
    const status = options.status ?? 'draft';

    const spinner = ora('Creating changelog entry...').start();
    try {
      const res = await requestApi<{ data: unknown }>({
        path: `/v1/changelog/dashboard/${projectId}`,
        method: 'POST',
        auth: 'session',
        body: { title, content: content || undefined, status },
      });
      spinner.stop();
      if (!res.ok) {
        log.error(getResponseError(res));
        process.exitCode = 1;
        return;
      }
      log.success(`Created changelog entry: "${title}"`);
      printOutput(res.data?.data ?? res.data, {
        output: options.output ?? 'json',
        raw: options.raw,
      });
    } catch (err) {
      spinner.stop();
      log.error(err instanceof Error ? err.message : 'Failed to create changelog entry');
    }
  } finally {
    rl.close();
  }
}

export async function changelogUpdateCommand(
  id: string,
  options: ChangelogUpdateOptions = {}
): Promise<void> {
  const projectId = resolveProjectId(options.project);
  if (!projectId) {
    log.error('No project ID. Pass --project <id> or run `fnd init`.');
    process.exitCode = 1;
    return;
  }

  const body: Record<string, string> = {};
  if (options.title) body.title = options.title;
  if (options.content) body.content = options.content;
  if (options.status) body.status = options.status;
  if (Object.keys(body).length === 0) {
    log.error('Provide at least one of --title, --content, or --status.');
    process.exitCode = 1;
    return;
  }

  const spinner = ora('Updating changelog entry...').start();
  try {
    const res = await requestApi({
      path: `/v1/changelog/dashboard/${projectId}/${id}`,
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
    log.success('Changelog entry updated.');
    if (res.data) printOutput(res.data, { output: options.output ?? 'json', raw: options.raw });
  } catch (err) {
    spinner.stop();
    log.error(err instanceof Error ? err.message : 'Failed to update changelog entry');
  }
}

// CI-friendly: no interactive prompts. Reads git context automatically.
export async function changelogAutoCreateCommand(
  options: { title?: string; version?: string; message?: string; project?: string } = {}
): Promise<void> {
  const projectId = resolveProjectId(options.project);
  if (!projectId) {
    log.error('No project ID. Pass --project <id> or run `fnd init`.');
    process.exitCode = 1;
    return;
  }

  const { execSync } = await import('node:child_process');
  const lastCommit = execSync('git log -1 --format="%s"', { cwd: process.cwd() }).toString().trim();
  const currentVersion =
    options.version ||
    (() => {
      try {
        return execSync('git describe --tags --abbrev=0', {
          cwd: process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe'],
        })
          .toString()
          .trim();
      } catch {
        return execSync('git rev-parse --short HEAD', { cwd: process.cwd() }).toString().trim();
      }
    })();

  const title = options.title || `v${currentVersion}`;
  const content = options.message || lastCommit;

  const spinner = ora(`Creating changelog entry: ${title}`).start();
  try {
    const res = await requestApi<{ data: unknown }>({
      path: `/v1/changelog/dashboard/${projectId}`,
      method: 'POST',
      auth: 'session',
      body: { title, content: content || undefined, status: 'published' },
    });
    spinner.stop();
    if (!res.ok) {
      log.error(getResponseError(res));
      process.exitCode = 1;
      return;
    }
    log.success(`Changelog entry created: "${title}"`);
  } catch (err) {
    spinner.stop();
    log.error(err instanceof Error ? err.message : 'Failed to create changelog entry');
    process.exitCode = 1;
  }
}

export async function changelogDeleteCommand(
  id: string,
  options: { project?: string } = {}
): Promise<void> {
  const projectId = resolveProjectId(options.project);
  if (!projectId) {
    log.error('No project ID. Pass --project <id> or run `fnd init`.');
    process.exitCode = 1;
    return;
  }

  const spinner = ora('Deleting changelog entry...').start();
  try {
    const res = await requestApi({
      path: `/v1/changelog/dashboard/${projectId}/${id}`,
      method: 'DELETE',
      auth: 'session',
    });
    spinner.stop();
    if (!res.ok) {
      log.error(getResponseError(res));
      process.exitCode = 1;
      return;
    }
    log.success('Changelog entry deleted.');
  } catch (err) {
    spinner.stop();
    log.error(err instanceof Error ? err.message : 'Failed to delete changelog entry');
  }
}
