/**
 * Foundry AI-infrastructure audit — sanitized evidence for Free AI and
 * Knowledge Base.
 *
 * Pure helpers for the `ai-infrastructure-toolbox-automation` capability.
 * The CLI wrapper (`scripts/fleet-ai-infra-audit.mjs`) calls these against
 * the live routes declared in `FLEET_HEALTH_CONTRACTS` and emits a sanitized
 * JSON + Markdown snapshot for Foundry.
 *
 * Privacy contract:
 *   - No prompts, completions, retrieved chunks, corpus text, or
 *     authorization headers are read or persisted.
 *   - Only route name, HTTP status, latency bucket, provider class,
 *     quota/degradation flag, daily budget utilization, storage ownership,
 *     and recovery owner are emitted.
 *   - Any credential-shaped string in a response body is redacted before the
 *     snapshot is built.
 */
import { FLEET_HEALTH_CONTRACTS } from './fleet-health-contracts.mjs';

export const AI_INFRA_PROJECTS = ['free-ai', 'knowledge-base'];

// Credential-shaped patterns we redact from any response body that slips into
// evidence. Bodies are normally not captured at all; this is a defense in
// depth for error payloads. The final pattern is deliberately conservative
// and may also redact opaque non-secret identifiers.
const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /authorization:\s*bearer\s+[^\s]+/gi,
  /X-RAG-Key:\s*[^\s]+/gi,
  /x-api-key:\s*[^\s]+/gi,
  /sk-[A-Za-z0-9_-]{16,}/g,
  /pk_[A-Za-z0-9_-]{16,}/g,
  /AIza[A-Za-z0-9_-]{30,}/g,
  /[A-Za-z0-9_-]{40,}/g, // last-resort: long opaque tokens
];

const REDACTED = '[redacted]';

/**
 * Redact credential-shaped substrings from a string.
 */
export function redactSecrets(input) {
  if (typeof input !== 'string') return input;
  let out = input;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, REDACTED);
  }
  return out;
}

/**
 * Return the AI-infrastructure contract for a project, or null if it has not
 * opted into the `ai-infrastructure-toolbox-automation` capability.
 */
export function getAiInfraContract(project) {
  const contract = FLEET_HEALTH_CONTRACTS[project];
  if (!contract?.automation?.capability) return null;
  if (contract.automation.capability !== 'ai-infrastructure-toolbox-automation') return null;
  return contract;
}

export function listAiInfraProjects() {
  return AI_INFRA_PROJECTS.filter((project) => getAiInfraContract(project));
}

/**
 * Validate that an AI-infrastructure contract satisfies the spec minimum:
 * auth-safe probes, a protected probe that proves fail-closed auth, a
 * freshness declaration, a privacy declaration, at least one storage entry
 * with a reconstruction path, and (for Free AI) provider cost/degradation
 * evidence.
 */
export function validateAiInfraContract(project) {
  const contract = getAiInfraContract(project);
  if (!contract) {
    return { ok: false, project, errors: ['missing ai-infrastructure contract'] };
  }
  const errors = [];
  const { automation, providerEvidence, jobs, storage } = contract;

  if (!automation?.authSafeProbes?.length) {
    errors.push('automation.authSafeProbes must list at least one auth-safe probe');
  }
  if (!automation?.protectedProbe) {
    errors.push('automation.protectedProbe must prove fail-closed auth');
  }
  if (!automation?.freshness?.mode) {
    errors.push('automation.freshness.mode must be declared');
  }
  if (typeof providerEvidence?.privacy?.storesPromptText !== 'boolean') {
    errors.push('providerEvidence.privacy.storesPromptText must be declared');
  }
  if (typeof providerEvidence?.privacy?.storesRequestIds !== 'boolean') {
    errors.push('providerEvidence.privacy.storesRequestIds must be declared');
  }
  if (!Array.isArray(storage) || storage.length === 0) {
    errors.push('storage must list at least one store with a reconstruction path');
  } else {
    for (const entry of storage) {
      if (!entry.reconstruction) {
        errors.push(`storage[${entry.binding}].reconstruction must be declared`);
      }
      if (!entry.owner) {
        errors.push(`storage[${entry.binding}].owner must be declared`);
      }
    }
  }
  if (!Array.isArray(jobs)) {
    errors.push('jobs must be an array (may be empty for Free AI per-request fallback only)');
  }

  // Free AI must expose provider cost and degradation evidence.
  if (project === 'free-ai') {
    if (!providerEvidence?.costCap) {
      errors.push('free-ai providerEvidence.costCap must be declared');
    }
    if (!providerEvidence?.degradationRoute) {
      errors.push('free-ai providerEvidence.degradationRoute must be declared');
    }
    if (!providerEvidence?.quotaRoute) {
      errors.push('free-ai providerEvidence.quotaRoute must be declared');
    }
  }

  return { ok: errors.length === 0, project, errors };
}

