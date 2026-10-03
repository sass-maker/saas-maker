import capturePolicy from '../../../../tooling/config/capture-projects.json';
import nativeApplicability from '../../../../tooling/config/app-health-native-applicability.json';

export type DailyCaptureCountRow = {
  catalogId: string;
  feedback: number | null;
  newsletter: number | null;
  waitlist: number | null;
};

export type CaptureApplicability = 'newsletter' | 'waitlist' | 'not-applicable' | 'undetermined';
export type MetricApplicability = 'applicable' | 'not_applicable' | 'unknown';

export type DailyCaptureCounts = {
  coverageStart: string | null;
  rows: DailyCaptureCountRow[];
  /** Project applicability from the catalog-generated policy; no rationale or evidence leaves this private API. */
  applicabilityByCatalogId: Record<string, CaptureApplicability>;
  /** Feedback surface applicability; missing policy remains unknown. */
  feedbackApplicabilityByCatalogId: Record<string, MetricApplicability>;
  nativeSessionsApplicabilityByCatalogId: Record<string, MetricApplicability>;
  browserVisitorsApplicabilityByCatalogId: Record<string, MetricApplicability>;
  serverRequestsApplicabilityByCatalogId: Record<string, MetricApplicability>;
};

type AggregateRow = {
  coverage_start: string | null;
  catalog_id: string | null;
  feedback: number | null;
  newsletter: number | null;
  waitlist: number | null;
};

const MAX_CATALOG_IDS = 55;
const CATALOG_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

type FeedbackPolicyProject = { id: string; feedbackApplicability?: string };

export function mapFeedbackApplicabilityByCatalogId(
  catalogIds: readonly string[],
  projects: readonly FeedbackPolicyProject[]
): Record<string, MetricApplicability> {
  const policyById = new Map(
    projects.map(({ id, feedbackApplicability }) => [id, feedbackApplicability])
  );
  return Object.fromEntries(
    catalogIds.map((id) => {
      const applicability = policyById.get(id);
      return [
        id,
        applicability === 'applicable' || applicability === 'not_applicable'
          ? applicability
          : 'unknown',
      ];
    })
  );
}

function currentIndiaDay(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function validateRequest(date: string, catalogIds: string[]): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new TypeError('date must be YYYY-MM-DD');
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new TypeError('date is not a valid calendar day');
  }
  if (date >= currentIndiaDay()) throw new TypeError('date must be a completed India day');
  if (!Array.isArray(catalogIds) || catalogIds.length < 1 || catalogIds.length > MAX_CATALOG_IDS) {
    throw new TypeError(`catalogIds must contain 1 to ${MAX_CATALOG_IDS} IDs`);
  }
  if (
    catalogIds.some((id) => typeof id !== 'string' || !CATALOG_ID_RE.test(id)) ||
    new Set(catalogIds).size !== catalogIds.length
  ) {
    throw new TypeError('catalogIds must be unique valid catalog IDs');
  }
}

