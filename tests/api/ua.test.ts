import { describe, it, expect } from 'vitest';
import { parseDevice, parseBrowser } from '../../workers/api/src/ua';

describe('parseDevice', () => {
  it('detects mobile', () => {
    expect(parseDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)')).toBe('mobile');
    expect(parseDevice('Mozilla/5.0 (Linux; Android 13)')).toBe('mobile');
  });

  it('detects tablet', () => {
    expect(parseDevice('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)')).toBe('tablet');
  });

  it('defaults to desktop', () => {
    expect(parseDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('desktop');
    expect(parseDevice('')).toBe('desktop');
  });
});

describe('parseBrowser', () => {
  it('detects Chrome', () => {
    expect(parseBrowser('Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36')).toBe('Chrome');
  });

  it('detects Safari', () => {
    expect(parseBrowser('Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Safari/605.1.15')).toBe('Safari');
  });

  it('detects Firefox', () => {
    expect(parseBrowser('Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0')).toBe('Firefox');
  });

  it('detects Edge over Chrome', () => {
    expect(parseBrowser('Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36 Edg/120.0')).toBe('Edge');
  });

  it('returns Other for unknown', () => {
    expect(parseBrowser('curl/7.88.1')).toBe('Other');
  });
});
