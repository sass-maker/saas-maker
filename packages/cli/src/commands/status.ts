import ora from 'ora';
import { getLocalConfig } from '../lib/config.js';
import { apiFetch } from '../lib/api.js';
import { log } from '../lib/ui.js';

interface FeatureStatus {
  name: string;
  count: number | null;
  label: string;
}

export async function statusCommand(): Promise<void> {
  const local = getLocalConfig();
  if (!local) {
    log.error('No project linked. Run `saasmaker init` first.');
    return;
  }

  const spinner = ora(`Fetching status for ${local.slug}...`).start();

  try {
    const [feedbackRes, waitlistRes, testimonialsRes, linksRes, indexesRes, changelogRes] = await Promise.allSettled([
      apiFetch<{ total: number }>(`/v1/feedback?type=all`),
      apiFetch<{ count: number }>('/v1/waitlist/count'),
      apiFetch<{ data: unknown[] }>('/v1/testimonials'),
      apiFetch<{ data: unknown[]; total: number }>('/v1/links'),
      apiFetch<{ data: unknown[] }>('/v1/indexes'),
      apiFetch<{ data: unknown[] }>('/v1/changelog'),
    ]);

    spinner.stop();

    log.success(`Project: ${local.slug}`);
    console.log('');

    const features: FeatureStatus[] = [
      {
        name: 'Feedback',
        count: feedbackRes.status === 'fulfilled' ? (feedbackRes.value.total ?? 0) : null,
        label: 'items',
      },
      {
        name: 'Waitlist',
        count: waitlistRes.status === 'fulfilled' ? (waitlistRes.value.count ?? 0) : null,
        label: 'signups',
      },
      {
        name: 'Testimonials',
        count: testimonialsRes.status === 'fulfilled' ? (testimonialsRes.value.data?.length ?? 0) : null,
        label: 'entries',
      },
      {
        name: 'Links',
        count: linksRes.status === 'fulfilled' ? (linksRes.value.total ?? 0) : null,
        label: 'links',
      },
      {
        name: 'Indexes',
        count: indexesRes.status === 'fulfilled' ? (indexesRes.value.data?.length ?? 0) : null,
        label: 'indexes',
      },
      {
        name: 'Changelog',
        count: changelogRes.status === 'fulfilled' ? (changelogRes.value.data?.length ?? 0) : null,
        label: 'entries',
      },
    ];

    for (const f of features) {
      if (f.count !== null) {
        const status = f.count > 0 ? '●' : '○';
        log.dim(`  ${status} ${f.name.padEnd(14)} ${f.count} ${f.label}`);
      } else {
        log.dim(`  ○ ${f.name.padEnd(14)} —`);
      }
    }
  } catch (err) {
    spinner.stop();
    log.error(err instanceof Error ? err.message : 'Failed to fetch status');
  }
}
