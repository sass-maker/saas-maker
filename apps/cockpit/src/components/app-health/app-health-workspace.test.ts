import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { appHealthScreenshotFixture } from './app-health-fixture';
import {
  AppHealthWorkspace,
  appHealthProjectIds,
  appHealthRoutes,
  appHealthState,
} from './app-health-workspace';

describe('App Health workspace evidence states', () => {
  it('classifies healthy, degraded, unhealthy, and insufficient endpoint evidence', () => {
    const states = Object.fromEntries(
      appHealthScreenshotFixture.routes.map((route) => [route.id, appHealthState(route, '24h')])
    );

    expect(states).toMatchObject({
      'checkout-post': 'healthy',
      'search-get': 'degraded',
      'webhooks-post': 'unhealthy',
      'health-get': 'insufficient',
    });
  });

  it('filters by project and keeps the requested sort deterministic', () => {
    const routes = appHealthRoutes(appHealthScreenshotFixture, 'billing-api', '24h', 'errors');

    expect(routes.map((route) => route.id)).toEqual(['webhooks-post', 'health-get']);
    expect(routes.every((route) => route.projectId === 'billing-api')).toBe(true);
    expect(appHealthProjectIds(appHealthScreenshotFixture)).toEqual(['billing-api', 'storefront']);
  });

  it('returns an honest empty inventory for an unknown project', () => {
    expect(appHealthRoutes(appHealthScreenshotFixture, 'missing', '24h', 'traffic')).toEqual([]);
  });

  it('treats missing percentile evidence as insufficient', () => {
    const route = structuredClone(appHealthScreenshotFixture.routes[0]!);
    route.metrics['24h'].p95 = null;

    expect(appHealthState(route, '24h')).toBe('insufficient');
  });

  it('renders populated, connected-empty, and unavailable states truthfully', () => {
    const populated = renderToStaticMarkup(
      createElement(AppHealthWorkspace, { snapshot: appHealthScreenshotFixture })
    );
    expect(populated).toContain('Endpoint performance samples');
    expect(populated).toContain('Observed samples');

    const connectedEmpty = renderToStaticMarkup(
      createElement(AppHealthWorkspace, {
        snapshot: { ...appHealthScreenshotFixture, routes: [], recentRequests: [] },
      })
    );
    expect(connectedEmpty).toContain('Connected — waiting for the first endpoint');
    expect(connectedEmpty).not.toContain('Live SDK evidence');

    const unavailable = renderToStaticMarkup(
      createElement(AppHealthWorkspace, {
        snapshot: {
          ...appHealthScreenshotFixture,
          routes: [],
          recentRequests: [],
          boundary: {
            mode: 'unavailable',
            providerEnrichment: 'unavailable',
            message: 'Evidence API unavailable.',
          },
        },
      })
    );
    expect(unavailable).toContain('Endpoint evidence is unavailable');
    expect(unavailable).toContain('Endpoint inventory unavailable');
  });
});
