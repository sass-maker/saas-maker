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
