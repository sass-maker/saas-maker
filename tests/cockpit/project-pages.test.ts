import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CockpitResources } from '../../apps/cockpit/src/components/cockpit-resources';
import ProjectsPage from '../../apps/cockpit/src/app/(app)/projects/page';
import ProjectStatusPage from '../../apps/cockpit/src/app/(app)/projects/[slug]/page';
import FeedbackBoardPage from '../../apps/cockpit/src/app/(app)/projects/feedback/page';
import SubscribersBoardPage from '../../apps/cockpit/src/app/(app)/projects/subscribers/page';
import { seedForFeedbackResource } from '../../apps/cockpit/src/app/(app)/projects/feedback/feedback-board';
import { apiFetchAuthed } from '../../apps/cockpit/src/lib/api-client';
import { getProjectBySlug, getServerToken } from '../../apps/cockpit/src/lib/api';
import { getDashboardSession } from '../../apps/cockpit/src/lib/server-session';

// Resolve the cockpit's own Next dependency, matching its component imports.
vi.mock('../../apps/cockpit/node_modules/next/navigation.js', () => ({
  useParams: () => ({ slug: 'example' }),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/projects/example',
  notFound: () => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
  },
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
}));
vi.mock('../../apps/cockpit/src/lib/server-session', () => ({
  getDashboardSession: vi.fn(async () => ({ user: { id: 'fixture-account' } })),
}));
vi.mock('../../apps/cockpit/src/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../apps/cockpit/src/lib/api-client')>()),
  apiFetchAuthed: vi.fn(),
}));
vi.mock('../../apps/cockpit/src/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../apps/cockpit/src/lib/api')>()),
  getServerToken: vi.fn(async () => 'server-session-only'),
  getProjectBySlug: vi.fn(),
}));

