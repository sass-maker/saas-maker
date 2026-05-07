import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireApiKey, requireApiKeyOrSession, requireSession } from '../middleware/auth';
import { getDb } from '../db';
import type { 
  CreateFormRequest,
  UpdateFormRequest,
  UpsertFormQuestionRequest,
  SubmitFormResponseRequest,
  FormRecord,
  FormQuestionRecord
} from '@saas-maker/shared-types';
import { capture } from '@saas-maker/ops';

const forms = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const PAGE_SIZE = 50;

// --- Dashboard Routes (Session Auth) ---

// List forms
forms.get('/dashboard/:projectId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const page = parseInt(c.req.query('page') || '1', 10);
  const db = getDb(c.env.DB);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const result = await db.listForms(projectId, page, PAGE_SIZE);
  const stats = await db.getFormStats(projectId);

  return c.json({ ...result, page, limit: PAGE_SIZE, stats });
});

// Create form
forms.post('/dashboard/:projectId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const body = (await c.req.json()) as CreateFormRequest;

  if (!body.title?.trim()) return c.json({ error: 'Title is required' }, 400);
  if (!body.slug?.trim()) return c.json({ error: 'Slug is required' }, 400);

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  // Check slug uniqueness within project
  const existing = await db.getFormBySlug(projectId, body.slug.trim());
  if (existing) return c.json({ error: 'Form with this slug already exists' }, 409);

  const form = await db.createForm({
    id: crypto.randomUUID(),
    project_id: projectId,
    title: body.title.trim(),
    slug: body.slug.trim(),
    description: body.description || null,
    status: body.status || 'draft',
    theme: body.theme || {},
    settings: body.settings || {},
  });

  capture({ distinctId: userId, event: 'form_created', properties: { project_id: projectId, form_id: form.id } });
  return c.json({ data: form }, 201);
});

// Get form detail
forms.get('/dashboard/:projectId/:formId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const formId = c.req.param('formId');
  const db = getDb(c.env.DB);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const form = await db.getFormById(formId);
  if (!form || form.project_id !== projectId) return c.json({ error: 'Form not found' }, 404);

  const questions = await db.listFormQuestions(formId);
  const response_count = await db.getFormResponseCount(formId);

  return c.json({ data: { ...form, questions, response_count } });
});

// Update form
forms.patch('/dashboard/:projectId/:formId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const formId = c.req.param('formId');
  const body = (await c.req.json()) as UpdateFormRequest;
  const db = getDb(c.env.DB);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const existing = await db.getFormById(formId);
  if (!existing || existing.project_id !== projectId) return c.json({ error: 'Form not found' }, 404);

  const updated = await db.updateForm(formId, body);
  return c.json({ data: updated });
});

// Delete form
forms.delete('/dashboard/:projectId/:formId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const formId = c.req.param('formId');
  const db = getDb(c.env.DB);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const existing = await db.getFormById(formId);
  if (!existing || existing.project_id !== projectId) return c.json({ error: 'Form not found' }, 404);

  await db.deleteForm(formId);
  capture({ distinctId: userId, event: 'form_deleted', properties: { project_id: projectId, form_id: formId } });
  return c.json({ ok: true });
});

// Questions: bulk upsert
forms.post('/dashboard/:projectId/:formId/questions', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const formId = c.req.param('formId');
  const body = (await c.req.json()) as { questions: UpsertFormQuestionRequest[] };
  const db = getDb(c.env.DB);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const existing = await db.getFormById(formId);
  if (!existing || existing.project_id !== projectId) return c.json({ error: 'Form not found' }, 404);

  const questions = body.questions.map(q => ({
    id: q.id || crypto.randomUUID(),
    form_id: formId,
    type: q.type,
    label: q.label,
    description: q.description || null,
    required: !!q.required,
    options: q.options || {},
    order_index: q.order_index,
  }));

  const result = await db.upsertFormQuestions(formId, questions);
  return c.json({ data: result });
});

// Responses
forms.get('/dashboard/:projectId/:formId/responses', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const formId = c.req.param('formId');
  const page = parseInt(c.req.query('page') || '1', 10);
  const db = getDb(c.env.DB);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const existing = await db.getFormById(formId);
  if (!existing || existing.project_id !== projectId) return c.json({ error: 'Form not found' }, 404);

  const result = await db.listFormResponses(formId, page, PAGE_SIZE);
  return c.json({ ...result, page, limit: PAGE_SIZE });
});

// --- Public Routes (API Key Auth) ---

// Get published form by slug
forms.get('/by-slug/:slug', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const slug = c.req.param('slug');
  const db = getDb(c.env.DB);

  const form = await db.getFormBySlug(projectId, slug);
  if (!form || form.status !== 'published') return c.json({ error: 'Form not found' }, 404);

  const questions = await db.listFormQuestions(form.id);
  return c.json({ data: { ...form, questions } });
});

// Submit response
forms.post('/:formId/submit', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const formId = c.req.param('formId');
  const body = (await c.req.json()) as SubmitFormResponseRequest;
  const db = getDb(c.env.DB);

  const form = await db.getFormById(formId);
  if (!form || form.project_id !== projectId) return c.json({ error: 'Form not found' }, 404);
  if (form.status !== 'published') return c.json({ error: 'Form is not accepting responses' }, 403);

  const response = await db.createFormResponse({
    id: crypto.randomUUID(),
    form_id: formId,
  });

  const answers = body.answers.map(a => ({
    id: crypto.randomUUID(),
    response_id: response.id,
    question_id: a.question_id,
    value: a.value,
  }));

  await db.createFormAnswers(answers);
  
  capture({ distinctId: 'anonymous', event: 'form_response_submitted', properties: { project_id: projectId, form_id: formId, response_id: response.id } });
  
  return c.json({ id: response.id, ok: true }, 201);
});

export { forms };
