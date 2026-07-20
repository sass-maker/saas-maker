import type { ContentFactoryArtifactManifest } from '../../../../../internal/contracts/content-factory';
import {
  isContentFactoryManifestDistributionReady,
  validateContentFactoryArtifactManifest,
} from '../../../../../internal/contracts/content-factory';
import type { DeliveryMapping } from '../../../../../internal/contracts/distribution';
import {
  validateDistributionRequest,
  type DistributionRequest,
} from '../../../../../internal/contracts/distribution';
import type {
  DeliveryMappingRecord,
  DeliveryMappingRepository,
  ReplacementApproval,
} from '../../repositories/distribution';
import { translateDistributionRequest } from './translate';
import type {
  PostizGateway,
  PostizIntegration,
  PostizMediaReference,
  PostizPostRecord,
} from './types';

export interface HostLeaseEvidence {
  host_id: string;
  owned: boolean;
  healthy: boolean;
  observed_at: string;
  expires_at: string;
}

export interface PostizDeliveryInput {
  request: DistributionRequest;
  artifact: ContentFactoryArtifactManifest;
  media: PostizMediaReference[];
  hostLease: HostLeaseEvidence;
  replacementApproval?: ReplacementApproval;
}

export interface PostizDeliveryResult {
  outcome: 'created' | 'reused' | 'reconciled' | 'replaced';
  mapping: DeliveryMapping;
}

export class DistributionGateError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'DistributionGateError';
  }
}

