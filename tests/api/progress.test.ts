import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from './helpers';

const mockDb = {
  getProjectBySlug: vi.fn(),
  listPublishedChangelog: vi.fn(),
  listRoadmapItems: vi.fn(),
};

vi.mock('../../workers/api/src/db', () => ({
  getDb: () => mockDb,
  createDatabase: () => mockDb,
}));

const PROJECT = {
  id: 'proj-1',
  name: 'Test Project',
  slug: 'test-project',
  api_key: 'pk_test',
  owner_id: 'user-1',
};

const CHANGELOG_ENTRY = {
  id: 'cl-1',
  project_id: 'proj-1',
  title: 'Launched progress view',
  content: 'Combined roadmap and changelog into one public surface.',
  version: '0.1.0',
  type: 'feature',
  published: true,
  published_at: '2026-01-02T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
};

const ROADMAP_ITEM = {
  id: 'rm-1',
  project_id: 'proj-1',
  feedback_id: null,
  title: 'Public project embeds',
  description: 'Let public projects show progress from SaaS Maker.',
  column: 'planned',
  position: 0,
  public: true,
  upvote_count: 3,
  downvote_count: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /v1/progress/public/:slug', () => {
  it('returns project progress from published changelog and public roadmap', async () => {
    mockDb.getProjectBySlug.mockResolvedValue(PROJECT);
    mockDb.listPublishedChangelog.mockResolvedValue([CHANGELOG_ENTRY]);
    mockDb.listRoadmapItems.mockResolvedValue([ROADMAP_ITEM]);

    const res = await request('/v1/progress/public/test-project?changelog_limit=5');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.project).toEqual({ name: 'Test Project', slug: 'test-project' });
    expect(body.changelog).toEqual([CHANGELOG_ENTRY]);
    expect(body.roadmap).toEqual([ROADMAP_ITEM]);
    expect(mockDb.listPublishedChangelog).toHaveBeenCalledWith('proj-1', 5);
    expect(mockDb.listRoadmapItems).toHaveBeenCalledWith('proj-1', true);
  });

  it('returns 404 when the project slug is unknown', async () => {
    mockDb.getProjectBySlug.mockResolvedValue(null);

    const res = await request('/v1/progress/public/missing');
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toBe('Project not found');
  });

  it('caps changelog limit to 50', async () => {
    mockDb.getProjectBySlug.mockResolvedValue(PROJECT);
    mockDb.listPublishedChangelog.mockResolvedValue([]);
    mockDb.listRoadmapItems.mockResolvedValue([]);

    const res = await request('/v1/progress/public/test-project?changelog_limit=500');
    expect(res.status).toBe(200);
    expect(mockDb.listPublishedChangelog).toHaveBeenCalledWith('proj-1', 50);
  });
});