/**
 * Build a sanitized evidence entry from a single probe result.
 * `rawBody` is optional and is redacted before being included (only the
 * first 200 chars are kept, and only when `includeBody` is true — used for
 * error diagnostics, never for success bodies).
 */
export function buildEvidenceEntry(project, probe, result, options = {}) {
  const okStatuses = probe.okStatuses ?? [200];
  const ok = okStatuses.includes(result.status);
  const entry = {
    project,
    label: probe.label,
    method: probe.method,
    path: probe.path,
    status: result.status,
    ok,
    durationMs: result.durationMs ?? null,
  };
  if (!ok && options.includeBody && result.body) {
    entry.bodyPreview = redactSecrets(String(result.body).slice(0, 200));
  }
  return entry;
}

/**
 * Classify provider degradation from a `/v1/routing/status` payload.
 * Returns 'available' | 'degraded' | 'cooldown' | 'exhausted' | 'unknown'.
 * A single provider in a non-available state is degradation, not outage.
 *
 * The payload shape is `{ summary: { available_models, degraded_models,
 * cooldown_models, exhausted_models, fallback_ready }, fallback_order: [...] }`.
 */
export function classifyProviderDegradation(routingStatusPayload) {
  if (!routingStatusPayload || typeof routingStatusPayload !== 'object') {
    return 'unknown';
  }
  const summary = routingStatusPayload.summary ?? {};
  const available = summary.available_models ?? 0;
  const degraded = summary.degraded_models ?? 0;
  const cooldown = summary.cooldown_models ?? 0;
  const exhausted = summary.exhausted_models ?? 0;
  const total = available + degraded + cooldown + exhausted;
  if (total === 0) return 'unknown';
  if (degraded > 0) return 'degraded';
  if (cooldown > 0) return 'cooldown';
  if (exhausted > 0 && available === 0) return 'exhausted';
  if (available > 0 && degraded === 0 && cooldown === 0 && exhausted === 0) return 'available';
  return 'degraded';
}

/**
 * Distinguish total gateway failure (no available provider) from partial
 * degradation. Returns 'ok' | 'degraded' | 'outage' | 'unknown'.
 */
export function classifyGatewayAvailability(routingStatusPayload) {
  if (!routingStatusPayload || typeof routingStatusPayload !== 'object') {
    return 'unknown';
  }
  const summary = routingStatusPayload.summary ?? {};
  const available = summary.available_models ?? 0;
  const fallbackReady = summary.fallback_ready === true;
  if (available > 0 || fallbackReady) {
    const degradation = classifyProviderDegradation(routingStatusPayload);
    return degradation === 'available' ? 'ok' : 'degraded';
  }
  return 'outage';
}

/**
 * Summarize Workers AI Neuron budget utilization from a `/v1/budget` payload.
 * Returns null when the binding is unavailable (503).
 */
export function summarizeNeuronBudget(budgetPayload) {
  if (!budgetPayload || typeof budgetPayload !== 'object') return null;
  const used = typeof budgetPayload.daily_used === 'number' ? budgetPayload.daily_used : null;
  const limit = typeof budgetPayload.daily_limit === 'number' ? budgetPayload.daily_limit : null;
  if (used === null || limit === null || limit <= 0) return null;
  return {
    used,
    limit,
    utilization: used / limit,
    headroom: limit - used,
    overCap: used > limit,
  };
}

/**
 * Classify Knowledge Base corpus freshness from a corpus-status payload and
 * the last ingest job timestamp. Returns 'stable' | 'ingesting' | 'stale' |
 * 'failed' | 'unknown'.
 *
 * Freshness model: corpora are opt-in and do not auto-refresh. A domain in
 * `ingesting` with no recent job progress is stale. A domain in `failed` is
 * failed. A domain in `ready` with no recent job is stable (not stale).
 */
