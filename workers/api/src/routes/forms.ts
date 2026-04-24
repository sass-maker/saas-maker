import { Hono } from 'hono';
import { Bindings, Variables } from '../types';
import { requireApiKey, requireSession } from '../middleware/auth';
import { ipRateLimitDynamic } from '../middleware/ip-rate-limit';
import { getDb } from '../db';
import type {
  CreateFormRequest,
  UpdateFormRequest,
  UpsertFormQuestionRequest,
  SubmitFormResponseRequest,
  FormQuestionType,
  FormAnalyticsQuestion,
} from '@saas-maker/shared-types';

const forms = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const PAGE_SIZE = 50;

const VALID_STATUSES = ['draft', 'published', 'closed'] as const;

const VALID_QUESTION_TYPES: FormQuestionType[] = [
  'short_text',
  'long_text',
  'multiple_choice',
  'checkboxes',
  'dropdown',
  'yes_no',
  'rating',
  'nps',
  'opinion_scale',
  'email',
  'number',
  'date',
  'phone',
  'url',
  'file_upload',
];

const CHOICE_TYPES: FormQuestionType[] = ['multiple_choice', 'checkboxes', 'dropdown', 'yes_no'];
const NUMERIC_TYPES: FormQuestionType[] = ['rating', 'nps', 'opinion_scale', 'number'];

// ─── Public: API key auth ────────────────────────────────────────────

// GET /by-slug/:slug — get published form + questions
forms.get('/by-slug/:slug', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const slug = c.req.param('slug');

  const db = getDb(c.env.DB);
  const form = await db.getFormBySlug(projectId, slug);
  if (!form || form.status !== 'published') return c.json({ error: 'Form not found' }, 404);

  const questions = await db.listFormQuestions(form.id);
  return c.json({ data: { ...form, questions } });
});

// POST /:formId/submit — submit response with answers
forms.post('/:formId/submit', requireApiKey, async (c) => {
  const formId = c.req.param('formId');
  const body = (await c.req.json()) as SubmitFormResponseRequest;

  if (!body.answers || !Array.isArray(body.answers) || body.answers.length === 0) {
    return c.json({ error: 'Answers array is required' }, 400);
  }

  const db = getDb(c.env.DB);
  const form = await db.getFormById(formId);
  if (!form || form.status !== 'published') return c.json({ error: 'Form not found or not accepting responses' }, 404);

  // Verify the form belongs to the authenticated project
  const projectId = c.get('projectId')!;
  if (form.project_id !== projectId) return c.json({ error: 'Form not found' }, 404);

  const questions = await db.listFormQuestions(formId);
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  // Validate required questions are answered
  for (const q of questions) {
    if (q.required) {
      const answer = body.answers.find((a) => a.question_id === q.id);
      if (!answer || !answer.value?.trim()) {
        return c.json({ error: `Question "${q.label}" is required` }, 400);
      }
    }
  }

  // Validate all answer question_ids exist
  for (const a of body.answers) {
    if (!questionMap.has(a.question_id)) {
      return c.json({ error: `Unknown question_id: ${a.question_id}` }, 400);
    }
  }

  const responseId = crypto.randomUUID();
  const response = await db.createFormResponse({ id: responseId, form_id: formId });

  const answers = await db.createFormAnswers(
    body.answers.map((a) => ({
      id: crypto.randomUUID(),
      response_id: responseId,
      question_id: a.question_id,
      value: a.value,
    }))
  );

  return c.json({ data: { ...response, answers } }, 201);
});

// ─── Public: no auth (hosted survey page) ────────────────────────────

// GET /public/:slug — get published form + questions (joins projects table)
forms.get('/public/:slug', async (c) => {
  const slug = c.req.param('slug');

  const db = getDb(c.env.DB);
  const form = await db.getPublishedFormBySlug(slug);
  if (!form) return c.json({ error: 'Form not found' }, 404);

  const questions = await db.listFormQuestions(form.id);
  // Strip project_api_key from public response
  const { project_api_key: _, ...formData } = form;
  return c.json({ data: { ...formData, questions } });
});

