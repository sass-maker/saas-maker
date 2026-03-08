import { getApiKey, getApiBase, getLocalConfig, getLocalProjectId, getLocalProjectKey } from '../lib/config.js';
import { log } from '../lib/ui.js';

export function whoamiCommand(): void {
  const apiKey = getApiKey();
  const local = getLocalConfig();
  const base = getApiBase();

  if (!apiKey) {
    log.error('Not logged in. Run `saasmaker login` first.');
    return;
  }

  log.success('Logged in');
  log.dim(`  API Key: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`);
  log.dim(`  API Base: ${base}`);

  if (local) {
    const projectKey = getLocalProjectKey(local);
    const projectId = getLocalProjectId(local);
    if (projectId) log.dim(`  Project ID: ${projectId}`);
    if (projectKey) log.dim(`  Project Key: ${projectKey.slice(0, 8)}...${projectKey.slice(-4)}`);
    log.dim(`  Project Slug: ${local.slug}`);
  } else {
    log.dim('  No project linked. Run `saasmaker init` in a project directory.');
  }
}
