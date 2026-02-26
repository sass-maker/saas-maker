import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireApiKey, requireSession } from '../middleware/auth';
import { SubmitFeedbackRequest, FeedbackType, FeedbackStatus } from '@saasmaker/shared-types';

const feedback = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const VALID_TYPES: FeedbackType[] = ['bug', 'feature', 'feedback'];
const VALID_STATUSES: FeedbackStatus[] = ['new', 'in_progress', 'done', 'dismissed'];
const PAGE_SIZE = 20;

// Submit feedback (public, API key auth)
feedback.post('/', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const body = (await c.req.json()) as SubmitFeedbackRequest;

  if (!body.title?.trim()) return c.json({ error: 'Title is required' }, 400);
  if (!body.description?.trim()) return c.json({ error: 'Description is required' }, 400);
  if (!body.submitter_email?.trim()) return c.json({ error: 'Email is required' }, 400);
  if (!VALID_TYPES.includes(body.type)) return c.json({ error: 'Invalid type' }, 400);

  const record = {
    id: crypto.randomUUID(),
    project_id: projectId,
    type: body.type,
    status: 'new' as const,
    title: body.title.trim(),
    description: body.description.trim(),
    image_url: body.image_url || null,
    submitter_email: body.submitter_email.trim(),
    submitter_name: body.submitter_name?.trim() || null,
    upvote_count: 0,
    created_at: new Date().toISOString(),
  };

  // TODO: db.createFeedback(record)
  // TODO: Send email notification
  return c.json(record, 201);
});

// List feedback (public, API key auth)
feedback.get('/', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const type = c.req.query('type') as FeedbackType | undefined;
  const status = c.req.query('status') as FeedbackStatus | undefined;
  const sort = c.req.query('sort') || 'newest';
  const page = parseInt(c.req.query('page') || '1', 10);

  if (type && !VALID_TYPES.includes(type)) return c.json({ error: 'Invalid type filter' }, 400);
  if (status && !VALID_STATUSES.includes(status)) return c.json({ error: 'Invalid status filter' }, 400);

  // TODO: db.listFeedback(projectId, { type, status, sort, page, limit: PAGE_SIZE })
  return c.json({ data: [], total: 0, page, limit: PAGE_SIZE });
});

// Upvote (requires Google OAuth session)
feedback.post('/:id/upvote', requireSession, async (c) => {
  const feedbackId = c.req.param('id');
  const userId = c.get('userId')!;
  // TODO: db.addUpvote + increment upvote_count
  return c.json({ ok: true }, 201);
});

// Remove upvote
feedback.delete('/:id/upvote', requireSession, async (c) => {
  const feedbackId = c.req.param('id');
  const userId = c.get('userId')!;
  // TODO: db.removeUpvote + decrement upvote_count
  return c.json({ ok: true });
});

// Dashboard inbox
feedback.get('/inbox/:projectId', requireSession, async (c) => {
  const projectId = c.req.param('projectId');
  const type = c.req.query('type') as FeedbackType | undefined;
  const status = c.req.query('status') as FeedbackStatus | undefined;
  const sort = c.req.query('sort') || 'newest';
  const page = parseInt(c.req.query('page') || '1', 10);
  // TODO: verify ownership, db.listFeedback
  return c.json({ data: [], total: 0, page, limit: PAGE_SIZE });
});

// Update feedback status (dashboard)
feedback.patch('/:id', requireSession, async (c) => {
  const feedbackId = c.req.param('id');
  const body = (await c.req.json()) as { status: FeedbackStatus };
  if (!VALID_STATUSES.includes(body.status)) return c.json({ error: 'Invalid status' }, 400);
  // TODO: verify ownership, db.updateFeedbackStatus
  return c.json({ id: feedbackId, status: body.status });
});

// Delete feedback (dashboard)
feedback.delete('/:id', requireSession, async (c) => {
  const feedbackId = c.req.param('id');
  // TODO: verify ownership, db.deleteFeedback
  return c.json({ ok: true });
});

export { feedback };
