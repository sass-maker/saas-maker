import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from './helpers';

// ─── Mock DB layer ─────────────────────────────────────────────────────────
const mockDb: Record<string, ReturnType<typeof vi.fn>> = {
  getProjectByApiKey: vi.fn(),
  getCliTokenUser: vi.fn(),
  getProjectById: vi.fn(),
  getFormBySlug: vi.fn(),
  getFormById: vi.fn(),
  getPublishedFormBySlug: vi.fn(),
  listFormQuestions: vi.fn(),
  createFormResponse: vi.fn(),
  createFormAnswers: vi.fn(),
  listForms: vi.fn(),
  getFormStats: vi.fn(),
  createForm: vi.fn(),
  upsertFormQuestions: vi.fn(),
  updateForm: vi.fn(),
  deleteForm: vi.fn(),
  getFormResponseCount: vi.fn(),
  updateFormQuestion: vi.fn(),
  deleteFormQuestion: vi.fn(),
  listFormResponses: vi.fn(),
  deleteFormResponse: vi.fn(),
  getFormAnswersByQuestionId: vi.fn(),
};

vi.mock('../../workers/api/src/db', () => ({
  getDb: () => mockDb,
  createDatabase: () => mockDb,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const API_KEY = 'test-api-key-123';
const CLI_TOKEN = 'sm_test_token_abc';
const USER_ID = 'user-1';
const PROJECT_ID = 'proj-1';
const FORM_ID = 'form-1';
const QUESTION_ID = 'q-1';
const RESPONSE_ID = 'resp-1';

function apiKeyHeaders(extra: Record<string, string> = {}) {
  return { 'X-Project-Key': API_KEY, 'Content-Type': 'application/json', ...extra };
}

function sessionHeaders(extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${CLI_TOKEN}`, 'Content-Type': 'application/json', ...extra };
}

/** Set up mocks so requireApiKey middleware passes */
function setupApiKeyAuth() {
  mockDb.getProjectByApiKey.mockResolvedValue({ id: PROJECT_ID, name: 'Test', api_key: API_KEY, owner_id: USER_ID });
}

/** Set up mocks so requireSession middleware passes (CLI token path) */
function setupSessionAuth() {
  mockDb.getCliTokenUser.mockResolvedValue({ user_id: USER_ID });
}

/** Set up mocks so project ownership check passes */
function setupProjectOwnership() {
  mockDb.getProjectById.mockResolvedValue({ id: PROJECT_ID, owner_id: USER_ID, name: 'Test' });
}

const sampleForm = {
  id: FORM_ID,
  project_id: PROJECT_ID,
  title: 'Customer Survey',
  slug: 'customer-survey',
  description: 'A survey',
  status: 'published',
  theme: {},
  settings: {},
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

const sampleQuestion = {
  id: QUESTION_ID,
  form_id: FORM_ID,
  type: 'short_text',
  label: 'Your name',
  description: null,
  required: true,
  options: {},
  order_index: 0,
};

// ─── Reset ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  Object.values(mockDb).forEach((fn) => fn.mockReset());
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. GET /v1/forms/by-slug/:slug (requireApiKey)
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/forms/by-slug/:slug', () => {
  it('returns 401 without X-Project-Key', async () => {
    const res = await request('/v1/forms/by-slug/my-form');
    expect(res.status).toBe(401);
  });

  it('returns 404 when form not found', async () => {
    setupApiKeyAuth();
    mockDb.getFormBySlug.mockResolvedValue(null);

    const res = await request('/v1/forms/by-slug/missing', { headers: apiKeyHeaders() });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it('returns 404 when form is not published', async () => {
    setupApiKeyAuth();
    mockDb.getFormBySlug.mockResolvedValue({ ...sampleForm, status: 'draft' });

    const res = await request('/v1/forms/by-slug/customer-survey', { headers: apiKeyHeaders() });
    expect(res.status).toBe(404);
  });

  it('returns form with questions when published', async () => {
    setupApiKeyAuth();
    mockDb.getFormBySlug.mockResolvedValue(sampleForm);
    mockDb.listFormQuestions.mockResolvedValue([sampleQuestion]);

    const res = await request('/v1/forms/by-slug/customer-survey', { headers: apiKeyHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.title).toBe('Customer Survey');
    expect(body.data.questions).toHaveLength(1);
    expect(body.data.questions[0].label).toBe('Your name');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. POST /v1/forms/:formId/submit (requireApiKey)
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /v1/forms/:formId/submit', () => {
  it('returns 401 without X-Project-Key', async () => {
    const res = await request(`/v1/forms/${FORM_ID}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: [{ question_id: 'q-1', value: 'hi' }] }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 when answers is missing', async () => {
    setupApiKeyAuth();
    const res = await request(`/v1/forms/${FORM_ID}/submit`, {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/answers/i);
  });

  it('returns 400 when answers is empty array', async () => {
    setupApiKeyAuth();
    const res = await request(`/v1/forms/${FORM_ID}/submit`, {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({ answers: [] }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 when form not found', async () => {
    setupApiKeyAuth();
    mockDb.getFormById.mockResolvedValue(null);

    const res = await request(`/v1/forms/${FORM_ID}/submit`, {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({ answers: [{ question_id: 'q-1', value: 'hi' }] }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 404 when form is not published', async () => {
    setupApiKeyAuth();
    mockDb.getFormById.mockResolvedValue({ ...sampleForm, status: 'draft' });

    const res = await request(`/v1/forms/${FORM_ID}/submit`, {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({ answers: [{ question_id: 'q-1', value: 'hi' }] }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 404 when form belongs to a different project', async () => {
    setupApiKeyAuth();
    mockDb.getFormById.mockResolvedValue({ ...sampleForm, project_id: 'other-project' });

    const res = await request(`/v1/forms/${FORM_ID}/submit`, {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({ answers: [{ question_id: 'q-1', value: 'hi' }] }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 400 when required question is missing an answer', async () => {
    setupApiKeyAuth();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    mockDb.listFormQuestions.mockResolvedValue([sampleQuestion]);

    const res = await request(`/v1/forms/${FORM_ID}/submit`, {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({ answers: [{ question_id: 'other-q', value: 'hi' }] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it('returns 400 when required question answer is whitespace-only', async () => {
    setupApiKeyAuth();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    mockDb.listFormQuestions.mockResolvedValue([sampleQuestion]);

    const res = await request(`/v1/forms/${FORM_ID}/submit`, {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({ answers: [{ question_id: QUESTION_ID, value: '   ' }] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it('returns 400 when answer references unknown question_id', async () => {
    setupApiKeyAuth();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    mockDb.listFormQuestions.mockResolvedValue([{ ...sampleQuestion, required: false }]);

    const res = await request(`/v1/forms/${FORM_ID}/submit`, {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({ answers: [{ question_id: 'nonexistent', value: 'hi' }] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/unknown question_id/i);
  });

  it('returns 201 on successful submission', async () => {
    setupApiKeyAuth();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    mockDb.listFormQuestions.mockResolvedValue([sampleQuestion]);
    mockDb.createFormResponse.mockResolvedValue({ id: 'resp-new', form_id: FORM_ID, submitted_at: '2026-01-01' });
    mockDb.createFormAnswers.mockResolvedValue([{ id: 'ans-1', response_id: 'resp-new', question_id: QUESTION_ID, value: 'Alice' }]);

    const res = await request(`/v1/forms/${FORM_ID}/submit`, {
      method: 'POST',
      headers: apiKeyHeaders(),
      body: JSON.stringify({ answers: [{ question_id: QUESTION_ID, value: 'Alice' }] }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.form_id).toBe(FORM_ID);
    expect(body.data.answers).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. GET /v1/forms/public/:slug (no auth)
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/forms/public/:slug', () => {
  it('returns 404 when form not found', async () => {
    mockDb.getPublishedFormBySlug.mockResolvedValue(null);

    const res = await request('/v1/forms/public/missing');
    expect(res.status).toBe(404);
  });

  it('returns form without project_api_key', async () => {
    mockDb.getPublishedFormBySlug.mockResolvedValue({ ...sampleForm, project_api_key: 'secret-key-123' });
    mockDb.listFormQuestions.mockResolvedValue([sampleQuestion]);

    const res = await request('/v1/forms/public/customer-survey');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.title).toBe('Customer Survey');
    expect(body.data.questions).toHaveLength(1);
    expect(body.data.project_api_key).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. POST /v1/forms/public/:slug/submit (no auth)
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /v1/forms/public/:slug/submit', () => {
  it('returns 400 when answers is missing', async () => {
    const res = await request('/v1/forms/public/customer-survey/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when answers is empty array', async () => {
    const res = await request('/v1/forms/public/customer-survey/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: [] }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 when form not found', async () => {
    mockDb.getPublishedFormBySlug.mockResolvedValue(null);

    const res = await request('/v1/forms/public/missing/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: [{ question_id: 'q-1', value: 'hi' }] }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 400 when required question missing answer', async () => {
    mockDb.getPublishedFormBySlug.mockResolvedValue({ ...sampleForm, project_api_key: 'key' });
    mockDb.listFormQuestions.mockResolvedValue([sampleQuestion]);

    const res = await request('/v1/forms/public/customer-survey/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: [{ question_id: 'wrong-q', value: 'hi' }] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it('returns 400 when answer references unknown question_id', async () => {
    mockDb.getPublishedFormBySlug.mockResolvedValue({ ...sampleForm, project_api_key: 'key' });
    mockDb.listFormQuestions.mockResolvedValue([{ ...sampleQuestion, required: false }]);

    const res = await request('/v1/forms/public/customer-survey/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: [{ question_id: 'nonexistent', value: 'hi' }] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/unknown question_id/i);
  });

  it('returns 201 on successful public submission', async () => {
    mockDb.getPublishedFormBySlug.mockResolvedValue({ ...sampleForm, project_api_key: 'key' });
    mockDb.listFormQuestions.mockResolvedValue([sampleQuestion]);
    mockDb.createFormResponse.mockResolvedValue({ id: 'resp-new', form_id: FORM_ID, submitted_at: '2026-01-01' });
    mockDb.createFormAnswers.mockResolvedValue([{ id: 'ans-1', response_id: 'resp-new', question_id: QUESTION_ID, value: 'Alice' }]);

    const res = await request('/v1/forms/public/customer-survey/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: [{ question_id: QUESTION_ID, value: 'Alice' }] }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.answers).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. GET /v1/forms/dashboard/:projectId (requireSession)
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/forms/dashboard/:projectId', () => {
  it('returns 401 without auth', async () => {
    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}`);
    expect(res.status).toBe(401);
  });

  it('returns 403 when user does not own the project', async () => {
    setupSessionAuth();
    mockDb.getProjectById.mockResolvedValue({ id: PROJECT_ID, owner_id: 'other-user' });

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}`, { headers: sessionHeaders() });
    expect(res.status).toBe(403);
  });

  it('returns 403 when project not found', async () => {
    setupSessionAuth();
    mockDb.getProjectById.mockResolvedValue(null);

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}`, { headers: sessionHeaders() });
    expect(res.status).toBe(403);
  });

  it('returns paginated forms with stats', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.listForms.mockResolvedValue({ data: [sampleForm], total: 1 });
    mockDb.getFormStats.mockResolvedValue({ total_forms: 1, total_responses: 5 });

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}`, { headers: sessionHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(50);
    expect(body.stats.total_forms).toBe(1);
    expect(body.stats.total_responses).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. POST /v1/forms/dashboard/:projectId (requireSession)
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /v1/forms/dashboard/:projectId', () => {
  it('returns 401 without auth', async () => {
    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', slug: 'test' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 when user does not own project', async () => {
    setupSessionAuth();
    mockDb.getProjectById.mockResolvedValue({ id: PROJECT_ID, owner_id: 'other-user' });

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}`, {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify({ title: 'Test', slug: 'test' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 when title is missing', async () => {
    setupSessionAuth();
    setupProjectOwnership();

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}`, {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify({ slug: 'test' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/title/i);
  });

  it('returns 400 when slug is missing', async () => {
    setupSessionAuth();
    setupProjectOwnership();

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}`, {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify({ title: 'Test' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/slug/i);
  });

  it('returns 400 when status is invalid', async () => {
    setupSessionAuth();
    setupProjectOwnership();

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}`, {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify({ title: 'Test', slug: 'test', status: 'invalid_status' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/status/i);
  });

  it('returns 409 when slug already exists', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormBySlug.mockResolvedValue(sampleForm);

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}`, {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify({ title: 'Test', slug: 'customer-survey' }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/slug already exists/i);
  });

  it('returns 201 when creating a form without questions', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormBySlug.mockResolvedValue(null);
    mockDb.createForm.mockResolvedValue(sampleForm);

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}`, {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify({ title: 'Customer Survey', slug: 'customer-survey' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.title).toBe('Customer Survey');
    expect(body.data.questions).toEqual([]);
  });

  it('returns 201 when creating a form with inline questions', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormBySlug.mockResolvedValue(null);
    mockDb.createForm.mockResolvedValue(sampleForm);
    mockDb.upsertFormQuestions.mockResolvedValue([sampleQuestion]);

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}`, {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify({
        title: 'Customer Survey',
        slug: 'customer-survey',
        questions: [{ type: 'short_text', label: 'Your name' }],
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.questions).toHaveLength(1);
  });

  it('returns 400 when inline question has invalid type', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormBySlug.mockResolvedValue(null);
    mockDb.createForm.mockResolvedValue(sampleForm);

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}`, {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify({
        title: 'Test',
        slug: 'test',
        questions: [{ type: 'invalid_type', label: 'Q1' }],
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid question type/i);
  });

  it('returns 400 when inline question has empty label', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormBySlug.mockResolvedValue(null);
    mockDb.createForm.mockResolvedValue(sampleForm);

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}`, {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify({
        title: 'Test',
        slug: 'test',
        questions: [{ type: 'short_text', label: '' }],
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/label/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. GET /v1/forms/dashboard/:projectId/:formId (requireSession)
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/forms/dashboard/:projectId/:formId', () => {
  it('returns 401 without auth', async () => {
    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}`);
    expect(res.status).toBe(401);
  });

  it('returns 403 when user does not own project', async () => {
    setupSessionAuth();
    mockDb.getProjectById.mockResolvedValue({ id: PROJECT_ID, owner_id: 'other-user' });

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}`, { headers: sessionHeaders() });
    expect(res.status).toBe(403);
  });

  it('returns 404 when form not found', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(null);

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}`, { headers: sessionHeaders() });
    expect(res.status).toBe(404);
  });

  it('returns 404 when form belongs to different project', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue({ ...sampleForm, project_id: 'other-proj' });

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}`, { headers: sessionHeaders() });
    expect(res.status).toBe(404);
  });

  it('returns form with questions and response_count', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    mockDb.listFormQuestions.mockResolvedValue([sampleQuestion]);
    mockDb.getFormResponseCount.mockResolvedValue(42);

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}`, { headers: sessionHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.title).toBe('Customer Survey');
    expect(body.data.questions).toHaveLength(1);
    expect(body.data.response_count).toBe(42);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. PATCH /v1/forms/dashboard/:projectId/:formId (requireSession)
// ═══════════════════════════════════════════════════════════════════════════

describe('PATCH /v1/forms/dashboard/:projectId/:formId', () => {
  it('returns 401 without auth', async () => {
    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 when user does not own project', async () => {
    setupSessionAuth();
    mockDb.getProjectById.mockResolvedValue({ id: PROJECT_ID, owner_id: 'other-user' });

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}`, {
      method: 'PATCH',
      headers: sessionHeaders(),
      body: JSON.stringify({ title: 'Updated' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 404 when form not found', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(null);

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}`, {
      method: 'PATCH',
      headers: sessionHeaders(),
      body: JSON.stringify({ title: 'Updated' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 400 when status is invalid', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}`, {
      method: 'PATCH',
      headers: sessionHeaders(),
      body: JSON.stringify({ status: 'bogus' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/status/i);
  });

  it('returns 409 when changing slug to one that already exists', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    mockDb.getFormBySlug.mockResolvedValue({ ...sampleForm, id: 'other-form', slug: 'taken-slug' });

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}`, {
      method: 'PATCH',
      headers: sessionHeaders(),
      body: JSON.stringify({ slug: 'taken-slug' }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/slug already exists/i);
  });

  it('does not check slug uniqueness when slug is unchanged', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    mockDb.updateForm.mockResolvedValue({ ...sampleForm, title: 'Updated Title' });

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}`, {
      method: 'PATCH',
      headers: sessionHeaders(),
      body: JSON.stringify({ slug: 'customer-survey', title: 'Updated Title' }),
    });
    expect(res.status).toBe(200);
    // getFormBySlug should NOT have been called for slug uniqueness check
    expect(mockDb.getFormBySlug).not.toHaveBeenCalled();
  });

  it('returns updated form on success', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    mockDb.updateForm.mockResolvedValue({ ...sampleForm, title: 'Updated Title' });

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}`, {
      method: 'PATCH',
      headers: sessionHeaders(),
      body: JSON.stringify({ title: 'Updated Title' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.title).toBe('Updated Title');
  });

  it('returns 404 when updateForm returns null', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    mockDb.updateForm.mockResolvedValue(null);

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}`, {
      method: 'PATCH',
      headers: sessionHeaders(),
      body: JSON.stringify({ title: 'Updated' }),
    });
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. DELETE /v1/forms/dashboard/:projectId/:formId (requireSession)
// ═══════════════════════════════════════════════════════════════════════════

describe('DELETE /v1/forms/dashboard/:projectId/:formId', () => {
  it('returns 401 without auth', async () => {
    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}`, { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('returns 403 when user does not own project', async () => {
    setupSessionAuth();
    mockDb.getProjectById.mockResolvedValue({ id: PROJECT_ID, owner_id: 'other-user' });

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}`, {
      method: 'DELETE',
      headers: sessionHeaders(),
    });
    expect(res.status).toBe(403);
  });

  it('returns 404 when form not found', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(null);

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}`, {
      method: 'DELETE',
      headers: sessionHeaders(),
    });
    expect(res.status).toBe(404);
  });

  it('returns 404 when form belongs to different project', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue({ ...sampleForm, project_id: 'other-proj' });

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}`, {
      method: 'DELETE',
      headers: sessionHeaders(),
    });
    expect(res.status).toBe(404);
  });

  it('returns 404 when deleteForm returns false', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    mockDb.deleteForm.mockResolvedValue(false);

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}`, {
      method: 'DELETE',
      headers: sessionHeaders(),
    });
    expect(res.status).toBe(404);
  });

  it('returns { ok: true } on successful delete', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    mockDb.deleteForm.mockResolvedValue(true);

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}`, {
      method: 'DELETE',
      headers: sessionHeaders(),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. POST /v1/forms/dashboard/:projectId/:formId/questions (requireSession)
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /v1/forms/dashboard/:projectId/:formId/questions', () => {
  it('returns 401 without auth', async () => {
    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: [] }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 when user does not own project', async () => {
    setupSessionAuth();
    mockDb.getProjectById.mockResolvedValue({ id: PROJECT_ID, owner_id: 'other-user' });

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}/questions`, {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify({ questions: [] }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 404 when form not found', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(null);

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}/questions`, {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify({ questions: [{ type: 'short_text', label: 'Q1' }] }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 400 when questions array is missing', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}/questions`, {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/questions/i);
  });

  it('returns 400 when question has invalid type', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}/questions`, {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify({ questions: [{ type: 'bogus_type', label: 'Q1' }] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid question type/i);
  });

  it('returns 400 when question label is empty', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}/questions`, {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify({ questions: [{ type: 'short_text', label: '' }] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/label/i);
  });

  it('returns upserted questions on success', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    mockDb.upsertFormQuestions.mockResolvedValue([sampleQuestion]);

    const res = await request(`/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}/questions`, {
      method: 'POST',
      headers: sessionHeaders(),
      body: JSON.stringify({ questions: [{ type: 'short_text', label: 'Your name' }] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].label).toBe('Your name');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. PATCH /v1/forms/dashboard/:projectId/:formId/questions/:questionId
// ═══════════════════════════════════════════════════════════════════════════

describe('PATCH /v1/forms/dashboard/:projectId/:formId/questions/:questionId', () => {
  const url = `/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}/questions/${QUESTION_ID}`;

  it('returns 401 without auth', async () => {
    const res = await request(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Updated' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 when user does not own project', async () => {
    setupSessionAuth();
    mockDb.getProjectById.mockResolvedValue({ id: PROJECT_ID, owner_id: 'other-user' });

    const res = await request(url, {
      method: 'PATCH',
      headers: sessionHeaders(),
      body: JSON.stringify({ label: 'Updated' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 404 when form not found', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(null);

    const res = await request(url, {
      method: 'PATCH',
      headers: sessionHeaders(),
      body: JSON.stringify({ label: 'Updated' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 400 when question type is invalid', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);

    const res = await request(url, {
      method: 'PATCH',
      headers: sessionHeaders(),
      body: JSON.stringify({ type: 'bogus' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid question type/i);
  });

  it('returns 404 when updateFormQuestion returns null', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    mockDb.updateFormQuestion.mockResolvedValue(null);

    const res = await request(url, {
      method: 'PATCH',
      headers: sessionHeaders(),
      body: JSON.stringify({ label: 'Updated' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns updated question on success', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    mockDb.updateFormQuestion.mockResolvedValue({ ...sampleQuestion, label: 'Updated Label' });

    const res = await request(url, {
      method: 'PATCH',
      headers: sessionHeaders(),
      body: JSON.stringify({ label: 'Updated Label' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.label).toBe('Updated Label');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. DELETE /v1/forms/dashboard/:projectId/:formId/questions/:questionId
// ═══════════════════════════════════════════════════════════════════════════

describe('DELETE /v1/forms/dashboard/:projectId/:formId/questions/:questionId', () => {
  const url = `/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}/questions/${QUESTION_ID}`;

  it('returns 401 without auth', async () => {
    const res = await request(url, { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('returns 403 when user does not own project', async () => {
    setupSessionAuth();
    mockDb.getProjectById.mockResolvedValue({ id: PROJECT_ID, owner_id: 'other-user' });

    const res = await request(url, { method: 'DELETE', headers: sessionHeaders() });
    expect(res.status).toBe(403);
  });

  it('returns 404 when form not found', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(null);

    const res = await request(url, { method: 'DELETE', headers: sessionHeaders() });
    expect(res.status).toBe(404);
  });

  it('returns 404 when deleteFormQuestion returns false', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    mockDb.deleteFormQuestion.mockResolvedValue(false);

    const res = await request(url, { method: 'DELETE', headers: sessionHeaders() });
    expect(res.status).toBe(404);
  });

  it('returns { ok: true } on success', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    mockDb.deleteFormQuestion.mockResolvedValue(true);

    const res = await request(url, { method: 'DELETE', headers: sessionHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 13. GET /v1/forms/dashboard/:projectId/:formId/responses (requireSession)
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/forms/dashboard/:projectId/:formId/responses', () => {
  const url = `/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}/responses`;

  it('returns 401 without auth', async () => {
    const res = await request(url);
    expect(res.status).toBe(401);
  });

  it('returns 403 when user does not own project', async () => {
    setupSessionAuth();
    mockDb.getProjectById.mockResolvedValue({ id: PROJECT_ID, owner_id: 'other-user' });

    const res = await request(url, { headers: sessionHeaders() });
    expect(res.status).toBe(403);
  });

  it('returns 404 when form not found', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(null);

    const res = await request(url, { headers: sessionHeaders() });
    expect(res.status).toBe(404);
  });

  it('returns 404 when form belongs to different project', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue({ ...sampleForm, project_id: 'other-proj' });

    const res = await request(url, { headers: sessionHeaders() });
    expect(res.status).toBe(404);
  });

  it('returns paginated responses', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    const responseData = [{ id: RESPONSE_ID, form_id: FORM_ID, submitted_at: '2026-01-01', answers: [] }];
    mockDb.listFormResponses.mockResolvedValue({ data: responseData, total: 1 });

    const res = await request(url, { headers: sessionHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(50);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 14. DELETE /v1/forms/dashboard/:projectId/:formId/responses/:responseId
// ═══════════════════════════════════════════════════════════════════════════

describe('DELETE /v1/forms/dashboard/:projectId/:formId/responses/:responseId', () => {
  const url = `/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}/responses/${RESPONSE_ID}`;

  it('returns 401 without auth', async () => {
    const res = await request(url, { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('returns 403 when user does not own project', async () => {
    setupSessionAuth();
    mockDb.getProjectById.mockResolvedValue({ id: PROJECT_ID, owner_id: 'other-user' });

    const res = await request(url, { method: 'DELETE', headers: sessionHeaders() });
    expect(res.status).toBe(403);
  });

  it('returns 404 when form not found', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(null);

    const res = await request(url, { method: 'DELETE', headers: sessionHeaders() });
    expect(res.status).toBe(404);
  });

  it('returns 404 when deleteFormResponse returns false', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    mockDb.deleteFormResponse.mockResolvedValue(false);

    const res = await request(url, { method: 'DELETE', headers: sessionHeaders() });
    expect(res.status).toBe(404);
  });

  it('returns { ok: true } on success', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    mockDb.deleteFormResponse.mockResolvedValue(true);

    const res = await request(url, { method: 'DELETE', headers: sessionHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 15. GET /v1/forms/dashboard/:projectId/:formId/analytics (requireSession)
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /v1/forms/dashboard/:projectId/:formId/analytics', () => {
  const url = `/v1/forms/dashboard/${PROJECT_ID}/${FORM_ID}/analytics`;

  it('returns 401 without auth', async () => {
    const res = await request(url);
    expect(res.status).toBe(401);
  });

  it('returns 403 when user does not own project', async () => {
    setupSessionAuth();
    mockDb.getProjectById.mockResolvedValue({ id: PROJECT_ID, owner_id: 'other-user' });

    const res = await request(url, { headers: sessionHeaders() });
    expect(res.status).toBe(403);
  });

  it('returns 404 when form not found', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(null);

    const res = await request(url, { headers: sessionHeaders() });
    expect(res.status).toBe(404);
  });

  it('returns analytics with choice distribution for multiple_choice questions', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    const choiceQuestion = { ...sampleQuestion, id: 'q-choice', type: 'multiple_choice', label: 'Favorite color' };
    mockDb.listFormQuestions.mockResolvedValue([choiceQuestion]);
    mockDb.getFormResponseCount.mockResolvedValue(3);
    mockDb.getFormAnswersByQuestionId.mockResolvedValue([
      { id: 'a1', response_id: 'r1', question_id: 'q-choice', value: 'Red' },
      { id: 'a2', response_id: 'r2', question_id: 'q-choice', value: 'Blue' },
      { id: 'a3', response_id: 'r3', question_id: 'q-choice', value: 'Red' },
    ]);

    const res = await request(url, { headers: sessionHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.form_id).toBe(FORM_ID);
    expect(body.data.total_responses).toBe(3);
    expect(body.data.questions).toHaveLength(1);
    const q = body.data.questions[0];
    expect(q.question_id).toBe('q-choice');
    expect(q.total_answers).toBe(3);
    expect(q.summary.distribution).toEqual({ Red: 2, Blue: 1 });
  });

  it('returns analytics with checkbox answer splitting', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    const cbQuestion = { ...sampleQuestion, id: 'q-cb', type: 'checkboxes', label: 'Skills' };
    mockDb.listFormQuestions.mockResolvedValue([cbQuestion]);
    mockDb.getFormResponseCount.mockResolvedValue(2);
    mockDb.getFormAnswersByQuestionId.mockResolvedValue([
      { id: 'a1', response_id: 'r1', question_id: 'q-cb', value: 'JS, Python' },
      { id: 'a2', response_id: 'r2', question_id: 'q-cb', value: 'Python, Rust' },
    ]);

    const res = await request(url, { headers: sessionHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    const q = body.data.questions[0];
    expect(q.summary.distribution).toEqual({ JS: 1, Python: 2, Rust: 1 });
  });

  it('returns analytics with numeric averages for rating questions', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    const ratingQuestion = { ...sampleQuestion, id: 'q-rating', type: 'rating', label: 'Rate us' };
    mockDb.listFormQuestions.mockResolvedValue([ratingQuestion]);
    mockDb.getFormResponseCount.mockResolvedValue(3);
    mockDb.getFormAnswersByQuestionId.mockResolvedValue([
      { id: 'a1', response_id: 'r1', question_id: 'q-rating', value: '4' },
      { id: 'a2', response_id: 'r2', question_id: 'q-rating', value: '5' },
      { id: 'a3', response_id: 'r3', question_id: 'q-rating', value: '3' },
    ]);

    const res = await request(url, { headers: sessionHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    const q = body.data.questions[0];
    expect(q.summary.average).toBe(4);
    expect(q.summary.distribution).toEqual({ '4': 1, '5': 1, '3': 1 });
  });

  it('returns analytics with NPS numeric handling', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    const npsQuestion = { ...sampleQuestion, id: 'q-nps', type: 'nps', label: 'NPS Score' };
    mockDb.listFormQuestions.mockResolvedValue([npsQuestion]);
    mockDb.getFormResponseCount.mockResolvedValue(2);
    mockDb.getFormAnswersByQuestionId.mockResolvedValue([
      { id: 'a1', response_id: 'r1', question_id: 'q-nps', value: '9' },
      { id: 'a2', response_id: 'r2', question_id: 'q-nps', value: '7' },
    ]);

    const res = await request(url, { headers: sessionHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    const q = body.data.questions[0];
    expect(q.summary.average).toBe(8);
    expect(q.summary.distribution).toEqual({ '9': 1, '7': 1 });
  });

  it('returns analytics with text latest_answers for text questions', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    const textQuestion = { ...sampleQuestion, id: 'q-text', type: 'short_text', label: 'Comments' };
    mockDb.listFormQuestions.mockResolvedValue([textQuestion]);
    mockDb.getFormResponseCount.mockResolvedValue(2);
    mockDb.getFormAnswersByQuestionId.mockResolvedValue([
      { id: 'a1', response_id: 'r1', question_id: 'q-text', value: 'Great product' },
      { id: 'a2', response_id: 'r2', question_id: 'q-text', value: 'Needs work' },
    ]);

    const res = await request(url, { headers: sessionHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    const q = body.data.questions[0];
    expect(q.summary.latest_answers).toEqual(['Needs work', 'Great product']);
    expect(q.total_answers).toBe(2);
  });

  it('filters out empty answers from analytics', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    const textQuestion = { ...sampleQuestion, id: 'q-text', type: 'short_text', label: 'Feedback' };
    mockDb.listFormQuestions.mockResolvedValue([textQuestion]);
    mockDb.getFormResponseCount.mockResolvedValue(3);
    mockDb.getFormAnswersByQuestionId.mockResolvedValue([
      { id: 'a1', response_id: 'r1', question_id: 'q-text', value: 'Good' },
      { id: 'a2', response_id: 'r2', question_id: 'q-text', value: '' },
      { id: 'a3', response_id: 'r3', question_id: 'q-text', value: null },
    ]);

    const res = await request(url, { headers: sessionHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    const q = body.data.questions[0];
    expect(q.total_answers).toBe(1);
  });

  it('returns zero average when no numeric answers exist', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    const ratingQuestion = { ...sampleQuestion, id: 'q-rating', type: 'rating', label: 'Rate us' };
    mockDb.listFormQuestions.mockResolvedValue([ratingQuestion]);
    mockDb.getFormResponseCount.mockResolvedValue(0);
    mockDb.getFormAnswersByQuestionId.mockResolvedValue([]);

    const res = await request(url, { headers: sessionHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    const q = body.data.questions[0];
    expect(q.summary.average).toBe(0);
    expect(q.summary.distribution).toEqual({});
  });

  it('handles yes_no as a choice type with distribution', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    const ynQuestion = { ...sampleQuestion, id: 'q-yn', type: 'yes_no', label: 'Recommend?' };
    mockDb.listFormQuestions.mockResolvedValue([ynQuestion]);
    mockDb.getFormResponseCount.mockResolvedValue(3);
    mockDb.getFormAnswersByQuestionId.mockResolvedValue([
      { id: 'a1', response_id: 'r1', question_id: 'q-yn', value: 'Yes' },
      { id: 'a2', response_id: 'r2', question_id: 'q-yn', value: 'No' },
      { id: 'a3', response_id: 'r3', question_id: 'q-yn', value: 'Yes' },
    ]);

    const res = await request(url, { headers: sessionHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    const q = body.data.questions[0];
    expect(q.summary.distribution).toEqual({ Yes: 2, No: 1 });
  });

  it('handles opinion_scale as numeric type', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    const osQuestion = { ...sampleQuestion, id: 'q-os', type: 'opinion_scale', label: 'Satisfaction' };
    mockDb.listFormQuestions.mockResolvedValue([osQuestion]);
    mockDb.getFormResponseCount.mockResolvedValue(2);
    mockDb.getFormAnswersByQuestionId.mockResolvedValue([
      { id: 'a1', response_id: 'r1', question_id: 'q-os', value: '8' },
      { id: 'a2', response_id: 'r2', question_id: 'q-os', value: '6' },
    ]);

    const res = await request(url, { headers: sessionHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    const q = body.data.questions[0];
    expect(q.summary.average).toBe(7);
  });

  it('handles dropdown as choice type', async () => {
    setupSessionAuth();
    setupProjectOwnership();
    mockDb.getFormById.mockResolvedValue(sampleForm);
    const ddQuestion = { ...sampleQuestion, id: 'q-dd', type: 'dropdown', label: 'Country' };
    mockDb.listFormQuestions.mockResolvedValue([ddQuestion]);
    mockDb.getFormResponseCount.mockResolvedValue(2);
    mockDb.getFormAnswersByQuestionId.mockResolvedValue([
      { id: 'a1', response_id: 'r1', question_id: 'q-dd', value: 'US' },
      { id: 'a2', response_id: 'r2', question_id: 'q-dd', value: 'US' },
    ]);

    const res = await request(url, { headers: sessionHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json();
    const q = body.data.questions[0];
    expect(q.summary.distribution).toEqual({ US: 2 });
  });
});
