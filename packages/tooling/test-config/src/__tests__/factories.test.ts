import { describe, it, expect } from 'vitest';
import { definePlaywrightConfig, FOUNDRY_VIEWPORTS } from '../playwright.js';
import { defineVitestConfig } from '../vitest.js';

describe('definePlaywrightConfig', () => {
  it('produces a config with smoke + 4 viewport projects by default', () => {
    const cfg = definePlaywrightConfig({ baseURL: 'http://localhost:3000' });
    expect(cfg.testDir).toBe('./tests/e2e');
    expect(cfg.timeout).toBe(30_000);
    expect(cfg.use?.baseURL).toBe('http://localhost:3000');
    const names = (cfg.projects ?? []).map((p) => p.name).sort();
    expect(names).toEqual(['desktop', 'mobile', 'smoke', 'tablet', 'wide']);
  });

  it('omits smoke when disabled', () => {
    const cfg = definePlaywrightConfig({ baseURL: '/', smoke: false });
    const names = (cfg.projects ?? []).map((p) => p.name);
    expect(names).not.toContain('smoke');
  });

  it('omits viewport matrix when disabled', () => {
    const cfg = definePlaywrightConfig({ baseURL: '/', viewportMatrix: false });
    const names = (cfg.projects ?? []).map((p) => p.name);
    expect(names).not.toContain('mobile');
    expect(names).not.toContain('wide');
  });

  it('exposes FOUNDRY_VIEWPORTS', () => {
    expect(FOUNDRY_VIEWPORTS.mobile).toEqual({ width: 375, height: 667 });
    expect(FOUNDRY_VIEWPORTS.wide).toEqual({ width: 1920, height: 1080 });
  });
});

describe('defineVitestConfig', () => {
  it('returns a config with sane defaults', () => {
    const cfg = defineVitestConfig();
    expect(cfg.test?.globals).toBe(true);
    expect(cfg.test?.environment).toBe('node');
    expect(cfg.test?.testTimeout).toBe(15_000);
  });

  it('supports happy-dom for UI tests', () => {
    const cfg = defineVitestConfig({ environment: 'happy-dom' });
    expect(cfg.test?.environment).toBe('happy-dom');
  });

  it('extends include patterns', () => {
    const cfg = defineVitestConfig({ include: ['custom/**/*.test.ts'] });
    expect(cfg.test?.include).toEqual(['custom/**/*.test.ts']);
  });

  it('disables coverage by default', () => {
    const cfg = defineVitestConfig();
    expect(cfg.test?.coverage?.enabled).toBe(false);
  });

  it('passes coverage thresholds through', () => {
    const cfg = defineVitestConfig({ coverage: { enabled: true, lines: 80 } });
    expect(cfg.test?.coverage?.enabled).toBe(true);
    expect(cfg.test?.coverage?.thresholds?.lines).toBe(80);
  });
});
