import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/server-session';
import { apiFetchAuthed } from '@/lib/api-client';
import { FleetMatrix } from '@/components/fleet/FleetMatrix';

export const dynamic = 'force-dynamic';

interface PostHogError {
  id: string;
  operation: string;
  project_id: string;
  durationMs: number;
  timestamp: string;
}

async function fetchPostHogErrors(): Promise<PostHogError[]> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;

  if (!apiKey || !projectId) return [];

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const res = await fetch(
      `https://us.i.posthog.com/api/projects/${projectId}/events/?limit=20&event=foundry_trace&after=${since}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!res.ok) return [];

    const data = (await res.json()) as { results?: Array<Record<string, unknown>> };
    const results = data.results ?? [];

    // Filter to errors only and map to display shape
    return results
      .filter((evt) => {
        const props = evt.properties as Record<string, unknown> | undefined;
        return props?.outcome === 'error';
      })
      .map((evt) => {
        const props = (evt.properties ?? {}) as Record<string, unknown>;
        return {
          id: String(evt.uuid ?? evt.id ?? Math.random()),
          operation: String(props.operation ?? props.op ?? 'unknown'),
          project_id: String(props.project_id ?? props.project_slug ?? props.project ?? props.foundry_project_id ?? props.distinct_id ?? 'unknown'),
          durationMs: Number(props.duration_ms ?? props.durationMs ?? 0),
          timestamp: String(evt.timestamp ?? ''),
        };
      });
  } catch {
    return [];
  }
}

export default async function FleetPage() {
  const session = await getDashboardSession();
  if (!session?.user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let projects: any[] = [];
  let fleetError: string | null = null;
  try {
    const res = await apiFetchAuthed<{ data: any[] }>('/v1/fleet/metadata');
    projects = res.data ?? [];
  } catch {
    fleetError = 'Could not load fleet data. Run `fnd fleet scan` to populate.';
  }

  const recentErrors = await fetchPostHogErrors();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Fleet Control</h1>
          <p className="text-sm text-muted-foreground mt-1">
            LTS framework baselines, scan metadata, and the managed project list. Run <code className="bg-muted px-1 rounded text-xs">fnd fleet scan</code> to refresh.
          </p>
        </div>
      </div>
      {fleetError ? (
        <div className="rounded-lg border border-yellow-800 bg-yellow-950/20 p-4 text-sm text-yellow-400">{fleetError}</div>
      ) : (
        <FleetMatrix projects={projects} />
      )}

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Errors (24h)</h2>
        {recentErrors.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/10 p-4 text-sm text-muted-foreground">
            No errors in the last 24 hours.
          </div>
        ) : (
          <div className="space-y-2">
            {recentErrors.map((err) => (
              <div
                key={err.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-red-950/20 p-3"
              >
                <span className="text-red-400 text-xs font-mono">{err.operation}</span>
                <span className="text-gray-400 text-xs">{err.project_id}</span>
                <span className="text-gray-600 text-xs ml-auto">{err.durationMs}ms</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
