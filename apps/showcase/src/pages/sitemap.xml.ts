import { FUNDING_PROGRAMS } from '../data/funding';
import { IDEA_ENTRIES } from '../data/ideas';
import launchdeskData from '../data/launchdesk.json';
import { PUBLIC_ROUTES, publicRouteUrl } from '../data/publicRoutes';
import { TOOLING_CAPABILITIES } from '../data/tooling';

export const prerender = true;

const SITE = 'https://sassmaker.com';

function launchdeskDomains(): string[] {
  const domains = new Set<string>();
  for (const row of launchdeskData.destinations as { domain?: string; quarantined?: boolean }[]) {
    if (!row.quarantined && row.domain) domains.add(row.domain);
  }
  // Playbooks can exist for quarantined domains; those pages still exist.
  const playbookModules = import.meta.glob('../data/launchdesk-playbooks/*.json');
  for (const path of Object.keys(playbookModules)) {
    const domain = path
      .split('/')
      .pop()
      ?.replace(/\.json$/, '');
    if (domain && domain !== '_schema') domains.add(domain);
  }
  return [...domains];
}

export function GET() {
  const urls = [
    ...PUBLIC_ROUTES.map(publicRouteUrl),
    ...launchdeskDomains().map((domain) => `${SITE}/launchdesk/${domain}`),
    ...FUNDING_PROGRAMS.map((program) => `${SITE}/funding/${program.slug}`),
    ...IDEA_ENTRIES.map((entry) => `${SITE}/ideas/${entry.slug}`),
    ...TOOLING_CAPABILITIES.map(
      (item) =>
        `${SITE}/tools/${item.id
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')}`
    ),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => `  <url><loc>${url}</loc></url>`)
    .join('\n')}\n</urlset>\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
