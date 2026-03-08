import { getLocalConfig, getApiKey, getLocalProjectKey } from '../lib/config.js';
import { log } from '../lib/ui.js';

export function keysCommand(): void {
  const local = getLocalConfig();
  const apiKey = getApiKey();

  if (!apiKey) {
    log.error('Not logged in. Run `saasmaker login` first.');
    return;
  }

  log.info(`API Key: ${apiKey}`);

  if (local) {
    const projectKey = getLocalProjectKey(local);
    log.dim(`  Project: ${local.slug}`);
    if (projectKey) log.dim(`  Project Key: ${projectKey}`);
  }
}
