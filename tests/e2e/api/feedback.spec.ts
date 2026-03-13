import { test, expect } from '@playwright/test';
import { API_BASE, PROJECT_ID, apiKeyHeaders, authHeaders } from '../helpers';

test.describe('Feedback', () => {
  test('submit feedback via API key returns correct shape', async ({ request }) => {
    const res = await request.post(`${API_BASE}/v1/feedback`, {
      headers: apiKeyHeaders(),
      data: {
        title: 'E2E Bug Report',
        description: 'Something is broken — reported by Playwright',
        type: 'bug',
        submitter_email: 'playwright@test.example.com',
        submitter_name: 'Playwright Bot',
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.title).toBe('E2E Bug Report');
    expect(body.type).toBe('bug');
    expect(body.status).toBe('new');
    expect(body.id).toBeTruthy();
    expect(body.project_id).toBe(PROJECT_ID);
    expect(body.submitter_email).toBe('playwright@test.example.com');
    expect(body.submitter_name).toBe('Playwright Bot');
    expect(body).toHaveProperty('created_at');

    // Cleanup
    await request.delete(`${API_BASE}/v1/feedback/${body.id}`, {
      headers: authHeaders(),
    });
  });

  test('submit feedback — missing title returns 400', async ({ request }) => {
    const res = await request.post(`${API_BASE}/v1/feedback`, {
      headers: apiKeyHeaders(),
      data: {
        description: 'No title here',
        type: 'feedback',
        submitter_email: 'playwright@test.example.com',
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Title');
  });

  test('submit feedback — missing description returns 400', async ({ request }) => {
    const res = await request.post(`${API_BASE}/v1/feedback`, {
      headers: apiKeyHeaders(),
      data: {
        title: 'No Description',
        type: 'feedback',
        submitter_email: 'playwright@test.example.com',
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Description');
  });

  test('submit feedback — missing email returns 400', async ({ request }) => {
    const res = await request.post(`${API_BASE}/v1/feedback`, {
      headers: apiKeyHeaders(),
      data: {
        title: 'No Email',
        description: 'Missing email field',
        type: 'feedback',
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Email');
  });

  test('submit feedback — invalid type returns 400', async ({ request }) => {
    const res = await request.post(`${API_BASE}/v1/feedback`, {
      headers: apiKeyHeaders(),
      data: {
        title: 'Invalid Type',
        description: 'Bad type field',
        type: 'invalid_type',
        submitter_email: 'playwright@test.example.com',
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('type');
  });

  test('list feedback via API key returns paginated shape', async ({ request }) => {
    const res = await request.get(`${API_BASE}/v1/feedback`, {
      headers: apiKeyHeaders(),
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('page');
    expect(body).toHaveProperty('limit');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('list feedback via dashboard inbox returns paginated shape', async ({ request }) => {
    const res = await request.get(
      `${API_BASE}/v1/feedback/inbox/${PROJECT_ID}`,
      { headers: authHeaders() }
    );

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('page');
    expect(body).toHaveProperty('limit');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('delete feedback returns ok', async ({ request }) => {
    // Create feedback to delete
    const createRes = await request.post(`${API_BASE}/v1/feedback`, {
      headers: apiKeyHeaders(),
      data: {
        title: 'To Delete',
        description: 'Will be deleted',
        type: 'feedback',
        submitter_email: 'playwright@test.example.com',
      },
    });
    const feedbackId = (await createRes.json()).id;

    const deleteRes = await request.delete(
      `${API_BASE}/v1/feedback/${feedbackId}`,
      { headers: authHeaders() }
    );
    expect(deleteRes.status()).toBe(200);
    const deleteBody = await deleteRes.json();
    expect(deleteBody.ok).toBe(true);
  });

  test('delete nonexistent feedback returns 404', async ({ request }) => {
    const res = await request.delete(
      `${API_BASE}/v1/feedback/00000000-0000-0000-0000-000000000000`,
      { headers: authHeaders() }
    );
    expect(res.status()).toBe(404);
  });
});
