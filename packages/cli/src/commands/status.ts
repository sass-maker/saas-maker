import ora from 'ora';
import { getLocalConfig } from '../lib/config.js';
import { apiFetch } from '../lib/api.js';
import { log } from '../lib/ui.js';

export async function statusCommand(): Promise<void> {
  const local = getLocalConfig();
  if (!local) {
    log.error('No project linked. Run `saasmaker init` first.');
    return;
  }

  const spinner = ora(`Fetching status for ${local.slug}...`).start();

  try {
    const [feedbackRes, waitlistRes] = await Promise.allSettled([
      apiFetch<{ total: number }>(`/v1/feedback?type=all`),
      apiFetch<{ count: number }>('/v1/waitlist/count'),
    ]);

    spinner.stop();

    log.success(`Project: ${local.slug}`);

    if (feedbackRes.status === 'fulfilled') {
      log.dim(`  Feedback: ${feedbackRes.value.total ?? 0} items`);
    }

    if (waitlistRes.status === 'fulfilled') {
      log.dim(`  Waitlist: ${waitlistRes.value.count ?? 0} signups`);
    }
  } catch (err) {
    spinner.stop();
    log.error(err instanceof Error ? err.message : 'Failed to fetch status');
  }
}
