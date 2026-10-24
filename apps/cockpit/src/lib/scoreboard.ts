export const SCORE_CATEGORIES = [
  'product',
  'design',
  'seo',
  'geo',
  'measurement',
  'engineering',
] as const;
export type ScoreCategory = (typeof SCORE_CATEGORIES)[number];
export const CATEGORY_LABELS: Record<ScoreCategory, string> = {
  product: 'Product & feature parity',
  design: 'Design & delight',
  seo: 'SEO & growth',
  geo: 'GEO & AI visibility',
  measurement: 'Measurement & learning',
  engineering: 'Engineering & operations',
};
export const CATEGORY_DESCRIPTIONS: Record<ScoreCategory, string> = {
  product:
    'Among the best in its segment at the core job, with agent-executable workflows and expected outcomes across promised, fit-for-purpose CLI, API, MCP or agent interfaces.',
  design: 'An aha moment, clear comprehension, low friction, and joy in the actual workflow.',
  seo: 'Up-to-date pages, proper keyword and intent matching, and growing daily organic arrivals.',
  geo: 'Prominent recommendations and citations when people ask relevant questions in AI engines.',
  measurement: 'Knowing what happened, what worked, and what to do next.',
  engineering: 'Dependable delivery, correctness, security, recovery, and operation.',
};
export const MAX_WORKSPACE_BYTES = 64_000_000;
export type Evidence = { source: string; date: string; note: string };
export type ScoreMetric = 'effort' | 'result';
export type UsagePrecision = 'exact' | 'lower_bound' | 'estimate' | 'unknown';
export type UsageOwnerReport = { date: string; note: string };
export type UsageEvent = {
  name: string;
  count: number;
  lastSeen: string | null;
  precision: 'exact' | 'estimate';
};
export type ProductUsageRecord = {
  windowStart: string;
  windowEnd: string;
  checkedAt: string;
  proxy: {
    count: number | null;
    unit: 'users' | 'browsers' | 'devices' | 'sessions';
    precision: UsagePrecision;
  };
  core: {
    count: number | null;
    definition: string;
    lastUsedAt: string | null;
    qualified: boolean;
    precision: UsagePrecision;
    coverage: 'complete' | 'partial' | 'unknown';
  };
  tracking: 'healthy' | 'partial' | 'missing';
  evidence: Evidence[];
  limitations: string;
  events?: UsageEvent[];
};
export type PortfolioUsage = {
  schemaVersion: 1;
  updatedAt: string;
  records: Record<string, ProductUsageRecord>;
  /** Local owner statements; these never add to an imported audience count. */
  ownerReports?: Record<string, UsageOwnerReport[]>;
};
export type PortfolioUsageBundle = {
  kind: 'portfolio-usage';
  schemaVersion: 1;
  usage: Omit<PortfolioUsage, 'ownerReports'>;
};
export type PortfolioUsageStatus =
  | 'use_recorded'
  | 'audience_only'
  | 'closure_review'
  | 'tracking_gap'
  | 'stale';
export function formatUsageCount(count: number | null, precision: UsagePrecision): string {
  if (count === null) return 'Unknown';
  if (precision === 'lower_bound') return `≥${count}`;
  if (precision === 'estimate') return `~${count}`;
  return String(count);
}
export const METRIC_LABELS: Record<ScoreMetric, string> = { effort: 'Effort', result: 'Result' };
export type ScoreReading = {
  value: number | null;
  status: 'estimated' | 'unknown' | 'not_applicable';
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  evidence: Evidence[];
  originalValue?: number | string;
};
export type Score = ScoreReading & { effort?: ScoreReading; result?: ScoreReading };

export const PURPOSE_LABELS = {
  'learn-skill-showoff': 'Learning / skill',
  'attention-money-grabber': 'Commercial / attention',
  'personal-use': 'I use it',
} as const;
export type PurposeCategory = keyof typeof PURPOSE_LABELS;

/** Owner intent, independent of quality scores and individual lever urgency. */
export function productPriority(project: ScoreProject): number {
  const purposes = project.purposeCategories ?? [];
  if (purposes.some((p) => p === 'learn-skill-showoff' || p === 'attention-money-grabber'))
    return 0;
  return purposes.includes('personal-use') ? 1 : 2;
}

export function productPriorityLabel(project: ScoreProject): string {
  return ['Focus', 'Standard', 'Unclassified'][productPriority(project)];
}

