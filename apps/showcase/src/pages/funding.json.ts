import type { APIRoute } from 'astro';
import { FUNDING, FUNDING_VIEW_ORDER, FUNDING_VIEWS } from '../data/funding';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      {
        collection: FUNDING.collection,
        source: FUNDING.source,
        exportedAt: FUNDING.exportedAt,
        workspaceRebuilt: FUNDING.workspaceRebuilt,
        count: FUNDING.count,
        views: FUNDING_VIEWS.map((view) => ({
          key: view.key,
          name: view.name,
          type: view.type,
          slugs: FUNDING_VIEW_ORDER[view.key],
        })),
        programs: FUNDING.programs,
      },
      null,
      2
    ),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  );
