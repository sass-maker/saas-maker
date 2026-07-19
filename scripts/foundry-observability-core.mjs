import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_LIMITS = Object.freeze({
  maxFilesPerProject: 4_000,
  maxFileBytes: 1_048_576,
  maxTotalBytesPerProject: 32 * 1_048_576,
});

const DEFAULT_FRESHNESS_HOURS = 168;
const MAINTAINED_MATURITIES = new Set(['maintained', 'public-ready', 'internal-first']);
const IGNORED_DIRECTORIES = new Set([
  '.cache',
  '.git',
  '.next',
  '.nuxt',
  '.output',
  '.parcel-cache',
  '.turbo',
  '.venv',
  '.wrangler',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'target',
  'temp',
  'templates',
  'tmp',
  'vendor',
]);
const SOURCE_EXTENSIONS = new Set([
  '.cjs',
  '.go',
  '.js',
  '.json',
  '.jsonc',
  '.jsx',
  '.mjs',
  '.py',
  '.rs',
  '.swift',
  '.toml',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);
const SKIPPED_FILE_PATTERNS = [
  /(?:^|\/)tests?(?:\/|$)/,
  /(?:^|\/)fixtures?(?:\/|$)/,
  /(?:^|\/)scripts\/foundry-observability-[^/]+\.mjs$/,
  /(?:^|\/)(?:pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/,
  /(?:^|\/)\.env(?:\.|$)/,
  /\.(?:key|pem|p12|pfx|crt)$/i,
  /\.min\.(?:js|css)$/i,
];
const PROVIDERS = Object.freeze({
  'cloudflare-workers-observability': {
    id: 'cloudflare-workers-observability',
    name: 'Cloudflare Workers Observability',
    deployment: 'hosted',
  },
  console: { id: 'console', name: 'Runtime console', deployment: 'local' },
  custom: { id: 'custom', name: 'Custom telemetry adapter', deployment: 'self-hosted' },
  'foundry-events': { id: 'foundry-events', name: 'Foundry Events', deployment: 'foundry' },
  opentelemetry: { id: 'opentelemetry', name: 'OpenTelemetry', deployment: 'self-hosted' },
  posthog: { id: 'posthog', name: 'PostHog', deployment: 'hosted' },
  sentry: { id: 'sentry', name: 'Sentry', deployment: 'hosted' },
});

function normalizeId(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function relativePath(root, file) {
  return path.relative(root, file).split(path.sep).join('/') || '.';
}

function safeJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function findRegistry(scanRoot) {
  const direct = path.join(scanRoot, 'foundry.projects.json');
  if (fs.existsSync(direct)) return { registryRoot: scanRoot, manifestPath: direct };
  const nested = path.join(scanRoot, 'saas-maker', 'foundry.projects.json');
  if (fs.existsSync(nested)) {
    return { registryRoot: path.dirname(nested), manifestPath: nested };
  }
  return null;
}

function loadAutomationEntries(registryRoot) {
  const registry = safeJson(path.join(registryRoot, 'ops', 'config', 'automation-registry.json'));
  return Array.isArray(registry?.entries) ? registry.entries : [];
}

function findAutomationEntry(slug, entry, automationEntries) {
  const candidates = new Set([
    normalizeId(slug),
    normalizeId(entry?.repository),
    normalizeId(entry?.family),
  ]);
  return automationEntries.find((item) => {
    const ids = [item?.id, item?.repository].map(normalizeId);
    return ids.some((id) => id && candidates.has(id));
  });
}

function notApplicableReason(slug, entry, automationEntries) {
  const localReason = entry?.observability?.notApplicable?.reason;
  if (typeof localReason === 'string' && localReason.trim()) return localReason.trim();
  const automation = findAutomationEntry(slug, entry, automationEntries);
  if (!automation || (automation.actionPolicy !== 'excluded' && !['ignored', 'removed'].includes(automation.attention))) {
    return null;
  }
  const exception = Array.isArray(automation.exceptions)
    ? automation.exceptions.find((item) => item?.contract === 'all' || item?.contract === 'errors')
    : null;
  return typeof exception?.reason === 'string' && exception.reason.trim()
    ? exception.reason.trim()
    : null;
}

function currentRootIsFoundry(root) {
  const packageJson = safeJson(path.join(root, 'package.json'));
  return packageJson?.name === 'foundry' && fs.existsSync(path.join(root, 'workers'));
}

function resolveProjectPath(scanRoot, registryRoot, slug, entry) {
  const candidates = [];
  if (typeof entry?.path === 'string' && entry.path.trim()) {
    candidates.push(path.resolve(scanRoot, entry.path));
  }
  candidates.push(
    path.join(scanRoot, slug),
    path.join(scanRoot, String(slug).toLowerCase()),
    path.join(scanRoot, 'services', slug),
    path.join(scanRoot, 'tools', slug),
    path.join(scanRoot, 'apps', slug)
  );
  if (registryRoot !== scanRoot) candidates.push(path.join(scanRoot, entry?.repository ?? slug));
  if (normalizeId(slug) === 'saasmaker' && currentRootIsFoundry(registryRoot)) {
    candidates.unshift(registryRoot);
  }
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (inside(scanRoot, resolved) && fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      return resolved;
    }
  }
  return null;
}

export function discoverProjects(root) {
  const scanRoot = path.resolve(root);
  const registry = findRegistry(scanRoot);
  if (!registry) {
    const packageJson = safeJson(path.join(scanRoot, 'package.json'));
    return [{
      projectId: packageJson?.name ?? path.basename(scanRoot),
      maturity: 'maintained',
      directory: scanRoot,
      notApplicableReason: null,
    }];
  }
  const manifest = safeJson(registry.manifestPath) ?? {};
  const automationEntries = loadAutomationEntries(registry.registryRoot);
  return Object.entries(manifest)
    .filter(([, entry]) => MAINTAINED_MATURITIES.has(entry?.maturity))
    .map(([slug, entry]) => ({
      projectId: slug,
      maturity: entry.maturity,
      directory: resolveProjectPath(scanRoot, registry.registryRoot, slug, entry),
      notApplicableReason: notApplicableReason(slug, entry, automationEntries),
    }))
    .sort((left, right) => left.projectId.localeCompare(right.projectId));
}

function shouldScan(relative, entryName) {
  if (!SOURCE_EXTENSIONS.has(path.extname(entryName).toLowerCase())) return false;
  return !SKIPPED_FILE_PATTERNS.some((pattern) => pattern.test(relative));
}

function walkFiles(root, limits, excludedRoots = new Set()) {
  const files = [];
  const stack = [root];
  let filesVisited = 0;
  let truncated = false;
  while (stack.length > 0) {
    const directory = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    entries.sort((left, right) => right.name.localeCompare(left.name));
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const file = path.join(directory, entry.name);
      const relative = relativePath(root, file);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name) && !excludedRoots.has(path.resolve(file))) {
          stack.push(file);
        }
        continue;
      }
      filesVisited += 1;
      if (!entry.isFile() || !shouldScan(relative, entry.name)) continue;
      if (files.length >= limits.maxFilesPerProject) {
        truncated = true;
        stack.length = 0;
        break;
      }
      files.push(file);
    }
  }
  return { files, filesVisited, truncated };
}

