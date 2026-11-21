import publicCatalog from '../../../../catalog/generated/public.json';
import { LEARNINGS } from './learnings';
import { markdownPath, PUBLIC_ROUTES, publicRouteUrl } from './publicRoutes';

export const publicMcpCatalog = {
  products: publicCatalog.products,
  surfaces: PUBLIC_ROUTES.map((route) => ({
    id: route.id,
    url: publicRouteUrl(route),
    md: `https://sassmaker.com/${markdownPath(route)}.md`,
    kind: route.kind,
    description: route.description,
  })),
  learnings: LEARNINGS.map((learning) => ({
    ...learning,
    url: `https://sassmaker.com${learning.href}`,
  })),
};
