import { Hono, type Context } from 'hono';
import { Bindings, Variables } from '../types';
import { decryptAuthJsJwe, requireApiKey, requireSession } from '../middleware/auth';
import {
  SubmitFeedbackRequest,
  FeedbackType,
  FeedbackStatus,
  AnyFeedbackStatus,
  FeedbackRecord,
} from '@saas-maker/shared-types';
import { getDb } from '../db';
import { email } from '@saas-maker/email';
import { trace, capture } from '@saas-maker/ops';

const feedback = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const VALID_TYPES: FeedbackType[] = ['bug', 'feature', 'feedback'];
const VALID_STATUSES: FeedbackStatus[] = ['new', 'acknowledged', 'investigating', 'planned', 'in_progress', 'resolved', 'dismissed', 'on_roadmap'];
const PAGE_SIZE = 20;

function scheduleBackgroundTask(c: Context<{ Bindings: Bindings; Variables: Variables }>, task: Promise<unknown>) {
  try {
    c.executionCtx.waitUntil(task);
  } catch {
    void task;
  }
}

function isValidStatus(status: string): status is FeedbackStatus {
  return VALID_STATUSES.includes(status as FeedbackStatus);
}

async function getOptionalUserId(c: Context<{ Bindings: Bindings; Variables: Variables }>) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return undefined;
  const token = authHeader.slice(7);
  const payload = await decryptAuthJsJwe(token, c.env.AUTH_SECRET);
  if (!payload?.sub) return undefined;
  return payload.sub;
}

// Submit feedback (public, API key auth)
feedback.post('/', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const body = (await c.req.json()) as SubmitFeedbackRequest;

  if (!body.title?.trim()) return c.json({ error: 'Title is required' }, 400);
  if (!body.description?.trim()) return c.json({ error: 'Description is required' }, 400);
  if (!body.submitter_email?.trim()) return c.json({ error: 'Email is required' }, 400);
  if (!VALID_TYPES.includes(body.type)) return c.json({ error: 'Invalid type' }, 400);

  const db = getDb(c.env.DB);

  const record = await db.createFeedback({
    id: crypto.randomUUID(),
    project_id: projectId,
    type: body.type,
    status: 'new',
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
    if (owner?.email) {
      scheduleBackgroundTask(
        c,
        email.send({
          to: owner.email,
          subject: `New ${record.type} on ${project.name}`,
          template: `New {{type}} submission on {{projectName}}\n\nFrom: {{submitter}}\nTitle: {{title}}\n{{description}}\n\nView in dashboard: {{dashboardUrl}}`,
          data: {
            projectName: project.name,
            type: record.type,
            title: record.title,
            description: record.description,
            submitter: record.submitter_name || record.submitter_email || 'Anonymous',
            dashboardUrl: `https://app.sassmaker.com/projects/${project.slug}/feedback`,
          },
        }).catch(() => {})
      );
    }
  }

  capture({ distinctId: record.submitter_email, event: 'feedback_submitted', properties: { feedback_id: record.id, project_id: projectId, type: record.type, title: record.title } });

  return c.json(record, 201);
});

// List feedback for the authenticated project (API key auth)
feedback.get('/', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const type = c.req.query('type') as FeedbackType | undefined;
  const status = c.req.query('status') as AnyFeedbackStatus | undefined;
  const sort = (c.req.query('sort') || 'newest') as 'newest' | 'upvotes';
  const page = parseInt(c.req.query('page') || '1', 10);

  if (type && !VALID_TYPES.includes(type)) return c.json({ error: 'Invalid type filter' }, 400);
  if (status && !isValidStatus(status)) return c.json({ error: 'Invalid status filter' }, 400);

  const db = getDb(c.env.DB);
  const options = { type, status, sort, page, limit: PAGE_SIZE };
  const result = await trace('db:listFeedback', () => db.listFeedback(projectId, options), { project: 'saasmaker-api' });

  return c.json({ data: result.data, total: result.total, page, limit: PAGE_SIZE });
});

// Dashboard inbox - list feedback for a project (session auth)
feedback.get('/inbox/:projectId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const type = c.req.query('type') as FeedbackType | undefined;
  const status = c.req.query('status') as AnyFeedbackStatus | undefined;
  const sort = (c.req.query('sort') || 'newest') as 'newest' | 'upvotes';
  const page = parseInt(c.req.query('page') || '1', 10);

  if (type && !VALID_TYPES.includes(type)) return c.json({ error: 'Invalid type filter' }, 400);
  if (status && !isValidStatus(status)) return c.json({ error: 'Invalid status filter' }, 400);

  const db = getDb(c.env.DB);

  // Verify ownership
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const result = await db.listFeedback(projectId, { type, status, sort, page, limit: PAGE_SIZE }, userId);

  return c.json({ data: result.data, total: result.total, page, limit: PAGE_SIZE });
});

