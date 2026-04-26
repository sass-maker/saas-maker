const POSTHOG_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID;
const POSTHOG_HOST = process.env.POSTHOG_HOST || "https://us.posthog.com";

export interface FoundryErrorEvent {
  id: string;
  event: string;
  timestamp: string;
  message: string;
  severity: string;
  project_id: string;
  stack?: string;
  context?: any;
}

/**
 * Fetches recent foundry_error events from PostHog.
 * Server-side only.
 */
export async function getFleetErrors(limit = 20): Promise<FoundryErrorEvent[]> {
  if (!POSTHOG_API_KEY || !POSTHOG_PROJECT_ID) {
    console.warn("PostHog credentials missing for Error Feed");
    return [];
  }

  const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`;

  const query = {
    query: {
      kind: "EventsQuery",
      select: [
        "*",
        "event",
        "timestamp",
        "properties.message",
        "properties.severity",
        "properties.foundry_project_id",
        "properties.$exception_stack",
      ],
      where: ["event == 'foundry_error'"],
      orderBy: ["timestamp DESC"],
      limit,
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${POSTHOG_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(query),
    });

    if (!res.ok) {
      throw new Error(`PostHog Error: ${await res.text()}`);
    }

    const data = await res.json();
    
    // PostHog query results come back as an array of arrays (rows)
    // Map them back to objects based on the 'select' fields
    return (data.results || []).map((row: any[]) => ({
      id: row[0].id,
      event: row[1],
      timestamp: row[2],
      message: row[3],
      severity: row[4],
      project_id: row[5],
      stack: row[6],
    }));
  } catch (err) {
    console.error("Failed to fetch fleet errors:", err);
    return [];
  }
}

export interface FoundryLatencyMetric {
  project_id: string;
  trace_name: string;
  avg_duration_ms: number;
  p95_duration_ms: number;
  count: number;
}

/**
 * Fetches aggregated trace latency metrics from PostHog using HogQL.
 * Server-side only.
 */
export async function getFleetLatency(): Promise<FoundryLatencyMetric[]> {
  if (!POSTHOG_API_KEY || !POSTHOG_PROJECT_ID) {
    return [];
  }

  const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`;

  const query = {
    query: {
      kind: "HogQLQuery",
      query: `
        SELECT
          properties.foundry_project_id AS project_id,
          properties.traceName AS trace_name,
          avg(properties.traceDuration) AS avg_duration_ms,
          quantile(0.95)(properties.traceDuration) AS p95_duration_ms,
          count() AS count
        FROM events
        WHERE event = 'foundry_trace' AND timestamp >= now() - INTERVAL 1 DAY
        GROUP BY project_id, trace_name
        ORDER BY avg_duration_ms DESC
        LIMIT 50
      `
    }
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${POSTHOG_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(query),
    });

    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();
    return (data.results || []).map((row: any[]) => ({
      project_id: row[0] || 'unknown',
      trace_name: row[1] || 'unnamed-trace',
      avg_duration_ms: Math.round(row[2] || 0),
      p95_duration_ms: Math.round(row[3] || 0),
      count: row[4] || 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetches operational metrics for a specific project.
 */
export async function getProjectOperationalState(projectId: string) {
  if (!POSTHOG_API_KEY || !POSTHOG_PROJECT_ID) return null;

  const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`;

  const query = {
    query: {
      kind: "HogQLQuery",
      query: `
        SELECT
          countIf(event = 'foundry_error') AS error_count,
          avgIf(properties.traceDuration, event = 'foundry_trace') AS avg_latency,
          max(timestamp) AS last_event_at
        FROM events
        WHERE properties.foundry_project_id = '${projectId}' AND timestamp >= now() - INTERVAL 1 DAY
      `
    }
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${POSTHOG_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(query),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const row = data.results?.[0] || [0, 0, null];

    return {
      errorCount: row[0],
      avgLatency: Math.round(row[1] || 0),
      lastEventAt: row[2],
      isOnline: row[2] ? (Date.now() - new Date(row[2]).getTime()) < 300000 : false, // Online if event in last 5 mins
    };
  } catch {
    return null;
  }
}
