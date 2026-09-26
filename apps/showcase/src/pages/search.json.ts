import type { APIRoute } from 'astro';
import { SEARCH_INDEX } from '../data/searchIndex';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      {
        description:
          'Unified search index across all public SaaS Maker surfaces — products, ideas, funding programs, launch destinations, tools, learnings, docs, pages.',
        usage:
          'GET /search.json returns the full index; filter client-side on title+summary+keywords. Humans: /search?q=<query>. Entries: {type, title, url, summary, keywords}.',
        count: SEARCH_INDEX.length,
        index: SEARCH_INDEX,
      },
      null,
      2
    ),
    { headers: { 'Content-Type': 'application/json' } }
  );
