import { getApiBase, getApiKey, getLocalConfig } from '../lib/config.js';
import { printOutput, type OutputFormat } from '../lib/output.js';
import { getResponseError, requestApi } from '../lib/request.js';
import { auditProject } from '../lib/auditor.js';

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

  // 1. API & Session Checks
  pushCheck(checks, 'API Base', 'pass', getApiBase());

  try {
    const health = await requestApi<{ status?: string }>({ path: '/health', auth: 'none' });
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
    pushCheck(checks, 'Session Token', 'warn', 'Missing. Run `foundry login`.');
  } else {
    pushCheck(checks, 'Session Token', 'pass', `Present (${token.slice(0, 8)}...)`);
  }

  // 2. Project Link Checks
  const local = getLocalConfig();
  if (!local) {
    pushCheck(checks, 'Linked Project', 'warn', 'Missing foundry.json. Run `foundry init`.');
  } else {
    pushCheck(checks, 'Linked Project', 'pass', `Slug: ${local.slug}`);
  }

  // 3. Foundry Standard Compliance (Deep Inspection)
  const compliance = auditProject();
  compliance.forEach((c) => pushCheck(checks, `Standard: ${c.check}`, c.status, c.detail));

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
