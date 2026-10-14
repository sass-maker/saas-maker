import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CockpitResources } from '../../apps/cockpit/src/components/cockpit-resources';
import { FeedbackBoard } from '../../apps/cockpit/src/app/(app)/projects/feedback/feedback-board';
import { SubscribersBoard } from '../../apps/cockpit/src/app/(app)/projects/subscribers/subscribers-board';
import { FilterBar } from '../../apps/cockpit/src/components/filter-bar';

let query = '';
vi.mock('../../apps/cockpit/node_modules/next/navigation.js', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(query),
}));

vi.mock('../../apps/cockpit/src/components/cockpit-resources', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../apps/cockpit/src/components/cockpit-resources')>()),
  useProjectsResource: () => ({
    status: 'success',
    error: undefined,
    isRevalidating: false,
    data: { data: [{ id: 'fixture', slug: 'example', name: 'Example product' }] },
    retry: async () => {},
    mutate: vi.fn(),
  }),
}));

describe('controls before hydration', () => {
  it('names the default feedback selections while the first response is pending', () => {
    const html = renderToStaticMarkup(
      createElement(CockpitResources, { children: createElement(FeedbackBoard) })
    );
    expect(html).toMatch(/data-slot="select-value"[^>]*>All types</);
    expect(html).toMatch(/data-slot="select-value"[^>]*>All statuses</);
    expect(html).toContain('data-table-skeleton');
  });

  it('names the selected project and kind before subscriber data arrives', () => {
    const html = renderToStaticMarkup(
      createElement(CockpitResources, { children: createElement(SubscribersBoard) })
    );
    expect(html).toMatch(/data-slot="select-value"[^>]*>Example product</);
    expect(html).toMatch(/data-slot="select-value"[^>]*>All kinds</);
    expect(html).toContain('data-table-skeleton');
  });

  it('preserves URL-selected project inbox labels in the first HTML', () => {
    query = 'type=bug&status=planned';
    const html = renderToStaticMarkup(createElement(FilterBar));
    expect(html).toMatch(/data-slot="select-value"[^>]*>Bug</);
    expect(html).toMatch(/data-slot="select-value"[^>]*>Planned</);
    query = '';
  });
});
