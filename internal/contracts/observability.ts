/** Provider-neutral Foundry observability contracts. */

export type ObservabilityProviderId =
  | 'cloudflare-workers-observability'
  | 'console'
  | 'custom'
  | 'foundry-events'
  | 'opentelemetry'
  | 'posthog'
  | 'sentry';

export interface ObservabilityProviderContract {
  id: ObservabilityProviderId;
  /** Human-readable adapter name; it must not contain credentials or DSNs. */
  name: string;
  /** Whether the adapter is hosted, self-hosted, local, or a Foundry service. */
  deployment: 'hosted' | 'self-hosted' | 'local' | 'foundry';
  /** Environment variable names are allowed; resolved values are not. */
  configurationKeys?: string[];
}

export type ObservabilityPurpose =
  | 'analytics'
  | 'audit'
  | 'availability'
  | 'errors'
  | 'jobs'
  | 'logs'
  | 'performance'
  | 'security'
  | 'traces';

export type ObservabilityRuntime =
  | 'api'
  | 'background-job'
  | 'browser'
  | 'cli'
  | 'desktop'
  | 'local-tool'
  | 'mobile'
  | 'server'
  | 'worker'
  | 'unknown';

export type ObservabilityPrivacyClassification =
  | 'public'
  | 'operational'
  | 'pseudonymous'
  | 'personal'
  | 'sensitive';

export interface ObservabilityPrivacyContract {
  classification: ObservabilityPrivacyClassification;
  /** Collection must omit credentials, authorization headers, and secret values. */
  allowSecrets: false;
  /** Whether a stable user/device identifier may be collected. */
  allowUserIdentity: boolean;
  /** Whether request or response bodies may be collected. */
  allowPayloadBodies: boolean;
  /** Field names to remove before values leave the runtime. */
  redactFields: string[];
}

export type ObservabilityCollectionMode = 'automatic' | 'manual' | 'hybrid';

export interface ObservabilityCollectionContract {
  mode: ObservabilityCollectionMode;
  /** A value in the inclusive range 0..1, when source sampling is explicit. */
  sampleRate?: number;
  capturesErrors: boolean;
  capturesPerformance: boolean;
  capturesProductEvents: boolean;
  /** Flush behavior is part of reliability, not a provider requirement. */
  delivery: 'best-effort' | 'buffered' | 'durable' | 'unknown';
}

export interface ObservabilityFreshnessContract {
  /** Maximum acceptable age of successful verification evidence. */
  maxAgeHours: number;
  /** ISO-8601 timestamp from a verification receipt, never source mtime. */
  observedAt?: string;
  /** Optional path to a local, sanitized verification receipt. */
  auditPath?: string;
}

export type ObservabilityVerificationState =
  | 'source-configured'
  | 'fresh-verified'
  | 'stale'
  | 'unknown'
  | 'not-applicable';

export interface ObservabilityVerificationContract {
  state: ObservabilityVerificationState;
  freshness: ObservabilityFreshnessContract;
  /** Required for not-applicable and useful for degraded/unknown states. */
  reason?: string;
}

export interface ObservabilityAdapterContract {
  id: string;
  projectId: string;
  provider: ObservabilityProviderContract;
  purposes: ObservabilityPurpose[];
  runtimes: ObservabilityRuntime[];
  privacy: ObservabilityPrivacyContract;
  collection: ObservabilityCollectionContract;
  verification: ObservabilityVerificationContract;
  /** Repo-relative source paths only. */
  sourceFiles: string[];
  produces: string[];
  consumes: string[];
  eventFamilies: string[];
}

export type ObservabilityFindingCode =
  | 'audit-path-failure'
  | 'duplicate-event-family-owner'
  | 'duplicate-event-owner'
  | 'event-consumer-without-producer'
  | 'event-producer-without-consumer'
  | 'hardcoded-public-key'
  | 'invalid-verification-evidence'
  | 'missing-project-identity'
  | 'scan-limit-reached';

export interface ObservabilityFinding {
  code: ObservabilityFindingCode;
  severity: 'info' | 'warning' | 'error';
  projectId: string;
  message: string;
  file?: string;
  line?: number;
  provider?: ObservabilityProviderId;
  event?: string;
  eventFamily?: string;
}

export interface FoundryObservabilityProjectInventory {
  projectId: string;
  maturity: string;
  path: string | null;
  verification: ObservabilityVerificationContract;
  adapters: ObservabilityAdapterContract[];
  findings: ObservabilityFinding[];
  scan: {
    filesVisited: number;
    filesScanned: number;
    bytesScanned: number;
    truncated: boolean;
  };
}

export interface FoundryObservabilityInventoryReport {
  schemaVersion: 1;
  generatedAt: string;
  root: string;
  limits: {
    maxFilesPerProject: number;
    maxFileBytes: number;
    maxTotalBytesPerProject: number;
  };
  summary: {
    projects: number;
    adapters: number;
    findings: number;
    byVerificationState: Record<ObservabilityVerificationState, number>;
  };
  projects: FoundryObservabilityProjectInventory[];
  findings: ObservabilityFinding[];
}
