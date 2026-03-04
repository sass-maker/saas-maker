# Custom Forms / Survey Builder — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Typeform-style custom form/survey builder to SaaS Maker — users create multi-question surveys in a drag-and-drop builder, share via hosted page or embeddable widget, and view responses with basic analytics.

**Architecture:** Fully normalized schema (forms, form_questions, form_responses, form_answers tables). API routes on Cloudflare Workers/Hono following existing patterns. Dashboard pages in Next.js 15. Embeddable React widget package. SDK service class.

**Tech Stack:** CockroachDB, Hono, Next.js 15, React, tsup, Astro Starlight docs

---

### Task 1: Shared Types

**Files:**
- Modify: `packages/shared-types/src/index.ts`

**Step 1: Add form types to shared-types**

Add at the end of the file, before any final exports:

```typescript
// --- Forms / Surveys ---

export type FormQuestionType =
  | 'short_text'
  | 'long_text'
  | 'multiple_choice'
  | 'checkboxes'
  | 'dropdown'
  | 'yes_no'
  | 'rating'
  | 'nps'
  | 'opinion_scale'
  | 'email'
  | 'number'
  | 'date'
  | 'phone'
  | 'url'
  | 'file_upload';

export interface FormRecord {
  id: string;
  project_id: string;
  title: string;
  slug: string;
  description: string | null;
  status: 'draft' | 'published' | 'closed';
  theme: Record<string, unknown>;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FormQuestionRecord {
  id: string;
  form_id: string;
  type: FormQuestionType;
  label: string;
  description: string | null;
  required: boolean;
  options: Record<string, unknown>;
  order_index: number;
  created_at: string;
}

export interface FormResponseRecord {
  id: string;
  form_id: string;
  submitted_at: string;
  metadata: Record<string, unknown>;
}

export interface FormAnswerRecord {
  id: string;
  response_id: string;
  question_id: string;
  value: string | null;
}

export interface CreateFormRequest {
  title: string;
  slug: string;
  description?: string;
  status?: 'draft' | 'published' | 'closed';
  theme?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface UpdateFormRequest {
  title?: string;
  slug?: string;
  description?: string;
  status?: 'draft' | 'published' | 'closed';
  theme?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface UpsertFormQuestionRequest {
  id?: string;
  type: FormQuestionType;
  label: string;
  description?: string;
  required?: boolean;
  options?: Record<string, unknown>;
  order_index: number;
}

export interface SubmitFormResponseRequest {
  answers: { question_id: string; value: string }[];
  metadata?: Record<string, unknown>;
}

export interface FormAnalyticsQuestion {
  question_id: string;
  label: string;
  type: FormQuestionType;
  total_answers: number;
  summary: Record<string, unknown>;
}

export interface FormAnalyticsResponse {
  form_id: string;
  total_responses: number;
  questions: FormAnalyticsQuestion[];
}

export interface SurveyWidgetProps {
  projectId: string;
  formSlug: string;
  theme?: 'light' | 'dark' | 'auto';
  accentColor?: string;
  onComplete?: (response: FormResponseRecord) => void;
}
```

**Step 2: Verify types build**

Run: `cd /Users/sarthakagrawal/Desktop/saas-maker && pnpm --filter @saas-maker/shared-types build`
Expected: Build succeeds with no errors.

**Step 3: Commit**

```bash
git add packages/shared-types/src/index.ts
git commit -m "feat(shared-types): add form/survey type definitions"
```

---

### Task 2: Database Schema & Interface

**Files:**
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/index.ts`

**Step 1: Add table constants to schema.ts**

Add to the `TABLES` object in `packages/db/src/schema.ts`:

```typescript
forms: 'forms',
form_questions: 'form_questions',
form_responses: 'form_responses',
form_answers: 'form_answers',
```

**Step 2: Add form methods to FeedbackDatabase interface**

Add to the `FeedbackDatabase` interface in `packages/db/src/index.ts`, following the existing comment-section pattern:

```typescript
// Forms
createForm(input: {
  id: string;
  project_id: string;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  theme: Record<string, unknown>;
  settings: Record<string, unknown>;
}): Promise<FormRecord>;
getFormById(id: string): Promise<FormRecord | null>;
getFormBySlug(projectId: string, slug: string): Promise<FormRecord | null>;
getPublishedFormBySlug(slug: string): Promise<(FormRecord & { project_api_key: string }) | null>;
listForms(projectId: string, page: number, limit: number): Promise<{ data: FormRecord[]; total: number }>;
updateForm(id: string, input: Partial<{
  title: string;
  slug: string;
  description: string | null;
  status: string;
  theme: Record<string, unknown>;
  settings: Record<string, unknown>;
}>): Promise<FormRecord | null>;
deleteForm(id: string): Promise<boolean>;
getFormStats(projectId: string): Promise<{ total_forms: number; total_responses: number }>;

// Form Questions
upsertFormQuestions(formId: string, questions: Array<{
  id: string;
  type: string;
  label: string;
  description: string | null;
  required: boolean;
  options: Record<string, unknown>;
  order_index: number;
}>): Promise<FormQuestionRecord[]>;
listFormQuestions(formId: string): Promise<FormQuestionRecord[]>;
updateFormQuestion(id: string, input: Partial<{
  type: string;
  label: string;
  description: string | null;
  required: boolean;
  options: Record<string, unknown>;
  order_index: number;
}>): Promise<FormQuestionRecord | null>;
deleteFormQuestion(id: string): Promise<boolean>;

