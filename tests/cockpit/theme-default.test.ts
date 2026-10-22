import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
const request = vi.hoisted(() => ({ privateScoreboard: false }));
vi.mock('../../apps/cockpit/node_modules/next/headers.js', () => ({
  headers: async () =>
    new Headers(request.privateScoreboard ? { 'x-saasmaker-private-surface': 'scoreboard' } : {}),
}));

import RootLayout from '../../apps/cockpit/src/app/layout';

vi.mock('../../apps/cockpit/node_modules/next/font/google/index.js', () => ({
  Geist: () => ({ variable: 'fixture-sans' }),
  Geist_Mono: () => ({ variable: 'fixture-mono' }),
}));

describe('first HTML theme', () => {
  it('renders the established dark variant before theme hydration', async () => {
    const html = renderToStaticMarkup(
      await RootLayout({ children: createElement('main', {}, 'Fixture content') })
    );
    expect(html).toMatch(/<html[^>]*class="dark"/);
    expect(html).toMatch(/<html[^>]*style="color-scheme:dark"/);
    expect(html).toMatch(/<body[^>]*class="[^"]*font-sans/);
    expect(html).toContain('Fixture content');
    expect(html).toContain('clarity.ms');
  });
  it('omits replay entirely from the private scoreboard document', async () => {
    request.privateScoreboard = true;
    try {
      const html = renderToStaticMarkup(
        await RootLayout({ children: createElement('main', {}, 'Private review') })
      );
      expect(html).toContain('Private review');
      expect(html).not.toContain('clarity.ms');
    } finally {
      request.privateScoreboard = false;
    }
  });
});
