import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Resilience snapshot contract.
 *
 * The contract is versioned so a future consolidation step can swap the
 * fixture/file adapter for a signed artifact or private API without
 * redesigning the UI: every consumer reads `ResilienceEnvelope`, never the
 * raw audit shape. Bump `schemaVersion` only on a breaking field change.
 *
 * Source: JSON emitted by `fleet-ops/scripts/cloudflare-resilience-audit.mjs`.
 * The adapter sanitizes anything that looks secret-shaped before it reaches
 * the page (see `sanitizeSnapshot`).
 */

export const RESILIENCE_SCHEMA_VERSION = 1;
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const SECRET_SHAPE = /\b(token|secret|key|password|auth|authorization|api[-_]?key|bearer|cookie|set[-_]?cookie|ip|x[-_]?forwarded)\b/i;

export type FindingSeverity = "high" | "medium" | "low" | "info";
export type ResilienceStatus = "healthy" | "warning" | "blocked" | "stale" | "unknown";

export type ResilienceFinding = {
  severity: FindingSeverity;
  category: string;
  surface: string;
  evidence: string;
  next_action: string;
};

export type ResilienceRepository = {
  id: string;
  repo: string | null;
  tracked_files: number;
  wrangler_configs: string[];
  workflows: string[];
};

export type ResilienceBackgroundJob = {
  id: string;
  repo: string | null;
  scheduled: boolean;
  async: boolean;
  timeout_or_bound: boolean;
  concurrency_or_lease: boolean;
  idempotency_or_dedup: boolean;
};

export type ResilienceDomainProbe = {
  domain: string;
  status: number | null;
  duration_ms: number;
  ok: boolean;
  error: string | null;
};

export type ResilienceCloudflareInventory = {
  pages_count: number | null;
  queues_count: number | null;
  workflows_count: number | null;
  error: string | null;
};

export type ResilienceSnapshot = {
  generated_at: string | null;
  live_checks: boolean;
  repository_scan: boolean;
  scope: { projects: number; domains: number };
  findings: ResilienceFinding[];
  evidence: {
    repositories: ResilienceRepository[];
    background_jobs: ResilienceBackgroundJob[];
  };
  live: {
    domain_probes: ResilienceDomainProbe[];
    cloudflare: ResilienceCloudflareInventory;
  };
  exit: { blocking: boolean; actionable: boolean };
};

export type ResilienceEnvelope = {
  schemaVersion: number;
  adapter: "audit-file" | "fixture";
  sourcedAt: string;
  stale: boolean;
  status: ResilienceStatus;
  snapshot: ResilienceSnapshot;
};

type RawFinding = Partial<Record<keyof ResilienceFinding, unknown>> & { severity?: unknown };

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => asString(v)).filter(Boolean) : [];
}

function isSecretShaped(text: string): boolean {
  return SECRET_SHAPE.test(text);
}

function sanitizeFinding(raw: RawFinding): ResilienceFinding {
  const severityRaw = asString(raw.severity, "info").toLowerCase();
  const severity: FindingSeverity =
    severityRaw === "high" || severityRaw === "medium" || severityRaw === "low" ? severityRaw : "info";
  const surface = asString(raw.surface);
  const evidence = asString(raw.evidence);
  const nextAction = asString(raw.next_action);
  return {
    severity,
    category: asString(raw.category, "uncategorized"),
    // Drop any field that looks like it leaks secret-shaped data.
    surface: isSecretShaped(surface) ? "[redacted surface]" : surface,
    evidence: isSecretShaped(evidence) ? "[redacted evidence]" : evidence,
    next_action: isSecretShaped(nextAction) ? "[redacted action]" : nextAction
  };
}

function sanitizeRepository(raw: Record<string, unknown>): ResilienceRepository {
  return {
    id: asString(raw.id),
    repo: raw.repo == null ? null : asString(raw.repo),
    tracked_files: asNumber(raw.tracked_files),
    wrangler_configs: asStringArray(raw.wrangler_configs).filter((p) => !isSecretShaped(p)),
    workflows: asStringArray(raw.workflows).filter((p) => !isSecretShaped(p))
  };
}