// Form Responses
createFormResponse(input: {
  id: string;
  form_id: string;
}): Promise<FormResponseRecord>;
createFormAnswers(answers: Array<{
  id: string;
  response_id: string;
  question_id: string;
  value: string | null;
}>): Promise<FormAnswerRecord[]>;
listFormResponses(formId: string, page: number, limit: number): Promise<{ data: (FormResponseRecord & { answers: FormAnswerRecord[] })[]; total: number }>;
deleteFormResponse(id: string): Promise<boolean>;
getFormResponseCount(formId: string): Promise<number>;
getFormAnswersByQuestionId(questionId: string): Promise<FormAnswerRecord[]>;
```

**Step 3: Add imports**

Add the new types to the import from `@saas-maker/shared-types` at the top of `packages/db/src/index.ts`:

```typescript
FormRecord, FormQuestionRecord, FormResponseRecord, FormAnswerRecord
```

**Step 4: Verify build**

Run: `cd /Users/sarthakagrawal/Desktop/saas-maker && pnpm --filter @saas-maker/db build`
Expected: Build succeeds (interface only, no implementations yet — may have type errors in db.ts, that's ok for now).

**Step 5: Commit**

```bash
git add packages/db/src/schema.ts packages/db/src/index.ts
git commit -m "feat(db): add forms schema constants and database interface"
```

---

### Task 3: Database Implementation

**Files:**
- Modify: `workers/api/src/db.ts`

**Step 1: Add SQL table creation**

Before implementing methods, note the SQL to create tables (run manually or via migration):

```sql
CREATE TABLE IF NOT EXISTS forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  theme JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, slug)
);

CREATE TABLE IF NOT EXISTS form_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  required BOOLEAN NOT NULL DEFAULT false,
  options JSONB DEFAULT '{}',
  order_index INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS form_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES form_questions(id) ON DELETE CASCADE,
  value TEXT
);
```

**Step 2: Implement form methods in db.ts**

Add to the `createDatabase` return object in `workers/api/src/db.ts`, following the `// --- Section ---` comment pattern:

```typescript
// --- Forms ---

async createForm(input) {
  const [row] = await sql`
    INSERT INTO forms (id, project_id, title, slug, description, status, theme, settings)
    VALUES (${input.id}, ${input.project_id}, ${input.title}, ${input.slug}, ${input.description}, ${input.status}, ${JSON.stringify(input.theme)}, ${JSON.stringify(input.settings)})
    RETURNING *
  `;
  return row as FormRecord;
},

async getFormById(id) {
  const [row] = await sql`SELECT * FROM forms WHERE id = ${id}`;
  return (row as FormRecord) || null;
},

async getFormBySlug(projectId, slug) {
  const [row] = await sql`SELECT * FROM forms WHERE project_id = ${projectId} AND slug = ${slug}`;
  return (row as FormRecord) || null;
},

async getPublishedFormBySlug(slug) {
  const [row] = await sql`
    SELECT f.*, p.api_key AS project_api_key
    FROM forms f
    JOIN projects p ON f.project_id = p.id
    WHERE f.slug = ${slug} AND f.status = 'published'
  `;
  return (row as (FormRecord & { project_api_key: string })) || null;
},

async listForms(projectId, page, limit) {
  const offset = (page - 1) * limit;
  const [countResult] = await sql`
    SELECT COUNT(*)::int AS total FROM forms WHERE project_id = ${projectId}
  `;
  const rows = await sql`
    SELECT * FROM forms WHERE project_id = ${projectId}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return { data: rows as unknown as FormRecord[], total: countResult.total };
},

