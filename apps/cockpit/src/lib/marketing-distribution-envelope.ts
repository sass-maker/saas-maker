const MARKER = 'fleet_distribution_v1:';

export type MarketingDistributionSummary = {
  packageId: string;
  packageRevision: number;
  variantId: string | null;
  contentApprovalStatus: 'pending' | 'proposed' | 'approved' | 'rejected';
  mediaStatus: 'pending' | 'rendered';
  artifactVerificationStatus: 'verified' | 'unmeasured';
  approvalStatus: 'pending' | 'proposed' | 'approved' | 'rejected';
  scheduledFor: string | null;
  attemptState: string;
  attemptCount: number;
  publicationStatus: string | null;
};

type Envelope = {
  schema: 'fleet.distribution-envelope.v1';
  contentPackage: {
    id: string;
    revision: number;
    approval?: { status?: 'proposed' | 'approved' | 'rejected' };
  };
  mediaReceipt: { status: 'rendered'; variantId: string } | null;
  distributionRequest: {
    scheduledFor: string | null;
    accountSlug: string | null;
    approval: {
      status: 'proposed' | 'approved' | 'rejected';
      approvedAt: string | null;
      approvedBy: string | null;
    };
  } | null;
  publicationReceipt: { status?: string; externalUrl?: string | null } | null;
  attempts: { state: string; count: number; lastError?: string | null };
};

export function parseMarketingDistributionEnvelope(
  notes: string | null | undefined
): Envelope | null {
  if (!notes) return null;
  const line = notes.split(/\r?\n/).find((entry) => entry.startsWith(MARKER));
  if (!line) return null;
  const payload = JSON.parse(
    Buffer.from(line.slice(MARKER.length).trim(), 'base64url').toString('utf8')
  ) as Envelope;
  if (payload.schema !== 'fleet.distribution-envelope.v1' || !payload.contentPackage?.id)
    throw new Error('Invalid Fleet distribution envelope');
  return payload;
}

export function marketingDistributionSummary(
  notes: string | null | undefined
): MarketingDistributionSummary | null {
  const envelope = parseMarketingDistributionEnvelope(notes);
  if (!envelope) return null;
  return {
    packageId: envelope.contentPackage.id,
    packageRevision: envelope.contentPackage.revision,
    variantId: envelope.mediaReceipt?.variantId ?? null,
    contentApprovalStatus: envelope.contentPackage.approval?.status ?? 'pending',
    mediaStatus: envelope.mediaReceipt?.status ?? 'pending',
    artifactVerificationStatus: 'unmeasured',
    approvalStatus:
      envelope.distributionRequest?.approval.status ??
      (envelope.mediaReceipt ? 'proposed' : 'pending'),
    scheduledFor: envelope.distributionRequest?.scheduledFor ?? null,
    attemptState: envelope.attempts?.state ?? 'idle',
    attemptCount: envelope.attempts?.count ?? 0,
    publicationStatus: envelope.publicationReceipt?.status ?? null,
  };
}

export function marketingNotesForClient(notes: string | null | undefined) {
  if (!notes) return null;
  const retained = notes
    .split(/\r?\n/)
    .filter((line) => !line.startsWith(MARKER))
    .filter((line) => !line.trim().startsWith('posting_error:'))
    .filter(
      (line) => !/(authorization|bearer|api[_-]?key|password|secret|access[_-]?token)/i.test(line)
    )
    .join('\n')
    .trim();
  return retained || null;
}

export function updateMarketingDistributionApproval(
  notes: string,
  input: { action: 'approve' | 'reject'; actor: string; scheduledFor?: string | null; now?: Date }
) {
  const envelope = parseMarketingDistributionEnvelope(notes);
  if (!envelope?.mediaReceipt || !envelope.distributionRequest)
    throw new Error('Rendered media is required before distribution approval');
  const now = input.now ?? new Date();
  if (input.action === 'approve') {
    const scheduledFor = new Date(input.scheduledFor ?? now);
    if (Number.isNaN(scheduledFor.getTime())) throw new Error('scheduledFor must be a valid date');
    envelope.distributionRequest.scheduledFor = scheduledFor.toISOString();
    envelope.distributionRequest.approval = {
      status: 'approved',
      approvedAt: now.toISOString(),
      approvedBy: input.actor,
    };
  } else {
    envelope.distributionRequest.approval = {
      status: 'rejected',
      approvedAt: null,
      approvedBy: null,
    };
  }
  const encoded = Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64url');
  const retained = notes
    .split(/\r?\n/)
    .filter((line) => !line.startsWith(MARKER))
    .join('\n')
    .trim();
  return [retained, `${MARKER}${encoded}`].filter(Boolean).join('\n');
}