function sanitizeBackgroundJob(raw: Record<string, unknown>): ResilienceBackgroundJob {
  return {
    id: asString(raw.id),
    repo: raw.repo == null ? null : asString(raw.repo),
    scheduled: asBool(raw.scheduled),
    async: asBool(raw.async),
    timeout_or_bound: asBool(raw.timeout_or_bound),
    concurrency_or_lease: asBool(raw.concurrency_or_lease),
    idempotency_or_dedup: asBool(raw.idempotency_or_dedup)
  };
}

function sanitizeProbe(raw: Record<string, unknown>): ResilienceDomainProbe {
  // Redirect `location` headers and raw error payloads are intentionally not
  // surfaced on the public page; only domain, status, duration, and ok remain.
  return {
    domain: asString(raw.domain),
    status: raw.status == null ? null : asNumber(raw.status),
    duration_ms: asNumber(raw.duration_ms),
    ok: asBool(raw.ok),
    error: typeof raw.error === "string" && !isSecretShaped(raw.error) ? asString(raw.error) : null
  };
}

function sanitizeCloudflare(raw: unknown): ResilienceCloudflareInventory {
  if (!raw || typeof raw !== "object") {
    return { pages_count: null, queues_count: null, workflows_count: null, error: null };
  }
  const value = raw as Record<string, unknown>;
  const error = typeof value.error === "string" && !isSecretShaped(value.error) ? asString(value.error) : null;
  const pages = Array.isArray(value.pages) ? value.pages.length : null;
  const queues = typeof value.queues === "object" && value.queues !== null
    ? asNumber((value.queues as Record<string, unknown>).row_count, null as unknown as number) || null
    : null;
  const workflows = typeof value.workflows === "object" && value.workflows !== null
    ? asNumber((value.workflows as Record<string, unknown>).row_count, null as unknown as number) || null
    : null;
  return { pages_count: pages, queues_count: queues, workflows_count: workflows, error };
}

function sanitizeSnapshot(raw: Record<string, unknown>): ResilienceSnapshot {
  const evidence = (raw.evidence ?? {}) as Record<string, unknown>;
  const live = (raw.live ?? {}) as Record<string, unknown>;
  const scope = (raw.scope ?? {}) as Record<string, unknown>;
  const exit = (raw.exit ?? {}) as Record<string, unknown>;
  return {
    generated_at: typeof raw.generated_at === "string" ? raw.generated_at : null,
    live_checks: asBool(raw.live_checks),
    repository_scan: asBool(raw.repository_scan),
    scope: { projects: asNumber(scope.projects), domains: asNumber(scope.domains) },
    findings: Array.isArray(raw.findings)
      ? (raw.findings as Record<string, unknown>[]).map((f) => sanitizeFinding(f as RawFinding))
      : [],
    evidence: {
      repositories: Array.isArray(evidence.repositories)
        ? (evidence.repositories as Record<string, unknown>[]).map(sanitizeRepository)
        : [],
      background_jobs: Array.isArray(evidence.background_jobs)
        ? (evidence.background_jobs as Record<string, unknown>[]).map(sanitizeBackgroundJob)
        : []
    },
    live: {
      domain_probes: Array.isArray(live.domain_probes)
        ? (live.domain_probes as Record<string, unknown>[]).map(sanitizeProbe)
        : [],
      cloudflare: sanitizeCloudflare(live.cloudflare)
    },
    exit: { blocking: asBool(exit.blocking), actionable: asBool(exit.actionable) }
  };
}

function deriveStatus(snapshot: ResilienceSnapshot, stale: boolean): ResilienceStatus {
  if (!snapshot.generated_at) return "unknown";
  if (snapshot.exit.blocking) return "blocked";
  if (stale) return "stale";
  if (snapshot.exit.actionable) return "warning";
  return "healthy";
}

function envelopeFrom(snapshot: ResilienceSnapshot, adapter: ResilienceEnvelope["adapter"]): ResilienceEnvelope {
  const generatedAt = snapshot.generated_at ? Date.parse(snapshot.generated_at) : NaN;
  const stale = Number.isFinite(generatedAt) ? Date.now() - generatedAt > STALE_AFTER_MS : true;
  return {
    schemaVersion: RESILIENCE_SCHEMA_VERSION,
    adapter,
    sourcedAt: new Date().toISOString(),
    stale,
    status: deriveStatus(snapshot, stale),
    snapshot
  };
}

function readRawJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Resilience snapshot adapter.
 *
 * v1 source order:
 *   1. Live audit artifact at `.symphony/cloudflare-resilience/latest.json`
 *      (produced by `fleet-ops/scripts/cloudflare-resilience-audit.mjs`).
 *   2. Checked-in sanitized fixture at `src/fixtures/resilience-snapshot.json`.
 *
 * Consolidation seam (do NOT redesign the UI to support this — extend here):
 *   Replace step 1 with a signed artifact fetch from a private API behind
 *   Cloudflare Access. The envelope shape stays the same; only the adapter
 *   label changes (e.g. `signed-api`). Auth, token storage, and the Access
 *   policy are deployment-time concerns and intentionally out of scope for v1.
 */
export function getResilienceEnvelope(): ResilienceEnvelope {
  const appRoot = process.cwd();
  const fleetOpsRoot = resolve(appRoot, "../..");
  const fleetRoot = resolve(fleetOpsRoot, "..");
  const auditPath = resolve(fleetRoot, ".symphony/cloudflare-resilience/latest.json");
  const fixturePath = resolve(appRoot, "src/fixtures/resilience-snapshot.json");

  const raw = readRawJson(auditPath);
  if (raw) return envelopeFrom(sanitizeSnapshot(raw), "audit-file");

  const fixture = readRawJson(fixturePath);
  if (fixture) return envelopeFrom(sanitizeSnapshot(fixture), "fixture");

  // No source available — return an explicit unknown envelope so the UI can
  // render the empty/error state rather than implying missing data is healthy.
  return envelopeFrom(
    {
      generated_at: null,
      live_checks: false,
      repository_scan: false,
      scope: { projects: 0, domains: 0 },
      findings: [],
      evidence: { repositories: [], background_jobs: [] },
      live: { domain_probes: [], cloudflare: { pages_count: null, queues_count: null, workflows_count: null, error: null } },
      exit: { blocking: false, actionable: false }
    },
    "fixture"
  );
}

export function groupFindingsBySeverity(findings: ResilienceFinding[]) {
  return {
    high: findings.filter((f) => f.severity === "high"),
    medium: findings.filter((f) => f.severity === "medium"),
    low: findings.filter((f) => f.severity === "low"),
    info: findings.filter((f) => f.severity === "info")
  };
}

export function groupFindingsByCategory(findings: ResilienceFinding[]) {
  const byCategory = new Map<string, ResilienceFinding[]>();
  for (const finding of findings) {
    const list = byCategory.get(finding.category) ?? [];
    list.push(finding);
    byCategory.set(finding.category, list);
  }
  return [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export type RiskRegisterEntry = {
  signal: string;
  severity: FindingSeverity;
  surfaces: string[];
  action: string;
};

/**
 * Forward-looking risk register derived from findings + background-job
 * evidence. Surfaces early signals (missing idempotency, missing timeout,
 * missing concurrency) alongside the operator action, without exposing raw
 * provider responses or destructive controls.
 */
export function buildRiskRegister(envelope: ResilienceEnvelope): RiskRegisterEntry[] {
  const { snapshot } = envelope;
  const entries: RiskRegisterEntry[] = [];

  for (const finding of snapshot.findings) {
    if (finding.severity === "info") continue;
    entries.push({
      signal: finding.evidence,
      severity: finding.severity,
      surfaces: [finding.surface],
      action: finding.next_action
    });
  }

  for (const job of snapshot.evidence.background_jobs) {
    if (job.scheduled && !job.timeout_or_bound) {
      entries.push({
        signal: "Scheduled work has no visible timeout/batch bound.",
        severity: "low",
        surfaces: [job.id],
        action: "Add a bounded timeout and document max work per invocation."
      });
    }
    if (job.async && !job.idempotency_or_dedup) {
      entries.push({
        signal: "Queue/workflow path has no visible idempotency/dedup.",
        severity: "medium",
        surfaces: [job.id],
        action: "Add a stable job key or durable deduplication; test replay."
      });
    }
  }

  const order: Record<FindingSeverity, number> = { high: 0, medium: 1, low: 2, info: 3 };
  return entries.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 24);
}
