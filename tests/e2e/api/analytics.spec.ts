import { test, expect } from '@playwright/test';
import { API_BASE, apiKeyHeaders } from '../helpers';

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

});
