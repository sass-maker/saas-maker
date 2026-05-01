import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from './helpers';

// ---------------------------------------------------------------------------
// Mock the database layer so we never need a live CockroachDB instance.
// The mock returns a FeedbackDatabase-shaped object whose methods are vi.fn()s
// that individual tests can configure with mockResolvedValue / mockResolvedValueOnce.
// ---------------------------------------------------------------------------

const mockDb = {
  getProjectBySlug: vi.fn(),
  getProjectById: vi.fn(),
  getCliTokenUser: vi.fn(),
  listRoadmapItems: vi.fn(),
  getRoadmapItemById: vi.fn(),
  setRoadmapVote: vi.fn(),
  removeRoadmapVote: vi.fn(),
  getNextRoadmapPosition: vi.fn(),
  createRoadmapItem: vi.fn(),
  updateRoadmapItem: vi.fn(),
  deleteRoadmapItem: vi.fn(),
  batchUpdateRoadmapPositions: vi.fn(),
  getFeedbackById: vi.fn(),
  updateFeedbackStatus: vi.fn(),
  // Stubs for methods the middleware or other code paths might call
  getProjectByApiKey: vi.fn(),
  upsertUser: vi.fn(),
};

vi.mock('../../workers/api/src/db', () => ({
  getDb: () => mockDb,
  createDatabase: () => mockDb,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH_HEADER = { Authorization: 'Bearer sm_test_token' };
const JSON_HEADER = { 'Content-Type': 'application/json' };
const authedHeaders = { ...AUTH_HEADER, ...JSON_HEADER };

const PROJECT = {
  id: 'proj-1',
  name: 'Test Project',
  slug: 'test-project',
  api_key: 'pk_test',
  owner_id: 'user-1',
};

const ROADMAP_ITEM = {
  id: 'item-1',
  project_id: 'proj-1',
  feedback_id: null,
  title: 'Ship dark mode',
  description: 'Users want dark mode',
  column: 'planned',
  position: 0,
  public: true,
  upvote_count: 0,
  downvote_count: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const PRIVATE_ITEM = { ...ROADMAP_ITEM, id: 'item-private', public: false };

// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  // Default: CLI token resolves to user-1
  mockDb.getCliTokenUser.mockResolvedValue({ user_id: 'user-1' });
});

// ===========================================================================
// PUBLIC ROUTES
// ===========================================================================

describe('GET /v1/roadmap/public/:slug', () => {
  it('returns items and project info when project exists', async () => {
    mockDb.getProjectBySlug.mockResolvedValue(PROJECT);
    mockDb.listRoadmapItems.mockResolvedValue([ROADMAP_ITEM]);

    const res = await request('/v1/roadmap/public/test-project');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe('Ship dark mode');
    expect(body.project).toEqual({ name: 'Test Project', slug: 'test-project' });

    // Should request public-only items
    expect(mockDb.listRoadmapItems).toHaveBeenCalledWith('proj-1', true);
  });

  it('returns 404 when project not found', async () => {
    mockDb.getProjectBySlug.mockResolvedValue(null);

    const res = await request('/v1/roadmap/public/nonexistent');
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toBe('Project not found');
  });
});

describe('POST /v1/roadmap/public/:slug/:id/vote', () => {
  it('records a vote successfully', async () => {
    mockDb.getProjectBySlug.mockResolvedValue(PROJECT);
    mockDb.getRoadmapItemById.mockResolvedValue(ROADMAP_ITEM);
    mockDb.setRoadmapVote.mockResolvedValue(undefined);

    const res = await request('/v1/roadmap/public/test-project/item-1/vote', {
      method: 'POST',
      headers: JSON_HEADER,
      body: JSON.stringify({ user_identifier: 'anon-123', vote: 1 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockDb.setRoadmapVote).toHaveBeenCalledWith(
      expect.objectContaining({
        roadmap_item_id: 'item-1',
        user_identifier: 'anon-123',
        vote: 1,
      })
    );
  });

  it('accepts vote of -1', async () => {
    mockDb.getProjectBySlug.mockResolvedValue(PROJECT);
    mockDb.getRoadmapItemById.mockResolvedValue(ROADMAP_ITEM);
    mockDb.setRoadmapVote.mockResolvedValue(undefined);

    const res = await request('/v1/roadmap/public/test-project/item-1/vote', {
      method: 'POST',
      headers: JSON_HEADER,
      body: JSON.stringify({ user_identifier: 'anon-123', vote: -1 }),
    });

    expect(res.status).toBe(200);
  });

  it('returns 400 when user_identifier is missing', async () => {
    const res = await request('/v1/roadmap/public/test-project/item-1/vote', {
      method: 'POST',
      headers: JSON_HEADER,
      body: JSON.stringify({ vote: 1 }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/user_identifier/i);
  });

  it('returns 400 when user_identifier is empty string', async () => {
    const res = await request('/v1/roadmap/public/test-project/item-1/vote', {
      method: 'POST',
      headers: JSON_HEADER,
      body: JSON.stringify({ user_identifier: '   ', vote: 1 }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/user_identifier/i);
  });

  it('returns 400 when vote is not 1 or -1', async () => {
    const res = await request('/v1/roadmap/public/test-project/item-1/vote', {
      method: 'POST',
      headers: JSON_HEADER,
      body: JSON.stringify({ user_identifier: 'anon-123', vote: 2 }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/vote must be 1 or -1/i);
  });

  it('returns 400 when vote is 0', async () => {
    const res = await request('/v1/roadmap/public/test-project/item-1/vote', {
      method: 'POST',
      headers: JSON_HEADER,
      body: JSON.stringify({ user_identifier: 'anon-123', vote: 0 }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 404 when project not found', async () => {
    mockDb.getProjectBySlug.mockResolvedValue(null);

    const res = await request('/v1/roadmap/public/nonexistent/item-1/vote', {
      method: 'POST',
      headers: JSON_HEADER,
      body: JSON.stringify({ user_identifier: 'anon-123', vote: 1 }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Project not found');
  });

  it('returns 404 when item not found', async () => {
    mockDb.getProjectBySlug.mockResolvedValue(PROJECT);
    mockDb.getRoadmapItemById.mockResolvedValue(null);

    const res = await request('/v1/roadmap/public/test-project/item-999/vote', {
      method: 'POST',
      headers: JSON_HEADER,
      body: JSON.stringify({ user_identifier: 'anon-123', vote: 1 }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Item not found');
  });

  it('returns 404 when item belongs to different project', async () => {
    mockDb.getProjectBySlug.mockResolvedValue(PROJECT);
    mockDb.getRoadmapItemById.mockResolvedValue({
      ...ROADMAP_ITEM,
      project_id: 'other-project',
    });

    const res = await request('/v1/roadmap/public/test-project/item-1/vote', {
      method: 'POST',
      headers: JSON_HEADER,
      body: JSON.stringify({ user_identifier: 'anon-123', vote: 1 }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Item not found');
  });

  it('returns 404 when item is private', async () => {
    mockDb.getProjectBySlug.mockResolvedValue(PROJECT);
    mockDb.getRoadmapItemById.mockResolvedValue(PRIVATE_ITEM);

    const res = await request('/v1/roadmap/public/test-project/item-private/vote', {
      method: 'POST',
      headers: JSON_HEADER,
      body: JSON.stringify({ user_identifier: 'anon-123', vote: 1 }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Item not found');
  });
});

describe('DELETE /v1/roadmap/public/:slug/:id/vote', () => {
  it('removes a vote successfully', async () => {
    mockDb.getProjectBySlug.mockResolvedValue(PROJECT);
    mockDb.removeRoadmapVote.mockResolvedValue(true);

    const res = await request(
      '/v1/roadmap/public/test-project/item-1/vote?user_identifier=anon-123',
      { method: 'DELETE' }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockDb.removeRoadmapVote).toHaveBeenCalledWith('item-1', 'anon-123');
  });

  it('returns 400 when user_identifier query param is missing', async () => {
    const res = await request('/v1/roadmap/public/test-project/item-1/vote', {
      method: 'DELETE',
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/user_identifier/i);
  });

  it('returns 404 when project not found', async () => {
    mockDb.getProjectBySlug.mockResolvedValue(null);

    const res = await request(
      '/v1/roadmap/public/nonexistent/item-1/vote?user_identifier=anon-123',
      { method: 'DELETE' }
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Project not found');
  });
});

// ===========================================================================
// DASHBOARD ROUTES (session auth)
// ===========================================================================

describe('Dashboard routes require auth', () => {
  it('GET /v1/roadmap/dashboard/proj-1 without auth returns 401', async () => {
    const res = await request('/v1/roadmap/dashboard/proj-1');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('POST /v1/roadmap/dashboard/proj-1 without auth returns 401', async () => {
    const res = await request('/v1/roadmap/dashboard/proj-1', {
      method: 'POST',
      headers: JSON_HEADER,
      body: JSON.stringify({ title: 'New item' }),
    });
    expect(res.status).toBe(401);
  });

  it('PATCH /v1/roadmap/dashboard/proj-1/item-1 without auth returns 401', async () => {
    const res = await request('/v1/roadmap/dashboard/proj-1/item-1', {
      method: 'PATCH',
      headers: JSON_HEADER,
      body: JSON.stringify({ title: 'Updated' }),
    });
    expect(res.status).toBe(401);
  });

  it('DELETE /v1/roadmap/dashboard/proj-1/item-1 without auth returns 401', async () => {
    const res = await request('/v1/roadmap/dashboard/proj-1/item-1', {
      method: 'DELETE',
    });
    expect(res.status).toBe(401);
  });

  it('POST /v1/roadmap/dashboard/proj-1/reorder without auth returns 401', async () => {
    const res = await request('/v1/roadmap/dashboard/proj-1/reorder', {
      method: 'POST',
      headers: JSON_HEADER,
      body: JSON.stringify({ items: [] }),
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /v1/roadmap/dashboard/:projectId', () => {
  it('returns 403 when user does not own the project', async () => {
    mockDb.getProjectById.mockResolvedValue({ ...PROJECT, owner_id: 'other-user' });

    const res = await request('/v1/roadmap/dashboard/proj-1', {
      headers: AUTH_HEADER,
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });

  it('returns 403 when project not found', async () => {
    mockDb.getProjectById.mockResolvedValue(null);

    const res = await request('/v1/roadmap/dashboard/proj-999', {
      headers: AUTH_HEADER,
    });

    expect(res.status).toBe(403);
  });

  it('returns all items (including private) for the owner', async () => {
    mockDb.getProjectById.mockResolvedValue(PROJECT);
    mockDb.listRoadmapItems.mockResolvedValue([ROADMAP_ITEM, PRIVATE_ITEM]);

    const res = await request('/v1/roadmap/dashboard/proj-1', {
      headers: AUTH_HEADER,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    // Should request all items (publicOnly = false)
    expect(mockDb.listRoadmapItems).toHaveBeenCalledWith('proj-1', false);
  });
});

describe('POST /v1/roadmap/dashboard/:projectId', () => {
  it('returns 403 when user does not own project', async () => {
    mockDb.getProjectById.mockResolvedValue({ ...PROJECT, owner_id: 'other-user' });

    const res = await request('/v1/roadmap/dashboard/proj-1', {
      method: 'POST',
      headers: authedHeaders,
      body: JSON.stringify({ title: 'New item' }),
    });

    expect(res.status).toBe(403);
  });

  it('returns 400 when title is missing', async () => {
    mockDb.getProjectById.mockResolvedValue(PROJECT);

    const res = await request('/v1/roadmap/dashboard/proj-1', {
      method: 'POST',
      headers: authedHeaders,
      body: JSON.stringify({ description: 'No title here' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/title/i);
  });

  it('returns 400 when title is empty string', async () => {
    mockDb.getProjectById.mockResolvedValue(PROJECT);

    const res = await request('/v1/roadmap/dashboard/proj-1', {
      method: 'POST',
      headers: authedHeaders,
      body: JSON.stringify({ title: '   ' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/title/i);
  });

  it('returns 400 when column is invalid', async () => {
    mockDb.getProjectById.mockResolvedValue(PROJECT);

    const res = await request('/v1/roadmap/dashboard/proj-1', {
      method: 'POST',
      headers: authedHeaders,
      body: JSON.stringify({ title: 'New item', column: 'invalid_column' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid column/i);
  });

  it('defaults column to backlog when not provided', async () => {
    mockDb.getProjectById.mockResolvedValue(PROJECT);
    mockDb.getNextRoadmapPosition.mockResolvedValue(0);
    mockDb.createRoadmapItem.mockResolvedValue({
      ...ROADMAP_ITEM,
      column: 'backlog',
    });

    const res = await request('/v1/roadmap/dashboard/proj-1', {
      method: 'POST',
      headers: authedHeaders,
      body: JSON.stringify({ title: 'New item' }),
    });

    expect(res.status).toBe(201);
    expect(mockDb.createRoadmapItem).toHaveBeenCalledWith(
      expect.objectContaining({ column: 'backlog' })
    );
  });

  it('creates item with 201 and returns it', async () => {
    mockDb.getProjectById.mockResolvedValue(PROJECT);
    mockDb.getNextRoadmapPosition.mockResolvedValue(3);
    const created = {
      ...ROADMAP_ITEM,
      id: 'new-id',
      title: 'Dark mode',
      description: 'Add dark mode support',
      column: 'in_progress',
      position: 3,
    };
    mockDb.createRoadmapItem.mockResolvedValue(created);

    const res = await request('/v1/roadmap/dashboard/proj-1', {
      method: 'POST',
      headers: authedHeaders,
      body: JSON.stringify({
        title: ' Dark mode ',
        description: ' Add dark mode support ',
        column: 'in_progress',
        public: false,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe('Dark mode');

    expect(mockDb.createRoadmapItem).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 'proj-1',
        title: 'Dark mode',
        description: 'Add dark mode support',
        column: 'in_progress',
        position: 3,
        public: false,
        feedback_id: null,
      })
    );
  });

  it('accepts all valid columns', async () => {
    for (const column of ['backlog', 'planned', 'in_progress', 'done']) {
      vi.clearAllMocks();
      mockDb.getCliTokenUser.mockResolvedValue({ user_id: 'user-1' });
      mockDb.getProjectById.mockResolvedValue(PROJECT);
      mockDb.getNextRoadmapPosition.mockResolvedValue(0);
      mockDb.createRoadmapItem.mockResolvedValue({ ...ROADMAP_ITEM, column });

      const res = await request('/v1/roadmap/dashboard/proj-1', {
        method: 'POST',
        headers: authedHeaders,
        body: JSON.stringify({ title: 'Item', column }),
      });

      expect(res.status).toBe(201);
    }
  });
});

describe('POST /v1/roadmap/dashboard/:projectId/from-feedback/:feedbackId', () => {
  const FEEDBACK = {
    id: 'fb-1',
    project_id: 'proj-1',
    title: 'Add dark mode',
    description: 'Users want dark mode',
    type: 'feature',
    status: 'new',
  };

  it('returns 403 when user does not own project', async () => {
    mockDb.getProjectById.mockResolvedValue({ ...PROJECT, owner_id: 'other-user' });

    const res = await request('/v1/roadmap/dashboard/proj-1/from-feedback/fb-1', {
      method: 'POST',
      headers: AUTH_HEADER,
    });

    expect(res.status).toBe(403);
  });

  it('returns 404 when feedback not found', async () => {
    mockDb.getProjectById.mockResolvedValue(PROJECT);
    mockDb.getFeedbackById.mockResolvedValue(null);

    const res = await request('/v1/roadmap/dashboard/proj-1/from-feedback/fb-999', {
      method: 'POST',
      headers: AUTH_HEADER,
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/feedback not found/i);
  });

  it('returns 404 when feedback belongs to different project', async () => {
    mockDb.getProjectById.mockResolvedValue(PROJECT);
    mockDb.getFeedbackById.mockResolvedValue({
      ...FEEDBACK,
      project_id: 'other-project',
    });

    const res = await request('/v1/roadmap/dashboard/proj-1/from-feedback/fb-1', {
      method: 'POST',
      headers: AUTH_HEADER,
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/feedback not found/i);
  });

  it('creates roadmap item from feedback and marks feedback as on_roadmap', async () => {
    mockDb.getProjectById.mockResolvedValue(PROJECT);
    mockDb.getFeedbackById.mockResolvedValue(FEEDBACK);
    mockDb.getNextRoadmapPosition.mockResolvedValue(2);
    const createdItem = {
      ...ROADMAP_ITEM,
      feedback_id: 'fb-1',
      title: 'Add dark mode',
      column: 'planned',
      position: 2,
    };
    mockDb.createRoadmapItem.mockResolvedValue(createdItem);
    mockDb.updateFeedbackStatus.mockResolvedValue({});

    const res = await request('/v1/roadmap/dashboard/proj-1/from-feedback/fb-1', {
      method: 'POST',
      headers: AUTH_HEADER,
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.feedback_id).toBe('fb-1');
    expect(body.title).toBe('Add dark mode');

    // Verify the item was created in the 'planned' column
    expect(mockDb.createRoadmapItem).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 'proj-1',
        feedback_id: 'fb-1',
        title: 'Add dark mode',
        column: 'planned',
        position: 2,
        public: true,
      })
    );

    // Verify feedback status was updated
    expect(mockDb.updateFeedbackStatus).toHaveBeenCalledWith('fb-1', 'on_roadmap');
  });
});

describe('PATCH /v1/roadmap/dashboard/:projectId/:id', () => {
  it('returns 403 when user does not own project', async () => {
    mockDb.getProjectById.mockResolvedValue({ ...PROJECT, owner_id: 'other-user' });

    const res = await request('/v1/roadmap/dashboard/proj-1/item-1', {
      method: 'PATCH',
      headers: authedHeaders,
      body: JSON.stringify({ title: 'Updated' }),
    });

    expect(res.status).toBe(403);
  });

  it('returns 404 when item not found', async () => {
    mockDb.getProjectById.mockResolvedValue(PROJECT);
    mockDb.getRoadmapItemById.mockResolvedValue(null);

    const res = await request('/v1/roadmap/dashboard/proj-1/item-999', {
      method: 'PATCH',
      headers: authedHeaders,
      body: JSON.stringify({ title: 'Updated' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Not found');
  });

  it('returns 404 when item belongs to different project', async () => {
    mockDb.getProjectById.mockResolvedValue(PROJECT);
    mockDb.getRoadmapItemById.mockResolvedValue({
      ...ROADMAP_ITEM,
      project_id: 'other-project',
    });

    const res = await request('/v1/roadmap/dashboard/proj-1/item-1', {
      method: 'PATCH',
      headers: authedHeaders,
      body: JSON.stringify({ title: 'Updated' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Not found');
  });

  it('returns 400 when column is invalid', async () => {
    mockDb.getProjectById.mockResolvedValue(PROJECT);
    mockDb.getRoadmapItemById.mockResolvedValue(ROADMAP_ITEM);

    const res = await request('/v1/roadmap/dashboard/proj-1/item-1', {
      method: 'PATCH',
      headers: authedHeaders,
      body: JSON.stringify({ column: 'invalid_column' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid column/i);
  });

  it('updates item successfully', async () => {
    mockDb.getProjectById.mockResolvedValue(PROJECT);
    mockDb.getRoadmapItemById.mockResolvedValue(ROADMAP_ITEM);
    const updated = { ...ROADMAP_ITEM, title: 'Updated title', column: 'done' };
    mockDb.updateRoadmapItem.mockResolvedValue(updated);

    const res = await request('/v1/roadmap/dashboard/proj-1/item-1', {
      method: 'PATCH',
      headers: authedHeaders,
      body: JSON.stringify({ title: ' Updated title ', column: 'done' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Updated title');

    expect(mockDb.updateRoadmapItem).toHaveBeenCalledWith('item-1', {
      title: 'Updated title',
      description: undefined,
      column: 'done',
      position: undefined,
      public: undefined,
    });
  });

  it('allows updating only description', async () => {
    mockDb.getProjectById.mockResolvedValue(PROJECT);
    mockDb.getRoadmapItemById.mockResolvedValue(ROADMAP_ITEM);
    mockDb.updateRoadmapItem.mockResolvedValue({
      ...ROADMAP_ITEM,
      description: 'New desc',
    });

    const res = await request('/v1/roadmap/dashboard/proj-1/item-1', {
      method: 'PATCH',
      headers: authedHeaders,
      body: JSON.stringify({ description: ' New desc ' }),
    });

    expect(res.status).toBe(200);
    expect(mockDb.updateRoadmapItem).toHaveBeenCalledWith('item-1',
      expect.objectContaining({ description: 'New desc' })
    );
  });
});

describe('DELETE /v1/roadmap/dashboard/:projectId/:id', () => {
  it('returns 403 when user does not own project', async () => {
    mockDb.getProjectById.mockResolvedValue({ ...PROJECT, owner_id: 'other-user' });

    const res = await request('/v1/roadmap/dashboard/proj-1/item-1', {
      method: 'DELETE',
      headers: AUTH_HEADER,
    });

    expect(res.status).toBe(403);
  });

  it('returns 404 when item not found', async () => {
    mockDb.getProjectById.mockResolvedValue(PROJECT);
    mockDb.getRoadmapItemById.mockResolvedValue(null);

    const res = await request('/v1/roadmap/dashboard/proj-1/item-999', {
      method: 'DELETE',
      headers: AUTH_HEADER,
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Not found');
  });

  it('returns 404 when item belongs to different project', async () => {
    mockDb.getProjectById.mockResolvedValue(PROJECT);
    mockDb.getRoadmapItemById.mockResolvedValue({
      ...ROADMAP_ITEM,
      project_id: 'other-project',
    });

    const res = await request('/v1/roadmap/dashboard/proj-1/item-1', {
      method: 'DELETE',
      headers: AUTH_HEADER,
    });

    expect(res.status).toBe(404);
  });

  it('deletes item successfully', async () => {
    mockDb.getProjectById.mockResolvedValue(PROJECT);
    mockDb.getRoadmapItemById.mockResolvedValue(ROADMAP_ITEM);
    mockDb.deleteRoadmapItem.mockResolvedValue(true);

    const res = await request('/v1/roadmap/dashboard/proj-1/item-1', {
      method: 'DELETE',
      headers: AUTH_HEADER,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockDb.deleteRoadmapItem).toHaveBeenCalledWith('item-1');
  });
});

describe('POST /v1/roadmap/dashboard/:projectId/reorder', () => {
  it('returns 403 when user does not own project', async () => {
    mockDb.getProjectById.mockResolvedValue({ ...PROJECT, owner_id: 'other-user' });

    const res = await request('/v1/roadmap/dashboard/proj-1/reorder', {
      method: 'POST',
      headers: authedHeaders,
      body: JSON.stringify({
        items: [{ id: 'item-1', column: 'done', position: 0 }],
      }),
    });

    expect(res.status).toBe(403);
  });

  it('returns 400 when items is not an array', async () => {
    mockDb.getProjectById.mockResolvedValue(PROJECT);

    const res = await request('/v1/roadmap/dashboard/proj-1/reorder', {
      method: 'POST',
      headers: authedHeaders,
      body: JSON.stringify({ items: 'not-an-array' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/items array/i);
  });

  it('returns 400 when items field is missing', async () => {
    mockDb.getProjectById.mockResolvedValue(PROJECT);

    const res = await request('/v1/roadmap/dashboard/proj-1/reorder', {
      method: 'POST',
      headers: authedHeaders,
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/items array/i);
  });

  it('returns 400 when an item is missing id', async () => {
    mockDb.getProjectById.mockResolvedValue(PROJECT);

    const res = await request('/v1/roadmap/dashboard/proj-1/reorder', {
      method: 'POST',
      headers: authedHeaders,
      body: JSON.stringify({
        items: [{ column: 'done', position: 0 }],
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/id.*column.*position/i);
  });

  it('returns 400 when an item is missing column', async () => {
    mockDb.getProjectById.mockResolvedValue(PROJECT);

    const res = await request('/v1/roadmap/dashboard/proj-1/reorder', {
      method: 'POST',
      headers: authedHeaders,
      body: JSON.stringify({
        items: [{ id: 'item-1', position: 0 }],
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/id.*column.*position/i);
  });

  it('returns 400 when an item is missing position', async () => {
    mockDb.getProjectById.mockResolvedValue(PROJECT);

    const res = await request('/v1/roadmap/dashboard/proj-1/reorder', {
      method: 'POST',
      headers: authedHeaders,
      body: JSON.stringify({
        items: [{ id: 'item-1', column: 'done' }],
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/id.*column.*position/i);
  });

  it('returns 400 when an item has invalid column', async () => {
    mockDb.getProjectById.mockResolvedValue(PROJECT);

    const res = await request('/v1/roadmap/dashboard/proj-1/reorder', {
      method: 'POST',
      headers: authedHeaders,
      body: JSON.stringify({
        items: [{ id: 'item-1', column: 'invalid_column', position: 0 }],
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid column/i);
  });

  it('batch updates positions successfully', async () => {
    mockDb.getProjectById.mockResolvedValue(PROJECT);
    mockDb.batchUpdateRoadmapPositions.mockResolvedValue(undefined);

    const items = [
      { id: 'item-1', column: 'done', position: 0 },
      { id: 'item-2', column: 'done', position: 1 },
      { id: 'item-3', column: 'in_progress', position: 0 },
    ];

    const res = await request('/v1/roadmap/dashboard/proj-1/reorder', {
      method: 'POST',
      headers: authedHeaders,
      body: JSON.stringify({ items }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockDb.batchUpdateRoadmapPositions).toHaveBeenCalledWith(items);
  });

  it('accepts empty items array', async () => {
    mockDb.getProjectById.mockResolvedValue(PROJECT);
    mockDb.batchUpdateRoadmapPositions.mockResolvedValue(undefined);

    const res = await request('/v1/roadmap/dashboard/proj-1/reorder', {
      method: 'POST',
      headers: authedHeaders,
      body: JSON.stringify({ items: [] }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
