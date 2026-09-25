import type { APIRoute, GetStaticPaths } from 'astro';

type PlaybookModule = { default?: { domain?: string } };

const modules = import.meta.glob('../../data/launchdesk-playbooks/*.json', { eager: true });
const playbooks = Object.values(modules)
  .map((mod) => (mod as PlaybookModule).default ?? (mod as { domain?: string }))
  .filter((p): p is { domain: string } => Boolean(p?.domain));

export const getStaticPaths = (() =>
  playbooks.map((playbook) => ({
    params: { domain: playbook.domain },
    props: { body: JSON.stringify(playbook, null, 2) },
  }))) satisfies GetStaticPaths;

export const prerender = true;

export const GET: APIRoute<{ body: string }> = ({ props }) =>
  new Response(`${props.body}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
