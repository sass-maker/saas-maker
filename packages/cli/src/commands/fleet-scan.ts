import ora from 'ora';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getLocalFleet } from '../lib/fleet.js';
import { detectTooling } from '../lib/tooling.js';
import { requestApi } from '../lib/request.js';
import { log } from '../lib/ui.js';

function getSaasMakerRoot() {
  const cwd = process.cwd();
  return cwd.includes('saas-maker')
    ? resolve(cwd.split('saas-maker')[0]!, 'saas-maker')
    : cwd;
}

function getManifestSlugs() {
  const rootPath = getSaasMakerRoot();
  const manifestPath = join(rootPath, 'foundry.projects.json');

  if (!existsSync(manifestPath)) return null;

  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>;
    return new Set(Object.keys(manifest));
  } catch {
    return null;
  }
}

export async function fleetScanCommand(): Promise<void> {
  const manifestSlugs = getManifestSlugs();
  const localFleet = getLocalFleet();
  const fleet = manifestSlugs
    ? localFleet.filter((project) => manifestSlugs.has(project.slug))
    : localFleet;
  const rootPath = getSaasMakerRoot();
  if (manifestSlugs?.has('saas-maker') && !fleet.some((project) => project.slug === 'saas-maker')) {
    fleet.push({
      name: 'saas-maker',
      path: rootPath,
      slug: 'saas-maker',
      type: 'node',
      isFoundry: existsSync(join(rootPath, 'foundry.json')),
    });
  }
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
