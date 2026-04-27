/**
 * definePlaywrightConfig — Foundry-standard Playwright config factory.
 *
 * Defaults:
 *  - timeout 30s, retries 2 in CI / 0 locally
 *  - 4-viewport matrix (mobile, tablet, desktop, wide)
 *  - reporter: list locally, [list, html, junit] in CI
 *  - screenshots + traces on first retry
 *
 * Pass `opts.baseURL` to override the test target.
 */

import { defineConfig as definePwConfig, devices } from '@playwright/test';
import type { PlaywrightTestConfig } from '@playwright/test';

export const FOUNDRY_VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
  wide: { width: 1920, height: 1080 },
} as const;

export interface PlaywrightOpts {
  baseURL?: string;
  testDir?: string;
  webServer?: PlaywrightTestConfig['webServer'];
  /** Add the 4-viewport matrix as project variants. Default: true. */
  viewportMatrix?: boolean;
  /** Add a smoke project (single chromium, fastest happy path). Default: true. */
  smoke?: boolean;
  /** Override or extend the resulting config. */
  extend?: Partial<PlaywrightTestConfig>;
}

declare const process: { env?: Record<string, string | undefined> } | undefined;

function isCI(): boolean {
  if (typeof process === 'undefined') return false;
  return Boolean(process.env?.['CI']);
}

export function definePlaywrightConfig(opts: PlaywrightOpts = {}): PlaywrightTestConfig {
  const ci = isCI();
  const projects: PlaywrightTestConfig['projects'] = [];

  if (opts.smoke ?? true) {
    projects.push({
      name: 'smoke',
      testMatch: /.*\.smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    });
  }

  if (opts.viewportMatrix ?? true) {
    projects.push(
      { name: 'mobile', use: { ...devices['Pixel 7'] } },
      { name: 'tablet', use: { ...devices['iPad Pro 11'] } },
      { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
      { name: 'wide', use: { ...devices['Desktop Chrome'], viewport: FOUNDRY_VIEWPORTS.wide } },
    );
  }

  return definePwConfig({
    testDir: opts.testDir ?? './tests/e2e',
    timeout: 30_000,
    expect: { timeout: 5_000 },
    fullyParallel: true,
    forbidOnly: ci,
    retries: ci ? 2 : 0,
    workers: ci ? 2 : undefined,
    reporter: ci ? [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]] : 'list',
    use: {
      baseURL: opts.baseURL,
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
      video: ci ? 'retain-on-failure' : 'off',
    },
    projects,
    webServer: opts.webServer,
    ...opts.extend,
  });
}
