import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  DEFAULT_API_BASE_URL,
  fetchCaptureConfig,
  NewsletterCapture,
  normalizeApiBaseUrl,
  resolveCaptureConfig,
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

test('catalog config is local, immutable to callers, and performs no network I/O', async () => {
  const snapshot = JSON.parse(readFileSync(new URL('../src/capture-config.json', import.meta.url)));
  const id = Object.keys(snapshot)[0];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error('Config must not use the network');
  };
  try {
    assert.deepEqual(resolveCaptureConfig(id), snapshot[id]);
    const config = await fetchCaptureConfig(id, {
      fetcher: () => {
        throw new Error('Injected transport must not be used');
      },
    });
    config.name = 'mutated';
    assert.deepEqual(await fetchCaptureConfig(id), snapshot[id]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('unknown, malformed, inherited and alternate-origin config fails locally', async () => {
  for (const id of ['not-bound', 'Bad-Id!', '__proto__', 'constructor']) {
    await assert.rejects(fetchCaptureConfig(id), /not configured/);
  }
  await assert.rejects(
    fetchCaptureConfig('saas-maker', {
      apiBaseUrl: 'https://another-api.example',
    }),
    /not configured/
  );
});

test('legacy async resolver respects aborted submissions without a lookup', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetchCaptureConfig('saas-maker', { signal: controller.signal }), {
    name: 'AbortError',
  });
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