async updateForm(id, input) {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (input.title !== undefined) { sets.push('title'); values.push(input.title); }
  if (input.slug !== undefined) { sets.push('slug'); values.push(input.slug); }
  if (input.description !== undefined) { sets.push('description'); values.push(input.description); }
  if (input.status !== undefined) { sets.push('status'); values.push(input.status); }
  if (input.theme !== undefined) { sets.push('theme'); values.push(JSON.stringify(input.theme)); }
  if (input.settings !== undefined) { sets.push('settings'); values.push(JSON.stringify(input.settings)); }
  if (sets.length === 0) return null;
  // Build dynamic update — use raw SQL since postgres tagged template doesn't do dynamic column lists easily
  const setClauses = sets.map((col, i) => `${col} = $${i + 2}`).join(', ');
  const result = await sql.unsafe(
    `UPDATE forms SET ${setClauses}, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return (result[0] as FormRecord) || null;
},

async deleteForm(id) {
  const result = await sql`DELETE FROM forms WHERE id = ${id}`;
  return result.count > 0;
},

async getFormStats(projectId) {
  const [result] = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM forms WHERE project_id = ${projectId}) AS total_forms,
      (SELECT COUNT(*)::int FROM form_responses fr JOIN forms f ON fr.form_id = f.id WHERE f.project_id = ${projectId}) AS total_responses
  `;
  return { total_forms: result.total_forms, total_responses: result.total_responses };
},

// --- Form Questions ---

async upsertFormQuestions(formId, questions) {
  // Delete existing questions not in the new list
  const questionIds = questions.filter(q => q.id).map(q => q.id);
  if (questionIds.length > 0) {
    await sql`DELETE FROM form_questions WHERE form_id = ${formId} AND id NOT IN ${sql(questionIds)}`;
  } else {
    await sql`DELETE FROM form_questions WHERE form_id = ${formId}`;
  }
  const results: FormQuestionRecord[] = [];
  for (const q of questions) {
    const [row] = await sql`
      INSERT INTO form_questions (id, form_id, type, label, description, required, options, order_index)
      VALUES (${q.id}, ${formId}, ${q.type}, ${q.label}, ${q.description}, ${q.required}, ${JSON.stringify(q.options)}, ${q.order_index})
      ON CONFLICT (id) DO UPDATE SET
        type = EXCLUDED.type,
        label = EXCLUDED.label,
        description = EXCLUDED.description,
        required = EXCLUDED.required,
        options = EXCLUDED.options,
        order_index = EXCLUDED.order_index
      RETURNING *
    `;
    results.push(row as FormQuestionRecord);
  }
  return results;
},

async listFormQuestions(formId) {
  const rows = await sql`SELECT * FROM form_questions WHERE form_id = ${formId} ORDER BY order_index ASC`;
  return rows as unknown as FormQuestionRecord[];
},

async updateFormQuestion(id, input) {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (input.type !== undefined) { sets.push('type'); values.push(input.type); }
  if (input.label !== undefined) { sets.push('label'); values.push(input.label); }
  if (input.description !== undefined) { sets.push('description'); values.push(input.description); }
  if (input.required !== undefined) { sets.push('required'); values.push(input.required); }
  if (input.options !== undefined) { sets.push('options'); values.push(JSON.stringify(input.options)); }
  if (input.order_index !== undefined) { sets.push('order_index'); values.push(input.order_index); }
  if (sets.length === 0) return null;
  const setClauses = sets.map((col, i) => `${col} = $${i + 2}`).join(', ');
  const result = await sql.unsafe(
    `UPDATE form_questions SET ${setClauses} WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return (result[0] as FormQuestionRecord) || null;
},

async deleteFormQuestion(id) {
  const result = await sql`DELETE FROM form_questions WHERE id = ${id}`;
  return result.count > 0;
},

// --- Form Responses ---

async createFormResponse(input) {
  const [row] = await sql`
    INSERT INTO form_responses (id, form_id)
    VALUES (${input.id}, ${input.form_id})
    RETURNING *
  `;
  return row as FormResponseRecord;
},

async createFormAnswers(answers) {
  const results: FormAnswerRecord[] = [];
  for (const a of answers) {
    const [row] = await sql`
      INSERT INTO form_answers (id, response_id, question_id, value)
      VALUES (${a.id}, ${a.response_id}, ${a.question_id}, ${a.value})
      RETURNING *
    `;
    results.push(row as FormAnswerRecord);
  }
  return results;
},

async listFormResponses(formId, page, limit) {
  const offset = (page - 1) * limit;
  const [countResult] = await sql`
    SELECT COUNT(*)::int AS total FROM form_responses WHERE form_id = ${formId}
  `;
  const responses = await sql`
    SELECT * FROM form_responses WHERE form_id = ${formId}
    ORDER BY submitted_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const data = [];
  for (const r of responses) {
    const answers = await sql`
      SELECT * FROM form_answers WHERE response_id = ${r.id}
    `;
    data.push({ ...r, answers: answers as unknown as FormAnswerRecord[] });
  }
  return { data: data as (FormResponseRecord & { answers: FormAnswerRecord[] })[], total: countResult.total };
},

async deleteFormResponse(id) {
  const result = await sql`DELETE FROM form_responses WHERE id = ${id}`;
  return result.count > 0;
},

async getFormResponseCount(formId) {
  const [result] = await sql`SELECT COUNT(*)::int AS total FROM form_responses WHERE form_id = ${formId}`;
  return result.total;
},

async getFormAnswersByQuestionId(questionId) {
  const rows = await sql`SELECT * FROM form_answers WHERE question_id = ${questionId}`;
  return rows as unknown as FormAnswerRecord[];
},
```

**Step 3: Verify build**

Run: `cd /Users/sarthakagrawal/Desktop/saas-maker && pnpm --filter api build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add workers/api/src/db.ts
git commit -m "feat(api): implement forms database methods"
```

---

### Task 4: API Routes

**Files:**
- Create: `workers/api/src/routes/forms.ts`
- Modify: `workers/api/src/index.ts`

**Step 1: Create the forms route file**

Create `workers/api/src/routes/forms.ts` following the changelog.ts pattern:

```typescript
import { Hono } from 'hono';
import { requireApiKey, requireSession } from '../middleware/auth';
import { getDb } from '../db';
import type { Bindings, Variables } from '../types';

const forms = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// --- Public routes (API key auth) ---

// Get published form by slug (for widget/embed)
forms.get('/by-slug/:slug', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const slug = c.req.param('slug');
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const form = await db.getFormBySlug(projectId, slug);
  if (!form || form.status !== 'published') {
    return c.json({ error: 'Form not found' }, 404);
  }
  const questions = await db.listFormQuestions(form.id);
  return c.json({ form, questions });
});

// Submit a response (API key auth)
forms.post('/:formId/submit', requireApiKey, async (c) => {
  const projectId = c.get('projectId')!;
  const formId = c.req.param('formId');
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

  const form = await db.getFormById(formId);
  if (!form || form.project_id !== projectId || form.status !== 'published') {
    return c.json({ error: 'Form not found or not published' }, 404);
  }

  const body = await c.req.json<{ answers: { question_id: string; value: string }[]; metadata?: Record<string, unknown> }>();
  if (!body.answers || !Array.isArray(body.answers)) {
    return c.json({ error: 'answers array is required' }, 400);
  }

  const responseId = crypto.randomUUID();
  const response = await db.createFormResponse({ id: responseId, form_id: formId });

  const answerRecords = body.answers.map((a) => ({
    id: crypto.randomUUID(),
    response_id: responseId,
    question_id: a.question_id,
    value: a.value ?? null,
  }));
  await db.createFormAnswers(answerRecords);

  return c.json({ response }, 201);
});

// --- Public form page (no auth, lookup by slug across all projects) ---
forms.get('/public/:slug', async (c) => {
  const slug = c.req.param('slug');
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const form = await db.getPublishedFormBySlug(slug);
  if (!form) {
    return c.json({ error: 'Form not found' }, 404);
  }
  const questions = await db.listFormQuestions(form.id);
  return c.json({ form, questions });
});

// Submit to public form (no API key needed, uses form slug)
forms.post('/public/:slug/submit', async (c) => {
  const slug = c.req.param('slug');
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);
  const form = await db.getPublishedFormBySlug(slug);
  if (!form) {
    return c.json({ error: 'Form not found' }, 404);
  }

  const body = await c.req.json<{ answers: { question_id: string; value: string }[] }>();
  if (!body.answers || !Array.isArray(body.answers)) {
    return c.json({ error: 'answers array is required' }, 400);
  }

  const responseId = crypto.randomUUID();
  const response = await db.createFormResponse({ id: responseId, form_id: form.id });

  const answerRecords = body.answers.map((a) => ({
    id: crypto.randomUUID(),
    response_id: responseId,
    question_id: a.question_id,
    value: a.value ?? null,
  }));
  await db.createFormAnswers(answerRecords);

  return c.json({ response }, 201);
});

