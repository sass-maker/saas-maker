import { describe, it, expect } from 'vitest';
import { foundryPreset, colors, colorsDark, charts, spacing, baseRadius } from '../index.js';

describe('foundry tailwind preset', () => {
  it('exposes core color tokens via theme.extend.colors', () => {
    const c = foundryPreset.theme.extend.colors;
    expect(c.background).toBe(colors.background);
    expect(c.foreground).toBe(colors.foreground);
    expect(c.primary).toBe(colors.primary);
    expect(c['primary-foreground']).toBe(colors.primaryForeground);
    expect(c['muted-foreground']).toBe(colors.mutedForeground);
  });

  it('exposes chart palette', () => {
    const c = foundryPreset.theme.extend.colors;
    expect(c.chart1).toBe(charts.chart1);
    expect(c.chart5).toBe(charts.chart5);
  });

  it('exposes spacing scale', () => {
    expect(foundryPreset.theme.extend.spacing[4]).toBe('1rem');
    expect(foundryPreset.theme.extend.spacing[16]).toBe('4rem');
  });

  it('exposes typed type scale entries', () => {
    const fs = foundryPreset.theme.extend.fontSize;
    expect(fs.base[0]).toBe('1rem');
    expect(fs.base[1].lineHeight).toBe('1.5rem');
  });

  it('matches snapshot', () => {
    expect(foundryPreset).toMatchSnapshot();
  });
});

describe('dark palette', () => {
  it('inverts background + foreground', () => {
    expect(colorsDark.background).not.toBe(colors.background);
    expect(colorsDark.foreground).not.toBe(colors.foreground);
  });
});

describe('baseRadius', () => {
  it('is the cockpit-derived 0.625rem', () => {
    expect(baseRadius).toBe('0.625rem');
  });
});
