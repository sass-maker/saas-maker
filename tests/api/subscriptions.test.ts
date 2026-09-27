import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDb, mockStore } = vi.hoisted(() => ({
  mockDb: {
    getProjectByApiKey: vi.fn(),
    getProjectById: vi.fn(),
    getProjectBySlug: vi.fn(),
    upsertUser: vi.fn(),
  },
  mockStore: {
    joinCapture: vi.fn(),
    getCaptureById: vi.fn(),
    unsubscribeCapture: vi.fn(),
    listCapture: vi.fn(),
  },
}));
vi.mock('../../workers/api/src/db', () => ({ getDb: () => mockDb }));
vi.mock('../../workers/api/src/lib/capture-store', () => mockStore);

import { signCaptureToken } from '../../workers/api/src/lib/capture-token';
import { CAPTURE_CONSENT_COPY_V1 } from '../../workers/api/src/lib/capture-consent';
import { CONSENT_COPY_V1 } from '../../packages/newsletter-capture/src/contract';
import { request } from './helpers';

const SECRET = 'synthetic-capture-key-for-local-tests-only';
const HEADERS = { 'X-Project-Key': 'pk_test', 'Content-Type': 'application/json' };
const JOIN = { email: ' Person@Example.Test ', kind: 'waitlist', consent: true, source: 'landing' };

beforeEach(() => {
  Object.values(mockDb).forEach((mock) => mock.mockReset());
  mockDb.getProjectByApiKey.mockResolvedValue({
    id: 'project-1',
    slug: 'product-one',
  });
  mockDb.getProjectById.mockResolvedValue({
    id: 'project-1',
    slug: 'product-one',
    owner_id: 'user-1',
  });
  mockDb.upsertUser.mockResolvedValue({ id: 'user-1' });
  Object.values(mockStore).forEach((mock) => mock.mockReset());
  mockStore.joinCapture.mockResolvedValue({ id: crypto.randomUUID(), joined: true });
  mockStore.listCapture.mockResolvedValue({ data: [], next_cursor: null });
});
afterEach(() => vi.unstubAllGlobals());

function postJoin(body: unknown, env: Record<string, unknown> = {}) {
  return request(
    '/v1/subscriptions',
    { method: 'POST', headers: HEADERS, body: JSON.stringify(body) },
    { DB: {}, CAPTURE_SIGNING_KEY: SECRET, ...env }
  );
}

