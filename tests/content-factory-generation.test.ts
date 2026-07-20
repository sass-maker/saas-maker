import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildArtifactManifest,
  contentFactoryRenderer,
  hashCanonicalJson,
  validateArtifactManifest as validateRuntimeManifest,
} from '../services/content-factory/src/manifest.js';
import { validateContentFactoryArtifactManifest } from '../internal/contracts/content-factory';

const contractFixture = JSON.parse(
  readFileSync('tests/fixtures/postiz/content-factory-v1.json', 'utf8')
) as Record<string, Record<string, unknown>>;
const engineFixture = JSON.parse(
  readFileSync('tests/fixtures/content-factory/render-engine-manifests-v1.json', 'utf8')
) as { engines: Array<{ mode: string; provider: string; file: string; content: string }> };
const renderModes = JSON.parse(
  readFileSync('services/reel-pipeline/config/render-modes.json', 'utf8')
) as { modes: Array<{ id: string }> };

describe('Content Factory generation wrapper', () => {
  it('rejects an unapproved v1 brief before invoking a renderer', async () => {
    let called = false;
    const renderer = contentFactoryRenderer({
      async createVideo() {
        called = true;
        return {};
      },
    });

    await expect(renderer.createVideo(contractFixture.unapprovedBrief)).rejects.toThrow(
      'content_approval.status must be approved before generation'
    );
    expect(called).toBe(false);
  });

  it('normalizes every configured engine into the existing validated manifest contract', async () => {
    expect(engineFixture.engines.map((entry) => entry.mode).sort()).toEqual(
      renderModes.modes.map((entry) => entry.id).sort()
    );
    const root = mkdtempSync(path.join(os.tmpdir(), 'content-factory-engines-'));
    try {
      for (const [index, fixture] of engineFixture.engines.entries()) {
        const artifactPath = path.join(root, fixture.file);
        writeFileSync(artifactPath, fixture.content);
        const brief = structuredClone(contractFixture.approvedBrief);
        brief.input_hash = hashCanonicalJson({ fixture: fixture.mode });
        const manifest = await buildArtifactManifest({
          brief,
          render: {
            provider: fixture.provider,
            externalTaskId: `fixture-${fixture.mode}-${index}`,
            status: 'completed',
            artifacts: [artifactPath],
          },
          variantId: `variant-${fixture.mode}`,
          now: new Date('2026-07-20T10:00:00.000Z'),
        });

        expect(validateRuntimeManifest(manifest)).toMatchObject({ ok: true });
        expect(validateContentFactoryArtifactManifest(manifest)).toMatchObject({ ok: true });
        expect(manifest.renderer.id).toBe(fixture.provider);
        expect(manifest.assets[0]?.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(manifest.provenance).toEqual([brief.source]);
        expect(manifest.quality).toMatchObject({ status: 'review' });
        expect(manifest.review).toMatchObject({ stage: 'artifact_review', status: 'pending' });
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