// All feature requests across all user's projects (session auth)
feedback.get('/board', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const sort = (c.req.query('sort') || 'upvotes') as 'newest' | 'upvotes';
  const status = c.req.query('status') as string | undefined;
  const db = getDb(c.env.DB);

  // Get all projects owned by user
  const projects = await db.listProjectsByOwner(userId, 'dashboard');
  if (projects.length === 0) return c.json({ data: [], total: 0 });

  const projectIds = projects.map((p) => p.id);

  // Query feedback across all projects
  const allFeedback: Array<FeedbackRecord & { project_name: string; project_slug: string }> = [];
  for (const pid of projectIds) {
    const result = await db.listFeedback(
      pid,
      {
        type: 'feature',
        status: status && status !== 'all' ? (status as AnyFeedbackStatus) : undefined,
        sort,
        page: 1,
        limit: 100,
      },
      userId,
    );
    const proj = projects.find((p) => p.id === pid)!;
    for (const item of result.data) {
      allFeedback.push({ ...item, project_name: proj.name, project_slug: proj.slug });
    }
  }

  // Sort merged results
  if (sort === 'upvotes') {
    allFeedback.sort(
      (a, b) =>
        b.upvote_count - b.downvote_count - (a.upvote_count - a.downvote_count),
    );
  } else {
    allFeedback.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }

  return c.json({ data: allFeedback, total: allFeedback.length });
});

// List feedback by slug (public, no auth)
feedback.get('/by-project/:slug', async (c) => {
  const slug = c.req.param('slug');
  const type = c.req.query('type') as FeedbackType | undefined;
  const status = c.req.query('status') as AnyFeedbackStatus | undefined;
  const sort = (c.req.query('sort') || 'newest') as 'newest' | 'upvotes';
  const page = parseInt(c.req.query('page') || '1', 10);

  if (type && !VALID_TYPES.includes(type)) return c.json({ error: 'Invalid type filter' }, 400);
  if (status && !isValidStatus(status)) return c.json({ error: 'Invalid status filter' }, 400);

  const db = getDb(c.env.DB);
  const project = await db.getProjectBySlug(slug);
  if (!project) return c.json({ error: 'Project not found' }, 404);

  const viewerId = await getOptionalUserId(c);
  const result = await db.listFeedback(project.id, { type, status, sort, page, limit: PAGE_SIZE }, viewerId);

  return c.json({ data: result.data, total: result.total, page, limit: PAGE_SIZE, project: { name: project.name, slug: project.slug } });
});

// Upvote (requires Google OAuth session)
feedback.post('/:id/upvote', requireSession, async (c) => {
  const feedbackId = c.req.param('id');
  const userId = c.get('userId')!;

  const db = getDb(c.env.DB);
  const existing = await db.getFeedbackById(feedbackId);
  if (!existing) return c.json({ error: 'Feedback not found' }, 404);

  await db.setVote({
    id: crypto.randomUUID(),
    feedback_id: feedbackId,
    user_id: userId,
    vote: 1,
  });

  return c.json({ ok: true });
});

// Remove upvote
feedback.delete('/:id/upvote', requireSession, async (c) => {
  const feedbackId = c.req.param('id');
  const userId = c.get('userId')!;

  const db = getDb(c.env.DB);
  const currentVote = await db.getUserVote(feedbackId, userId);
  if (currentVote !== 'up') return c.json({ error: 'Upvote not found' }, 404);

  await db.removeVote(feedbackId, userId);

  return c.json({ ok: true });
});

// Downvote (requires Google OAuth session)
feedback.post('/:id/downvote', requireSession, async (c) => {
  const feedbackId = c.req.param('id');
  const userId = c.get('userId')!;

  const db = getDb(c.env.DB);
  const existing = await db.getFeedbackById(feedbackId);
  if (!existing) return c.json({ error: 'Feedback not found' }, 404);

  await db.setVote({
    id: crypto.randomUUID(),
    feedback_id: feedbackId,
    user_id: userId,
    vote: -1,
  });

  return c.json({ ok: true });
});

// Remove downvote
feedback.delete('/:id/downvote', requireSession, async (c) => {
  const feedbackId = c.req.param('id');
  const userId = c.get('userId')!;

  const db = getDb(c.env.DB);
  const currentVote = await db.getUserVote(feedbackId, userId);
  if (currentVote !== 'down') return c.json({ error: 'Downvote not found' }, 404);

  await db.removeVote(feedbackId, userId);

  return c.json({ ok: true });
});

// Update feedback status (dashboard)
feedback.patch('/:id', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const feedbackId = c.req.param('id');
  const body = (await c.req.json()) as { status: AnyFeedbackStatus };
  if (!body.status || !isValidStatus(body.status)) return c.json({ error: 'Invalid status' }, 400);

  const db = getDb(c.env.DB);

  // Verify ownership: feedback -> project -> owner
  const existing = await db.getFeedbackById(feedbackId);
  if (!existing) return c.json({ error: 'Feedback not found' }, 404);

  const project = await db.getProjectById(existing.project_id);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const updated = await db.updateFeedbackStatus(feedbackId, body.status);
  capture({ distinctId: userId, event: 'feedback_status_updated', properties: { feedback_id: feedbackId, status: body.status, project_id: existing.project_id } });
  return c.json(updated);
});

// Delete feedback (dashboard)
feedback.delete('/:id', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const feedbackId = c.req.param('id');

  const db = getDb(c.env.DB);

  // Verify ownership: feedback -> project -> owner
  const existing = await db.getFeedbackById(feedbackId);
  if (!existing) return c.json({ error: 'Feedback not found' }, 404);

  const project = await db.getProjectById(existing.project_id);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  await db.deleteFeedback(feedbackId);
  capture({ distinctId: userId, event: 'feedback_deleted', properties: { feedback_id: feedbackId, project_id: existing.project_id, type: existing.type } });
  return c.json({ ok: true });
});

export { feedback };
