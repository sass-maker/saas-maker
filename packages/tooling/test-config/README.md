# @saas-maker/test-config

Factory functions for Playwright + Vitest with Foundry defaults baked in. Stops every Fleet repo from re-deciding `timeout`, `retries`, viewport matrix, etc.

## Install

```bash
pnpm add -D @saas-maker/test-config @playwright/test @axe-core/playwright vitest
```

## Playwright

```ts
// playwright.config.ts
import { definePlaywrightConfig } from '@saas-maker/test-config/playwright';

export default definePlaywrightConfig({
  baseURL: 'http://localhost:3000',
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

Defaults:
- `testDir` = `./tests/e2e`
- `timeout` = 30s, `expect.timeout` = 5s
- `retries` = 2 in CI, 0 locally
- Reporter: `list` locally; `[list, html, junit]` in CI
- `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`, `video: retain-on-failure` in CI
- 5 projects: `smoke`, `mobile` (Pixel 7), `tablet` (iPad Pro 11), `desktop` (Chrome), `wide` (1920x1080)

## Vitest

```ts
// vitest.config.ts
import { defineVitestConfig } from '@saas-maker/test-config/vitest';

export default defineVitestConfig({
  environment: 'happy-dom', // for React tests
  setupFiles: ['./src/test-setup.ts'],
});
```

Defaults:
- `globals: true`
- `environment: 'node'`
- `include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts']`
- `testTimeout: 15_000`
- v8 coverage with sensible excludes (off by default)

## a11y

```ts
import { test, expect } from '@playwright/test';
import { runA11y } from '@saas-maker/test-config/a11y';

test('home is a11y-clean', async ({ page }) => {
  await page.goto('/');
  const r = await runA11y(page, { exclude: ['#third-party-widget'] });
  expect(r.violations, JSON.stringify(r.violations, null, 2)).toHaveLength(0);
});
```

`runA11y` runs axe-core scoped to `wcag2a/aa` + `wcag21a/aa` tags by default.

## Smoke

Place smoke tests in any `*.smoke.spec.ts` file — they're picked up by the dedicated `smoke` Playwright project so you can run only the fast happy path:

```bash
pnpm exec playwright test --project=smoke
```
