const BOT_PATTERNS = /bot|crawler|spider|headless|phantom|puppeteer|playwright|slurp|googlebot|bingbot|yandexbot|baiduspider|duckduckbot|gptbot|claudebot|chatgpt-user|anthropic|perplexity|cohere-ai|ahrefs|semrush|screaming.frog|uptimerobot|pingdom|twitterbot|facebookexternalhit|linkedinbot|slackbot|whatsapp|telegrambot|applebot|bytespider/i;

export function isBot(ua: string): boolean {
  if (!ua) return false;
  return BOT_PATTERNS.test(ua);
}

export function parseDevice(ua: string): string {
  if (/mobile|android|iphone|ipod/i.test(ua)) return 'mobile';
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  return 'desktop';
}

export function parseBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\//i.test(ua) || /opera/i.test(ua)) return 'Opera';
  if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) return 'Chrome';
  if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) return 'Safari';
  if (/firefox\//i.test(ua)) return 'Firefox';
  return 'Other';
}

export function parseOS(ua: string): string {
  if (/CrOS/i.test(ua)) return 'ChromeOS';
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/macintosh|mac os x/i.test(ua)) return 'macOS';
  if (/windows/i.test(ua)) return 'Windows';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Other';
}

export function extractPathname(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    if (url.startsWith('http')) {
      return new URL(url).pathname;
    }
    return url.split('?')[0].split('#')[0] || null;
  } catch {
    return url.split('?')[0].split('#')[0] || null;
  }
}

export function computeSessionId(date: string, country: string | null, device: string | null, browser: string | null): string {
  const raw = `${date}|${country || ''}|${device || ''}|${browser || ''}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash.toString(36);
}