// POST /public/:slug/submit — submit response by slug
forms.post('/public/:slug/submit', ipRateLimitDynamic((c) => `forms:public-submit:${c.req.param('slug')}`, 10), async (c) => {
  const slug = c.req.param('slug');
  const body = (await c.req.json()) as SubmitFormResponseRequest;

  if (!body.answers || !Array.isArray(body.answers) || body.answers.length === 0) {
    return c.json({ error: 'Answers array is required' }, 400);
  }

  const db = getDb(c.env.DB);
  const form = await db.getPublishedFormBySlug(slug);
  if (!form) return c.json({ error: 'Form not found or not accepting responses' }, 404);

  const questions = await db.listFormQuestions(form.id);
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  // Validate required questions are answered
  for (const q of questions) {
    if (q.required) {
      const answer = body.answers.find((a) => a.question_id === q.id);
      if (!answer || !answer.value?.trim()) {
        return c.json({ error: `Question "${q.label}" is required` }, 400);
      }
    }
  }

  // Validate all answer question_ids exist
  for (const a of body.answers) {
    if (!questionMap.has(a.question_id)) {
      return c.json({ error: `Unknown question_id: ${a.question_id}` }, 400);
    }
  }

  const responseId = crypto.randomUUID();
  const response = await db.createFormResponse({ id: responseId, form_id: form.id });

  const answers = await db.createFormAnswers(
    body.answers.map((a) => ({
      id: crypto.randomUUID(),
      response_id: responseId,
      question_id: a.question_id,
      value: a.value,
    }))
  );

  return c.json({ data: { ...response, answers } }, 201);
});

// ─── Dashboard: session auth ─────────────────────────────────────────

// GET /dashboard/:projectId — list forms (paginated)
forms.get('/dashboard/:projectId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const page = parseInt(c.req.query('page') || '1', 10);

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const result = await db.listForms(projectId, page, PAGE_SIZE);
  const stats = await db.getFormStats(projectId);
  return c.json({ data: result.data, total: result.total, page, limit: PAGE_SIZE, stats });
});

// GET /dashboard/:projectId/check-slug/:slug — check slug availability
forms.get('/dashboard/:projectId/check-slug/:slug', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const slug = c.req.param('slug');

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const existing = await db.getFormBySlug(projectId, slug);
  return c.json({ available: !existing });
});

// POST /dashboard/:projectId — create form (accepts optional questions array)
forms.post('/dashboard/:projectId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const body = (await c.req.json()) as CreateFormRequest & { questions?: UpsertFormQuestionRequest[] };

  if (!body.title?.trim()) return c.json({ error: 'Title is required' }, 400);
  if (!body.slug?.trim()) return c.json({ error: 'Slug is required' }, 400);

  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return c.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, 400);
  }

  // Check slug uniqueness within project
  const existing = await db.getFormBySlug(projectId, body.slug.trim());
  if (existing) return c.json({ error: 'A form with this slug already exists' }, 409);

  const form = await db.createForm({
    id: crypto.randomUUID(),
    project_id: projectId,
    title: body.title.trim(),
    slug: body.slug.trim(),
    description: body.description?.trim() || null,
    status: body.status || 'draft',
    theme: body.theme || {},
    settings: body.settings || {},
  });

  // Inline question creation
  let questions: unknown[] = [];
  if (body.questions && Array.isArray(body.questions) && body.questions.length > 0) {
    // Validate question types
    for (const q of body.questions) {
      if (!q.label?.trim()) return c.json({ error: 'Question label is required' }, 400);
      if (!VALID_QUESTION_TYPES.includes(q.type)) {
        return c.json({ error: `Invalid question type: ${q.type}` }, 400);
      }
    }

    questions = await db.upsertFormQuestions(
      form.id,
      body.questions.map((q, i) => ({
        id: q.id || crypto.randomUUID(),
        type: q.type,
        label: q.label.trim(),
        description: q.description?.trim() || null,
        required: q.required ?? false,
        options: q.options || {},
        order_index: q.order_index ?? i,
      }))
    );
  }

  return c.json({ data: { ...form, questions } }, 201);
});

