import type { APIContext } from 'astro';
import { MARKDOWN_ROUTES } from '../../../data/agentDocuments';
import { AGENT_IDENTITY } from '../../../data/agentIdentity';

export const prerender = true;
export function getStaticPaths() {
  return ['_catalog', '_identity'].map((document) => ({ params: { document } }));
}
export function GET({ params }: APIContext) {
  const document = params.document === '_identity' ? AGENT_IDENTITY : MARKDOWN_ROUTES;
  return new Response(JSON.stringify(document), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
