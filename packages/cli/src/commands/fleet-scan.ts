import ora from 'ora';
import { getLocalFleet } from '../lib/fleet.js';
import { detectTooling } from '../lib/tooling.js';
import { requestApi } from '../lib/request.js';
import { log } from '../lib/ui.js';

export async function fleetScanCommand(): Promise<void> {
  const fleet = getLocalFleet();
  if (fleet.length === 0) { log.error('No fleet projects detected.'); return; }

  const spinner = ora(`Scanning ${fleet.length} projects...`).start();
  const tooling = fleet.map(p => detectTooling(p.path, p.slug));
  spinner.text = 'Uploading to Foundry...';

  const res = await requestApi({
    method: 'POST',
    path: '/v1/fleet/metadata',
    auth: 'session',
    body: { projects: tooling, replace: true },
  });

  spinner.stop();
  if (res.ok) {
    log.success(`Fleet metadata synced — ${fleet.length} projects uploaded`);
    log.info('View at: https://app.sassmaker.com/fleet');
  } else {
    log.error('Upload failed. Run `fnd fleet dashboard` to view locally.');
  }
}
