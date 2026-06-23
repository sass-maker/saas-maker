import { exec } from 'node:child_process';
import ora from 'ora';
import { saveGlobalConfig, getGlobalConfig, getApiBase } from '../lib/config.js';
import { log } from '../lib/ui.js';

function openBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin'
      ? `open "${url}"`
      : process.platform === 'win32'
        ? `start "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function loginCommand(): Promise<void> {
  const base = getApiBase();
  const spinner = ora('Requesting authorization code...').start();

  let code: string;
  let url: string;

  try {
    const res = await fetch(`${base}/v1/cli/code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = (await res.json()) as { code: string; url: string };
    code = data.code;
    url = data.url;
  } catch (err) {
    spinner.stop();
    log.error(err instanceof Error ? err.message : 'Failed to start login flow');
    return;
  }

  spinner.stop();
  log.info(`Opening browser to authorize...`);
  log.info(`If the browser doesn't open, visit: ${url}`);
  openBrowser(url);

  const pollSpinner = ora('Waiting for authorization...').start();
  const maxAttempts = 120; // 10 minutes at 5s intervals

  for (let i = 0; i < maxAttempts; i++) {
    await sleep(5000);

    try {
      const res = await fetch(`${base}/v1/cli/poll?code=${code}`);
      if (!res.ok) continue;
      const data = (await res.json()) as { status: string; token?: string };

      if (data.status === 'approved' && data.token) {
        pollSpinner.stop();
        const config = getGlobalConfig();
        config.apiKey = data.token;
        saveGlobalConfig(config);
        log.success('Logged in! Token saved to ~/.foundry/config.json');
        return;
      }

      if (data.status === 'expired') {
        pollSpinner.stop();
        log.error('Authorization code expired. Please try again.');
        return;
      }
    } catch {
      // Network error, keep polling
    }
  }

  pollSpinner.stop();
  log.error('Login timed out. Please try again.');
}
