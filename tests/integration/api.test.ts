/**
 * Integration tests for SaaS Maker API.
 * Requires env vars:
 *   SAASMAKER_API_KEY      - project API key
 *   SAASMAKER_PROJECT_SLUG - project slug (for slug-scoped tests, optional)
 *
 * Run: SAASMAKER_API_KEY=xxx pnpm test:integration
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { SaaSMakerClient } from '../../packages/blocks/sdk/src/index';

const API_KEY = process.env.SAASMAKER_API_KEY ?? '';
const PROJECT_SLUG = process.env.SAASMAKER_PROJECT_SLUG ?? '';

const client = new SaaSMakerClient({ apiKey: API_KEY });

beforeAll(() => {
  if (!API_KEY) throw new Error('SAASMAKER_API_KEY env var is required');
});

// ─── Health ────────────────────────────────────────────────────────────────

describe('health', () => {
  it('returns ok', async () => {
    const res = await fetch('https://api.sassmaker.com/health');
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual({ status: 'ok' });
  });
});

// ─── Feedback ──────────────────────────────────────────────────────────────

describe('feedback', () => {
  let feedbackId: string;

  it('submits a feedback item', async () => {
    const record = await client.feedback.submit({
      title: '[test] Dark mode support',
      description: 'Integration test feedback entry',
      type: 'feature',
      submitter_email: 'test@sassmaker.com',
    });
    expect(record.id).toBeTruthy();
    expect(record.title).toBe('[test] Dark mode support');
    expect(record.type).toBe('feature');
    feedbackId = record.id;
  });

  it.skipIf(!PROJECT_SLUG)('lists feedback by project slug', async () => {
    const res = await client.feedback.listByProject(PROJECT_SLUG);
    expect(Array.isArray(res.data)).toBe(true);
    const found = res.data.find((f) => f.id === feedbackId);
    expect(found).toBeTruthy();
  });
});

// ─── Waitlist ──────────────────────────────────────────────────────────────

describe('waitlist', () => {
  it('joins the waitlist', async () => {
    const res = await client.waitlist.join({
      email: `test-${Date.now()}@sassmaker.com`,
      name: 'Integration Test',
    });
    expect(res.id).toBeTruthy();
    expect(res.email).toBeTruthy();
  });

  it('rejects duplicate email', async () => {
    const email = `dup-${Date.now()}@sassmaker.com`;
    await client.waitlist.join({ email });
    await expect(client.waitlist.join({ email })).rejects.toThrow();
  });
});

// ─── Testimonials ──────────────────────────────────────────────────────────

describe('testimonials', () => {
  it('submits a testimonial', async () => {
    const res = await client.testimonials.submit({
      author_name: 'Test User',
      author_email: 'test@sassmaker.com',
      content: 'SaaS Maker is great — integration test.',
      rating: 5,
    });
    expect(res.id).toBeTruthy();
    expect(res.status).toBe('pending');
  });

  it('lists testimonials', async () => {
    const res = await client.testimonials.list();
    expect(Array.isArray(res.data)).toBe(true);
  });
});

// ─── Changelog ─────────────────────────────────────────────────────────────

describe('changelog', () => {
  it('lists changelog entries', async () => {
    const res = await client.changelog.list();
    expect(Array.isArray(res.data)).toBe(true);
  });
});

// ─── Analytics ─────────────────────────────────────────────────────────────

describe('analytics', () => {
  it('tracks a page view', async () => {
    const res = await client.analytics.track({
      name: 'page_view',
      url: 'https://example.com/test',
    });
    expect(res.ok).toBe(true);
  });

  it('tracks a custom event', async () => {
    const res = await client.analytics.track({
      name: 'button_click',
      properties: { button: 'get-started', source: 'integration-test' },
    });
    expect(res.ok).toBe(true);
  });
});

// ─── Roadmap ───────────────────────────────────────────────────────────────

describe('roadmap', () => {
  it.skipIf(!PROJECT_SLUG)('lists public roadmap items', async () => {
    const res = await client.roadmap.listPublic(PROJECT_SLUG);
    expect(Array.isArray(res.data)).toBe(true);
  });
});

// ─── Testimonials (by slug) ────────────────────────────────────────────────

describe('testimonials by slug', () => {
  it.skipIf(!PROJECT_SLUG)('submits a testimonial by project slug', async () => {
    const res = await client.testimonials.submitBySlug(PROJECT_SLUG, {
      author_name: 'Slug Test User',
      author_email: 'slug-test@sassmaker.com',
      content: 'Integration test via slug.',
      rating: 4,
    });
    expect(res.id).toBeTruthy();
    expect(res.status).toBe('pending');
  });
});

// ─── Auth errors ───────────────────────────────────────────────────────────

describe('auth', () => {
  it('rejects invalid API key', async () => {
    const bad = new SaaSMakerClient({ apiKey: 'bad-key' });
    await expect(bad.feedback.submit({
      title: 'should fail',
      description: 'should fail',
      type: 'bug',
      submitter_email: 'fail@test.com',
    })).rejects.toThrow();
  });
});
