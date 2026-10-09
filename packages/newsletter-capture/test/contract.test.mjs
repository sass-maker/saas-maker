import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  DEFAULT_API_BASE_URL,
  fetchCaptureConfig,
  NewsletterCapture,
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

test('fetchCaptureConfig resolves a bound catalog id to the publishable config', async () => {
  const calls = [];
  const config = await fetchCaptureConfig('acme', {
    apiBaseUrl: 'https://api.example.com/',
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ api_key: 'pk_acme', name: 'Acme', slug: 'acme' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  assert.deepEqual(config, { api_key: 'pk_acme', name: 'Acme', slug: 'acme' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.example.com/v1/capture-config/acme');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.credentials, 'omit');
});

test('fetchCaptureConfig rejects malformed catalog ids before any network call', async () => {
  let called = false;
  await assert.rejects(
    fetchCaptureConfig('Bad-Id!', {
      fetcher: async () => {
        called = true;
        return new Response(null, { status: 200 });
      },
    }),
    /not configured/
  );
  assert.equal(called, false);
});

test('fetchCaptureConfig treats unknown/unbound (404) and bad bodies as not configured', async () => {
  await assert.rejects(
    fetchCaptureConfig('not-bound', {
      fetcher: async () => new Response(null, { status: 404 }),
    }),
    /not configured/
  );
  await assert.rejects(
    fetchCaptureConfig('acme', {
      fetcher: async () =>
        new Response(JSON.stringify({ api_key: 'pk_acme' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    }),
    /not configured/
  );
});

test('fetchCaptureConfig surfaces transport failures as a safe retry message and never logs the key', async () => {
  await assert.rejects(
    fetchCaptureConfig('acme', {
      fetcher: async () => {
        throw new TypeError('secret transport detail');
      },
    }),
    /Unable to reach the signup service/
  );
  // AbortError must propagate verbatim so the element can discard stale loads.
  const abort = new DOMException('aborted', 'AbortError');
  await assert.rejects(
    fetchCaptureConfig('acme', {
      fetcher: async () => {
        throw abort;
      },
    }),
    /aborted/
  );
});

test('React compact layout forwards only presentation and retains capture attributes', () => {
  const props = { productName: 'Acme', catalogId: 'acme', kind: 'newsletter', source: 'acme' };
  const standard = renderToStaticMarkup(createElement(NewsletterCapture, props));
  const compact = renderToStaticMarkup(
    createElement(NewsletterCapture, { ...props, layout: 'compact' })
  );
  assert.doesNotMatch(standard, /layout=/);
  assert.match(compact, /layout="compact"/);
  assert.equal(compact.replace(' layout="compact"', ''), standard);
  assert.doesNotMatch(compact, /allow-kind-selection|project-key=/);
});

test('successful config lookups reuse public config for 60 seconds, failures retry and origins stay separate', async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  let now = originalNow();
  let calls = 0;
  let fail = false;
  Date.now = () => now;
  globalThis.fetch = async () => {
    calls++;
    return fail
      ? new Response(null, { status: 503 })
      : Response.json({ api_key: 'pk_synthetic', name: 'Synthetic', slug: 'synthetic' });
  };
  try {
    const first = await fetchCaptureConfig('cache-test');
    first.name = 'mutated';
    assert.equal((await fetchCaptureConfig('cache-test')).name, 'Synthetic');
    assert.equal(calls, 1);
    await fetchCaptureConfig('cache-test', { apiBaseUrl: 'https://another-api.example' });
    assert.equal(calls, 2);
    now += 60_001;
    await fetchCaptureConfig('cache-test');
    assert.equal(calls, 3);
    fail = true;
    await assert.rejects(fetchCaptureConfig('retry-test'));
    fail = false;
    await fetchCaptureConfig('retry-test');
    assert.equal(calls, 5);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});
