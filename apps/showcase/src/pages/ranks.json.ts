import type { APIRoute } from 'astro';
import domainRanksData from '../data/domain-ranks.json';
import domainRanksSites from '../data/domain-ranks-sites.json';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      {
        description:
          'Provider-reported Ahrefs Domain Rating history for owned Fleet domains. Weekly snapshot; null means not reported.',
        lastUpdated: domainRanksData.lastUpdated,
        trackedSites: domainRanksSites,
        domains: domainRanksData.domains,
      },
      null,
      2
    ),
    { headers: { 'Content-Type': 'application/json' } }
  );
