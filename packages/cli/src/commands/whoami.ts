import { getApiKey, getApiBase, getLocalConfig } from '../lib/config.js';
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
    log.dim(`  Project: ${local.slug} (${local.projectId.slice(0, 8)}...)`);
  } else {
    log.dim('  No project linked. Run `saasmaker init` in a project directory.');
  }
}
