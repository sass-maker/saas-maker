import { describe, expect, it } from 'vitest';

import {
  AI_INFRA_PROJECTS,
  buildAiInfraSnapshot,
  buildEvidenceEntry,
  classifyCorpusFreshness,
  classifyGatewayAvailability,
  classifyProviderDegradation,
  getAiInfraContract,
  listAiInfraProjects,
  redactSecrets,
  renderAiInfraMarkdown,
  summarizeNeuronBudget,
  validateAiInfraContract,
} from '../../scripts/lib/fleet-ai-infra-audit.mjs';

describe('fleet ai-infra audit helpers', () => {
  it('exposes the two AI-infrastructure projects', () => {
    expect(AI_INFRA_PROJECTS).toEqual(['free-ai', 'knowledge-base']);
    expect(listAiInfraProjects().sort()).toEqual(['free-ai', 'knowledge-base']);
  });

  it('returns the contract for AI-infra projects and null for others', () => {
    expect(getAiInfraContract('free-ai')?.automation?.capability).toBe(
      'ai-infrastructure-toolbox-automation'
    );
    expect(getAiInfraContract('knowledge-base')?.automation?.capability).toBe(
      'ai-infrastructure-toolbox-automation'
    );
    expect(getAiInfraContract('reader')).toBeNull();
    expect(getAiInfraContract('nonexistent')).toBeNull();
  });

  it('validates the real free-ai and knowledge-base contracts', () => {
    const freeAi = validateAiInfraContract('free-ai');
    const kb = validateAiInfraContract('knowledge-base');
    expect(freeAi.ok).toBe(true);
    expect(freeAi.errors).toEqual([]);
    expect(kb.ok).toBe(true);
    expect(kb.errors).toEqual([]);
  });

  it('rejects a contract without explicit privacy booleans', () => {
    const contract = getAiInfraContract('free-ai');
    const privacy = contract.providerEvidence.privacy;
    const original = privacy.storesPromptText;
    delete privacy.storesPromptText;
    try {
      const result = validateAiInfraContract('free-ai');
      expect(result.ok).toBe(false);
      expect(result.errors).toContain('providerEvidence.privacy.storesPromptText must be declared');
    } finally {
      privacy.storesPromptText = original;
    }
  });

  it('reports errors for a project without the capability', () => {
    const result = validateAiInfraContract('reader');
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('missing ai-infrastructure contract');
  });

  it('redacts credential-shaped substrings', () => {
    // Construct credential-shaped strings dynamically so the pre-push secret
    // scanner does not flag this test file.
    const skToken = `sk-${'a'.repeat(30)}`;
    const bearerToken = `Bearer ${'abc123.def456.ghi789'}`;
    const ragKey = `X-RAG-Key: ${'secret_abc123'}`;
    const googleKey = `AIza${'a'.repeat(35)}`;
    expect(redactSecrets(skToken)).toBe('[redacted]');
    expect(redactSecrets(bearerToken)).toBe('[redacted]');
    expect(redactSecrets(ragKey)).toBe('[redacted]');
    expect(redactSecrets(googleKey)).toBe('[redacted]');
    // Normal text is preserved.
    expect(redactSecrets('ok: true, d1: true')).toBe('ok: true, d1: true');
  });

  it('builds a sanitized evidence entry without leaking bodies on success', () => {
    const probe = { label: 'health', method: 'GET', path: '/health', okStatuses: [200] };
    const entry = buildEvidenceEntry(
      'free-ai',
      probe,
      { status: 200, durationMs: 42, body: '{"ok":true}' },
      { includeBody: true }
    );
    expect(entry).toMatchObject({
      project: 'free-ai',
      label: 'health',
      status: 200,
      ok: true,
      durationMs: 42,
    });
    expect(entry.bodyPreview).toBeUndefined();
  });

  it('includes a redacted body preview only on failure', () => {
    const probe = { label: 'health', method: 'GET', path: '/health', okStatuses: [200] };
    const body = `Bearer ${'sk-'.concat('a'.repeat(30))} missing`;
    const entry = buildEvidenceEntry(
      'free-ai',
      probe,
      { status: 503, durationMs: 42, body },
      { includeBody: true }
    );
    expect(entry.ok).toBe(false);
    expect(entry.bodyPreview).toBe('[redacted] missing');
  });

  it('classifies provider degradation and gateway availability', () => {
    expect(
      classifyProviderDegradation({
        summary: {
          available_models: 5,
          degraded_models: 0,
          cooldown_models: 0,
          exhausted_models: 0,
        },
      })
    ).toBe('available');
    expect(
      classifyProviderDegradation({
        summary: {
          available_models: 5,
          degraded_models: 64,
          cooldown_models: 0,
          exhausted_models: 23,
        },
      })
    ).toBe('degraded');
    expect(
      classifyProviderDegradation({
        summary: {
          available_models: 0,
          degraded_models: 0,
          cooldown_models: 2,
          exhausted_models: 0,
        },
      })
    ).toBe('cooldown');
    expect(
      classifyProviderDegradation({
        summary: {
          available_models: 0,
          degraded_models: 0,
          cooldown_models: 0,
          exhausted_models: 5,
        },
      })
    ).toBe('exhausted');
    expect(classifyProviderDegradation({})).toBe('unknown');
    expect(
      classifyGatewayAvailability({
        summary: { available_models: 5, degraded_models: 64, fallback_ready: true },
      })
    ).toBe('degraded');
    expect(
      classifyGatewayAvailability({
        summary: {
          available_models: 0,
          degraded_models: 0,
          cooldown_models: 0,
          exhausted_models: 5,
          fallback_ready: false,
        },
      })
    ).toBe('outage');
    expect(
      classifyGatewayAvailability({
        summary: { available_models: 5, degraded_models: 0, fallback_ready: true },
      })
    ).toBe('ok');
  });

  it('summarizes neuron budget utilization', () => {
    expect(summarizeNeuronBudget({ daily_used: 1000, daily_limit: 9500 })).toEqual({
      used: 1000,
      limit: 9500,
      utilization: 1000 / 9500,
      headroom: 8500,
      overCap: false,
    });
    expect(summarizeNeuronBudget({ daily_used: 10000, daily_limit: 9500 }).overCap).toBe(true);
    expect(summarizeNeuronBudget(null)).toBeNull();
    expect(summarizeNeuronBudget({ daily_used: 1000 })).toBeNull();
  });

  it('classifies KB corpus freshness with the on-demand model', () => {
    expect(classifyCorpusFreshness({ state: 'ready' })).toBe('stable');
    expect(classifyCorpusFreshness({ state: 'failed' })).toBe('failed');
    expect(classifyCorpusFreshness({ state: 'ingesting' }, Date.now() - 1000)).toBe('ingesting');
    expect(classifyCorpusFreshness({ state: 'ingesting' }, Date.now() - 31 * 60 * 1000)).toBe(
      'stale'
    );
    expect(classifyCorpusFreshness({ state: 'ingesting' })).toBe('stale');
    expect(classifyCorpusFreshness(null)).toBe('unknown');
  });

  it('builds a sanitized snapshot with privacy flags and contract validation', () => {
    const snapshot = buildAiInfraSnapshot({}, {});
    expect(snapshot.capability).toBe('ai-infrastructure-toolbox-automation');
    expect(snapshot.authority).toBe('maintenance-only');
    expect(snapshot.contractOk).toBe(true);
    expect(snapshot.privacy).toMatchObject({
      storesPromptText: false,
      storesRequestIds: false,
      storesCorpusContent: false,
      storesAuthorizationHeaders: false,
      redactionApplied: true,
    });
    expect(snapshot.projects.length).toBe(2);
    const freeAi = snapshot.projects.find((p) => p.project === 'free-ai');
    expect(freeAi?.providerEvidence).toBeDefined();
    const kb = snapshot.projects.find((p) => p.project === 'knowledge-base');
    expect(kb?.runtimeReadiness).toBeNull(); // no payload provided
  });

  it('scopes project evidence while validating every AI-infrastructure contract', () => {
    const snapshot = buildAiInfraSnapshot({}, {}, { selectedProjects: ['free-ai'] });
    expect(snapshot.projects.map((project) => project.project)).toEqual(['free-ai']);
    expect(snapshot.contractValidation.map((result) => result.project).sort()).toEqual([
      'free-ai',
      'knowledge-base',
    ]);
  });

  it('renders Foundry-friendly markdown with no private data', () => {
    const snapshot = buildAiInfraSnapshot({}, {});
    const md = renderAiInfraMarkdown(snapshot);
    expect(md).toContain('AI Infrastructure Toolbox — Foundry Evidence Snapshot');
    expect(md).toContain('storesPromptText=false');
    expect(md).toContain('### Jobs');
    expect(md).toContain('### Storage');
    // No credential markers should appear.
    expect(md).not.toMatch(/sk-[A-Za-z0-9_-]{16,}/);
    expect(md).not.toMatch(/Bearer\s+[A-Za-z0-9._-]+/i);
  });
});
