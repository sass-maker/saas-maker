import assert from 'node:assert/strict';
import test from 'node:test';

import { assertBriefClaimsSupported, buildEvidenceBackedBrief } from '../src/anonymous-video/brand-brief.js';
import { intakeBrandWebsite, isPublicAddress, WebsiteIntakeError } from '../src/anonymous-video/website-intake.js';

const PUBLIC_LOOKUP = async () => [{ address: '93.184.216.34', family: 4 }];

test('extracts cited brand facts, palette, images, captures, and same-origin pages', async () => {
  const responses = new Map([
    ['https://acme.example/', html(`<title>Acme Tools</title><meta name="description" content="Acme makes calm project planning tools."><meta name="theme-color" content="#123456"><link rel="canonical" href="/home"><meta property="og:image" content="/social.png"><h1>Plan with less noise</h1><p>Keep projects clear with a focused view of the work ahead.</p><img class="brand-logo" src="/logo.svg" alt="Acme logo"><a href="/about">About</a>`)],
    ['https://acme.example/about', html('<title>About Acme</title><h1>Built for focused teams</h1><p>Read the story behind our approach to calmer project planning.</p>')],
  ]);
  const result = await intakeBrandWebsite('https://acme.example', {
    lookup: PUBLIC_LOOKUP,
    request: fakeRequest(responses),
    capturePage: async ({ sourceUrl, html: capturedHtml }) => ({ path: `${new URL(sourceUrl).pathname || '/'}-capture.png`, htmlBytes: Buffer.byteLength(capturedHtml) }),
    now: () => new Date('2026-07-13T00:00:00.000Z'),
  });

  assert.equal(result.documents.length, 2);
  assert.equal(result.canonicalUrl, 'https://acme.example/home');
  assert.equal(result.brand.name, 'Acme Tools');
  assert.deepEqual(result.brand.colors.map((item) => item.value), ['#123456']);
  assert.deepEqual(result.brand.images.map((item) => item.role), ['social', 'logo']);
  assert.equal(result.captures.length, 2);
  assert.ok(result.brand.facts.every((fact) => fact.sourceUrl.startsWith('https://acme.example/')));

  const brief = buildEvidenceBackedBrief(result);
  assert.equal(assertBriefClaimsSupported(brief), true);
  assert.equal(brief.claims[0].evidence[0].sourceUrl, 'https://acme.example/');
});

test('revalidates every HTTPS redirect before requesting it', async () => {
  const requested = [];
  const result = await intakeBrandWebsite('https://old.example', {
    lookup: PUBLIC_LOOKUP,
    limits: { maxDocuments: 1 },
    request: async ({ url }) => {
      requested.push(url.href);
      return url.hostname === 'old.example'
        ? { status: 302, headers: { location: 'https://new.example/landing' }, body: '' }
        : html('<title>New Brand</title>');
    },
  });
  assert.deepEqual(requested, ['https://old.example/', 'https://new.example/landing']);
  assert.equal(result.documents[0].url, 'https://new.example/landing');
});

test('rejects private and reserved DNS targets before transport', async () => {
  let requests = 0;
  await assert.rejects(
    intakeBrandWebsite('https://internal.example', {
      lookup: async () => [{ address: '169.254.169.254', family: 4 }],
      request: async () => { requests += 1; return html('<title>Never</title>'); },
    }),
    (error) => error instanceof WebsiteIntakeError && error.code === 'PRIVATE_TARGET',
  );
  assert.equal(requests, 0);
  assert.equal(isPublicAddress('10.0.0.1'), false);
  assert.equal(isPublicAddress('::1'), false);
  assert.equal(isPublicAddress('192.88.99.1'), false);
  assert.equal(isPublicAddress('2001:db8::1'), false);
  assert.equal(isPublicAddress('2606:2800:220:1:248:1893:25c8:1946'), true);
});

test('rejects unsafe schemes, custom ports, private redirects, and oversized documents', async () => {
  await assert.rejects(intakeBrandWebsite('http://acme.example', { lookup: PUBLIC_LOOKUP }), { code: 'INVALID_URL' });
  await assert.rejects(intakeBrandWebsite('https://acme.example:8443', { lookup: PUBLIC_LOOKUP }), { code: 'INVALID_URL' });
  await assert.rejects(intakeBrandWebsite('https://acme.example', {
    lookup: async (host) => host === 'private.example' ? [{ address: '127.0.0.1', family: 4 }] : PUBLIC_LOOKUP(),
    request: async () => ({ status: 302, headers: { location: 'https://private.example/' }, body: '' }),
  }), { code: 'PRIVATE_TARGET' });
  await assert.rejects(intakeBrandWebsite('https://acme.example', {
    lookup: PUBLIC_LOOKUP,
    limits: { maxBytesPerDocument: 10 },
    request: async () => html('this body is much too large'),
  }), { code: 'RESPONSE_TOO_LARGE' });
});

test('sparse evidence produces generic copy with no unsupported claims', async () => {
  const result = await intakeBrandWebsite('https://sparse.example', {
    lookup: PUBLIC_LOOKUP,
    request: async () => html('<div aria-label="empty"></div>'),
  });
  const brief = buildEvidenceBackedBrief(result);
  assert.deepEqual(brief.claims, []);
  assert.match(brief.scenes[1].narration, /See what the brand has to share/);
  assert.equal(assertBriefClaimsSupported(brief), true);
});

test('bounds documents and extracted images and passes the request deadline', async () => {
  let observedTimeout;
  const imageTags = Array.from({ length: 8 }, (_, index) => `<img src="/product-${index}.png" alt="Product ${index}">`).join('');
  const result = await intakeBrandWebsite('https://bounded.example', {
    lookup: PUBLIC_LOOKUP,
    limits: { maxDocuments: 1, maxImages: 3, timeoutMs: 321 },
    request: async ({ timeoutMs }) => {
      observedTimeout = timeoutMs;
      return html(`<title>Bounded</title>${imageTags}<a href="/two">Two</a>`);
    },
  });
  assert.equal(observedTimeout, 321);
  assert.equal(result.documents.length, 1);
  assert.equal(result.brand.images.length, 3);
});

test('reports extraction/fetch failures and records optional capture failure safely', async () => {
  await assert.rejects(intakeBrandWebsite('https://broken.example', {
    lookup: PUBLIC_LOOKUP,
    request: async () => ({ status: 200, headers: { 'content-type': 'application/json' }, body: '{}' }),
  }), { code: 'UNSUPPORTED_CONTENT' });

  const result = await intakeBrandWebsite('https://capture.example', {
    lookup: PUBLIC_LOOKUP,
    request: async () => html('<title>Capture Brand</title>'),
    capturePage: async () => { throw new Error('browser unavailable with secret detail'); },
  });
  assert.equal(result.captures[0].sourceUrl, 'https://capture.example/');
  assert.match(result.captures[0].error, /browser unavailable/);
});

function html(body) {
  return { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, body };
}

function fakeRequest(responses) {
  return async ({ url }) => {
    const response = responses.get(url.href);
    assert.ok(response, `unexpected fixture URL ${url.href}`);
    return response;
  };
}
