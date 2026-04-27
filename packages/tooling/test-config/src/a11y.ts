/**
 * Reusable Playwright a11y helper using @axe-core/playwright.
 *
 * Usage:
 * ```ts
 * import { test, expect } from '@playwright/test';
 * import { runA11y } from '@saas-maker/test-config/a11y';
 *
 * test('home is a11y-clean', async ({ page }) => {
 *   await page.goto('/');
 *   const result = await runA11y(page);
 *   expect(result.violations, JSON.stringify(result.violations, null, 2)).toHaveLength(0);
 * });
 * ```
 */

// Don't import @axe-core/playwright statically — peer optional.
// Re-import lazily inside the helper at runtime.

export interface A11yOpts {
  include?: string[];
  exclude?: string[];
  /** WCAG tags to check. Default: AA tags. */
  tags?: string[];
}

const DEFAULT_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

export async function runA11y(page: unknown, opts: A11yOpts = {}): Promise<{
  violations: Array<{ id: string; impact?: string; nodes: unknown[]; help: string }>;
  passes: number;
}> {
  const mod = (await import('@axe-core/playwright')) as {
    default: new (page: unknown) => {
      include: (sel: string) => unknown;
      exclude: (sel: string) => unknown;
      withTags: (tags: string[]) => unknown;
      analyze: () => Promise<{ violations: Array<{ id: string; impact?: string; nodes: unknown[]; help: string }>; passes: unknown[] }>;
    };
  };
  const AxeBuilder = mod.default;
  let builder = new AxeBuilder(page).withTags(opts.tags ?? DEFAULT_TAGS) as ReturnType<
    InstanceType<typeof AxeBuilder>['withTags']
  > & {
    include: (sel: string) => InstanceType<typeof AxeBuilder>;
    exclude: (sel: string) => InstanceType<typeof AxeBuilder>;
    analyze: InstanceType<typeof AxeBuilder>['analyze'];
  };
  for (const sel of opts.include ?? []) builder = builder.include(sel) as typeof builder;
  for (const sel of opts.exclude ?? []) builder = builder.exclude(sel) as typeof builder;
  const result = await builder.analyze();
  return { violations: result.violations, passes: result.passes.length };
}
