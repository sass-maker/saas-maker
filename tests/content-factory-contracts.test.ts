import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  isContentFactoryManifestDistributionReady,
  validateApprovedContentFactoryBrief,
  validateContentFactoryArtifactManifest,
} from '../internal/contracts/content-factory';

const fixture = JSON.parse(
  readFileSync('tests/fixtures/postiz/content-factory-v1.json', 'utf8')
) as Record<string, unknown>;

describe('Content Factory v1 contracts', () => {
  it('accepts an approved versioned brief and rejects unapproved generation input', () => {
    expect(validateApprovedContentFactoryBrief(fixture.approvedBrief)).toMatchObject({ ok: true });
    const result = validateApprovedContentFactoryBrief(fixture.unapprovedBrief);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.issues).toContain('content_approval.status must be approved before generation');
  });

  it('validates immutable manifest evidence and reports distribution readiness', () => {
    const result = validateContentFactoryArtifactManifest(fixture.approvedManifest);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(isContentFactoryManifestDistributionReady(result.value)).toBe(true);
      expect(Object.isFrozen(result.value)).toBe(true);
      expect(Object.isFrozen(result.value.assets)).toBe(true);
      expect(Object.isFrozen(result.value.assets[0])).toBe(true);
    }
  });

  it('keeps failed quality evidence valid but ineligible for distribution', () => {
    const manifest = structuredClone(fixture.approvedManifest) as Record<string, unknown>;
    const quality = manifest.quality as { status: string; checks: Array<{ status: string }> };
    quality.status = 'failed';
    quality.checks[0]!.status = 'failed';
    const result = validateContentFactoryArtifactManifest(manifest);
    expect(result.ok).toBe(true);
    if (result.ok) expect(isContentFactoryManifestDistributionReady(result.value)).toBe(false);
  });
});
