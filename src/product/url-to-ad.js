import { randomUUID } from 'node:crypto';

import { normalizeVideoBrief } from '../video-brief.js';

const BRIEF_TRANSITIONS = Object.freeze({
  draft: new Set(['accepted', 'rejected']),
  accepted: new Set(),
  rejected: new Set(),
});

export function createUrlToAdDraft(input) {
  if (!input?.workspaceId || !input.campaignId || !input.productUrl || !input.audience || !input.goal || !input.claims || !input.cta) {
    throw new UrlToAdError('workspace, campaign, product URL, audience, goal, claims, and CTA are required');
  }
  const productUrl = safeHttpUrl(input.productUrl);
  if (!Array.isArray(input.claims) || input.claims.length === 0 || input.claims.some((claim) => !claim?.text || !claim?.evidenceId)) {
    throw new UrlToAdError('every claim requires text and product-evidence linkage');
  }
  if (input.actorTreatment && input.actorTreatment !== 'none') {
    throw new UrlToAdError('actor treatments remain disabled for brand self-serve drafts');
  }
  const createdAt = timestamp(input.createdAt);
  const brief = normalizeVideoBrief({
    id: input.id ?? randomUUID(),
    projectSlug: input.projectSlug ?? new URL(productUrl).hostname.replace(/^www\./, '').split('.')[0],
    channel: input.channel ?? 'instagram_reels',
    title: input.title ?? `${input.goal} for ${new URL(productUrl).hostname}`,
    hook: input.hook,
    body: input.body,
    cta: input.cta,
    audience: input.audience,
    productUrl,
    proofUrl: input.proofUrl,
    proofType: input.proofType ?? 'product_artifact',
    renderMode: input.renderMode ?? 'stock',
    durationSeconds: input.durationSeconds,
  });
  return immutable({
    ...brief,
    workspaceId: input.workspaceId,
    campaignId: input.campaignId,
    goal: input.goal,
    claims: input.claims,
    sourceEvidence: input.sourceEvidence ?? [],
    actorTreatment: 'none',
    quotedCredits: positiveInteger(input.quotedCredits, 'quotedCredits'),
    status: 'draft',
    acceptedAt: null,
    acceptedBy: null,
    createdAt,
    updatedAt: createdAt,
  });
}

export function acceptUrlToAdBrief(brief, input) {
  if (!BRIEF_TRANSITIONS[brief?.status]?.has('accepted')) throw new UrlToAdError('only a draft brief can be accepted');
  if (!input?.subjectId || input.acceptedQuotedCredits !== brief.quotedCredits || !input.inputRightsAcceptanceId || !input.claimReviewAccepted) {
    throw new UrlToAdError('claim review, exact credit quote, and input-rights acceptance are required');
  }
  const acceptedAt = timestamp(input.acceptedAt);
  return immutable({
    ...brief,
    status: 'accepted',
    acceptedAt,
    acceptedBy: input.subjectId,
    inputRightsAcceptanceId: input.inputRightsAcceptanceId,
    updatedAt: acceptedAt,
  });
}

export function rejectUrlToAdBrief(brief, input) {
  if (!BRIEF_TRANSITIONS[brief?.status]?.has('rejected') || !input?.subjectId || !input.reason) {
    throw new UrlToAdError('a draft, rejecting subject, and reason are required');
  }
  const rejectedAt = timestamp(input.rejectedAt);
  return immutable({ ...brief, status: 'rejected', rejectedAt, rejectedBy: input.subjectId, rejectionReason: input.reason, updatedAt: rejectedAt });
}

export class UrlToAdError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UrlToAdError';
    this.code = 'URL_TO_AD_CONFLICT';
  }
}

function safeHttpUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new UrlToAdError('a valid product URL is required');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new UrlToAdError('product URL must use HTTP(S) without embedded credentials');
  return url.toString();
}

function positiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 1) throw new UrlToAdError(`${field} must be a positive safe integer`);
  return value;
}

function timestamp(value) {
  const result = value ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(result))) throw new UrlToAdError('valid timestamp is required');
  return result;
}

function immutable(value) {
  return deepFreeze(structuredClone(value));
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

export { BRIEF_TRANSITIONS };