// GET /dashboard/:projectId/:formId — get form + questions
forms.get('/dashboard/:projectId/:formId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const formId = c.req.param('formId');

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const form = await db.getFormById(formId);
  if (!form || form.project_id !== projectId) return c.json({ error: 'Not found' }, 404);

  const questions = await db.listFormQuestions(formId);
  const responseCount = await db.getFormResponseCount(formId);

  return c.json({ data: { ...form, questions, response_count: responseCount } });
});

// PATCH /dashboard/:projectId/:formId — update form
forms.patch('/dashboard/:projectId/:formId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const formId = c.req.param('formId');

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const form = await db.getFormById(formId);
  if (!form || form.project_id !== projectId) return c.json({ error: 'Not found' }, 404);

  const body = (await c.req.json()) as UpdateFormRequest;

  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return c.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, 400);
  }

  // Check slug uniqueness if changing
  if (body.slug && body.slug.trim() !== form.slug) {
    const existing = await db.getFormBySlug(projectId, body.slug.trim());
    if (existing) return c.json({ error: 'A form with this slug already exists' }, 409);
  }

  const updated = await db.updateForm(formId, {
    title: body.title?.trim(),
    slug: body.slug?.trim(),
    description: body.description?.trim(),
    status: body.status,
    theme: body.theme,
    settings: body.settings,
  });

  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json({ data: updated });
});

// DELETE /dashboard/:projectId/:formId — delete form
forms.delete('/dashboard/:projectId/:formId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const formId = c.req.param('formId');

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const form = await db.getFormById(formId);
  if (!form || form.project_id !== projectId) return c.json({ error: 'Not found' }, 404);

  const deleted = await db.deleteForm(formId);
  if (!deleted) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});

// POST /dashboard/:projectId/:formId/questions — bulk upsert/reorder questions
forms.post('/dashboard/:projectId/:formId/questions', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const formId = c.req.param('formId');

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const form = await db.getFormById(formId);
  if (!form || form.project_id !== projectId) return c.json({ error: 'Not found' }, 404);

  const body = (await c.req.json()) as { questions: UpsertFormQuestionRequest[] };

  if (!body.questions || !Array.isArray(body.questions)) {
    return c.json({ error: 'Questions array is required' }, 400);
  }

  // Validate question types and labels
  for (const q of body.questions) {
    if (!q.label?.trim()) return c.json({ error: 'Question label is required' }, 400);
    if (!VALID_QUESTION_TYPES.includes(q.type)) {
      return c.json({ error: `Invalid question type: ${q.type}` }, 400);
    }
  }

  const questions = await db.upsertFormQuestions(
    formId,
    body.questions.map((q, i) => ({
      id: q.id || crypto.randomUUID(),
      type: q.type,
      label: q.label.trim(),
      description: q.description?.trim() || null,
      required: q.required ?? false,
      options: q.options || {},
      order_index: q.order_index ?? i,
    }))
  );

  return c.json({ data: questions });
});

// PATCH /dashboard/:projectId/:formId/questions/:questionId — update question
forms.patch('/dashboard/:projectId/:formId/questions/:questionId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const formId = c.req.param('formId');
  const questionId = c.req.param('questionId');

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const form = await db.getFormById(formId);
  if (!form || form.project_id !== projectId) return c.json({ error: 'Form not found' }, 404);

  const body = await c.req.json();

  if (body.type && !VALID_QUESTION_TYPES.includes(body.type)) {
    return c.json({ error: `Invalid question type: ${body.type}` }, 400);
  }

  const updated = await db.updateFormQuestion(questionId, {
    type: body.type,
    label: body.label?.trim(),
    description: body.description?.trim(),
    required: body.required,
    options: body.options,
    order_index: body.order_index,
  });

  if (!updated) return c.json({ error: 'Question not found' }, 404);
  return c.json({ data: updated });
});

