import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import RootLayout from '../../apps/cockpit/src/app/layout';

vi.mock('../../apps/cockpit/node_modules/next/font/google/index.js', () => ({
  Geist: () => ({ variable: 'fixture-sans' }),
  Geist_Mono: () => ({ variable: 'fixture-mono' }),
}));

describe('first HTML theme', () => {
  it('renders the established dark variant before theme hydration', () => {
    const html = renderToStaticMarkup(
      createElement(RootLayout, { children: createElement('main', {}, 'Fixture content') })
    );
    expect(html).toMatch(/<html[^>]*class="dark"/);
    expect(html).toMatch(/<html[^>]*style="color-scheme:dark"/);
    expect(html).toMatch(/<body[^>]*class="[^"]*font-sans/);
    expect(html).toContain('Fixture content');
  });
});
