import ora from 'ora';
import { getApiKey, getLocalConfig, getLocalProjectKey } from '../lib/config.js';
import { printOutput, type OutputFormat } from '../lib/output.js';
import { requireLinkedProjectId } from '../lib/project.js';
import { getResponseError, requestApi, type ApiResponse } from '../lib/request.js';
import { log } from '../lib/ui.js';

interface StatusOptions {
  output?: OutputFormat;
  select?: string;
  quiet?: boolean;
  raw?: boolean;
}

interface FeatureStatus {
  feature: string;
  count: number | null;
  source: 'project' | 'session' | 'fallback';
  status: 'ok' | 'unavailable';
  error?: string;
}

function getDataObject(response: ApiResponse<unknown>): Record<string, unknown> | null {
  if (!response.ok || !response.data || typeof response.data !== 'object') return null;
  return response.data as Record<string, unknown>;
}

function countFromList(response: ApiResponse<unknown>): number | null {
  const data = getDataObject(response);
  if (!data) return null;

  if (typeof data.total === 'number') return data.total;
  if (Array.isArray(data.data)) return data.data.length;
  return null;
}

function countFromSingleNumber(response: ApiResponse<unknown>, field: string): number | null {
  const data = getDataObject(response);
  if (!data) return null;
  const value = data[field];
  return typeof value === 'number' ? value : null;
}

function asFeature(
  feature: string,
  response: ApiResponse<unknown>,
  source: 'project' | 'session' | 'fallback',
  count: number | null
): FeatureStatus {
  if (count !== null) {
    return { feature, count, source, status: 'ok' };
  }
  return {
    feature,
    count: null,
    source,
    status: 'unavailable',
    error: response.ok ? 'No count in response' : getResponseError(response),
  };
}

export async function statusCommand(options: StatusOptions = {}): Promise<void> {
  const local = getLocalConfig();
  if (!local) {
    log.error('No project linked. Run `fnd init` first.');
    return;
  }

  const projectKey = getLocalProjectKey(local);
  if (!projectKey) {
    log.error('No linked project key found. Run `fnd init` again.');
    return;
  }

  const spinner = options.quiet ? null : ora(`Fetching status for ${local.slug}...`).start();

  let linkedProjectId: string | null = null;
  if (getApiKey()) {
    try {
      linkedProjectId = await requireLinkedProjectId();
    } catch {
      linkedProjectId = null;
    }
  }

  try {
    const [
      feedbackRes,
      waitlistRes,
      testimonialsPublicRes,
      changelogPublicRes,
      testimonialsSessionRes,
      changelogSessionRes,
    ] = await Promise.all([
      requestApi({ path: '/v1/feedback', auth: 'project', projectKey }),
      requestApi({ path: '/v1/waitlist/count', auth: 'project', projectKey }),
      requestApi({ path: '/v1/testimonials', auth: 'project', projectKey }),
      requestApi({ path: '/v1/changelog', auth: 'project', projectKey }),
      linkedProjectId
        ? requestApi({ path: '/v1/testimonials/all', auth: 'session', query: { project_id: linkedProjectId } })
        : Promise.resolve({ ok: false, status: 0, url: '', data: undefined, text: 'Session route unavailable' }),
      linkedProjectId
        ? requestApi({ path: `/v1/changelog/dashboard/${linkedProjectId}`, auth: 'session' })
        : Promise.resolve({ ok: false, status: 0, url: '', data: undefined, text: 'Session route unavailable' }),
    ]);

    spinner?.stop();
    if (!options.quiet) log.success(`Project: ${local.slug}`);

    const features: FeatureStatus[] = [
      asFeature('Feedback', feedbackRes, 'project', countFromList(feedbackRes)),
      asFeature('Waitlist', waitlistRes, 'project', countFromSingleNumber(waitlistRes, 'count')),
      testimonialsSessionRes.ok
        ? asFeature('Testimonials', testimonialsSessionRes, 'session', countFromList(testimonialsSessionRes))
        : asFeature('Testimonials', testimonialsPublicRes, 'fallback', countFromList(testimonialsPublicRes)),
      changelogSessionRes.ok
        ? asFeature('Changelog', changelogSessionRes, 'session', countFromList(changelogSessionRes))
        : asFeature('Changelog', changelogPublicRes, 'fallback', countFromList(changelogPublicRes)),
    ];

    const outputData = {
      project: local.slug,
      features,
    };

    if ((options.output ?? 'table') === 'json') {
      printOutput(outputData, {
        output: 'json',
        select: options.select,
        raw: options.raw,
      });
      return;
    }

    printOutput(features, {
      output: 'table',
      select: options.select,
      defaultColumns: ['feature', 'count', 'source', 'status', 'error'],
      emptyMessage: 'No status data',
    });
  } catch (err) {
    spinner?.stop();
    log.error(err instanceof Error ? err.message : 'Failed to fetch status');
  }
}
