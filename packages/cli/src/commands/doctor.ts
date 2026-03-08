import {
  getApiBase,
  getApiKey,
  getLocalConfig,
  getLocalProjectId,
  getLocalProjectKey,
} from '../lib/config.js';
import { printOutput, type OutputFormat } from '../lib/output.js';
import { requireLinkedProjectId } from '../lib/project.js';
import { getResponseError, requestApi } from '../lib/request.js';

type CheckStatus = 'pass' | 'warn' | 'fail';

interface DoctorOptions {
  output?: OutputFormat;
  select?: string;
  raw?: boolean;
}

interface DoctorCheck {
  check: string;
  status: CheckStatus;
  detail: string;
}

function pushCheck(
  checks: DoctorCheck[],
  check: string,
  status: CheckStatus,
  detail: string
): void {
  checks.push({ check, status, detail });
}

export async function doctorCommand(options: DoctorOptions = {}): Promise<void> {
  const checks: DoctorCheck[] = [];

  pushCheck(checks, 'API Base', 'pass', getApiBase());

  try {
    const health = await requestApi<{ status?: string }>({
      path: '/health',
      auth: 'none',
    });
    if (health.ok && health.data?.status === 'ok') {
      pushCheck(checks, 'Health Endpoint', 'pass', 'Reachable');
    } else {
      pushCheck(checks, 'Health Endpoint', 'fail', getResponseError(health));
    }
  } catch (err) {
    pushCheck(
      checks,
      'Health Endpoint',
      'fail',
      err instanceof Error ? err.message : 'Request failed'
    );
  }

  const token = getApiKey();
  if (!token) {
    pushCheck(checks, 'Session Token', 'warn', 'Missing. Run `saasmaker login`.');
  } else {
    pushCheck(checks, 'Session Token', 'pass', `Present (${token.slice(0, 8)}...${token.slice(-4)})`);
    try {
      const projects = await requestApi<{ data?: unknown[] }>({
        path: '/v1/projects',
        auth: 'session',
      });
      if (!projects.ok) {
        pushCheck(checks, 'Session Auth', 'fail', getResponseError(projects));
      } else {
        const count = Array.isArray(projects.data?.data) ? projects.data.data.length : 0;
        pushCheck(checks, 'Session Auth', 'pass', `Authorized (${count} project(s) visible)`);
      }
    } catch (err) {
      pushCheck(
        checks,
        'Session Auth',
        'fail',
        err instanceof Error ? err.message : 'Request failed'
      );
    }
  }

  const local = getLocalConfig();
  if (!local) {
    pushCheck(checks, 'Linked Project', 'warn', 'Missing .saasmaker.json. Run `saasmaker init`.');
  } else {
    pushCheck(checks, 'Linked Project', 'pass', `Slug: ${local.slug}`);

    const projectKey = getLocalProjectKey(local);
    if (!projectKey) {
      pushCheck(checks, 'Project Key', 'warn', 'Missing project key. Run `saasmaker init` again.');
    } else {
      pushCheck(
        checks,
        'Project Key',
        'pass',
        `${projectKey.slice(0, 8)}...${projectKey.slice(-4)}`
      );

      try {
        const waitlist = await requestApi<{ count?: number }>({
          path: '/v1/waitlist/count',
          auth: 'project',
          projectKey,
        });
        if (!waitlist.ok) {
          pushCheck(checks, 'Project Auth', 'fail', getResponseError(waitlist));
        } else {
          pushCheck(checks, 'Project Auth', 'pass', 'Project key is valid');
        }
      } catch (err) {
        pushCheck(
          checks,
          'Project Auth',
          'fail',
          err instanceof Error ? err.message : 'Request failed'
        );
      }
    }

    const localProjectId = getLocalProjectId(local);
    if (localProjectId) {
      pushCheck(checks, 'Project ID', 'pass', localProjectId);
    } else if (!token) {
      pushCheck(checks, 'Project ID', 'warn', 'Cannot resolve without session token');
    } else {
      try {
        const projectId = await requireLinkedProjectId();
        pushCheck(checks, 'Project ID', 'pass', `${projectId} (resolved by slug)`);
      } catch (err) {
        pushCheck(
          checks,
          'Project ID',
          'fail',
          err instanceof Error ? err.message : 'Failed to resolve project id'
        );
      }
    }
  }

  printOutput(checks, {
    output: options.output ?? 'table',
    select: options.select,
    raw: options.raw,
    defaultColumns: ['check', 'status', 'detail'],
  });

  if (checks.some((c) => c.status === 'fail')) {
    process.exitCode = 1;
  }
}