/** Older combined estimates stay intact; they are never relabelled as outcomes. */
export function scoreReading(score: Score, metric: ScoreMetric): ScoreReading {
  if (score[metric]) return score[metric];
  if (score.status === 'not_applicable') return score;
  return {
    value: null,
    status: 'unknown',
    confidence: 'low',
    reason: `This review did not assess ${METRIC_LABELS[metric].toLowerCase()} separately. Its previous combined estimate is preserved, including its evidence; it cannot establish this separate score.`,
    evidence: score.evidence,
  };
}
export type ScoreProject = {
  id: string;
  name: string;
  segment: string;
  domains: string[];
  internal: boolean;
  purposeCategories?: PurposeCategory[];
  bestNextLeverId: string;
  sourceRevision: string;
  limitations: string[];
  scores: Record<ScoreCategory, Score>;
};
export type Lever = {
  id: string;
  projectId: string;
  category: ScoreCategory;
  title: string;
  action: string;
  why: string;
  proof: string;
  priority: 'critical' | 'high' | 'normal';
  kind: 'action' | 'scope';
  dependencies: string[];
  followsCycleId?: string;
};
export type ScoreSnapshot = {
  schemaVersion: 1;
  assessedAt: string;
  label: string;
  target: number;
  projects: ScoreProject[];
  levers: Lever[];
};
export type LeverStatus = 'queued' | 'active' | 'awaiting_evidence' | 'verified' | 'parked';
export type CycleRecord = {
  id: string;
  leverId: string;
  status: Exclude<LeverStatus, 'queued'>;
  at: string;
  result: string;
  work?: string;
  observedResult?: string;
  evidence: string;
  prerequisiteSatisfied: boolean;
  outcome: 'helped' | 'unchanged' | 'worse' | 'learning' | null;
  plan: {
    title: string;
    action: string;
    proof: string;
    baselineScore: number | null;
    baselineEffort?: number | null;
    baselineResult?: number | null;
  };
};
export type Assessment = {
  id: string;
  assessedAt: string;
  recordedAt: string;
  label: string;
  target: number;
  note: string;
  projects: ScoreProject[];
};
export type ScoreWorkspace = {
  schemaVersion: 1;
  snapshot: ScoreSnapshot;
  progress: Partial<Record<string, CycleRecord>>;
  history: CycleRecord[];
  updatedAt: string;
  assessments?: Assessment[];
  usage?: PortfolioUsage;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
function requireValue(test: unknown, message: string): asserts test {
  if (!test) throw new Error(message);
}
function isText(value: unknown, max = 20_000): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}
const isDate = (value: unknown) => isText(value, 64) && Number.isFinite(Date.parse(value));
const isDateOnly = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
  new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
const localDateOnly = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const isRecentOwnerUse = (date: string, now: number) => {
  const today = localDateOnly(new Date(now));
  const daysAgo = Date.parse(`${today}T00:00:00.000Z`) - Date.parse(`${date}T00:00:00.000Z`);
  return daysAgo >= 0 && daysAgo < THIRTY_DAYS;
};
const isIsoTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d{1,9})?Z$/.exec(value);
  return Boolean(
    match &&
      Number.isFinite(Date.parse(value)) &&
      new Date(`${match[1]}.000Z`).toISOString().slice(0, 19) === match[1]
  );
};
export const isCategory = (value: unknown): value is ScoreCategory =>
  SCORE_CATEGORIES.includes(value as ScoreCategory);
const isId = (value: unknown) => isText(value, 100) && /^[a-z0-9][a-z0-9-]*$/.test(value);
const MAX_USAGE_RECORDS = 500;
const MAX_USAGE_EVENTS = 100;
const MAX_OWNER_REPORTS = 1000;
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

