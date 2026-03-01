import { createInterface } from 'node:readline/promises';
import { saveGlobalConfig, getGlobalConfig } from '../lib/config.js';
import { log } from '../lib/ui.js';

export async function loginCommand(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const apiKey = await rl.question('Enter your API key (pk_...): ');
    if (!apiKey.trim()) {
      log.error('API key cannot be empty.');
      return;
    }

    const config = getGlobalConfig();
    config.apiKey = apiKey.trim();
    saveGlobalConfig(config);
    log.success('API key saved to ~/.saasmaker/config.json');
  } finally {
    rl.close();
  }
}
