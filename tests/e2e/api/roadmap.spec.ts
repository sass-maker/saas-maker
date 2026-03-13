import { test, expect } from '@playwright/test';
import { API_BASE, PROJECT_ID, authHeaders } from '../helpers';

test.describe('Roadmap CRUD', () => {
  test('create a roadmap item returns correct shape', async ({ request }) => {
    const res = await request.post(
      `${API_BASE}/v1/roadmap/dashboard/${PROJECT_ID}`,
      {
        headers: authHeaders(),
        data: {
          title: 'E2E Roadmap Item',
          description: 'Created by Playwright e2e tests',
          column: 'backlog',
          public: true,
        },
      }
    );
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.title).toBe('E2E Roadmap Item');
    expect(body.description).toBe('Created by Playwright e2e tests');
    expect(body.column).toBe('backlog');
    expect(body.public).toBe(true);
    expect(body.id).toBeTruthy();
    expect(body.project_id).toBe(PROJECT_ID);
    expect(body).toHaveProperty('position');
    expect(body).toHaveProperty('created_at');
    expect(body).toHaveProperty('updated_at');

    // Cleanup
    await request.delete(
      `${API_BASE}/v1/roadmap/dashboard/${PROJECT_ID}/${body.id}`,
      { headers: authHeaders() }
    );
  });

  test('create with invalid column returns 400', async ({ request }) => {
    const res = await request.post(
      `${API_BASE}/v1/roadmap/dashboard/${PROJECT_ID}`,
      {
        headers: authHeaders(),
        data: { title: 'Bad Column', column: 'invalid_col', public: true },
      }
    );
    expect(res.status()).toBe(400);
  });

  test('create with missing title returns 400', async ({ request }) => {
    const res = await request.post(
      `${API_BASE}/v1/roadmap/dashboard/${PROJECT_ID}`,
      {
        headers: authHeaders(),
        data: { column: 'backlog', public: true },
      }
    );
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Title');
  });

  test('update a roadmap item returns updated data', async ({ request }) => {
    // Create
    const createRes = await request.post(
      `${API_BASE}/v1/roadmap/dashboard/${PROJECT_ID}`,
      {
        headers: authHeaders(),
        data: { title: 'To Update', column: 'backlog', public: true },
      }
    );
    const itemId = (await createRes.json()).id;

    // Update: move column and change title
    const updateRes = await request.patch(
      `${API_BASE}/v1/roadmap/dashboard/${PROJECT_ID}/${itemId}`,
      {
        headers: authHeaders(),
        data: {
          column: 'in_progress',
          title: 'Updated Item',
        },
      }
    );
    expect(updateRes.status()).toBe(200);
    const updateBody = await updateRes.json();
    expect(updateBody.column).toBe('in_progress');
    expect(updateBody.title).toBe('Updated Item');

    // Cleanup
    await request.delete(
      `${API_BASE}/v1/roadmap/dashboard/${PROJECT_ID}/${itemId}`,
      { headers: authHeaders() }
    );
  });

  test('delete a roadmap item returns ok', async ({ request }) => {
    // Create
    const createRes = await request.post(
      `${API_BASE}/v1/roadmap/dashboard/${PROJECT_ID}`,
      {
        headers: authHeaders(),
        data: { title: 'To Delete', column: 'backlog', public: true },
      }
    );
    const itemId = (await createRes.json()).id;

    // Delete
    const deleteRes = await request.delete(
      `${API_BASE}/v1/roadmap/dashboard/${PROJECT_ID}/${itemId}`,
      { headers: authHeaders() }
    );
    expect(deleteRes.status()).toBe(200);
    const deleteBody = await deleteRes.json();
    expect(deleteBody.ok).toBe(true);
  });

  test('delete a nonexistent item returns 404', async ({ request }) => {
    const res = await request.delete(
      `${API_BASE}/v1/roadmap/dashboard/${PROJECT_ID}/00000000-0000-0000-0000-000000000000`,
      { headers: authHeaders() }
    );
    expect(res.status()).toBe(404);
  });

  test('list roadmap items returns array', async ({ request }) => {
    const res = await request.get(
      `${API_BASE}/v1/roadmap/dashboard/${PROJECT_ID}`,
      { headers: authHeaders() }
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('update with invalid column returns 400', async ({ request }) => {
    // Create
    const createRes = await request.post(
      `${API_BASE}/v1/roadmap/dashboard/${PROJECT_ID}`,
      {
        headers: authHeaders(),
        data: { title: 'Bad Update', column: 'backlog', public: true },
      }
    );
    const itemId = (await createRes.json()).id;

    // Update with invalid column
    const updateRes = await request.patch(
      `${API_BASE}/v1/roadmap/dashboard/${PROJECT_ID}/${itemId}`,
      {
        headers: authHeaders(),
        data: { column: 'invalid' },
      }
    );
    expect(updateRes.status()).toBe(400);

    // Cleanup
    await request.delete(
      `${API_BASE}/v1/roadmap/dashboard/${PROJECT_ID}/${itemId}`,
      { headers: authHeaders() }
    );
  });
});