function exactKeys(value: Record<string, unknown>, allowed: string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function validateUsageRecord(input: unknown): asserts input is ProductUsageRecord {
  requireValue(
    isObject(input) &&
      exactKeys(input, [
        'windowStart',
        'windowEnd',
        'checkedAt',
        'proxy',
        'core',
        'tracking',
        'evidence',
        'limitations',
        'events',
      ]) &&
      isIsoTimestamp(input.windowStart) &&
      isIsoTimestamp(input.windowEnd) &&
      isIsoTimestamp(input.checkedAt) &&
      Date.parse(input.windowEnd) - Date.parse(input.windowStart) === THIRTY_DAYS &&
      Date.parse(input.checkedAt) >= Date.parse(input.windowEnd),
    'Usage needs an exact rolling 30-day UTC window and check date.'
  );
  requireValue(
    isObject(input.proxy) &&
      exactKeys(input.proxy, ['count', 'unit', 'precision']) &&
      ['users', 'browsers', 'devices', 'sessions'].includes(input.proxy.unit as string) &&
      ['exact', 'lower_bound', 'estimate', 'unknown'].includes(input.proxy.precision as string) &&
      (input.proxy.count === null ||
        (typeof input.proxy.count === 'number' &&
          Number.isSafeInteger(input.proxy.count) &&
          input.proxy.count >= 0)) &&
      ((input.proxy.count === null && input.proxy.precision === 'unknown') ||
        (input.proxy.count !== null && input.proxy.precision !== 'unknown')),
    'Invalid audience proxy count, unit or precision.'
  );
  requireValue(
    isObject(input.core) &&
      exactKeys(input.core, [
        'count',
        'definition',
        'lastUsedAt',
        'qualified',
        'precision',
        'coverage',
      ]) &&
      (input.core.count === null ||
        (typeof input.core.count === 'number' &&
          Number.isSafeInteger(input.core.count) &&
          input.core.count >= 0)) &&
      isText(input.core.definition, 1000) &&
      (input.core.lastUsedAt === null || isIsoTimestamp(input.core.lastUsedAt)) &&
      typeof input.core.qualified === 'boolean' &&
      ['exact', 'lower_bound', 'estimate', 'unknown'].includes(input.core.precision as string) &&
      ['complete', 'partial', 'unknown'].includes(input.core.coverage as string) &&
      ((input.core.count === null && input.core.precision === 'unknown' && !input.core.qualified) ||
        (input.core.count !== null && input.core.precision !== 'unknown')) &&
      (!input.core.qualified ||
        (input.core.count !== null &&
          Array.isArray(input.evidence) &&
          input.evidence.length > 0 &&
          input.evidence.some(
            (e) =>
              isObject(e) &&
              (isIsoTimestamp(e.date) || isDateOnly(e.date)) &&
              Date.parse(e.date as string) <= Date.parse(input.checkedAt as string)
          ) &&
          ((input.core.count > 0 &&
            input.core.lastUsedAt !== null &&
            Date.parse(input.core.lastUsedAt) >= Date.parse(input.windowStart) &&
            Date.parse(input.core.lastUsedAt) < Date.parse(input.windowEnd)) ||
            (input.core.count === 0 &&
              input.core.lastUsedAt === null &&
              input.core.precision === 'exact' &&
              input.core.coverage === 'complete' &&
              input.tracking === 'healthy')))),
    'Invalid core-action count, definition, coverage or qualification.'
  );
  requireValue(
    ['healthy', 'partial', 'missing'].includes(input.tracking as string) &&
      typeof input.limitations === 'string' &&
      input.limitations.length <= 2000 &&
      Array.isArray(input.evidence) &&
      input.evidence.length <= 100 &&
      input.evidence.every(
        (e) =>
          isObject(e) &&
          exactKeys(e, ['source', 'date', 'note']) &&
          typeof e.source === 'string' &&
          /^[A-Za-z][A-Za-z0-9 ._-]{0,99}$/.test(e.source) &&
          (isIsoTimestamp(e.date) || isDateOnly(e.date)) &&
          isText(e.note, 5000) &&
          !/https?:\/\/|[?&][A-Za-z0-9_]*id=/i.test(e.note)
      ),
    'Invalid usage tracking, limitations or evidence.'
  );
  if (input.events !== undefined)
    requireValue(
      Array.isArray(input.events) &&
        input.events.length <= MAX_USAGE_EVENTS &&
        input.events.every(
          (e) =>
            isObject(e) &&
            exactKeys(e, ['name', 'count', 'lastSeen', 'precision']) &&
            typeof e.name === 'string' &&
            /^[A-Za-z][A-Za-z0-9_.:-]{0,99}$/.test(e.name) &&
            typeof e.count === 'number' &&
            Number.isFinite(e.count) &&
            e.count >= 0 &&
            e.count <= Number.MAX_SAFE_INTEGER &&
            (e.lastSeen === null || isIsoTimestamp(e.lastSeen)) &&
            ['exact', 'estimate'].includes(e.precision as string)
        ),
      'Invalid candidate event aggregates.'
    );
}

function validatePortfolioUsage(
  input: unknown,
  allowOwnerReports: boolean
): asserts input is PortfolioUsage {
  requireValue(
    isObject(input) &&
      exactKeys(
        input,
        allowOwnerReports
          ? ['schemaVersion', 'updatedAt', 'records', 'ownerReports']
          : ['schemaVersion', 'updatedAt', 'records']
      ) &&
      input.schemaVersion === 1 &&
      isIsoTimestamp(input.updatedAt) &&
      isObject(input.records) &&
      Object.keys(input.records).length <= MAX_USAGE_RECORDS,
    'Invalid portfolio-usage update.'
  );
  for (const [id, record] of Object.entries(input.records)) {
    requireValue(isId(id), 'Usage record IDs must be canonical project IDs.');
    validateUsageRecord(record);
  }
  if (input.ownerReports !== undefined)
    requireValue(
      allowOwnerReports &&
        isObject(input.ownerReports) &&
        Object.entries(input.ownerReports).every(
          ([id, reports]) =>
            isId(id) &&
            Array.isArray(reports) &&
            reports.length <= MAX_OWNER_REPORTS &&
            reports.every(
              (report) =>
                isObject(report) &&
                exactKeys(report, ['date', 'note']) &&
                isDateOnly(report.date) &&
                isText(report.note, 500)
            )
        ),
      'Invalid local owner-use reports.'
    );
}

export function parsePortfolioUsageBundle(text: string): PortfolioUsageBundle {
  requireValue(text.length <= MAX_WORKSPACE_BYTES, 'Import is too large (maximum 64 MB).');
  const input: unknown = JSON.parse(text);
  requireValue(
    isObject(input) &&
      exactKeys(input, ['kind', 'schemaVersion', 'usage']) &&
      input.kind === 'portfolio-usage' &&
      input.schemaVersion === 1,
    'This is not a supported portfolio-usage import.'
  );
  validatePortfolioUsage(input.usage, false);
  return input as unknown as PortfolioUsageBundle;
}

export function mergePortfolioUsage(
  current: ScoreWorkspace,
  incoming: PortfolioUsageBundle
): { workspace: ScoreWorkspace; matched: number; unmatched: number; skippedOlder: number } {
  const currentIds = new Set(current.snapshot.projects.map((project) => project.id));
  const incomingIds = Object.keys(incoming.usage.records);
  const existing = current.usage;
  const matchingIds = incomingIds.filter((id) => currentIds.has(id));
  const skippedOlder = matchingIds.filter((id) => {
    const stored = existing?.records[id];
    return (
      stored && Date.parse(incoming.usage.records[id].checkedAt) < Date.parse(stored.checkedAt)
    );
  }).length;
  const matchedRecords = Object.fromEntries(
    matchingIds
      .filter((id) => {
        const stored = existing?.records[id];
        return (
          !stored ||
          Date.parse(incoming.usage.records[id].checkedAt) >= Date.parse(stored.checkedAt)
        );
      })
      .map((id) => [id, incoming.usage.records[id]])
  );
  const usage: PortfolioUsage = {
    schemaVersion: 1,
    updatedAt:
      existing && Date.parse(existing.updatedAt) > Date.parse(incoming.usage.updatedAt)
        ? existing.updatedAt
        : incoming.usage.updatedAt,
    records: { ...existing?.records, ...matchedRecords },
    ...(existing?.ownerReports && { ownerReports: existing.ownerReports }),
  };
  validatePortfolioUsage(usage, true);
  return {
    workspace: { ...current, usage },
    matched: matchingIds.length,
    unmatched: incomingIds.length - matchingIds.length,
    skippedOlder,
  };
}

export function recordOwnerUse(
  current: ScoreWorkspace,
  projectId: string,
  report: UsageOwnerReport,
  at = new Date().toISOString(),
  now = Date.now()
): ScoreWorkspace {
  requireValue(
    current.snapshot.projects.some((project) => project.id === projectId),
    'Unknown product.'
  );
  requireValue(
    isDateOnly(report.date) &&
      report.date <= localDateOnly(new Date(now)) &&
      isText(report.note, 500),
    'Enter a past date and a brief non-sensitive action note.'
  );
  const usage = current.usage ?? { schemaVersion: 1 as const, updatedAt: at, records: {} };
  const reports = usage.ownerReports?.[projectId] ?? [];
  requireValue(
    reports.length < MAX_OWNER_REPORTS,
    'Owner-use history is full; export a backup first.'
  );
  const nextUsage = {
    ...usage,
    updatedAt: at,
    ownerReports: { ...usage.ownerReports, [projectId]: [...reports, report] },
  };
  validatePortfolioUsage(nextUsage, true);
  return { ...current, usage: nextUsage };
}

export function portfolioUsageStatus(
  usage: PortfolioUsage | undefined,
  projectId: string,
  now = Date.now()
): PortfolioUsageStatus {
  const recentOwnerUse = usage?.ownerReports?.[projectId]?.some((report) => {
    return isRecentOwnerUse(report.date, now);
  });
  if (recentOwnerUse) return 'use_recorded';
  const record = usage?.records[projectId];
  if (!record) return 'tracking_gap';
  const checkedAt = Date.parse(record.checkedAt);
  const windowEnd = Date.parse(record.windowEnd);
  const fresh =
    checkedAt <= now &&
    now - checkedAt <= SEVEN_DAYS &&
    windowEnd <= now &&
    now - windowEnd <= SEVEN_DAYS;
  const recentCoreUse =
    record.core.qualified &&
    record.core.count !== null &&
    record.core.count > 0 &&
    record.core.lastUsedAt !== null &&
    Date.parse(record.core.lastUsedAt) <= now &&
    now - Date.parse(record.core.lastUsedAt) <= THIRTY_DAYS;
  if (recentCoreUse) return 'use_recorded';
  const completeZero =
    fresh &&
    record.tracking === 'healthy' &&
    record.core.coverage === 'complete' &&
    record.core.qualified &&
    record.core.precision === 'exact' &&
    record.core.count === 0;
  if (completeZero) return 'closure_review';
  if (fresh && record.proxy.count !== null && record.proxy.count > 0) return 'audience_only';
  if (!fresh) return 'stale';
  return 'tracking_gap';
}

function validateReading(s: unknown): asserts s is Score {
  requireValue(
    isObject(s) && ['estimated', 'unknown', 'not_applicable'].includes(s.status as string),
    'Invalid score state.'
  );
  requireValue(
    s.status === 'estimated'
      ? typeof s.value === 'number' && Number.isFinite(s.value) && s.value >= 0 && s.value <= 10
      : s.value === null,
    'Unknown and exempt scores must be null; estimates must be 0–10.'
  );
  requireValue(
    ['high', 'medium', 'low'].includes(s.confidence as string) && isText(s.reason),
    'Every score needs confidence and reasoning.'
  );
  requireValue(
    Array.isArray(s.evidence) &&
      s.evidence.length > 0 &&
      s.evidence.every((e) => isObject(e) && isText(e.source) && isDate(e.date) && isText(e.note)),
    'Every score needs dated evidence or an explicit evidence-gap record.'
  );
}

function validateProjects(projects: unknown): asserts projects is ScoreProject[] {
  requireValue(
    Array.isArray(projects) && projects.length > 0 && projects.length <= 500,
    'Import 1–500 projects.'
  );
  const projectIds = new Set<string>();
  for (const p of projects) {
    requireValue(
      isObject(p) && isId(p.id) && !projectIds.has(p.id as string),
      'Project IDs must be valid and unique.'
    );
    projectIds.add(p.id as string);
    requireValue(
      p.purposeCategories === undefined ||
        (Array.isArray(p.purposeCategories) &&
          p.purposeCategories.every(
            (x) => typeof x === 'string' && Object.hasOwn(PURPOSE_LABELS, x)
          ) &&
          new Set(p.purposeCategories).size === p.purposeCategories.length),
      'Purpose categories must be unique owner-purpose labels.'
    );
    requireValue(
      isText(p.name, 160) && isText(p.segment) && typeof p.internal === 'boolean',
      'Project name, segment and evaluation scope are required.'
    );
    requireValue(
      Array.isArray(p.domains) && p.domains.every((x) => isText(x, 253)),
      'Domains must be text.'
    );
    requireValue(
      Array.isArray(p.limitations) && p.limitations.every((x) => isText(x)),
      'Limitations must be text.'
    );
    requireValue(
      isText(p.sourceRevision, 200) && isText(p.bestNextLeverId, 140),
      'Source and best next lever are required.'
    );
    requireValue(
      isObject(p.scores) && Object.keys(p.scores).length === 6,
      'Every project needs six scores.'
    );
    for (const c of SCORE_CATEGORIES) {
      const s = p.scores[c];
      validateReading(s);
      if (s.effort !== undefined || s.result !== undefined) {
        requireValue(
          s.effort !== undefined && s.result !== undefined,
          'A split assessment needs both effort and result readings.'
        );
        validateReading(s.effort);
        validateReading(s.result);
        const exempt = s.status === 'not_applicable';
        requireValue(
          (s.effort.status === 'not_applicable') === exempt &&
            (s.result.status === 'not_applicable') === exempt,
          'Effort and result must preserve the category scope.'
        );
      }
    }
  }
}

export function validateSnapshot(input: unknown): ScoreSnapshot {
  requireValue(isObject(input) && input.schemaVersion === 1, 'Unsupported scoreboard schema.');
  requireValue(
    isDate(input.assessedAt) && isText(input.label, 200),
    'A dated review label is required.'
  );
  requireValue(
    typeof input.target === 'number' && input.target >= 0 && input.target <= 10,
    'Target must be between 0 and 10.'
  );
  validateProjects(input.projects);
  requireValue(
    Array.isArray(input.levers) && input.levers.length === input.projects.length * 6,
    'Every project needs exactly six category recommendations.'
  );
  const projectIds = new Set(input.projects.map((p) => p.id));
  const leverIds = new Set<string>();
  for (const l of input.levers) {
    requireValue(
      isObject(l) && projectIds.has(l.projectId as string) && isCategory(l.category),
      'A lever must belong to an existing project and category.'
    );
    requireValue(
      l.id === `${l.projectId}:${l.category}` && !leverIds.has(l.id as string),
      'Lever IDs must be unique project:category pairs.'
    );
    leverIds.add(l.id as string);
    requireValue(
      ['title', 'action', 'why', 'proof'].every((key) => isText(l[key])),
      'Every recommendation needs an action, reason and observable proof.'
    );
    requireValue(
      ['critical', 'high', 'normal'].includes(l.priority as string) &&
        ['action', 'scope'].includes(l.kind as string),
      'Invalid lever priority or kind.'
    );
    requireValue(
      l.followsCycleId === undefined || isText(l.followsCycleId, 200),
      'Invalid follow-up reference.'
    );
    requireValue(
      Array.isArray(l.dependencies) && l.dependencies.every((x) => isText(x, 140)),
      'Invalid dependencies.'
    );
  }
  for (const p of input.projects) {
    requireValue(
      leverIds.has(p.bestNextLeverId as string) &&
        (p.bestNextLeverId as string).startsWith(`${p.id}:`),
      'Best next lever must belong to its project.'
    );
  }
  for (const l of input.levers) {
    requireValue(
      (l as Lever).dependencies.every((id) => leverIds.has(id) && id !== l.id),
      'Unknown or self-referencing dependency.'
    );
  }
  const byId = new Map((input.levers as Lever[]).map((l) => [l.id, l]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    requireValue(!visiting.has(id), 'Recommendation dependencies must not contain a cycle.');
    if (visited.has(id)) return;
    visiting.add(id);
    byId.get(id)?.dependencies.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  };
  byId.forEach((l) => visit(l.id));
  return input as unknown as ScoreSnapshot;
}

export function createWorkspace(
  snapshot: ScoreSnapshot,
  at = new Date().toISOString()
): ScoreWorkspace {
  return {
    schemaVersion: 1,
    snapshot,
    progress: {},
    history: [],
    updatedAt: at,
    assessments: [archiveAssessment(snapshot, at)],
  };
}

function validateCycle(input: unknown): asserts input is CycleRecord {
  requireValue(
    isObject(input) && isText(input.id, 200) && isText(input.leverId, 140) && isDate(input.at),
    'Invalid cadence record.'
  );
  requireValue(
    ['active', 'awaiting_evidence', 'verified', 'parked'].includes(input.status as string),
    'Invalid cadence status.'
  );
  requireValue(
    typeof input.result === 'string' &&
      typeof input.evidence === 'string' &&
      input.result.length <= 20_000 &&
      input.evidence.length <= 20_000,
    'Invalid result or evidence.'
  );
  if (input.work !== undefined || input.observedResult !== undefined) {
    requireValue(
      typeof input.work === 'string' &&
        input.work.length <= 20_000 &&
        typeof input.observedResult === 'string' &&
        input.observedResult.length <= 20_000,
      'Invalid effort or result note.'
    );
    if (input.status === 'verified')
      requireValue(
        isText(input.observedResult),
        'Verification needs an observed result, separate from work completed.'
      );
  }
  requireValue(
    input.outcome === null ||
      ['helped', 'unchanged', 'worse', 'learning'].includes(input.outcome as string),
    'Invalid outcome.'
  );
  requireValue(
    isObject(input.plan) &&
      ['title', 'action', 'proof'].every((key) =>
        isText((input.plan as Record<string, unknown>)[key])
      ),
    'History must preserve the plan being evaluated.'
  );
  requireValue(
    input.plan.baselineScore === null ||
      (typeof input.plan.baselineScore === 'number' &&
        Number.isFinite(input.plan.baselineScore) &&
        input.plan.baselineScore >= 0 &&
        input.plan.baselineScore <= 10),
    'Invalid historical score.'
  );
  for (const key of ['baselineEffort', 'baselineResult']) {
    const value = input.plan[key];
    requireValue(
      value === undefined ||
        value === null ||
        (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10),
      'Invalid split historical baseline.'
    );
  }
  requireValue(
    typeof input.prerequisiteSatisfied === 'boolean' &&
      (!input.prerequisiteSatisfied || (input.status === 'verified' && input.outcome === 'helped')),
    'Prerequisite acceptance requires a verified helpful outcome.'
  );
  if (input.status !== 'active')
    requireValue(isText(input.result), 'Record what happened before leaving active work.');
  if (input.status === 'verified')
    requireValue(
      isText(input.evidence) && input.outcome !== null,
      'Verification needs a result, evidence and outcome.'
    );
}

export function parseWorkspace(text: string): ScoreWorkspace {
  requireValue(text.length <= MAX_WORKSPACE_BYTES, 'Import is too large (maximum 64 MB).');
  const input: unknown = JSON.parse(text);
  if (isObject(input) && 'snapshot' in input) {
    requireValue(
      input.schemaVersion === 1 && isDate(input.updatedAt),
      'Invalid workspace version/date.'
    );
    const snapshot = validateSnapshot(input.snapshot);
    requireValue(
      isObject(input.progress) && Array.isArray(input.history),
      'Invalid cadence history.'
    );
    const ids = new Set(snapshot.levers.map((l) => l.id));
    let active = 0;
    for (const [id, record] of Object.entries(input.progress)) {
      validateCycle(record);
      requireValue(ids.has(id) && record.leverId === id, 'Progress references an unknown lever.');
      if (record.status === 'active') active++;
    }
    requireValue(active <= 1, 'A workspace can have only one active lever.');
    input.history.forEach(validateCycle);
    const workspace = input as unknown as ScoreWorkspace;
    const archived = input.assessments;
    requireValue(
      archived === undefined || (Array.isArray(archived) && archived.length <= 1000),
      'Invalid assessment history.'
    );
    const records = (archived ?? []) as unknown[];
    const reviewIds = new Set<string>();
    for (const record of records) {
      validateAssessment(record);
      requireValue(!reviewIds.has(record.id), 'Assessment IDs must be unique.');
      reviewIds.add(record.id);
    }
    if (input.usage !== undefined) validatePortfolioUsage(input.usage, true);
    workspace.assessments = mergeAssessments(records as Assessment[], [
      archiveAssessment(snapshot, workspace.updatedAt),
    ]);
    return workspace;
  }
  return createWorkspace(validateSnapshot(input));
}

export function importSnapshot(
  current: ScoreWorkspace | null,
  incoming: ScoreWorkspace
): ScoreWorkspace {
  if (!current) return incoming;
  const preserveUsage =
    incoming.usage === undefined && current.usage !== undefined ? { usage: current.usage } : {};
  // A workspace backup is explicit replacement. A new baseline preserves the cadence by stable ID.
  if (incoming.history.length || Object.keys(incoming.progress).length)
    return { ...incoming, ...preserveUsage };
  const ids = new Set(incoming.snapshot.levers.map((l) => l.id));
  const active = Object.values(current.progress).find((p) => p?.status === 'active');
  requireValue(
    !active || ids.has(active.leverId),
    'The new baseline removes your active lever. Park or finish it first.'
  );
  const retained = new Map(
    current.snapshot.levers
      .filter((l) => l.followsCycleId || current.progress[l.id])
      .map((l) => [l.id, l])
  );
  return {
    ...incoming,
    ...preserveUsage,
    snapshot: {
      ...incoming.snapshot,
      levers: incoming.snapshot.levers.map((l) => retained.get(l.id) ?? l),
    },
    progress: Object.fromEntries(Object.entries(current.progress).filter(([id]) => ids.has(id))),
    history: current.history,
    assessments: mergeAssessments(assessmentHistory(current), assessmentHistory(incoming)),
  };
}

export function archiveAssessment(
  snapshot: ScoreSnapshot,
  recordedAt = new Date().toISOString(),
  note = 'Imported assessment. Score changes may reflect product work or revised evidence.'
): Assessment {
  return {
    id: crypto.randomUUID(),
    assessedAt: snapshot.assessedAt,
    recordedAt,
    label: snapshot.label,
    target: snapshot.target,
    note,
    projects: structuredClone(snapshot.projects),
  };
}

function validateAssessment(input: unknown): asserts input is Assessment {
  requireValue(
    isObject(input) &&
      isText(input.id, 200) &&
      isDate(input.assessedAt) &&
      isDate(input.recordedAt),
    'Invalid assessment identity or date.'
  );
  requireValue(
    isText(input.label, 200) && isText(input.note),
    'An archived assessment needs a label and note.'
  );
  requireValue(
    typeof input.target === 'number' && input.target >= 0 && input.target <= 10,
    'Invalid historical target.'
  );
  validateProjects(input.projects);
}

// Stable across object-key order and lever follow-ups. Only an assessment import
// creates a new score version; ordinary cadence actions never manufacture one.
function readingKey(s: ScoreReading) {
  return [
    s.status,
    s.value,
    s.confidence,
    s.reason,
    s.evidence.map((e) => [e.source, e.date, e.note]),
  ];
}
function assessmentKey(a: Assessment) {
  return JSON.stringify([
    a.assessedAt,
    a.label,
    a.target,
    [...a.projects]
      .sort((x, y) => x.id.localeCompare(y.id))
      .map((p) => [
        p.id,
        p.name,
        p.segment,
        p.internal,
        p.domains,
        p.sourceRevision,
        p.limitations,
        SCORE_CATEGORIES.map((c) => {
          const s = p.scores[c];
          return [
            c,
            readingKey(s),
            s.effort ? readingKey(s.effort) : null,
            s.result ? readingKey(s.result) : null,
          ];
        }),
      ]),
  ]);
}

export function mergeAssessments(before: Assessment[], after: Assessment[]): Assessment[] {
  const unique = new Map<string, Assessment>();
  const ids = new Set<string>();
  for (const a of [...before, ...after]) {
    const key = assessmentKey(a);
    if (!unique.has(key)) {
      requireValue(
        !ids.has(a.id),
        'An assessment ID refers to conflicting versions. Existing history was preserved.'
      );
      unique.set(key, a);
      ids.add(a.id);
    }
  }
  requireValue(
    unique.size <= 1000,
    'Assessment history is full. Export your history before starting a new workspace.'
  );
  return [...unique.values()].sort(
    (a, b) =>
      Date.parse(a.assessedAt) - Date.parse(b.assessedAt) ||
      Date.parse(a.recordedAt) - Date.parse(b.recordedAt)
  );
}

export function assessmentHistory(workspace: ScoreWorkspace): Assessment[] {
  const current = archiveAssessment(workspace.snapshot, workspace.updatedAt);
  return mergeAssessments(workspace.assessments ?? [], [current]);
}

export function currentAssessment(workspace: ScoreWorkspace): Assessment {
  const current = archiveAssessment(workspace.snapshot, workspace.updatedAt);
  return assessmentHistory(workspace).find((a) => assessmentKey(a) === assessmentKey(current))!;
}

export function addAssessmentHistory(
  current: ScoreWorkspace,
  incoming: ScoreWorkspace
): ScoreWorkspace {
  return {
    ...current,
    assessments: mergeAssessments(assessmentHistory(current), assessmentHistory(incoming)),
    updatedAt: new Date().toISOString(),
  };
}

export type ScoreChange = {
  id: string;
  category: ScoreCategory;
  project: ScoreProject;
  beforeProject: ScoreProject | null;
  afterProject: ScoreProject | null;
  before: ScoreReading | null;
  after: ScoreReading | null;
  delta: number | null;
  state:
    | 'increased'
    | 'decreased'
    | 'unchanged'
    | 'evidence_updated'
    | 'newly_assessed'
    | 'scope_changed'
    | 'added'
    | 'removed'
    | 'unassessed';
};
export function compareAssessments(
  before: Assessment,
  after: Assessment,
  metric?: ScoreMetric
): ScoreChange[] {
  const old = new Map(before.projects.map((p) => [p.id, p]));
  const current = new Map(after.projects.map((p) => [p.id, p]));
  return [...new Set([...old.keys(), ...current.keys()])].flatMap((id) =>
    SCORE_CATEGORIES.map((category) => {
      const a = old.get(id) ?? null,
        b = current.get(id) ?? null;
      const previous = a
          ? metric
            ? scoreReading(a.scores[category], metric)
            : a.scores[category]
          : null,
        next = b ? (metric ? scoreReading(b.scores[category], metric) : b.scores[category]) : null;
      const scopeChanged =
        a &&
        b &&
        (a.internal !== b.internal ||
          a.segment !== b.segment ||
          (previous?.status === 'not_applicable') !== (next?.status === 'not_applicable'));
      const delta =
        !scopeChanged && previous?.status === 'estimated' && next?.status === 'estimated'
          ? Number(((next.value ?? 0) - (previous.value ?? 0)).toFixed(2))
          : null;
      const state: ScoreChange['state'] = !a
        ? 'added'
        : !b
          ? 'removed'
          : scopeChanged
            ? 'scope_changed'
            : delta !== null
              ? delta > 0
                ? 'increased'
                : delta < 0
                  ? 'decreased'
                  : JSON.stringify([previous?.confidence, previous?.reason, previous?.evidence]) !==
                      JSON.stringify([next?.confidence, next?.reason, next?.evidence])
                    ? 'evidence_updated'
                    : 'unchanged'
              : previous?.status === 'unknown' && next?.status === 'estimated'
                ? 'newly_assessed'
                : previous?.status === next?.status
                  ? 'unchanged'
                  : 'unassessed';
      return {
        id: `${id}:${category}`,
        category,
        project: b ?? a!,
        beforeProject: a,
        afterProject: b,
        before: previous,
        after: next,
        delta,
        state,
      };
    })
  );
}

/** Sort by displayed known points, including partial totals. No known score sorts last. */
export function sortableTotal(project: ScoreProject, metric?: ScoreMetric): number | null {
  const total = scoreTotal(project, metric);
  return total.knownMax > 0 ? total.sum : null;
}

export function scoreTotal(project: ScoreProject, metric?: ScoreMetric) {
  const scores = Object.values(project.scores).map((s) => (metric ? scoreReading(s, metric) : s));
  const known = scores.filter((s) => s.status === 'estimated');
  const unknown = scores.filter((s) => s.status === 'unknown').length;
  const exempt = scores.filter((s) => s.status === 'not_applicable').length;
  return {
    sum: known.reduce((total, s) => total + (s.value ?? 0), 0),
    knownMax: known.length * 10,
    maximum: (6 - exempt) * 10,
    unknown,
    exempt,
    complete: unknown === 0,
  };
}

export function prerequisiteSatisfied(workspace: ScoreWorkspace, id: string) {
  return workspace.history.some(
    (r) => r.leverId === id && r.status === 'verified' && r.prerequisiteSatisfied
  );
}

export function transitionLever(
  workspace: ScoreWorkspace,
  leverId: string,
  status: Exclude<LeverStatus, 'queued'>,
  details: {
    result?: string;
    work?: string;
    observedResult?: string;
    evidence?: string;
    outcome?: CycleRecord['outcome'];
    prerequisiteSatisfied?: boolean;
  } = {},
  at = new Date().toISOString()
): ScoreWorkspace {
  const lever = workspace.snapshot.levers.find((l) => l.id === leverId);
  requireValue(
    lever && lever.kind === 'action',
    'Scope exemptions are decisions to preserve, not growth tasks to start.'
  );
  const previous = workspace.progress[leverId];
  if (status === 'active') {
    requireValue(
      !Object.values(workspace.progress).some(
        (p) => p?.status === 'active' && p.leverId !== leverId
      ),
      'Finish, park or await evidence on the active lever before picking another.'
    );
    requireValue(
      previous?.status !== 'verified',
      'This lever is already verified. Refresh its assessment before starting a new cycle.'
    );
    const blocked = lever.dependencies.filter((id) => !prerequisiteSatisfied(workspace, id));
    requireValue(blocked.length === 0, `Verify prerequisites first: ${blocked.join(', ')}.`);
  } else {
    requireValue(
      previous?.status === 'active' || previous?.status === 'awaiting_evidence',
      'Start the lever before recording its outcome.'
    );
  }
  const project = workspace.snapshot.projects.find((p) => p.id === lever.projectId)!;
  const record: CycleRecord = {
    id: `${leverId}:${crypto.randomUUID()}`,
    leverId,
    status,
    at,
    result: details.result?.trim() ?? '',
    ...(details.work !== undefined || details.observedResult !== undefined
      ? { work: details.work?.trim() ?? '', observedResult: details.observedResult?.trim() ?? '' }
      : {}),
    evidence: details.evidence?.trim() ?? '',
    outcome: details.outcome ?? null,
    prerequisiteSatisfied: status === 'verified' && (details.prerequisiteSatisfied ?? false),
    plan: previous?.plan ?? {
      title: lever.title,
      action: lever.action,
      proof: lever.proof,
      baselineScore:
        workspace.snapshot.projects.find((p) => p.id === lever.projectId)?.scores[lever.category]
          .value ?? null,
      baselineEffort: scoreReading(project.scores[lever.category], 'effort').value,
      baselineResult: scoreReading(project.scores[lever.category], 'result').value,
    },
  };
  validateCycle(record);
  return {
    ...workspace,
    progress: { ...workspace.progress, [leverId]: record },
    history: [...workspace.history, record],
    updatedAt: at,
  };
}

export function planNextLever(
  workspace: ScoreWorkspace,
  leverId: string,
  plan: Pick<Lever, 'title' | 'action' | 'proof'>
): ScoreWorkspace {
  const previous = workspace.progress[leverId];
  requireValue(
    previous?.status === 'verified' || previous?.status === 'parked',
    'Verify or park the previous lever before planning its replacement.'
  );
  requireValue(
    [plan.title, plan.action, plan.proof].every((x) => isText(x)),
    'The next lever needs a title, action and observable proof.'
  );
  const progress = { ...workspace.progress };
  delete progress[leverId];
  return {
    ...workspace,
    snapshot: {
      ...workspace.snapshot,
      levers: workspace.snapshot.levers.map((l) =>
        l.id === leverId
          ? {
              ...l,
              ...plan,
              followsCycleId: previous.id,
              why: `Follow-up to ${previous.plan.title}: ${previous.result}`,
              dependencies: [],
            }
          : l
      ),
    },
    progress,
    updatedAt: new Date().toISOString(),
  };
}

export function safeEvidenceUrl(source: string): string | null {
  try {
    const url = new URL(source);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export const formatScore = (value: number) =>
  Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));

/** Storage may be disabled; callers can continue with an in-tab workspace. */
export function readScoreboardStorage(read: () => string | null) {
  try {
    return { available: true, raw: read() };
  } catch {
    return { available: false, raw: null };
  }
}
