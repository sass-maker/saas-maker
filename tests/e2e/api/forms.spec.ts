import { test, expect } from '@playwright/test';
import { API_BASE, PROJECT_ID, authHeaders, uniqueSlug } from '../helpers';

test.describe('Forms CRUD', () => {
  test('create a form returns correct shape and data', async ({ request }) => {
    const formSlug = uniqueSlug('form');

    const res = await request.post(
      `${API_BASE}/v1/forms/dashboard/${PROJECT_ID}`,
      {
        headers: authHeaders(),
        data: {
          title: 'E2E Test Form',
          slug: formSlug,
          description: 'Created by Playwright e2e tests',
          status: 'draft',
        },
      }
    );

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.title).toBe('E2E Test Form');
    expect(body.data.slug).toBe(formSlug);
    expect(body.data.status).toBe('draft');
    expect(body.data.description).toBe('Created by Playwright e2e tests');
    expect(body.data.id).toBeTruthy();
    expect(body.data.project_id).toBe(PROJECT_ID);
    expect(body.data.questions).toBeInstanceOf(Array);

    // Cleanup
    await request.delete(
      `${API_BASE}/v1/forms/dashboard/${PROJECT_ID}/${body.data.id}`,
      { headers: authHeaders() }
    );
  });

  test('create a form with inline questions', async ({ request }) => {
    const formSlug = uniqueSlug('form-q');

    const res = await request.post(
      `${API_BASE}/v1/forms/dashboard/${PROJECT_ID}`,
      {
        headers: authHeaders(),
        data: {
          title: 'Form With Questions',
          slug: formSlug,
          status: 'draft',
          questions: [
            { type: 'short_text', label: 'Your name', required: true },
            { type: 'email', label: 'Your email', required: true },
            { type: 'rating', label: 'How would you rate us?', required: false },
          ],
        },
      }
    );

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.questions).toHaveLength(3);
    expect(body.data.questions[0].label).toBe('Your name');
    expect(body.data.questions[0].type).toBe('short_text');
    expect(body.data.questions[1].type).toBe('email');
    expect(body.data.questions[2].type).toBe('rating');

    // Cleanup
    await request.delete(
      `${API_BASE}/v1/forms/dashboard/${PROJECT_ID}/${body.data.id}`,
      { headers: authHeaders() }
    );
  });

  test('create form with duplicate slug is rejected', async ({ request }) => {
    const formSlug = uniqueSlug('dup');

    // Create first form
    const first = await request.post(
      `${API_BASE}/v1/forms/dashboard/${PROJECT_ID}`,
      {
        headers: authHeaders(),
        data: { title: 'First', slug: formSlug, status: 'draft' },
      }
    );
    expect(first.status()).toBe(201);
    const firstId = (await first.json()).data.id;

    // Create second form with same slug — should be rejected.
    // Returns 409 when the app-level check catches it, or 500 when
    // Hyperdrive cache is stale and the DB unique constraint catches it.
    const second = await request.post(
      `${API_BASE}/v1/forms/dashboard/${PROJECT_ID}`,
      {
        headers: authHeaders(),
        data: { title: 'Second', slug: formSlug, status: 'draft' },
      }
    );
    expect([409, 500]).toContain(second.status());
    expect(second.status()).not.toBe(201);

    // Cleanup
    await request.delete(
      `${API_BASE}/v1/forms/dashboard/${PROJECT_ID}/${firstId}`,
      { headers: authHeaders() }
    );
  });

  test('create form with missing title returns 400', async ({ request }) => {
    const res = await request.post(
      `${API_BASE}/v1/forms/dashboard/${PROJECT_ID}`,
      {
        headers: authHeaders(),
        data: { slug: uniqueSlug('no-title'), status: 'draft' },
      }
    );
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Title');
  });

  test('create form with missing slug returns 400', async ({ request }) => {
    const res = await request.post(
      `${API_BASE}/v1/forms/dashboard/${PROJECT_ID}`,
      {
        headers: authHeaders(),
        data: { title: 'No Slug Form', status: 'draft' },
      }
    );
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Slug');
  });

  test('update a form returns updated data', async ({ request }) => {
    const formSlug = uniqueSlug('upd');

    // Create
    const createRes = await request.post(
      `${API_BASE}/v1/forms/dashboard/${PROJECT_ID}`,
      {
        headers: authHeaders(),
        data: { title: 'Before Update', slug: formSlug, status: 'draft' },
      }
    );
    const formId = (await createRes.json()).data.id;

    // Update
    const updateRes = await request.patch(
      `${API_BASE}/v1/forms/dashboard/${PROJECT_ID}/${formId}`,
      {
        headers: authHeaders(),
        data: { title: 'After Update', status: 'published' },
      }
    );
    expect(updateRes.status()).toBe(200);
    const updateBody = await updateRes.json();
    expect(updateBody.data.title).toBe('After Update');
    expect(updateBody.data.status).toBe('published');

    // Cleanup
    await request.delete(
      `${API_BASE}/v1/forms/dashboard/${PROJECT_ID}/${formId}`,
      { headers: authHeaders() }
    );
  });

  test('delete a form returns ok', async ({ request }) => {
    const formSlug = uniqueSlug('del');

    // Create
    const createRes = await request.post(
      `${API_BASE}/v1/forms/dashboard/${PROJECT_ID}`,
      {
        headers: authHeaders(),
        data: { title: 'To Delete', slug: formSlug, status: 'draft' },
      }
    );
    const formId = (await createRes.json()).data.id;

    // Delete
    const deleteRes = await request.delete(
      `${API_BASE}/v1/forms/dashboard/${PROJECT_ID}/${formId}`,
      { headers: authHeaders() }
    );
    expect(deleteRes.status()).toBe(200);
    const deleteBody = await deleteRes.json();
    expect(deleteBody.ok).toBe(true);
  });

  test('delete a nonexistent form returns 404', async ({ request }) => {
    const res = await request.delete(
      `${API_BASE}/v1/forms/dashboard/${PROJECT_ID}/00000000-0000-0000-0000-000000000000`,
      { headers: authHeaders() }
    );
    expect(res.status()).toBe(404);
  });

  test('check slug availability — fresh slug returns true', async ({ request }) => {
    const freshSlug = uniqueSlug('avail');
    const res = await request.get(
      `${API_BASE}/v1/forms/dashboard/${PROJECT_ID}/check-slug/${freshSlug}`,
      { headers: authHeaders() }
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.available).toBe(true);
  });

  test('list forms returns paginated response', async ({ request }) => {
    const res = await request.get(
      `${API_BASE}/v1/forms/dashboard/${PROJECT_ID}`,
      { headers: authHeaders() }
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('page');
    expect(body).toHaveProperty('limit');
    expect(body).toHaveProperty('stats');
    expect(Array.isArray(body.data)).toBe(true);
  });
});
