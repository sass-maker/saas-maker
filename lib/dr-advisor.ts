type AdvisorTrend = {
  direction: 'up' | 'down' | 'flat' | 'unknown';
  delta: number | null;
  periodDays: number | null;
};

export type DrAdvisorRequest = {
  domain: string;
  currentDr: number;
  trend: AdvisorTrend;
};

type DrAdvisorAction = {
  priority: number;
  title: string;
  reason: string;
};

export type DrAdvisorAdvice = {
  schemaVersion: 1;
  why: string;
  evidenceLimit: string;
  actions: DrAdvisorAction[];
};

export type CachedDrAdvisorAdvice = {
  advice: DrAdvisorAdvice;
  generatedAt: number;
  measurementKey: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
}

function normalizedDomain(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const domain = value
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
  if (
    domain.length < 4 ||
    domain.length > 253 ||
    !domain.includes('.') ||
    !/^[a-z0-9.-]+$/.test(domain)
  ) {
    return null;
  }
  return domain;
}

export function parseDrAdvisorRequest(value: unknown): DrAdvisorRequest {
  if (!isRecord(value)) throw new Error('Invalid advisor request.');
  const domain = normalizedDomain(value.domain);
  const currentDr = value.currentDr;
  const trend = value.trend;
  if (!domain || typeof currentDr !== 'number' || !Number.isFinite(currentDr)) {
    throw new Error('A valid domain and current DR are required.');
  }
  if (currentDr < 0 || currentDr > 100 || !isRecord(trend)) {
    throw new Error('DR or trend is out of range.');
  }
  const direction = trend.direction;
  if (!['up', 'down', 'flat', 'unknown'].includes(String(direction))) {
    throw new Error('Invalid trend direction.');
  }
  const delta =
    trend.delta === null
      ? null
      : typeof trend.delta === 'number' &&
          Number.isFinite(trend.delta) &&
          Math.abs(trend.delta) <= 100
        ? trend.delta
        : undefined;
  const periodDays =
    trend.periodDays === null
      ? null
      : typeof trend.periodDays === 'number' &&
          Number.isInteger(trend.periodDays) &&
          trend.periodDays >= 1 &&
          trend.periodDays <= 365
        ? trend.periodDays
        : undefined;
  if (delta === undefined || periodDays === undefined) throw new Error('Invalid trend bounds.');

  return {
    domain,
    currentDr: Number(currentDr.toFixed(1)),
    trend: {
      direction: direction as AdvisorTrend['direction'],
      delta: delta === null ? null : Number(delta.toFixed(1)),
      periodDays,
    },
  };
}

function stripFence(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim() ?? trimmed;
}

export function parseDrAdvisorAdvice(value: unknown): DrAdvisorAdvice {
  const parsed = typeof value === 'string' ? (JSON.parse(stripFence(value)) as unknown) : value;
  if (
    !isRecord(parsed) ||
    parsed.schemaVersion !== 1 ||
    !boundedString(parsed.why, 20, 800) ||
    !boundedString(parsed.evidenceLimit, 15, 400) ||
    !Array.isArray(parsed.actions) ||
    parsed.actions.length < 3 ||
    parsed.actions.length > 5
  ) {
    throw new Error('Advisor output did not match the expected structure.');
  }

  const actions = parsed.actions.map((item, index) => {
    if (
      !isRecord(item) ||
      item.priority !== index + 1 ||
      !boundedString(item.title, 3, 120) ||
      !boundedString(item.reason, 10, 400)
    ) {
      throw new Error('Advisor actions are invalid or not prioritized.');
    }
    return {
      priority: item.priority as number,
      title: item.title.trim(),
      reason: item.reason.trim(),
    };
  });

  return {
    schemaVersion: 1,
    why: parsed.why.trim(),
    evidenceLimit: parsed.evidenceLimit.trim(),
    actions,
  };
}

export function drAdvisorMeasurementKey(request: DrAdvisorRequest): string {
  const input = parseDrAdvisorRequest(request);
  const drBucket = Math.floor(input.currentDr / 5) * 5;
  const deltaBucket = input.trend.delta === null ? 'na' : Math.round(input.trend.delta);
  return `${input.domain}:${drBucket}:${input.trend.direction}:${deltaBucket}`;
}