// --- Dashboard routes (session auth) ---

// List all forms for a project
forms.get('/dashboard/:projectId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const result = await db.listForms(projectId, page, limit);
  return c.json(result);
});

// Create a form
forms.post('/dashboard/:projectId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json<{
    title: string;
    slug: string;
    description?: string;
    status?: string;
    theme?: Record<string, unknown>;
    settings?: Record<string, unknown>;
    questions?: Array<{
      type: string;
      label: string;
      description?: string;
      required?: boolean;
      options?: Record<string, unknown>;
      order_index: number;
    }>;
  }>();

  if (!body.title || !body.slug) {
    return c.json({ error: 'title and slug are required' }, 400);
  }

  // Check slug uniqueness
  const existing = await db.getFormBySlug(projectId, body.slug);
  if (existing) {
    return c.json({ error: 'A form with this slug already exists' }, 409);
  }

  const formId = crypto.randomUUID();
  const form = await db.createForm({
    id: formId,
    project_id: projectId,
    title: body.title,
    slug: body.slug,
    description: body.description ?? null,
    status: body.status ?? 'draft',
    theme: body.theme ?? {},
    settings: body.settings ?? {},
  });

  // If questions provided inline, create them too
  if (body.questions && body.questions.length > 0) {
    const questions = body.questions.map((q) => ({
      id: crypto.randomUUID(),
      type: q.type,
      label: q.label,
      description: q.description ?? null,
      required: q.required ?? false,
      options: q.options ?? {},
      order_index: q.order_index,
    }));
    await db.upsertFormQuestions(formId, questions);
  }

  const questions = await db.listFormQuestions(formId);
  return c.json({ form, questions }, 201);
});

// Get a single form with questions
forms.get('/dashboard/:projectId/:formId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const formId = c.req.param('formId');
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const form = await db.getFormById(formId);
  if (!form || form.project_id !== projectId) {
    return c.json({ error: 'Form not found' }, 404);
  }

  const questions = await db.listFormQuestions(formId);
  return c.json({ form, questions });
});

// Update a form
forms.patch('/dashboard/:projectId/:formId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const formId = c.req.param('formId');
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const form = await db.getFormById(formId);
  if (!form || form.project_id !== projectId) {
    return c.json({ error: 'Form not found' }, 404);
  }

  const body = await c.req.json();
  const updated = await db.updateForm(formId, body);
  return c.json({ form: updated });
});

// Delete a form
forms.delete('/dashboard/:projectId/:formId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const formId = c.req.param('formId');
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  await db.deleteForm(formId);
  return c.json({ success: true });
});

// Bulk upsert/reorder questions
forms.post('/dashboard/:projectId/:formId/questions', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const formId = c.req.param('formId');
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const form = await db.getFormById(formId);
  if (!form || form.project_id !== projectId) {
    return c.json({ error: 'Form not found' }, 404);
  }

  const body = await c.req.json<{
    questions: Array<{
      id?: string;
      type: string;
      label: string;
      description?: string;
      required?: boolean;
      options?: Record<string, unknown>;
      order_index: number;
    }>;
  }>();

  const questions = body.questions.map((q) => ({
    id: q.id || crypto.randomUUID(),
    type: q.type,
    label: q.label,
    description: q.description ?? null,
    required: q.required ?? false,
    options: q.options ?? {},
    order_index: q.order_index,
  }));

  const result = await db.upsertFormQuestions(formId, questions);
  return c.json({ questions: result });
});

