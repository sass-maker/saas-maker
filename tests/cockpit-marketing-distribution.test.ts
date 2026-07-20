import { describe, expect, it } from 'vitest';

import {
  marketingNotesForClient,
  marketingDistributionSummary,
  updateMarketingDistributionApproval,
} from '../apps/cockpit/src/lib/marketing-distribution-envelope';

function notes() {
  const envelope = {
    schema: 'fleet.distribution-envelope.v1',
    contentPackage: { id: 'high-signal:proof', revision: 1 },
    mediaReceipt: { status: 'rendered', variantId: 'youtube-v1' },
    distributionRequest: {
      scheduledFor: null,
      accountSlug: 'high-signal-youtube',
      approval: { status: 'proposed', approvedAt: null, approvedBy: null },
    },
    publicationReceipt: null,
    attempts: { state: 'idle', count: 0 },
  };
  return `Operator note.\nfleet_distribution_v1:${Buffer.from(JSON.stringify(envelope)).toString('base64url')}`;
}

describe('marketing distribution envelope', () => {
  it('summarizes envelope state without returning unpublished content', () => {
    expect(marketingDistributionSummary(notes())).toEqual({
      packageId: 'high-signal:proof',
      packageRevision: 1,
      variantId: 'youtube-v1',
      contentApprovalStatus: 'pending',
      mediaStatus: 'rendered',
      artifactVerificationStatus: 'unmeasured',
      approvalStatus: 'proposed',
      scheduledFor: null,
      attemptState: 'idle',
      attemptCount: 0,
      publicationStatus: null,
    });
  });

  it('records a distinct owner distribution approval and schedule', () => {
    const updated = updateMarketingDistributionApproval(notes(), {
      action: 'approve',
      actor: 'owner@example.com',
      scheduledFor: '2026-07-13T10:00:00Z',
      now: new Date('2026-07-12T12:00:00Z'),
    });
    const summary = marketingDistributionSummary(updated);
    expect(summary?.approvalStatus).toBe('approved');
    expect(summary?.scheduledFor).toBe('2026-07-13T10:00:00.000Z');
    expect(updated.startsWith('Operator note.')).toBe(true);
  });

  it('cannot approve before media exists', () => {
    const raw = {
      schema: 'fleet.distribution-envelope.v1',
      contentPackage: { id: 'p', revision: 1 },
      mediaReceipt: null,
      distributionRequest: null,
      publicationReceipt: null,
      attempts: { state: 'idle', count: 0 },
    };
    expect(() =>
      updateMarketingDistributionApproval(
        `fleet_distribution_v1:${Buffer.from(JSON.stringify(raw)).toString('base64url')}`,
        { action: 'approve', actor: 'owner' }
      )
    ).toThrow(/Rendered media/);
  });

  it('removes the encoded envelope and credential-shaped errors from client notes', () => {
    const safe = marketingNotesForClient(
      `${notes()}\nposting_error: Bearer fixture-secret\nposting_error_category: network`
    );

    expect(safe).toBe('Operator note.\nposting_error_category: network');
    expect(safe).not.toContain('fleet_distribution_v1');
    expect(safe).not.toContain('high-signal-youtube');
    expect(safe).not.toContain('fixture-secret');
  });
});