describe('Hosted newsletter and waitlist capture', () => {
  it('keeps the immutable v1 consent copy equal on the form and server', () => {
    expect(CAPTURE_CONSENT_COPY_V1).toEqual(CONSENT_COPY_V1);
  });

  it('allows public submissions from product web origins without opening owner reads', async () => {
    const origin = 'https://an-independent-product.example';
    const preflight = await request('/v1/subscriptions', {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-project-key',
      },
    });
    expect(preflight.headers.get('access-control-allow-origin')).toBe(origin);
    expect(preflight.headers.get('access-control-allow-credentials')).toBeNull();
    const joined = await request(
      '/v1/subscriptions',
      { method: 'POST', headers: { ...HEADERS, Origin: origin }, body: JSON.stringify(JOIN) },
      { DB: {}, CAPTURE_SIGNING_KEY: SECRET }
    );
    expect(joined.status).toBe(202);
    expect(joined.headers.get('access-control-allow-origin')).toBe(origin);
    const ownerRead = await request('/v1/subscriptions?project=project-1', {
      headers: { Origin: origin },
    });
    expect(ownerRead.headers.get('access-control-allow-origin')).not.toBe(origin);
  });

  it('keeps the private list within its owner project', async () => {
    const id = crypto.randomUUID();
    mockStore.listCapture.mockResolvedValueOnce({
      data: [{ id, email: 'person@example.test', kind: 'waitlist' }],
      next_cursor: null,
    });
    const unauthorized = await request('/v1/subscriptions?project=project-1');
    expect(unauthorized.status).toBe(401);
    const owner = await request(
      '/v1/subscriptions?project=project-1&kind=waitlist',
      { headers: { Authorization: 'Bearer local-dev-session' } },
      { DB: {}, LOCAL_AUTH_BYPASS: 'true', CAPTURE_SIGNING_KEY: SECRET }
    );
    expect(owner.status).toBe(200);
    const listing = await owner.json();
    expect(listing.data[0].unsubscribe_token).toMatch(/^[a-f0-9]{64}$/);
    expect(owner.headers.get('cache-control')).toBe('no-store');
    expect(mockStore.listCapture).toHaveBeenCalledWith({}, 'project-1', 'waitlist', undefined);
    mockDb.getProjectById.mockResolvedValueOnce({
      id: 'project-1',
      slug: 'product-one',
      owner_id: 'different-user',
    });
    const crossOwner = await request(
      '/v1/subscriptions?project=project-1',
      { headers: { Authorization: 'Bearer local-dev-session' } },
      { DB: {}, LOCAL_AUTH_BYPASS: 'true', CAPTURE_SIGNING_KEY: SECRET }
    );
    expect(crossOwner.status).toBe(404);
  });
  it('requires a project key and configured removal signing', async () => {
    const noKey = await request('/v1/subscriptions', {
      method: 'POST',
      body: JSON.stringify(JOIN),
    });
    expect(noKey.status).toBe(401);
    const noSigning = await postJoin(JOIN, { CAPTURE_SIGNING_KEY: undefined });
    expect(noSigning.status).toBe(503);
    expect(mockStore.joinCapture).not.toHaveBeenCalled();
  });

  it('requires an explicit consented mode and a valid email', async () => {
    for (const body of [
      null,
      [],
      { ...JOIN, consent: false },
      { ...JOIN, kind: 'other' },
      { ...JOIN, email: 'invalid' },
      { ...JOIN, source: 'https://source.example/?secret=1' },
    ]) {
      const response = await postJoin(body);
      expect(response.status).toBe(400);
    }
    expect(mockStore.joinCapture).not.toHaveBeenCalled();
  });

  it('emits one privacy-limited App Health event after a new durable join', async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', send);
    const response = await postJoin(JOIN, { APP_HEALTH_INGEST_KEY: 'synthetic-app-health-key' });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ ok: true });
    expect(mockStore.joinCapture).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        projectId: 'project-1',
        kind: 'waitlist',
        email: 'person@example.test',
        source: 'landing',
        consentVersion: 'v1',
        consentText: CAPTURE_CONSENT_COPY_V1.waitlist,
      })
    );
    expect(send).toHaveBeenCalledOnce();
    const payload = JSON.parse(send.mock.calls[0][1].body);
    expect(payload.logs[0]).toMatchObject({
      event: 'waitlist.join',
      props: { project: 'product-one', project_id: 'project-1', kind: 'waitlist' },
    });
    expect(JSON.stringify(payload)).not.toMatch(
      /person@example|Person@Example|synthetic-capture-key/
    );
  });

  it('uses the server binding for catalog attribution and ignores client catalog IDs', async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', send);
    const first = vi.fn().mockResolvedValue({ catalog_project_id: 'fleet-catalog-id' });
    const bind = vi.fn(() => ({ first }));
    const db = { prepare: vi.fn(() => ({ bind })) };
    const response = await postJoin(
      { ...JOIN, catalog_project_id: 'client-chosen-id' },
      { DB: db, APP_HEALTH_INGEST_KEY: 'synthetic-app-health-key' }
    );
    expect(response.status).toBe(202);
    expect(bind).toHaveBeenCalledWith('project-1');
    const payload = JSON.parse(send.mock.calls[0][1].body);
    expect(payload.logs[0].props).toMatchObject({
      project: 'fleet-catalog-id',
      project_slug: 'product-one',
      project_id: 'project-1',
      catalog_project_id: 'fleet-catalog-id',
    });
    expect(payload.logs[0].props.catalog_project_id).not.toBe('client-chosen-id');
  });

  it('does not emit an outcome for a duplicate or failed write', async () => {
    const send = vi.fn();
    vi.stubGlobal('fetch', send);
    mockStore.joinCapture.mockResolvedValueOnce({ id: crypto.randomUUID(), joined: false });
    expect((await postJoin(JOIN, { APP_HEALTH_INGEST_KEY: 'test' })).status).toBe(202);
    expect(send).not.toHaveBeenCalled();
    mockStore.joinCapture.mockRejectedValueOnce(new Error('storage unavailable'));
    expect((await postJoin(JOIN, { APP_HEALTH_INGEST_KEY: 'test' })).status).toBe(500);
    expect(send).not.toHaveBeenCalled();
  });

  it('accepts a valid unsubscribe token without revealing subscription existence', async () => {
    const id = crypto.randomUUID();
    mockStore.getCaptureById.mockResolvedValue({
      id,
      project_id: 'project-1',
      kind: 'newsletter',
      email_normalized: 'person@example.test',
      state: 'active',
    });
    const token = await signCaptureToken(SECRET, id, 'person@example.test');
    const response = await request(
      '/v1/subscriptions/unsubscribe',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, token }),
      },
      { DB: {}, CAPTURE_SIGNING_KEY: SECRET }
    );
    expect(response.status).toBe(202);
    expect(mockStore.unsubscribeCapture).toHaveBeenCalledWith(expect.anything(), id);
    mockStore.unsubscribeCapture.mockClear();
    const invalid = await request(
      '/v1/subscriptions/unsubscribe',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, token: '0'.repeat(64) }),
      },
      { DB: {}, CAPTURE_SIGNING_KEY: SECRET }
    );
    expect(invalid.status).toBe(202);
    expect(mockStore.unsubscribeCapture).not.toHaveBeenCalled();
  });
});
