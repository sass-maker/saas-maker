import type { BrowserAcceptanceRequest, RunExecutionInput } from './types';

type BrowserAcceptanceProcess = {
  id: string;
  waitForPort(port: number, options?: { timeout?: number; path?: string }): Promise<void>;
  getLogs(): Promise<{ stdout: string; stderr: string }>;
  kill(signal?: string): Promise<void>;
};

type SandboxLike = {
  startProcess(
    command: string,
    options?: { cwd?: string; timeout?: number; processId?: string; autoCleanup?: boolean }
  ): Promise<BrowserAcceptanceProcess>;
  exposePort(
    port: number,
    options: { hostname: string; name?: string; token?: string }
  ): Promise<{ url: string; port: number; name: string | undefined }>;
};

type OptionalSandboxLike = Partial<SandboxLike>;

export interface BrowserAcceptanceResult {
  passed: boolean;
  summary: string;
  url: string;
  sessionId?: string;
  title?: string;
  screenshotDataUri?: string;
  stdout: string;
  stderr: string;
}

export async function runBrowserAcceptance(
  input: RunExecutionInput,
  sandbox: OptionalSandboxLike,
  cwd: string,
  config: BrowserAcceptanceRequest
): Promise<BrowserAcceptanceResult> {
  const timeoutSeconds = clampTimeout(config.timeout_seconds);
  const timeoutMs = timeoutSeconds * 1000;
  const assertions = normalizeAssertions(config.assert_text);
  let targetUrl = config.url?.trim();
  let process: Awaited<ReturnType<SandboxLike['startProcess']>> | null = null;

  await input.recordEvent({
    type: 'browser_acceptance_start',
    actor: 'tester',
    source: 'browser',
    command: config.start_command,
    cwd,
    message: 'Running Droid browser acceptance.',
    metadata: {
      goal: config.goal ?? null,
      url: targetUrl ?? null,
      assert_text: assertions,
      timeout_ms: timeoutMs,
    },
  });

  try {
    if (!targetUrl && config.start_command) {
      if (!sandbox.startProcess || !sandbox.exposePort) {
        return await recordBrowserFailure(input, {
          summary: 'Browser acceptance needs a sandbox to run start_command.',
          url: '',
          stdout: '',
          stderr: 'No sandbox process API is available for browser_acceptance.start_command.',
        });
      }
      const port = normalizePort(config.port);
      if (!port) {
        return await recordBrowserFailure(input, {
          summary: 'Browser acceptance needs a valid port when start_command is used.',
          url: '',
          stdout: '',
          stderr: 'browser_acceptance.port must be between 1024 and 65535.',
        });
      }
      const hostname =
        config.preview_hostname?.trim() || input.env.DROID_BROWSER_PREVIEW_HOSTNAME?.trim();
      if (!hostname) {
        return await recordBrowserFailure(input, {
          summary: 'Browser acceptance needs a preview hostname to expose the sandbox app.',
          url: '',
          stdout: '',
          stderr: 'Set browser_acceptance.preview_hostname or DROID_BROWSER_PREVIEW_HOSTNAME.',
        });
      }
      process = await sandbox.startProcess(config.start_command, {
        cwd,
        timeout: timeoutMs,
        processId: `droid-browser-${input.runId}`,
        autoCleanup: true,
      });
      await process.waitForPort(port, { timeout: Math.min(timeoutMs, 120000) });
      const exposed = await sandbox.exposePort(port, {
        hostname,
        name: 'droid-browser-acceptance',
      });
      targetUrl = exposed.url;
    }

    if (!targetUrl) {
      return await recordBrowserFailure(input, {
        summary: 'Browser acceptance needs either url or start_command.',
        url: '',
        stdout: '',
        stderr: 'browser_acceptance.url or browser_acceptance.start_command is required.',
      });
    }

    if (!isHttpUrl(targetUrl)) {
      return await recordBrowserFailure(input, {
        summary: 'Browser acceptance URL must be http or https.',
        url: targetUrl,
        stdout: '',
        stderr: `Unsupported browser acceptance URL: ${targetUrl}`,
      });
    }

    if (!input.env.BROWSER) {
      return await recordBrowserFailure(input, {
        summary: 'Cloudflare Browser Run binding is not configured.',
        url: targetUrl,
        stdout: '',
        stderr: 'Add a Browser Run binding named BROWSER to the Droid Worker.',
      });
    }

    const playwright = await import('@cloudflare/playwright');
    const browser = await playwright.launch(input.env.BROWSER, {
      keep_alive: clampKeepAlive(config.keep_open === true ? 600000 : 10000),
    });
    let closeBrowser = config.keep_open !== true;
    try {
      const page = await browser.newPage();
      const sessionId = typeof browser.sessionId === 'function' ? browser.sessionId() : undefined;
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: timeoutMs });
      const title = await page.title().catch(() => '');
      const bodyText = await page
        .locator('body')
        .innerText({ timeout: 5000 })
        .catch(() => '');
      const missing = assertions.filter((text) => !bodyText.includes(text));
      const screenshot = await page.screenshot({
        fullPage: false,
        type: 'jpeg',
        quality: 50,
      });
      const screenshotDataUri = dataUriFromBytes(screenshot, 'image/jpeg');
      const passed = missing.length === 0;
      const summary = passed
        ? 'Browser acceptance passed.'
        : `Browser acceptance failed; missing text: ${missing.join(', ')}`;

      await input.recordEvent({
        type: passed ? 'browser_acceptance_passed' : 'browser_acceptance_failed',
        actor: 'tester',
        source: 'browser',
        command: config.start_command,
        cwd,
        exit_code: passed ? 0 : 78,
        stdout: trimForEvent(bodyText),
        stderr: passed ? '' : summary,
        message: summary,
        metadata: {
          goal: config.goal ?? null,
          url: targetUrl,
          title,
          session_id: sessionId ?? null,
          assert_text: assertions,
          missing_text: missing,
          keep_open: config.keep_open === true,
          live_view_hint: sessionId
            ? 'Open Cloudflare Browser Run Live Sessions and select this session id.'
            : null,
        },
      });
      await input.recordArtifact({
        type: 'browser_acceptance',
        name: passed ? 'Browser acceptance screenshot' : 'Browser acceptance failure screenshot',
        uri: `event://runs/${input.runId}/${passed ? 'browser_acceptance_passed' : 'browser_acceptance_failed'}`,
        metadata: {
          goal: config.goal ?? null,
          url: targetUrl,
          title,
          session_id: sessionId ?? null,
          screenshot_data_uri: screenshotDataUri,
          assert_text: assertions,
          missing_text: missing,
          keep_open: config.keep_open === true,
        },
      });

      if (config.keep_open === true) closeBrowser = false;
      return {
        passed,
        summary,
        url: targetUrl,
        sessionId,
        title,
        screenshotDataUri: screenshotDataUri ?? undefined,
        stdout: bodyText,
        stderr: passed ? '' : summary,
      };
    } finally {
      if (closeBrowser) await browser.close();
    }
  } catch (error) {
    const logs = process ? await safeProcessLogs(process) : { stdout: '', stderr: '' };
    return await recordBrowserFailure(input, {
      summary: error instanceof Error ? error.message : 'Browser acceptance failed.',
      url: targetUrl ?? '',
      stdout: logs.stdout,
      stderr: appendTail(
        logs.stderr,
        error instanceof Error ? error.message : 'Browser acceptance failed.'
      ),
    });
  } finally {
    if (process) await process.kill().catch(() => undefined);
  }
}

