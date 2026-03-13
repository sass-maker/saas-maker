import { test, expect } from '@playwright/test';
import { API_BASE, CLI_TOKEN, PROJECT_ID, apiKeyHeaders, authHeaders } from '../helpers';

test.describe('Analytics', () => {
  test('POST /events — track a page view event', async ({ request }) => {
    const res = await request.post(`${API_BASE}/v1/analytics/events`, {
      headers: apiKeyHeaders(),
      data: {
        name: 'page_view',
        url: 'https://example.com/e2e-test',
        referrer: 'https://google.com',
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('POST /events — track a custom event', async ({ request }) => {
    const res = await request.post(`${API_BASE}/v1/analytics/events`, {
      headers: apiKeyHeaders(),
      data: {
        name: 'button_click',
        url: 'https://example.com/e2e-test',
        properties: { button: 'signup' },
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('GET /dashboard — returns expected shape with API key', async ({ request }) => {
    const res = await request.get(`${API_BASE}/v1/analytics/dashboard`, {
      headers: apiKeyHeaders(),
    });

    expect(res.status()).toBe(200);
    const body = await res.json();

    // The dashboard endpoint should return a summary object with known keys
    expect(body).toHaveProperty('summary');
    expect(body).toHaveProperty('timeseries');
    expect(body).toHaveProperty('pages');
    expect(body).toHaveProperty('referrers');
    expect(body).toHaveProperty('countries');
    expect(body).toHaveProperty('devices');
    expect(body).toHaveProperty('browsers');
    expect(body).toHaveProperty('os');
    expect(body).toHaveProperty('events');
    expect(body).toHaveProperty('bots');
  });

  test('GET /dashboard — returns expected shape with Bearer token', async ({ request }) => {
    const res = await request.get(
      `${API_BASE}/v1/analytics/dashboard?project_id=${PROJECT_ID}`,
      { headers: authHeaders() }
    );

    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(body).toHaveProperty('summary');
    expect(body).toHaveProperty('timeseries');
    expect(body).toHaveProperty('pages');
    expect(body).toHaveProperty('referrers');
    expect(body).toHaveProperty('countries');
    expect(body).toHaveProperty('devices');
    expect(body).toHaveProperty('browsers');
    expect(body).toHaveProperty('os');
    expect(body).toHaveProperty('events');
    expect(body).toHaveProperty('bots');
  });

  test('GET /detail/pages — returns paginated response', async ({ request }) => {
    const res = await request.get(
      `${API_BASE}/v1/analytics/detail/pages?project_id=${PROJECT_ID}`,
      { headers: authHeaders() }
    );

    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.data)).toBe(true);
    expect(Number(body.total)).toBeGreaterThanOrEqual(0);
  });

  test('GET /detail/pages — supports limit and offset', async ({ request }) => {
    const res = await request.get(
      `${API_BASE}/v1/analytics/detail/pages?project_id=${PROJECT_ID}&limit=5&offset=0`,
      { headers: authHeaders() }
    );

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeLessThanOrEqual(5);
  });

  test('GET /detail/:section — rejects invalid section', async ({ request }) => {
    const res = await request.get(
      `${API_BASE}/v1/analytics/detail/invalid_section?project_id=${PROJECT_ID}`,
      { headers: authHeaders() }
    );

    expect(res.status()).toBe(400);
  });
});