// DELETE /dashboard/:projectId/:formId/questions/:questionId — delete question
forms.delete('/dashboard/:projectId/:formId/questions/:questionId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const formId = c.req.param('formId');
  const questionId = c.req.param('questionId');

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const form = await db.getFormById(formId);
  if (!form || form.project_id !== projectId) return c.json({ error: 'Form not found' }, 404);

  const deleted = await db.deleteFormQuestion(questionId);
  if (!deleted) return c.json({ error: 'Question not found' }, 404);
  return c.json({ ok: true });
});

// GET /dashboard/:projectId/:formId/responses — list responses (paginated)
forms.get('/dashboard/:projectId/:formId/responses', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const formId = c.req.param('formId');
  const page = parseInt(c.req.query('page') || '1', 10);

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const form = await db.getFormById(formId);
  if (!form || form.project_id !== projectId) return c.json({ error: 'Not found' }, 404);

  const result = await db.listFormResponses(formId, page, PAGE_SIZE);
  return c.json({ data: result.data, total: result.total, page, limit: PAGE_SIZE });
});

// DELETE /dashboard/:projectId/:formId/responses/:responseId — delete response
forms.delete('/dashboard/:projectId/:formId/responses/:responseId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const formId = c.req.param('formId');
  const responseId = c.req.param('responseId');

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const form = await db.getFormById(formId);
  if (!form || form.project_id !== projectId) return c.json({ error: 'Form not found' }, 404);

  const deleted = await db.deleteFormResponse(responseId);
  if (!deleted) return c.json({ error: 'Response not found' }, 404);
  return c.json({ ok: true });
});

// GET /dashboard/:projectId/:formId/analytics — per-question analytics
forms.get('/dashboard/:projectId/:formId/analytics', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const formId = c.req.param('formId');

  const db = getDb(c.env.DB);
  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) return c.json({ error: 'Forbidden' }, 403);

  const form = await db.getFormById(formId);
  if (!form || form.project_id !== projectId) return c.json({ error: 'Not found' }, 404);

  const questions = await db.listFormQuestions(formId);
  const totalResponses = await db.getFormResponseCount(formId);

  const analyticsQuestions: FormAnalyticsQuestion[] = [];

  for (const q of questions) {
    const answers = await db.getFormAnswersByQuestionId(q.id);
    const nonEmptyAnswers = answers.filter((a) => a.value !== null && a.value !== '');

    let summary: Record<string, unknown> = {};

    if (CHOICE_TYPES.includes(q.type)) {
      // Answer distribution counts
      const distribution: Record<string, number> = {};
      for (const a of nonEmptyAnswers) {
        const val = a.value || '';
        // Checkboxes may store comma-separated values
        if (q.type === 'checkboxes') {
          const vals = val.split(',').map((v) => v.trim());
          for (const v of vals) {
            if (v) distribution[v] = (distribution[v] || 0) + 1;
          }
        } else {
          distribution[val] = (distribution[val] || 0) + 1;
        }
      }
      summary = { distribution };
    } else if (NUMERIC_TYPES.includes(q.type)) {
      // Average + distribution
      const numericValues = nonEmptyAnswers
        .map((a) => parseFloat(a.value || ''))
        .filter((v) => !isNaN(v));

      const average =
        numericValues.length > 0
          ? numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length
          : 0;

      const distribution: Record<string, number> = {};
      for (const v of numericValues) {
        const key = String(v);
        distribution[key] = (distribution[key] || 0) + 1;
      }

      summary = {
        average: Math.round(average * 100) / 100,
        distribution,
      };
    } else {
      // Text types: list of latest 10 answers
      const latestAnswers = nonEmptyAnswers
        .slice(-10)
        .reverse()
        .map((a) => a.value);
      summary = { latest_answers: latestAnswers };
    }

    analyticsQuestions.push({
      question_id: q.id,
      label: q.label,
      type: q.type,
      total_answers: nonEmptyAnswers.length,
      summary,
    });
  }

  return c.json({
    data: {
      form_id: formId,
      total_responses: totalResponses,
      questions: analyticsQuestions,
    },
  });
});

export { forms };
