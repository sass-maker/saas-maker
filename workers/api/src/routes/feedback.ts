import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireApiKey, requireSession } from '../middleware/auth';
import { SubmitFeedbackRequest, FeedbackType, FeedbackStatus } from '@saasmaker/shared-types';
import { getDb } from '../db';
import { sendNewFeedbackEmail } from '../email';

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

  const db = getDb(c.env.DATABASE_URL);

  const record = await db.createFeedback({
    id: crypto.randomUUID(),
    project_id: projectId,
    type: body.type,
    title: body.title.trim(),
    description: body.description.trim(),
    image_url: body.image_url || null,
    submitter_email: body.submitter_email.trim(),
    submitter_name: body.submitter_name?.trim() || null,
  });

  // Fire-and-forget email notification
  const project = await db.getProjectById(projectId);
  if (project) {
    const owner = await db.getUserById(project.owner_id);
    if (owner) {
      sendNewFeedbackEmail(c.env.RESEND_API_KEY, c.env.NOTIFICATION_FROM_EMAIL, {
        to: owner.email,
        projectName: project.name,
        feedbackTitle: record.title,
        feedbackType: record.type,
        feedbackDescription: record.description,
        submitterEmail: record.submitter_email,
        dashboardUrl: `${c.env.APP_BASE_URL}/projects/${project.slug}`,
      });
    }
  }

  return c.json(record, 201);
});

// List feedback by slug (public, no auth)
feedback.get('/by-project/:slug', async (c) => {
  const slug = c.req.param('slug');
  const type = c.req.query('type') as FeedbackType | undefined;
  const status = c.req.query('status') as FeedbackStatus | undefined;
  const sort = (c.req.query('sort') || 'newest') as 'newest' | 'upvotes';
  const page = parseInt(c.req.query('page') || '1', 10);

  if (type && !VALID_TYPES.includes(type)) return c.json({ error: 'Invalid type filter' }, 400);
  if (status && !VALID_STATUSES.includes(status)) return c.json({ error: 'Invalid status filter' }, 400);

  const db = getDb(c.env.DATABASE_URL);
  const project = await db.getProjectBySlug(slug);
  if (!project) return c.json({ error: 'Project not found' }, 404);

  const result = await db.listFeedback(project.id, { type, status, sort, page, limit: PAGE_SIZE });

  return c.json({ data: result.data, total: result.total, page, limit: PAGE_SIZE, project: { name: project.name, slug: project.slug } });
});

// Upvote (requires Google OAuth session)
feedback.post('/:id/upvote', requireSession, async (c) => {
  const feedbackId = c.req.param('id');
  const userId = c.get('userId')!;

  const db = getDb(c.env.DATABASE_URL);

  const already = await db.hasUpvoted(feedbackId, userId);
  if (already) return c.json({ error: 'Already upvoted' }, 409);

  await db.addUpvote({
    id: crypto.randomUUID(),
    feedback_id: feedbackId,
    user_id: userId,
  });

  return c.json({ ok: true }, 201);
});

// Remove upvote
feedback.delete('/:id/upvote', requireSession, async (c) => {
  const feedbackId = c.req.param('id');
  const userId = c.get('userId')!;

  const db = getDb(c.env.DATABASE_URL);
  const removed = await db.removeUpvote(feedbackId, userId);
  if (!removed) return c.json({ error: 'Upvote not found' }, 404);

  return c.json({ ok: true });
});

// Update feedback status (dashboard)
feedback.patch('/:id', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const feedbackId = c.req.param('id');
  const body = (await c.req.json()) as { status: FeedbackStatus };
  if (!VALID_STATUSES.includes(body.status)) return c.json({ error: 'Invalid status' }, 400);

  const db = getDb(c.env.DATABASE_URL);

  // Verify ownership: feedback -> project -> owner
  const existing = await db.getFeedbackById(feedbackId);
  if (!existing) return c.json({ error: 'Feedback not found' }, 404);

  const project = await db.getProjectById(existing.project_id);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const updated = await db.updateFeedbackStatus(feedbackId, body.status);
  return c.json(updated);
});

// Delete feedback (dashboard)
feedback.delete('/:id', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const feedbackId = c.req.param('id');

  const db = getDb(c.env.DATABASE_URL);

  // Verify ownership: feedback -> project -> owner
  const existing = await db.getFeedbackById(feedbackId);
  if (!existing) return c.json({ error: 'Feedback not found' }, 404);

  const project = await db.getProjectById(existing.project_id);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  await db.deleteFeedback(feedbackId);
  return c.json({ ok: true });
});

export { feedback };