export function isBrowserAcceptanceEnabled(
  config: BrowserAcceptanceRequest | undefined
): config is BrowserAcceptanceRequest {
  if (!config) return false;
  if (config.enabled === false) return false;
  return Boolean(config.url?.trim() || config.start_command?.trim() || config.goal?.trim());
}

function clampTimeout(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value)
    ? Math.min(Math.max(value, 30), 300)
    : 120;
}

function clampKeepAlive(value: number): number {
  return Math.min(Math.max(value, 10000), 600000);
}

function normalizePort(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1024 && value <= 65535
    ? value
    : undefined;
}

function normalizeAssertions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function safeProcessLogs(process: BrowserAcceptanceProcess) {
  try {
    return await process.getLogs();
  } catch {
    return { stdout: '', stderr: '' };
  }
}

async function recordBrowserFailure(
  input: RunExecutionInput,
  result: Pick<BrowserAcceptanceResult, 'summary' | 'url' | 'stdout' | 'stderr'>
): Promise<BrowserAcceptanceResult> {
  await input.recordEvent({
    type: 'browser_acceptance_failed',
    actor: 'tester',
    source: 'browser',
    exit_code: 78,
    stdout: result.stdout,
    stderr: result.stderr,
    message: result.summary,
    metadata: { url: result.url || null },
  });
  await input.recordArtifact({
    type: 'browser_acceptance',
    name: 'Browser acceptance failure',
    uri: `event://runs/${input.runId}/browser_acceptance_failed`,
    metadata: {
      url: result.url || null,
      error: result.summary,
    },
  });
  return {
    passed: false,
    summary: result.summary,
    url: result.url,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function dataUriFromBytes(bytes: Uint8Array, contentType: string): string | null {
  if (bytes.byteLength > 512000) return null;
  let binary = '';
  for (let index = 0; index < bytes.byteLength; index += 8192) {
    binary += String.fromCharCode(...bytes.slice(index, index + 8192));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

function trimForEvent(value: string): string {
  return value.length > 12000 ? `${value.slice(0, 12000)}\n...[truncated]` : value;
}

function appendTail(value: string, tail: string): string {
  if (!value.trim()) return tail;
  if (!tail.trim()) return value;
  return `${value.trimEnd()}\n${tail}`;
}
