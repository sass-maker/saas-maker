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
  product: 'Product & parity',
  design: 'Design & delight',
  seo: 'SEO & growth',
  geo: 'GEO & AI visibility',
  measurement: 'Measurement & learning',
  engineering: 'Engineering & operations',
};
export type Evidence = { source: string; date: string; note: string };
export type Score = {
  value: number | null;
  status: 'estimated' | 'unknown' | 'not_applicable';
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  evidence: Evidence[];
  originalValue?: number | string;
};
export type ScoreProject = {
  id: string;
  name: string;
  segment: string;
  domains: string[];
  internal: boolean;
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
  evidence: string;
  prerequisiteSatisfied: boolean;
  outcome: 'helped' | 'unchanged' | 'worse' | 'learning' | null;
  plan: { title: string; action: string; proof: string; baselineScore: number | null };
};
export type ScoreWorkspace = {
  schemaVersion: 1;
  snapshot: ScoreSnapshot;
  progress: Partial<Record<string, CycleRecord>>;
  history: CycleRecord[];
  updatedAt: string;
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
export const isCategory = (value: unknown): value is ScoreCategory =>
  SCORE_CATEGORIES.includes(value as ScoreCategory);
const isId = (value: unknown) => isText(value, 100) && /^[a-z0-9][a-z0-9-]*$/.test(value);

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
  requireValue(
    Array.isArray(input.projects) && input.projects.length > 0 && input.projects.length <= 500,
    'Import 1–500 projects.'
  );
  requireValue(
    Array.isArray(input.levers) && input.levers.length === input.projects.length * 6,
    'Every project needs exactly six category recommendations.'
  );
  const projectIds = new Set<string>();
  for (const p of input.projects) {
    requireValue(
      isObject(p) && isId(p.id) && !projectIds.has(p.id as string),
      'Project IDs must be valid and unique.'
    );
    projectIds.add(p.id as string);
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
      requireValue(
        isObject(s) && ['estimated', 'unknown', 'not_applicable'].includes(s.status as string),
        `Invalid ${c} score state.`
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
          s.evidence.every(
            (e) => isObject(e) && isText(e.source) && isDate(e.date) && isText(e.note)
          ),
        'Every score needs dated evidence or an explicit evidence-gap record.'
      );
    }
  }
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
  return { schemaVersion: 1, snapshot, progress: {}, history: [], updatedAt: at };
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
  requireValue(text.length <= 8_000_000, 'Import is too large (maximum 8 MB).');
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
    return input as unknown as ScoreWorkspace;
  }
  return createWorkspace(validateSnapshot(input));
}

export function importSnapshot(
  current: ScoreWorkspace | null,
  incoming: ScoreWorkspace
): ScoreWorkspace {
  if (!current) return incoming;
  // A workspace backup is explicit replacement. A new baseline preserves the cadence by stable ID.
  if (incoming.history.length || Object.keys(incoming.progress).length) return incoming;
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
    snapshot: {
      ...incoming.snapshot,
      levers: incoming.snapshot.levers.map((l) => retained.get(l.id) ?? l),
    },
    progress: Object.fromEntries(Object.entries(current.progress).filter(([id]) => ids.has(id))),
    history: current.history,
  };
}

export function scoreTotal(project: ScoreProject) {
  const scores = Object.values(project.scores);
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
  const record: CycleRecord = {
    id: `${leverId}:${crypto.randomUUID()}`,
    leverId,
    status,
    at,
    result: details.result?.trim() ?? '',
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