/** Query a single completed India day for only explicitly bound catalog IDs. */
export async function getDailyCaptureCounts(
  db: D1Database,
  date: string,
  catalogIds: string[]
): Promise<DailyCaptureCounts> {
  validateRequest(date, catalogIds);
  const requestedIds = catalogIds.map(() => '(?)').join(', ');
  const result = await db
    .prepare(
      `WITH requested(catalog_id) AS (VALUES ${requestedIds}),
       coverage AS (
         SELECT date(cutover_at, '+5 hours', '+30 minutes', '+1 day') AS coverage_start
         FROM daily_capture_coverage WHERE id = 1
       ),
       eligible AS (
         SELECT b.saas_maker_project_id AS project_id, b.catalog_project_id AS catalog_id
         FROM catalog_project_bindings b
         JOIN requested r ON r.catalog_id = b.catalog_project_id
       ),
       counts AS (
         SELECT e.catalog_id,
           SUM(CASE WHEN r.event_type = 'feedback' THEN 1 ELSE 0 END) AS feedback,
           SUM(CASE WHEN r.event_type = 'newsletter' THEN 1 ELSE 0 END) AS newsletter,
           SUM(CASE WHEN r.event_type = 'waitlist' THEN 1 ELSE 0 END) AS waitlist
         FROM eligible e
         JOIN daily_capture_receipts r
           ON r.project_id = e.project_id AND r.india_day = ?
         GROUP BY e.catalog_id
       )
       SELECT coverage.coverage_start, eligible.catalog_id,
         CASE WHEN coverage.coverage_start IS NULL OR ? < coverage.coverage_start
           THEN NULL ELSE COALESCE(counts.feedback, 0) END AS feedback,
         CASE WHEN coverage.coverage_start IS NULL OR ? < coverage.coverage_start
           THEN NULL ELSE COALESCE(counts.newsletter, 0) END AS newsletter,
         CASE WHEN coverage.coverage_start IS NULL OR ? < coverage.coverage_start
           THEN NULL ELSE COALESCE(counts.waitlist, 0) END AS waitlist
       FROM coverage
       LEFT JOIN eligible ON 1 = 1
       LEFT JOIN counts ON counts.catalog_id = eligible.catalog_id
       ORDER BY eligible.catalog_id`
    )
    .bind(...catalogIds, date, date, date, date)
    .all<AggregateRow>();

  const coverageStart = result.results[0]?.coverage_start ?? null;
  const policyById = new Map<string, CaptureApplicability>(
    capturePolicy.projects.map(({ id, applicability }) => [
      id,
      applicability as CaptureApplicability,
    ])
  );
  const applicabilityByCatalogId: Record<string, CaptureApplicability> = {};
  const nativeSessionsApplicabilityByCatalogId: Record<string, MetricApplicability> = {};
  const browserVisitorsApplicabilityByCatalogId: Record<string, MetricApplicability> = {};
  const serverRequestsApplicabilityByCatalogId: Record<string, MetricApplicability> = {};
  for (const id of catalogIds) {
    const applicability = policyById.get(id);
    if (applicability) applicabilityByCatalogId[id] = applicability;
  }
  const feedbackApplicabilityByCatalogId = mapFeedbackApplicabilityByCatalogId(
    catalogIds,
    capturePolicy.projects
  );
  const nativePolicyById = new Map<string, MetricApplicability>(
    nativeApplicability.products.map(
      ({ id, nativeSessions }) =>
        [
          id,
          (nativeSessions === 'not-applicable'
            ? 'not_applicable'
            : 'applicable') as MetricApplicability,
        ] as const
    )
  );
  for (const id of catalogIds) {
    const applicability = nativePolicyById.get(id);
    if (applicability) nativeSessionsApplicabilityByCatalogId[id] = applicability;
  }
  const browserPolicyById = new Map<string, MetricApplicability>(
    nativeApplicability.products.map(
      ({ id, browserVisitors }) =>
        [
          id,
          (browserVisitors === 'not-applicable'
            ? 'not_applicable'
            : 'applicable') as MetricApplicability,
        ] as const
    )
  );
  for (const id of catalogIds) {
    const applicability = browserPolicyById.get(id);
    if (applicability) browserVisitorsApplicabilityByCatalogId[id] = applicability;
  }
  const serverPolicyById = new Map<string, MetricApplicability>(
    nativeApplicability.products.map(({ id, serverRequests }): [string, MetricApplicability] => [
      id,
      serverRequests === 'not-applicable'
        ? 'not_applicable'
        : serverRequests === 'applicable'
          ? 'applicable'
          : 'unknown',
    ])
  );
  for (const id of catalogIds) {
    const applicability = serverPolicyById.get(id);
    if (applicability) serverRequestsApplicabilityByCatalogId[id] = applicability;
  }
  return {
    coverageStart,
    applicabilityByCatalogId,
    feedbackApplicabilityByCatalogId,
    nativeSessionsApplicabilityByCatalogId,
    browserVisitorsApplicabilityByCatalogId,
    serverRequestsApplicabilityByCatalogId,
    rows: result.results
      .filter((row): row is AggregateRow & { catalog_id: string } => row.catalog_id !== null)
      .map((row) => ({
        catalogId: row.catalog_id,
        feedback: row.feedback,
        newsletter: row.newsletter,
        waitlist: row.waitlist,
      })),
  };
}
