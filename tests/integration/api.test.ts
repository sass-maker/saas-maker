/**
 * Integration tests for SaaS Maker API.
 * Requires env vars:
 *   SAASMAKER_API_KEY   - project API key
 *   SAASMAKER_PROJECT_SLUG - project slug (for feedback list, optional)
 *   FREE_AI_BASE_URL    - embedding service URL (optional, for KB document/search tests)
 *
 * Run: SAASMAKER_API_KEY=xxx pnpm test:integration
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { SaaSMakerClient } from '../../packages/sdk/src/index';

const API_KEY = process.env.SAASMAKER_API_KEY ?? '';
const PROJECT_SLUG = process.env.SAASMAKER_PROJECT_SLUG ?? '';
const HAS_AI = !!process.env.FREE_AI_BASE_URL;

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

// ─── Knowledge Base ────────────────────────────────────────────────────────

describe('knowledge base', () => {
  let indexId: string;
  let docId: string;

  it('creates an index', async () => {
    const index = await client.knowledgeBase.createIndex(
      `test-index-${Date.now()}`,
      { embedding_model: '@cf/baai/bge-base-en-v1.5' },
    );
    expect(index.id).toBeTruthy();
    expect(index.name).toContain('test-index');
    indexId = index.id;
  });

  it('lists indexes and finds the new one', async () => {
    const res = await client.knowledgeBase.listIndexes();
    expect(Array.isArray(res.data)).toBe(true);
    const found = res.data.find((i) => i.id === indexId);
    expect(found).toBeTruthy();
  });

  it.skipIf(!HAS_AI)('uploads a document', async () => {
    const res = await client.knowledgeBase.uploadDocument(indexId, {
      content: 'SaaS Maker provides plug-and-play backend services for SaaS apps.',
      metadata: { source: 'integration-test' },
    });
    expect(res.id).toBeTruthy();
    docId = res.id;
  });

  it.skipIf(!HAS_AI)('lists documents in the index', async () => {
    const res = await client.knowledgeBase.listDocuments(indexId);
    expect(res.total).toBeGreaterThan(0);
    const found = res.data.find((d) => d.id === docId);
    expect(found).toBeTruthy();
  });

  it.skipIf(!HAS_AI)('searches the index', async () => {
    const res = await client.knowledgeBase.search(indexId, 'backend services');
    expect(Array.isArray(res.results)).toBe(true);
    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results[0].chunk_content).toBeTruthy();
  });

  it.skipIf(!HAS_AI)('deletes the document', async () => {
    const res = await client.knowledgeBase.deleteDocument(indexId, docId);
    expect(res.ok).toBe(true);
  });

  it('deletes the index', async () => {
    const res = await client.knowledgeBase.deleteIndex(indexId);
    expect(res.ok).toBe(true);
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
