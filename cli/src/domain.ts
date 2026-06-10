const CF_PLATFORM_SUFFIXES = ['.pages.dev', '.workers.dev'] as const;

const SKIP_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Hostnames on Cloudflare's shared platform domains (not a site's own domain). */
export function isCloudflarePlatformHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (SKIP_HOSTS.has(host)) return true;
  return CF_PLATFORM_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

export function hostnameFromUrl(input: string): string | null {
  try {
    return new URL(input).hostname.replace(/\.$/, '');
  } catch {
    return null;
  }
}

/** True when Ahrefs domain rating is meaningful for this URL/origin. */
export function shouldFetchDomainRating(input: string): boolean {
  const host = hostnameFromUrl(input);
  if (!host) return false;
  if (SKIP_HOSTS.has(host.toLowerCase())) return false;
  // Skip bare IPs — Ahrefs rejects them and they aren't SEO targets anyway.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) return false;
  return !isCloudflarePlatformHost(host);
}
