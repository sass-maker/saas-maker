import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_API_BASE_URL,
  normalizeApiBaseUrl,
  submitSubscription,
  validateSubscriptionRequest,
} from '../dist/index.mjs';

test('API base defaults to the SaaS Maker API and trims its trailing slash', () => {
  assert.equal(DEFAULT_API_BASE_URL, 'https://api.sassmaker.com');
  assert.equal(normalizeApiBaseUrl(' https://api.example.com/ '), 'https://api.example.com');
});

test('API base rejects unsafe schemes, credentials, query, fragment, and paths', () => {
  assert.throws(() => normalizeApiBaseUrl('javascript:alert(1)'), /HTTP or HTTPS/);
  assert.throws(() => normalizeApiBaseUrl('/api'), /invalid/);
  assert.throws(() => normalizeApiBaseUrl('https://user:pass@example.com'), /credentials/);
  assert.throws(() => normalizeApiBaseUrl('https://api.example.com/?key=value'), /query/);
  assert.throws(() => normalizeApiBaseUrl('https://api.example.com/#capture'), /query/);
  assert.throws(() => normalizeApiBaseUrl('https://api.example.com/api'), /without a path/);
  assert.throws(() => normalizeApiBaseUrl('https://api.example.com/api/..'), /without a path/);
  assert.throws(
    () => normalizeApiBaseUrl('http://api.example.com'),
    /HTTPS outside local development/
  );
  assert.equal(normalizeApiBaseUrl('http://localhost:3000'), 'http://localhost:3000');
  assert.throws(() => normalizeApiBaseUrl('http://localhost:3000/api'), /without a path/);
});

test('request normalization lowercases email and preserves explicit kind/source/consent', () => {
  assert.deepEqual(
    validateSubscriptionRequest({
      email: '  Person@Example.COM ',
      kind: 'waitlist',
      source: 'product-home',
      consent: true,
    }),
    {
      email: 'person@example.com',
      kind: 'waitlist',
      source: 'product-home',
      consent: true,
    }
  );
});

test('request validation requires valid email, allowed kind, source, and consent', () => {
  const base = {
    email: 'person@example.com',
    kind: 'newsletter',
    source: 'product',
    consent: true,
  };
  assert.throws(() => validateSubscriptionRequest({ ...base, email: 'nope' }), /valid email/);
  assert.throws(
    () => validateSubscriptionRequest({ ...base, kind: 'campaign' }),
    /Choose newsletter/
  );
  assert.throws(() => validateSubscriptionRequest({ ...base, source: 'Product!' }), /lowercase/);
  assert.throws(() => validateSubscriptionRequest({ ...base, consent: false }), /agree/);
});

test('submission posts the exact public contract and omits cookies', async () => {
  const requests = [];
  await submitSubscription(
    { email: 'person@example.com', kind: 'newsletter', source: 'acme', consent: true },
    {
      projectKey: 'pk_acme',
      apiBaseUrl: 'https://api.example.com/',
      fetcher: async (url, init) => {
        requests.push({ url, init });
        return new Response(null, { status: 202 });
      },
    }
  );
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.example.com/v1/subscriptions');
  assert.equal(requests[0].init.method, 'POST');
  assert.equal(requests[0].init.credentials, 'omit');
  assert.equal(requests[0].init.headers['X-Project-Key'], 'pk_acme');
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    email: 'person@example.com',
    kind: 'newsletter',
    source: 'acme',
    consent: true,
  });
});

test('submission turns API and transport failures into safe retry guidance', async () => {
  const base = {
    projectKey: 'pk_acme',
    apiBaseUrl: 'https://api.example.com',
  };
  await assert.rejects(
    submitSubscription(
      { email: 'person@example.com', kind: 'waitlist', source: 'acme', consent: true },
      { ...base, fetcher: async () => new Response(null, { status: 429 }) }
    ),
    /Too many attempts/
  );
  await assert.rejects(
    submitSubscription(
      { email: 'person@example.com', kind: 'waitlist', source: 'acme', consent: true },
      {
        ...base,
        fetcher: async () => {
          throw new TypeError('secret transport detail');
        },
      }
    ),
    /Unable to reach the signup service/
  );
});
