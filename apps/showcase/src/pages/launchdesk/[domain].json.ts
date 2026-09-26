import type { APIRoute, GetStaticPaths } from 'astro';
import launchdeskData from '../../data/launchdesk.json';

type PlaybookModule = { default?: { domain?: string } };
type DestinationRow = { domain?: string; quarantined?: boolean };

const modules = import.meta.glob('../../data/launchdesk-playbooks/*.json', { eager: true });
const playbooks = new Map(
  Object.values(modules)
    .map((mod) => (mod as PlaybookModule).default ?? (mod as { domain?: string }))
    .filter((p): p is { domain: string } => Boolean(p?.domain))
    .map((playbook) => [playbook.domain, playbook])
);

const destinations = new Map<string, { claims: unknown[] } & DestinationRow>();
for (const row of launchdeskData.destinations as (DestinationRow & { claims?: unknown[] })[]) {
  if (row.quarantined || !row.domain) continue;
  const existing = destinations.get(row.domain);
  if (!existing) destinations.set(row.domain, { ...row, claims: [...(row.claims ?? [])] });
  else (existing.claims as unknown[]).push(...(row.claims ?? []));
}

export const getStaticPaths = (() => {
  const paths = [...destinations.values()].map((destination) => ({
    params: { domain: destination.domain as string },
    props: {
      body: JSON.stringify(
        playbooks.has(destination.domain as string)
          ? playbooks.get(destination.domain as string)
          : { catalogRecord: true, ...destination },
        null,
        2
      ),
    },
  }));
  for (const [domain, playbook] of playbooks) {
    if (destinations.has(domain)) continue;
    paths.push({
      params: { domain },
      props: { body: JSON.stringify(playbook, null, 2) },
    });
  }
  return paths;
}) satisfies GetStaticPaths;

export const prerender = true;

export const GET: APIRoute<{ body: string }> = ({ props }) =>
  new Response(`${props.body}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
