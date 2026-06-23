import { describe, it, expect } from 'vitest';
import { parseOS, isBot, extractPathname, computeSessionId } from '../../workers/api/src/ua';

describe('isBot', () => {
  it('detects Googlebot', () => {
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(
      true
    );
  });
  it('detects GPTBot', () => {
    expect(
      isBot('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0)')
    ).toBe(true);
  });
  it('detects ClaudeBot', () => {
    expect(isBot('ClaudeBot/1.0')).toBe(true);
  });
  it('detects generic crawler', () => {
    expect(isBot('my-custom-crawler/1.0')).toBe(true);
  });
  it('detects HeadlessChrome', () => {
    expect(isBot('Mozilla/5.0 HeadlessChrome/90.0')).toBe(true);
  });
  it('returns false for Chrome desktop', () => {
    expect(
      isBot(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      )
    ).toBe(false);
  });
  it('returns false for Safari mobile', () => {
    expect(
      isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15')
    ).toBe(false);
  });
  it('returns false for empty UA', () => {
    expect(isBot('')).toBe(false);
  });
});

describe('parseOS', () => {
  it('detects macOS', () =>
    expect(parseOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('macOS'));
  it('detects Windows', () =>
    expect(parseOS('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Windows'));
  it('detects Linux', () => expect(parseOS('Mozilla/5.0 (X11; Linux x86_64)')).toBe('Linux'));
  it('detects iOS', () =>
    expect(parseOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('iOS'));
  it('detects Android', () =>
    expect(parseOS('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('Android'));
  it('detects ChromeOS', () =>
    expect(parseOS('Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)')).toBe('ChromeOS'));
  it('returns Other for unknown', () => expect(parseOS('curl/7.64.1')).toBe('Other'));
});

describe('extractPathname', () => {
  it('extracts from full URL', () =>
    expect(extractPathname('https://example.com/pricing?ref=google')).toBe('/pricing'));
  it('strips query from path', () => expect(extractPathname('/about?foo=bar')).toBe('/about'));
  it('strips hash', () => expect(extractPathname('/docs#section')).toBe('/docs'));
  it('returns null for null', () => expect(extractPathname(null)).toBeNull());
  it('returns null for empty', () => expect(extractPathname('')).toBeNull());
});

describe('computeSessionId', () => {
  it('returns consistent hash', () => {
    const a = computeSessionId('2026-03-08', 'US', 'desktop', 'Chrome');
    const b = computeSessionId('2026-03-08', 'US', 'desktop', 'Chrome');
    expect(a).toBe(b);
  });
  it('returns different hash for different inputs', () => {
    const a = computeSessionId('2026-03-08', 'US', 'desktop', 'Chrome');
    const b = computeSessionId('2026-03-08', 'UK', 'mobile', 'Safari');
    expect(a).not.toBe(b);
  });
});