function runtimeFor(relative, source) {
  const normalized = relative.toLowerCase();
  if (/\.(?:swift)$/.test(normalized)) return 'mobile';
  if (/(?:^|\/)workers?\//.test(normalized) || /wrangler\.(?:toml|jsonc?)$/.test(normalized)) return 'worker';
  if (/(?:cron|scheduled|jobs?)(?:\/|\.|-)/.test(normalized)) return 'background-job';
  if (/['"]use client['"]|\bwindow\.|\bdocument\.|posthog-js/.test(source)) return 'browser';
  if (/(?:^|\/)(?:cli|bin)(?:\/|$)/.test(normalized)) return 'cli';
  if (/(?:server|api)(?:\/|\.|-)/.test(normalized) || /posthog-node/.test(source)) return 'server';
  return 'unknown';
}

function detectProviders(relative, source) {
  const providers = new Set();
  if (/posthog-js|posthog-node|posthog\.|configurePostHog|POSTHOG_(?:KEY|HOST|PROJECT)/.test(source)) {
    providers.add('posthog');
  }
  if (/@sentry\/|\bSentry\.(?:init|capture)|SENTRY_DSN/.test(source)) providers.add('sentry');
  if (/@opentelemetry\/|\bOTEL_[A-Z_]+|\bOpenTelemetry\b/.test(source)) providers.add('opentelemetry');
  if (
    /wrangler\.(?:toml|jsonc?)$/.test(relative.toLowerCase()) &&
    /(?:\[observability\][\s\S]{0,300}?enabled\s*=\s*true|["']observability["']\s*:\s*\{[\s\S]{0,300}?["']enabled["']\s*:\s*true)/.test(source)
  ) {
    providers.add('cloudflare-workers-observability');
  }
  if (
    /(?:\bhttp|\bclient|\bapi|this\.http)\.?(?:request)?\s*(?:<[^>]+>)?\s*\([\s\S]{0,160}['"]POST['"][\s\S]{0,80}['"]\/v1\/events\b/.test(source) ||
    /@saas-maker\/sdk[\s\S]{0,300}\bevents\.(?:emit|emitBatch)\b/.test(source)
  ) {
    providers.add('foundry-events');
  }
  if (
    providers.size === 0 &&
    (
      /\b(?:trackEvent|recordEvent|emitTelemetry)\s*\(/.test(source) ||
      (/(?:telemetry|observability|monitoring|analytics)\.(?:[cm]?[jt]sx?|py|go|rs)$/.test(relative.toLowerCase()) &&
        /\bcapture\s*\(/.test(source)) ||
      /from\s+['"][^'"]*(?:telemetry|observability|monitoring|analytics)[^'"]*['"][\s\S]{0,500}\bcapture\s*\(/.test(source)
    )
  ) {
    providers.add('custom');
  }
  if (
    /(?:telemetry|observability|monitoring|logger)\.(?:[cm]?[jt]sx?|py|go|rs)$/.test(relative.toLowerCase()) &&
    /console\.(?:error|warn|info|debug)|\blog(?:ger)?\.(?:error|warn|info)/.test(source)
  ) {
    providers.add('console');
  }
  return providers;
}

function eventFamily(event) {
  if (event.startsWith('$')) return event;
  const separator = event.indexOf('_');
  return separator === -1 ? event : event.slice(0, separator);
}

function extractMatches(source, patterns) {
  const matches = [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      const value = match[1]?.trim();
      if (value && /^[a-zA-Z$][a-zA-Z0-9_$.-]{1,100}$/.test(value)) matches.push(value);
      if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
    }
  }
  return new Set(matches);
}

function extractProducers(source) {
  return extractMatches(source, [
    /\b(?:capture|track|trackEvent|recordEvent|emitTelemetry)\s*\(\s*['"`]([^'"`]+)['"`]/g,
    /\bcapture\s*\(\s*\{[\s\S]{0,500}?\bevent\s*:\s*['"`]([^'"`]+)['"`]/g,
  ]);
}

function extractConsumers(source) {
  const events = extractMatches(source, [
    /\bevent\s*(?:={1,3}|==)\s*['"`]([^'"`]+)['"`]/g,
    /\bwhere\s*:\s*\[?\s*['"`]event\s*(?:={1,3}|==)\s*['"`]([^'"`]+)['"`]/g,
  ]);
  const inPattern = /\bevent\s+IN\s*\(([^)]+)\)/gi;
  let inMatch;
  while ((inMatch = inPattern.exec(source)) !== null) {
    const quoted = /['"`]([^'"`]+)['"`]/g;
    let quotedMatch;
    while ((quotedMatch = quoted.exec(inMatch[1])) !== null) events.add(quotedMatch[1]);
  }
  return events;
}

function inferPurposes(source, events) {
  const purposes = new Set();
  const joined = [...events].join(' ');
  if (/error|exception|crash|failure|Sentry\.captureException/.test(`${source}\n${joined}`)) purposes.add('errors');
  if (/trace|span|duration|latency/.test(`${source}\n${joined}`)) purposes.add('traces');
  if (/performance|web-vitals|LCP|CLS|INP|TTFB|timing/.test(`${source}\n${joined}`)) purposes.add('performance');
  if (/pageview|signup|activated|returned|core_action|analytics|identify/.test(`${source}\n${joined}`)) purposes.add('analytics');
  if (/audit|verification|receipt/.test(source)) purposes.add('audit');
  if (/cron|scheduled|job[_-]/.test(`${source}\n${joined}`)) purposes.add('jobs');
  if (/health|uptime|availability/.test(`${source}\n${joined}`)) purposes.add('availability');
  if (/logger|console\.|\blog\(/.test(source)) purposes.add('logs');
  if (/security|auth_failure|unauthorized/.test(`${source}\n${joined}`)) purposes.add('security');
  if (purposes.size === 0) purposes.add('logs');
  return purposes;
}

function lineNumber(source, index) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) if (source.charCodeAt(cursor) === 10) line += 1;
  return line;
}

function findHardcodedPublicKeys(projectId, relative, source) {
  const findings = [];
  const patterns = [
    { provider: 'posthog', pattern: /\bphc_[A-Za-z0-9]{20,}\b/g },
    { provider: 'sentry', pattern: /https:\/\/[A-Za-z0-9._-]+@[A-Za-z0-9.-]*ingest\.sentry\.io\/[0-9]+/g },
    { provider: 'custom', pattern: /\bDD_CLIENT_TOKEN\b\s*[:=]\s*['"][^'"]{12,}['"]/g },
  ];
  for (const { provider, pattern } of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      findings.push({
        code: 'hardcoded-public-key',
        severity: 'warning',
        projectId,
        provider,
        file: relative,
        line: lineNumber(source, match.index),
        message: `Hardcoded ${provider} public client key detected; the value was omitted.`,
      });
    }
  }
  return findings;
}

function addMapSet(map, key, value) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
}

function createAdapter(providerId) {
  return {
    providerId,
    sourceFiles: new Set(),
    runtimes: new Set(),
    purposes: new Set(),
    produces: new Set(),
    consumes: new Set(),
    configurationKeys: new Set(),
    hasManualCollection: false,
    hasAutomaticCollection: false,
    hasProjectIdentity: false,
    hasEmission: false,
    capturesErrors: false,
    capturesPerformance: false,
    capturesProductEvents: false,
    hasBufferedDelivery: false,
    privacyClassification: 'operational',
  };
}

function collectConfigurationKeys(adapter, source) {
  const envPattern = /(?:process\.env\.|env\.)([A-Z][A-Z0-9_]{2,})\b/g;
  let match;
  while ((match = envPattern.exec(source)) !== null) {
    if (/POSTHOG|SENTRY|OTEL|OBSERV|TELEMETRY/.test(match[1])) adapter.configurationKeys.add(match[1]);
  }
}

function collectAdapterSource(adapter, relative, source, runtime, producers, consumers, purposes) {
  adapter.sourceFiles.add(relative);
  adapter.runtimes.add(runtime);
  for (const purpose of purposes) adapter.purposes.add(purpose);
  for (const event of producers) adapter.produces.add(event);
  for (const event of consumers) adapter.consumes.add(event);
  collectConfigurationKeys(adapter, source);
  adapter.hasManualCollection ||= /\b(?:capture|track|recordEvent|emitTelemetry)\s*\(/.test(source);
  adapter.hasAutomaticCollection ||= /autocapture\s*:\s*true|capture_pageview\s*:\s*true|addEventListener\(\s*['"]error/.test(source);
  adapter.hasProjectIdentity ||=
    /\bproject_id\s*:|properties\.project_id|withCanonicalProjectId|\bproject_slug\s*:|\bprojectSlug\s*:|\bproduct\s*:/.test(
      source
    );
  adapter.hasEmission ||= producers.size > 0 || /\b(?:capture|track|recordEvent|emitTelemetry)\s*\(/.test(source);
  adapter.capturesErrors ||= purposes.has('errors');
  adapter.capturesPerformance ||= purposes.has('performance') || purposes.has('traces');
  adapter.capturesProductEvents ||= purposes.has('analytics');
  adapter.hasBufferedDelivery ||= /batch|queue|flush|waitUntil/.test(source);
  if (/person_profiles\s*:\s*['"]always|\bidentify\s*\(/.test(source)) adapter.privacyClassification = 'personal';
  else if (/distinct_id|user_?id|device_?id/.test(source) && adapter.privacyClassification === 'operational') {
    adapter.privacyClassification = 'pseudonymous';
  }
  if (/stack|request\.?body|response\.?body/.test(source)) adapter.privacyClassification = 'sensitive';
}

function candidateEvidence(relative, parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  if (parsed.schemaVersion === 1 && Array.isArray(parsed.projects) && parsed.summary) return null;
  const name = path.basename(relative).toLowerCase();
  const looksLikeEvidence =
    /(?:observability|monitoring).*(?:verification|verify|receipt|audit|report)/.test(name) ||
    /(?:verification|verify|receipt|audit|report).*(?:observability|monitoring)/.test(name) ||
    name === 'observability.json' ||
    name === '.foundry-observability.json';
  if (!looksLikeEvidence && !parsed.observabilityVerification && !parsed.verificationState) return null;
  const verification = parsed.observabilityVerification ?? parsed.verification ?? parsed;
  const observedAt =
    verification.observedAt ?? verification.verifiedAt ?? verification.checkedAt ??
    parsed.observedAt ?? parsed.verifiedAt ?? parsed.checkedAt ?? parsed.generatedAt;
  const status = verification.state ?? verification.status ?? parsed.verificationState ?? parsed.status;
  const auditPath = verification.auditPath ?? verification.audit_path ?? parsed.auditPath ?? parsed.audit_path;
  const success = verification.ok === true || parsed.ok === true || ['pass', 'passed', 'ok', 'fresh-verified'].includes(status);
  return { observedAt, status, success, auditPath, file: relative };
}

function collectAuditReferences(projectId, projectRoot, relative, parsed, findings) {
  if (!parsed || typeof parsed !== 'object') return;
  const references = [];
  if (path.basename(relative) === '.posthog-events.json' && Array.isArray(parsed)) {
    for (const entry of parsed) if (typeof entry?.file === 'string') references.push(entry.file);
  }
  const visit = (value, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 5) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    for (const [key, item] of Object.entries(value)) {
      if (/^(?:auditPath|audit_path|verificationPath|verification_path)$/.test(key) && typeof item === 'string') {
        references.push(item);
      } else {
        visit(item, depth + 1);
      }
    }
  };
  visit(parsed);
  for (const reference of new Set(references)) {
    const target = path.resolve(projectRoot, reference);
    if (path.isAbsolute(reference) || !inside(projectRoot, target) || !fs.existsSync(target)) {
      findings.push({
        code: 'audit-path-failure',
        severity: 'error',
        projectId,
        file: relative,
        message: 'A declared observability audit path is missing or leaves the project boundary.',
      });
    }
  }
}

function collectPackageAuditReferences(projectId, projectRoot, relative, parsed, findings) {
  if (path.basename(relative) !== 'package.json' || !parsed?.scripts) return;
  for (const [name, command] of Object.entries(parsed.scripts)) {
    if (!/(?:observability|monitoring|posthog).*(?:audit|verify)|(?:audit|verify).*(?:observability|monitoring|posthog)/i.test(name)) continue;
    if (typeof command !== 'string') continue;
    const match = command.match(/(?:^|&&|;)\s*node\s+([^\s;&]+)/);
    if (!match) continue;
    const scriptPath = match[1].replace(/^['"]|['"]$/g, '');
    const target = path.resolve(path.dirname(path.join(projectRoot, relative)), scriptPath);
    if (!inside(projectRoot, target) || !fs.existsSync(target)) {
      findings.push({
        code: 'audit-path-failure',
        severity: 'error',
        projectId,
        file: relative,
        message: `The ${name} package script references a missing observability audit path.`,
      });
    }
  }
}

function pickVerification(evidence, now, freshnessHours, hasAdapters, findings, projectId) {
  if (evidence.length === 0) {
    return {
      state: hasAdapters ? 'source-configured' : 'unknown',
      freshness: { maxAgeHours: freshnessHours },
      reason: hasAdapters ? 'Source configuration found; no successful verification receipt was found.' : 'No adapter source or verification receipt was found.',
    };
  }
  const valid = evidence
    .map((item) => ({ ...item, timestamp: Date.parse(item.observedAt) }))
    .filter((item) => item.success && item.auditPathValid !== false && Number.isFinite(item.timestamp))
    .sort((left, right) => right.timestamp - left.timestamp);
  if (valid.length === 0) {
    findings.push({
      code: 'invalid-verification-evidence',
      severity: 'warning',
      projectId,
      file: evidence[0].file,
      message: 'Verification evidence did not contain a successful status and valid timestamp.',
    });
    return {
      state: hasAdapters ? 'source-configured' : 'unknown',
      freshness: { maxAgeHours: freshnessHours },
      reason: 'Verification evidence was present but was not a valid successful receipt.',
    };
  }
  const latest = valid[0];
  const ageHours = Math.max(0, (now.getTime() - latest.timestamp) / 3_600_000);
  return {
    state: ageHours <= freshnessHours ? 'fresh-verified' : 'stale',
    freshness: {
      maxAgeHours: freshnessHours,
      observedAt: new Date(latest.timestamp).toISOString(),
      auditPath: latest.file,
    },
    reason: ageHours <= freshnessHours ? undefined : 'The newest successful verification receipt is older than the freshness target.',
  };
}

function finalizeAdapter(projectId, adapter, verification) {
  const purposes = [...adapter.purposes].sort();
  const produces = [...adapter.produces].sort();
  const consumes = [...adapter.consumes].sort();
  const configurationKeys = [...adapter.configurationKeys].sort();
  const provider = { ...PROVIDERS[adapter.providerId] };
  if (configurationKeys.length > 0) provider.configurationKeys = configurationKeys;
  return {
    id: `${projectId}:${adapter.providerId}`,
    projectId,
    provider,
    purposes,
    runtimes: [...adapter.runtimes].sort(),
    privacy: {
      classification: adapter.privacyClassification,
      allowSecrets: false,
      allowUserIdentity: adapter.privacyClassification === 'personal' || adapter.privacyClassification === 'pseudonymous',
      allowPayloadBodies: false,
      redactFields: ['authorization', 'cookie', 'password', 'secret', 'token'],
    },
    collection: {
      mode: adapter.hasAutomaticCollection && adapter.hasManualCollection
        ? 'hybrid'
        : adapter.hasAutomaticCollection
          ? 'automatic'
          : 'manual',
      capturesErrors: adapter.capturesErrors,
      capturesPerformance: adapter.capturesPerformance,
      capturesProductEvents: adapter.capturesProductEvents,
      delivery: adapter.hasBufferedDelivery ? 'buffered' : 'best-effort',
    },
    verification,
    sourceFiles: [...adapter.sourceFiles].sort(),
    produces,
    consumes,
    eventFamilies: [...new Set([...produces, ...consumes].map(eventFamily))].sort(),
  };
}

function addEventFindings(projectId, adapters, producerFiles, consumerFiles, findings) {
  const producers = new Set(producerFiles.keys());
  const consumers = new Set(consumerFiles.keys());
  for (const event of consumers) {
    if (!producers.has(event)) findings.push({
      code: 'event-consumer-without-producer',
      severity: 'warning',
      projectId,
      event,
      message: `Event consumer ${event} has no source producer in this project.`,
    });
  }
  for (const event of producers) {
    if (!consumers.has(event) && !event.startsWith('$')) findings.push({
      code: 'event-producer-without-consumer',
      severity: 'info',
      projectId,
      event,
      message: `Event producer ${event} has no source consumer in this project.`,
    });
    const owners = producerFiles.get(event);
    if (owners?.size > 1) findings.push({
      code: 'duplicate-event-owner',
      severity: 'warning',
      projectId,
      event,
      message: `Event ${event} is produced by more than one source owner.`,
    });
  }
  const familyProviders = new Map();
  for (const adapter of adapters) {
    for (const event of adapter.produces) addMapSet(familyProviders, eventFamily(event), adapter.provider.id);
  }
  for (const [family, providers] of familyProviders) {
    if (providers.size > 1) findings.push({
      code: 'duplicate-event-family-owner',
      severity: 'warning',
      projectId,
      eventFamily: family,
      message: `Event family ${family} is emitted through multiple provider adapters.`,
    });
  }
}

function scanProject(project, scanRoot, now, freshnessHours, limits, excludedRoots) {
  if (project.notApplicableReason) {
    return {
      projectId: project.projectId,
      maturity: project.maturity,
      path: project.directory ? relativePath(scanRoot, project.directory) : null,
      verification: {
        state: 'not-applicable',
        freshness: { maxAgeHours: freshnessHours },
        reason: project.notApplicableReason,
      },
      adapters: [],
      findings: [],
      scan: { filesVisited: 0, filesScanned: 0, bytesScanned: 0, truncated: false },
    };
  }
  if (!project.directory) {
    return {
      projectId: project.projectId,
      maturity: project.maturity,
      path: null,
      verification: {
        state: 'unknown',
        freshness: { maxAgeHours: freshnessHours },
        reason: 'Maintained project source is not present below the scan root.',
      },
      adapters: [],
      findings: [],
      scan: { filesVisited: 0, filesScanned: 0, bytesScanned: 0, truncated: false },
    };
  }

  const walked = walkFiles(project.directory, limits, excludedRoots);
  const adapterState = new Map();
  const producerFiles = new Map();
  const consumerFiles = new Map();
  const evidence = [];
  const findings = [];
  let bytesScanned = 0;
  let filesScanned = 0;
  let truncated = walked.truncated;

  for (const file of walked.files) {
    let stat;
    try {
      stat = fs.statSync(file);
    } catch {
      continue;
    }
    if (stat.size > limits.maxFileBytes) continue;
    if (bytesScanned + stat.size > limits.maxTotalBytesPerProject) {
      truncated = true;
      break;
    }
    let source;
    try {
      source = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    bytesScanned += stat.size;
    filesScanned += 1;
    const relative = relativePath(project.directory, file);
    findings.push(...findHardcodedPublicKeys(project.projectId, relative, source));

    let parsed = null;
    if (path.extname(file).toLowerCase() === '.json') {
      try {
        parsed = JSON.parse(source);
      } catch {
        parsed = null;
      }
      collectAuditReferences(project.projectId, project.directory, relative, parsed, findings);
      collectPackageAuditReferences(project.projectId, project.directory, relative, parsed, findings);
      const receipt = candidateEvidence(relative, parsed);
      if (receipt) {
        if (typeof receipt.auditPath === 'string' && receipt.auditPath.trim()) {
          const target = path.resolve(project.directory, receipt.auditPath);
          receipt.auditPathValid =
            !path.isAbsolute(receipt.auditPath) &&
            inside(project.directory, target) &&
            fs.existsSync(target);
        }
        evidence.push(receipt);
      }
    }

    const providers = detectProviders(relative, source);
    if (providers.size === 0) continue;
    const runtime = runtimeFor(relative, source);
    const producers = extractProducers(source);
    const consumers = extractConsumers(source);
    const purposes = inferPurposes(source, new Set([...producers, ...consumers]));
    for (const event of producers) addMapSet(producerFiles, event, relative);
    for (const event of consumers) addMapSet(consumerFiles, event, relative);
    for (const providerId of providers) {
      if (!adapterState.has(providerId)) adapterState.set(providerId, createAdapter(providerId));
      const providerProduces = ['cloudflare-workers-observability', 'console', 'foundry-events'].includes(providerId)
        ? new Set()
        : producers;
      const providerConsumes = ['cloudflare-workers-observability', 'console'].includes(providerId)
        ? new Set()
        : consumers;
      collectAdapterSource(
        adapterState.get(providerId),
        relative,
        source,
        runtime,
        providerProduces,
        providerConsumes,
        purposes
      );
    }
  }

  if (truncated) findings.push({
    code: 'scan-limit-reached',
    severity: 'warning',
    projectId: project.projectId,
    message: 'The bounded source scan reached a configured file or byte limit.',
  });

  const verification = pickVerification(evidence, now, freshnessHours, adapterState.size > 0, findings, project.projectId);
  const adapters = [...adapterState.values()]
    .map((adapter) => finalizeAdapter(project.projectId, adapter, verification))
    .sort((left, right) => left.provider.id.localeCompare(right.provider.id));
  for (const adapter of adapterState.values()) {
    if (adapter.produces.size > 0 && !adapter.hasProjectIdentity && !['console', 'cloudflare-workers-observability'].includes(adapter.providerId)) {
      findings.push({
        code: 'missing-project-identity',
        severity: 'error',
        projectId: project.projectId,
        provider: adapter.providerId,
        message: `${adapter.providerId} emits events without a detectable canonical project_id source field.`,
      });
    }
  }
  addEventFindings(project.projectId, adapters, producerFiles, consumerFiles, findings);
  findings.sort((left, right) =>
    left.code.localeCompare(right.code) || String(left.file ?? '').localeCompare(String(right.file ?? ''))
  );
  return {
    projectId: project.projectId,
    maturity: project.maturity,
    path: relativePath(scanRoot, project.directory),
    verification,
    adapters,
    findings,
    scan: { filesVisited: walked.filesVisited, filesScanned, bytesScanned, truncated },
  };
}

function sanitizeString(value) {
  return value
    .replace(/\bphc_[A-Za-z0-9]{8,}\b/g, '[redacted-public-key]')
    .replace(/https:\/\/[A-Za-z0-9._-]+@[A-Za-z0-9.-]*ingest\.sentry\.io\/[0-9]+/g, '[redacted-dsn]')
    .replace(/\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{8,}\b/g, '[redacted-key]')
    .replace(/\b(?:ghp|github_pat)_[A-Za-z0-9_]{8,}\b/g, '[redacted-token]')
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]{8,}/gi, 'Bearer [redacted]');
}

export function sanitizeReport(value) {
  if (Array.isArray(value)) return value.map(sanitizeReport);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      if (/^(?:apiKey|api_key|secret|token|authorization|cookie|dsn)$/i.test(key)) return [key, '[redacted]'];
      return [key, sanitizeReport(item)];
    }));
  }
  return typeof value === 'string' ? sanitizeString(value) : value;
}

export function scanFoundryObservability(options = {}) {
  const scanRoot = path.resolve(options.root ?? '.');
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  if (Number.isNaN(now.getTime())) throw new Error('now must be a valid date');
  const freshnessHours = Number(options.freshnessHours ?? DEFAULT_FRESHNESS_HOURS);
  const limits = { ...DEFAULT_LIMITS, ...(options.limits ?? {}) };
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  }
  if (!Number.isFinite(freshnessHours) || freshnessHours <= 0) throw new Error('freshnessHours must be positive');
  const discovered = discoverProjects(scanRoot);
  const projects = discovered.map((project) => {
    const excludedRoots = new Set(
      discovered
        .filter((other) =>
          other.directory &&
          project.directory &&
          other.directory !== project.directory &&
          inside(project.directory, other.directory)
        )
        .map((other) => path.resolve(other.directory))
    );
    return scanProject(project, scanRoot, now, freshnessHours, limits, excludedRoots);
  });
  const findings = projects.flatMap((project) => project.findings);
  const states = ['source-configured', 'fresh-verified', 'stale', 'unknown', 'not-applicable'];
  const report = {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    root: '.',
    limits,
    summary: {
      projects: projects.length,
      adapters: projects.reduce((total, project) => total + project.adapters.length, 0),
      findings: findings.length,
      byVerificationState: Object.fromEntries(states.map((state) => [
        state,
        projects.filter((project) => project.verification.state === state).length,
      ])),
    },
    projects,
    findings,
  };
  return sanitizeReport(report);
}

function markdownCell(value) {
  return sanitizeString(String(value ?? '-')).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
}

export function renderFoundryObservabilityMarkdown(report) {
  const safe = sanitizeReport(report);
  const lines = [
    '# Foundry Observability Inventory',
    '',
    `Generated: ${safe.generatedAt}`,
    '',
    `Projects: ${safe.summary.projects} · Adapters: ${safe.summary.adapters} · Findings: ${safe.summary.findings}`,
    '',
    '| Project | Verification | Adapters | Findings |',
    '| --- | --- | --- | ---: |',
  ];
  for (const project of safe.projects) {
    const adapters = project.adapters.map((adapter) => adapter.provider.id).join(', ') || '-';
    lines.push(`| ${markdownCell(project.projectId)} | ${markdownCell(project.verification.state)} | ${markdownCell(adapters)} | ${project.findings.length} |`);
  }
  lines.push('', '## Findings', '');
  if (safe.findings.length === 0) {
    lines.push('No source-inventory findings.');
  } else {
    for (const finding of safe.findings) {
      const location = finding.file ? ` (${finding.file}${finding.line ? `:${finding.line}` : ''})` : '';
      lines.push(`- **${markdownCell(finding.severity)} · ${markdownCell(finding.code)} · ${markdownCell(finding.projectId)}**${markdownCell(location)} — ${markdownCell(finding.message)}`);
    }
  }
  lines.push('', '## Interpretation', '',
    '- `source-configured` means source was found; it does not prove live delivery.',
    '- `fresh-verified` and `stale` require a successful, timestamped local verification receipt.',
    '- `not-applicable` is only used when the registry supplies a reason.',
    '- `unknown` means source or trustworthy verification evidence was unavailable.',
    ''
  );
  return lines.join('\n');
}