export class PostizDistributionOrchestrator {
  constructor(
    private readonly gateway: PostizGateway,
    private readonly mappings: DeliveryMappingRepository,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async deliver(input: PostizDeliveryInput): Promise<PostizDeliveryResult> {
    this.assertStaticGates(input);

    const existing = await this.mappings.find(input.request);
    if (existing) return this.handleExisting(existing, input);

    this.assertHealthyLease(input.hostLease);
    const integration = await this.requireIntegration(input.request);
    const reservation = await this.mappings.reserve(input.request, integration.identifier);
    if (!reservation.created) return this.handleExisting(reservation.mapping, input);

    return this.createReserved(reservation.mapping, input, 'created');
  }

  private async handleExisting(
    mapping: DeliveryMappingRecord,
    input: PostizDeliveryInput
  ): Promise<PostizDeliveryResult> {
    if (mapping.state === 'mapped' && mapping.provider_post_id) {
      return { outcome: 'reused', mapping: toContract(mapping) };
    }
    if (mapping.state === 'reserved' || mapping.state === 'replacement_approved') {
      throw gate('DELIVERY_IN_FLIGHT', 'A delivery reservation already exists; no create was made');
    }
    if (mapping.state === 'ambiguous') {
      const reconciledAt = this.now();
      const reconciled = await this.reconcile(mapping, input.request, reconciledAt);
      if (reconciled) return { outcome: 'reconciled', mapping: toContract(reconciled) };
      this.assertReplacementApproval(input.replacementApproval, reconciledAt);
    } else {
      this.assertReplacementApproval(input.replacementApproval, mapping.updated_at);
    }

    this.assertHealthyLease(input.hostLease);
    await this.requireIntegration(input.request);
    const replacement = await this.mappings.reserveReplacement(
      mapping.id,
      input.replacementApproval!
    );
    if (!replacement) {
      throw gate('REPLACEMENT_RESERVATION_FAILED', 'Replacement could not be reserved atomically');
    }
    return this.createReserved(replacement, input, 'replaced');
  }

  private async createReserved(
    mapping: DeliveryMappingRecord,
    input: PostizDeliveryInput,
    outcome: 'created' | 'replaced'
  ): Promise<PostizDeliveryResult> {
    this.assertStaticGates(input);
    this.assertHealthyLease(input.hostLease);
    if (mapping.state !== 'reserved' && mapping.state !== 'replacement_approved') {
      throw gate(
        'MAPPING_NOT_RESERVED',
        'A durable delivery reservation is required before create'
      );
    }

    try {
      const receipts = await this.gateway.createPost(
        translateDistributionRequest(input.request, input.media)
      );
      const receipt = receipts[0];
      if (
        receipts.length !== 1 ||
        !receipt ||
        receipt.integration !== input.request.integration_id
      ) {
        throw gate('AMBIGUOUS_CREATE_RECEIPT', 'Postiz returned an ambiguous create receipt');
      }
      const completed = await this.mappings.markMapped(mapping.id, receipt.postId);
      return { outcome, mapping: toContract(completed) };
    } catch (error) {
      await this.mappings.markAmbiguous(mapping.id);
      throw error;
    }
  }

  private async reconcile(
    mapping: DeliveryMappingRecord,
    request: DistributionRequest,
    reconciledAt: string
  ): Promise<DeliveryMappingRecord | null> {
    const expectedAt = request.scheduled_for ?? request.requested_at;
    const expectedMs = Date.parse(expectedAt);
    const hour = 60 * 60 * 1000;
    try {
      const posts = await this.gateway.listPosts({
        startDate: new Date(expectedMs - hour).toISOString(),
        endDate: new Date(expectedMs + hour).toISOString(),
      });
      const exact: PostizPostRecord[] = [];
      for (const post of posts) {
        if (
          post.integration.id !== request.integration_id ||
          Date.parse(post.publishDate) !== expectedMs ||
          (await this.mappings.isProviderPostMapped(post.id, mapping.id))
        ) {
          continue;
        }
        exact.push(post);
      }
      await this.mappings.recordReconciliation(mapping.id, reconciledAt);
      if (exact.length !== 1) return null;
      return this.mappings.markMapped(mapping.id, exact[0]!.id);
    } catch (error) {
      await this.mappings.recordReconciliation(mapping.id, reconciledAt);
      if (error instanceof DistributionGateError) throw error;
      throw gate('RECONCILIATION_FAILED', 'Ambiguous Postiz create could not be reconciled');
    }
  }

  private assertStaticGates(input: PostizDeliveryInput): void {
    const request = validateDistributionRequest(input.request);
    if (!request.ok) {
      throw gate('DISTRIBUTION_REQUEST_REJECTED', request.issues.join('; '));
    }
    const artifact = validateContentFactoryArtifactManifest(input.artifact);
    if (!artifact.ok || !isContentFactoryManifestDistributionReady(input.artifact)) {
      throw gate('ARTIFACT_NOT_VERIFIED', 'A verified, approved artifact receipt is required');
    }
    if (
      input.artifact.manifest_id !== input.request.artifact_manifest_id ||
      input.artifact.project_id !== input.request.project_id ||
      input.artifact.campaign_id !== input.request.campaign_id ||
      input.artifact.brief.id !== input.request.brief_id ||
      input.artifact.brief.version !== input.request.brief_version ||
      input.artifact.experiment_id !== input.request.experiment_id
    ) {
      throw gate(
        'ARTIFACT_ATTRIBUTION_MISMATCH',
        'Artifact receipt attribution does not match request'
      );
    }
    for (const requested of input.request.assets) {
      const verified = input.artifact.assets.find(
        (asset) => asset.id === requested.artifact_asset_id
      );
      if (
        !verified ||
        verified.sha256 !== requested.sha256 ||
        verified.location !== requested.location ||
        verified.media_type !== requested.media_type
      ) {
        throw gate('ARTIFACT_ASSET_MISMATCH', 'Distribution asset is not in the verified receipt');
      }
    }
  }

  private assertHealthyLease(lease: HostLeaseEvidence): void {
    const now = Date.parse(this.now());
    if (
      !lease.host_id.trim() ||
      !lease.owned ||
      !lease.healthy ||
      Number.isNaN(Date.parse(lease.observed_at)) ||
      Number.isNaN(Date.parse(lease.expires_at)) ||
      Date.parse(lease.observed_at) > now ||
      Date.parse(lease.expires_at) <= now
    ) {
      throw gate('HOST_LEASE_UNHEALTHY', 'The active host must own a healthy, unexpired lease');
    }
  }

  private async requireIntegration(request: DistributionRequest): Promise<PostizIntegration> {
    const health = await this.gateway.health();
    if (!health.connected) throw gate('POSTIZ_UNHEALTHY', 'Postiz is not connected');
    const integration = (await this.gateway.listIntegrations()).find(
      (candidate) => candidate.id === request.integration_id && !candidate.disabled
    );
    if (!integration || !integrationMatchesChannel(integration, request.channel)) {
      throw gate('INTEGRATION_UNAVAILABLE', 'Requested Postiz integration is unavailable');
    }
    return integration;
  }

  private assertReplacementApproval(
    approval: ReplacementApproval | undefined,
    notBefore: string
  ): asserts approval is ReplacementApproval {
    if (
      approval?.status !== 'approved' ||
      !approval.decided_by.trim() ||
      !approval.evidence_ref.trim() ||
      Number.isNaN(Date.parse(approval.decided_at)) ||
      Date.parse(approval.decided_at) < Date.parse(notBefore)
    ) {
      throw gate(
        'REPLACEMENT_APPROVAL_REQUIRED',
        'A replacement requires explicit approval recorded after reconciliation'
      );
    }
  }
}

function integrationMatchesChannel(
  integration: PostizIntegration,
  channel: DistributionRequest['channel']
): boolean {
  return channel === 'youtube_shorts'
    ? integration.identifier === 'youtube'
    : integration.identifier === 'instagram' || integration.identifier === 'instagram-standalone';
}

function toContract(mapping: DeliveryMappingRecord): DeliveryMapping {
  if (!mapping.provider_post_id) throw gate('MAPPING_INCOMPLETE', 'Delivery mapping is incomplete');
  return {
    schema_version: 1,
    mapping_id: mapping.id,
    distribution_request_id: mapping.distribution_request_id,
    content_hash: mapping.content_hash,
    integration_id: mapping.integration_id,
    provider: mapping.provider,
    provider_post_id: mapping.provider_post_id,
    state: 'mapped',
    created_at: mapping.created_at,
    updated_at: mapping.updated_at,
  };
}

function gate(code: string, message: string): DistributionGateError {
  return new DistributionGateError(code, message);
}