export function classifyCorpusFreshness(domainStatus, lastJobAtMs, nowMs = Date.now()) {
  if (!domainStatus || typeof domainStatus !== 'object') return 'unknown';
  const state = domainStatus.state;
  if (state === 'failed') return 'failed';
  if (state === 'ingesting') {
    if (typeof lastJobAtMs !== 'number') return 'stale';
    const ageMs = nowMs - lastJobAtMs;
    // 30-minute stale threshold for an "ingesting" domain with no progress.
    if (ageMs > 30 * 60 * 1000) return 'stale';
    return 'ingesting';
  }
  if (state === 'ready' || state === 'schema_ready' || state === 'files_staged') return 'stable';
  if (state === 'schema_draft' || state === 'no_schema') return 'stable';
  return 'unknown';
}

/**
 * Build the sanitized Foundry snapshot from contract + probe results.
 * `probeResults` is a map of `${project}:${probe.label}` -> { status, durationMs, body? }.
 * `payloads` is an optional map of `${project}:routing-status` / `${project}:budget`
 * / `${project}:health` parsed JSON payloads for higher-fidelity evidence.
 */
export function buildAiInfraSnapshot(probeResults = {}, payloads = {}, options = {}) {
  const generatedAt = new Date().toISOString();
  const allProjects = listAiInfraProjects();
  const projects = options.selectedProjects ?? allProjects;
  const unknownProjects = projects.filter((project) => !allProjects.includes(project));
  if (unknownProjects.length > 0) {
    throw new Error(`Unknown AI-infrastructure project(s): ${unknownProjects.join(', ')}`);
  }
  // A scoped live run still validates every declared contract so drift in the
  // unselected project cannot disappear from the result.
  const contractValidation = allProjects.map((project) => validateAiInfraContract(project));

  const projectSnapshots = projects.map((project) => {
    const contract = getAiInfraContract(project);
    const evidence = [];
    for (const probe of contract.automation.authSafeProbes) {
      const result = probeResults[`${project}:${probe.label}`];
      if (result) {
        evidence.push(buildEvidenceEntry(project, probe, result, options));
      }
    }
    const protectedProbe = contract.automation.protectedProbe;
    const protectedResult = probeResults[`${project}:${protectedProbe.label}`];
    const protectedEvidence = protectedResult
      ? buildEvidenceEntry(project, protectedProbe, protectedResult, options)
      : null;

    const snapshot = {
      project,
      displayName: contract.displayName,
      capability: contract.automation.capability,
      authority: contract.automation.authority,
      freshness: contract.automation.freshness,
      privacy: contract.providerEvidence.privacy,
      jobs: contract.jobs,
      storage: contract.storage,
      evidence,
      protectedEvidence,
    };

    if (project === 'free-ai') {
      const routingStatus = payloads[`${project}:routing-status`];
      const budget = payloads[`${project}:budget`];
      snapshot.providerEvidence = {
        costCap: contract.providerEvidence.costCap,
        routingPolicy: contract.providerEvidence.routingPolicy,
        availability: classifyGatewayAvailability(routingStatus),
        degradation: classifyProviderDegradation(routingStatus),
        neuronBudget: summarizeNeuronBudget(budget),
        quotaRoute: contract.providerEvidence.quotaRoute,
        degradationRoute: contract.providerEvidence.degradationRoute,
      };
    }

    if (project === 'knowledge-base') {
      const health = payloads[`${project}:health`];
      snapshot.runtimeReadiness = health
        ? {
            ok: Boolean(health.ok),
            d1: Boolean(health.d1),
            d1Schema: Boolean(health.d1_schema),
            vectorize: Boolean(health.vectorize),
            r2: Boolean(health.r2),
            deployFingerprint: health.deploy_fingerprint ?? null,
          }
        : null;
    }

    return snapshot;
  });

  const allEvidence = projectSnapshots.flatMap((s) => [
    ...s.evidence,
    ...(s.protectedEvidence ? [s.protectedEvidence] : []),
  ]);
  const failedEvidence = allEvidence.filter((entry) => !entry.ok);
  const contractOk = contractValidation.every((v) => v.ok);

  return {
    generatedAt,
    capability: 'ai-infrastructure-toolbox-automation',
    authority: 'maintenance-only',
    contractOk,
    contractValidation,
    projects: projectSnapshots,
    summary: {
      projects: projects.length,
      probes: allEvidence.length,
      failedProbes: failedEvidence.length,
      contractErrors: contractValidation.flatMap((v) => v.errors),
    },
    privacy: {
      storesPromptText: false,
      storesRequestIds: false,
      storesCorpusContent: false,
      storesAuthorizationHeaders: false,
      redactionApplied: true,
    },
  };
}

/**
 * Render the snapshot as Foundry-friendly Markdown.
 */
