import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireApiKey, requireSession } from '../middleware/auth';
import { getDb } from '../db';
import type { WaitlistSignupRequest } from '@saas-maker/shared-types';
import { capture } from '@saas-maker/ops';
import { email, renderEmail, WaitlistSignupEmail } from '@saas-maker/email';
import * as React from 'react';

const waitlist = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const PAGE_SIZE = 50;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public: signup (API key)
waitlist.post('/', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const body = (await c.req.json()) as WaitlistSignupRequest;

  if (!body.email?.trim()) return c.json({ error: 'Email is required' }, 400);
  if (!EMAIL_RE.test(body.email.trim())) return c.json({ error: 'Invalid email format' }, 400);

  const db = getDb(c.env.DB);

  try {
    const entry = await db.createWaitlistEntry({
      id: crypto.randomUUID(),
      project_id: projectId,
      email: body.email.trim().toLowerCase(),
      name: body.name?.trim() || null,
    });
    capture({ distinctId: entry.email, event: 'waitlist_signup', properties: { project_id: projectId, position: entry.position, name: entry.name ?? undefined } });

    // Notify project owner — fire and forget
    const project = await db.getProjectById(projectId);
    if (project) {
      const owner = await db.getUserById(project.owner_id);
      if (owner?.email) {
        renderEmail(
          React.createElement(WaitlistSignupEmail, {
            projectName: project.name,
            signupEmail: entry.email,
            signupName: entry.name ?? undefined,
            dashboardUrl: `https://app.sassmaker.com/projects/${project.slug}/waitlist`,
          })
        ).then(({ html, text }) =>
          email.send({
            to: owner.email,
            subject: `New waitlist signup for ${project.name}`,
            html,
            text,
          })
        ).catch(() => {});
      }
    }

    return c.json({ id: entry.id, email: entry.email, name: entry.name, position: entry.position, created_at: entry.created_at }, 201);
  } catch (e: any) {
    if (e.message?.includes('duplicate') || e.code === '23505') {
      return c.json({ error: 'Email already on the waitlist' }, 409);
    }
    throw e;
  }
});

// Public: count (API key)
waitlist.get('/count', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const db = getDb(c.env.DB);
  const count = await db.getWaitlistCount(projectId);
  return c.json({ count });
});

// Dashboard: list entries (session auth)
waitlist.get('/', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id query param is required' }, 400);

  const page = parseInt(c.req.query('page') || '1', 10);
  const db = getDb(c.env.DB);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const result = await db.listWaitlistEntries(projectId, page, PAGE_SIZE);
  return c.json({ data: result.data, total: result.total, page, limit: PAGE_SIZE });
});

// Dashboard: delete entry (session auth)
waitlist.delete('/:id', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const entryId = c.req.param('id');
  const db = getDb(c.env.DB);

  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id query param is required' }, 400);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const deleted = await db.deleteWaitlistEntry(entryId);
  if (!deleted) return c.json({ error: 'Entry not found' }, 404);
  return c.json({ ok: true });
});

export { waitlist };
