import assert from 'node:assert/strict';
import test from 'node:test';

import { authoriseWorkspaceAccess } from '../src/product/authorisation.js';
import { CommercialRenderCoordinator } from '../src/product/commercial-render.js';
import { CreditLedger, createCreditAccount } from '../src/product/credit-ledger.js';
import { createOutputProvenance } from '../src/product/provenance.js';
import { acceptUrlToAdBrief, createUrlToAdDraft } from '../src/product/url-to-ad.js';

test('brand smoke: sign-in -> URL -> accepted brief -> hold -> render -> artifact -> capture', () => {
  const identity = { subject: 'brand-user-a' };
  const workspaceId = 'workspace-a';
  authoriseWorkspaceAccess({ identity, workspaceId, permission: 'render:write', memberships: [
    { subject: identity.subject, workspaceId, role: 'owner', status: 'active' },
  ] });
  const draft = createUrlToAdDraft({ id: 'brief-a', workspaceId, campaignId: 'campaign-a', productUrl: 'https://example.test/product',
    audience: 'teams', goal: 'explain product', claims: [{ text: 'Produces a reviewed artifact', evidenceId: 'evidence-a' }],
    cta: 'Review', hook: 'One URL to a video', body: 'Script: demo. Shot list: demo. Captions: review. Asset prompts: proof.',
    channel: 'instagram_reels', quotedCredits: 4 });
  const brief = acceptUrlToAdBrief(draft, { subjectId: identity.subject, acceptedQuotedCredits: 4,
    inputRightsAcceptanceId: 'rights-a', claimReviewAccepted: true });
  const account = createCreditAccount({ id: 'account-a', workspaceId });
  const ledger = new CreditLedger();
  ledger.grant({ accountId: account.id, workspaceId, amount: 10, idempotencyKey: 'purchase-a' });
  const renders = new CommercialRenderCoordinator({ ledger });
  const job = renders.submit({ brief, account, idempotencyKey: 'render-a' });
  assert.equal(ledger.balance(account.id).held, 4);
  const leased = renders.lease(job.id, { workerId: 'fake-renderer', leaseMs: 10_000, now: '2026-01-01T00:00:00.000Z' });
  const ready = renders.complete(job.id, { leaseToken: leased.attempts[0].leaseToken, artifactId: 'private-artifact-a', completionKey: 'complete-a', now: '2026-01-01T00:00:01.000Z' });
  const provenance = createOutputProvenance({ workspaceId, outputId: ready.artifactId, briefId: brief.id,
    inputRightsAttestation: { accepted: true, acceptanceId: brief.inputRightsAcceptanceId },
    renderer: { provider: 'fake-renderer', model: 'smoke', version: '1' }, sourceAssets: [{ id: 'evidence-a', rightsBasis: 'customer-supplied' }],
    review: { briefAcceptanceId: `${brief.id}:${brief.acceptedAt}`, outputAcceptanceId: 'output-acceptance-a' },
    disclosure: { decision: 'none-required', policyVersion: 'disabled-launch-slice', required: false, applied: false } });
  assert.equal(provenance.outputId, 'private-artifact-a');
  assert.deepEqual(ledger.balance(account.id), { available: 6, held: 0, captured: 4 });
});