export function renderAiInfraMarkdown(snapshot) {
  const lines = [
    '# AI Infrastructure Toolbox — Foundry Evidence Snapshot',
    '',
    `Generated: ${snapshot.generatedAt}`,
    '',
    '## Capability',
    '',
    `- **Name:** \`${snapshot.capability}\``,
    `- **Authority:** ${snapshot.authority}`,
    `- **Contract OK:** ${snapshot.contractOk ? 'yes' : 'no'}`,
    `- **Privacy:** storesPromptText=${snapshot.privacy.storesPromptText}, storesRequestIds=${snapshot.privacy.storesRequestIds}, storesCorpusContent=${snapshot.privacy.storesCorpusContent}, redactionApplied=${snapshot.privacy.redactionApplied}`,
    '',
    '## Summary',
    '',
    `| Projects | Probes | Failed probes | Contract errors |`,
    `| --- | ---: | ---: | ---: |`,
    `| ${snapshot.summary.projects} | ${snapshot.summary.probes} | ${snapshot.summary.failedProbes} | ${snapshot.summary.contractErrors.length} |`,
    '',
  ];

  for (const project of snapshot.projects) {
    lines.push(`## ${project.displayName} (\`${project.project}\`)`, '');
    lines.push(`- **Freshness:** ${project.freshness.mode} — ${project.freshness.note}`);
    lines.push(
      `- **Privacy:** storesPromptText=${project.privacy.storesPromptText}, storesRequestIds=${project.privacy.storesRequestIds}`
    );
    if (project.providerEvidence) {
      lines.push(`- **Provider availability:** ${project.providerEvidence.availability}`);
      lines.push(`- **Provider degradation:** ${project.providerEvidence.degradation}`);
      if (project.providerEvidence.neuronBudget) {
        const nb = project.providerEvidence.neuronBudget;
        lines.push(
          `- **Neuron budget:** ${nb.used}/${nb.limit} (${(nb.utilization * 100).toFixed(1)}%), headroom ${nb.headroom}, overCap ${nb.overCap}`
        );
      }
    }
    if (project.runtimeReadiness) {
      const r = project.runtimeReadiness;
      lines.push(
        `- **Runtime readiness:** ok=${r.ok}, d1=${r.d1}, d1Schema=${r.d1Schema}, vectorize=${r.vectorize}, r2=${r.r2}`
      );
      lines.push(`- **Deploy fingerprint:** ${r.deployFingerprint ?? 'unknown'}`);
    }
    lines.push('', '### Evidence', '');
    lines.push('| Label | Method | Path | Status | OK | Duration (ms) |');
    lines.push('| --- | --- | --- | ---: | :---: | ---: |');
    for (const entry of project.evidence) {
      lines.push(
        `| ${entry.label} | ${entry.method} | ${entry.path} | ${entry.status ?? 'null'} | ${entry.ok ? 'yes' : 'no'} | ${entry.durationMs ?? 'null'} |`
      );
    }
    if (project.protectedEvidence) {
      const p = project.protectedEvidence;
      lines.push(
        `| ${p.label} | ${p.method} | ${p.path} | ${p.status ?? 'null'} | ${p.ok ? 'yes' : 'no'} | ${p.durationMs ?? 'null'} |`
      );
    }

    lines.push('', '### Jobs', '');
    if (project.jobs.length === 0) {
      lines.push('None.');
    } else {
      lines.push(
        '| Job | Trigger | Bounds | Timeout (ms) | Retries | Idempotency | Failure state | Owner |'
      );
      lines.push('| --- | --- | --- | ---: | --- | --- | --- | --- |');
      for (const job of project.jobs) {
        lines.push(
          `| ${job.name} | ${job.trigger} | ${job.bounds} | ${job.timeoutMs ?? 'null'} | ${job.retries} | ${job.idempotency} | ${job.failureState} | ${job.owner} |`
        );
      }
    }

    lines.push('', '### Storage', '');
    lines.push('| Binding | Kind | Owner | Source | Reconstruction | Migration guard |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const entry of project.storage) {
      lines.push(
        `| ${entry.binding} | ${entry.kind} | ${entry.owner} | ${entry.source} | ${entry.reconstruction} | ${entry.migrationGuard} |`
      );
    }
    lines.push('');
  }

  if (snapshot.summary.contractErrors.length > 0) {
    lines.push('## Contract errors', '');
    for (const err of snapshot.summary.contractErrors) lines.push(`- ${err}`);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}
