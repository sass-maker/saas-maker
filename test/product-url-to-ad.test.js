import assert from 'node:assert/strict';
import test from 'node:test';

import { UrlToAdError, acceptUrlToAdBrief, createUrlToAdDraft } from '../src/product/url-to-ad.js';

function draftInput(overrides = {}) {
  return {
    workspaceId: 'workspace-a',
    campaignId: 'campaign-a',
    productUrl: 'https://example.test/product',
    audience: 'small business owners',
    goal: 'explain the product',
    claims: [{ text: 'Exports a reviewable video', evidenceId: 'evidence-1' }],
    cta: 'Review your first draft',
    hook: 'Turn one product page into a reviewable reel.',
    body: 'Script: Show the product. Shot list: product page and result. Captions: URL to draft. Asset prompts: product proof.',
    channel: 'instagram_reels',
    quotedCredits: 2,
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

test('URL-to-ad drafts use VideoBrief and require evidence-linked claims', () => {
  const draft = createUrlToAdDraft(draftInput());
  assert.equal(draft.status, 'draft');
  assert.equal(draft.productUrl, 'https://example.test/product');
  assert.equal(draft.proofType, 'product_artifact');
  assert.equal(Object.isFrozen(draft.claims[0]), true);
  assert.throws(() => createUrlToAdDraft(draftInput({ claims: [{ text: 'Unsupported claim' }] })), UrlToAdError);
});

test('actor treatments and unsafe product URLs fail closed', () => {
  assert.throws(() => createUrlToAdDraft(draftInput({ actorTreatment: 'real-actor' })), UrlToAdError);
  assert.throws(() => createUrlToAdDraft(draftInput({ productUrl: 'file:///etc/passwd' })), UrlToAdError);
  assert.throws(() => createUrlToAdDraft(draftInput({ productUrl: 'https://user:pass@example.test/' })), UrlToAdError);
});

test('acceptance binds claim review, rights acceptance, and the exact quote', () => {
  const draft = createUrlToAdDraft(draftInput());
  assert.throws(() => acceptUrlToAdBrief(draft, {
    subjectId: 'user-a', acceptedQuotedCredits: 1, inputRightsAcceptanceId: 'rights-a', claimReviewAccepted: true,
  }), UrlToAdError);
  const accepted = acceptUrlToAdBrief(draft, {
    subjectId: 'user-a', acceptedQuotedCredits: 2, inputRightsAcceptanceId: 'rights-a', claimReviewAccepted: true,
    acceptedAt: '2026-07-01T00:01:00.000Z',
  });
  assert.equal(accepted.status, 'accepted');
  assert.equal(accepted.acceptedBy, 'user-a');
  assert.throws(() => acceptUrlToAdBrief(accepted, {
    subjectId: 'user-a', acceptedQuotedCredits: 2, inputRightsAcceptanceId: 'rights-a', claimReviewAccepted: true,
  }), UrlToAdError);
});