const project = {
  id: 'project-one',
  name: 'Example project',
  slug: 'example',
  api_key: 'publishable-project-key',
  owner_id: 'private-owner-id',
  readme: 'Example feedback project',
  source: 'dashboard',
  git_url: 'private-repository-url',
  created_at: '2026-10-01T00:00:00.000Z',
  unexpected_private_field: 'must-not-be-serialized',
};
const listPage = () => ProjectsPage({ searchParams: Promise.resolve({}) });
const detailPage = () => ProjectStatusPage({ params: Promise.resolve({ slug: 'example' }) });
function render(page: Awaited<ReturnType<typeof ProjectsPage>>) {
  return renderToStaticMarkup(createElement(CockpitResources, { children: page }));
}

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('server-seeded project pages', () => {
  it('preserves the authentication guard before either project fetch', async () => {
    for (const page of [listPage, detailPage, FeedbackBoardPage, SubscribersBoardPage]) {
      vi.mocked(getDashboardSession).mockResolvedValueOnce(null);
      await expect(page()).rejects.toThrow('NEXT_REDIRECT');
    }
    expect(apiFetchAuthed).not.toHaveBeenCalled();
    expect(getProjectBySlug).not.toHaveBeenCalled();
  });
  it('opens the private scoreboard without fetching feedback data', async () => {
    const page = await ProjectsPage({ searchParams: Promise.resolve({ view: 'scoreboard' }) });
    expect(page.props.accountId).toBe('fixture-account');
    expect(apiFetchAuthed).not.toHaveBeenCalled();
  });
  it('seeds the default feedback inbox in the first HTML with its exact resource key', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T00:00:00Z'));
    vi.mocked(apiFetchAuthed).mockResolvedValue({ data: [] });

    const page = await FeedbackBoardPage();

    expect(apiFetchAuthed).toHaveBeenCalledWith('/v1/feedback?', { cache: 'no-store' });
    expect(page.props.children[1].props.initialData).toEqual({ data: [] });
    expect(page.props.children[1].props.initialDataUpdatedAt).toBe(Date.now());
    expect(render(page)).toContain('No feedback yet');
    expect(render(page)).not.toContain('data-table-skeleton');
  });
  it('leaves the feedback resource unseeded when the server fetch fails', async () => {
    vi.mocked(apiFetchAuthed).mockRejectedValueOnce(new Error('unavailable'));

    const page = await FeedbackBoardPage();

    expect(page.props.children[1].props.initialData).toBeUndefined();
    expect(render(page)).toContain('data-table-skeleton');
  });
  it('never reuses unfiltered inbox data for a filtered resource key', () => {
    const seed = { initialData: { data: [] }, initialDataUpdatedAt: 123 };
    expect(seedForFeedbackResource('/v1/feedback?', seed)).toEqual(seed);
    expect(seedForFeedbackResource('/v1/feedback?type=bug', seed)).toEqual({});
    expect(seedForFeedbackResource('/v1/feedback?status=planned', seed)).toEqual({});
  });
  it('renders list data in first HTML and serializes only visible project fields', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T00:00:00Z'));
    vi.mocked(apiFetchAuthed).mockResolvedValue({
      data: [project, { ...project, slug: '', name: 'Hidden project' }],
      private_metadata: 'not-for-client',
    });
    const page = await listPage();
    expect(apiFetchAuthed).toHaveBeenCalledWith('/v1/projects');
    expect(page.props.initialDataUpdatedAt).toBe(Date.now());
    expect(page.props.initialData).toEqual({
      data: [
        {
          id: project.id,
          name: project.name,
          slug: project.slug,
          readme: project.readme,
          source: project.source,
          created_at: project.created_at,
        },
      ],
    });
    const html = render(page);
    expect(html).toContain('Example project');
    expect(html).toContain('Example feedback project');
    expect(html).not.toContain('Hidden project');
    expect(html).not.toContain('aria-label="loading projects"');
    expect(JSON.stringify(page.props)).not.toContain('publishable-project-key');
    expect(JSON.stringify(page.props)).not.toContain('server-session-only');
  });

  it('renders detail data and its existing publishable key in first HTML', async () => {
    vi.mocked(getProjectBySlug).mockResolvedValue(project);
    const page = await detailPage();
    expect(getServerToken).toHaveBeenCalledOnce();
    expect(getProjectBySlug).toHaveBeenCalledWith('example', 'server-session-only');
    expect(page.props.initialData).toEqual({
      id: project.id,
      name: project.name,
      slug: project.slug,
      api_key: project.api_key,
    });
    expect(page.props.initialDataUpdatedAt).toEqual(expect.any(Number));
    const html = render(page);
    expect(html).toContain('Example project');
    expect(html).toContain('publishable-project-key');
    expect(html).not.toContain('aria-label="loading project"');
    expect(JSON.stringify(page.props)).not.toContain('server-session-only');
    expect(JSON.stringify(page.props)).not.toContain('private-owner-id');
    expect(JSON.stringify(page.props)).not.toContain('private-repository-url');
    expect(JSON.stringify(page.props)).not.toContain('must-not-be-serialized');
  });

  it('renders successful empty projects as onboarding', async () => {
    vi.mocked(apiFetchAuthed).mockResolvedValue({ data: [] });
    const html = render(await listPage());
    expect(html).toContain('Create a feedback project');
    expect(html).toContain('Create project key');
    expect(html).not.toContain('New Project');
  });

  it.each([
    new TypeError('Failed to fetch'),
    Object.assign(new Error('unavailable'), { status: 503 }),
    Object.assign(new Error('forbidden'), { status: 403 }),
  ])('falls back to an unseeded client resource for server failures: %s', async (error) => {
    vi.mocked(apiFetchAuthed).mockRejectedValue(error);
    vi.mocked(getProjectBySlug).mockRejectedValue(error);
    for (const page of [await listPage(), await detailPage()]) {
      expect(page.props.initialData).toBeUndefined();
      expect(page.props.initialDataUpdatedAt).toBeUndefined();
      const html = render(page);
      expect(html).toContain('aria-busy="true"');
      expect(html).not.toContain('Create a feedback project');
      expect(html).not.toContain('Example project');
    }
  });

  it('falls back when server authentication is unavailable', async () => {
    vi.mocked(getServerToken).mockRejectedValueOnce(new Error('auth unavailable'));
    const page = await detailPage();
    expect(getProjectBySlug).not.toHaveBeenCalled();
    expect(page.props.initialData).toBeUndefined();
    expect(render(page)).toContain('aria-busy="true"');
  });

  it('renders not-found only for a confirmed missing project', async () => {
    vi.mocked(getProjectBySlug).mockResolvedValue(null);
    await expect(detailPage()).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  });
});