// Update a single question
forms.patch('/dashboard/:projectId/:formId/questions/:questionId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const formId = c.req.param('formId');
  const questionId = c.req.param('questionId');
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json();
  const updated = await db.updateFormQuestion(questionId, body);
  if (!updated) {
    return c.json({ error: 'Question not found' }, 404);
  }
  return c.json({ question: updated });
});

// Delete a question
forms.delete('/dashboard/:projectId/:formId/questions/:questionId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const questionId = c.req.param('questionId');
  await db.deleteFormQuestion(questionId);
  return c.json({ success: true });
});

// List responses for a form
forms.get('/dashboard/:projectId/:formId/responses', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const formId = c.req.param('formId');
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const result = await db.listFormResponses(formId, page, limit);
  return c.json(result);
});

// Delete a response
forms.delete('/dashboard/:projectId/:formId/responses/:responseId', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const responseId = c.req.param('responseId');
  await db.deleteFormResponse(responseId);
  return c.json({ success: true });
});

// Analytics for a form
forms.get('/dashboard/:projectId/:formId/analytics', requireSession, async (c) => {
  const userId = c.get('userId')!;
  const projectId = c.req.param('projectId');
  const formId = c.req.param('formId');
  const db = getDb(c.env.DATABASE_URL, c.env.HYPERDRIVE);

  const project = await db.getProjectById(projectId);
  if (!project || project.owner_id !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const form = await db.getFormById(formId);
  if (!form || form.project_id !== projectId) {
    return c.json({ error: 'Form not found' }, 404);
  }

  const totalResponses = await db.getFormResponseCount(formId);
  const questions = await db.listFormQuestions(formId);

  const questionAnalytics = [];
  for (const q of questions) {
    const answers = await db.getFormAnswersByQuestionId(q.id);
    const totalAnswers = answers.length;
    let summary: Record<string, unknown> = {};

    if (['multiple_choice', 'checkboxes', 'dropdown', 'yes_no'].includes(q.type)) {
      // Count distribution
      const distribution: Record<string, number> = {};
      for (const a of answers) {
        const val = a.value || 'No answer';
        distribution[val] = (distribution[val] || 0) + 1;
      }
      summary = { distribution };
    } else if (['rating', 'nps', 'opinion_scale', 'number'].includes(q.type)) {
      // Numeric average + distribution
      const values = answers.map((a) => parseFloat(a.value || '0')).filter((v) => !isNaN(v));
      const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      const distribution: Record<string, number> = {};
      for (const v of values) {
        const key = String(v);
        distribution[key] = (distribution[key] || 0) + 1;
      }
      summary = { average: Math.round(avg * 100) / 100, distribution };
    } else {
      // Text-based: return latest answers
      summary = { latest: answers.slice(0, 10).map((a) => a.value) };
    }

    questionAnalytics.push({
      question_id: q.id,
      label: q.label,
      type: q.type,
      total_answers: totalAnswers,
      summary,
    });
  }

  return c.json({
    form_id: formId,
    total_responses: totalResponses,
    questions: questionAnalytics,
  });
});

export { forms };
```

**Step 2: Mount the route in index.ts**

In `workers/api/src/index.ts`, add:

```typescript
import { forms } from './routes/forms';
// ... after other route registrations:
app.route('/v1/forms', forms);
```

**Step 3: Verify build**

Run: `cd /Users/sarthakagrawal/Desktop/saas-maker && pnpm --filter api build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add workers/api/src/routes/forms.ts workers/api/src/index.ts
git commit -m "feat(api): add forms API routes"
```

---

### Task 5: Run SQL Migration

**Step 1: Run the CREATE TABLE statements against CockroachDB**

Use whichever method is standard for this project (direct SQL execution against the CockroachDB instance). The SQL is from Task 3, Step 1.

**Step 2: Verify tables exist**

Run a quick check: `SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'form%';`
Expected: `forms`, `form_questions`, `form_responses`, `form_answers`

**Step 3: Commit (if migration file created)**

```bash
git commit -m "feat(db): add forms tables migration"
```

---

### Task 6: Dashboard — Sidebar Navigation

**Files:**
- Modify: `apps/dashboard/src/components/sidebar-nav.tsx`

**Step 1: Add Forms to sidebar**

In `apps/dashboard/src/components/sidebar-nav.tsx`, add `ClipboardList` to the lucide import and add the Forms item to `projectNavItems`:

```typescript
// Add to lucide import:
import { ..., ClipboardList } from 'lucide-react';

// Add to projectNavItems array (before Analytics):
{ label: "Forms", href: "/forms", icon: ClipboardList },
```

**Step 2: Verify dev server**

Run: `cd /Users/sarthakagrawal/Desktop/saas-maker && pnpm --filter dashboard dev`
Expected: Forms appears in sidebar.

**Step 3: Commit**

```bash
git add apps/dashboard/src/components/sidebar-nav.tsx
git commit -m "feat(dashboard): add Forms to sidebar navigation"
```

---

### Task 7: Dashboard — Forms List Page

**Files:**
- Create: `apps/dashboard/src/app/projects/[slug]/forms/page.tsx`

**Step 1: Create the forms list page**

Follow the changelog page pattern. Server component that fetches forms and renders a grid with stats.

```typescript
import { Suspense } from "react";
import { apiFetch } from "@/lib/api";
import { getAuthenticatedProject } from "../get-project";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ClipboardList, Plus, FileText, BarChart3 } from "lucide-react";
import Link from "next/link";
import type { FormRecord } from "@saas-maker/shared-types";
import { FormActions } from "./form-actions";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function FormsPage({ params }: Props) {
  const { slug } = await params;
  const { project, token } = await getAuthenticatedProject(slug);

  let forms: FormRecord[] = [];
  let total = 0;
  let stats = { total_forms: 0, total_responses: 0 };

  try {
    const result = await apiFetch(`/v1/forms/dashboard/${project.id}`, token);
    forms = result.data;
    total = result.total;
  } catch (e) {
    // empty state
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Forms"
        description="Create and manage custom surveys and forms."
      >
        <Link href={`/projects/${slug}/forms/new`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Form
          </Button>
        </Link>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Forms" value={total} icon={ClipboardList} />
        <StatCard
          title="Published"
          value={forms.filter((f) => f.status === "published").length}
          icon={FileText}
        />
        <StatCard
          title="Total Responses"
          value={forms.reduce(() => 0, 0)}
          icon={BarChart3}
        />
      </div>

      {forms.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No forms yet"
          description="Create your first survey or form to start collecting responses."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map((form) => (
            <Card key={form.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-base">
                    <Link
                      href={`/projects/${slug}/forms/${form.id}`}
                      className="hover:underline"
                    >
                      {form.title}
                    </Link>
                  </CardTitle>
                  {form.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {form.description}
                    </p>
                  )}
                </div>
                <Badge
                  variant={
                    form.status === "published"
                      ? "default"
                      : form.status === "closed"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {form.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    /{form.slug}
                  </span>
                  <FormActions
                    formId={form.id}
                    projectId={project.id}
                    projectSlug={slug}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/app/projects/\[slug\]/forms/page.tsx
git commit -m "feat(dashboard): add forms list page"
```

---

### Task 8: Dashboard — Form Actions (Client Component)

**Files:**
- Create: `apps/dashboard/src/app/projects/[slug]/forms/form-actions.tsx`

**Step 1: Create client component for form mutations**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetchClient, getClientToken } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Trash2, ExternalLink, Copy } from "lucide-react";

interface FormActionsProps {
  formId: string;
  projectId: string;
  projectSlug: string;
}

export function FormActions({ formId, projectId, projectSlug }: FormActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this form and all its responses?")) return;
    setLoading(true);
    try {
      const token = await getClientToken();
      await apiFetchClient(
        `/v1/forms/dashboard/${projectId}/${formId}`,
        token,
        { method: "DELETE" }
      );
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function copyShareLink() {
    // The public survey URL
    const url = `${window.location.origin}/s/${projectSlug}`;
    navigator.clipboard.writeText(url);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={loading}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/projects/${projectSlug}/forms/${formId}`)}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyShareLink}>
          <Copy className="h-4 w-4 mr-2" />
          Copy Link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDelete} className="text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/app/projects/\[slug\]/forms/form-actions.tsx
git commit -m "feat(dashboard): add form actions client component"
```

---

### Task 9: Dashboard — Form Builder Page

**Files:**
- Create: `apps/dashboard/src/app/projects/[slug]/forms/[formId]/page.tsx`
- Create: `apps/dashboard/src/app/projects/[slug]/forms/[formId]/form-builder.tsx`

This is the largest task — the drag-and-drop form builder. It needs:
- Left panel: sortable question list with drag handles
- Center: question editor (type selector, label, description, required toggle, options editor for choice types)
- Right panel: live Typeform-style preview
- Top bar: title, status toggle, share URL

**Step 1: Create the server page component**

File: `apps/dashboard/src/app/projects/[slug]/forms/[formId]/page.tsx`

```typescript
import { apiFetch } from "@/lib/api";
import { getAuthenticatedProject } from "../../get-project";
import { FormBuilder } from "./form-builder";
import type { FormRecord, FormQuestionRecord } from "@saas-maker/shared-types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string; formId: string }>;
}

export default async function FormBuilderPage({ params }: Props) {
  const { slug, formId } = await params;
  const { project, token } = await getAuthenticatedProject(slug);

  let form: FormRecord | null = null;
  let questions: FormQuestionRecord[] = [];

  try {
    const result = await apiFetch(
      `/v1/forms/dashboard/${project.id}/${formId}`,
      token
    );
    form = result.form;
    questions = result.questions;
  } catch (e) {
    return <div>Form not found</div>;
  }

  return (
    <FormBuilder
      form={form!}
      initialQuestions={questions}
      projectId={project.id}
      projectSlug={slug}
    />
  );
}
```

**Step 2: Create the form builder client component**

File: `apps/dashboard/src/app/projects/[slug]/forms/[formId]/form-builder.tsx`

This is a complex client component. Key features:
- State: list of questions (add, remove, reorder, edit)
- Saves via `POST /v1/forms/dashboard/:projectId/:formId/questions` (bulk upsert)
- Auto-saves on changes (debounced)
- Question type picker with all Typeform-style types
- Options editor for choice-based types
- Live preview panel showing one-question-at-a-time view

The builder should use `@dnd-kit/core` and `@dnd-kit/sortable` for drag-and-drop (install: `pnpm --filter dashboard add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`).

This component is large — implement it as a single `"use client"` component with sub-components defined in the same file (QuestionEditor, QuestionPreview, TypePicker). The implementer should reference the Typeform question types from the design doc and build a clean, functional builder UI.

Key implementation details:
- Each question in state has: `id, type, label, description, required, options, order_index`
- "Add Question" opens a type picker grid showing all 15 question types with icons
- Clicking a question in the list selects it for editing in the center panel
- Drag handles on the left of each question in the list
- Save button calls bulk upsert API
- Status toggle (draft/published/closed) calls PATCH on the form
- Share link shown when form is published

**Step 3: Install drag-and-drop dependency**

Run: `cd /Users/sarthakagrawal/Desktop/saas-maker && pnpm --filter dashboard add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

**Step 4: Verify dev server**

Run: `pnpm --filter dashboard dev`
Expected: Form builder page renders.

**Step 5: Commit**

```bash
git add apps/dashboard/src/app/projects/\[slug\]/forms/\[formId\]/
git commit -m "feat(dashboard): add form builder page with drag-and-drop"
```

---

### Task 10: Dashboard — Create Form Page

**Files:**
- Create: `apps/dashboard/src/app/projects/[slug]/forms/new/page.tsx`

**Step 1: Create the new form page**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetchClient, getClientToken } from "@/lib/api-client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Need project context — get from URL params
import { useParams } from "next/navigation";

export default function NewFormPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-generate slug from title
  function handleTitleChange(value: string) {
    setTitle(value);
    setFormSlug(
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    );
  }

  async function handleCreate() {
    if (!title || !formSlug) return;
    setLoading(true);
    try {
      const token = await getClientToken();
      // First we need the project ID — fetch it from the project endpoint
      const projectRes = await apiFetchClient(`/v1/projects/by-slug/${slug}`, token);
      const projectId = projectRes.id;

      const result = await apiFetchClient(
        `/v1/forms/dashboard/${projectId}`,
        token,
        {
          method: "POST",
          body: JSON.stringify({ title, slug: formSlug, description: description || undefined }),
        }
      );
      router.push(`/projects/${slug}/forms/${result.form.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Form"
        description="Set up a new survey or form."
      />
      <Card className="max-w-lg">
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Customer Satisfaction Survey"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">URL Slug</Label>
            <Input
              id="slug"
              placeholder="customer-satisfaction"
              value={formSlug}
              onChange={(e) => setFormSlug(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Your form will be available at /s/{formSlug || "..."}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Help us improve our product..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Button onClick={handleCreate} disabled={loading || !title || !formSlug}>
            {loading ? "Creating..." : "Create Form"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/app/projects/\[slug\]/forms/new/
git commit -m "feat(dashboard): add create form page"
```

---

### Task 11: Dashboard — Responses & Analytics Page

**Files:**
- Create: `apps/dashboard/src/app/projects/[slug]/forms/[formId]/responses/page.tsx`

**Step 1: Create responses page with tabs for table view and analytics**

Server component that fetches responses and analytics, renders table + charts. Follow the existing analytics page pattern for chart rendering. Use tabs (Responses | Analytics).

Key sections:
- **Responses tab**: Table with columns for each question, submission time, delete button
- **Analytics tab**: Per-question cards:
  - Choice types: horizontal bar chart showing answer distribution
  - Rating/NPS/number: average value + histogram
  - Text types: list of latest 10 answers

**Step 2: Commit**

```bash
git add apps/dashboard/src/app/projects/\[slug\]/forms/\[formId\]/responses/
git commit -m "feat(dashboard): add form responses and analytics page"
```

---

### Task 12: Hosted Survey Page

**Files:**
- Create: `apps/dashboard/src/app/s/[slug]/page.tsx`
- Create: `apps/dashboard/src/app/s/[slug]/survey-renderer.tsx`

**Step 1: Create the hosted survey page**

The `/s/[slug]` route serves a full-screen, Typeform-style one-question-at-a-time survey.

Server component fetches form data via `GET /v1/forms/public/:slug`, then renders `<SurveyRenderer>`.

**Step 2: Create the survey renderer client component**

`survey-renderer.tsx` — the core Typeform-style experience:
- Full-viewport, centered layout
- Welcome screen: form title + description + "Start" button
- One question at a time with smooth slide transitions (CSS transitions or framer-motion)
- Progress bar at top
- Enter key to advance, arrow keys to navigate
- Input components per question type (text input, radio buttons, checkboxes, star rating, NPS 0-10 buttons, etc.)
- Validation (required check) before advancing
- Thank-you screen on completion
- Submits via `POST /v1/forms/public/:slug/submit`
- Responsive design (works on mobile)

**Step 3: Commit**

```bash
git add apps/dashboard/src/app/s/
git commit -m "feat(dashboard): add hosted Typeform-style survey page"
```

---

### Task 13: Survey Widget Package

**Files:**
- Create: `packages/survey-widget/package.json`
- Create: `packages/survey-widget/tsconfig.json`
- Create: `packages/survey-widget/src/index.ts`
- Create: `packages/survey-widget/src/api.ts`
- Create: `packages/survey-widget/src/SurveyWidget.tsx`

**Step 1: Scaffold the package**

`package.json` — follow `packages/testimonials-widget/package.json` pattern:
- Name: `@saas-maker/survey`
- Same build script with tsup
- Peer deps: react >=18, react-dom >=18
- Dep: `@saas-maker/shared-types: workspace:*`

`tsconfig.json` — copy from testimonials-widget.

**Step 2: Create api.ts**

Internal API client following `packages/testimonials-widget/src/api.ts` pattern:

```typescript
const DEFAULT_BASE_URL = 'https://api.sassmaker.com';

export function createApiClient(projectId: string, baseUrl = DEFAULT_BASE_URL) {
  const headers = { 'Content-Type': 'application/json', 'X-Project-Key': projectId };

  return {
    async getForm(slug: string) {
      const res = await fetch(`${baseUrl}/v1/forms/by-slug/${slug}`, { headers });
      if (!res.ok) throw new Error('Form not found');
      return res.json();
    },
    async submitResponse(formId: string, answers: { question_id: string; value: string }[]) {
      const res = await fetch(`${baseUrl}/v1/forms/${formId}/submit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error('Failed to submit');
      return res.json();
    },
  };
}
```

**Step 3: Create SurveyWidget.tsx**

Same Typeform-style renderer as the hosted page, but as an embeddable component. Accepts `SurveyWidgetProps` from shared-types.

**Step 4: Create index.ts**

```typescript
export { SurveyWidget } from './SurveyWidget';
export type { SurveyWidgetProps } from '@saas-maker/shared-types';
```

**Step 5: Add to pnpm workspace**

Verify `packages/survey-widget` is included in `pnpm-workspace.yaml` glob.

**Step 6: Build**

Run: `cd /Users/sarthakagrawal/Desktop/saas-maker && pnpm --filter @saas-maker/survey build`

**Step 7: Commit**

```bash
git add packages/survey-widget/
git commit -m "feat(survey-widget): add embeddable survey widget package"
```

---

### Task 14: SDK — Forms Service

**Files:**
- Create: `packages/sdk/src/services/forms.ts`
- Modify: `packages/sdk/src/client.ts`
- Modify: `packages/sdk/src/index.ts`

**Step 1: Create FormService**

Follow `packages/sdk/src/services/testimonials.ts` pattern:

```typescript
import { HttpClient } from '../http';

export class FormService {
  constructor(private http: HttpClient) {}

  list(options?: { page?: number; limit?: number }) {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('limit', String(options.limit));
    const qs = params.toString();
    return this.http.request('GET', `/v1/forms${qs ? `?${qs}` : ''}`);
  }

  getBySlug(slug: string) {
    return this.http.request('GET', `/v1/forms/by-slug/${slug}`);
  }

  submit(formId: string, data: { answers: { question_id: string; value: string }[] }) {
    return this.http.request('POST', `/v1/forms/${formId}/submit`, data);
  }
}
```

**Step 2: Wire into SaaSMakerClient**

In `packages/sdk/src/client.ts`, add:
```typescript
import { FormService } from './services/forms';
// In constructor:
this.forms = new FormService(http);
// In class body:
readonly forms: FormService;
```

**Step 3: Re-export from index**

In `packages/sdk/src/index.ts`, add form-related exports.

**Step 4: Build**

Run: `pnpm --filter @saas-maker/sdk build`

**Step 5: Commit**

```bash
git add packages/sdk/src/services/forms.ts packages/sdk/src/client.ts packages/sdk/src/index.ts
git commit -m "feat(sdk): add FormService to SDK"
```

---

### Task 15: Documentation

**Files:**
- Create: `apps/docs/src/content/docs/services/forms.md`
- Create: `apps/docs/src/content/docs/widgets/survey.md`
- Modify: `apps/docs/astro.config.mjs`

**Step 1: Create service docs page**

`apps/docs/src/content/docs/services/forms.md` — follow testimonials.md pattern:

- Title: Forms & Surveys
- Overview of the feature
- Question types table
- API endpoints with curl examples:
  - `POST /v1/forms/dashboard/:projectId` — create form (with inline questions example)
  - `GET /v1/forms/by-slug/:slug` — get published form
  - `POST /v1/forms/:formId/submit` — submit response
  - `GET /v1/forms/dashboard/:projectId/:formId/responses` — list responses
  - `GET /v1/forms/dashboard/:projectId/:formId/analytics` — analytics
- SDK usage examples

**Step 2: Create widget docs page**

`apps/docs/src/content/docs/widgets/survey.md`:
- Installation: `npm install @saas-maker/survey`
- Usage: `<SurveyWidget projectId="pk_..." formSlug="my-survey" />`
- Props table
- Theming

**Step 3: Add to sidebar in astro.config.mjs**

Add under Services group:
```js
{ label: 'Forms & Surveys', slug: 'services/forms' },
```

Add under Widgets group:
```js
{ label: 'Survey Widget', slug: 'widgets/survey' },
```

**Step 4: Regenerate llms.txt**

Run: `cd /Users/sarthakagrawal/Desktop/saas-maker && node apps/docs/scripts/generate-llms-txt.mjs`

**Step 5: Build docs**

Run: `pnpm --filter docs build`

**Step 6: Commit**

```bash
git add apps/docs/
git commit -m "docs: add forms & survey documentation"
```

---

### Task 16: Final Verification

**Step 1: Full monorepo build**

Run: `cd /Users/sarthakagrawal/Desktop/saas-maker && pnpm build`
Expected: All packages and apps build successfully.

**Step 2: Type check**

Run: `pnpm --filter api tsc --noEmit && pnpm --filter dashboard tsc --noEmit`
Expected: No type errors.

**Step 3: Manual testing checklist**

- [ ] Create a form via dashboard
- [ ] Add questions of different types via builder
- [ ] Drag to reorder questions
- [ ] Publish form
- [ ] Open hosted survey page (/s/slug)
- [ ] Submit a response
- [ ] View responses in dashboard
- [ ] View analytics in dashboard
- [ ] Test widget embed

**Step 4: Commit any fixes**

```bash
git commit -m "fix: address issues found during forms verification"
```
